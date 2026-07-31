import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { selezionaClienteEOffertaTest } from "./demo__inserimento-righe-attivita.helpers";
import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";
import { dataNelMeseRiservato, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Test e2e — US-054: selezione della voce di rimborso e fotografia sulla riga.
 *
 * Copre l'intero script della spec su un'unica voce di rimborso creata dal test:
 * selezione in tendina, fotografia al salvataggio, riepilogo mensile, e —
 * soprattutto — la sopravvivenza del dato fotografato alla modifica (AC-4) e
 * all'eliminazione (AC-5) della voce di configurazione.
 *
 * `VoceRimborsoTrasferta` non ha vincoli di unicità: l'isolamento tra worker è
 * garantito dall'etichetta univoca per test e dal collaboratore della factory,
 * che è l'unico titolare di righe nel mese riservato interrogato dal riepilogo.
 */

const CODICE_SPEC = "US-054-SELEZIONE-RIMBORSO-TRASFERTA";

const IMPORTO_ORIGINALE = "33.00";
const IMPORTO_AGGIORNATO = "77.00";

/**
 * Formato del riepilogo mensile, come la `formattaEuro` locale di
 * `riepilogo-mese.tsx`: simbolo anteposto con spazio, non lo stile valuta
 * di `Intl.NumberFormat`, la cui posizione del simbolo può variare tra le
 * ICU data di Node e del browser Playwright.
 */
function euroRiepilogo(valore: string): string {
  return `€ ${Number(valore).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formato usato nel dettaglio giornata, dove l'importo è stampato con
 * `toFixed(2)` accanto al simbolo: «€ 33.00», non «33,00 €».
 */
function euroDettaglioGiornata(valore: string): RegExp {
  return new RegExp(`€\\s*${Number(valore).toFixed(2).replace(".", "\\.")}`);
}

function rigaConNota(page: Page, nota: string): Locator {
  return page
    .getByTestId("activity-row")
    .filter({ has: page.getByText(nota, { exact: true }) });
}

function tendinaVociRimborso(page: Page): Locator {
  return page.getByTestId("voce-rimborso-trasferta");
}

async function apriGiornata(page: Page, data: string, mese: string) {
  await page.goto(`/attivita/${data}?mese=${mese}`);
  await page.waitForURL(`**/attivita/${data}**`);
  await expect(
    page.getByRole("link", { name: "Torna al calendario" }),
  ).toBeVisible();
}

async function apriRiepilogoMensile(page: Page, mese: string) {
  await page.goto(`/attivita/riepilogo?mese=${mese}`);
  await page.waitForURL("**/attivita/riepilogo**");
  await expect(page.getByTestId("summary-rimborsi")).toBeVisible();
}

test.describe("US-054 Rimborso trasferta selezionato e fotografato", () => {
  test("la riga conserva etichetta e importo scelti anche dopo modifica ed eliminazione della voce", async ({
    page,
    factory,
    collaboratore,
    clienteConOfferta,
  }) => {
    test.setTimeout(120_000);

    const suffisso = randomUUID();
    const etichetta = `E2E US-054 Trasferta ${suffisso}`;
    const nota = `US-054 riga fotografata ${suffisso}`;
    const mese = meseRiservato(CODICE_SPEC);
    const data = dataNelMeseRiservato(CODICE_SPEC, 9);

    // AC-1 — l'amministratore configura la voce selezionabile.
    const voce = await factory.createVoceRimborsoTrasferta({
      etichetta,
      importo: IMPORTO_ORIGINALE,
    });
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    // Il test alterna collaboratore e amministratore: una singola pagina non
    // può riautenticarsi con `accediCome` una volta già loggata (la "/" di un
    // utente autenticato redirige alla sua area, non mostra più "Accedi con
    // Google"). Come in attivita-amministratore.spec.ts, ogni ruolo ha un suo
    // browser context isolato, autenticato una sola volta.
    const browser = page.context().browser();
    if (!browser) {
      throw new Error("Browser non disponibile per il contesto amministratore");
    }
    const contestoAdmin = await browser.newContext();
    const paginaAdmin = await contestoAdmin.newPage();

    try {
      // AC-2 — il collaboratore sceglie la voce dalla tendina e salva la riga.
      await accediComeCollaboratore(page, collaboratore.utente.email);
      await apriGiornata(page, data, mese);

      await selezionaClienteEOffertaTest(page, clienteConOfferta);
      await page.locator("#ore").fill("8");
      await page.locator("#nota").fill(nota);

      const tendina = tendinaVociRimborso(page);
      await expect(tendina).toContainText(etichetta);
      await tendina.selectOption({ label: etichetta });
      await expect(tendina).toHaveValue(voce.id);

      await page.getByRole("button", { name: "Aggiungi riga" }).click();

      // AC-3 — la riga salvata mostra l'etichetta e l'importo fotografati.
      const riga = rigaConNota(page, nota);
      await expect(riga).toBeVisible();
      await expect(riga).toContainText(etichetta);
      await expect(riga).toContainText(euroDettaglioGiornata(IMPORTO_ORIGINALE));
      await expect(page.getByTestId("day-summary-rimborsi")).toHaveText(
        euroDettaglioGiornata(IMPORTO_ORIGINALE),
      );

      // AC-3 — il riepilogo mensile del collaboratore somma l'importo fotografato.
      await apriRiepilogoMensile(page, mese);
      await expect(page.getByTestId("summary-rimborsi-value")).toHaveText(
        euroRiepilogo(IMPORTO_ORIGINALE),
      );

      // AC-4 — l'amministratore, in un contesto separato, aggiorna l'importo
      // della stessa voce.
      await accediComeAdmin(paginaAdmin);
      await paginaAdmin.goto(`/anagrafiche/voci-rimborso/${voce.id}`);
      await expect(
        paginaAdmin.getByRole("heading", { name: "Modifica voce di rimborso" }),
      ).toBeVisible();
      await expect(paginaAdmin.getByLabel("Etichetta")).toHaveValue(etichetta);

      await paginaAdmin.getByLabel("Importo forfettario").fill(IMPORTO_AGGIORNATO);
      await paginaAdmin.getByRole("button", { name: "Salva modifiche" }).click();
      await paginaAdmin.waitForURL("**/anagrafiche/voci-rimborso?esito=salvato");

      // AC-4, il punto centrale della spec: la riga già salvata è una fotografia,
      // non un riferimento. Rileggendola dal server (stessa sessione collaboratore,
      // nessuna nuova autenticazione necessaria) deve mostrare ancora l'importo
      // del momento della registrazione, non quello aggiornato in configurazione.
      await apriGiornata(page, data, mese);

      const rigaDopoModifica = rigaConNota(page, nota);
      await expect(rigaDopoModifica).toContainText(etichetta);
      await expect(rigaDopoModifica).toContainText(
        euroDettaglioGiornata(IMPORTO_ORIGINALE),
      );
      await expect(rigaDopoModifica).not.toContainText(
        euroDettaglioGiornata(IMPORTO_AGGIORNATO),
      );

      await apriRiepilogoMensile(page, mese);
      await expect(page.getByTestId("summary-rimborsi-value")).toHaveText(
        euroRiepilogo(IMPORTO_ORIGINALE),
      );

      // AC-5 — l'amministratore elimina la voce dalla configurazione (stessa
      // sessione admin già autenticata).
      await paginaAdmin.goto("/anagrafiche/voci-rimborso");

      const rigaVoce = paginaAdmin
        .locator("table[aria-label='Elenco voci di rimborso trasferta'] tbody tr")
        .filter({ hasText: etichetta });
      await expect(rigaVoce).toHaveCount(1);
      await rigaVoce.getByRole("button", { name: "Elimina" }).click();
      await expect(
        paginaAdmin.getByRole("dialog", {
          name: `Eliminare la voce «${etichetta}»?`,
        }),
      ).toBeVisible();
      await paginaAdmin
        .getByRole("dialog")
        .getByRole("button", { name: "Elimina voce" })
        .click();
      await paginaAdmin.waitForURL(
        "**/anagrafiche/voci-rimborso?esito=eliminato",
      );

      // AC-5 — la riga storica resta leggibile con la sua fotografia, mentre la
      // voce eliminata non è più proponibile per una nuova riga.
      await apriGiornata(page, data, mese);

      const rigaDopoEliminazione = rigaConNota(page, nota);
      await expect(rigaDopoEliminazione).toContainText(etichetta);
      await expect(rigaDopoEliminazione).toContainText(
        euroDettaglioGiornata(IMPORTO_ORIGINALE),
      );
      await expect(tendinaVociRimborso(page)).not.toContainText(etichetta);

      await apriRiepilogoMensile(page, mese);
      await expect(page.getByTestId("summary-rimborsi-value")).toHaveText(
        euroRiepilogo(IMPORTO_ORIGINALE),
      );
    } finally {
      await contestoAdmin.close();
    }
  });
});
