import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import {
	dataNelMese,
	mesePassatoRiservato,
	meseRiservato,
} from "./support/date";
import { test, expect } from "./support/fixtures";
import {
	apriPaginaOfferte,
	attendiTabellaOfferteIdratata,
} from "./support/offerte";

// Mesi riservati alla spec US-036: mesePrecedente < meseRiferimento in ordine
// cronologico, così le colonne mensili hanno un ordinamento atteso stabile.
const mesePrecedente = mesePassatoRiservato("US-036");
const meseRiferimento = meseRiservato("US-036");

const formattatoreMeseAtteso = new Intl.DateTimeFormat("it-IT", {
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

// Etichetta colonna mese identica a quella resa dalla UI
// (dettaglio-avanzamento-offerta.tsx).
function etichettaMese(meseToken: string): string {
	const [anno, numeroMese] = meseToken.split("-").map(Number);
	return formattatoreMeseAtteso.format(new Date(Date.UTC(anno, numeroMese - 1, 1)));
}

function dataNelMeseUtc(meseToken: string, giorno: number): Date {
	return new Date(`${dataNelMese(meseToken, giorno)}T00:00:00.000Z`);
}

function codiceUnivoco(prefisso: string): string {
	return `E2E-DET-${prefisso}-${randomUUID().slice(0, 8)}`.toUpperCase();
}

function testoLetterale(valore: string): RegExp {
	return new RegExp(valore.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

function rigaOfferta(page: Page, codice: string): Locator {
	return page.getByRole("row", { name: testoLetterale(codice) });
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

test.describe("Dettaglio avanzamento offerta", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("espande l'offerta con avanzamento e quote dei collaboratori", async ({
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

		await apriPaginaOfferte(page);

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

		const tabellaCollaboratori = dettaglio.getByRole("table", {
			name: "Giornate erogate per collaboratore",
			exact: true,
		});
		for (const nome of ["Ada Lovelace", "Alan Turing"]) {
			const rigaCollaboratore = tabellaCollaboratori.getByRole("row", {
				name: testoLetterale(nome),
			});
			await expect(rigaCollaboratore).toContainText("16 h");
			await expect(rigaCollaboratore).toContainText("2 gg");
			await expect(rigaCollaboratore).toContainText("50%");
		}

		await riga.getByText(codice, { exact: true }).click();
		await expect(pulsante).toHaveAttribute("aria-expanded", "false");
		await expect(dettaglio).toHaveCount(0);
	});

	test("mostra gli stati critici e di allerta con barre di avanzamento limitate", async ({
		page,
		factory,
	}) => {
		const scenari = [
			{
				codice: codiceUnivoco("ALLERTA"),
				etichetta: "In allerta",
				ore: "72.00",
				larghezza: "90%",
			},
			{
				codice: codiceUnivoco("ESAURITA"),
				etichetta: "Esaurita",
				ore: "80.00",
				larghezza: "100%",
			},
			{
				codice: codiceUnivoco("OLTRE"),
				etichetta: "Oltre budget",
				ore: "88.00",
				larghezza: "100%",
				percentualeMostrata: "110%",
			},
		];

		for (const scenario of scenari) {
			const { cliente, offerta } = await factory.createClienteConOfferta(
				{ ragioneSociale: `E2E Dettaglio ${scenario.codice}` },
				{ codice: scenario.codice, giorniPrevisti: 10 },
			);
			const collaboratore = await factory.createCollaboratore();
			await factory.createRigaAttivita({
				cliente,
				offerta,
				collaboratore,
				ore: scenario.ore,
				fatturabile: true,
			});
		}

		await apriPaginaOfferte(page);

		for (const scenario of scenari) {
			const riga = rigaOfferta(page, scenario.codice);
			await expect(riga).toBeVisible();
			await pulsanteDettaglio(riga, scenario.codice).click();

			const dettaglio = dettaglioOfferta(page, scenario.codice);
			await expect(dettaglio.getByText(scenario.etichetta, { exact: true })).toHaveText(
				scenario.etichetta,
			);
			await expect(
				dettaglio.getByTestId("barra-avanzamento-offerta"),
			).toHaveAttribute(
				"style",
				new RegExp(`width:\\s*${scenario.larghezza}`),
			);
			if (scenario.percentualeMostrata) {
				await expect(
					dettaglio.getByText(scenario.percentualeMostrata, { exact: true }),
				).toBeVisible();
			}
		}
	});

	test("mostra una giornata erogata nel dettaglio di un'offerta non attiva", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("NONATTIVA");
		const { cliente, offerta } = await factory.createClienteConOfferta(
			{ ragioneSociale: `E2E Dettaglio Non attiva ${codice}` },
			{ codice, attiva: false, giorniPrevisti: 4 },
		);
		const collaboratore = await factory.createCollaboratore();
		await factory.createRigaAttivita({
			cliente,
			offerta,
			collaboratore,
			ore: "8.00",
			fatturabile: true,
		});

		await apriPaginaOfferte(page);

		const riga = rigaOfferta(page, codice);
		await riga.getByText(codice, { exact: true }).click();

		const dettaglio = dettaglioOfferta(page, codice);
		await expect(dettaglio).toBeVisible();
		await expect(indicatore(dettaglio, "Erogate")).toContainText(/1\s*gg/);
	});

	test("mostra il messaggio vuoto nel dettaglio senza attività", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("VUOTA");
		await factory.createClienteConOfferta(
			{ ragioneSociale: `E2E Dettaglio Vuota ${codice}` },
			{ codice, giorniPrevisti: 5 },
		);

		await apriPaginaOfferte(page);
		await rigaOfferta(page, codice).getByText(codice, { exact: true }).click();

		const dettaglio = dettaglioOfferta(page, codice);
		await expect(
			dettaglio.getByText("Nessuna attività registrata per questa offerta", {
				exact: true,
			}),
		).toBeVisible();
	});

	test("preserva l'espansione nel filtro e non espande le righe dalle azioni", async ({
		page,
		factory,
	}) => {
		const cliente = await factory.createCliente({
			ragioneSociale: `E2E Dettaglio Filtro ${randomUUID().slice(0, 8)}`,
		});
		const codiceA = codiceUnivoco("FILTRO-A");
		const codiceB = codiceUnivoco("FILTRO-B");
		const offertaA = await factory.createOfferta({ cliente, codice: codiceA });
		await factory.createOfferta({ cliente, codice: codiceB });

		await apriPaginaOfferte(page);

		const rigaA = rigaOfferta(page, codiceA);
		await rigaA.getByText(codiceA, { exact: true }).click();
		const dettaglioA = dettaglioOfferta(page, codiceA);
		await expect(dettaglioA).toBeVisible();

		const ricerca = page.getByLabel("Cerca offerta");
		await ricerca.fill(codiceB);
		await expect(rigaOfferta(page, codiceB)).toBeVisible();
		await expect(dettaglioOfferta(page, codiceA)).toHaveCount(0);

		await ricerca.clear();
		await expect(dettaglioA).toBeVisible();

		const rigaB = rigaOfferta(page, codiceB);
		await rigaB.getByRole("button", { name: "Disattiva" }).click();
		await page.waitForURL(
			(url) =>
				url.pathname === "/offerte" &&
				url.searchParams.get("esito") === "stato-offerta-aggiornato" &&
				url.searchParams.get("offertaEspansaId") === offertaA.id,
		);
		// Il redirect della server action ricarica la pagina: la tabella va
		// ri-attesa idratata prima di cliccare handler client come "Elimina".
		await attendiTabellaOfferteIdratata(page);

		const rigaBDisattivata = rigaOfferta(page, codiceB);
		await expect(
			rigaBDisattivata.getByRole("button", { name: "Attiva", exact: true }),
		).toHaveAttribute("title", "Offerta non attiva");
		await expect(pulsanteDettaglio(rigaBDisattivata, codiceB)).toHaveAttribute(
			"aria-expanded",
			"false",
		);
		await expect(dettaglioA).toBeVisible();

		await rigaBDisattivata
			.getByRole("button", { name: "Elimina", exact: true })
			.click();
		const modale = page.getByTestId("modale-elimina-offerta");
		await expect(modale).toBeVisible();
		await expect(
			modale.getByRole("heading", { name: "Elimina questa offerta?" }),
		).toBeVisible();
		await modale.getByRole("button", { name: "Annulla" }).click();
		await expect(modale).toHaveAttribute("aria-hidden", "true");
		await expect(dettaglioA).toBeVisible();
	});

	test("il click sull'indicatore conserva l'espansione della stessa riga", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("ESPANSA");
		const { offerta } = await factory.createClienteConOfferta(
			{ ragioneSociale: `E2E Dettaglio Espansa ${codice}` },
			{ codice, attiva: true, giorniPrevisti: 8 },
		);

		await apriPaginaOfferte(page);

		const riga = rigaOfferta(page, codice);
		await riga.getByText(codice, { exact: true }).click();
		await expect(dettaglioOfferta(page, codice)).toBeVisible();
		await expect(pulsanteDettaglio(riga, codice)).toHaveAttribute(
			"aria-expanded",
			"true",
		);

		// L'indicatore di stato ha stopPropagation: il submit non deve
		// chiudere la riga espansa.
		await riga.getByRole("button", { name: "Disattiva" }).click();
		await page.waitForURL(
			(url) =>
				url.pathname === "/offerte" &&
				url.searchParams.get("esito") === "stato-offerta-aggiornato" &&
				url.searchParams.get("offertaEspansaId") === offerta.id,
		);
		// Il redirect della server action ricarica la pagina: riattendere
		// l'idratazione prima di asserire sugli handler client.
		await attendiTabellaOfferteIdratata(page);

		const rigaDisattivata = rigaOfferta(page, codice);
		await expect(pulsanteDettaglio(rigaDisattivata, codice)).toHaveAttribute(
			"aria-expanded",
			"true",
		);
		await expect(dettaglioOfferta(page, codice)).toBeVisible();
		await expect(
			rigaDisattivata.getByRole("button", { name: "Attiva", exact: true }),
		).toHaveAttribute("title", "Offerta non attiva");
	});

	test("mostra la matrice mensile per collaboratore con totali coerenti", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("MATRICE");
		const { cliente, offerta } = await factory.createClienteConOfferta(
			{ ragioneSociale: `E2E Matrice Cliente ${codice}` },
			{ codice, giorniPrevisti: 10 },
		);
		const ada = await factory.createCollaboratore({
			nome: "Ada",
			cognome: "Lovelace",
		});
		const alan = await factory.createCollaboratore({
			nome: "Alan",
			cognome: "Turing",
		});

		await factory.createRigaAttivita({
			cliente,
			offerta,
			collaboratore: ada,
			data: dataNelMeseUtc(mesePrecedente, 10),
			ore: "8.00",
			fatturabile: true,
		});
		await factory.createRigaAttivita({
			cliente,
			offerta,
			collaboratore: ada,
			data: dataNelMeseUtc(meseRiferimento, 5),
			ore: "4.00",
			fatturabile: true,
		});
		await factory.createRigaAttivita({
			cliente,
			offerta,
			collaboratore: alan,
			data: dataNelMeseUtc(meseRiferimento, 12),
			ore: "16.00",
			fatturabile: true,
		});

		await apriPaginaOfferte(page);

		const riga = rigaOfferta(page, codice);
		await riga.getByText(codice, { exact: true }).click();

		const dettaglio = dettaglioOfferta(page, codice);
		await expect(dettaglio).toBeVisible();

		const matrice = dettaglio.getByRole("table", {
			name: "Giornate erogate per collaboratore e mese",
		});
		await expect(matrice).toBeVisible();

		await expect(matrice.getByRole("columnheader")).toHaveText([
			"Collaboratore",
			etichettaMese(mesePrecedente),
			etichettaMese(meseRiferimento),
			"Totale",
		]);

		const celleAda = matrice
			.getByRole("row", { name: testoLetterale("Ada Lovelace") })
			.getByRole("cell");
		await expect(celleAda.nth(1)).toHaveText("1");
		await expect(celleAda.nth(2)).toHaveText("0,5");
		await expect(celleAda.nth(3)).toHaveText("1,5");

		const celleAlan = matrice
			.getByRole("row", { name: testoLetterale("Alan Turing") })
			.getByRole("cell");
		await expect(celleAlan.nth(1)).toHaveText("—");
		await expect(celleAlan.nth(2)).toHaveText("2");
		await expect(celleAlan.nth(3)).toHaveText("2");

		const celleTotale = matrice
			.getByRole("row", { name: testoLetterale("Totale mese") })
			.getByRole("cell");
		await expect(celleTotale.nth(1)).toHaveText("1");
		await expect(celleTotale.nth(2)).toHaveText("2,5");
		await expect(celleTotale.nth(3)).toHaveText("3,5");

		await expect(indicatore(dettaglio, "Erogate")).toContainText(/3,5\s*gg/);
	});

	test("mostra il messaggio di assenza attività nella matrice", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("MATRICE-VUOTA");
		await factory.createClienteConOfferta(
			{ ragioneSociale: `E2E Matrice Vuota ${codice}` },
			{ codice, giorniPrevisti: 5 },
		);

		await apriPaginaOfferte(page);
		await rigaOfferta(page, codice).getByText(codice, { exact: true }).click();

		const dettaglio = dettaglioOfferta(page, codice);
		await expect(dettaglio).toBeVisible();
		await expect(
			dettaglio.getByText("Nessuna attività registrata", { exact: true }),
		).toBeVisible();
		await expect(
			dettaglio.getByRole("table", {
				name: "Giornate erogate per collaboratore e mese",
			}),
		).toHaveCount(0);
	});

	test("la matrice scorre orizzontalmente senza allargare la pagina", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("MATRICE-SCROLL");
		const { cliente, offerta } = await factory.createClienteConOfferta(
			{ ragioneSociale: `E2E Matrice Scroll ${codice}` },
			{ codice, giorniPrevisti: 30 },
		);
		const collaboratore = await factory.createCollaboratore({
			nome: "Grace",
			cognome: "Hopper",
		});

		for (let mesiIndietro = 1; mesiIndietro <= 18; mesiIndietro += 1) {
			await factory.createRigaAttivita({
				cliente,
				offerta,
				collaboratore,
				data: dataNelMeseUtc(mesePassatoRiservato("US-036", mesiIndietro), 10),
				ore: "8.00",
				fatturabile: true,
			});
		}

		await apriPaginaOfferte(page);
		await rigaOfferta(page, codice).getByText(codice, { exact: true }).click();

		const dettaglio = dettaglioOfferta(page, codice);
		await expect(dettaglio).toBeVisible();

		const contenitoreMatrice = page.getByTestId("matrice-mensile-offerta");
		await expect(contenitoreMatrice).toBeVisible();
		await expect
			.poll(async () =>
				contenitoreMatrice.evaluate((el) => el.scrollWidth > el.clientWidth),
			)
			.toBe(true);

		expect(
			await page.evaluate(
				() =>
					document.documentElement.scrollWidth <=
					document.documentElement.clientWidth,
			),
		).toBe(true);
	});

	test("reindirizza il vecchio report alle offerte e non lo espone nella navigazione", async ({
		page,
	}) => {
		await page.goto("/report/avanzamento-offerte");
		await page.waitForURL(/\/offerte(?:\?.*)?$/);
		await expect(page.getByRole("table", { name: "Elenco offerte" })).toBeVisible();

		await expect(
			page
				.getByRole("navigation", { name: "Navigazione principale" })
				.getByRole("link", { name: "Avanzamento offerte", exact: true }),
		).toHaveCount(0);
	});
});
