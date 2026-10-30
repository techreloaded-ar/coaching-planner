import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import {
	apriElencoFiltrato,
	barraSelezione,
	casellaSelezione,
	cercaNellElenco,
	selezionaRighe,
} from "./support/elenchi";
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

async function creaClienteProprio(
	factory: E2eDataFactory,
	{ token = suffissoUnivoco(), attivo = true }: { token?: string; attivo?: boolean } = {},
) {
	return factory.createCliente({
		ragioneSociale: `E2E Cliente Anagrafica ${token} ${suffissoUnivoco()}`,
		citta: "Torino",
		attivo,
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
		await expect(page.getByText("La partita IVA è obbligatoria")).toBeVisible();
		await expect(page).toHaveURL(/\/anagrafiche\/clienti\/nuovo/);
	});

	test("modifica persistita dopo reload", async ({ page, factory }) => {
		const cliente = await creaClienteProprio(factory);
		await apriElencoFiltrato(page, "/anagrafiche/clienti", cliente.ragioneSociale);
		await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();

		const barra = await selezionaRighe(page, [cliente.ragioneSociale]);
		await expect(barra).toContainText("1 cliente selezionato");
		await barra.getByRole("link", { name: "Modifica", exact: true }).click();

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

		const riga = rigaCliente(page, cliente.ragioneSociale);
		await expect(riga.getByText("Attivo", { exact: true })).toBeVisible();

		const barra = await selezionaRighe(page, [cliente.ragioneSociale]);
		await barra.getByRole("button", { name: "Disattiva", exact: true }).click();
		const dialog = page.getByRole("dialog", {
			name: `Disattivare «${cliente.ragioneSociale}»?`,
		});
		await expect(dialog).toBeVisible();
		await dialog.getByRole("button", { name: "Disattiva", exact: true }).click();

		// L'azione riporta allo stesso elenco filtrato e azzera la selezione.
		await expect(page).toHaveURL(urlConRicerca(cliente.ragioneSociale));
		await expect(riga.getByText("Disattivato", { exact: true })).toBeVisible();
		await expect(barraSelezione(page)).toBeHidden();
		await expect(page.getByRole("searchbox", { name: "Cerca cliente" })).toBeVisible();
		await expect(casellaSelezione(page, cliente.ragioneSociale)).not.toBeChecked();

		// La riattivazione non chiede conferma.
		const barraRiattiva = await selezionaRighe(page, [cliente.ragioneSociale]);
		await barraRiattiva.getByRole("button", { name: "Riattiva", exact: true }).click();
		await expect(page).toHaveURL(urlConRicerca(cliente.ragioneSociale));
		await expect(riga.getByText("Attivo", { exact: true })).toBeVisible();
		await expect(barraSelezione(page)).toBeHidden();
	});

	test("selezione mista: azioni con conteggio, conferma e annullamento", async ({
		page,
		factory,
	}) => {
		const token = suffissoUnivoco();
		const primo = await creaClienteProprio(factory, { token });
		const secondo = await creaClienteProprio(factory, { token });
		const disattivato = await creaClienteProprio(factory, { token, attivo: false });
		const ricerca = `E2E Cliente Anagrafica ${token}`;
		await apriElencoFiltrato(page, "/anagrafiche/clienti", ricerca);

		const barra = await selezionaRighe(page, [
			primo.ragioneSociale,
			secondo.ragioneSociale,
			disattivato.ragioneSociale,
		]);
		await expect(barra).toContainText("3 clienti selezionati");
		await expect(barra.getByRole("button", { name: "Disattiva (2)", exact: true })).toBeVisible();
		await expect(barra.getByRole("button", { name: "Riattiva (1)", exact: true })).toBeVisible();
		await expect(barra.getByRole("link", { name: "Modifica" })).toHaveCount(0);

		// Annulla nel dialog: nessun cambiamento, la selezione resta.
		await barra.getByRole("button", { name: "Disattiva (2)", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Disattivare 2 clienti?" });
		await expect(dialog).toBeVisible();
		await dialog.getByRole("button", { name: "Annulla", exact: true }).click();
		await expect(dialog).toBeHidden();
		await expect(barra).toContainText("3 clienti selezionati");
		await expect(
			rigaCliente(page, primo.ragioneSociale).getByText("Attivo", { exact: true }),
		).toBeVisible();

		// Conferma: disattiva solo i due clienti attivi.
		await barra.getByRole("button", { name: "Disattiva (2)", exact: true }).click();
		await dialog.getByRole("button", { name: "Disattiva", exact: true }).click();
		await expect(page).toHaveURL(urlConRicerca(ricerca));
		for (const cliente of [primo, secondo, disattivato]) {
			await expect(
				rigaCliente(page, cliente.ragioneSociale).getByText("Disattivato", { exact: true }),
			).toBeVisible();
		}
		await expect(barraSelezione(page)).toBeHidden();
	});

	test("Seleziona tutti e Annulla selezione", async ({ page, factory }) => {
		const token = suffissoUnivoco();
		const primo = await creaClienteProprio(factory, { token });
		const secondo = await creaClienteProprio(factory, { token });
		await apriElencoFiltrato(page, "/anagrafiche/clienti", `E2E Cliente Anagrafica ${token}`);

		// La prima selezione passa dall'helper (idratazione), poi si deseleziona.
		await selezionaRighe(page, [primo.ragioneSociale]);
		await casellaSelezione(page, primo.ragioneSociale).uncheck();
		await expect(barraSelezione(page)).toBeHidden();

		await page.getByRole("checkbox", { name: "Seleziona tutti", exact: true }).check();
		const barra = barraSelezione(page);
		await expect(barra).toContainText("2 clienti selezionati");
		await expect(casellaSelezione(page, primo.ragioneSociale)).toBeChecked();
		await expect(casellaSelezione(page, secondo.ragioneSociale)).toBeChecked();

		await barra.getByRole("button", { name: "Annulla selezione", exact: true }).click();
		await expect(barra).toBeHidden();
		await expect(page.getByRole("searchbox", { name: "Cerca cliente" })).toBeVisible();
		await expect(casellaSelezione(page, primo.ragioneSociale)).not.toBeChecked();
		await expect(casellaSelezione(page, secondo.ragioneSociale)).not.toBeChecked();
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
