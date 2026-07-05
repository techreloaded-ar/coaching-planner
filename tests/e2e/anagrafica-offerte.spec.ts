import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import { test, expect, type E2eDataFactory } from "./support/fixtures";

async function apriClienteProprio(page: Page, factory: E2eDataFactory) {
	const token = randomUUID().slice(0, 8);
	const cliente = await factory.createCliente({
		ragioneSociale: `E2E Offerte Cliente ${token}`,
	});

	await page.goto(`/anagrafiche/clienti/${cliente.id}`);
	await page.waitForURL(/\/anagrafiche\/clienti\/[^/]+$/);
	await expect(page.getByRole("link", { name: "Nuova offerta" })).toBeVisible();

	return cliente;
}

test.describe("Anagrafica offerte", () => {
	test.beforeEach(async ({ page }) => {
		await accediComeAdmin(page);
	});

	test("validazione di tariffa e giorni non positivi senza creazione", async ({
		page,
		factory,
	}) => {
		await apriClienteProprio(page, factory);
		await page.getByRole("link", { name: "Nuova offerta" }).click();
		await page.waitForURL(/\/offerte\/nuova$/);

		await page.getByLabel("Codice").fill(`OFF-VAL-${randomUUID().slice(0, 8)}`);
		await page.getByLabel("Descrizione").fill("Offerta di test validazione");
		await page.getByLabel("Tariffa giornaliera").fill("0");
		await page.getByLabel("Giorni previsti").fill("0");
		await page.getByRole("button", { name: "Crea offerta" }).click();

		await expect(
			page.getByText("La tariffa giornaliera deve essere maggiore di zero"),
		).toBeVisible();
		await expect(
			page.getByText("I giorni previsti devono essere maggiori di zero"),
		).toBeVisible();
		await expect(page).toHaveURL(/\/offerte\/nuova$/);
	});

	test("codice duplicato per lo stesso cliente rifiutato con messaggio sul campo", async ({
		page,
		factory,
	}) => {
		await apriClienteProprio(page, factory);
		const codice = `OFF-DUP-${randomUUID().slice(0, 8)}`;

		await page.getByRole("link", { name: "Nuova offerta" }).click();
		await page.getByLabel("Codice").fill(codice);
		await page.getByLabel("Descrizione").fill("Offerta originale");
		await page.getByLabel("Tariffa giornaliera").fill("650,00");
		await page.getByLabel("Giorni previsti").fill("5");
		await page.getByRole("button", { name: "Crea offerta" }).click();

		await page.waitForURL(/\?esito=offerta-creata$/);

		await page.getByRole("link", { name: "Nuova offerta" }).click();
		await page.getByLabel("Codice").fill(codice);
		await page.getByLabel("Descrizione").fill("Offerta duplicata");
		await page.getByLabel("Tariffa giornaliera").fill("700,00");
		await page.getByLabel("Giorni previsti").fill("8");
		await page.getByRole("button", { name: "Crea offerta" }).click();

		await expect(
			page.getByText(
				"Esiste già un'offerta con questo codice per questo cliente",
			),
		).toBeVisible();
		await expect(page).toHaveURL(/\/offerte\/nuova$/);
	});

	test("modifica persistita dopo reload", async ({ page, factory }) => {
		await apriClienteProprio(page, factory);
		const codice = `OFF-MOD-${randomUUID().slice(0, 8)}`;
		await page.getByRole("link", { name: "Nuova offerta" }).click();
		await page.getByLabel("Codice").fill(codice);
		await page.getByLabel("Descrizione").fill("Offerta da modificare");
		await page.getByLabel("Tariffa giornaliera").fill("600,00");
		await page.getByLabel("Giorni previsti").fill("4");
		await page.getByRole("button", { name: "Crea offerta" }).click();

		await page.waitForURL(/\?esito=offerta-creata$/);

		const rigaOfferta = page
			.locator("table[aria-label='Offerte del cliente'] tbody tr")
			.filter({ hasText: codice })
			.first();
		await rigaOfferta.getByRole("link", { name: "Modifica" }).click();

		await page.waitForURL(/\/offerte\/.+$/);
		await page.getByLabel("Descrizione").fill("Offerta aggiornata");
		await page.getByLabel("Tariffa giornaliera").fill("725,50");
		await page.getByRole("button", { name: "Salva offerta" }).click();

		await page.waitForURL(/\?esito=offerta-salvata$/);
		await expect(page.getByText("Offerta aggiornata")).toBeVisible();
		await expect(page.getByText(/725,50\s*€/)).toBeVisible();

		await page.reload();
		await expect(page.getByText("Offerta aggiornata")).toBeVisible();
		await expect(page.getByText(/725,50\s*€/)).toBeVisible();
	});

	test("elenco offerte con codice, descrizione, tariffa e giorni", async ({
		page,
		clienteConOfferta,
	}) => {
		await page.goto(`/anagrafiche/clienti/${clienteConOfferta.cliente.id}`);
		await page.waitForURL(/\/anagrafiche\/clienti\/[^/]+$/);

		await expect(
			page.getByRole("table", { name: "Offerte del cliente" }),
		).toBeVisible();
		await expect(page.getByRole("columnheader", { name: "Codice" })).toBeVisible();
		await expect(
			page.getByRole("columnheader", { name: "Descrizione" }),
		).toBeVisible();
		await expect(
			page.getByRole("columnheader", { name: "Tariffa giornaliera" }),
		).toBeVisible();
		await expect(
			page.getByRole("columnheader", { name: "Giorni previsti" }),
		).toBeVisible();
		await expect(
			page
				.locator("table[aria-label='Offerte del cliente'] tbody tr")
				.filter({ hasText: clienteConOfferta.offerta.codice })
				.first(),
		).toBeVisible();
	});
});
