import { test, expect } from "@playwright/test";

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-008 Demo", () => {
  test("l'amministratore apre un cliente, aggiunge un'offerta e vede l'elenco aggiornato", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Accedi" })).toBeVisible();

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

    await page
      .locator("nav[aria-label='Navigazione principale'] a")
      .filter({ hasText: /^Clienti$/ })
      .click();

    await page.waitForURL("**/anagrafiche/clienti");
    await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();

    const rigaCliente = page
      .locator("table[aria-label='Elenco clienti'] tbody tr")
      .filter({ has: page.getByRole("button", { name: "Disattiva" }) })
      .first();

    const clienteLink = rigaCliente.locator("td").first().getByRole("link");

    await clienteLink.click();
    await page.waitForURL(/\/anagrafiche\/clienti\/[^/]+$/);
    await expect(page.getByRole("link", { name: "Nuova offerta" })).toBeVisible();

    await page.getByRole("link", { name: "Nuova offerta" }).click();
    await page.waitForURL(/\/offerte\/nuova$/);

    const codice = `OFF-DEMO-${Date.now()}`;
    await page.getByLabel("Codice").fill(codice);
    await page.getByLabel("Descrizione").fill("Percorso di coaching executive");
    await page.getByLabel("Tariffa giornaliera").fill("680,00");
    await page.getByLabel("Giorni previsti").fill("12");

    await page.getByRole("button", { name: "Crea offerta" }).click();

    await page.waitForURL(/\?esito=offerta-creata$/);
    await expect(page.getByText("Offerta creata correttamente")).toBeVisible();
    await expect(page.getByRole("table", { name: "Offerte del cliente" })).toBeVisible();

    const rigaOfferta = page
      .locator("table[aria-label='Offerte del cliente'] tbody tr")
      .filter({ hasText: codice })
      .first();

    await expect(rigaOfferta).toContainText(codice);
    await expect(rigaOfferta).toContainText("Percorso di coaching executive");
    await expect(rigaOfferta).toContainText(/680,00\s*€/);

    await page.waitForTimeout(1500);
  });
});
