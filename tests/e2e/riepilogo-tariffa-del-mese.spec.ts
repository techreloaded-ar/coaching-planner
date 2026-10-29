import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, mesePassatoRiservato, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Test e2e — il riepilogo mensile del collaboratore usa la tariffa valida nel
 * mese: giornaliera, fisso mensile (anche senza attività) o nessuna tariffa.
 *
 * Il fisso vale solo per due mesi riservati e si chiude con una tariffa
 * giornaliera: così non pesa come «fisso non attribuibile» sulla marginalità
 * di altri mesi.
 */

const CODICE_SPEC = "TARIFFE-RIEPILOGO-FATTURA-COLLABORATORE";

function dataDb(mese: string, giorno: number): Date {
	return new Date(`${dataNelMese(mese, giorno)}T00:00:00.000Z`);
}

async function apriRiepilogo(page: Page, mese: string) {
	await page.goto(`/attivita/riepilogo?mese=${mese}`);
	await expect(page.getByTestId("summary-importo-fattura")).toBeVisible();
}

test.describe("Riepilogo mensile con la tariffa del mese", () => {
	test("calcola la fattura con la tariffa giornaliera o il fisso valido in ogni mese", async ({
		page,
		factory,
	}) => {
		// Mesi consecutivi: giornaliera → fisso con attività → fisso senza attività → giornaliera.
		const meseGiornaliera = mesePassatoRiservato(CODICE_SPEC, 3);
		const meseFisso = mesePassatoRiservato(CODICE_SPEC, 2);
		const meseFissoSenzaAttivita = mesePassatoRiservato(CODICE_SPEC, 1);
		const meseChiusura = meseRiservato(CODICE_SPEC);
		const suffisso = randomUUID().slice(0, 8);

		const collaboratore = await factory.createCollaboratore({
			nome: "E2E Tariffa del mese",
			cognome: suffisso,
			tariffe: [
				{ validaDalMese: meseGiornaliera, modalita: "GIORNALIERA", importo: "400.00" },
				{ validaDalMese: meseFisso, modalita: "FISSO_MENSILE", importo: "6500.00" },
				{ validaDalMese: meseChiusura, modalita: "GIORNALIERA", importo: "400.00" },
			],
		});
		const { cliente, offerta } = await factory.createClienteConOfferta(
			{ ragioneSociale: `E2E Tariffa del mese ${suffisso}` },
			{ codice: `TDM-${suffisso}`, descrizione: `Offerta tariffa del mese ${suffisso}` },
		);
		const riga = (mese: string, ore: string, rimborso: string | null = null) =>
			factory.createRigaAttivita({
				collaboratore,
				cliente,
				offerta,
				data: dataDb(mese, 10),
				ore,
				categoria: "FATTURABILE",
				nota: `Tariffa del mese ${suffisso}`,
				rimborsoTrasfertaEtichetta: rimborso ? "Trasferta" : null,
				rimborsoTrasfertaImporto: rimborso,
			});
		await riga(meseGiornaliera, "16.00", "40.00");
		await riga(meseFisso, "12.00", "240.00");

		await accediComeCollaboratore(page, collaboratore.utente.email);

		// Giornaliera: 2 g × 400 + 40 di rimborsi.
		await apriRiepilogo(page, meseGiornaliera);
		await expect(page.getByTestId("summary-importo-fattura-value")).toContainText("840,00");
		await expect(page.getByTestId("summary-importo-fattura-breakdown")).toContainText(/2\.00 g × .*400,00/);
		await expect(page.getByTestId("summary-importo-fattura-tariffa")).toContainText(
			"Tariffa giornaliera valida da",
		);

		// Fisso mensile: 6.500 + 240 di rimborsi, indipendente dalle 12 ore.
		await apriRiepilogo(page, meseFisso);
		await expect(page.getByTestId("summary-importo-fattura-value")).toContainText(/6\.?740,00/);
		await expect(page.getByTestId("summary-importo-fattura-breakdown")).toContainText(
			/Fisso mensile .*6\.?500,00/,
		);
		await expect(page.getByTestId("summary-importo-fattura-tariffa")).toContainText(
			"il fisso non dipende dalle giornate",
		);

		// Mese con il fisso in vigore ma senza attività: il fisso è comunque dovuto.
		await apriRiepilogo(page, meseFissoSenzaAttivita);
		await expect(page.getByTestId("summary-importo-fattura-value")).toContainText(/6\.?500,00/);

		// Mese precedente alla prima tariffa: compenso zero e nota esplicita.
		await apriRiepilogo(page, mesePassatoRiservato(CODICE_SPEC, 4));
		await expect(page.getByTestId("summary-importo-fattura-value")).toHaveText(/^(€\s*)?0,00(\s*€)?$/);
		await expect(page.getByTestId("summary-importo-fattura-tariffa")).toHaveText(
			"Nessuna tariffa in vigore in questo mese",
		);
	});
});
