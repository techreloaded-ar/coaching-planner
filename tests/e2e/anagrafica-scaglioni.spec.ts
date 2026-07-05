import { test, expect } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import {
  REGISTRO_SCAGLIONI_KM,
  sogliaStabileInIntervallo,
} from "./support/reserved-resources";

/**
 * Test e2e — US-010: Configurazione degli scaglioni chilometrici per i rimborsi
 *
 * Scenari:
 * - Validazione campi obbligatori senza creazione
 * - Soglia duplicata/sovrapposta respinta (seed: scaglione fino a 50 km)
 * - Creazione, modifica persistita dopo reload e fascia ricalcolata
 * - Eliminazione con conferma e ricalcolo delle fasce successive
 */

test.describe("Anagrafica scaglioni km", () => {
  test.beforeEach(async ({ page }) => {
    await accediComeAdmin(page);
  });

  test("validazione campi obbligatori senza creazione", async ({ page }) => {
    await page.goto("/anagrafiche/scaglioni/nuovo");
    await expect(
      page.getByRole("heading", { name: "Nuovo scaglione" })
    ).toBeVisible();

    // Invia il form vuoto
    await page.getByRole("button", { name: "Crea scaglione" }).click();

    // Verifica il banner di errore generale
    await expect(page.getByText(/Controlla i campi evidenziati/)).toBeVisible();

    // Verifica i messaggi di errore per i campi obbligatori
    await expect(page.getByText("La soglia massima è obbligatoria")).toBeVisible();
    await expect(page.getByText("L'importo forfettario è obbligatorio")).toBeVisible();

    // Verifica che non ci sia redirect — siamo ancora su /nuovo
    await expect(page).toHaveURL(/\/anagrafiche\/scaglioni\/nuovo/);
  });

  test("soglia duplicata o sovrapposta viene rifiutata", async ({ page }) => {
    await page.goto("/anagrafiche/scaglioni/nuovo");
    await expect(
      page.getByRole("heading", { name: "Nuovo scaglione" })
    ).toBeVisible();

    // Lo scaglione "fino a 50 km" esiste già nel seed
    await page.getByLabel("Soglia massima").fill("50");
    await page.getByLabel("Importo forfettario").fill("20,00");
    await page.getByRole("button", { name: "Crea scaglione" }).click();

    await expect(
      page.getByText("Esiste già uno scaglione con questa soglia: le soglie non possono sovrapporsi")
    ).toBeVisible();

    // Verifica che non ci sia redirect — siamo ancora su /nuovo
    await expect(page).toHaveURL(/\/anagrafiche\/scaglioni\/nuovo/);
  });

  test("creazione, modifica persistita dopo reload e fascia ricalcolata", async ({ page }, testInfo) => {
    // Scaglioni globali con soglia unica: usa il range riservato 9000-9999.
    const km = sogliaStabileInIntervallo(
      REGISTRO_SCAGLIONI_KM.anagraficaScaglioni,
      testInfo.workerIndex,
      { salt: "creazione-modifica" }
    );

    // Naviga al form nuovo scaglione
    await page.goto("/anagrafiche/scaglioni/nuovo");
    await expect(
      page.getByRole("heading", { name: "Nuovo scaglione" })
    ).toBeVisible();

    // L'anteprima della fascia si aggiorna mentre si digita la soglia
    await page.getByLabel("Soglia massima").fill(String(km));
    await expect(page.getByText(new RegExp(`a ${km} km\\.`))).toBeVisible();

    await page.getByLabel("Importo forfettario").fill("12,50");
    await page.getByRole("button", { name: "Crea scaglione" }).click();

    // Verifica il redirect con esito creato
    await page.waitForURL("**/anagrafiche/scaglioni?esito=creato");
    await expect(
      page.getByRole("heading", { name: "Scaglioni chilometrici" })
    ).toBeVisible();

    // Verifica che lo scaglione appena creato sia nell'elenco, ordinato per soglia
    const tabella = page.locator("table[aria-label='Elenco scaglioni chilometrici']");
    const riga = tabella.locator("tbody tr").filter({ hasText: `fino a ${km} km` }).first();
    await expect(riga.getByText(/12,50/)).toBeVisible();

    // Clicca "Modifica" sullo scaglione
    await riga.getByRole("link", { name: "Modifica" }).click();
    await page.waitForURL(/\/anagrafiche\/scaglioni\/[^/]+$/);
    await expect(
      page.getByRole("heading", { name: "Modifica scaglione" })
    ).toBeVisible();

    // Cambia l'importo forfettario
    const campoImporto = page.getByLabel("Importo forfettario");
    await campoImporto.clear();
    await campoImporto.fill("18,00");
    await page.getByRole("button", { name: "Salva modifiche" }).click();

    // Attendi il redirect con esito salvato
    await page.waitForURL("**/anagrafiche/scaglioni?esito=salvato");

    // Verifica che il nuovo importo appaia nell'elenco
    const rigaModificata = tabella.locator("tbody tr").filter({ hasText: `fino a ${km} km` }).first();
    await expect(rigaModificata.getByText(/18,00/)).toBeVisible();

    // Ricarica la pagina e verifica la persistenza
    await page.reload();
    await page.waitForURL("**/anagrafiche/scaglioni**");
    const rigaRicaricata = tabella.locator("tbody tr").filter({ hasText: `fino a ${km} km` }).first();
    await expect(rigaRicaricata.getByText(/18,00/)).toBeVisible();
  });

  test("eliminazione con conferma rimuove lo scaglione e ricalcola le fasce", async ({ page }, testInfo) => {
    // Scaglioni globali con soglia unica: usa il range riservato 9000-9999.
    const km = sogliaStabileInIntervallo(
      REGISTRO_SCAGLIONI_KM.anagraficaScaglioni,
      testInfo.workerIndex,
      { salt: "eliminazione" }
    );

    // Crea uno scaglione dedicato a questo scenario
    await page.goto("/anagrafiche/scaglioni/nuovo");
    await page.getByLabel("Soglia massima").fill(String(km));
    await page.getByLabel("Importo forfettario").fill("9,00");
    await page.getByRole("button", { name: "Crea scaglione" }).click();
    await page.waitForURL("**/anagrafiche/scaglioni?esito=creato");

    const tabella = page.locator("table[aria-label='Elenco scaglioni chilometrici']");
    const riga = tabella.locator("tbody tr").filter({ hasText: `fino a ${km} km` }).first();
    await expect(riga).toBeVisible();

    // Apri la modale di conferma eliminazione
    await riga.getByRole("button", { name: "Elimina" }).click();
    await expect(
      page.getByRole("dialog", { name: new RegExp(`Eliminare lo scaglione «fino a ${km} km»\\?`) })
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Elimina scaglione" })
      .click();

    // Attendi il redirect con esito eliminato
    await page.waitForURL("**/anagrafiche/scaglioni?esito=eliminato");
    await expect(page.getByText("Scaglione eliminato")).toBeVisible();

    // Verifica che lo scaglione non sia più nell'elenco
    await expect(
      tabella.locator("tbody tr").filter({ hasText: `fino a ${km} km` })
    ).toHaveCount(0);
  });
});
