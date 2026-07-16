import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";

/** Escape per usare un valore come frammento letterale in una RegExp. */
function comeRegExp(valore: string): RegExp {
	return new RegExp(valore.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

/**
 * Naviga alla pagina Offerte cliccando la voce di menu (non via URL diretto) e
 * attende in modo web-first che la tabella trasversale sia montata.
 */
async function apriPaginaOfferte(page: Page): Promise<void> {
	const navigazione = page.getByRole("navigation", {
		name: "Navigazione principale",
	});
	await navigazione
		.getByRole("link", { name: "Offerte", exact: true })
		.click();

	await page.waitForURL("**/offerte");
	await expect(page.getByRole("table", { name: "Elenco offerte" })).toBeVisible();
}

test.describe("Pagina offerte trasversale", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("elenca l'offerta con avanzamento: erogate e residuo coerenti", async ({
		page,
		factory,
	}) => {
		const token = randomUUID().slice(0, 8);
		const codice = `OFF-XREF-${token.toUpperCase()}`;
		const ragioneSociale = `E2E XRef Cliente ${token}`;
		const descrizione = `Offerta trasversale ${token}`;

		const { offerta } = await factory.createClienteConOfferta(
			{ ragioneSociale },
			{
				codice,
				descrizione,
				tariffaGiornaliera: "750.00",
				giorniPrevisti: 10,
			},
		);
		// 16 ore fatturabili = 2 giornate erogate (ORE_PER_GIORNATA = 8).
		await factory.createRigaAttivita({
			offerta,
			ore: "16.00",
			fatturabile: true,
		});

		await apriPaginaOfferte(page);

		const riga = page.getByRole("row", { name: comeRegExp(codice) });
		await expect(riga).toBeVisible();
		await expect(riga).toContainText(ragioneSociale);
		await expect(riga).toContainText(descrizione);
		await expect(riga).toContainText("750,00");

		const celle = riga.getByRole("cell");
		await expect(celle.nth(3)).toHaveText(/^10\s*gg$/); // giorni previsti
		await expect(celle.nth(4)).toHaveText(/^2\s*gg$/); // erogate
		await expect(celle.nth(5)).toHaveText(/^8\s*gg$/); // residuo

		await expect(riga.getByText("Attiva", { exact: true })).toBeVisible();
	});

	test("evidenzia offerte non attive ed esaurite con badge e flag dedicati", async ({
		page,
		factory,
	}) => {
		const token = randomUUID().slice(0, 8);

		const codiceNonAttiva = `OFF-OFF-${token.toUpperCase()}`;
		await factory.createOfferta({
			codice: codiceNonAttiva,
			descrizione: `Offerta disattivata ${token}`,
			attiva: false,
		});

		const codiceEsaurita = `OFF-END-${token.toUpperCase()}`;
		const offertaEsaurita = await factory.createOfferta({
			codice: codiceEsaurita,
			descrizione: `Offerta esaurita ${token}`,
			giorniPrevisti: 2,
			attiva: true,
		});
		// 16 ore fatturabili su 2 giornate previste = residuo 0 → Esaurita.
		await factory.createRigaAttivita({
			offerta: offertaEsaurita,
			ore: "16.00",
			fatturabile: true,
		});

		await apriPaginaOfferte(page);

		const rigaNonAttiva = page.getByRole("row", {
			name: comeRegExp(codiceNonAttiva),
		});
		await expect(rigaNonAttiva).toBeVisible();
		await expect(
			rigaNonAttiva.getByText("Non attiva", { exact: true }),
		).toBeVisible();

		const rigaEsaurita = page.getByRole("row", {
			name: comeRegExp(codiceEsaurita),
		});
		await expect(rigaEsaurita).toBeVisible();
		await expect(
			rigaEsaurita.getByText("Esaurita", { exact: true }),
		).toBeVisible();
		await expect(
			rigaEsaurita.getByText("Attiva", { exact: true }),
		).toBeVisible();
	});
});
