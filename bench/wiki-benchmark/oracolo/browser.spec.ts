/**
 * Oracolo, livello browser. Titoli "[area] ID descrizione" come nel livello integrazione.
 * Usa i mesi passati da -1 a -13 (il livello integrazione parte da -14).
 * Lo stato del mese si cambia solo dall'interfaccia, tramite l'adattatore.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { accediCome } from "../tests/e2e/support/auth";
import { createE2eDataFactory, type CollaboratoreTestData } from "../tests/e2e/support/factory";
import { e2ePrisma } from "../tests/e2e/support/prisma";
import type { Mese } from "./contratto";
import { adattatoreBrowser as adattatore } from "./adattatore/browser";

// Playwright riavvia il worker dopo ogni test fallito: niente stato in memoria tra i test.
// Namespace unico per processo, mesi fissi per test, errori JS e chiusure riuscite su file.
const factory = createE2eDataFactory(`oracolo-browser-${process.pid}-${Date.now()}`);
const FILE_ERRORI_JS = path.join(__dirname, "errori-js.log");
const FILE_CHIUSURE = path.join(__dirname, "chiusure-riuscite.log");

const oggi = new Date();
const MESI = { V1: -1, V2: -2, V3: -3, V4: -4, S1: -5, U1: -6, U2: -7 } as const;
function meseRiservato(controllo: keyof typeof MESI): Mese {
	const d = new Date(oggi.getFullYear(), oggi.getMonth() + MESI[controllo], 1);
	return { anno: d.getFullYear(), mese: d.getMonth() + 1 };
}
const tokenMese = (m: Mese) => `${m.anno}-${String(m.mese).padStart(2, "0")}`;
const giorno = (m: Mese, g: number) => `${tokenMese(m)}-${String(g).padStart(2, "0")}`;

type Scenario = {
	collaboratore: CollaboratoreTestData;
	amministratore: CollaboratoreTestData;
	cliente: string;
	offerta: string;
	clienteId: string;
	offertaId: string;
};

async function scenario(): Promise<Scenario> {
	const collaboratore = await factory.createCollaboratore();
	const amministratore = await factory.createCollaboratore({ utenteOptions: { ruolo: "AMMINISTRATORE" } });
	const { cliente, offerta } = await factory.createClienteConOfferta();
	await factory.createAbilitazioneOfferta({ collaboratore, offerta });
	return {
		collaboratore,
		amministratore,
		cliente: cliente.ragioneSociale,
		offerta: offerta.codice,
		clienteId: cliente.id,
		offertaId: offerta.id,
	};
}

async function rigaEsistente(s: Scenario, m: Mese, g = 10) {
	return factory.createRigaAttivita({
		collaboratore: s.collaboratore,
		cliente: { id: s.clienteId } as never,
		offerta: { id: s.offertaId } as never,
		data: new Date(Date.UTC(m.anno, m.mese - 1, g)),
		ore: "2",
		nota: "riga esistente oracolo",
	});
}

async function nuovaPagina(browser: Browser, email: string, larghezza = 1440): Promise<Page> {
	const context = await browser.newContext({ viewport: { width: larghezza, height: 900 } });
	const page = await context.newPage();
	page.on("pageerror", (errore) => appendFileSync(FILE_ERRORI_JS, `${page.url()}: ${errore.message}\n`));
	await accediCome(page, email);
	return page;
}

async function chiudiDaInterfaccia(browser: Browser, s: Scenario, m: Mese): Promise<void> {
	const admin = await nuovaPagina(browser, s.amministratore.utente.email);
	await adattatore.chiudiMese(admin, m);
	appendFileSync(FILE_CHIUSURE, `${tokenMese(m)}\n`);
	await admin.context().close();
}

/** Controlli visibili e abilitati: un controllo disabilitato o nascosto non conta come azione. */
async function contaAttivi(locator: Locator): Promise<number> {
	return locator.evaluateAll(
		(elementi) =>
			elementi.filter((e) => {
				const el = e as HTMLElement & { disabled?: boolean };
				const stile = getComputedStyle(el);
				return (
					!el.disabled &&
					el.getAttribute("aria-disabled") !== "true" &&
					stile.visibility !== "hidden" &&
					stile.display !== "none" &&
					el.getClientRects().length > 0
				);
			}).length,
	);
}

async function righeNelGiorno(s: Scenario, data: string): Promise<number> {
	const { rows } = await e2ePrisma.query(
		`SELECT count(*)::int AS n FROM "RigaAttivita" WHERE "collaboratoreId" = $1 AND "data" = $2::date`,
		[s.collaboratore.collaboratore.id, data],
	);
	return rows[0].n as number;
}

test.describe.configure({ mode: "default" });

// ── visibilità (10) ─────────────────────────────────────────────────────────

test("[visibilita] V1 il calendario del collaboratore mostra il mese chiuso", async ({ browser }) => {
	const s = await scenario();
	const m = meseRiservato("V1");
	await rigaEsistente(s, m);
	await chiudiDaInterfaccia(browser, s, m);
	const page = await nuovaPagina(browser, s.collaboratore.utente.email);
	await page.goto(`/attivita?mese=${tokenMese(m)}`);
	await expect(adattatore.indicatoreMeseChiuso(page).first()).toBeVisible();
});

test("[visibilita] V2 il dettaglio giornata di un mese chiuso è in sola lettura", async ({ browser }) => {
	const s = await scenario();
	const m = meseRiservato("V2");
	await rigaEsistente(s, m);
	await chiudiDaInterfaccia(browser, s, m);
	const page = await nuovaPagina(browser, s.collaboratore.utente.email);
	await page.goto(`/attivita/${giorno(m, 10)}`);
	await expect(adattatore.indicatoreMeseChiuso(page).first()).toBeVisible();
	await expect(page.getByText("riga esistente oracolo").first()).toBeVisible();
	expect(await contaAttivi(adattatore.azioniModificaGiornata(page))).toBe(0);
});

test("[visibilita] V3 in un mese aperto non c'è indicatore e le azioni restano disponibili", async ({ browser }) => {
	const s = await scenario();
	const m = meseRiservato("V3");
	await rigaEsistente(s, m);
	const page = await nuovaPagina(browser, s.collaboratore.utente.email);
	await page.goto(`/attivita/${giorno(m, 10)}`);
	await expect(page.getByText("riga esistente oracolo").first()).toBeVisible();
	await expect(adattatore.indicatoreMeseChiuso(page)).toHaveCount(0);
	expect(await contaAttivi(adattatore.azioniModificaGiornata(page))).toBeGreaterThan(0);
});

test("[visibilita] V4 il report indica che il mese è chiuso", async ({ browser }) => {
	const s = await scenario();
	const m = meseRiservato("V4");
	await chiudiDaInterfaccia(browser, s, m);
	const admin = await nuovaPagina(browser, s.amministratore.utente.email);
	await expect(await adattatore.statoMeseNelReport(admin, m)).toBeVisible();
});

// ── scheda con cache obsoleta (6) ───────────────────────────────────────────

test("[cache] S1 un salvataggio da una scheda aperta prima della chiusura è rifiutato con un errore chiaro", async ({ browser }) => {
	const s = await scenario();
	const m = meseRiservato("S1");
	const data = giorno(m, 14);
	const page = await nuovaPagina(browser, s.collaboratore.utente.email);
	await page.goto(`/attivita?mese=${tokenMese(m)}`); // popola la cache client del calendario
	await page.goto(`/attivita/${data}`);
	await adattatore.compilaNuovaRiga(page, {
		cliente: s.cliente,
		offerta: s.offerta,
		clienteId: s.clienteId,
		offertaId: s.offertaId,
		ore: "3",
	});
	await chiudiDaInterfaccia(browser, s, m);
	await adattatore.inviaNuovaRiga(page);
	await expect(adattatore.messaggioErrore(page).first()).toBeVisible();
	expect(await righeNelGiorno(s, data)).toBe(0);
});

// ── interfaccia e flussi (6) ────────────────────────────────────────────────

test("[interfaccia] U1 riapertura dall'interfaccia: il collaboratore torna a poter modificare", async ({ browser }) => {
	const s = await scenario();
	const m = meseRiservato("U1");
	await rigaEsistente(s, m);
	const admin = await nuovaPagina(browser, s.amministratore.utente.email);
	await adattatore.chiudiMese(admin, m);
	await adattatore.riapriMese(admin, m, "Correzione ore dal browser");
	const page = await nuovaPagina(browser, s.collaboratore.utente.email);
	await page.goto(`/attivita/${giorno(m, 10)}`);
	await expect(page.getByText("riga esistente oracolo").first()).toBeVisible();
	await expect(adattatore.indicatoreMeseChiuso(page)).toHaveCount(0);
	expect(await contaAttivi(adattatore.azioniModificaGiornata(page))).toBeGreaterThan(0);
});

test("[interfaccia] U2 nessun overflow orizzontale a 390 px", async ({ browser }) => {
	const s = await scenario();
	const m = meseRiservato("U2");
	await rigaEsistente(s, m);
	await chiudiDaInterfaccia(browser, s, m);
	const admin = await nuovaPagina(browser, s.amministratore.utente.email, 390);
	const collaboratore = await nuovaPagina(browser, s.collaboratore.utente.email, 390);
	const visite: Array<[Page, string]> = [
		...adattatore.pagineFunzionalita(m).map((p) => [admin, p] as [Page, string]),
		[collaboratore, `/attivita?mese=${tokenMese(m)}`],
		[collaboratore, `/attivita/${giorno(m, 10)}`],
	];
	for (const [page, percorso] of visite) {
		await page.goto(percorso);
		await page.waitForLoadState("networkidle");
		const eccedenza = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
		expect(eccedenza, `overflow su ${percorso}`).toBeLessThanOrEqual(1);
	}
});

test("[interfaccia] U3 nessuna eccezione JavaScript non gestita durante i flussi", async () => {
	// Significativo solo se i flussi della funzionalità sono stati davvero esercitati.
	expect(existsSync(FILE_CHIUSURE), "nessuna chiusura riuscita dall'interfaccia").toBe(true);
	const errori = existsSync(FILE_ERRORI_JS) ? readFileSync(FILE_ERRORI_JS, "utf8").trim() : "";
	expect(errori).toBe("");
});
