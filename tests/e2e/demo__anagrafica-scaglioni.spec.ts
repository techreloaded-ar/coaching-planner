import { test, expect } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import {
  REGISTRO_SCAGLIONI_KM,
  soglieStabiliInIntervallo,
} from "./support/reserved-resources";

/**
 * Demo scenario — US-010: Configurazione degli scaglioni chilometrici per i rimborsi
 *
 * Dimostra il flusso completo: l'amministratore apre la pagina degli scaglioni,
 * definisce una nuova soglia con il relativo importo forfettario, ne aggiunge
 * una seconda con soglia superiore e rivede la configurazione salvata,
 * ordinata per soglia crescente.
 *
 * Registra un video per la review.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-010 Demo", () => {
  test("configura due scaglioni chilometrici e rivede la configurazione ordinata", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);

    // Scaglioni globali con soglia unica: usa il range demo riservato 6000-6999.
    const [kmA, kmB] = soglieStabiliInIntervallo(
      REGISTRO_SCAGLIONI_KM.demoAnagraficaScaglioni,
      testInfo.workerIndex,
      2,
      { passo: 50, salt: "configura-due-scaglioni" }
    );

    // ── 1. Login amministratore tramite endpoint e2e ───────────────

    await accediComeAdmin(page);

    // ── 2. Naviga a "Scaglioni km" dalla sidebar ────────────────────

    await expect(page.getByRole("banner").getByText("Tech Reloaded")).toBeVisible();

    await page
      .getByRole("link", { name: "Scaglioni km", exact: true })
      .click();

    await page.waitForURL("**/anagrafiche/scaglioni");
    await expect(
      page.getByRole("heading", { name: "Scaglioni chilometrici" })
    ).toBeVisible();

    // ── 3. Apre il form per il primo scaglione ──────────────────────

    await page.getByRole("link", { name: "Nuovo scaglione" }).click();
    await page.waitForURL("**/anagrafiche/scaglioni/nuovo");
    await expect(
      page.getByRole("heading", { name: "Nuovo scaglione" })
    ).toBeVisible();

    // ── 4. Configura il primo scaglione: soglia e importo ───────────

    await page.getByLabel("Soglia massima").fill(String(kmA));
    await expect(page.getByLabel("Soglia massima")).toHaveValue(String(kmA));

    await page.getByLabel("Importo forfettario").fill("45,00");
    await expect(page.getByLabel("Importo forfettario")).toHaveValue("45,00");

    await page.getByRole("button", { name: "Crea scaglione" }).click();

    // ── 5. Verifica il ritorno alla configurazione con il nuovo scaglione ──

    await page.waitForURL("**/anagrafiche/scaglioni?esito=creato");
    await expect(page.getByText("Scaglione creato e inserito nella configurazione")).toBeVisible();

    const tabella = page.locator("table[aria-label='Elenco scaglioni chilometrici']");
    await expect(
      tabella.locator("tbody tr").filter({ hasText: `fino a ${kmA} km` })
    ).toBeVisible();

    // ── 6. Apre il form per il secondo scaglione ────────────────────

    await page.getByRole("link", { name: "Nuovo scaglione" }).click();
    await page.waitForURL("**/anagrafiche/scaglioni/nuovo");
    await expect(
      page.getByRole("heading", { name: "Nuovo scaglione" })
    ).toBeVisible();

    // ── 7. Configura il secondo scaglione con soglia superiore ──────

    await page.getByLabel("Soglia massima").fill(String(kmB));
    await expect(page.getByLabel("Soglia massima")).toHaveValue(String(kmB));

    await page.getByLabel("Importo forfettario").fill("70,00");
    await expect(page.getByLabel("Importo forfettario")).toHaveValue("70,00");

    await page.getByRole("button", { name: "Crea scaglione" }).click();

    // ── 8. Rivede la configurazione salvata, ordinata per soglia ────

    await page.waitForURL("**/anagrafiche/scaglioni?esito=creato");
    await expect(page.getByText("Scaglione creato e inserito nella configurazione")).toBeVisible();

    const rigaA = tabella.locator("tbody tr").filter({ hasText: `fino a ${kmA} km` });
    const rigaB = tabella.locator("tbody tr").filter({ hasText: `fino a ${kmB} km` });

    await expect(rigaA).toBeVisible();
    await expect(rigaA.getByText(/45,00/)).toBeVisible();

    await expect(rigaB).toBeVisible();
    await expect(rigaB.getByText(/70,00/)).toBeVisible();
    await expect(rigaB.getByText(`Da ${kmA + 1} a ${kmB} km`)).toBeVisible();

    // ── 9. Mantieni lo stato finale visibile per almeno 1.5 secondi ─

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
