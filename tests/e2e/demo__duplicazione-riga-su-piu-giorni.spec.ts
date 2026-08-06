import type { Locator, Page } from "@playwright/test";

import { accediComeCollaboratore } from "./support/auth";
import {
  dataNelMeseRiservato,
  dataNelMesePassatoRiservato,
  mesePassatoRiservato,
  meseRiservato,
} from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Demo scenario — US-057: duplicazione di una riga attività su più giorni
 * scelti.
 *
 * Riproduce lo script della sezione "Dimostrazione" della spec, nel suo ordine:
 * il collaboratore parte dal dettaglio di un giorno con una riga salvata che
 * include una voce di rimborso trasferta, avvia «Duplica…» dalla riga, aggiunge
 * tre date non contigue di cui una in un mese diverso, conferma e osserva
 * l'esito con il numero di giorni replicati; apre ciascuno di quei giorni e
 * osserva la riga con gli stessi cliente, offerta, ore, nota, fatturabilità ed
 * etichetta/importo di rimborso; riapre il selettore e osserva che la conferma
 * non è disponibile prima di aver scelto almeno una data e che il giorno di
 * origine non è selezionabile; infine, su una riga storica la cui offerta non è
 * più abilitata, avvia la duplicazione e osserva un errore visibile e nessuna
 * riga creata sul giorno scelto.
 *
 * Le entità sono tutte create dalla factory dentro due mesi riservati alla
 * chiave di questo file, e ogni asserzione è ancorata alla ragione sociale, al
 * codice offerta o alla nota generati dal test: nessuna asserzione riguarda
 * totali globali del mese, quindi la chiave non va registrata in
 * `SLOT_MESI_RISERVATI_ESCLUSIVI`.
 */

const CODICE_SPEC = "US-057-DEMO";

const MESE_ORIGINE = meseRiservato(CODICE_SPEC);
const GIORNO_ORIGINE = dataNelMeseRiservato(CODICE_SPEC, 11);
const GIORNO_DESTINAZIONE_A = dataNelMeseRiservato(CODICE_SPEC, 17);
const GIORNO_DESTINAZIONE_B = dataNelMeseRiservato(CODICE_SPEC, 24);
const MESE_ALTRO = mesePassatoRiservato(CODICE_SPEC);
const GIORNO_ALTRO_MESE = dataNelMesePassatoRiservato(CODICE_SPEC, 7);
const GIORNO_RIFIUTO = dataNelMeseRiservato(CODICE_SPEC, 4);

const RAGIONE_SOCIALE_ORIGINE = "Demo US057 Cliente Abilitato";
const RAGIONE_SOCIALE_NON_ABILITATA = "Demo US057 Offerta Decaduta";

const ETICHETTA_RIMBORSO = "Trasferta demo US-057";
const IMPORTO_RIMBORSO = "85.00";

/** Scrittura del giorno civile con la stessa convenzione UTC dell'applicazione. */
function dataDb(giorno: string): Date {
  return new Date(`${giorno}T12:00:00.000Z`);
}

function cardRigaDi(page: Page, ragioneSociale: string): Locator {
  return page.getByTestId("activity-row").filter({ hasText: ragioneSociale });
}

function selettore(page: Page): Locator {
  return page.getByTestId("selettore-duplicazione");
}

async function attendiGiornataIdratata(page: Page) {
  const contenuto = page.getByTestId("contenuto-giornata");
  await expect(contenuto).toBeVisible();
  await expect(contenuto).toHaveAttribute("data-idratata", "true");
  return contenuto;
}

/** Aggiunge un giorno alla pista del selettore con i controlli del pannello. */
async function aggiungiGiornoDestinazione(page: Page, giorno: string) {
  await page.getByTestId("data-duplicazione").fill(giorno);
  await selettore(page).getByRole("button", { name: "Aggiungi data" }).click();
}

/** Cambio giorno con il selettore data del dettaglio: percorso client. */
async function vaiAlGiorno(page: Page, giorno: string) {
  await page.getByTestId("selettore-giorno").fill(giorno);
  await expect(page).toHaveURL(`/attivita/${giorno}?mese=${giorno.slice(0, 7)}`);
}

test.describe("US-057 Demo", () => {
  test("demo duplicazione di una riga attività su più giorni scelti", async ({
    page,
    factory,
    collaboratore,
    namespace,
  }) => {
    test.setTimeout(120_000);

    // ── Preparazione: una riga sorgente completa di rimborso già fotografato
    // su un'offerta abilitata, e una riga storica su un'offerta mai abilitata.
    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: RAGIONE_SOCIALE_ORIGINE,
    });
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    const nota = `Demo US-057 riga sorgente ${namespace}`;
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(GIORNO_ORIGINE),
      ore: "6.00",
      nota,
      fatturabile: true,
      rimborsoTrasfertaEtichetta: ETICHETTA_RIMBORSO,
      rimborsoTrasfertaImporto: IMPORTO_RIMBORSO,
    });

    const offertaNonAbilitata = await factory.createClienteConOfferta({
      ragioneSociale: RAGIONE_SOCIALE_NON_ABILITATA,
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: offertaNonAbilitata.cliente,
      offerta: offertaNonAbilitata.offerta,
      data: dataDb(GIORNO_ORIGINE),
      ore: "2.00",
      nota: `Demo US-057 riga storica ${namespace}`,
    });

    // ── 1. Il collaboratore apre il giorno di origine ───────────────────
    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${GIORNO_ORIGINE}?mese=${MESE_ORIGINE}`);
    await attendiGiornataIdratata(page);
    await expect(cardRigaDi(page, RAGIONE_SOCIALE_ORIGINE)).toBeVisible();

    // ── 2. Avvia «Duplica…» dalla riga con il rimborso ──────────────────
    await cardRigaDi(page, RAGIONE_SOCIALE_ORIGINE)
      .getByTestId("duplica-riga")
      .click();
    await expect(selettore(page)).toBeVisible();

    // ── 3. Aggiunge la prima data di destinazione ───────────────────────
    await aggiungiGiornoDestinazione(page, GIORNO_DESTINAZIONE_A);
    await expect(
      page.locator(
        `[data-testid="giorno-scelto"][data-giorno="${GIORNO_DESTINAZIONE_A}"]`,
      ),
    ).toBeVisible();

    // ── 4. Aggiunge la seconda data, non contigua alla prima ────────────
    await aggiungiGiornoDestinazione(page, GIORNO_DESTINAZIONE_B);
    await expect(
      page.locator(
        `[data-testid="giorno-scelto"][data-giorno="${GIORNO_DESTINAZIONE_B}"]`,
      ),
    ).toBeVisible();

    // ── 5. Aggiunge la terza data, in un mese diverso ───────────────────
    await aggiungiGiornoDestinazione(page, GIORNO_ALTRO_MESE);
    await expect(
      page.locator(
        `[data-testid="giorno-scelto"][data-giorno="${GIORNO_ALTRO_MESE}"]`,
      ),
    ).toBeVisible();
    await expect(page.getByTestId("conteggio-giorni-duplicazione")).toHaveText(
      "3 giorni",
    );

    // ── 6. Conferma e osserva l'esito con il numero di giorni replicati ──
    await page.getByTestId("conferma-duplicazione").click();

    const esito = page.getByTestId("esito-duplicazione");
    await expect(esito).toBeVisible();
    await expect(esito).toContainText("3 giorni");
    await expect(selettore(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Aggiungi riga" }),
    ).toBeEnabled();

    // ── 7. Apre uno per uno i tre giorni: la riga è la stessa fotografia ─
    for (const giorno of [
      GIORNO_DESTINAZIONE_A,
      GIORNO_DESTINAZIONE_B,
      GIORNO_ALTRO_MESE,
    ]) {
      await vaiAlGiorno(page, giorno);

      const rigaReplicata = page
        .getByTestId("activity-row")
        .filter({ has: page.getByText(nota, { exact: true }) });

      await expect(rigaReplicata).toBeVisible();
      await expect(rigaReplicata).toContainText(RAGIONE_SOCIALE_ORIGINE);
      await expect(rigaReplicata).toContainText(clienteConOfferta.offerta.codice);
      await expect(rigaReplicata).toContainText("6.0 h");
      await expect(
        rigaReplicata.getByText("Fatt.", { exact: true }),
      ).toBeVisible();
      await expect(rigaReplicata).toContainText(ETICHETTA_RIMBORSO);
      await expect(rigaReplicata).toContainText("85.00");
    }

    // ── 8. Torna sul giorno di origine e riapre il selettore ────────────
    await vaiAlGiorno(page, GIORNO_ORIGINE);
    await cardRigaDi(page, RAGIONE_SOCIALE_ORIGINE)
      .getByTestId("duplica-riga")
      .click();
    await expect(selettore(page)).toBeVisible();

    // ── 9. La conferma non è disponibile prima di aver scelto una data ──
    await expect(page.getByTestId("pista-duplicazione-vuota")).toBeVisible();
    await expect(page.getByTestId("conferma-duplicazione")).toBeDisabled();

    // ── 10. Il giorno di origine non è una destinazione selezionabile ────
    await aggiungiGiornoDestinazione(page, GIORNO_ORIGINE);
    const avviso = page.getByTestId("avviso-duplicazione");
    await expect(avviso).toBeVisible();
    await expect(avviso).toContainText(
      "Il giorno di origine non è fra le destinazioni selezionabili.",
    );
    await expect(page.getByTestId("giorno-scelto")).toHaveCount(0);
    await expect(page.getByTestId("conferma-duplicazione")).toBeDisabled();

    // ── 11. Chiude il selettore e passa alla riga storica ────────────────
    await selettore(page).getByRole("button", { name: "Annulla" }).click();
    await expect(selettore(page)).toHaveCount(0);

    await cardRigaDi(page, RAGIONE_SOCIALE_NON_ABILITATA)
      .getByTestId("duplica-riga")
      .click();
    await expect(selettore(page)).toBeVisible();

    // ── 12. Sceglie un giorno e conferma: la duplicazione è rifiutata ────
    await aggiungiGiornoDestinazione(page, GIORNO_RIFIUTO);
    await expect(page.getByTestId("conteggio-giorni-duplicazione")).toHaveText(
      "1 giorno",
    );
    await page.getByTestId("conferma-duplicazione").click();

    const errore = page.getByTestId("errore-duplicazione");
    await expect(errore).toBeVisible();
    await expect(errore).toContainText(
      "Non sei abilitato a registrare attività su questa offerta",
    );
    await expect(page.getByTestId("esito-duplicazione")).toHaveCount(0);

    // ── 13. Il giorno scelto resta senza alcuna riga ─────────────────────
    await selettore(page).getByRole("button", { name: "Annulla" }).click();
    await expect(selettore(page)).toHaveCount(0);

    await page.goto(`/attivita/${GIORNO_RIFIUTO}?mese=${MESE_ORIGINE}`);
    await attendiGiornataIdratata(page);
    await expect(page.getByTestId("activity-row")).toHaveCount(0);
  });
});
