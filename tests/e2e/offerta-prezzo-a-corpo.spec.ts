import { randomUUID } from "node:crypto";

import { accediComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";

test.describe("Offerta a giornata o a corpo", () => {
	test.beforeEach(async ({ page }) => {
		await accediComeAdmin(page);
	});

	test("calcola importo totale e tariffa, salva l'offerta a corpo e la riapre a corpo", async ({
		page,
		factory,
	}) => {
		const token = randomUUID().slice(0, 8);
		const cliente = await factory.createCliente({
			ragioneSociale: `E2E Offerta A Corpo ${token}`,
		});
		const codice = `OFF-CORPO-${token}`.toUpperCase();

		await page.goto(`/anagrafiche/clienti/${cliente.id}/offerte/nuova`);
		await page.getByLabel("Codice").fill(codice);

		// A giornata: tariffa × giorni = importo totale, non modificabile
		const importoTotale = page.getByLabel("Importo totale");
		await expect(importoTotale).toHaveValue("—");
		await page.getByLabel("Tariffa giornaliera").fill("650,00");
		await page.getByLabel("Giorni previsti").fill("15");
		await expect(importoTotale).toHaveValue("9.750,00");
		await expect(importoTotale).not.toBeEditable();
		await expect(page.getByText("650,00 € × 15 gg", { exact: true })).toBeVisible();

		// A corpo: l'importo parte dal totale, la tariffa diventa calcolata
		await page.getByRole("radio", { name: "A corpo" }).check();
		const importoACorpo = page.getByLabel("Importo a corpo");
		await expect(importoACorpo).toHaveValue("9750,00");
		const tariffaCalcolata = page.getByLabel("Tariffa giornaliera");
		await expect(tariffaCalcolata).toHaveValue("650,00");
		await expect(tariffaCalcolata).not.toBeEditable();
		await expect(importoTotale).toHaveCount(0);

		await importoACorpo.fill("10000,00");
		await expect(tariffaCalcolata).toHaveValue("666,67");
		await expect(page.getByText("10.000,00 € ÷ 15 gg", { exact: true })).toBeVisible();

		await page.getByRole("button", { name: "Crea offerta" }).click();
		await page.waitForURL(/\?esito=offerta-creata$/);

		const rigaOfferta = page
			.getByRole("table", { name: "Offerte del cliente" })
			.getByRole("row")
			.filter({ hasText: codice });
		await expect(rigaOfferta).toContainText(/666,67\s*€/);

		await rigaOfferta.getByRole("link", { name: "Modifica" }).click();
		await page.waitForURL(/\/offerte\/[^/?]+(\?.*)?$/);
		await expect(page.getByRole("radio", { name: "A corpo" })).toBeChecked();
		await expect(page.getByLabel("Importo a corpo")).toHaveValue(/^10000(,00)?$/);
		await expect(page.getByLabel("Giorni previsti")).toHaveValue("15");
		await expect(page.getByLabel("Tariffa giornaliera")).toHaveValue("666,67");

		// Ritorno a giornata: la tariffa calcolata diventa modificabile
		await page.getByRole("radio", { name: "A giornata" }).check();
		const tariffa = page.getByLabel("Tariffa giornaliera");
		await expect(tariffa).toBeEditable();
		await expect(tariffa).toHaveValue("666,67");
		await expect(page.getByLabel("Importo totale")).toHaveValue("10.000,05");
	});
});
