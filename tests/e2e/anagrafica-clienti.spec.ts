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
import { apriPaginaOfferte } from "./support/offerte";

/**
 * Test e2e — US-007: Anagrafica clienti CRUD
 *
 * Gli scenari mutanti creano clienti e offerte propri prima di agire, così
 * non toccano DataFlow/TechSolutions o altri seed condivisi. Lo stato del
 * cliente è derivato dalle offerte (attivo, nuovo, non attivo).
 */

function suffissoUnivoco(): string {
	return randomUUID().slice(0, 8);
}

async function creaClienteProprio(
	factory: E2eDataFactory,
	{ token = suffissoUnivoco() }: { token?: string } = {},
) {
	return factory.createCliente({
		ragioneSociale: `E2E Cliente Anagrafica ${token} ${suffissoUnivoco()}`,
		citta: "Torino",
	});
}

/** URL dell'elenco clienti con il solo filtro `stato` indicato. */
function urlConStato(stato: string): (url: URL) => boolean {
	return (url) =>
		url.pathname === "/anagrafiche/clienti" &&
		url.searchParams.get("stato") === stato &&
		!url.searchParams.has("q");
}

/** Opzione del quick filter per stato; il nome include il conteggio. */
function opzioneFiltro(page: Page, etichetta: "Attivi" | "Nuovi" | "Non attivi") {
	return page
		.getByRole("group", { name: "Filtra per stato" })
		.getByRole("button", { name: new RegExp(`^${etichetta}\\s*\\d+$`) });
}

function rigaCliente(page: Page, ragioneSociale: string) {
	return page
		.locator("table[aria-label='Elenco clienti'] tbody tr")
		.filter({ hasText: ragioneSociale })
		.first();
}

/** Chip dello stato derivato nella colonna «Offerte» della riga. */
function chipCliente(page: Page, ragioneSociale: string) {
	return rigaCliente(page, ragioneSociale).getByRole("cell").nth(4);
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
			rigaCliente(page, ragioneSociale).getByRole("cell").nth(2),
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

	test("stato derivato dalle offerte: chip in elenco, scheda e modifica", async ({
		page,
		factory,
	}) => {
		const token = suffissoUnivoco();
		const attivo = await creaClienteProprio(factory, { token });
		await factory.createOfferta({ cliente: attivo, attiva: true });
		await factory.createOfferta({ cliente: attivo, attiva: true });
		await factory.createOfferta({ cliente: attivo, attiva: false });
		const nuovo = await creaClienteProprio(factory, { token });
		const nonAttivo = await creaClienteProprio(factory, { token });
		await factory.createOfferta({ cliente: nonAttivo, attiva: false });
		await factory.createOfferta({ cliente: nonAttivo, attiva: false });

		await apriElencoFiltrato(page, "/anagrafiche/clienti", `E2E Cliente Anagrafica ${token}`);
		await expect(page.getByRole("columnheader", { name: "Offerte", exact: true })).toBeVisible();
		await expect(chipCliente(page, attivo.ragioneSociale)).toHaveText("2 attive");
		await expect(chipCliente(page, nuovo.ragioneSociale)).toHaveText("Nuovo");
		await expect(chipCliente(page, nonAttivo.ragioneSociale)).toHaveText("2 chiuse");

		// Con la ricerca i conteggi riguardano solo l'insieme cercato.
		await expect(page.getByText("La ricerca include tutti gli stati")).toBeVisible();
		await expect(opzioneFiltro(page, "Attivi")).toHaveText(/^Attivi\s*1$/);
		await expect(opzioneFiltro(page, "Nuovi")).toHaveText(/^Nuovi\s*1$/);
		await expect(opzioneFiltro(page, "Non attivi")).toHaveText(/^Non attivi\s*1$/);

		for (const [cliente, etichetta] of [
			[attivo, "2 attive"],
			[nuovo, "Nuovo"],
			[nonAttivo, "2 chiuse"],
		] as const) {
			await page.goto(`/anagrafiche/clienti/${cliente.id}`);
			await expect(
				page.getByRole("heading", { level: 1, name: cliente.ragioneSociale }),
			).toContainText(etichetta);
		}

		await page.goto(`/anagrafiche/clienti/${nonAttivo.id}/modifica`);
		await expect(page.getByText(/^Stato attuale:/)).toContainText("2 chiuse");
	});

	test("disattivare l'ultima offerta attiva rende il cliente non attivo", async ({
		page,
		factory,
	}) => {
		const codice = `E2E-STATO-${suffissoUnivoco()}`.toUpperCase();
		const cliente = await creaClienteProprio(factory);
		await factory.createOfferta({ cliente, codice, attiva: true });

		await apriElencoFiltrato(page, "/anagrafiche/clienti", cliente.ragioneSociale);
		await expect(chipCliente(page, cliente.ragioneSociale)).toHaveText("1 attiva");

		await apriPaginaOfferte(page, codice);
		const barra = await selezionaRighe(page, [codice]);
		await barra.getByRole("button", { name: "Disattiva", exact: true }).click();
		await page
			.getByRole("dialog", { name: `Disattivare «${codice}»?` })
			.getByRole("button", { name: "Disattiva", exact: true })
			.click();
		await page.waitForURL(
			(url) =>
				url.pathname === "/offerte" &&
				url.searchParams.get("esito") === "stato-offerta-aggiornato",
		);

		await apriElencoFiltrato(page, "/anagrafiche/clienti", cliente.ragioneSociale);
		await expect(chipCliente(page, cliente.ragioneSociale)).toHaveText("1 chiusa");
		await expect(opzioneFiltro(page, "Non attivi")).toHaveText(/^Non attivi\s*1$/);
		await expect(opzioneFiltro(page, "Attivi")).toHaveText(/^Attivi\s*0$/);
	});

	test("quick filter per stato: predefinito, URL, reload e ricerca su tutti gli stati", async ({
		page,
		factory,
	}) => {
		const token = suffissoUnivoco();
		const nonAttivo = await creaClienteProprio(factory, { token });
		await factory.createOfferta({ cliente: nonAttivo, attiva: false });
		const nuovo = await creaClienteProprio(factory, { token });
		const tabella = page.getByRole("table", { name: "Elenco clienti" });
		// Senza ricerca l'elenco è condiviso e paginato: si verifica che nessuna
		// riga visibile abbia uno stato escluso dal filtro, mai la presenza.
		const celleChiuse = tabella.getByRole("cell", { name: /^\d+ chius[ae]$/ });
		const celleAttiveONuove = tabella.getByRole("cell", {
			name: /^(Nuovo|\d+ attiv[ae])$/,
		});

		// Apertura: predefiniti Attivi + Nuovi, nessun cliente non attivo.
		await page.goto("/anagrafiche/clienti");
		await expect(opzioneFiltro(page, "Attivi")).toHaveAttribute("aria-pressed", "true");
		await expect(opzioneFiltro(page, "Nuovi")).toHaveAttribute("aria-pressed", "true");
		await expect(opzioneFiltro(page, "Non attivi")).toHaveAttribute("aria-pressed", "false");
		await expect(page.getByText("La ricerca include tutti gli stati")).toHaveCount(0);
		await expect(celleChiuse).toHaveCount(0);
		await expect(rigaCliente(page, nonAttivo.ragioneSociale)).toHaveCount(0);

		// Aggiungere «Non attivi» porta lo stato nell'URL e sopravvive al reload.
		await opzioneFiltro(page, "Non attivi").click();
		await page.waitForURL(urlConStato("attivi,nuovi,non-attivi"));
		await expect(opzioneFiltro(page, "Non attivi")).toHaveAttribute("aria-pressed", "true");
		await page.reload();
		await expect(opzioneFiltro(page, "Attivi")).toHaveAttribute("aria-pressed", "true");
		await expect(opzioneFiltro(page, "Nuovi")).toHaveAttribute("aria-pressed", "true");
		await expect(opzioneFiltro(page, "Non attivi")).toHaveAttribute("aria-pressed", "true");

		// Solo «Non attivi»: nessuna riga attiva o nuova.
		await opzioneFiltro(page, "Attivi").click();
		await page.waitForURL(urlConStato("nuovi,non-attivi"));
		await expect(opzioneFiltro(page, "Attivi")).toHaveAttribute("aria-pressed", "false");
		await opzioneFiltro(page, "Nuovi").click();
		await page.waitForURL(urlConStato("non-attivi"));
		await expect(opzioneFiltro(page, "Attivi")).toHaveAttribute("aria-pressed", "false");
		await expect(opzioneFiltro(page, "Nuovi")).toHaveAttribute("aria-pressed", "false");
		await expect(opzioneFiltro(page, "Non attivi")).toHaveAttribute("aria-pressed", "true");
		await expect(celleAttiveONuove).toHaveCount(0);

		// La ricerca conserva il filtro nell'URL ma restituisce tutti gli stati.
		const ricerca = `E2E Cliente Anagrafica ${token}`;
		await cercaNellElenco(page, "/anagrafiche/clienti", ricerca);
		await expect(page).toHaveURL(
			(url) => url.searchParams.get("q") === ricerca && url.searchParams.get("stato") === "non-attivi",
		);
		await expect(page.getByText("La ricerca include tutti gli stati")).toBeVisible();
		await expect(chipCliente(page, nonAttivo.ragioneSociale)).toHaveText("1 chiusa");
		await expect(chipCliente(page, nuovo.ragioneSociale)).toHaveText("Nuovo");

		// Deselezionare l'ultimo stato riporta ai predefiniti (URL senza `stato`).
		await page.goto("/anagrafiche/clienti?stato=non-attivi");
		await expect(opzioneFiltro(page, "Non attivi")).toHaveAttribute("aria-pressed", "true");
		await opzioneFiltro(page, "Non attivi").click();
		await page.waitForURL(
			(url) => url.pathname === "/anagrafiche/clienti" && !url.searchParams.has("stato"),
		);
		await expect(opzioneFiltro(page, "Attivi")).toHaveAttribute("aria-pressed", "true");
		await expect(opzioneFiltro(page, "Nuovi")).toHaveAttribute("aria-pressed", "true");
		await expect(opzioneFiltro(page, "Non attivi")).toHaveAttribute("aria-pressed", "false");
	});

	test("selezione multipla: nessuna azione di stato sui clienti", async ({
		page,
		factory,
	}) => {
		const token = suffissoUnivoco();
		const primo = await creaClienteProprio(factory, { token });
		const secondo = await creaClienteProprio(factory, { token });
		await apriElencoFiltrato(page, "/anagrafiche/clienti", `E2E Cliente Anagrafica ${token}`);

		const barra = await selezionaRighe(page, [primo.ragioneSociale]);
		await expect(barra.getByRole("link", { name: "Modifica", exact: true })).toBeVisible();
		await selezionaRighe(page, [secondo.ragioneSociale]);
		await expect(barra).toContainText("2 clienti selezionati");
		await expect(barra.getByRole("link", { name: "Modifica" })).toHaveCount(0);
		await expect(barra.getByRole("button", { name: /^(Disattiva|Riattiva)/ })).toHaveCount(0);
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
			name: "Persone",
			exact: true,
		});
		await expect(collaboratoriLink).toBeVisible();
		await expect(collaboratoriLink).toHaveAttribute(
			"href",
			"/anagrafiche/persone",
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
