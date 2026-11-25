import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import {
  accediAlBackOfficeComeAdmin,
  accediComeCollaboratore,
} from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";
import { barraSelezione, selezionaRighe } from "./support/elenchi";
import { apriPaginaOfferte } from "./support/offerte";
import { e2ePrisma } from "./support/prisma";

/**
 * Test e2e — US-051: parti non coperte del feedback di attesa uniforme
 *
 * Copre i punti che `feedback-attesa-azioni.spec.ts` lascia scoperti, cioè i
 * flussi imperativi che passano da `attesaEsterna` invece che da
 * `useFormStatus`:
 *
 * - dettaglio giornata, salvataggio riga (feedback immediato): la riga compare
 *   subito in attesa di conferma, il form si svuota e il pulsante resta usabile;
 *   al rifiuto del server la riga sparisce, il form torna compilato e compare
 *   il motivo;
 * - dettaglio giornata, eliminazione: la riga sparisce subito, solo lei; se
 *   l'eliminazione non riesce ricompare con un messaggio;
 * - elenco offerte, conferma della disattivazione dalla barra azioni: il
 *   `PulsanteAttesa` del dialog si disabilita, espone `aria-busy` e mostra
 *   «Disattivazione…» fino all'esito.
 *
 * Nessuna attesa a tempo: la POST della server action è trattenuta da una route
 * registrata sulla pagina e sbloccata esplicitamente dal test dopo le
 * asserzioni sullo stato di attesa.
 */

/** Mese riservato a questa spec, distinto da quello di `feedback-attesa-azioni`. */
const CODICE_SPEC = "US-051-front-office";

type TrattenutaPost = {
  /** Sblocca la POST trattenuta e la lascia proseguire verso il server. */
  rilascia: () => void;
  /** Quante POST della server action sono state intercettate finora. */
  conteggioPost: () => number;
  /** Rimuove l'intercettazione, ripristinando il traffico normale. */
  smetti: () => Promise<void>;
};

/**
 * Trattiene la POST della server action diretta a `percorso` finché il test non
 * chiama `rilascia()`. Le GET (documento, RSC, `router.refresh()`) passano senza
 * modifiche: viene rallentata solo la scrittura sotto osservazione.
 *
 * Da registrare sempre DOPO aver popolato le select del form: anche il cascade
 * cliente → offerte passa da una server action, quindi da una POST sullo stesso
 * percorso, e verrebbe trattenuta insieme al salvataggio.
 */
async function trattieniPostDellaPagina(
  page: Page,
  percorso: string,
): Promise<TrattenutaPost> {
  let rilascia!: () => void;
  const trattenuta = new Promise<void>((risolvi) => {
    rilascia = risolvi;
  });
  let postIntercettate = 0;

  const rotta = (url: URL) => url.pathname === percorso;

  await page.route(rotta, async (route) => {
    if (route.request().method() === "POST") {
      postIntercettate += 1;
      await trattenuta;
    }

    await route.continue();
  });

  return {
    rilascia,
    conteggioPost: () => postIntercettate,
    smetti: async () => {
      rilascia();
      await page.unroute(rotta);
    },
  };
}

/**
 * Attende in modo web-first che React abbia idratato il nodo: prima
 * dell'idratazione i gestori client non sono agganciati e il click, o il
 * `change` della select, è un no-op.
 *
 * Il dettaglio giornata non espone il contratto `data-idratata` delle tabelle
 * offerte, quindi si osserva la proprietà `__reactFiber$…` che React attacca al
 * nodo DOM nel momento in cui lo idrata. Resta un polling su stato osservabile,
 * non un'attesa a tempo.
 */
async function attendiIdratazione(locator: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        locator.evaluate((elemento) =>
          Object.keys(elemento).some((chiave) => chiave.startsWith("__reactFiber$")),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
}

/**
 * Fa fallire a livello di rete la prossima POST della server action diretta a
 * `percorso`, come una connessione caduta: il client riceve un errore invece
 * di un esito.
 */
async function interrompiProssimaPost(page: Page, percorso: string): Promise<void> {
  let interrotta = false;
  await page.route(
    (url: URL) => url.pathname === percorso,
    async (route) => {
      if (interrotta || route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      interrotta = true;
      await route.abort("failed");
    },
  );
}

/** Card di una riga di attività, localizzata dalla sua nota univoca. */
function rigaAttivitaConNota(page: Page, nota: string): Locator {
  return page
    .getByTestId("activity-row")
    .filter({ has: page.getByText(nota, { exact: true }) });
}

/** Riga della tabella offerte che contiene il codice indicato. */
function rigaOffertaConCodice(page: Page, codice: string): Locator {
  return page
    .locator("table[aria-label='Elenco offerte'] tbody tr")
    .filter({ hasText: codice });
}

/**
 * Disattiva un'offerta creata dalla factory per questo test.
 *
 * Serve a provocare un rifiuto che arriva DAL SERVER, dopo l'`await` della
 * server action: le validazioni sulle ore sono identiche sul client e sul
 * server (`validaOreLocale` rispecchia `validaOre`), quindi si fermano prima
 * che l'attesa cominci e non esercitano il `finally`. Disattivare l'offerta
 * fa invece rispondere `creaRiga` con `{ success: false }` dopo il round-trip,
 * cioè esattamente sul `return` anticipato dentro il `try`.
 *
 * Va disattivata la SOLA offerta selezionata, lasciandone un'altra attiva
 * sullo stesso cliente: la risposta della server action riporta anche
 * l'albero RSC aggiornato, e se il cliente restasse senza offerte attive
 * sparirebbe dalla select, svuotando il form per un motivo diverso
 * dall'attesa e rendendo cieca l'asserzione.
 *
 * Tocca solo un'offerta creata dalla factory in questo test: nessuna entità
 * di seed e nessun dato condiviso con altri worker.
 */
async function disattivaOfferta(offertaId: string): Promise<void> {
  const esito = await e2ePrisma.query(
    `UPDATE "Offerta" SET "attiva" = false WHERE "id" = $1`,
    [offertaId],
  );

  expect(esito.rowCount).toBe(1);
}

test.describe("US-051 Feedback di attesa fuori dai form action", () => {
  test("AC-2 — la riga aggiunta compare subito in attesa e si conferma all'esito", async ({
    page,
    factory,
    collaboratore,
  }) => {
    const clienteConOfferta = await factory.createClienteConOfferta();
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    const data = dataNelMese(meseRiservato(CODICE_SPEC), 11);
    const percorsoGiornata = `/attivita/${data}`;
    await page.goto(percorsoGiornata);

    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");
    await attendiIdratazione(selectCliente);

    await selectCliente.selectOption(clienteConOfferta.cliente.id);
    await expect(selectOfferta).toBeEnabled();
    await selectOfferta.selectOption(clienteConOfferta.offerta.id);
    await expect(selectOfferta).toHaveValue(clienteConOfferta.offerta.id);

    const nota = `US-051 attesa salvataggio ${randomUUID()}`;
    await page.locator("#ore").fill("6,5");
    await page.locator("#nota").fill(nota);

    const pulsanteSalva = page.getByRole("button", { name: "Aggiungi riga", exact: true });
    await expect(pulsanteSalva).toBeEnabled();

    const gate = await trattieniPostDellaPagina(page, percorsoGiornata);
    await pulsanteSalva.click();

    // Con la POST ancora trattenuta la riga è già a schermo, in attesa di
    // conferma, e il form è vuoto e pronto per la riga successiva.
    const riga = rigaAttivitaConNota(page, nota);
    await expect(riga).toBeVisible();
    await expect(riga).toHaveAttribute("data-in-attesa", "true");
    await expect(riga.getByTestId("indicatore-salvataggio")).toHaveText("Salvataggio…");
    await expect(riga.getByRole("button", { name: "Elimina", exact: true })).toBeDisabled();
    await expect(page.locator("#ore")).toHaveValue("");
    await expect(page.locator("#nota")).toHaveValue("");
    await expect(pulsanteSalva).toBeEnabled();

    // Un secondo click sul form appena svuotato non invia nulla e non segnala errori.
    await pulsanteSalva.click();
    await expect(page.getByText("Compila tutti i campi obbligatori")).toHaveCount(0);

    gate.rilascia();

    // Alla conferma la riga diventa una riga normale, con le azioni attive.
    await expect(riga).not.toHaveAttribute("data-in-attesa", "true");
    await expect(riga.getByTestId("indicatore-salvataggio")).toHaveCount(0);
    await expect(riga.getByRole("button", { name: "Elimina", exact: true })).toBeEnabled();
    await expect(riga).toHaveCount(1);

    expect(gate.conteggioPost()).toBe(1);
    await gate.smetti();
  });

  test("AC-4 — se il server rifiuta, la riga sparisce e il form torna compilato con il motivo", async ({
    page,
    factory,
    collaboratore,
  }) => {
    const clienteConOfferta = await factory.createClienteConOfferta();
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    // Seconda offerta attiva sullo stesso cliente: tiene il cliente nella
    // select anche dopo la disattivazione mirata dell'offerta selezionata.
    const offertaSuperstite = await factory.createOfferta({
      cliente: clienteConOfferta.cliente,
    });
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: offertaSuperstite,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    const data = dataNelMese(meseRiservato(CODICE_SPEC), 12);
    const percorsoGiornata = `/attivita/${data}`;
    await page.goto(percorsoGiornata);

    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");
    await attendiIdratazione(selectCliente);

    await selectCliente.selectOption(clienteConOfferta.cliente.id);
    await expect(selectOfferta).toBeEnabled();
    await selectOfferta.selectOption(clienteConOfferta.offerta.id);
    await expect(selectOfferta).toHaveValue(clienteConOfferta.offerta.id);

    const nota = `US-051 attesa errore ${randomUUID()}`;
    const campoOre = page.locator("#ore");
    await page.locator("#nota").fill(nota);

    const pulsanteSalva = page.getByRole("button", { name: "Aggiungi riga", exact: true });

    // Rifiuto locale: le ore non valide sono intercettate prima della chiamata,
    // quindi nessuna riga compare.
    await campoOre.fill("abc");
    await pulsanteSalva.click();
    await expect(page.getByText("Valore non valido")).toBeVisible();
    await expect(rigaAttivitaConNota(page, nota)).toHaveCount(0);

    // Rifiuto del server: l'offerta viene disattivata a pagina già aperta, così
    // l'esito negativo arriva dopo che la riga è già stata mostrata.
    await campoOre.fill("6,5");
    await disattivaOfferta(clienteConOfferta.offerta.id);

    const gate = await trattieniPostDellaPagina(page, percorsoGiornata);
    await pulsanteSalva.click();

    await expect(rigaAttivitaConNota(page, nota)).toHaveAttribute("data-in-attesa", "true");

    gate.rilascia();

    // La riga provvisoria sparisce, il motivo dice quale riga non è stata
    // salvata e quanto digitato torna nel form per correggerlo.
    await expect(rigaAttivitaConNota(page, nota)).toHaveCount(0);
    await expect(page.getByText("L'offerta non è più attiva", { exact: true })).toBeVisible();
    await expect(page.getByText(/non è stata salvata:/)).toBeVisible();
    await expect(campoOre).toHaveValue("6,5");
    await expect(page.locator("#nota")).toHaveValue(nota);
    await expect(selectCliente).toHaveValue(clienteConOfferta.cliente.id);
    await expect(selectOfferta).toHaveValue(clienteConOfferta.offerta.id);
    await expect(pulsanteSalva).toBeEnabled();

    expect(gate.conteggioPost()).toBe(1);
    await gate.smetti();
  });

  test("AC-3 — l'eliminazione toglie subito solo quella riga e la ripristina se non riesce", async ({
    page,
    factory,
    collaboratore,
  }) => {
    const clienteConOfferta = await factory.createClienteConOfferta();
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    const data = dataNelMese(meseRiservato(CODICE_SPEC), 13);
    const notaRigaInAzione = `US-051 riga in azione ${randomUUID()}`;
    const notaRigaSpettatrice = `US-051 riga spettatrice ${randomUUID()}`;

    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: new Date(`${data}T00:00:00.000Z`),
      ore: "4.00",
      nota: notaRigaInAzione,
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: new Date(`${data}T00:00:00.000Z`),
      ore: "2.00",
      nota: notaRigaSpettatrice,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    const percorsoGiornata = `/attivita/${data}`;
    await page.goto(percorsoGiornata);

    const rigaInAzione = rigaAttivitaConNota(page, notaRigaInAzione);
    const rigaSpettatrice = rigaAttivitaConNota(page, notaRigaSpettatrice);
    await expect(rigaInAzione).toBeVisible();
    await expect(rigaSpettatrice).toBeVisible();

    const eliminaRigaInAzione = rigaInAzione.getByRole("button", {
      name: "Elimina",
      exact: true,
    });
    const eliminaRigaSpettatrice = rigaSpettatrice.getByRole("button", {
      name: "Elimina",
      exact: true,
    });
    const modificaRigaSpettatrice = rigaSpettatrice.getByRole("button", {
      name: "Modifica",
      exact: true,
    });

    await attendiIdratazione(eliminaRigaInAzione);

    // `handleElimina` passa da `window.confirm`: senza handler Playwright
    // rifiuta il dialog e il click non produce alcuna chiamata.
    page.on("dialog", (dialog) => {
      void dialog.accept();
    });

    // ── Eliminazione non riuscita (rete caduta): la riga ricompare con il motivo ──
    await interrompiProssimaPost(page, percorsoGiornata);
    await eliminaRigaInAzione.click();
    await expect(page.getByTestId("avviso-mutazione-non-riuscita")).toContainText(
      "non è riuscita",
    );
    await expect(rigaInAzione).toBeVisible();
    await expect(eliminaRigaInAzione).toBeEnabled();

    // ── Eliminazione riuscita: la riga sparisce prima dell'esito ──
    const gate = await trattieniPostDellaPagina(page, percorsoGiornata);
    await eliminaRigaInAzione.click();

    await expect(rigaInAzione).toHaveCount(0);
    // L'altra riga resta operativa mentre l'eliminazione è in corso.
    await expect(eliminaRigaSpettatrice).toBeEnabled();
    await expect(modificaRigaSpettatrice).toBeEnabled();

    gate.rilascia();

    await expect(rigaSpettatrice).toBeVisible();
    await expect(rigaInAzione).toHaveCount(0);

    expect(gate.conteggioPost()).toBe(1);
    await gate.smetti();

    // L'eliminazione è stata davvero salvata.
    await page.reload();
    await expect(rigaSpettatrice).toBeVisible();
    await expect(rigaInAzione).toHaveCount(0);
  });

  test("AC-2 — la conferma di disattivazione offerta espone l'attesa fino all'esito", async ({
    page,
    factory,
  }) => {
    const codice = `E2E-US051-TOGGLE-${randomUUID().slice(0, 8)}`.toUpperCase();
    const offerta = await factory.createOfferta({ codice, attiva: true });

    await accediAlBackOfficeComeAdmin(page);
    await apriPaginaOfferte(page, offerta.codice);

    const barra = await selezionaRighe(page, [offerta.codice]);
    await barra.getByRole("button", { name: "Disattiva", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: `Disattivare «${offerta.codice}»?`,
    });
    const conferma = dialog.getByRole("button", {
      name: "Disattiva",
      exact: true,
    });
    await expect(conferma).toBeEnabled();
    await expect(conferma).toHaveAttribute("aria-busy", "false");

    const gate = await trattieniPostDellaPagina(page, "/offerte");
    await conferma.click();

    const inAttesa = dialog.getByRole("button", {
      name: "Disattivazione…",
      exact: true,
    });
    await expect(inAttesa).toBeDisabled();
    await expect(inAttesa).toHaveAttribute("aria-busy", "true");
    // Prima dell'esito la riga non cambia stato.
    await expect(
      rigaOffertaConCodice(page, offerta.codice).getByText("Attiva", {
        exact: true,
      }),
    ).toBeVisible();

    gate.rilascia();

    // Solo all'esito la chip cambia stato, il dialog si chiude e la selezione si azzera.
    await page.waitForURL(
      (url) =>
        url.pathname === "/offerte" &&
        url.searchParams.get("esito") === "stato-offerta-aggiornato" &&
        url.searchParams.get("q") === offerta.codice,
    );
    await expect(
      rigaOffertaConCodice(page, offerta.codice).getByText("Disattivata", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(barraSelezione(page)).toBeHidden();

    expect(gate.conteggioPost()).toBe(1);
    await gate.smetti();
  });
});
