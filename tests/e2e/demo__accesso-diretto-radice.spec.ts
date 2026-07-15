import { test, expect } from "@playwright/test";

/**
 * Demo scenario — US-027: Accesso diretto dalla pagina radice con brand Agile Reloaded
 *
 * Dimostra il flusso completo: un utente apre la radice, vede logo Agile Reloaded,
 * nome app, payoff e pulsante "Accedi con Google"; completa l'autenticazione
 * (simulata) e atterra nell'area del proprio ruolo; quindi verifica che /login
 * restituisca pagina non trovata.
 *
 * Registra un video per la review.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-027 Demo", () => {
  test("accesso diretto dalla radice → area del ruolo; /login è 404", async ({
    page,
  }) => {
    // 1. Naviga alla radice (pagina di accesso)
    await page.goto("/");

    // 2. Verifica la presenza di logo, nome app, payoff e pulsante Google
    await expect(page.getByAltText("Agile Reloaded")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Coaching Planner" })
    ).toBeVisible();
    await expect(
      page.getByText(
        "Consuntivi mensili di collaboratori, clienti e offerte."
      )
    ).toBeVisible();

    const googleBtn = page.getByRole("button", { name: "Accedi con Google" });
    await expect(googleBtn).toBeVisible();

    // 3. Simula il completamento del flusso Google OAuth
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
    await expect(
      page.getByRole("banner").getByText("Tech Reloaded")
    ).toBeVisible();
    await expect(
      page.getByRole("banner").getByText("Amministratore")
    ).toBeVisible();

    // 6. Verifica la presenza del pulsante Esci
    const esciBtn = page.locator("[data-esci]");
    await expect(esciBtn).toBeVisible();

    // 7. Verifica che /login restituisca pagina non trovata
    const response = await page.goto("/login");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Pagina non trovata")).toBeVisible();

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
