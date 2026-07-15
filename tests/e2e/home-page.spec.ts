import { test, expect } from "@playwright/test";

/**
 * Test e2e — US-027: Pagina radice come pagina di accesso con brand Agile Reloaded
 *
 * Scenari read-only (nessuna fixture, nessuna mutazione di dati, nessuna
 * entità seed toccata): compatibili con `fullyParallel: true`.
 *
 * Copre:
 * - heading "Coaching Planner", payoff, logo Agile Reloaded e pulsante Google;
 * - leggibilità su viewport mobile 375×667.
 */

test.describe("US-027 Pagina radice", () => {
  test("radice non autenticata: heading, payoff, logo e pulsante Google", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Coaching Planner" })
    ).toBeVisible();

    await expect(
      page.getByText(
        "Consuntivi mensili di collaboratori, clienti e offerte."
      )
    ).toBeVisible();

    // Logo Agile Reloaded
    await expect(page.getByAltText("Agile Reloaded")).toBeVisible();

    // Pulsante Accedi con Google
    const googleBtn = page.getByRole("button", {
      name: "Accedi con Google",
    });
    await expect(googleBtn).toHaveCount(1);
    await expect(googleBtn).toBeVisible();
  });

  test.describe("leggibilità mobile", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("logo, heading e pulsante visibili su viewport 375×667", async ({
      page,
    }) => {
      await page.goto("/");

      await expect(
        page.getByRole("heading", { name: "Coaching Planner" })
      ).toBeVisible();
      await expect(page.getByAltText("Agile Reloaded")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Accedi con Google" })
      ).toBeVisible();
    });
  });
});
