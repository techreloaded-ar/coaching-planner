import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import {
	apriElencoFiltrato,
	barraSelezione,
	casellaSelezione,
	cercaNellElenco,
	selezionaRighe,
} from "./support/elenchi";
import { apriPaginaOfferte } from "./support/offerte";

/** Codice offerta univoco per il test, così da localizzare una singola riga. */
function codiceUnivoco(prefisso: string): string {
	return `E2E-${prefisso}-${randomUUID().slice(0, 8)}`.toUpperCase();
}

/** Va alla pagina Offerte tramite il link della sidebar principale. */
async function vaiAOfferteDallaSidebar(page: Page): Promise<void> {
	await page.getByRole("link", { name: "Offerte", exact: true }).click();
	await page.waitForURL(/\/offerte(?:\?.*)?$/);
	await expect(
		page.getByRole("heading", { name: "Offerte", level: 1 }),
	).toBeVisible();
}

/**
 * Attende il redirect di un'azione sull'elenco filtrato: l'URL porta l'esito
 * e conserva la ricerca `q` da cui l'azione è partita.
 */
async function attendiEsitoNellElencoFiltrato(
	page: Page,
	esito: string,
	ricerca: string,
): Promise<void> {
	await page.waitForURL(
		(url) =>
			url.pathname === "/offerte" &&
			url.searchParams.get("esito") === esito &&
			url.searchParams.get("q") === ricerca,
	);
}

/** Riga della tabella offerte che contiene il codice indicato. */
function rigaConCodice(page: Page, codice: string): Locator {
	return page
		.locator("table[aria-label='Elenco offerte'] tbody tr")
		.filter({ hasText: codice });
}

test.describe("Gestione offerte", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("creazione di una nuova offerta selezionando il cliente per label", async ({
		page,
		factory,
	}) => {
		const cliente = await factory.createCliente({
			ragioneSociale: `E2E Gestione Cliente ${randomUUID().slice(0, 8)}`,
		});
		const codice = codiceUnivoco("CREA");

		await vaiAOfferteDallaSidebar(page);

		await page.getByRole("link", { name: "Nuova offerta" }).click();
		await page.waitForURL(/\/offerte\/nuova$/);

		await page
			.getByLabel("Cliente")
			.selectOption({ label: cliente.ragioneSociale });
		await page.getByLabel("Codice").fill(codice);
		await page.getByLabel("Descrizione").fill("Percorso coaching creazione");
		await page.getByLabel("Tariffa giornaliera").fill("640,00");
		await page.getByLabel("Giorni previsti").fill("12");
		await page.getByRole("button", { name: "Crea offerta" }).click();

		await page.waitForURL(/\/offerte\?esito=offerta-creata$/);
		await expect(
			page.getByText("Offerta creata correttamente"),
		).toBeVisible();

		// Il redirect riporta all'elenco non filtrato, dove la nuova offerta può
		// stare oltre la prima pagina: la si cerca per codice.
		await cercaNellElenco(page, "/offerte", codice);
		const riga = rigaConCodice(page, codice);
		await expect(riga).toHaveCount(1);
		await expect(
			riga.getByText("Percorso coaching creazione"),
		).toBeVisible();
		await expect(riga.getByText(cliente.ragioneSociale)).toBeVisible();
	});

	test("la creazione con soli codice e cliente riesce e mostra «—» per i dati mancanti", async ({
		page,
		factory,
	}) => {
		const cliente = await factory.createCliente({
			ragioneSociale: `E2E Gestione Cliente ${randomUUID().slice(0, 8)}`,
		});
		const codice = codiceUnivoco("MIN");

		await page.goto("/offerte/nuova");
		await page
			.getByLabel("Cliente")
			.selectOption({ label: cliente.ragioneSociale });
		await page.getByLabel("Codice").fill(codice);
		await page.getByLabel("Giorni previsti").fill("0");
		await page.getByRole("button", { name: "Crea offerta" }).click();
		await expect(
			page.getByText("I giorni previsti devono essere maggiori di zero"),
		).toBeVisible();

		await page.getByLabel("Codice").fill(codice);
		await page.getByLabel("Giorni previsti").fill("");
		await page
			.getByLabel("Cliente")
			.selectOption({ label: cliente.ragioneSociale });
		await page.getByRole("button", { name: "Crea offerta" }).click();
		await page.waitForURL(/\/offerte\?esito=offerta-creata$/);

		await cercaNellElenco(page, "/offerte", codice);
		const riga = rigaConCodice(page, codice);
		await expect(riga).toHaveCount(1);
		// La prima cella è la casella di selezione: descrizione, tariffa e giorni seguono.
		const celle = riga.locator("td");
		await expect(celle.nth(1)).toContainText("—");
		await expect(celle.nth(3)).toContainText("—");
		await expect(celle.nth(4)).toContainText("—");
	});

	test("modifica di descrizione e tariffa persistita nell'elenco", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("MOD");
		const offerta = await factory.createOfferta({
			codice,
			descrizione: "Descrizione iniziale",
			tariffaGiornaliera: "500.00",
		});

		await apriElencoFiltrato(page, "/offerte", offerta.codice);
		const barra = await selezionaRighe(page, [offerta.codice]);
		await barra.getByRole("link", { name: "Modifica", exact: true }).click();
		await page.waitForURL(/\/offerte\/[^/]+$/);

		await page.getByLabel("Descrizione").fill("Descrizione aggiornata");
		await page.getByLabel("Tariffa giornaliera").fill("725,50");
		await page.getByRole("button", { name: "Salva offerta" }).click();

		await page.waitForURL(/\/offerte\?esito=offerta-salvata$/);
		await expect(page.getByText("Modifiche all'offerta salvate")).toBeVisible();
		await cercaNellElenco(page, "/offerte", offerta.codice);

		const rigaAggiornata = rigaConCodice(page, offerta.codice);
		await expect(
			rigaAggiornata.getByText("Descrizione aggiornata"),
		).toBeVisible();
		await expect(rigaAggiornata.getByText(/725,50\s*€/)).toBeVisible();

		await page.reload();
		const rigaDopoReload = rigaConCodice(page, offerta.codice);
		await expect(
			rigaDopoReload.getByText("Descrizione aggiornata"),
		).toBeVisible();
		await expect(rigaDopoReload.getByText(/725,50\s*€/)).toBeVisible();
	});

	test("disattivazione con conferma e riattivazione dalla barra azioni", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("TOGGLE");
		const offerta = await factory.createOfferta({ codice, attiva: true });

		await apriPaginaOfferte(page, offerta.codice);
		const riga = rigaConCodice(page, offerta.codice);
		await expect(riga.getByText("Attiva", { exact: true })).toBeVisible();

		const barra = await selezionaRighe(page, [offerta.codice]);
		await expect(barra).toContainText("1 offerta selezionata");
		await barra.getByRole("button", { name: "Disattiva", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: `Disattivare «${offerta.codice}»?` });
		await dialog.getByRole("button", { name: "Disattiva", exact: true }).click();
		await attendiEsitoNellElencoFiltrato(
			page,
			"stato-offerta-aggiornato",
			offerta.codice,
		);

		await expect(riga.getByText("Disattivata", { exact: true })).toBeVisible();
		await expect(barraSelezione(page)).toBeHidden();

		// La riattivazione parte subito, senza conferma.
		const barraRiattiva = await selezionaRighe(page, [offerta.codice]);
		await expect(
			barraRiattiva.getByRole("button", { name: "Disattiva", exact: true }),
		).toHaveCount(0);
		await barraRiattiva.getByRole("button", { name: "Riattiva", exact: true }).click();
		await expect(riga.getByText("Attiva", { exact: true })).toBeVisible();
		await expect(barraSelezione(page)).toBeHidden();
	});

	test("barra azioni: una offerta selezionata espone tutte le azioni", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("BARRA");
		const offerta = await factory.createOfferta({ codice });

		await apriPaginaOfferte(page, offerta.codice);
		const barra = await selezionaRighe(page, [offerta.codice]);
		await expect(barra.getByRole("link", { name: "Modifica", exact: true })).toHaveAttribute(
			"href",
			`/offerte/${offerta.id}`,
		);
		await expect(
			barra.getByRole("link", { name: "Collaboratori abilitati", exact: true }),
		).toHaveAttribute("href", `/offerte/${offerta.id}/collaboratori`);
		await expect(barra.getByRole("button", { name: "Disattiva", exact: true })).toBeVisible();
		await expect(barra.getByRole("button", { name: "Elimina", exact: true })).toBeVisible();
		await expect(barra.getByRole("button", { name: "Riattiva" })).toHaveCount(0);

		// Il click sulla casella seleziona senza espandere il dettaglio della riga.
		await expect(
			page.getByRole("button", { name: `Dettaglio avanzamento ${offerta.codice}` }),
		).toHaveAttribute("aria-expanded", "false");
	});

	test("disattivazione multipla di due offerte", async ({ page, factory }) => {
		const token = randomUUID().slice(0, 8).toUpperCase();
		const prima = await factory.createOfferta({ codice: `E2E-MULTI-${token}-A` });
		const seconda = await factory.createOfferta({ codice: `E2E-MULTI-${token}-B` });

		await apriPaginaOfferte(page, `E2E-MULTI-${token}`);
		const barra = await selezionaRighe(page, [prima.codice, seconda.codice]);
		await expect(barra).toContainText("2 offerte selezionate");
		await expect(barra.getByRole("link", { name: "Modifica" })).toHaveCount(0);
		await expect(barra.getByRole("button", { name: "Elimina" })).toHaveCount(0);

		await barra.getByRole("button", { name: "Disattiva (2)", exact: true }).click();
		await page
			.getByRole("dialog", { name: "Disattivare 2 offerte?" })
			.getByRole("button", { name: "Disattiva", exact: true })
			.click();
		await attendiEsitoNellElencoFiltrato(
			page,
			"stato-offerta-aggiornato",
			`E2E-MULTI-${token}`,
		);

		for (const offerta of [prima, seconda]) {
			await expect(
				rigaConCodice(page, offerta.codice).getByText("Disattivata", { exact: true }),
			).toBeVisible();
			await expect(casellaSelezione(page, offerta.codice)).not.toBeChecked();
		}
		await expect(barraSelezione(page)).toBeHidden();
		await expect(page.getByRole("searchbox", { name: "Cerca offerta" })).toBeVisible();
	});

	test("eliminazione riuscita di un'offerta senza attività collegate", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("DEL");
		const offerta = await factory.createOfferta({ codice });

		// "Elimina" è un handler client: l'helper attende anche l'idratazione.
		await apriPaginaOfferte(page, offerta.codice);
		await expect(rigaConCodice(page, offerta.codice)).toHaveCount(1);
		const barra = await selezionaRighe(page, [offerta.codice]);
		await barra.getByRole("button", { name: "Elimina", exact: true }).click();

		const modale = page.getByTestId("modale-elimina-offerta");
		await expect(
			modale.getByRole("heading", { name: "Elimina questa offerta?" }),
		).toBeVisible();
		await modale.getByRole("button", { name: "Elimina offerta" }).click();

		await attendiEsitoNellElencoFiltrato(
			page,
			"offerta-eliminata",
			offerta.codice,
		);
		await expect(page.getByText("Offerta eliminata")).toBeVisible();
		await expect(rigaConCodice(page, offerta.codice)).toHaveCount(0);
	});

	test("eliminazione bloccata quando l'offerta ha attività collegate", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("BLOCK");
		const offerta = await factory.createOfferta({ codice });
		await factory.createRigaAttivita({ offerta });

		// "Elimina" è un handler client: l'helper attende anche l'idratazione.
		await apriPaginaOfferte(page, offerta.codice);
		await expect(rigaConCodice(page, offerta.codice)).toHaveCount(1);
		const barra = await selezionaRighe(page, [offerta.codice]);
		await barra.getByRole("button", { name: "Elimina", exact: true }).click();

		const modale = page.getByTestId("modale-elimina-offerta");
		await expect(
			modale.getByRole("heading", {
				name: "Non è possibile eliminare l'offerta",
			}),
		).toBeVisible();
		await expect(
			modale.getByRole("button", { name: "Disattiva offerta" }),
		).toBeVisible();
		await expect(modale.getByText(/disattivala/)).toBeVisible();

		await modale.getByRole("button", { name: "Chiudi" }).click();
		await expect(rigaConCodice(page, offerta.codice)).toHaveCount(1);
	});
});
