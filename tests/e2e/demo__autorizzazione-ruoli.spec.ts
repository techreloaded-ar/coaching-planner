import { test, expect } from "@playwright/test";

/**
 * Demo scenario — US-006: Autorizzazione per ruolo e segregazione dei dati
 *
 * Dimostra il flusso descritto nel campo Dimostrazione:
 * 1. Una collaboratrice autenticata tenta di aprire il back office e viene bloccata
 * 2. L'amministratore accede e apre il back office senza restrizioni
 *
 * Registra un video per la review.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-006 Demo", () => {
  test("collaboratore bloccato, amministratore dentro", async ({ page }) => {
    // ── Atto 1: La collaboratrice tenta il back office ──────────

    // 1. Accedi come collaboratrice
    await page.goto("/");

    const googleBtn = page.getByRole("button", { name: "Accedi con Google" });
    await expect(googleBtn).toBeVisible();

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

    // 2. Attendi il reindirizzamento al Front Office
    await page.waitForURL("**/attivita**");
    await expect(page.getByText("Giulia Conti")).toBeVisible();
    await expect(page.getByText("Collaboratore")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();

    // 3. La collaboratrice tenta di aprire il back office
    await page.goto("/anagrafiche");

    // 4. Viene riportata al front office — accesso negato!
    await page.waitForURL("**/attivita**");
    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();
    await expect(page.getByText("Back office")).not.toBeAttached();

    // 5. Disconnetti
    const esciBtn = page.getByRole("button", { name: "Esci" });
    await expect(esciBtn).toBeVisible();
    await esciBtn.click();
    await page.waitForURL("**/login**");

    // ── Atto 2: L'amministratore apre il back office ────────────

    // 6. Accedi come amministratore
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Accedi con Google" })
    ).toBeVisible();

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

    // 7. L'amministratore atterra nel back office
    await page.waitForURL("**/anagrafiche**");
    await expect(page.getByRole("banner").getByText("Tech Reloaded")).toBeVisible();
    await expect(page.getByRole("banner").getByText("Amministratore")).toBeVisible();
    await expect(page.getByText("Back office")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Clienti" })
    ).toBeVisible();

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
