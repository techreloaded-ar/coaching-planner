import { test, expect } from "@playwright/test";

import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";

/**
 * Test e2e — US-006: Autorizzazione per ruolo e segregazione dei dati
 *
 * Scenari:
 * - Collaboratore tenta back office → reindirizzato al front office
 * - Amministratore ammesso nel front office e invitato alla console quando manca il profilo
 * - Route protetta senza sessione → redirect alla radice (regressioni US-027/US-029)
 * - Home / → reindirizza all'area del ruolo (proxy + server)
 * - API request con cookie: collaboratore non ottiene contenuto back office
 */

test.describe("US-006 Autorizzazione ruoli", () => {
  test("collaboratore tenta /anagrafiche → finisce su /attivita", async ({
    page,
  }) => {
    await accediComeCollaboratore(page);

    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();

    await page.goto("/anagrafiche");

    await page.waitForURL("**/attivita**");
    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();
  });

  test("amministratore accede a /attivita e conserva l'accesso alla console", async ({
    page,
  }) => {
    await accediComeAdmin(page);

    await page.waitForURL("**/attivita");
    await expect(
      page.getByRole("heading", { name: "Attività non disponibili" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Console amministrativa", exact: true })
    ).toBeVisible();

    await page.getByRole("link", { name: "Console amministrativa", exact: true }).click();
    await page.waitForURL("**/anagrafiche**");
    await expect(
      page.getByRole("heading", { name: "Clienti" })
    ).toBeVisible();
  });

  test("non autenticato → radice (regressione US-027/US-029)", async ({ page }) => {
    await page.goto("/anagrafiche");
    await page.waitForURL((url) => url.pathname === "/");
    await expect(
      page.getByRole("heading", { name: "Coaching Planner" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Accedi con Google" })
    ).toBeVisible();
  });

  test("home / → reindirizza all'area del ruolo", async ({ page }) => {
    await accediComeCollaboratore(page);

    await page.goto("/");

    await page.waitForURL("**/attivita**");
    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();
  });

  test("API: collaboratore richiede back office → redirect lato proxy", async ({
    page,
  }) => {
    await accediComeCollaboratore(page);

    const cookies = await page.context().cookies();
    const sessioneCookie = cookies.find((c) => c.name === "cp_sessione");

    if (sessioneCookie) {
      const res = await page.request.get("/anagrafiche", {
        headers: {
          Cookie: `cp_sessione=${sessioneCookie.value}`,
        },
      });

      const body = await res.text();
      expect(body).toContain("Le mie attività");
      expect(body).not.toContain("<h1>Clienti</h1>");
    }
  });
});
