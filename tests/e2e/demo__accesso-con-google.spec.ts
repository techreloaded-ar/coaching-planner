import { test, expect } from "@playwright/test";

/**
 * Demo scenario — US-005: Accesso con Google e sessione utente
 *
 * Dimostra il flusso completo: un amministratore apre la pagina di login,
 * clicca "Accedi con Google", completa l'autenticazione (simulata) e viene
 * reindirizzato al Back Office.
 *
 * Registra un video per la review.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-005 Demo", () => {
  test("accesso amministratore → Back Office", async ({ page }) => {
    // 1. Naviga alla pagina di login
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Accedi" })
    ).toBeVisible();

    // 2. Verifica la presenza del pulsante Accedi con Google
    const googleBtn = page.getByRole("button", { name: "Accedi con Google" });
    await expect(googleBtn).toBeVisible();

    // 3. Simula il completamento del flusso Google OAuth
    //    Invece di seguire il redirect a Google, chiamiamo direttamente
    //    l'endpoint di test che crea la sessione per l'amministratore.
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

    // 4. Attendi il reindirizzamento al Back Office
    await page.waitForURL("**/anagrafiche**");

    // 5. Verifica che l'header mostri il nome utente e il ruolo
    await expect(page.getByText("Tech Reloaded")).toBeVisible();
    await expect(page.getByText("Amministratore")).toBeVisible();

    // 6. Verifica la presenza del pulsante Esci
    const esciBtn = page.getByRole("button", { name: "Esci" });
    await expect(esciBtn).toBeVisible();

    // 7. Mantieni lo stato finale visibile per almeno 1.5 secondi
    await page.waitForTimeout(1500);
  });
});
