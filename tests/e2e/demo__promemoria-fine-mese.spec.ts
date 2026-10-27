import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";

/**
 * Demo scenario — US-019: Promemoria email di fine mese.
 *
 * L'amministratore apre il report di fatturazione mensile, preme "Invia
 * promemoria di fine mese" e vede quante email sono partite e quante no.
 * In E2E_TEST_MODE nessuna email parte davvero e l'invio manuale non scrive
 * sul database: il numero di inviati dipende dai collaboratori attivi creati
 * dagli altri worker, quindi si verifica solo il formato dell'esito.
 *
 * Registra un video per la review.
 */

test.describe("US-019 Demo", () => {
  test("l'amministratore invia il promemoria di fine mese dal report di fatturazione", async ({
    page,
  }) => {
    // 1. Accede come amministratore e apre il report di fatturazione mensile
    await accediAlBackOfficeComeAdmin(page);
    await page.goto("/report/fatturazione-clienti");

    // 2. Il pulsante e l'avviso sui destinatari sono nell'intestazione
    const pulsante = page.getByRole("button", {
      name: "Invia promemoria di fine mese",
      exact: true,
    });
    await expect(pulsante).toBeVisible();
    await expect(
      page.getByText("Invia subito l'email a tutti i collaboratori attivi", { exact: true })
    ).toBeVisible();

    // 3. Invia il promemoria
    await pulsante.click();

    // 4. L'esito mostra le email inviate e quelle non riuscite
    await page.waitForURL(/promemoriaInviati=\d+/);
    await expect(
      page.getByRole("status").filter({ hasText: "Promemoria inviati" })
    ).toHaveText(/^Promemoria inviati: \d+\. Non riusciti: 0\.$/);
  });
});
