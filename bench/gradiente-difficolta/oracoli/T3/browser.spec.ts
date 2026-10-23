/**
 * Oracolo T3 · livello browser. Titoli "[area] CODICE descrizione".
 * Offerte e collaboratori con tariffe sono preparati con `adattatoreDati` (SQL nella schema della
 * consegna); utenti amministratori, clienti e righe con la factory del test.
 */
import { test, expect } from "../tests/e2e/support/fixtures";
import { dataNelMesePassatoRiservato, mesePassatoRiservato } from "../tests/e2e/support/date";
import { e2ePrisma } from "../tests/e2e/support/prisma";
import type { Offerta } from "../src/generated/prisma/client";
import { eccedenzaOrizzontale, nuovaPagina, regexImporto } from "./shared/browser";
import { adattatoreDati as dati } from "./adattatore/dati";
import { adattatoreBrowser as adattatore } from "./adattatore/browser";

const CAPODANNO_PROSSIMO = `${new Date().getUTCFullYear() + 1}-01-01`;

function sigla(namespace: string): string {
	return namespace.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
}

test("[visibilita] S1 form offerta esistente continua a creare/modificare offerte", async ({ browser, factory, namespace }, testInfo) => {
	const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
	const cliente = await factory.createCliente();
	const codice = `ORC-${sigla(namespace)}`;
	const { page } = await nuovaPagina(browser, testInfo, amministratore.email);
	await adattatore.creaOffertaDaForm(page, {
		clienteId: cliente.id,
		codice,
		descrizione: "Percorso oracolo T3",
		tariffa: "615",
		giorniPrevisti: "12",
	});
	const { rows } = await e2ePrisma.query(
		`SELECT "id", "descrizione", "giorniPrevisti" FROM "Offerta" WHERE "codice" = $1 AND "clienteId" = $2`,
		[codice, cliente.id],
	);
	expect(rows, "offerta creata dal form").toHaveLength(1);
	expect(rows[0].giorniPrevisti).toBe(12);
	const offertaId = rows[0].id as string;
	expect((await dati.validita({ tipo: "offerta", id: offertaId })).map((v) => v.tariffa)).toEqual([615]);

	await adattatore.modificaDescrizioneOffertaDaForm(page, { id: offertaId, clienteId: cliente.id }, "Percorso oracolo T3 rivisto");
	const { rows: dopo } = await e2ePrisma.query(`SELECT "descrizione" FROM "Offerta" WHERE "id" = $1`, [offertaId]);
	expect(dopo[0].descrizione).toBe("Percorso oracolo T3 rivisto");
	expect((await dati.validita({ tipo: "offerta", id: offertaId })).map((v) => v.tariffa)).toEqual([615]);
});

test("[visibilita] S2 form collaboratore esistente continua a funzionare", async ({ browser, factory, namespace }, testInfo) => {
	const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
	const c = await dati.creaCollaboratore({ namespace, ruolo: "COLLABORATORE", tariffe: [{ decorrenza: null, tariffa: 400 }] });
	const nuovoCognome = `Oracolo ${sigla(namespace)}`;
	const { page } = await nuovaPagina(browser, testInfo, amministratore.email);
	await adattatore.modificaCognomeCollaboratoreDaForm(page, c.collaboratoreId, nuovoCognome);
	const { rows } = await e2ePrisma.query(`SELECT "cognome", "attivo" FROM "Collaboratore" WHERE "id" = $1`, [c.collaboratoreId]);
	expect(rows[0].cognome).toBe(nuovoCognome);
	expect(rows[0].attivo).toBe(true);
	expect((await dati.validita({ tipo: "collaboratore", id: c.collaboratoreId })).map((v) => v.tariffa)).toEqual([400]);
});

test("[visibilita] S3 amministratore pianifica tariffa futura tramite UI", async ({ browser, factory, namespace }, testInfo) => {
	const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
	const cliente = await factory.createCliente();
	const o = await dati.creaOfferta({ namespace, clienteId: cliente.id, giorniPrevisti: 10, tariffe: [{ decorrenza: null, tariffa: 600 }] });
	const c = await dati.creaCollaboratore({ namespace, ruolo: "COLLABORATORE", tariffe: [{ decorrenza: null, tariffa: 400 }] });
	const { page } = await nuovaPagina(browser, testInfo, amministratore.email);

	await adattatore.pianificaTariffaDaInterfaccia(page, { tipo: "offerta", id: o.offertaId }, { decorrenza: CAPODANNO_PROSSIMO, tariffa: "655" });
	await adattatore.pianificaTariffaDaInterfaccia(page, { tipo: "collaboratore", id: c.collaboratoreId }, { decorrenza: CAPODANNO_PROSSIMO, tariffa: "435" });

	const offerta = await dati.validita({ tipo: "offerta", id: o.offertaId });
	expect(offerta.find((v) => v.decorrenza === CAPODANNO_PROSSIMO)?.tariffa).toBe(655);
	expect(offerta.some((v) => v.tariffa === 600)).toBe(true);
	const collaboratore = await dati.validita({ tipo: "collaboratore", id: c.collaboratoreId });
	expect(collaboratore.find((v) => v.decorrenza === CAPODANNO_PROSSIMO)?.tariffa).toBe(435);
	expect(collaboratore.some((v) => v.tariffa === 400)).toBe(true);
});

test("[visibilita] U1 gestione tariffe a 390 px senza overflow pagina", async ({ browser, factory, namespace }, testInfo) => {
	const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
	const cliente = await factory.createCliente();
	const o = await dati.creaOfferta({
		namespace,
		clienteId: cliente.id,
		giorniPrevisti: 10,
		tariffe: [
			{ decorrenza: null, tariffa: 600 },
			{ decorrenza: CAPODANNO_PROSSIMO, tariffa: 650 },
		],
	});
	const c = await dati.creaCollaboratore({
		namespace,
		ruolo: "COLLABORATORE",
		tariffe: [
			{ decorrenza: null, tariffa: 400 },
			{ decorrenza: CAPODANNO_PROSSIMO, tariffa: 430 },
		],
	});
	const { page } = await nuovaPagina(browser, testInfo, amministratore.email, 390);
	const percorsi = [
		...adattatore.percorsiGestioneTariffe({ tipo: "offerta", id: o.offertaId }),
		...adattatore.percorsiGestioneTariffe({ tipo: "collaboratore", id: c.collaboratoreId }),
	];
	expect(percorsi.length).toBeGreaterThan(0);
	for (const percorso of percorsi) {
		await page.goto(percorso);
		await expect(adattatore.elencoValidita(page).first()).toBeVisible();
		await page.waitForLoadState("networkidle");
		expect(await eccedenzaOrizzontale(page), `overflow su ${percorso}`).toBeLessThanOrEqual(1);
	}
});

test("[visibilita] U2 report a 1440 px senza errori JavaScript", async ({ browser, factory, namespace }, testInfo) => {
	const chiave = "ORACOLO-T3-U2";
	const token = mesePassatoRiservato(chiave);
	const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
	const cliente = await factory.createCliente();
	const o = await dati.creaOfferta({
		namespace,
		clienteId: cliente.id,
		giorniPrevisti: 10,
		tariffe: [
			{ decorrenza: null, tariffa: 600 },
			{ decorrenza: dataNelMesePassatoRiservato(chiave, 15), tariffa: 700 },
		],
	});
	const c = await dati.creaCollaboratore({ namespace, ruolo: "COLLABORATORE", tariffe: [{ decorrenza: null, tariffa: 400 }] });
	const offerta = { id: o.offertaId, clienteId: cliente.id } as Offerta;
	for (const [giorno, ore] of [
		[10, "8"],
		[20, "4"],
	] as const) {
		await factory.createRigaAttivita({
			collaboratore: { id: c.collaboratoreId } as never,
			offerta,
			data: new Date(`${dataNelMesePassatoRiservato(chiave, giorno)}T00:00:00.000Z`),
			ore,
		});
	}
	const { page, erroriJs } = await nuovaPagina(browser, testInfo, amministratore.email, 1440);
	await page.goto(adattatore.percorsoReportFatturazione(token));
	// 8 ore a 600 prima della decorrenza + 4 ore a 700 dopo = 950.
	await expect(adattatore.schedaClienteReport(page, cliente.id)).toContainText(regexImporto(950));
	await page.waitForLoadState("networkidle");
	await page.goto(adattatore.percorsoAvanzamento());
	await expect(page.getByText(o.codice).first()).toBeVisible();
	await page.waitForLoadState("networkidle");
	expect(erroriJs).toEqual([]);
});
