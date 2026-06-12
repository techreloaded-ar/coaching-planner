import { test, expect } from "@playwright/test";

/**
 * Test e2e — US-006: Autorizzazione per ruolo e segregazione dei dati
 *
 * Scenari:
 * - Collaboratore tenta back office → reindirizzato al front office
 * - Amministratore reindirizzato da front office a back office
 * - Route protetta senza sessione → redirect a /login (regressione US-005)
 * - Home / → reindirizza all'area del ruolo (proxy + server)
 * - API request con cookie: collaboratore non ottiene contenuto back office
 */

test.describe("US-006 Autorizzazione ruoli", () => {
  test("collaboratore tenta /anagrafiche → finisce su /attivita", async ({
    page,
  }) => {
    // Accedi come collaboratrice
    await page.goto("/login");
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

    // Attendi di essere sul front office
    await page.waitForURL("**/attivita**");
    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();

    // Prova a navigare al back office
    await page.goto("/anagrafiche");

    // Dovrebbe essere reindirizzato indietro al front office
    await page.waitForURL("**/attivita**");
    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();
  });

  test("amministratore viene reindirizzato da /attivita ad /anagrafiche", async ({
    page,
  }) => {
    // Accedi come amministratore
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

    // Attendi di essere sul back office
    await page.waitForURL("**/anagrafiche**");
    await expect(page.getByText("Back office")).toBeVisible();

    // Prova a navigare al front office
    await page.goto("/attivita");

    // Dovrebbe essere reindirizzato indietro al back office
    await page.waitForURL("**/anagrafiche**");
    await expect(page.getByText("Back office")).toBeVisible();
  });

  test("non autenticato → /login (regressione US-005)", async ({ page }) => {
    await page.goto("/anagrafiche");
    await page.waitForURL("**/login**");
    await expect(
      page.getByRole("heading", { name: "Accedi" })
    ).toBeVisible();
  });

  test("home / → reindirizza all'area del ruolo", async ({ page }) => {
    // Accedi come collaboratrice
    await page.goto("/login");
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
    await page.waitForURL("**/attivita**");

    // Naviga alla home /
    await page.goto("/");

    // Dovrebbe essere reindirizzato alla propria area
    await page.waitForURL("**/attivita**");
    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();
  });

  test("API: collaboratore richiede back office → redirect lato proxy", async ({
    page,
  }) => {
    // Accedi come collaboratrice
    await page.goto("/login");
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
    await page.waitForURL("**/attivita**");

    // Estrai il cookie di sessione dal browser context
    const cookies = await page.context().cookies();
    const sessioneCookie = cookies.find((c) => c.name === "cp_sessione");

    if (sessioneCookie) {
      // Effettua una richiesta API diretta con il cookie di sessione
      const res = await page.request.get("/anagrafiche", {
        headers: {
          Cookie: `cp_sessione=${sessioneCookie.value}`,
        },
      });

      // Il proxy dovrebbe reindirizzare: verifica che la risposta sia un redirect
      // o che il body contenga il segnale di redirect lato server
      const body = await res.text();
      // La risposta dovrebbe mostrare il front office, non il back office
      expect(body).toContain("Le mie attività");
      expect(body).not.toContain("Back office");
    }
  });
});
