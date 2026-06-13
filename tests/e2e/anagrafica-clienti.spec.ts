import { test, expect } from "@playwright/test";

/**
 * Test e2e — US-007: Anagrafica clienti CRUD
 *
 * Scenari:
 * - Validazione campi obbligatori senza creazione
 * - Modifica persistita dopo reload
 * - Cliente disattivato distinguibile nell'elenco
 * - Sidebar navigazione
 * - Redirect /anagrafiche → /anagrafiche/clienti
 */

test.describe("Anagrafica clienti", () => {
  test.beforeEach(async ({ page }) => {
    // Accedi come amministratore tramite endpoint e2e
    await page.goto("/login");
    await page.evaluate(async () => {
      const res = await fetch("/api/e2e-test/sessione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "info@techreloaded.it" }),
      });
      const data = await res.json();
      if (data.redirect) {
        window.location.href = data.redirect;
      }
    });
    await page.waitForURL("**/anagrafiche**");
  });

  test("validazione campi obbligatori senza creazione", async ({ page }) => {
    // Naviga al form nuovo cliente
    await page.goto("/anagrafiche/clienti/nuovo");
    await expect(
      page.getByRole("heading", { name: "Nuovo cliente" })
    ).toBeVisible();

    // Invia il form vuoto
    await page.getByRole("button", { name: "Crea cliente" }).click();

    // Verifica il banner di errore generale
    await expect(
      page.getByText(/Controlla i campi evidenziati/)
    ).toBeVisible();

    // Verifica i messaggi di errore per i campi obbligatori
    await expect(
      page.getByText("La ragione sociale è obbligatoria")
    ).toBeVisible();

    await expect(
      page.getByText("La partita IVA è obbligatoria")
    ).toBeVisible();

    // Verifica che non ci sia redirect — siamo ancora su /nuovo
    await expect(page).toHaveURL(/\/anagrafiche\/clienti\/nuovo/);
  });

  test("modifica persistita dopo reload", async ({ page }) => {
    // Vai all'elenco clienti
    await page.goto("/anagrafiche/clienti");
    await expect(
      page.getByRole("heading", { name: "Clienti" })
    ).toBeVisible();

    // Prendi la prima riga della tabella
    const firstRow = page
      .locator("table[aria-label='Elenco clienti'] tbody tr")
      .first();

    // Clicca "Modifica" sul primo cliente
    await firstRow.getByRole("link", { name: "Modifica" }).click();

    // Attendi la pagina di modifica
    await page.waitForURL(/\/anagrafiche\/clienti\/[^/]+\/modifica$/);
    await expect(
      page.getByRole("heading", { name: "Modifica cliente" })
    ).toBeVisible();

    // Compila il campo Città con un valore univoco
    const nuovaCitta = "TestCittà-" + Date.now();
    await page.getByLabel(/Città/).fill(nuovaCitta);

    // Invia il form
    await page.getByRole("button", { name: "Salva modifiche" }).click();

    // Attendi il redirect all'elenco (con parametro esito)
    await page.waitForURL("**/anagrafiche/clienti?esito=salvato");

    // Verifica che la nuova città appaia nell'elenco
    await expect(page.getByText(nuovaCitta)).toBeVisible();

    // Ricarica la pagina e verifica la persistenza
    await page.reload();
    await page.waitForURL("**/anagrafiche/clienti**");
    await expect(page.getByText(nuovaCitta)).toBeVisible();
  });

  test("cliente disattivato distinguibile nell'elenco", async ({ page }) => {
    // Vai all'elenco clienti
    await page.goto("/anagrafiche/clienti");
    await expect(
      page.getByRole("heading", { name: "Clienti" })
    ).toBeVisible();

    // Trova un cliente attivo (con pulsante "Disattiva")
    const rigaAttiva = page
      .locator("table[aria-label='Elenco clienti'] tbody tr")
      .filter({ has: page.getByRole("button", { name: "Disattiva" }) })
      .first();

    // Salva la ragione sociale per identificare il cliente dopo il redirect
    const ragioneSociale = await rigaAttiva.locator("b").first().textContent();
    if (!ragioneSociale) throw new Error("Impossibile leggere la ragione sociale del cliente");

    // Disattiva il cliente (form submit diretto)
    await rigaAttiva.getByRole("button", { name: "Disattiva" }).click();

    // Attendi il redirect all'elenco
    await page.waitForURL("**/anagrafiche/clienti");

    // Verifica che la riga del cliente mostri il badge "Disattivato"
    const rigaDisattivata = page
      .locator("table[aria-label='Elenco clienti'] tbody tr")
      .filter({ hasText: ragioneSociale })
      .first();
    await expect(rigaDisattivata.getByText("Disattivato")).toBeVisible();

    // Verifica che la riga abbia il pulsante "Riattiva"
    await expect(
      rigaDisattivata.getByRole("button", { name: "Riattiva" })
    ).toBeVisible();

    // Riattiva il cliente
    await rigaDisattivata.getByRole("button", { name: "Riattiva" }).click();

    // Attendi il redirect
    await page.waitForURL("**/anagrafiche/clienti");

    // Verifica che ora mostri il badge "Attivo"
    const rigaRiattivata = page
      .locator("table[aria-label='Elenco clienti'] tbody tr")
      .filter({ hasText: ragioneSociale })
      .first();
    await expect(rigaRiattivata.getByText("Attivo")).toBeVisible();
  });

  test("sidebar navigazione", async ({ page }) => {
    // Vai all'elenco clienti
    await page.goto("/anagrafiche/clienti");

    // Verifica che "Clienti" sia il link attivo nella sidebar
    const clientiLink = page
      .locator("nav[aria-label='Navigazione principale'] a")
      .filter({ hasText: "Clienti" });
    await expect(clientiLink).toHaveAttribute("aria-current", "page");

    // Verifica le voci disabilitate con badge "In arrivo"
    const vociDisabilitate = ["Offerte", "Scaglioni km", "Report"];
    for (const voce of vociDisabilitate) {
      const btn = page
        .locator("nav[aria-label='Navigazione principale'] button[disabled]")
        .filter({ hasText: voce });
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute("aria-disabled", "true");
      await expect(btn.getByText("In arrivo")).toBeVisible();
    }

    // Verifica che "Collaboratori" sia un link attivo e navigabile
    // (US-009: la voce non è più disabilitata)
    const collaboratoriLink = page
      .locator("nav[aria-label='Navigazione principale'] a")
      .filter({ hasText: "Collaboratori" });
    await expect(collaboratoriLink).toBeVisible();
    await expect(collaboratoriLink).toHaveAttribute("href", "/anagrafiche/collaboratori");

    // Verifica che i pulsanti disabilitati non siano link cliccabili
    // (sono <button disabled>, quindi Playwright non li clicca comunque)
    const offerteBtn = page
      .locator("nav[aria-label='Navigazione principale'] button[disabled]")
      .filter({ hasText: "Offerte" });
    await expect(offerteBtn).toBeDisabled();
  });

  test("redirect /anagrafiche → /anagrafiche/clienti", async ({ page }) => {
    // Naviga a /anagrafiche (senza /clienti)
    await page.goto("/anagrafiche");

    // Verifica il redirect automatico a /anagrafiche/clienti
    await page.waitForURL("**/anagrafiche/clienti");
    await expect(
      page.getByRole("heading", { name: "Clienti" })
    ).toBeVisible();
  });
});
