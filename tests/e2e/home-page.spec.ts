import { test, expect } from "@playwright/test";

/**
 * Test e2e — US-024: Hero della home page pubblica
 *
 * Scenari read-only (nessuna fixture, nessuna mutazione di dati, nessuna
 * entità seed toccata): compatibili con `fullyParallel: true`.
 *
 * Copre:
 * - hero visibile con heading e payoff;
 * - CTA "Accedi" unica con href="/login";
 * - navigazione al login;
 * - leggibilità su viewport mobile 375×667.
 */

test.describe("US-024 Home page", () => {
  test("hero non autenticata: heading, payoff e CTA unica", async ({
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

    const cta = page.getByRole("link", { name: "Accedi" });
    await expect(cta).toHaveCount(1);
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/login");
  });

  test("navigazione al login dalla CTA Accedi", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Accedi" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Accedi" })
    ).toBeVisible();
  });

  test.describe("leggibilità mobile", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("heading e CTA visibili su viewport 375×667", async ({ page }) => {
      await page.goto("/");

      await expect(
        page.getByRole("heading", { name: "Coaching Planner" })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Accedi" })
      ).toBeVisible();
    });
  });
});
