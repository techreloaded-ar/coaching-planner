import { test, expect } from "@playwright/test";

/**
 * Test e2e — US-015: Report mensile degli importi da fatturare per cliente.
 *
 * Scenari (senza video):
 * - Navigazione mese: il report riflette il mese selezionato (precedente/corrente).
 * - Mese vuoto: un mese senza attività mostra lo stato vuoto.
 */

test.describe("Report fatturazione clienti", () => {
  test.beforeEach(async ({ page }) => {
    // Accedi come amministratore tramite endpoint e2e
    await page.goto("/login");
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
    await page.waitForURL("**/anagrafiche**");
  });

  test("il report riflette il mese selezionato tra precedente e corrente", async ({
    page,
  }) => {
    await page.goto("/report/fatturazione-clienti");

    // Mese corrente: dati seed presenti
    await expect(page.getByText("TechSolutions Srl")).toBeVisible();

    const etichettaMese = page.locator("div.min-w-\\[188px\\]");
    const etichettaCorrente = (await etichettaMese.textContent())?.trim();

    // Mese precedente: nessun dato seed → stato vuoto, etichetta diversa
    await page.getByRole("link", { name: "Mese precedente" }).click();
    await page.waitForURL(/\/report\/fatturazione-clienti\?mese=/);

    const etichettaPrecedente = (await etichettaMese.textContent())?.trim();
    expect(etichettaPrecedente).not.toBe(etichettaCorrente);

    await expect(
      page.getByRole("heading", {
        name: "Nessuna attività da fatturare per questo mese",
      }),
    ).toBeVisible();
    await expect(page.getByText("TechSolutions Srl")).toHaveCount(0);

    // Ritorno al mese corrente: i dati ricompaiono e l'etichetta torna quella iniziale
    await page.getByRole("link", { name: "Mese corrente" }).click();
    await page.waitForURL("**/report/fatturazione-clienti");
    await expect(page.getByText("TechSolutions Srl")).toBeVisible();
    expect((await etichettaMese.textContent())?.trim()).toBe(etichettaCorrente);
  });

  test("un mese senza attività mostra lo stato vuoto", async ({ page }) => {
    await page.goto("/report/fatturazione-clienti?mese=2020-01");

    await expect(
      page.getByRole("heading", {
        name: "Nessuna attività da fatturare per questo mese",
      }),
    ).toBeVisible();
    await expect(page.getByText("TechSolutions Srl")).toHaveCount(0);
  });
});
