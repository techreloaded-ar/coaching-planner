import { randomUUID } from "node:crypto";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";

test.use({
	video: "on",
	viewport: { width: 1280, height: 720 },
	launchOptions: { slowMo: 300 },
});

test.describe("US-008 Demo", () => {
	test("l'amministratore apre un cliente, aggiunge un'offerta e vede l'elenco aggiornato", async ({
		page,
		factory,
	}) => {
		test.setTimeout(60_000);
		const token = randomUUID().slice(0, 8).toUpperCase();
		const cliente = await factory.createCliente({
			ragioneSociale: `E2E Demo Offerte Cliente ${token}`,
		});

		await accediAlBackOfficeComeAdmin(page);

		await page.getByRole("link", { name: "Clienti", exact: true }).click();
		await page.waitForURL("**/anagrafiche/clienti");
		await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();

		const rigaCliente = page
			.locator("table[aria-label='Elenco clienti'] tbody tr")
			.filter({ hasText: cliente.ragioneSociale })
			.first();
		await rigaCliente.locator("td").first().getByRole("link").click();
		await page.waitForURL(/\/anagrafiche\/clienti\/[^/]+$/);
		await expect(page.getByRole("link", { name: "Nuova offerta" })).toBeVisible();

		await page.getByRole("link", { name: "Nuova offerta" }).click();
		await page.waitForURL(/\/offerte\/nuova$/);

		const codice = `OFF-DEMO-${token}`;
		await page.getByLabel("Codice").fill(codice);
		await page.getByLabel("Descrizione").fill("Percorso di coaching executive");
		await page.getByLabel("Tariffa giornaliera").fill("680,00");
		await page.getByLabel("Giorni previsti").fill("12");

		await page.getByRole("button", { name: "Crea offerta" }).click();

		await page.waitForURL(/\?esito=offerta-creata$/);
		await expect(page.getByText("Offerta creata correttamente")).toBeVisible();
		await expect(
			page.getByRole("table", { name: "Offerte del cliente" }),
		).toBeVisible();

		const rigaOfferta = page
			.locator("table[aria-label='Offerte del cliente'] tbody tr")
			.filter({ hasText: codice })
			.first();

		await expect(rigaOfferta).toContainText(codice);
		await expect(rigaOfferta).toContainText("Percorso di coaching executive");
		await expect(rigaOfferta).toContainText(/680,00\s*€/);

		// Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
		await page.waitForTimeout(1500);
	});
});
