import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin, accediComeCollaboratore } from "./support/auth";
import { dataNelMeseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";
import {
  intervalloNuoviScaglioniKm,
  sogliaStabileInIntervallo,
} from "./support/reserved-resources";

/**
 * Test e2e — US-051: Cursore e feedback di attesa uniformi su pulsanti e azioni
 *
 * Scenari:
 * - AC-2 — attesa visibile e submit bloccato durante l'invio di un form
 * - AC-3 — attesa visibile su un'eliminazione con dialog aperto fino all'esito
 * - AC-4 — fine attesa su errore, con valori conservati e messaggio visibile
 * - AC-1 — cursore a manina sui controlli abilitati (front e back office) e
 *   cursore diverso da `pointer` su un controllo disabilitato
 *
 * La "rete lenta" non è mai un hard wait: la POST della server action è
 * trattenuta da una route registrata sulla pagina di destinazione e sbloccata
 * esplicitamente dal test dopo le asserzioni sullo stato di attesa.
 */

// Intervallo km riservato a questa spec: ScaglioneKm è globale con soglia unica.
const INTERVALLO_KM_US_051 = intervalloNuoviScaglioniKm(
  1_051_000,
  1_051_999,
  "tests/e2e/feedback-attesa-azioni.spec.ts — US-051 attesa su eliminazione",
);

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
 * chiama `rilascia()`. Le GET (documento, RSC, redirect post-action) passano
 * senza modifiche: viene rallentata solo la scrittura sotto osservazione.
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
 * dell'idratazione i gestori client non sono agganciati, il click è un no-op e
 * il form non passerebbe da `useFormStatus` ma da una POST documentale.
 *
 * Le tabelle offerte e il calendario espongono il contratto `data-idratata`;
 * il form cliente e la tabella scaglioni no, quindi si osserva la proprietà
 * `__reactFiber$…` che React attacca al nodo DOM nel momento in cui lo idrata.
 * Resta un polling su stato osservabile, non un'attesa a tempo.
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

/** Cursore effettivamente calcolato dal browser sull'elemento. */
function cursoreCalcolato(locator: Locator): Promise<string> {
  return locator.evaluate((elemento) => getComputedStyle(elemento).cursor);
}

/**
 * Il modale di conferma resta nel DOM anche da chiuso, con `pointer-events`
 * disattivati: è quello, non la presenza del nodo, a dire se è davvero aperto.
 */
function interattivitaDialog(locator: Locator): Promise<string> {
  return locator.evaluate((elemento) => getComputedStyle(elemento).pointerEvents);
}

/**
 * Submit del form cliente: l'etichetta cambia durante l'attesa, quindi il
 * locator copre entrambi gli stati per restare valido attraverso la POST.
 */
function submitCliente(page: Page, etichetta: string, etichettaAttesa: string): Locator {
  return page.getByRole("button", {
    name: new RegExp(`^(?:${etichetta}|${etichettaAttesa})$`),
  });
}

test.describe("US-051 Feedback di attesa sulle azioni", () => {
  test("AC-2/AC-1 — il submit del form cliente resta in attesa e disabilitato fino all'esito", async ({
    page,
    factory,
  }) => {
    const cliente = await factory.createCliente({
      ragioneSociale: `E2E US-051 Attesa submit ${randomUUID().slice(0, 8)}`,
      citta: "Torino",
    });

    await accediAlBackOfficeComeAdmin(page);

    const percorsoModifica = `/anagrafiche/clienti/${cliente.id}/modifica`;
    await page.goto(percorsoModifica);
    await expect(
      page.getByRole("heading", { name: "Modifica cliente" }),
    ).toBeVisible();

    const pulsanteSalva = submitCliente(page, "Salva modifiche", "Salvataggio…");
    await attendiIdratazione(pulsanteSalva);

    // AC-1: il submit abilitato mostra la manina.
    await expect.poll(() => cursoreCalcolato(pulsanteSalva)).toBe("pointer");

    const gate = await trattieniPostDellaPagina(page, percorsoModifica);

    const nuovaCitta = `TestCitta-${randomUUID().slice(0, 8)}`;
    await page.getByLabel(/Città/).fill(nuovaCitta);
    await pulsanteSalva.click();

    // AC-2: con la POST ancora trattenuta il pulsante è già in attesa.
    await expect(pulsanteSalva).toBeDisabled();
    await expect(pulsanteSalva).toHaveAttribute("aria-busy", "true");
    await expect(page.getByText("Salvataggio…")).toBeVisible();

    // AC-1: da disabilitato il cursore non è più quello dei controlli cliccabili.
    await expect.poll(() => cursoreCalcolato(pulsanteSalva)).not.toBe("pointer");

    gate.rilascia();

    // AC-2: l'esito arriva e la modifica è persistita nell'elenco.
    await page.waitForURL("**/anagrafiche/clienti?esito=salvato");
    await expect(
      page
        .locator("table[aria-label='Elenco clienti'] tbody tr")
        .filter({ hasText: cliente.ragioneSociale })
        .first()
        .getByText(nuovaCitta),
    ).toBeVisible();

    // AC-2: il pulsante disabilitato ha impedito il secondo invio.
    expect(gate.conteggioPost()).toBe(1);

    await gate.smetti();

    // AC-2: riaperto il form, il submit è tornato allo stato normale.
    await page.goto(percorsoModifica);
    const pulsanteRiaperto = submitCliente(page, "Salva modifiche", "Salvataggio…");
    await expect(pulsanteRiaperto).toBeEnabled();
    await expect(pulsanteRiaperto).toHaveAttribute("aria-busy", "false");
    await expect(
      page.getByRole("button", { name: "Salva modifiche", exact: true }),
    ).toBeVisible();
  });

  test("AC-3/AC-1 — l'eliminazione di uno scaglione tiene il dialog aperto e il pulsante in attesa", async ({
    page,
    factory,
  }) => {
    const km = sogliaStabileInIntervallo(INTERVALLO_KM_US_051, factory.namespace);
    await factory.createScaglioneKm({ finoAKm: km, importo: "31.00" });

    await accediAlBackOfficeComeAdmin(page);
    await page.goto("/anagrafiche/scaglioni");

    const tabella = page.locator(
      "table[aria-label='Elenco scaglioni chilometrici']",
    );
    const riga = tabella
      .locator("tbody tr")
      .filter({ hasText: `fino a ${km} km` })
      .first();
    await expect(riga).toBeVisible();

    const pulsanteEliminaRiga = riga.getByRole("button", { name: "Elimina" });
    await attendiIdratazione(pulsanteEliminaRiga);

    // AC-1: anche il pulsante "ghost" di riga, senza classi dedicate, ha la manina.
    await expect.poll(() => cursoreCalcolato(pulsanteEliminaRiga)).toBe("pointer");

    const dialogConferma = page.getByRole("dialog");
    const dialogDelloScaglione = page.getByRole("dialog", {
      name: new RegExp(`Eliminare lo scaglione «fino a ${km} km»\\?`),
    });

    // Da chiuso il modale è già nel DOM ma non è interattivo.
    await expect.poll(() => interattivitaDialog(dialogConferma)).toBe("none");

    await pulsanteEliminaRiga.click();
    await expect(dialogDelloScaglione).toBeVisible();
    await expect.poll(() => interattivitaDialog(dialogConferma)).toBe("auto");

    const gate = await trattieniPostDellaPagina(page, "/anagrafiche/scaglioni");

    const confermaEliminazione = dialogConferma.getByRole("button", {
      name: /^(?:Elimina scaglione|Eliminazione…)$/,
    });
    await confermaEliminazione.click();

    // AC-3: con la POST trattenuta la conferma è in attesa e il dialog non si
    // è chiuso in modo ottimistico: resta visibile e interattivo.
    await expect(confermaEliminazione).toBeDisabled();
    await expect(confermaEliminazione).toHaveAttribute("aria-busy", "true");
    await expect(dialogConferma.getByText("Eliminazione…")).toBeVisible();
    await expect(dialogDelloScaglione).toBeVisible();
    await expect.poll(() => interattivitaDialog(dialogConferma)).toBe("auto");

    gate.rilascia();

    // AC-3: solo dopo l'esito il dialog si chiude e la riga sparisce.
    await page.waitForURL("**/anagrafiche/scaglioni?esito=eliminato");
    await expect(page.getByText("Scaglione eliminato")).toBeVisible();
    await expect.poll(() => interattivitaDialog(dialogConferma)).toBe("none");
    await expect(
      tabella.locator("tbody tr").filter({ hasText: `fino a ${km} km` }),
    ).toHaveCount(0);

    expect(gate.conteggioPost()).toBe(1);
    await gate.smetti();
  });

  test("AC-4 — l'errore di validazione chiude l'attesa e conserva i valori inseriti", async ({
    page,
  }) => {
    await accediAlBackOfficeComeAdmin(page);
    await page.goto("/anagrafiche/clienti/nuovo");
    await expect(
      page.getByRole("heading", { name: "Nuovo cliente" }),
    ).toBeVisible();

    const pulsanteCrea = submitCliente(page, "Crea cliente", "Creazione…");
    await attendiIdratazione(pulsanteCrea);

    const ragioneSociale = `E2E US-051 Errore attesa ${randomUUID().slice(0, 8)}`;
    const partitaIvaNonValida = "12345";
    const citta = "Torino";

    const campoRagioneSociale = page.getByLabel(/Ragione sociale/);
    const campoPartitaIva = page.getByLabel(/Partita IVA/);
    const campoCitta = page.getByLabel(/Città/);

    await campoRagioneSociale.fill(ragioneSociale);
    await campoPartitaIva.fill(partitaIvaNonValida);
    await campoCitta.fill(citta);

    // Nessun trattenimento: l'esito di errore arriva alla velocità del server.
    await pulsanteCrea.click();

    // AC-4: il messaggio d'errore è visibile e non c'è stato redirect.
    await expect(
      page.getByText("La partita IVA deve essere di 11 cifre"),
    ).toBeVisible();
    await expect(page.getByText(/Controlla i campi evidenziati/)).toBeVisible();
    await expect(page).toHaveURL(/\/anagrafiche\/clienti\/nuovo/);

    // AC-4: l'attesa è terminata, il pulsante è di nuovo utilizzabile.
    await expect(pulsanteCrea).toBeEnabled();
    await expect(pulsanteCrea).toHaveAttribute("aria-busy", "false");
    await expect(
      page.getByRole("button", { name: "Crea cliente", exact: true }),
    ).toBeVisible();

    // AC-1: tornato abilitato, il submit torna anche alla manina.
    await expect.poll(() => cursoreCalcolato(pulsanteCrea)).toBe("pointer");

    // AC-4: quanto digitato è conservato, compresi i campi validi.
    await expect(campoRagioneSociale).toHaveValue(ragioneSociale);
    await expect(campoPartitaIva).toHaveValue(partitaIvaNonValida);
    await expect(campoCitta).toHaveValue(citta);
  });

  test("AC-1 — in front office il pulsante di salvataggio riga mostra la manina", async ({
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

    const data = dataNelMeseRiservato("US-051", 14);
    await page.goto(`/attivita/${data}`);

    const pulsanteAggiungi = page.getByRole("button", {
      name: "Aggiungi riga",
      exact: true,
    });
    await expect(pulsanteAggiungi).toBeEnabled();
    await expect.poll(() => cursoreCalcolato(pulsanteAggiungi)).toBe("pointer");

    // Il cliente abilitato è selezionabile: la schermata è quella reale d'uso.
    await expect(
      page.getByLabel("Cliente").getByRole("option", {
        name: clienteConOfferta.cliente.ragioneSociale,
      }),
    ).toHaveCount(1);
  });
});
