import { test, expect } from "@playwright/test";

/**
 * Demo scenario — US-007: Anagrafica clienti — ciclo di vita del cliente
 *
 * Dimostra il flusso completo: l'amministratore entra nella console,
 * crea un nuovo cliente con i dati di fatturazione, lo modifica e lo disattiva
 * vedendolo sparire dalle scelte operative (badge "Disattivato").
 *
 * Registra un video per la review.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-007 Demo", () => {
  test("ciclo di vita cliente: crea → modifica → disattiva", async ({
    page,
  }) => {
    // ── 1. Login tramite endpoint e2e ──────────────────────────────

    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Accedi" })
    ).toBeVisible();

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

    // ── 2. Naviga a Clienti dalla sidebar ─────────────────────────

    await expect(page.getByRole("banner").getByText("Tech Reloaded")).toBeVisible();
    await expect(page.getByRole("banner").getByText("Amministratore")).toBeVisible();

    await page
      .locator("nav[aria-label='Navigazione principale'] a")
      .filter({ hasText: /^Clienti$/ })
      .click();

    await page.waitForURL("**/anagrafiche/clienti");
    await expect(
      page.getByRole("heading", { name: "Clienti" })
    ).toBeVisible();

    // ── 3. Clicca "Nuovo cliente" ──────────────────────────────────

    await page.getByRole("link", { name: "Nuovo cliente" }).click();
    await page.waitForURL("**/anagrafiche/clienti/nuovo");
    await expect(
      page.getByRole("heading", { name: "Nuovo cliente" })
    ).toBeVisible();

    // ── 4. Compila tutti i campi del form ──────────────────────────

    const ts = Date.now();
    const ragioneSociale = `Banca Demo ${ts} S.p.A.`;

    await page.getByLabel("Ragione sociale").fill(ragioneSociale);
    await page.getByLabel("Partita IVA").fill("04127730961");
    await page.getByLabel("Codice fiscale").fill("BNCDMO80A01H501X");
    await page.getByLabel("Indirizzo").fill("Via Roma 42");
    await page.getByLabel("Città").fill("Milano");
    await page.getByLabel("CAP").fill("20121");
    await page.getByLabel("Provincia").fill("MI");
    await page.getByLabel("PEC").fill("demo@pec.bancademo.it");
    await page.getByLabel("Codice destinatario SDI").fill("M5UXCR1");

    // ── 5. Invia il form ──────────────────────────────────────────

    await page.getByRole("button", { name: "Crea cliente" }).click();

    // ── 6. Verifica redirect alla lista con successo ───────────────

    await page.waitForURL("**/anagrafiche/clienti?esito=creato");
    await expect(
      page.getByRole("heading", { name: "Clienti" })
    ).toBeVisible();

    // ── 7. Trova il cliente appena creato nella lista ──────────────

    const rigaCliente = page
      .locator("table[aria-label='Elenco clienti'] tbody tr")
      .filter({ hasText: ragioneSociale })
      .first();
    await expect(rigaCliente.getByText(ragioneSociale)).toBeVisible();
    await expect(rigaCliente.getByText("Attivo")).toBeVisible();

    // ── 8. Clicca "Modifica" sul cliente ──────────────────────────

    await rigaCliente.getByRole("link", { name: "Modifica" }).click();
    await page.waitForURL(/\/anagrafiche\/clienti\/[^/]+\/modifica$/);
    await expect(
      page.getByRole("heading", { name: "Modifica cliente" })
    ).toBeVisible();

    // ── 9. Cambia la città ────────────────────────────────────────

    const nuovaCitta = "Bologna";
    const campoCitta = page.getByLabel("Città");
    await campoCitta.clear();
    await campoCitta.fill(nuovaCitta);

    // ── 10. Salva le modifiche ────────────────────────────────────

    await page.getByRole("button", { name: "Salva modifiche" }).click();

    await page.waitForURL("**/anagrafiche/clienti?esito=salvato");
    await expect(
      page.getByRole("heading", { name: "Clienti" })
    ).toBeVisible();

    // Verifica che la nuova città sia visibile nella riga del cliente
    const rigaModificata = page
      .locator("table[aria-label='Elenco clienti'] tbody tr")
      .filter({ hasText: ragioneSociale })
      .first();
    await expect(rigaModificata.getByText(nuovaCitta)).toBeVisible();

    // ── 11. Clicca "Disattiva" sul cliente ────────────────────────

    await rigaModificata
      .getByRole("button", { name: "Disattiva" })
      .click();

    await page.waitForURL("**/anagrafiche/clienti");

    // ── 12. Verifica il badge "Disattivato" ───────────────────────

    const rigaDisattivata = page
      .locator("table[aria-label='Elenco clienti'] tbody tr")
      .filter({ hasText: ragioneSociale })
      .first();
    await expect(rigaDisattivata.getByText("Disattivato")).toBeVisible();

    // ── 13. Mantieni lo stato finale visibile per almeno 1.5 secondi

    await page.waitForTimeout(1500);
  });
});
