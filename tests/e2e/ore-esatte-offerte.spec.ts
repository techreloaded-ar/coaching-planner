import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import {
	apriPaginaOfferte,
	attendiTabellaOfferteClienteIdratata,
} from "./support/offerte";

/**
 * 16 righe a due decimali che sommano esattamente 80,00 ore (10 giornate).
 * Sommate in virgola mobile danno 79,99999999999999: prima della correzione
 * l'offerta risultava «In allerta» invece di «Esaurita».
 */
const ORE_CHE_SOMMANO_80 = [
	"7.31", "6.26", "4.80", "6.41", "2.03", "2.65", "1.82", "7.53",
	"7.61", "4.87", "6.99", "1.01", "5.03", "7.19", "4.46", "4.03",
];

function rigaOfferta(page: Page, codice: string): Locator {
	return page.getByRole("row", { name: new RegExp(codice) });
}

function dettaglioOfferta(page: Page, codice: string): Locator {
	return page.getByRole("region", { name: `Dettaglio avanzamento ${codice}` });
}

test.describe("Ore sommate in modo esatto (US-003)", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("un'offerta che consuma esattamente il budget è Esaurita, un centesimo in più è Oltre budget", async ({
		page,
		factory,
	}) => {
		const token = randomUUID().slice(0, 8).toUpperCase();
		const cliente = await factory.createCliente({
			ragioneSociale: `E2E Ore esatte ${token}`,
		});
		const collaboratore = await factory.createCollaboratore();
		const codiceEsatta = `E2E-ORE-${token}-ESATTA`;
		const codiceOltre = `E2E-ORE-${token}-OLTRE`;

		for (const [codice, ore] of [
			[codiceEsatta, ORE_CHE_SOMMANO_80],
			[codiceOltre, [...ORE_CHE_SOMMANO_80, "0.01"]],
		] as const) {
			const offerta = await factory.createOfferta({ cliente, codice, giorniPrevisti: 10 });
			for (const valore of ore) {
				await factory.createRigaAttivita({
					cliente,
					offerta,
					collaboratore,
					ore: valore,
					categoria: "FATTURABILE",
				});
			}
		}

		// Elenco trasversale: entrambe critiche, contate nella pill e con il badge giusto.
		await apriPaginaOfferte(page, cliente.ragioneSociale);
		await expect(page.getByText("2 da presidiare")).toBeVisible();
		const rigaEsatta = rigaOfferta(page, codiceEsatta);
		await expect(rigaEsatta.getByText("Esaurita", { exact: true })).toBeVisible();
		await expect(rigaEsatta.getByText("Oltre budget", { exact: true })).toHaveCount(0);
		await expect(
			rigaOfferta(page, codiceOltre).getByText("Oltre budget", { exact: true }),
		).toBeVisible();

		await rigaEsatta
			.getByRole("button", { name: `Dettaglio avanzamento ${codiceEsatta}` })
			.click();
		await expect(
			dettaglioOfferta(page, codiceEsatta).getByText("Esaurita", { exact: true }),
		).toBeVisible();

		// Scheda cliente: stesso esito nel dettaglio avanzamento.
		await page.goto(`/anagrafiche/clienti/${cliente.id}`);
		await attendiTabellaOfferteClienteIdratata(page);
		await rigaOfferta(page, codiceEsatta)
			.getByRole("button", { name: `Dettaglio avanzamento ${codiceEsatta}` })
			.click();
		await expect(
			dettaglioOfferta(page, codiceEsatta).getByText("Esaurita", { exact: true }),
		).toBeVisible();
	});
});
