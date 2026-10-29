import type { Page } from "@playwright/test";

import {
	attendiOfferteCaricate,
	labelOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";
import { apriImpostazioni } from "./support/menu-account";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Proposta automatica delle ore dal calendario Google (EP-001).
 *
 * Google Calendar e Jev sono simulati dal server in E2E_TEST_MODE:
 * - `/api/e2e-test/calendario-google` collega al collaboratore un calendario
 *   con gli eventi forniti (formato Calendar API v3) o un calendario in errore;
 * - l'analisi di Jev, solo tra le offerte abilitate, precompila le offerte
 *   attive il cui codice o cliente è citato in titolo o descrizione, o il cui
 *   cliente è riconoscibile da un dominio esterno degli invitati; la sola
 *   descrizione dell'offerta non basta, e i titoli con pranzo, palestra,
 *   medico, dentista o personale sono non lavorativi.
 */

const MESE = meseRiservato("INC-CALENDARIO-GOOGLE");

type EventoSimulato = {
	id: string;
	summary: string;
	eventType?: string;
	start: { dateTime?: string; date?: string };
	end: { dateTime?: string; date?: string };
	attendees?: { email?: string; self?: boolean; responseStatus?: string }[];
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

function pulsantePannelloProposte(page: Page) {
	return page.getByRole("button", { name: /^Proposte dal calendario/ });
}

/** Apre il pannello delle proposte, chiuso all'apertura della giornata. */
async function apriProposte(page: Page, numeroAtteso: number): Promise<void> {
	const pulsante = pulsantePannelloProposte(page);
	await expect(pulsante).toHaveAccessibleName(`Proposte dal calendario · ${numeroAtteso} da proporre`);
	await expect(pulsante).toHaveAttribute("aria-expanded", "false");
	await pulsante.click();
	await expect(pulsante).toHaveAttribute("aria-expanded", "true");
}

/** Riquadro del connettore Google Calendar nella sezione Connettori delle Impostazioni. */
function connettoreCalendario(page: Page) {
	return page.getByRole("group", { name: "Calendario Google", exact: true });
}

/** Indicatore discreto dello stato del collegamento nella pagina attività. */
function indicatoreCalendario(page: Page) {
	return page.getByRole("link", { name: /^Google Calendar (non )?collegato$/ });
}

test.describe("Google Calendar nelle Impostazioni", () => {
	test("il collaboratore collega e scollega il proprio calendario dalle Impostazioni", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();
		await accediComeCollaboratore(page, collaboratore.utente.email);
		await apriImpostazioni(page);

		await expect(page.getByRole("heading", { name: "Connettori", level: 2 })).toBeVisible();
		await expect(connettoreCalendario(page)).toContainText("Calendario Google non collegato");
		await connettoreCalendario(page).getByRole("link", { name: "Collega Google Calendar" }).click();
		await page.waitForURL("**/e2e-test/consenso-calendario**");
		await expect(
			page.getByRole("radio", { name: `${collaboratore.utente.email} (account di accesso)` }),
		).toBeChecked();
		await page.getByRole("button", { name: "Autorizza" }).click();

		await page.waitForURL("**/impostazioni?calendario=collegato");
		await expect(page.getByText("Calendario Google collegato", { exact: true })).toBeVisible();

		await connettoreCalendario(page).getByRole("button", { name: "Scollega" }).click();
		await expect(page.getByText("Calendario Google non collegato")).toBeVisible();
		await expect(
			connettoreCalendario(page).getByRole("link", { name: "Collega Google Calendar" }),
		).toBeVisible();
	});

	test("un consenso negato torna alle Impostazioni con il calendario non collegato e un messaggio", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();
		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto("/impostazioni");

		await page.getByRole("link", { name: "Collega Google Calendar" }).click();
		await page.waitForURL("**/e2e-test/consenso-calendario**");
		await page.getByRole("link", { name: "Nega il consenso" }).click();

		await page.waitForURL("**/impostazioni?calendario=negato");
		await expect(
			page.getByRole("alert").filter({ hasText: "Collegamento non completato" }),
		).toBeVisible();
		await expect(page.getByText("Calendario Google non collegato")).toBeVisible();
	});

	test("ogni collaboratore vede solo il proprio collegamento", async ({
		page,
		browser,
		factory,
	}) => {
		const collegato = await factory.createCollaboratore();
		const altro = await factory.createCollaboratore();
		await collegaCalendarioSimulato(page, collegato.utente.email, { eventi: [] });

		await accediComeCollaboratore(page, collegato.utente.email);
		await page.goto("/impostazioni");
		await expect(page.getByText("Calendario Google collegato", { exact: true })).toBeVisible();

		const altroContesto = await browser.newContext();
		const altraPagina = await altroContesto.newPage();
		try {
			await accediComeCollaboratore(altraPagina, altro.utente.email);
			await altraPagina.goto("/impostazioni");
			await expect(altraPagina.getByText("Calendario Google non collegato")).toBeVisible();
		} finally {
			await altroContesto.close();
		}
	});

	test("senza profilo collaboratore il connettore non è disponibile e non offre azioni", async ({
		page,
		factory,
	}) => {
		const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
		await accediComeAdmin(page, amministratore.email);
		await page.goto("/impostazioni");

		await expect(connettoreCalendario(page)).toContainText("Calendario Google non disponibile");
		await expect(connettoreCalendario(page).getByRole("link")).toHaveCount(0);
		await expect(connettoreCalendario(page).getByRole("button")).toHaveCount(0);
	});
});

test.describe("Verifica dell'account Google al collegamento", () => {
	test("un account Google diverso da quello di accesso non viene collegato", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();
		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto("/impostazioni");

		// Nel consenso simulato si sceglie di autorizzare un altro account.
		await page.getByRole("link", { name: "Collega Google Calendar" }).click();
		await page.waitForURL("**/e2e-test/consenso-calendario**");
		await page.getByRole("radio", { name: "Un altro account" }).check();
		await page
			.getByRole("textbox", { name: "Email dell'altro account" })
			.fill("altro-account@esempio.test");
		await page.getByRole("button", { name: "Autorizza" }).click();

		await page.waitForURL("**/impostazioni?calendario=account-diverso");
		await expect(
			page.getByRole("alert").filter({ hasText: "account Google diverso" }),
		).toContainText(collaboratore.utente.email);
		await expect(page.getByText("Calendario Google non collegato")).toBeVisible();
	});
});

test.describe("Indicatore discreto nella pagina attività", () => {
	test("mostra solo lo stato del collegamento e porta alle Impostazioni", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();
		await collegaCalendarioSimulato(page, collaboratore.utente.email, { eventi: [] });
		await accediComeCollaboratore(page, collaboratore.utente.email);

		await expect(indicatoreCalendario(page)).toHaveAccessibleName("Google Calendar collegato");
		await expect(page.getByRole("link", { name: "Collega Google Calendar" })).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Scollega" })).toHaveCount(0);
		await expect(page.getByRole("group", { name: "Calendario Google" })).toHaveCount(0);

		await indicatoreCalendario(page).click();
		await page.waitForURL("**/impostazioni");
		await connettoreCalendario(page).getByRole("button", { name: "Scollega" }).click();
		await expect(page.getByText("Calendario Google non collegato")).toBeVisible();

		await page.goto("/attivita");
		await expect(indicatoreCalendario(page)).toHaveAccessibleName("Google Calendar non collegato");
		await expect(page.getByRole("link", { name: "Collega Google Calendar" })).toHaveCount(0);
		await expect(indicatoreCalendario(page)).toHaveAttribute("href", "/impostazioni");
	});

	test("gli esiti del consenso non compaiono più nella pagina attività", async ({ page, factory }) => {
		const collaboratore = await factory.createCollaboratore();
		await accediComeCollaboratore(page, collaboratore.utente.email);

		for (const esito of ["negato", "account-diverso"]) {
			await page.goto(`/attivita?calendario=${esito}`);
			await expect(indicatoreCalendario(page)).toBeVisible();
			await expect(page.getByRole("alert").filter({ hasText: "Collegamento non completato" })).toHaveCount(0);
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
				{
					...eventoDelGiorno(data, "ev-fuori-sede", "Fuori sede", "10:00", 120),
					eventType: "outOfOffice",
				},
				eventoDelGiorno(data, "ev-pranzo", "Pranzo con la famiglia", "11:00", 60),
			],
		});

		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto(`/attivita/${data}?mese=${MESE}`);

		await expect(page.getByRole("heading", { name: "Proposte dal calendario" })).toBeVisible();
		await apriProposte(page, 3);
		await expect(page.getByTestId("proposta-calendario")).toHaveCount(3);
		await expect(page.getByText("Ferie")).toHaveCount(0);
		await expect(page.getByText("Evento rifiutato")).toHaveCount(0);
		// «Fuori sede» e impegni palesemente non lavorativi non sono proposti.
		await expect(proposta(page, "Fuori sede")).toHaveCount(0);
		await expect(proposta(page, "Pranzo")).toHaveCount(0);

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
				eventoDelGiorno(data, "ev-allineamento", "Allineamento interno", "11:00", 60),
			],
		});

		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto(`/attivita/${data}?mese=${MESE}`);
		await apriProposte(page, 3);
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
		await proposta(page, "Allineamento interno").getByRole("button", { name: "Rifiuta" }).click();
		await expect(proposta(page, "Allineamento interno")).toHaveCount(0);
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

test.describe("Incremento: suggerimenti a confidenza alta e pannello chiuso", () => {
	test("suggerisce cliente e offerta dai domini dei partecipanti solo a confidenza alta", async ({
		page,
		factory,
	}) => {
		const data = dataNelMese(MESE, 18);
		const collaboratore = await factory.createCollaboratore();
		const pippo = await factory.createClienteConOfferta();
		await factory.createAbilitazioneOfferta({ collaboratore, offerta: pippo.offerta });
		// Dominio ricavato dalla ragione sociale, come «pippo.com» per «Pippo».
		const dominioCliente = `${pippo.cliente.ragioneSociale.toLowerCase().replace(/[^a-z0-9]/g, "")}.example`;

		await collegaCalendarioSimulato(page, collaboratore.utente.email, {
			eventi: [
				{
					...eventoDelGiorno(data, "ev-sync", "Sync settimanale", "07:00", 60),
					attendees: [
						{ email: collaboratore.utente.email, self: true, responseStatus: "accepted" },
						{ email: `referente@${dominioCliente}`, responseStatus: "accepted" },
					],
				},
				// Cita solo la descrizione dell'offerta: confidenza bassa.
				eventoDelGiorno(data, "ev-ambiguo", `Lavoro su ${pippo.offerta.descrizione}`, "09:00", 60),
			],
		});

		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto(`/attivita/${data}?mese=${MESE}`);
		await apriProposte(page, 2);

		const sync = proposta(page, "Sync settimanale");
		await expect(sync).toContainText(pippo.cliente.ragioneSociale);
		await expect(sync).toContainText(labelOffertaTest(pippo));
		await expect(sync).toContainText("Suggerito dall'AI");
		await expect(sync.getByRole("button", { name: "Conferma" })).toBeVisible();

		const ambiguo = proposta(page, "Lavoro su");
		await expect(ambiguo).toContainText("Cliente e offerta da scegliere");
		await expect(ambiguo).not.toContainText("Suggerito dall'AI");
		await expect(ambiguo.getByRole("button", { name: "Conferma" })).toHaveCount(0);
		await expect(ambiguo.getByRole("button", { name: "Modifica" })).toBeVisible();
		await expect(ambiguo.getByRole("button", { name: "Rifiuta" })).toBeVisible();
	});

	test("il pannello parte chiuso, si apre da tastiera e il numero scende con le proposte gestite", async ({
		page,
		factory,
	}) => {
		const data = dataNelMese(MESE, 19);
		const collaboratore = await factory.createCollaboratore();
		await collegaCalendarioSimulato(page, collaboratore.utente.email, {
			eventi: [
				eventoDelGiorno(data, "ev-uno", "Riunione uno", "07:00", 60),
				eventoDelGiorno(data, "ev-due", "Riunione due", "09:00", 60),
				eventoDelGiorno(data, "ev-tre", "Riunione tre", "11:00", 60),
			],
		});

		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto(`/attivita/${data}?mese=${MESE}`);

		const pulsante = pulsantePannelloProposte(page);
		await expect(pulsante).toHaveAccessibleName("Proposte dal calendario · 3 da proporre");
		await expect(pulsante).toHaveAttribute("aria-expanded", "false");
		await expect(page.getByTestId("proposta-calendario").first()).toBeHidden();

		await pulsante.focus();
		await page.keyboard.press("Enter");
		await expect(pulsante).toHaveAttribute("aria-expanded", "true");
		await expect(page.getByTestId("proposta-calendario")).toHaveCount(3);
		await expect(proposta(page, "Riunione uno")).toBeVisible();

		await proposta(page, "Riunione uno").getByRole("button", { name: "Rifiuta" }).click();
		await expect(pulsante).toHaveAccessibleName("Proposte dal calendario · 2 da proporre");

		await pulsante.focus();
		await page.keyboard.press("Space");
		await expect(pulsante).toHaveAttribute("aria-expanded", "false");
		await expect(proposta(page, "Riunione due")).toBeHidden();
	});
});
