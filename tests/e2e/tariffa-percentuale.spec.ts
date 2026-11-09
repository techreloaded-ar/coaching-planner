import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import type { E2eDataFactory } from "./support/factory";
import { test, expect } from "./support/fixtures";

/**
 * Test e2e — tariffa Percentuale: il collaboratore riceve la tariffa
 * giornaliera dell'offerta meno la percentuale trattenuta, solo sulle ore
 * Fatturabile. Riepilogo, fatturazione collaboratori e marginalità usano lo
 * stesso compenso; il collaboratore non vede mai la tariffa venduta.
 *
 * La percentuale non ha fissi: pesa solo sulle righe del mese riservato.
 */

const CODICE_RIEPILOGO = "PERCENTUALE-TRATTENUTA-RIEPILOGO";
const CODICE_REPORT = "PERCENTUALE-TRATTENUTA-REPORT";

const formattatoreEuro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const euro = (valore: number) => formattatoreEuro.format(valore);

/** 20% su un'offerta da 1.000 €/g: 2 g Fatturabile + 1 g Non fatturabile + 50 € di rimborso. */
async function creaCollaboratoreAPercentuale(factory: E2eDataFactory, mese: string) {
	const suffisso = randomUUID().slice(0, 8);
	const collaboratore = await factory.createCollaboratore({
		nome: "E2E Percentuale",
		cognome: suffisso,
		tariffe: [{ validaDalMese: mese, modalita: "PERCENTUALE", importo: "20.00" }],
	});
	const { cliente, offerta } = await factory.createClienteConOfferta(
		{ ragioneSociale: `E2E Percentuale ${suffisso}` },
		{ codice: `PCT-${suffisso}`, descrizione: `Offerta percentuale ${suffisso}`, tariffaGiornaliera: "1000.00" },
	);
	for (const [giorno, categoria, rimborso] of [
		[10, "FATTURABILE", "50.00"],
		[11, "FATTURABILE", null],
		[12, "NON_FATTURABILE", null],
	] as const) {
		await factory.createRigaAttivita({
			collaboratore,
			cliente,
			offerta,
			data: new Date(`${dataNelMese(mese, giorno)}T00:00:00.000Z`),
			ore: "8.00",
			categoria,
			rimborsoTrasfertaEtichetta: rimborso ? "Trasferta" : null,
			rimborsoTrasfertaImporto: rimborso,
		});
	}
	return { collaboratore, offerta };
}

function storico(page: Page) {
	return page.getByRole("table", { name: "Storico tariffe" });
}

test.describe("Tariffa Percentuale", () => {
	test("il collaboratore vede il proprio compenso per offerta, senza la tariffa venduta", async ({
		page,
		factory,
	}) => {
		const mese = meseRiservato(CODICE_RIEPILOGO);
		const { collaboratore } = await creaCollaboratoreAPercentuale(factory, mese);

		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto(`/attivita/riepilogo?mese=${mese}`);

		await expect(page.getByTestId("summary-giornate-da-fatturare-value")).toHaveText("2,00");
		await expect(page.getByTestId("summary-giornate-da-fatturare")).toContainText("Percentuale trattenuta: 20%");
		await expect(page.getByTestId("summary-importo-fattura-value")).toContainText(/1\.?650,00/);
		await expect(page.getByTestId("summary-importo-fattura-breakdown")).toContainText("2.00 g fatturabili");
		await expect(page.getByTestId("summary-importo-fattura-breakdown")).toContainText(/Compenso .*1\.?600,00/);

		const tabella = page.getByTestId("summary-table");
		await expect(tabella.getByRole("columnheader", { name: "Compenso (20% trattenuto)", exact: true })).toBeVisible();
		await expect(tabella.getByRole("columnheader", { name: /Compenso \/ giorno/ })).toHaveCount(0);
		await expect(tabella.locator("tbody tr")).toContainText(/1\.?600,00/);
		await expect(tabella.locator("tfoot tr")).toContainText(/1\.?600,00/);
		await expect(page.getByText(/1\.?000,00/)).toHaveCount(0);
	});

	test("fatturazione collaboratori e marginalità usano lo stesso compenso", async ({ page, factory }) => {
		const mese = meseRiservato(CODICE_REPORT);
		const { collaboratore, offerta } = await creaCollaboratoreAPercentuale(factory, mese);

		await accediComeAdmin(page);
		await page.goto(`/report/fatturazione-collaboratori?mese=${mese}`);
		const riga = page.getByTestId(`fattura-collaboratore-${collaboratore.collaboratore.id}`);
		await expect(riga).toContainText("20% trattenuta");
		await expect(riga).toContainText(euro(1600));
		await expect(riga).toContainText(euro(1650));

		// Celle: 0 codice, 1 descrizione, 2 giornate, 3 ricavi, 4 costi, 5 margine, 6 margine %.
		await page.goto(`/report/marginalita?da=${mese}&a=${mese}`);
		const celle = page.getByTestId(`marginalita-offerta-${offerta.id}`).getByRole("cell");
		await expect(celle.nth(3)).toHaveText(euro(2000));
		await expect(celle.nth(4)).toHaveText(euro(1600));
		await expect(celle.nth(5)).toHaveText(euro(400));
	});

	test("l'amministratore imposta una tariffa Percentuale dallo storico tariffe", async ({ page, factory }) => {
		const { collaboratore } = await factory.createCollaboratore({
			attivo: false,
			tariffe: [{ validaDalMese: "2025-01", modalita: "GIORNALIERA", importo: "400.00" }],
		});

		await accediComeAdmin(page);
		await page.goto(`/anagrafiche/collaboratori/${collaboratore.id}`);
		await page.getByRole("button", { name: "Nuova tariffa", exact: true }).click();
		const modulo = page.getByRole("form", { name: "Nuova tariffa" });
		await modulo.getByLabel("Valida dal mese").fill("2026-01");
		await modulo.getByText("Percentuale", { exact: true }).click();

		await modulo.getByLabel("Percentuale trattenuta (%)").fill("100");
		await modulo.getByRole("button", { name: "Salva tariffa" }).click();
		await expect(modulo.getByText("La percentuale trattenuta deve essere minore di 100")).toBeVisible();

		await modulo.getByLabel("Percentuale trattenuta (%)").fill("12,5");
		await modulo.getByRole("button", { name: "Salva tariffa" }).click();
		await expect(modulo).toHaveCount(0);
		await expect(storico(page).locator("tbody tr").filter({ hasText: "gen 2026" })).toContainText(
			"12,5% trattenuta",
		);
		await expect(page.getByTestId("tariffa-attuale")).toContainText("12,5% trattenuta");
		await expect(page.getByTestId("tariffa-attuale")).toContainText("Percentuale · da gen 2026");
	});
});
