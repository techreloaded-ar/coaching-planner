import { test, expect } from "@playwright/test";

import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";

/**
 * Demo scenario — US-006: Autorizzazione per ruolo e segregazione dei dati
 *
 * Dimostra il flusso descritto nel campo Dimostrazione:
 * 1. Un utente non autenticato apre una rotta protetta e viene riportato alla radice
 * 2. Una collaboratrice autenticata tenta di aprire il back office e viene bloccata
 * 3. L'amministratore accede e apre il back office senza restrizioni
 *
 * Registra un video per la review.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-006 Demo", () => {
  test("utente anonimo alla radice, collaboratore bloccato, amministratore dentro", async ({ page }) => {
    // ── Atto 1: Utente anonimo su rotta protetta ────────────────

    await page.goto("/anagrafiche");
    await page.waitForURL((url) => url.pathname === "/");
    await expect(
      page.getByRole("heading", { name: "Coaching Planner" })
    ).toBeVisible();

    // ── Atto 2: La collaboratrice tenta il back office ──────────

    await accediComeCollaboratore(page);

    await expect(page.getByText("Giulia Conti")).toBeVisible();
    await expect(page.getByText("Collaboratore")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();

    await page.goto("/anagrafiche");

    await page.waitForURL("**/attivita**");
    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();

    const esciBtn = page.getByRole("button", { name: "Esci" });
    await expect(esciBtn).toBeVisible();
    await esciBtn.click();
    await page.waitForURL((url) =>
      url.pathname === "/" && url.searchParams.get("logout") === "1"
    );
    await expect(
      page.getByText("Ti sei disconnesso. A presto!")
    ).toBeVisible();

    // ── Atto 3: L'amministratore apre il back office ────────────

    await expect(
      page.getByRole("button", { name: "Accedi con Google" })
    ).toBeVisible();

    await accediComeAdmin(page);

    await expect(
      page.getByRole("banner").getByText("Tech Reloaded")
    ).toBeVisible();
    await expect(
      page.getByRole("banner").getByText("Amministratore")
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Clienti" })
    ).toBeVisible();

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
