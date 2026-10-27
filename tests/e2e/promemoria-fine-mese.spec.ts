import { accediComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";

/**
 * Test e2e — US-019: invio manuale del promemoria di fine mese.
 *
 * L'invio manuale non scrive sul database e in E2E_TEST_MODE nessuna email
 * parte davvero; il numero di inviati dipende dai collaboratori creati dagli
 * altri worker, quindi si verifica solo il formato dell'esito.
 */

test("l'amministratore invia il promemoria di fine mese e vede l'esito", async ({ page }) => {
  await accediComeAdmin(page);
  await page.goto("/report/fatturazione-clienti");

  await page.getByRole("button", { name: "Invia promemoria di fine mese", exact: true }).click();

  await page.waitForURL(/promemoriaInviati=\d+/);
  await expect(page.getByRole("status").filter({ hasText: "Promemoria inviati" })).toHaveText(
    /^Promemoria inviati: \d+\. Non riusciti: 0\.$/
  );
});
