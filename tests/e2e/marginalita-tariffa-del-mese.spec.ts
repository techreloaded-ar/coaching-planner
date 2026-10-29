import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import {
	dataNelMese,
	meseCorrenteToken,
	mesePassatoRiservato,
	mesiIndietroPerTentativo,
	offsetMeseRiservato,
} from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Test e2e — la marginalità usa la tariffa del collaboratore valida nel mese
 * di ogni riga e ripartisce i fissi mensili sulle offerte del mese.
 *
 * Ogni fisso vale un solo mese e si chiude con una tariffa giornaliera: non
 * pesa come «fisso non attribuibile» sui mesi di altri test. Solo l'ultimo test
 * asserisce un valore globale del mese e usa uno slot esclusivo.
 */

const CODICE_TARIFFA_DEL_MESE = "TARIFFE-MARGINALITA-TARIFFA-DEL-MESE";
const CODICE_FISSO_RIPARTITO = "TARIFFE-MARGINALITA-RIPARTIZIONE-FISSO";
const CODICE_NON_ATTRIBUIBILI = "TARIFFE-MARGINALITA-FISSI-NON-ATTRIBUIBILI";

const formattatoreEuro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const euro = (valore: number) => formattatoreEuro.format(valore);

/** Mese successivo a quello `mesiIndietro` mesi prima del mese riservato. */
function meseDopo(codice: string, mesiIndietro: number): string {
	return meseCorrenteToken(offsetMeseRiservato(codice) - mesiIndietro + 1);
}

function dataDb(mese: string, giorno: number): Date {
	return new Date(`${dataNelMese(mese, giorno)}T00:00:00.000Z`);
}

/** Celle: 0 codice, 1 descrizione, 2 giornate, 3 ricavi, 4 costi, 5 margine, 6 margine %. */
function cellaCosti(page: Page, offertaId: string): Locator {
	return page.getByTestId(`marginalita-offerta-${offertaId}`).getByRole("cell").nth(4);
}

async function apriMarginalita(page: Page, da: string, a: string) {
	await page.goto(`/report/marginalita?da=${da}&a=${a}`);
	await expect(
		page.getByRole("heading", { name: "Marginalità per cliente e offerta" }),
	).toBeVisible();
}

test.describe("Marginalità con la tariffa del mese", () => {
	test.beforeEach(async ({ page }) => {
		await accediComeAdmin(page);
	});

	test("i costi giornalieri usano la tariffa valida nel mese di ogni riga", async ({
		page,
		factory,
	}) => {
		const mesePrima = mesePassatoRiservato(CODICE_TARIFFA_DEL_MESE, 2);
		const meseDopoAumento = mesePassatoRiservato(CODICE_TARIFFA_DEL_MESE, 1);
		const suffisso = randomUUID().slice(0, 8);
		const collaboratore = await factory.createCollaboratore({
			tariffe: [
				{ validaDalMese: mesePrima, modalita: "GIORNALIERA", importo: "400.00" },
				{ validaDalMese: meseDopoAumento, modalita: "GIORNALIERA", importo: "450.00" },
			],
		});
		const { cliente, offerta } = await factory.createClienteConOfferta(
			{ ragioneSociale: `E2E Tariffa del mese ${suffisso}` },
			{ codice: `MTM-${suffisso}`, tariffaGiornaliera: "600.00" },
		);
		for (const mese of [mesePrima, meseDopoAumento]) {
			await factory.createRigaAttivita({
				collaboratore,
				cliente,
				offerta,
				data: dataDb(mese, 12),
				ore: "8.00",
				categoria: "FATTURABILE",
			});
		}

		await apriMarginalita(page, mesePrima, meseDopoAumento);
		// 1 g × 400 + 1 g × 450
		await expect(cellaCosti(page, offerta.id)).toHaveText(euro(850));
	});

	test("il fisso mensile si ripartisce sulle offerte in proporzione alle ore del mese", async ({
		page,
		factory,
	}) => {
		const meseFisso = mesePassatoRiservato(CODICE_FISSO_RIPARTITO, 1);
		const suffisso = randomUUID().slice(0, 8);
		const collaboratore = await factory.createCollaboratore({
			tariffe: [
				{ validaDalMese: "1900-01", modalita: "GIORNALIERA", importo: "400.00" },
				{ validaDalMese: meseFisso, modalita: "FISSO_MENSILE", importo: "6500.00" },
				{ validaDalMese: meseDopo(CODICE_FISSO_RIPARTITO, 1), modalita: "GIORNALIERA", importo: "400.00" },
			],
		});
		const cliente = await factory.createCliente({ ragioneSociale: `E2E Fisso ripartito ${suffisso}` });
		const offertaA = await factory.createOfferta({ cliente, codice: `FRA-${suffisso}`, tariffaGiornaliera: "600.00" });
		const offertaB = await factory.createOfferta({ cliente, codice: `FRB-${suffisso}`, tariffaGiornaliera: "600.00" });
		// 10 g su A (in due righe) e 2,5 g su B.
		for (const [offerta, giorno, ore] of [
			[offertaA, 5, "24.00"],
			[offertaA, 6, "56.00"],
			[offertaB, 7, "20.00"],
		] as const) {
			await factory.createRigaAttivita({
				collaboratore,
				cliente,
				offerta,
				data: dataDb(meseFisso, giorno),
				ore,
				categoria: "FATTURABILE",
			});
		}

		await apriMarginalita(page, meseFisso, meseFisso);
		await expect(cellaCosti(page, offertaA.id)).toContainText(euro(5200));
		await expect(cellaCosti(page, offertaA.id)).toContainText(`di cui fisso ripartito ${euro(5200)}`);
		await expect(cellaCosti(page, offertaB.id)).toContainText(euro(1300));
		await expect(cellaCosti(page, offertaB.id)).toContainText(`di cui fisso ripartito ${euro(1300)}`);
	});

	test("il fisso di un mese senza ore finisce nei fissi non attribuibili e nel totale costi", async ({
		page,
		factory,
	}) => {
		const mesiIndietro = mesiIndietroPerTentativo(test.info());
		const meseSenzaOre = mesePassatoRiservato(CODICE_NON_ATTRIBUIBILI, mesiIndietro);
		await factory.createCollaboratore({
			tariffe: [
				{ validaDalMese: "1900-01", modalita: "GIORNALIERA", importo: "400.00" },
				{ validaDalMese: meseSenzaOre, modalita: "FISSO_MENSILE", importo: "6500.00" },
				{
					validaDalMese: meseDopo(CODICE_NON_ATTRIBUIBILI, mesiIndietro),
					modalita: "GIORNALIERA",
					importo: "400.00",
				},
			],
		});

		await apriMarginalita(page, meseSenzaOre, meseSenzaOre);
		const fissi = page.getByTestId("marginalita-fissi-non-attribuibili");
		await expect(fissi).toContainText("Fissi non attribuibili");
		await expect(fissi).toContainText(euro(6500));
		await expect(page.getByTestId("marginalita-totali")).toContainText(euro(6500));
	});
});
