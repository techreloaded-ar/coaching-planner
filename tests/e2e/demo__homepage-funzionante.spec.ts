import { test, expect } from "@playwright/test";

/**
 * Demo scenario — US-001: Scaffold applicazione Next.js
 *
 * Dimostra che l'applicazione si avvia e mostra la pagina iniziale funzionante.
 * Registra un video per la review.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 400 },
});

test.describe("US-001 Demo", () => {
  test("la homepage mostra il titolo Coaching Planner", async ({ page }) => {
    // Naviga alla homepage
    await page.goto("/");

    // Verifica che il titolo sia visibile
    const heading = page.getByRole("heading", { name: "Coaching Planner" });
    await expect(heading).toBeVisible();

    // Verifica il sottotitolo
    const subtitle = page.getByText(
      "Il gestionale per la consuntivazione mensile"
    );
    await expect(subtitle).toBeVisible();

    // Verifica il pulsante Accedi
    const loginLink = page.getByRole("link", { name: "Accedi" });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
