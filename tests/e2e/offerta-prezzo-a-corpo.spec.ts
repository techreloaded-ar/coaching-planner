import { randomUUID } from "node:crypto";

import { accediComeAdmin } from "./support/auth";
import { cercaNellElenco } from "./support/elenchi";
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
		// Entrambi i valori, con l'icona sul valore calcolato (qui la tariffa)
		await expect(
			rigaOfferta.getByRole("img", { name: "Calcolata da offerta a corpo" }),
		).toBeVisible();
		await expect(rigaOfferta.getByRole("cell").nth(2)).toHaveText(/^666,67\s*€$/);
		await expect(rigaOfferta.getByRole("cell").nth(3)).toContainText(/10\.000,00\s*€/);
		await expect(
			rigaOfferta.getByRole("img", { name: "Calcolato da tariffa giornaliera" }),
		).toHaveCount(0);

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

	test("nell'elenco offerte un'offerta a giornata mostra la tariffa e l'importo totale calcolato", async ({
		page,
		factory,
	}) => {
		const token = randomUUID().slice(0, 8);
		const codice = `OFF-GIORNATA-${token}`.toUpperCase();
		await factory.createOfferta({ codice, tariffaGiornaliera: "650.00", giorniPrevisti: 15 });

		await page.goto("/offerte");
		await cercaNellElenco(page, "/offerte", codice);
		const riga = page.getByRole("row").filter({ hasText: codice });
		await expect(riga).toHaveCount(1);
		await expect(page.getByRole("columnheader", { name: "Importo totale" })).toBeVisible();
		const celle = riga.getByRole("cell");
		// La prima cella è la casella di selezione.
		await expect(celle.nth(3)).toHaveText(/^650,00\s*€$/);
		await expect(celle.nth(4)).toContainText(/9\.750,00\s*€/);
		await expect(celle.nth(4)).toContainText("Trasferta inclusa");
		await expect(
			celle.nth(4).getByRole("img", { name: "Calcolato da tariffa giornaliera" }),
		).toBeVisible();
	});
});
