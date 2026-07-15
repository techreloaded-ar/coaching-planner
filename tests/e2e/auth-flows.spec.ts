import { test, expect } from "@playwright/test";

import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";

/**
 * Test e2e — US-005: Flussi di autenticazione Google
 *
 * Scenari:
 * - Accesso collaboratore → Front Office
 * - Email non censita → errore generico sulla radice
 * - Route protette senza sessione → redirect alla radice
 * - Disconnessione esplicita
 */

test.describe("Auth e2e", () => {
  test("accesso collaboratore → Front Office", async ({ page }) => {
    await accediComeCollaboratore(page);

    // Verifica che l'header mostri il nome e il ruolo della collaboratrice
    await expect(page.getByText("Giulia Conti")).toBeVisible();
    await expect(page.getByText("Collaboratore")).toBeVisible();

    // Verifica presenza pulsante Esci
    await expect(page.getByRole("button", { name: "Esci" })).toBeVisible();
  });

  test("email non censita → errore generico sulla radice", async ({ page }) => {
    // Vai direttamente alla radice con parametro error=1
    await page.goto("/?error=1");

    // Verifica che l'alert di errore sia visibile
    const errorAlert = page.getByRole("alert").filter({
      hasText: "Questo account Google non è autorizzato ad accedere",
    });
    await expect(errorAlert).toBeVisible();

    // Verifica che il pulsante Accedi con Google sia ancora presente
    await expect(
      page.getByRole("button", { name: "Accedi con Google" })
    ).toBeVisible();
  });

  test("route protette senza sessione → redirect alla radice", async ({
    page,
  }) => {
    // Prova ad accedere a una route protetta senza sessione
    await page.goto("/anagrafiche");

    // Dovrebbe reindirizzare alla radice (pagina di accesso)
    await page.waitForURL("**/");
    await expect(
      page.getByRole("button", { name: "Accedi con Google" })
    ).toBeVisible();
  });

  test("disconnessione esplicita → radice con messaggio", async ({ page }) => {
    // 1. Accedi come amministratore
    await accediComeAdmin(page);

    // 2. Clicca Esci
    const esciBtn = page.locator("[data-esci]");
    await expect(esciBtn).toBeVisible();
    await esciBtn.click();

    // 3. Dovrebbe reindirizzare alla radice con ?logout=1
    await page.waitForURL("**/?logout=1**");
    await expect(
      page.getByText("Ti sei disconnesso. A presto!")
    ).toBeVisible();
  });
});
