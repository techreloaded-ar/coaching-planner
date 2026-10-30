import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import { apriElencoFiltrato, cercaNellElenco } from "./support/elenchi";
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

/** URL dell'elenco clienti filtrato esattamente per `ricerca`, senza altri parametri. */
function urlConRicerca(ricerca: string): (url: URL) => boolean {
	return (url) =>
		url.pathname === "/anagrafiche/clienti" &&
		url.searchParams.get("q") === ricerca &&
		[...url.searchParams.keys()].length === 1;
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
		await expect(page.getByText(/La partita IVA/)).toHaveCount(0);
		await expect(page).toHaveURL(/\/anagrafiche\/clienti\/nuovo/);
	});

	test("crea un cliente con la sola ragione sociale", async ({ page, factory }) => {
		const ragioneSociale = `${factory.namespace} Solo Ragione Sociale`;
		await page.goto("/anagrafiche/clienti/nuovo");
		await page.getByLabel(/^Ragione sociale\b/).fill(ragioneSociale);
		await page.getByLabel(/^Partita IVA\b/).fill("12345");
		await page.getByRole("button", { name: "Crea cliente" }).click();
		await expect(
			page.getByText("La partita IVA deve essere di 11 cifre"),
		).toBeVisible();

		await page.getByLabel(/^Partita IVA\b/).fill("");
		await page.getByRole("button", { name: "Crea cliente" }).click();
		await expect(page).toHaveURL(/\/anagrafiche\/clienti\?esito=creato$/);

		await apriElencoFiltrato(page, "/anagrafiche/clienti", ragioneSociale);
		// Colonna P.IVA
		await expect(
			rigaCliente(page, ragioneSociale).getByRole("cell").nth(1),
		).toHaveText("—");

		// Anche il dettaglio cliente mostra «—» per la partita IVA assente.
		await rigaCliente(page, ragioneSociale)
			.getByRole("link", { name: ragioneSociale })
			.click();
		await expect(
			page.getByText("Partita IVA", { exact: true }).locator(".."),
		).toHaveText("Partita IVA—");
	});

	test("modifica persistita dopo reload", async ({ page, factory }) => {
		const cliente = await creaClienteProprio(factory);
		await apriElencoFiltrato(page, "/anagrafiche/clienti", cliente.ragioneSociale);
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
		// Il redirect riporta all'elenco non filtrato: il cliente può stare oltre
		// la prima pagina, quindi lo si cerca.
		await cercaNellElenco(page, "/anagrafiche/clienti", cliente.ragioneSociale);
		await expect(rigaCliente(page, cliente.ragioneSociale).getByText(nuovaCitta)).toBeVisible();

		await page.reload();
		await page.waitForURL("**/anagrafiche/clienti**");
		await expect(rigaCliente(page, cliente.ragioneSociale).getByText(nuovaCitta)).toBeVisible();
	});

	test("cliente disattivato distinguibile nell'elenco", async ({ page, factory }) => {
		const cliente = await creaClienteProprio(factory);
		await apriElencoFiltrato(page, "/anagrafiche/clienti", cliente.ragioneSociale);
		await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();

		const rigaAttiva = rigaCliente(page, cliente.ragioneSociale);
		await expect(rigaAttiva.getByText("Attivo")).toBeVisible();
		await rigaAttiva.getByRole("button", { name: "Disattiva" }).click();

		// L'azione riporta allo stesso elenco filtrato.
		await expect(page).toHaveURL(
			urlConRicerca(cliente.ragioneSociale),
		);
		const rigaDisattivata = rigaCliente(page, cliente.ragioneSociale);
		await expect(rigaDisattivata.getByText("Disattivato")).toBeVisible();
		await expect(
			rigaDisattivata.getByRole("button", { name: "Riattiva" }),
		).toBeVisible();

		await rigaDisattivata.getByRole("button", { name: "Riattiva" }).click();
		await expect(page).toHaveURL(urlConRicerca(cliente.ragioneSociale));
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

		const vociRimborsoLink = page.getByRole("link", {
			name: "Voci di rimborso",
			exact: true,
		});
		await expect(vociRimborsoLink).toBeVisible();
		await expect(vociRimborsoLink).toHaveAttribute(
			"href",
			"/anagrafiche/voci-rimborso",
		);

	});

	test("redirect /anagrafiche → /anagrafiche/clienti", async ({ page }) => {
		await page.goto("/anagrafiche");
		await page.waitForURL("**/anagrafiche/clienti");
		await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();
	});
});
