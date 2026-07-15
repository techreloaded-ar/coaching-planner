import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import { test, expect, type E2eDataFactory } from "./support/fixtures";

/**
 * Test e2e — US-007: Anagrafica clienti CRUD
 *
 * Gli scenari mutanti creano il cliente da modificare/disattivare prima di
 * agire, così non toccano DataFlow/TechSolutions o altri seed condivisi.
 */

function suffissoUnivoco(): string {
	return randomUUID().slice(0, 8);
}

async function creaClienteProprio(factory: E2eDataFactory) {
	const token = suffissoUnivoco();
	return factory.createCliente({
		ragioneSociale: `E2E Cliente Anagrafica ${token}`,
		citta: "Torino",
	});
}

function rigaCliente(page: Page, ragioneSociale: string) {
	return page
		.locator("table[aria-label='Elenco clienti'] tbody tr")
		.filter({ hasText: ragioneSociale })
		.first();
}

test.describe("Anagrafica clienti", () => {
	test.beforeEach(async ({ page }) => {
		await accediComeAdmin(page);
	});

	test("validazione campi obbligatori senza creazione", async ({ page }) => {
		await page.goto("/anagrafiche/clienti/nuovo");
		await expect(
			page.getByRole("heading", { name: "Nuovo cliente" }),
		).toBeVisible();

		await page.getByRole("button", { name: "Crea cliente" }).click();

		await expect(page.getByText(/Controlla i campi evidenziati/)).toBeVisible();
		await expect(
			page.getByText("La ragione sociale è obbligatoria"),
		).toBeVisible();
		await expect(page.getByText("La partita IVA è obbligatoria")).toBeVisible();
		await expect(page).toHaveURL(/\/anagrafiche\/clienti\/nuovo/);
	});

	test("modifica persistita dopo reload", async ({ page, factory }) => {
		const cliente = await creaClienteProprio(factory);
		await page.goto("/anagrafiche/clienti");
		await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();

		await rigaCliente(page, cliente.ragioneSociale)
			.getByRole("link", { name: "Modifica" })
			.click();

		await page.waitForURL(/\/anagrafiche\/clienti\/[^/]+\/modifica$/);
		await expect(
			page.getByRole("heading", { name: "Modifica cliente" }),
		).toBeVisible();

		const nuovaCitta = `TestCitta-${suffissoUnivoco()}`;
		await page.getByLabel(/Città/).fill(nuovaCitta);
		await page.getByRole("button", { name: "Salva modifiche" }).click();

		await page.waitForURL("**/anagrafiche/clienti?esito=salvato");
		await expect(rigaCliente(page, cliente.ragioneSociale).getByText(nuovaCitta)).toBeVisible();

		await page.reload();
		await page.waitForURL("**/anagrafiche/clienti**");
		await expect(rigaCliente(page, cliente.ragioneSociale).getByText(nuovaCitta)).toBeVisible();
	});

	test("cliente disattivato distinguibile nell'elenco", async ({ page, factory }) => {
		const cliente = await creaClienteProprio(factory);
		await page.goto("/anagrafiche/clienti");
		await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();

		const rigaAttiva = rigaCliente(page, cliente.ragioneSociale);
		await expect(rigaAttiva.getByText("Attivo")).toBeVisible();
		await rigaAttiva.getByRole("button", { name: "Disattiva" }).click();

		await page.waitForURL("**/anagrafiche/clienti");
		const rigaDisattivata = rigaCliente(page, cliente.ragioneSociale);
		await expect(rigaDisattivata.getByText("Disattivato")).toBeVisible();
		await expect(
			rigaDisattivata.getByRole("button", { name: "Riattiva" }),
		).toBeVisible();

		await rigaDisattivata.getByRole("button", { name: "Riattiva" }).click();
		await page.waitForURL("**/anagrafiche/clienti");
		await expect(rigaCliente(page, cliente.ragioneSociale).getByText("Attivo")).toBeVisible();
	});

	test("sidebar navigazione", async ({ page }) => {
		await page.goto("/anagrafiche/clienti");

		const clientiLink = page.getByRole("link", { name: "Clienti", exact: true });
		await expect(clientiLink).toHaveAttribute("aria-current", "page");

		const offerteLink = page.getByRole("link", { name: "Offerte", exact: true });
		await expect(offerteLink).toBeVisible();
		await expect(offerteLink).toHaveAttribute("href", "/offerte");

		const reportLink = page.getByRole("link", {
			name: "Fatturazione clienti",
			exact: true,
		});
		await expect(reportLink).toBeVisible();
		await expect(reportLink).toHaveAttribute(
			"href",
			"/report/fatturazione-clienti",
		);

		const collaboratoriLink = page.getByRole("link", {
			name: "Collaboratori",
			exact: true,
		});
		await expect(collaboratoriLink).toBeVisible();
		await expect(collaboratoriLink).toHaveAttribute(
			"href",
			"/anagrafiche/collaboratori",
		);

		const scaglioniLink = page.getByRole("link", {
			name: "Scaglioni km",
			exact: true,
		});
		await expect(scaglioniLink).toBeVisible();
		await expect(scaglioniLink).toHaveAttribute(
			"href",
			"/anagrafiche/scaglioni",
		);

	});

	test("redirect /anagrafiche → /anagrafiche/clienti", async ({ page }) => {
		await page.goto("/anagrafiche");
		await page.waitForURL("**/anagrafiche/clienti");
		await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();
	});
});
