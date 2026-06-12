import { test, expect } from "@playwright/test";

/**
 * Test e2e — US-005: Flussi di autenticazione Google
 *
 * Scenari:
 * - Accesso collaboratore → Front Office
 * - Email non censita → errore generico
 * - Route protette senza sessione → redirect a /login
 * - Disconnessione esplicita
 */

test.describe("Auth e2e", () => {
  test("accesso collaboratore → Front Office", async ({ page }) => {
    await page.goto("/login");

    // Simula il completamento OAuth per la collaboratrice
    await page.evaluate(async () => {
      const res = await fetch("/api/e2e-test/sessione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "giulia.conti@agilereloaded.it" }),
      });
      const data = await res.json();
      if (data.redirect) {
        window.location.href = data.redirect;
      }
    });

    // Attendi il reindirizzamento al Front Office
    await page.waitForURL("**/attivita**");

    // Verifica che l'header mostri il nome e il ruolo della collaboratrice
    await expect(page.getByText("Giulia Conti")).toBeVisible();
    await expect(page.getByText("Collaboratore")).toBeVisible();

    // Verifica presenza pulsante Esci
    await expect(page.getByRole("button", { name: "Esci" })).toBeVisible();
  });

  test("email non censita → errore generico su /login", async ({ page }) => {
    // Vai direttamente alla login con parametro error=1
    await page.goto("/login?error=1");

    // Verifica che l'alert di errore sia visibile (ignora il __next-route-announcer__)
    const errorAlert = page.getByRole("alert").filter({
      hasText: "Questo account Google non è autorizzato ad accedere",
    });
    await expect(errorAlert).toBeVisible();

    // Verifica che il pulsante Accedi con Google sia ancora presente
    await expect(
      page.getByRole("button", { name: "Accedi con Google" })
    ).toBeVisible();
  });

  test("route protette senza sessione → redirect a /login", async ({
    page,
  }) => {
    // Prova ad accedere a una route protetta senza sessione
    await page.goto("/anagrafiche");

    // Dovrebbe reindirizzare a /login
    await page.waitForURL("**/login**");
    await expect(
      page.getByRole("heading", { name: "Accedi" })
    ).toBeVisible();
  });

  test("disconnessione esplicita → /login con messaggio", async ({ page }) => {
    // 1. Accedi come amministratore
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

    // 2. Clicca Esci
    const esciBtn = page.locator("[data-esci]");
    await expect(esciBtn).toBeVisible();
    await esciBtn.click();

    // 3. Dovrebbe reindirizzare a /login?logout=1
    await page.waitForURL("**/login?logout=1**");
    await expect(
      page.getByText("Ti sei disconnesso. A presto!")
    ).toBeVisible();
  });
});
