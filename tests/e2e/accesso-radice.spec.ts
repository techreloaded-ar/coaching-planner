import { test, expect } from "@playwright/test";

import { accediComeCollaboratore } from "./support/auth";

/**
 * Test e2e — US-027: Accesso diretto dalla pagina radice con brand Agile Reloaded
 *
 * Scenari read-only (nessuna fixture, nessuna mutazione di dati):
 * compatibili con `fullyParallel: true`.
 *
 * Copre:
 * - radice non autenticata con heading, payoff, logo e pulsante Google
 * - logo servito localmente (nessun host esterno)
 * - /login restituisce 404
 * - accesso negato via /?error=1
 * - redirect autenticato dalla radice
 * - leggibilità su viewport mobile 375×667
 */

test.describe("US-027 Accesso diretto dalla radice", () => {
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
    const logo = page.getByAltText("Agile Reloaded");
    await expect(logo).toBeVisible();

    // Pulsante Accedi con Google (unico)
    const googleBtn = page.getByRole("button", {
      name: "Accedi con Google",
    });
    await expect(googleBtn).toHaveCount(1);
    await expect(googleBtn).toBeVisible();
  });

  test("logo servito localmente (nessun host esterno)", async ({ page }) => {
    await page.goto("/");

    const logo = page.getByAltText("Agile Reloaded");
    await expect(logo).toBeVisible();

    // L'attributo src non deve contenere host esterni
    const src = await logo.getAttribute("src");
    expect(src).not.toBeNull();
    expect(src!).not.toContain("agilereloaded.com");
    expect(src!).not.toContain("http");

    // Verifica che l'asset risponda 200
    const resolvedUrl = src!.startsWith("/")
      ? new URL(src!, page.url()).href
      : src!;
    const assetResponse = await page.request.get(resolvedUrl);
    expect(assetResponse.status()).toBe(200);
  });

  test("/login non esiste (404)", async ({ page }) => {
    const response = await page.goto("/login");

    expect(response?.status()).toBe(404);

    await expect(page.getByText("Pagina non trovata")).toBeVisible();
  });

  test("accesso negato via /?error=1", async ({ page }) => {
    await page.goto("/?error=1");

    const errorAlert = page.getByRole("alert").filter({
      hasText: "Questo account Google non è autorizzato ad accedere",
    });
    await expect(errorAlert).toBeVisible();

    // Il pulsante Google è ancora visibile
    await expect(
      page.getByRole("button", { name: "Accedi con Google" })
    ).toBeVisible();
  });

  test("redirect autenticato: collaboratore sulla radice → /attivita", async ({
    page,
  }) => {
    await accediComeCollaboratore(page);

    // Vai alla radice: dovresti essere reindirizzato all'area del ruolo
    await page.goto("/");
    await page.waitForURL("**/attivita**");

    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();
  });

  test.describe("leggibilità mobile", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("logo, heading, payoff e pulsante visibili su viewport 375×667", async ({
      page,
    }) => {
      await page.goto("/");

      await expect(page.getByAltText("Agile Reloaded")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Coaching Planner" })
      ).toBeVisible();
      await expect(
        page.getByText(
          "Consuntivi mensili di collaboratori, clienti e offerte."
        )
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Accedi con Google" })
      ).toBeVisible();
    });
  });
});
