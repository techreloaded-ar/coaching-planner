import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { apriElencoFiltrato } from "./support/elenchi";
import { test, expect } from "./support/fixtures";

/**
 * Test e2e — gestione trasferte dell'offerta: inclusa nella tariffa oppure
 * forfettaria con importo per giorno di trasferta.
 */

function rigaOffertaCliente(page: Page, codice: string): Locator {
	return page
		.locator("table[aria-label='Offerte del cliente'] tbody tr")
		.filter({ hasText: codice });
}

function radioInclusa(page: Page): Locator {
	return page.getByRole("radio", { name: /^Inclusa nella tariffa/ });
}

function radioForfettaria(page: Page): Locator {
	return page.getByRole("radio", { name: /^Forfettaria/ });
}

function campoImporto(page: Page): Locator {
	return page.getByLabel("Importo forfettario per giorno di trasferta");
}

test.describe("Gestione trasferte dell'offerta", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("crea un'offerta forfettaria, la passa a inclusa e azzera l'importo", async ({
		page,
		factory,
	}) => {
		const cliente = await factory.createCliente({
			ragioneSociale: `E2E Trasferte ${randomUUID().slice(0, 8)}`,
		});
		const codice = `E2E-TRASF-${randomUUID().slice(0, 8)}`.toUpperCase();

		await page.goto(`/anagrafiche/clienti/${cliente.id}/offerte/nuova`);
		await expect(radioInclusa(page)).toBeChecked();
		await expect(campoImporto(page)).toBeHidden();

		await page.getByLabel("Codice").fill(codice);
		await page.getByLabel("Descrizione").fill("Offerta con trasferte");
		await page.getByLabel("Tariffa giornaliera").fill("640,00");
		await page.getByLabel("Giorni previsti").fill("10");
		await radioForfettaria(page).check();
		await expect(campoImporto(page)).toBeVisible();

		// Importo mancante: errore sul campo, scelta e valori conservati
		await page.getByRole("button", { name: "Crea offerta" }).click();
		await expect(
			page.getByText("L'importo forfettario per giorno di trasferta è obbligatorio"),
		).toBeVisible();
		await expect(page).toHaveURL(/\/offerte\/nuova$/);
		await expect(radioForfettaria(page)).toBeChecked();
		await expect(page.getByLabel("Codice")).toHaveValue(codice);

		// Importo non valido
		await campoImporto(page).fill("0");
		await page.getByRole("button", { name: "Crea offerta" }).click();
		await expect(
			page.getByText("L'importo forfettario deve essere maggiore di zero"),
		).toBeVisible();
		await expect(campoImporto(page)).toHaveValue("0");

		await campoImporto(page).fill("80,00");
		await page.getByRole("button", { name: "Crea offerta" }).click();
		await page.waitForURL(/\?esito=offerta-creata$/);
		await expect(
			rigaOffertaCliente(page, codice).getByText(/^Trasferta forfettaria · 80,00\s*€\/gg$/),
		).toBeVisible();

		// Passa a "Inclusa nella tariffa"
		await rigaOffertaCliente(page, codice).getByRole("link", { name: "Modifica" }).click();
		await page.waitForURL(/\/offerte\/[^/]+$/);
		await expect(radioForfettaria(page)).toBeChecked();
		await expect(campoImporto(page)).toHaveValue("80");
		await radioInclusa(page).check();
		await expect(campoImporto(page)).toBeHidden();
		await page.getByRole("button", { name: "Salva offerta" }).click();
		await page.waitForURL(/\?esito=offerta-salvata$/);
		await expect(
			rigaOffertaCliente(page, codice).getByText("Trasferta inclusa", { exact: true }),
		).toBeVisible();

		// L'importo forfettario è stato azzerato
		await rigaOffertaCliente(page, codice).getByRole("link", { name: "Modifica" }).click();
		await page.waitForURL(/\/offerte\/[^/]+$/);
		await expect(radioInclusa(page)).toBeChecked();
		await radioForfettaria(page).check();
		await expect(campoImporto(page)).toHaveValue("");
	});

	test("l'elenco offerte mostra la gestione trasferte di ogni offerta", async ({
		page,
		factory,
	}) => {
		const cliente = await factory.createCliente({
			ragioneSociale: `E2E Trasferte scheda ${randomUUID().slice(0, 8)}`,
		});
		const forfettaria = await factory.createOfferta({
			cliente,
			gestioneTrasferta: "FORFETTARIA",
			importoTrasfertaForfettaria: "95.50",
		});
		const inclusa = await factory.createOfferta({ cliente });

		await apriElencoFiltrato(page, "/offerte", cliente.ragioneSociale);
		const righe = page.locator("table[aria-label='Elenco offerte'] tbody tr");

		await expect(
			righe
				.filter({ hasText: forfettaria.codice })
				.getByText(/^Trasferta forfettaria · 95,50\s*€\/gg$/),
		).toBeVisible();
		await expect(
			righe
				.filter({ hasText: inclusa.codice })
				.getByText("Trasferta inclusa", { exact: true }),
		).toBeVisible();
	});
});
