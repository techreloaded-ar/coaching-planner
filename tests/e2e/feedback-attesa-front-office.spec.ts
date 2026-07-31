import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import {
  accediAlBackOfficeComeAdmin,
  accediComeCollaboratore,
} from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";
import { attendiTabellaOfferteIdratata } from "./support/offerte";
import { e2ePrisma } from "./support/prisma";

/**
 * Test e2e — US-051: parti non coperte del feedback di attesa uniforme
 *
 * Copre i punti che `feedback-attesa-azioni.spec.ts` lascia scoperti, cioè i
 * flussi imperativi che passano da `attesaEsterna` invece che da
 * `useFormStatus`:
 *
 * - dettaglio giornata, salvataggio riga: l'attesa copre l'intera chiamata alla
 *   server action e TERMINA sempre, anche quando l'esito è un errore. È il
 *   punto in cui il `finally` attorno all'`await` è l'unica cosa che impedisce
 *   al pulsante di restare disabilitato per sempre;
 * - dettaglio giornata, `rigaInAttesaId`: il lock riguarda la sola riga su cui
 *   è in corso l'azione, non l'intero elenco;
 * - elenco offerte, pallino di stato: `PulsanteAttesa` con
 *   `mostraRotellina={false}`, dove il feedback passa solo da `aria-busy` e i
 *   contratti `aria-label`/`aria-pressed` dei locator esistenti devono restare
 *   invariati durante l'attesa.
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
 * Pulsante di salvataggio riga: l'etichetta diventa «Salvataggio…» durante
 * l'attesa, quindi il locator copre entrambi gli stati per restare valido
 * attraverso la chiamata alla server action.
 */
function pulsanteSalvataggioRiga(page: Page, etichettaRiposo: string): Locator {
  return page.getByRole("button", {
    name: new RegExp(`^(?:${etichettaRiposo}|Salvataggio…)$`),
  });
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
 * Revoca l'abilitazione creata dalla factory per questo test.
 *
 * Serve a provocare un rifiuto che arriva DAL SERVER, dopo l'`await` della
 * server action: le validazioni sulle ore sono identiche sul client e sul
 * server (`validaOreLocale` rispecchia `validaOre`), quindi si fermano prima
 * che l'attesa cominci e non esercitano il `finally`. Togliere l'abilitazione
 * fa invece rispondere `creaRiga` con `{ success: false }` dopo il round-trip,
 * cioè esattamente sul `return` anticipato dentro il `try`.
 *
 * Va revocata l'abilitazione della SOLA offerta selezionata, lasciandone
 * un'altra abilitata sullo stesso cliente: la risposta della server action
 * riporta anche l'albero RSC aggiornato, e se il collaboratore restasse senza
 * alcuna offerta abilitata il form passerebbe legittimamente allo stato
 * "nessun cliente abilitato", che disabilita il salvataggio per un motivo
 * diverso dall'attesa e renderebbe cieca l'asserzione.
 *
 * Tocca solo una riga creata dalla factory in questo test: nessuna entità di
 * seed e nessun dato condiviso con altri worker.
 */
async function revocaAbilitazioneOfferta(
  collaboratoreId: string,
  offertaId: string,
): Promise<void> {
  const esito = await e2ePrisma.query(
    `DELETE FROM "AbilitazioneOfferta"
      WHERE "collaboratoreId" = $1 AND "offertaId" = $2`,
    [collaboratoreId, offertaId],
  );

  expect(esito.rowCount).toBe(1);
}

test.describe("US-051 Feedback di attesa fuori dai form action", () => {
  test("AC-2 — il salvataggio di una riga resta in attesa per tutta la chiamata e la chiude all'esito", async ({
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

    const pulsanteSalva = pulsanteSalvataggioRiga(page, "Aggiungi riga");
    await expect(pulsanteSalva).toBeEnabled();
    await expect(pulsanteSalva).toHaveAttribute("aria-busy", "false");

    const gate = await trattieniPostDellaPagina(page, percorsoGiornata);
    await pulsanteSalva.click();

    // AC-2: con la POST ancora trattenuta l'attesa è già visibile e il pulsante
    // non accetta un secondo invio.
    await expect(pulsanteSalva).toBeDisabled();
    await expect(pulsanteSalva).toHaveAttribute("aria-busy", "true");
    await expect(
      page.getByRole("button", { name: "Salvataggio…", exact: true }),
    ).toBeVisible();

    gate.rilascia();

    // AC-2: la riga è salvata e l'attesa è terminata, etichetta compresa.
    await expect(rigaAttivitaConNota(page, nota)).toBeVisible();
    await expect(pulsanteSalva).toBeEnabled();
    await expect(pulsanteSalva).toHaveAttribute("aria-busy", "false");
    await expect(
      page.getByRole("button", { name: "Aggiungi riga", exact: true }),
    ).toBeVisible();

    // AC-2: il pulsante disabilitato ha impedito il secondo invio.
    expect(gate.conteggioPost()).toBe(1);
    await gate.smetti();
  });

  test("AC-4 — un esito di errore chiude l'attesa e lascia la riga ricorreggibile", async ({
    page,
    factory,
    collaboratore,
  }) => {
    const clienteConOfferta = await factory.createClienteConOfferta();
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    // Seconda offerta abilitata sullo stesso cliente: tiene il collaboratore
    // abilitato anche dopo la revoca mirata sull'offerta selezionata.
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

    const pulsanteSalva = pulsanteSalvataggioRiga(page, "Aggiungi riga");

    // AC-4, rifiuto locale: le ore non valide sono intercettate prima della
    // chiamata, quindi il pulsante non deve nemmeno entrare in attesa.
    await campoOre.fill("abc");
    await pulsanteSalva.click();
    await expect(page.getByText("Valore non valido")).toBeVisible();
    await expect(pulsanteSalva).toBeEnabled();
    await expect(pulsanteSalva).toHaveAttribute("aria-busy", "false");

    // AC-4, rifiuto del server: l'abilitazione viene revocata a pagina già
    // aperta, così l'esito negativo arriva dopo l'`await` della server action.
    await campoOre.fill("6,5");
    await revocaAbilitazioneOfferta(
      collaboratore.collaboratore.id,
      clienteConOfferta.offerta.id,
    );

    const gate = await trattieniPostDellaPagina(page, percorsoGiornata);
    await pulsanteSalva.click();

    await expect(pulsanteSalva).toBeDisabled();
    await expect(pulsanteSalva).toHaveAttribute("aria-busy", "true");

    gate.rilascia();

    // AC-4: l'attesa TERMINA anche sul ramo di errore. Se il `finally` non
    // coprisse il return anticipato, il pulsante resterebbe disabilitato e la
    // riga non sarebbe più correggibile.
    await expect(
      page.getByText("Non sei abilitato a registrare attività su questa offerta"),
    ).toBeVisible();
    await expect(pulsanteSalva).toBeEnabled();
    await expect(pulsanteSalva).toHaveAttribute("aria-busy", "false");
    await expect(
      page.getByRole("button", { name: "Aggiungi riga", exact: true }),
    ).toBeVisible();

    // AC-4: quanto digitato è conservato e nessuna riga è stata creata.
    await expect(campoOre).toHaveValue("6,5");
    await expect(page.locator("#nota")).toHaveValue(nota);
    await expect(rigaAttivitaConNota(page, nota)).toHaveCount(0);

    expect(gate.conteggioPost()).toBe(1);
    await gate.smetti();
  });

  test("AC-3 — l'attesa su una riga blocca solo quella riga, non l'intero elenco", async ({
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

    // La riga in azione ha un rimborso trasferta fotografato, così espone tutti
    // e tre i pulsanti governati da `rigaInAttesaId`.
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: new Date(`${data}T00:00:00.000Z`),
      ore: "4.00",
      nota: notaRigaInAzione,
      rimborsoTrasfertaEtichetta: "Voce attesa front-office",
      rimborsoTrasfertaImporto: "50.00",
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
    const modificaRigaInAzione = rigaInAzione.getByRole("button", {
      name: "Modifica",
      exact: true,
    });
    const rimuoviRimborsoRigaInAzione = rigaInAzione.getByRole("button", {
      name: "Rimuovi rimborso",
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

    const gate = await trattieniPostDellaPagina(page, percorsoGiornata);
    await eliminaRigaInAzione.click();

    // AC-3: la riga sotto azione è interamente bloccata, niente doppio invio.
    await expect(eliminaRigaInAzione).toBeDisabled();
    await expect(eliminaRigaInAzione).toHaveAttribute("aria-busy", "true");
    await expect(modificaRigaInAzione).toBeDisabled();
    await expect(modificaRigaInAzione).toHaveAttribute("aria-busy", "true");
    await expect(rimuoviRimborsoRigaInAzione).toBeDisabled();
    await expect(rimuoviRimborsoRigaInAzione).toHaveAttribute(
      "aria-busy",
      "true",
    );

    // AC-3: l'altra riga resta operativa. È la proprietà che distingue un lock
    // per-riga da un lock globale, e che una regressione romperebbe in silenzio.
    await expect(eliminaRigaSpettatrice).toBeEnabled();
    await expect(eliminaRigaSpettatrice).toHaveAttribute("aria-busy", "false");
    await expect(modificaRigaSpettatrice).toBeEnabled();
    await expect(modificaRigaSpettatrice).toHaveAttribute("aria-busy", "false");

    gate.rilascia();

    // AC-3: solo all'esito la riga sparisce e il lock si scioglie.
    await expect(rigaInAzione).toHaveCount(0);
    await expect(rigaSpettatrice).toBeVisible();
    await expect(eliminaRigaSpettatrice).toBeEnabled();
    await expect(eliminaRigaSpettatrice).toHaveAttribute("aria-busy", "false");

    expect(gate.conteggioPost()).toBe(1);
    await gate.smetti();
  });

  test("AC-2 — il pallino di stato offerta espone l'attesa senza rotellina e senza perdere i suoi contratti", async ({
    page,
    factory,
  }) => {
    const codice = `E2E-US051-TOGGLE-${randomUUID().slice(0, 8)}`.toUpperCase();
    const offerta = await factory.createOfferta({ codice, attiva: true });

    await accediAlBackOfficeComeAdmin(page);
    await page.goto("/offerte");
    await attendiTabellaOfferteIdratata(page);

    const riga = rigaOffertaConCodice(page, offerta.codice);
    const pallinoStato = riga.getByRole("button", {
      name: "Disattiva",
      exact: true,
    });
    await expect(pallinoStato).toBeEnabled();
    await expect(pallinoStato).toHaveAttribute("aria-busy", "false");
    await expect(pallinoStato).toHaveAttribute("aria-pressed", "true");

    const gate = await trattieniPostDellaPagina(page, "/offerte");
    await pallinoStato.click();

    // Il pallino è largo 16px: l'attesa si legge solo da `aria-busy`, che pilota
    // la pulsazione. La rotellina non deve comparire.
    await expect(pallinoStato).toBeDisabled();
    await expect(pallinoStato).toHaveAttribute("aria-busy", "true");
    await expect(pallinoStato.locator("span")).toHaveCount(0);

    // Contratti dei locator e2e esistenti: restano quelli di prima dell'esito.
    await expect(pallinoStato).toHaveAttribute("aria-label", "Disattiva");
    await expect(pallinoStato).toHaveAttribute("aria-pressed", "true");
    await expect(pallinoStato).toHaveAttribute("title", "Offerta attiva");

    gate.rilascia();

    // Solo all'esito il pallino cambia stato, e l'attesa è finita.
    await page.waitForURL(/\/offerte\?esito=stato-offerta-aggiornato$/);
    const pallinoDisattivato = rigaOffertaConCodice(
      page,
      offerta.codice,
    ).getByRole("button", { name: "Attiva", exact: true });
    await expect(pallinoDisattivato).toBeEnabled();
    await expect(pallinoDisattivato).toHaveAttribute("aria-busy", "false");
    await expect(pallinoDisattivato).toHaveAttribute("aria-pressed", "false");
    await expect(pallinoDisattivato).toHaveAttribute(
      "title",
      "Offerta non attiva",
    );

    expect(gate.conteggioPost()).toBe(1);
    await gate.smetti();
  });
});
