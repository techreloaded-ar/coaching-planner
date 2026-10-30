import { test, expect } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { apriMenuAccount, avatarUtente, pannelloAccount } from "./support/menu-account";

/**
 * Demo scenario — US-027: Accesso diretto dalla pagina radice con brand Coaching Planner
 *
 * Dimostra il flusso completo: un utente apre la radice, vede logo Coaching Planner,
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
    await expect(page.getByAltText("Coaching Planner")).toBeVisible();
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

    // 3. Simula il completamento del flusso Google OAuth e apre la console.
    await accediAlBackOfficeComeAdmin(page);

    // 5. Verifica che l'header mostri il nome utente e il ruolo
    await expect(avatarUtente(page, "Tech Reloaded")).toBeVisible();
    await apriMenuAccount(page);
    await expect(pannelloAccount(page)).toContainText("Amministratore");

    // 6. Verifica la presenza del pulsante Esci nel menu dell'account
    await expect(pannelloAccount(page).getByRole("button", { name: "Esci" })).toBeVisible();

    // 7. Verifica che /login restituisca pagina non trovata
    const response = await page.goto("/login");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Pagina non trovata")).toBeVisible();

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
