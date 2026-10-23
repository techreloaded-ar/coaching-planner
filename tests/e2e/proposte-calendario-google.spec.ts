import type { Page } from "@playwright/test";

import {
	attendiOfferteCaricate,
	labelOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Proposta automatica delle ore dal calendario Google (EP-001).
 *
 * Google Calendar e Gemini sono simulati dal server in E2E_TEST_MODE:
 * - `/api/e2e-test/calendario-google` collega al collaboratore un calendario
 *   con gli eventi forniti (formato Calendar API v3) o un calendario in errore;
 * - l'associazione evento → offerta abbina il codice offerta o la ragione
 *   sociale citati nel titolo, solo tra le offerte abilitate.
 */

const MESE = meseRiservato("INC-CALENDARIO-GOOGLE");

type EventoSimulato = {
	id: string;
	summary: string;
	start: { dateTime?: string; date?: string };
	end: { dateTime?: string; date?: string };
	attendees?: { self: boolean; responseStatus: string }[];
};

/** Evento di `durataMinuti` che inizia alle `oraUtc` del giorno indicato. */
function eventoDelGiorno(
	data: string,
	id: string,
	summary: string,
	oraUtc: string,
	durataMinuti: number,
): EventoSimulato {
	const inizio = new Date(`${data}T${oraUtc}:00Z`);
	const fine = new Date(inizio.getTime() + durataMinuti * 60000);
	return {
		id,
		summary,
		start: { dateTime: inizio.toISOString() },
		end: { dateTime: fine.toISOString() },
	};
}

async function collegaCalendarioSimulato(
	page: Page,
	email: string,
	contenuto: { eventi?: EventoSimulato[]; errore?: boolean },
): Promise<void> {
	const risposta = await page.request.post("/api/e2e-test/calendario-google", {
		data: { email, ...contenuto },
	});
	expect(risposta.ok()).toBe(true);
}

function proposta(page: Page, titolo: string) {
	return page.getByTestId("proposta-calendario").filter({ hasText: titolo });
}

test.describe("US-001 Collegamento del Google Calendar", () => {
	test("AC-1/2/5: il collaboratore collega e scollega il proprio calendario", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();
		await accediComeCollaboratore(page, collaboratore.utente.email);

		await expect(page.getByText("Calendario Google non collegato")).toBeVisible();
		await page.getByRole("link", { name: "Collega Google Calendar" }).click();

		await page.waitForURL("**/attivita?calendario=collegato");
		await expect(page.getByText("Calendario Google collegato", { exact: true })).toBeVisible();

		await page.getByRole("button", { name: "Scollega" }).click();
		await expect(page.getByText("Calendario Google non collegato")).toBeVisible();
		await expect(page.getByRole("link", { name: "Collega Google Calendar" })).toBeVisible();
	});

	test("AC-3: un consenso negato lascia il calendario non collegato con un messaggio", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();
		await accediComeCollaboratore(page, collaboratore.utente.email);

		await page.goto("/api/calendario-google/callback?error=access_denied&state=qualsiasi");

		await page.waitForURL("**/attivita?calendario=negato");
		await expect(
			page.getByRole("alert").filter({ hasText: "Collegamento non completato" }),
		).toBeVisible();
		await expect(page.getByText("Calendario Google non collegato")).toBeVisible();
	});

	test("AC-6: ogni collaboratore vede solo il proprio collegamento", async ({
		page,
		browser,
		factory,
	}) => {
		const collegato = await factory.createCollaboratore();
		const altro = await factory.createCollaboratore();
		await collegaCalendarioSimulato(page, collegato.utente.email, { eventi: [] });

		await accediComeCollaboratore(page, collegato.utente.email);
		await expect(page.getByText("Calendario Google collegato", { exact: true })).toBeVisible();

		const altroContesto = await browser.newContext();
		const altraPagina = await altroContesto.newPage();
		try {
			await accediComeCollaboratore(altraPagina, altro.utente.email);
			await expect(altraPagina.getByText("Calendario Google non collegato")).toBeVisible();
		} finally {
			await altroContesto.close();
		}
	});
});

test.describe("US-002/US-003 Proposte dagli impegni del calendario", () => {
	test("propone solo gli impegni validi del giorno, associati a cliente e offerta quando riconosciuti", async ({
		page,
		factory,
	}) => {
		const data = dataNelMese(MESE, 10);
		const collaboratore = await factory.createCollaboratore();
		const abilitata = await factory.createClienteConOfferta();
		const nonAbilitata = await factory.createClienteConOfferta();
		await factory.createAbilitazioneOfferta({
			collaboratore,
			offerta: abilitata.offerta,
		});

		await collegaCalendarioSimulato(page, collaboratore.utente.email, {
			eventi: [
				eventoDelGiorno(data, "ev-riunione", `Riunione ${abilitata.offerta.codice}`, "07:00", 90),
				eventoDelGiorno(data, "ev-workshop", "Workshop interno", "12:00", 180),
				eventoDelGiorno(data, "ev-altrui", `Call ${nonAbilitata.offerta.codice}`, "16:00", 60),
				{
					id: "ev-intera-giornata",
					summary: "Ferie",
					start: { date: data },
					end: { date: data },
				},
				{
					...eventoDelGiorno(data, "ev-rifiutato", "Evento rifiutato", "09:00", 60),
					attendees: [{ self: true, responseStatus: "declined" }],
				},
			],
		});

		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto(`/attivita/${data}?mese=${MESE}`);

		await expect(page.getByRole("heading", { name: "Proposte dal calendario" })).toBeVisible();
		await expect(page.getByTestId("proposta-calendario")).toHaveCount(3);
		await expect(page.getByText("Ferie")).toHaveCount(0);
		await expect(page.getByText("Evento rifiutato")).toHaveCount(0);

		const riunione = proposta(page, "Riunione");
		await expect(riunione).toContainText("1,5 h");
		await expect(riunione).toContainText(abilitata.cliente.ragioneSociale);
		await expect(riunione).toContainText(labelOffertaTest(abilitata));

		const workshop = proposta(page, "Workshop interno");
		await expect(workshop).toContainText("3 h");
		await expect(workshop).toContainText("Cliente e offerta da scegliere");

		// Un'offerta non abilitata per il collaboratore non è mai proposta.
		const altrui = proposta(page, "Call");
		await expect(altrui).toContainText("Cliente e offerta da scegliere");
		await expect(altrui).not.toContainText(nonAbilitata.cliente.ragioneSociale);
	});

	test("senza calendario collegato la giornata resta quella di sempre", async ({
		page,
		factory,
	}) => {
		const data = dataNelMese(MESE, 11);
		const collaboratore = await factory.createCollaboratore();
		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto(`/attivita/${data}?mese=${MESE}`);

		await expect(page.getByRole("heading", { name: "Nuova riga attività" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Proposte dal calendario" })).toHaveCount(0);
	});

	test("un calendario illeggibile mostra l'avviso e lascia disponibile l'inserimento manuale", async ({
		page,
		factory,
	}) => {
		const data = dataNelMese(MESE, 12);
		const collaboratore = await factory.createCollaboratore();
		await collegaCalendarioSimulato(page, collaboratore.utente.email, { errore: true });

		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto(`/attivita/${data}?mese=${MESE}`);

		await expect(
			page.getByRole("alert").filter({
				hasText: "Impossibile leggere il calendario, prova a ricollegarlo",
			}),
		).toBeVisible();
		await expect(page.getByRole("link", { name: "ricollegarlo" })).toHaveAttribute(
			"href",
			"/api/calendario-google/collega",
		);
		await expect(page.getByRole("heading", { name: "Nuova riga attività" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Aggiungi riga" })).toBeVisible();
	});
});

test.describe("US-004 Conferma, modifica o rifiuto delle proposte", () => {
	test("conferma, modifica e rifiuta le proposte, aggiunge una riga a mano e non ritrova proposte residue", async ({
		page,
		factory,
	}) => {
		const data = dataNelMese(MESE, 15);
		const collaboratore = await factory.createCollaboratore();
		const clienteConOfferta = await factory.createClienteConOfferta();
		await factory.createAbilitazioneOfferta({
			collaboratore,
			offerta: clienteConOfferta.offerta,
		});
		const codice = clienteConOfferta.offerta.codice;

		await collegaCalendarioSimulato(page, collaboratore.utente.email, {
			eventi: [
				eventoDelGiorno(data, "ev-kickoff", `Kickoff ${codice}`, "07:00", 60),
				eventoDelGiorno(data, "ev-workshop", `Workshop ${codice}`, "09:00", 180),
				eventoDelGiorno(data, "ev-pranzo", "Pausa pranzo", "11:00", 60),
			],
		});

		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto(`/attivita/${data}?mese=${MESE}`);
		await expect(page.getByTestId("proposta-calendario")).toHaveCount(3);
		const righe = page.getByTestId("activity-row");

		// Conferma: la proposta diventa riga e sparisce dalle proposte.
		await proposta(page, "Kickoff").getByRole("button", { name: "Conferma" }).click();
		await expect(righe.filter({ hasText: `Kickoff ${codice}` })).toContainText("1.0 h");
		await expect(proposta(page, "Kickoff")).toHaveCount(0);

		// Modifica: form precompilato, ore cambiate prima del salvataggio.
		await proposta(page, "Workshop").getByRole("button", { name: "Modifica" }).click();
		await expect(
			page.getByRole("heading", { name: "Nuova riga dalla proposta del calendario" }),
		).toBeVisible();
		await expect(page.locator("#cliente")).toHaveValue(clienteConOfferta.cliente.id);
		await attendiOfferteCaricate(page.locator("#offerta"));
		await expect(page.locator("#offerta")).toHaveValue(clienteConOfferta.offerta.id);
		await expect(page.locator("#ore")).toHaveValue("3");
		await expect(page.locator("#nota")).toHaveValue(`Workshop ${codice}`);
		await page.locator("#ore").fill("2,5");
		await page.getByRole("button", { name: "Aggiungi riga" }).click();
		await expect(righe.filter({ hasText: `Workshop ${codice}` })).toContainText("2.5 h");
		await expect(proposta(page, "Workshop")).toHaveCount(0);

		// Rifiuta: nessuna riga creata.
		await proposta(page, "Pausa pranzo").getByRole("button", { name: "Rifiuta" }).click();
		await expect(proposta(page, "Pausa pranzo")).toHaveCount(0);
		await expect(page.getByText("Nessun impegno da proporre per questa giornata.")).toBeVisible();

		// L'inserimento manuale resta disponibile accanto alle proposte.
		const notaManuale = `Riga manuale ${codice}`;
		await page.locator("#cliente").selectOption(clienteConOfferta.cliente.id);
		await attendiOfferteCaricate(page.locator("#offerta"));
		await page.locator("#offerta").selectOption(clienteConOfferta.offerta.id);
		await page.locator("#ore").fill("1");
		await page.locator("#nota").fill(notaManuale);
		await page.getByRole("button", { name: "Aggiungi riga" }).click();
		await expect(righe.filter({ hasText: notaManuale })).toBeVisible();

		// Riaprendo la giornata: tre righe salvate, nessuna proposta residua.
		await page.reload();
		await expect(righe).toHaveCount(3);
		await expect(page.getByText("Nessun impegno da proporre per questa giornata.")).toBeVisible();
		await expect(page.getByTestId("proposta-calendario")).toHaveCount(0);
		// Ore totali e ore fatturabili: tutte le righe sono fatturabili.
		await expect(page.getByText("4.5 h", { exact: true })).toHaveCount(2);
	});
});
