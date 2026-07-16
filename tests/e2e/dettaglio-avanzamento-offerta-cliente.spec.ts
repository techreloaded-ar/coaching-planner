import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import { attendiTabellaOfferteClienteIdratata } from "./support/offerte";

function codiceUnivoco(prefisso: string): string {
	return `E2E-DET-CLIENTE-${prefisso}-${randomUUID().slice(0, 8)}`.toUpperCase();
}

function testoLetterale(valore: string): RegExp {
	return new RegExp(valore.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

function rigaOfferta(page: Page, codice: string): Locator {
	return page
		.getByRole("table", { name: "Offerte del cliente" })
		.getByRole("row", { name: testoLetterale(codice) });
}

function pulsanteDettaglio(riga: Locator, codice: string): Locator {
	return riga.getByRole("button", {
		name: `Dettaglio avanzamento ${codice}`,
	});
}

function dettaglioOfferta(page: Page, codice: string): Locator {
	return page.getByRole("region", {
		name: `Dettaglio avanzamento ${codice}`,
	});
}

function indicatore(region: Locator, etichetta: string): Locator {
	return region.getByText(etichetta, { exact: true }).locator("..");
}

async function apriDettaglioCliente(page: Page, clienteId: string): Promise<void> {
	await page.goto(`/anagrafiche/clienti/${clienteId}`);
	await attendiTabellaOfferteClienteIdratata(page);
}

test.describe("Dettaglio avanzamento offerta nella pagina cliente", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("espande e richiude l'offerta con avanzamento e quote dei collaboratori", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("ATTIVA");
		const { cliente, offerta } = await factory.createClienteConOfferta(
			{ ragioneSociale: `E2E Dettaglio Cliente ${codice}` },
			{ codice, giorniPrevisti: 10 },
		);
		const primaCollaboratrice = await factory.createCollaboratore({
			nome: "Ada",
			cognome: "Lovelace",
		});
		const secondoCollaboratore = await factory.createCollaboratore({
			nome: "Alan",
			cognome: "Turing",
		});

		await factory.createRigaAttivita({
			cliente,
			offerta,
			collaboratore: primaCollaboratrice,
			ore: "16.00",
			fatturabile: true,
		});
		await factory.createRigaAttivita({
			cliente,
			offerta,
			collaboratore: secondoCollaboratore,
			ore: "16.00",
			fatturabile: true,
		});

		await apriDettaglioCliente(page, cliente.id);

		const riga = rigaOfferta(page, codice);
		const pulsante = pulsanteDettaglio(riga, codice);
		await expect(riga).toBeVisible();
		await expect(pulsante).toHaveAttribute("aria-expanded", "false");

		await riga.getByText(codice, { exact: true }).click();

		const dettaglio = dettaglioOfferta(page, codice);
		await expect(dettaglio).toBeVisible();
		await expect(pulsante).toHaveAttribute("aria-expanded", "true");
		await expect(dettaglio.getByText("In corso", { exact: true })).toBeVisible();
		await expect(indicatore(dettaglio, "Previste")).toContainText(/10\s*gg/);
		await expect(indicatore(dettaglio, "Erogate")).toContainText(/4\s*gg/);
		await expect(indicatore(dettaglio, "Residuo")).toContainText(/6\s*gg/);
		await expect(dettaglio.getByText("40%", { exact: true })).toBeVisible();
		await expect(
			dettaglio.getByTestId("barra-avanzamento-offerta"),
		).toHaveAttribute("style", /width:\s*40%/);

		for (const nome of ["Ada Lovelace", "Alan Turing"]) {
			const rigaCollaboratore = dettaglio.getByRole("row", {
				name: testoLetterale(nome),
			});
			await expect(rigaCollaboratore).toContainText("16 h");
			await expect(rigaCollaboratore).toContainText("2 gg");
			await expect(rigaCollaboratore).toContainText("50%");
		}

		await riga.getByText(codice, { exact: true }).click();
		await expect(dettaglio).toHaveCount(0);
		await expect(pulsante).toHaveAttribute("aria-expanded", "false");
	});

	test("porta alla modifica senza espandere la riga", async ({ page, factory }) => {
		const codice = codiceUnivoco("MODIFICA");
		const { cliente, offerta } = await factory.createClienteConOfferta(
			{ ragioneSociale: `E2E Modifica Cliente ${codice}` },
			{ codice },
		);

		await apriDettaglioCliente(page, cliente.id);

		const riga = rigaOfferta(page, codice);
		await expect(dettaglioOfferta(page, codice)).toHaveCount(0);
		await riga.getByRole("link", { name: "Modifica" }).click();
		await page.waitForURL(
			`**/anagrafiche/clienti/${cliente.id}/offerte/${offerta.id}`,
		);
		await expect(page.getByLabel("Codice")).toHaveValue(codice);
	});

	test("mostra il messaggio vuoto per un'offerta senza attività", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("VUOTA");
		const { cliente } = await factory.createClienteConOfferta(
			{ ragioneSociale: `E2E Offerta Vuota ${codice}` },
			{ codice, giorniPrevisti: 5 },
		);

		await apriDettaglioCliente(page, cliente.id);
		await rigaOfferta(page, codice).getByText(codice, { exact: true }).click();

		await expect(
			dettaglioOfferta(page, codice).getByText(
				"Nessuna attività registrata per questa offerta",
				{ exact: true },
			),
		).toBeVisible();
	});
});
