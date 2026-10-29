import { test, expect } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { apriMenuAccount, avatarUtente, pannelloAccount } from "./support/menu-account";

/**
 * Demo scenario — US-005: Accesso con Google e sessione utente
 *
 * Dimostra il flusso completo: un amministratore apre la pagina di login,
 * clicca "Accedi con Google", completa l'autenticazione (simulata) e viene
 * reindirizzato al Back Office.
 *
 * Registra un video per la review.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-005 Demo", () => {
  test("accesso amministratore → Back Office", async ({ page }) => {
    // 1. Naviga alla radice (pagina di accesso)
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Accedi con Google" })
    ).toBeVisible();

    // 2. Verifica la presenza del pulsante Accedi con Google
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

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
