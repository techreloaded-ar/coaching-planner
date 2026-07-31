import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { selezionaClienteEOffertaTest } from "./demo__inserimento-righe-attivita.helpers";
import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";
import { dataNelMeseRiservato, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Demo e2e — US-054: Voci di rimborso trasferta a etichetta libera.
 *
 * Riproduce lo script della sezione "Dimostrazione" della spec: l'amministratore
 * crea una voce di rimborso con etichetta libera dall'anagrafica (senza alcun
 * campo di limite chilometrico), il collaboratore la seleziona da una tendina
 * nel dettaglio giornata e la vede fotografata nel riepilogo mensile, infine
 * l'amministratore modifica l'importo della voce e si osserva che la riga già
 * salvata e il riepilogo mensile mantengono l'importo originale fotografato.
 */

const CODICE_SPEC = "US-054-DEMO-VOCI-RIMBORSO";

const IMPORTO_ORIGINALE = "45,00";
const IMPORTO_ORIGINALE_ATTESO = "45.00";
const IMPORTO_AGGIORNATO = "90,00";

function euroRiepilogo(valore: string): string {
  return `€ ${Number(valore).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function euroDettaglioGiornata(valore: string): RegExp {
  return new RegExp(`€\\s*${Number(valore).toFixed(2).replace(".", "\\.")}`);
}

function rigaConNota(page: Page, nota: string): Locator {
  return page
    .getByTestId("activity-row")
    .filter({ has: page.getByText(nota, { exact: true }) });
}

function tabellaVociRimborso(page: Page): Locator {
  return page.locator("table[aria-label='Elenco voci di rimborso trasferta']");
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

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-054 Demo — Voci di rimborso trasferta a etichetta libera", () => {
  test("l'amministratore configura una voce libera, il collaboratore la seleziona e la riga resta fotografata dopo una modifica successiva", async ({
    page,
    factory,
    collaboratore,
    clienteConOfferta,
  }) => {
    test.setTimeout(120_000);

    const suffisso = randomUUID();
    const etichetta = `Rimborso speciale per eventi ${suffisso}`;
    const nota = `US-054 demo fotografia ${suffisso}`;
    const mese = meseRiservato(CODICE_SPEC);
    const data = dataNelMeseRiservato(CODICE_SPEC, 10);

    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    // I ruoli amministratore e collaboratore si alternano nella dimostrazione:
    // una singola pagina autenticata non può ri-autenticarsi con un altro
    // utente, quindi l'amministratore opera in un contesto browser separato.
    const browser = page.context().browser();
    if (!browser) {
      throw new Error("Browser non disponibile per il contesto amministratore");
    }
    const contestoAdmin = await browser.newContext();
    const paginaAdmin = await contestoAdmin.newPage();

    try {
      // Passo 1 — l'amministratore crea la voce di rimborso con etichetta
      // libera e importo, senza alcun campo di limite chilometrico.
      await accediComeAdmin(paginaAdmin);
      await paginaAdmin.goto("/anagrafiche/voci-rimborso/nuovo");
      await expect(
        paginaAdmin.getByRole("heading", { name: "Nuova voce di rimborso" }),
      ).toBeVisible();

      await paginaAdmin.getByLabel("Etichetta").fill(etichetta);
      await paginaAdmin.getByLabel("Importo forfettario").fill(IMPORTO_ORIGINALE);
      await paginaAdmin.getByRole("button", { name: "Crea voce" }).click();
      await paginaAdmin.waitForURL("**/anagrafiche/voci-rimborso?esito=creato");

      // Passo 2 — l'elenco mostra la voce con la sua etichetta e il suo
      // importo, senza colonne di limite chilometrico.
      const tabella = tabellaVociRimborso(paginaAdmin);
      const rigaVoce = tabella.locator("tbody tr").filter({ hasText: etichetta });
      await expect(rigaVoce).toBeVisible();
      await expect(rigaVoce.getByText(IMPORTO_ORIGINALE)).toBeVisible();

      // Passo 3 — il collaboratore apre il dettaglio di un giorno e trova la
      // tendina con la voce configurata al posto del campo chilometri.
      await accediComeCollaboratore(page, collaboratore.utente.email);
      await apriGiornata(page, data, mese);

      await selezionaClienteEOffertaTest(page, clienteConOfferta);
      await page.locator("#ore").fill("8");
      await page.locator("#nota").fill(nota);

      const tendina = page.getByTestId("voce-rimborso-trasferta");
      await expect(tendina).toContainText(etichetta);
      await tendina.selectOption({ label: etichetta });

      // Passo 4 — il collaboratore salva la riga e vede il rimborso
      // fotografato nel dettaglio del giorno.
      await page.getByRole("button", { name: "Aggiungi riga" }).click();

      const riga = rigaConNota(page, nota);
      await expect(riga).toBeVisible();
      await expect(riga).toContainText(etichetta);
      await expect(riga).toContainText(
        euroDettaglioGiornata(IMPORTO_ORIGINALE_ATTESO),
      );

      // Passo 5 — il riepilogo mensile del collaboratore somma l'importo
      // fotografato.
      await apriRiepilogoMensile(page, mese);
      await expect(page.getByTestId("summary-rimborsi-value")).toHaveText(
        euroRiepilogo(IMPORTO_ORIGINALE_ATTESO),
      );

      // Passo 6 — l'amministratore modifica l'importo della voce usata.
      await paginaAdmin.goto("/anagrafiche/voci-rimborso");
      await rigaVoce.getByRole("link", { name: "Modifica" }).click();
      await paginaAdmin.waitForURL(/\/anagrafiche\/voci-rimborso\/[^/]+$/);
      await expect(
        paginaAdmin.getByRole("heading", { name: "Modifica voce di rimborso" }),
      ).toBeVisible();

      await paginaAdmin.getByLabel("Importo forfettario").fill(IMPORTO_AGGIORNATO);
      await paginaAdmin.getByRole("button", { name: "Salva modifiche" }).click();
      await paginaAdmin.waitForURL("**/anagrafiche/voci-rimborso?esito=salvato");

      // Passo 7 — la riga già salvata e il riepilogo mensile mantengono
      // l'importo originale fotografato al salvataggio, non quello
      // aggiornato in configurazione.
      await apriGiornata(page, data, mese);
      const rigaDopoModifica = rigaConNota(page, nota);
      await expect(rigaDopoModifica).toContainText(
        euroDettaglioGiornata(IMPORTO_ORIGINALE_ATTESO),
      );

      await apriRiepilogoMensile(page, mese);
      await expect(page.getByTestId("summary-rimborsi-value")).toHaveText(
        euroRiepilogo(IMPORTO_ORIGINALE_ATTESO),
      );
    } finally {
      await contestoAdmin.close();
    }
  });
});
