import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import {
	apriElencoFiltrato,
	cercaNellElenco,
	selezionaRighe,
} from "./support/elenchi";
import { test, expect } from "./support/fixtures";
import {
	apriPaginaOfferte,
	attendiTabellaOfferteIdratata,
} from "./support/offerte";

/**
 * Test e2e — paginazione e ricerca lato server degli elenchi back-office
 * (US-001 clienti, US-002 offerte).
 *
 * Ogni test crea più di 25 righe con un prefisso univoco e filtra l'elenco per
 * quel prefisso: conteggi e pagine riguardano solo dati propri, indipendenti
 * da quanto creano in parallelo gli altri worker.
 */

const RIGHE_PAGINA_2 = 5;
const TOTALE = 25 + RIGHE_PAGINA_2;

function numero(indice: number): string {
	return String(indice).padStart(2, "0");
}

function paginazione(page: Page): Locator {
	return page.getByRole("navigation", { name: "Paginazione" });
}

function urlPosizione(
	percorso: string,
	ricerca: string,
	pagina: number | null,
): (url: URL) => boolean {
	return (url) =>
		url.pathname === percorso &&
		url.searchParams.get("q") === ricerca &&
		url.searchParams.get("pagina") === (pagina === null ? null : String(pagina));
}

test.describe("Paginazione elenco clienti (US-001)", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("25 clienti per pagina, navigazione, ricerca e ritorno alla pagina dopo la disattivazione", async ({
		page,
		factory,
	}) => {
		const prefisso = `E2E Pag ${randomUUID().slice(0, 8)}`;
		for (let indice = 1; indice <= TOTALE; indice += 1) {
			await factory.createCliente({
				ragioneSociale: `${prefisso} ${numero(indice)}`,
			});
		}
		const tabella = page.getByRole("table", { name: "Elenco clienti" });
		// Righe dei clienti del test (esclude intestazione e riga "nessun risultato").
		const righe = tabella.getByRole("row").filter({ hasText: prefisso });
		const rigaCliente = (indice: number) =>
			tabella.getByRole("row").filter({ hasText: `${prefisso} ${numero(indice)}` });

		// Pagina 1: le prime 25 righe in ordine alfabetico.
		await apriElencoFiltrato(page, "/anagrafiche/clienti", prefisso);
		await expect(righe).toHaveCount(25);
		await expect(page.getByText(`Mostrati 1–25 di ${TOTALE}`)).toBeVisible();
		await expect(
			page.getByText(`${TOTALE} clienti · ${TOTALE} attivi · 0 disattivati`),
		).toBeVisible();
		await expect(rigaCliente(1)).toBeVisible();
		await expect(rigaCliente(26)).toHaveCount(0);
		await expect(paginazione(page).getByText("Precedente")).toHaveAttribute(
			"aria-disabled",
			"true",
		);

		// Pagina 2: le righe restanti, con la stessa ricerca nell'URL.
		await paginazione(page).getByRole("link", { name: "Successiva" }).click();
		await page.waitForURL(urlPosizione("/anagrafiche/clienti", prefisso, 2));
		await expect(righe).toHaveCount(RIGHE_PAGINA_2);
		await expect(
			page.getByText(`Mostrati 26–${TOTALE} di ${TOTALE}`),
		).toBeVisible();
		await expect(paginazione(page).locator('[aria-current="page"]')).toHaveText("2");
		await expect(paginazione(page).getByText("Successiva")).toHaveAttribute(
			"aria-disabled",
			"true",
		);
		await expect(rigaCliente(1)).toHaveCount(0);
		await expect(rigaCliente(28)).toBeVisible();

		// Disattivare da pagina 2 riporta a pagina 2 con la stessa ricerca.
		const barra = await selezionaRighe(page, [`${prefisso} 28`]);
		await barra.getByRole("button", { name: "Disattiva", exact: true }).click();
		await page
			.getByRole("dialog", { name: `Disattivare «${prefisso} 28»?` })
			.getByRole("button", { name: "Disattiva", exact: true })
			.click();
		await expect(
			rigaCliente(28).getByText("Disattivato", { exact: true }),
		).toBeVisible();
		await expect(page).toHaveURL(urlPosizione("/anagrafiche/clienti", prefisso, 2));
		await expect(righe).toHaveCount(RIGHE_PAGINA_2);
		await expect(
			page.getByText(`${TOTALE} clienti · ${TOTALE - 1} attivi · 1 disattivati`),
		).toBeVisible();

		// Una pagina oltre l'ultima mostra l'ultima pagina valida.
		await page.goto(
			`/anagrafiche/clienti?${new URLSearchParams({ q: prefisso, pagina: "99" })}`,
		);
		await expect(righe).toHaveCount(RIGHE_PAGINA_2);
		await expect(
			page.getByText(`Mostrati 26–${TOTALE} di ${TOTALE}`),
		).toBeVisible();
		await expect(paginazione(page).locator('[aria-current="page"]')).toHaveText("2");

		// La ricerca trova un cliente di pagina 2 e torna a una sola pagina.
		await cercaNellElenco(page, "/anagrafiche/clienti", `${prefisso} 29`);
		await expect(page).toHaveURL(
			urlPosizione("/anagrafiche/clienti", `${prefisso} 29`, null),
		);
		await expect(righe).toHaveCount(1);
		await expect(rigaCliente(29)).toBeVisible();
		await expect(page.getByText("Mostrati 1–1 di 1")).toBeVisible();
		await expect(paginazione(page)).toHaveCount(0);

		// Indietro ripristina la vista precedente, campo di ricerca compreso.
		const campoRicerca = page.getByRole("searchbox", { name: "Cerca cliente" });
		await apriElencoFiltrato(page, "/anagrafiche/clienti", prefisso);
		await paginazione(page).getByRole("link", { name: "Successiva" }).click();
		await page.waitForURL(urlPosizione("/anagrafiche/clienti", prefisso, 2));
		await cercaNellElenco(page, "/anagrafiche/clienti", `${prefisso} 29`);
		await page.goBack();
		await page.waitForURL(urlPosizione("/anagrafiche/clienti", prefisso, null));
		await expect(campoRicerca).toHaveValue(prefisso);
		await expect(righe).toHaveCount(25);

		// Il link di menu riporta all'elenco completo e svuota la ricerca.
		await page
			.getByRole("navigation", { name: "Navigazione principale" })
			.getByRole("link", { name: "Clienti", exact: true })
			.click();
		await page.waitForURL(
			(url) => url.pathname === "/anagrafiche/clienti" && !url.searchParams.has("q"),
		);
		await expect(campoRicerca).toHaveValue("");
	});
});

test.describe("Paginazione elenco offerte (US-002)", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("25 offerte per pagina con le critiche in testa e ritorno alla pagina dopo un'azione", async ({
		page,
		factory,
	}) => {
		const token = randomUUID().slice(0, 8).toUpperCase();
		const cliente = await factory.createCliente({
			ragioneSociale: `E2E Pag Offerte ${token}`,
		});
		const codice = (suffisso: string) => `PAG-${token}-${suffisso}`;
		const idPerSuffisso = new Map<string, string>();
		for (let indice = 1; indice <= TOTALE; indice += 1) {
			const offerta = await factory.createOfferta({
				cliente,
				codice: codice(numero(indice)),
			});
			idPerSuffisso.set(numero(indice), offerta.id);
		}
		// Offerta critica: attiva ed esaurita (16 ore fatturabili = 2 giornate su
		// 2 previste). Per codice ordinerebbe in coda, ma va in testa all'elenco.
		const offertaCritica = await factory.createOfferta({
			cliente,
			codice: codice("99"),
			giorniPrevisti: 2,
		});
		await factory.createRigaAttivita({
			cliente,
			offerta: offertaCritica,
			ore: "16.00",
			categoria: "FATTURABILE",
		});
		const totaleOfferte = TOTALE + 1;
		const pulsantiDettaglio = page
			.getByRole("table", { name: "Elenco offerte" })
			.getByRole("button", { name: /^Dettaglio avanzamento / });
		const rigaOfferta = (suffisso: string) =>
			page
				.getByRole("table", { name: "Elenco offerte" })
				.getByRole("row")
				.filter({ has: page.getByText(codice(suffisso), { exact: true }) });

		// Pagina 1: l'offerta critica è la prima, i contatori coprono tutto il filtro.
		await apriPaginaOfferte(page, cliente.ragioneSociale);
		await expect(pulsantiDettaglio).toHaveCount(25);
		await expect(pulsantiDettaglio.first()).toHaveAttribute(
			"aria-label",
			`Dettaglio avanzamento ${codice("99")}`,
		);
		await expect(
			page.getByText(`Mostrati 1–25 di ${totaleOfferte}`),
		).toBeVisible();
		await expect(page.getByText("1 da presidiare", { exact: true })).toBeVisible();
		await expect(
			page.getByText(
				`${totaleOfferte} offerte · ${totaleOfferte} attive · 0 disattivate`,
			),
		).toBeVisible();
		await expect(rigaOfferta("28")).toHaveCount(0);

		// Pagina 2: le offerte restanti.
		await paginazione(page).getByRole("link", { name: "Successiva" }).click();
		await page.waitForURL(urlPosizione("/offerte", cliente.ragioneSociale, 2));
		await expect(pulsantiDettaglio).toHaveCount(totaleOfferte - 25);
		await expect(
			page.getByText(`Mostrati 26–${totaleOfferte} di ${totaleOfferte}`),
		).toBeVisible();
		await expect(rigaOfferta("28")).toBeVisible();

		// Da pagina 2: espande il dettaglio e disattiva l'offerta.
		const offerta28 = rigaOfferta("28");
		await offerta28.getByText(codice("28"), { exact: true }).click();
		const dettaglio = page.getByRole("region", {
			name: `Dettaglio avanzamento ${codice("28")}`,
		});
		await expect(dettaglio).toBeVisible();

		const barra = await selezionaRighe(page, [codice("28")]);
		await barra.getByRole("button", { name: "Disattiva", exact: true }).click();
		await page
			.getByRole("dialog", { name: `Disattivare «${codice("28")}»?` })
			.getByRole("button", { name: "Disattiva", exact: true })
			.click();
		await page.waitForURL(
			(url) =>
				urlPosizione("/offerte", cliente.ragioneSociale, 2)(url) &&
				url.searchParams.get("esito") === "stato-offerta-aggiornato" &&
				url.searchParams.get("offertaEspansaId") === idPerSuffisso.get("28"),
		);
		await attendiTabellaOfferteIdratata(page);
		await expect(page.getByText("Stato dell'offerta aggiornato")).toBeVisible();
		await expect(dettaglio).toBeVisible();
		await expect(
			rigaOfferta("28").getByText("Disattivata", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText(
				`${totaleOfferte} offerte · ${totaleOfferte - 1} attive · 1 disattivate`,
			),
		).toBeVisible();

		// La ricerca per codice trova un'offerta di pagina 2 in una sola pagina.
		await cercaNellElenco(page, "/offerte", codice("29"));
		await expect(pulsantiDettaglio).toHaveCount(1);
		await expect(rigaOfferta("29")).toBeVisible();
		await expect(page.getByText("Mostrati 1–1 di 1")).toBeVisible();
		await expect(paginazione(page)).toHaveCount(0);
	});
});
