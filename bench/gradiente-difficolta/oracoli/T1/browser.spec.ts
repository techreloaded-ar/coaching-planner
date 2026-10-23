/**
 * Oracolo T1 · livello browser. Titoli "[area] CODICE descrizione".
 * fullyParallel: ogni test crea con la factory (namespace del test) i propri utenti e clienti.
 */
import { test, expect } from "../tests/e2e/support/fixtures";
import type { E2eDataFactory } from "../tests/e2e/support/factory";
import { dataNelMesePassatoRiservato, mesePassatoRiservato } from "../tests/e2e/support/date";
import { contaControlliAttivi, eccedenzaOrizzontale, nuovaPagina, regexTelefono } from "./shared/browser";
import { adattatoreBrowser as adattatore } from "./adattatore/browser";

function referenteDi(namespace: string) {
	const sigla = namespace.slice(-8);
	return { nome: `Paola Neri ${sigla}`, email: `paola.neri.${sigla}@cliente-oracolo.it`, telefono: "+39 011 5559876" };
}

async function scenario(factory: E2eDataFactory, namespace: string) {
	const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
	const cliente = await factory.createCliente();
	const referente = referenteDi(namespace);
	await adattatore.impostaReferente(cliente.id, referente);
	return { amministratore, cliente, referente };
}

test("[visibilita] S1 referente completo nel dettaglio cliente", async ({ browser, factory, namespace }, testInfo) => {
	const s = await scenario(factory, namespace);
	const { page } = await nuovaPagina(browser, testInfo, s.amministratore.email);
	await page.goto(adattatore.percorsoDettaglioCliente(s.cliente.id));
	await expect(page.getByText(s.referente.nome).first()).toBeVisible();
	await expect(page.getByText(s.referente.email).first()).toBeVisible();
	await expect(page.getByText(regexTelefono(s.referente.telefono)).first()).toBeVisible();
});

test("[visibilita] S2 referente visibile in elenco clienti", async ({ browser, factory, namespace }, testInfo) => {
	const s = await scenario(factory, namespace);
	const { page } = await nuovaPagina(browser, testInfo, s.amministratore.email);
	await page.goto(adattatore.percorsoElencoClienti());
	const voce = adattatore.voceClienteInElenco(page, s.cliente.ragioneSociale);
	await expect(voce).toBeVisible();
	await expect(voce).toContainText(s.referente.nome);
});

test("[visibilita] S3 referente nell'intestazione cliente del report fatturazione", async ({ browser, factory, namespace }, testInfo) => {
	const s = await scenario(factory, namespace);
	const collaboratore = await factory.createCollaboratore();
	const offerta = await factory.createOfferta({ cliente: s.cliente, tariffaGiornaliera: "600.00" });
	await factory.createAbilitazioneOfferta({ collaboratore, offerta });
	await factory.createRigaAttivita({
		collaboratore,
		cliente: s.cliente,
		offerta,
		data: new Date(`${dataNelMesePassatoRiservato("ORACOLO-T1-S3", 9)}T00:00:00.000Z`),
		ore: "8",
	});
	const { page } = await nuovaPagina(browser, testInfo, s.amministratore.email);
	await page.goto(adattatore.percorsoReportFatturazione(mesePassatoRiservato("ORACOLO-T1-S3")));
	const intestazione = adattatore.intestazioneClienteReport(page, s.cliente.id);
	await expect(intestazione).toContainText(s.cliente.ragioneSociale);
	await expect(intestazione).toContainText(s.referente.nome);
	await expect(intestazione).toContainText(s.referente.email);
	await expect(intestazione).toContainText(regexTelefono(s.referente.telefono));
});

test("[visibilita] S4 amministratore modifica il referente tramite form", async ({ browser, factory, namespace }, testInfo) => {
	const s = await scenario(factory, namespace);
	const nuovo = { nome: `Giorgio Gallo ${namespace.slice(-6)}`, email: `giorgio.gallo.${namespace.slice(-6)}@cliente-oracolo.it`, telefono: "+39 02 4441212" };
	const { page } = await nuovaPagina(browser, testInfo, s.amministratore.email);
	await page.goto(adattatore.percorsoModificaReferente(s.cliente.id));
	const campi = adattatore.campiReferente(page);
	await campi.nome.fill(nuovo.nome);
	await campi.email.fill(nuovo.email);
	await campi.telefono.fill(nuovo.telefono);
	await adattatore.salvaForm(page);
	await page.goto(adattatore.percorsoDettaglioCliente(s.cliente.id));
	await expect(page.getByText(nuovo.nome).first()).toBeVisible();
	await expect(page.getByText(nuovo.email).first()).toBeVisible();
	await expect(page.getByText(s.referente.nome)).toHaveCount(0);
});

test("[interfaccia] U1 form e dettaglio fruibili a 390 px senza overflow", async ({ browser, factory, namespace }, testInfo) => {
	const s = await scenario(factory, namespace);
	const { page } = await nuovaPagina(browser, testInfo, s.amministratore.email, 390);
	await page.goto(adattatore.percorsoModificaReferente(s.cliente.id));
	const campi = adattatore.campiReferente(page);
	for (const campo of [campi.nome, campi.email, campi.telefono]) {
		await campo.scrollIntoViewIfNeeded();
		await expect(campo).toBeVisible();
		const box = await campo.boundingBox();
		expect(box, "campo del referente con dimensioni").not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(391);
	}
	expect(await eccedenzaOrizzontale(page), "overflow nel form").toBeLessThanOrEqual(1);

	await page.goto(adattatore.percorsoDettaglioCliente(s.cliente.id));
	await expect(page.getByText(s.referente.nome).first()).toBeVisible();
	expect(await eccedenzaOrizzontale(page), "overflow nel dettaglio").toBeLessThanOrEqual(1);
});

test("[interfaccia] U2 report fruibile a 1440 px senza errori JavaScript", async ({ browser, factory, namespace }, testInfo) => {
	const s = await scenario(factory, namespace);
	const collaboratore = await factory.createCollaboratore();
	const offerta = await factory.createOfferta({ cliente: s.cliente });
	await factory.createAbilitazioneOfferta({ collaboratore, offerta });
	await factory.createRigaAttivita({
		collaboratore,
		cliente: s.cliente,
		offerta,
		data: new Date(`${dataNelMesePassatoRiservato("ORACOLO-T1-U2", 14)}T00:00:00.000Z`),
		ore: "4",
	});
	const { page, erroriJs } = await nuovaPagina(browser, testInfo, s.amministratore.email, 1440);
	await page.goto(adattatore.percorsoReportFatturazione(mesePassatoRiservato("ORACOLO-T1-U2")));
	await expect(adattatore.intestazioneClienteReport(page, s.cliente.id)).toContainText(s.referente.nome);
	await page.waitForLoadState("networkidle");
	expect(await eccedenzaOrizzontale(page)).toBeLessThanOrEqual(1);
	expect(erroriJs).toEqual([]);
});

test("[interfaccia] U3 errore email chiaro nel form", async ({ browser, factory, namespace }, testInfo) => {
	const s = await scenario(factory, namespace);
	const { page } = await nuovaPagina(browser, testInfo, s.amministratore.email);
	await page.goto(adattatore.percorsoModificaReferente(s.cliente.id));
	const campi = adattatore.campiReferente(page);
	await campi.email.fill("paola.neri@");
	await adattatore.salvaForm(page);
	const errore = adattatore.erroreEmailReferente(page).first();
	await expect(errore).toBeVisible();
	await expect(errore).toHaveText(/e-?mail|indirizzo|posta/i);
	await page.goto(adattatore.percorsoDettaglioCliente(s.cliente.id));
	await expect(page.getByText(s.referente.email).first()).toBeVisible();
});

test("[interfaccia] U4 nessun controllo modifica referente per non amministratore", async ({ browser, factory, namespace }, testInfo) => {
	const s = await scenario(factory, namespace);
	const collaboratore = await factory.createCollaboratore();
	const { page } = await nuovaPagina(browser, testInfo, collaboratore.utente.email);
	for (const percorso of [
		adattatore.percorsoElencoClienti(),
		adattatore.percorsoDettaglioCliente(s.cliente.id),
		adattatore.percorsoModificaReferente(s.cliente.id),
	]) {
		await page.goto(percorso);
		await page.waitForLoadState("networkidle");
		expect(await contaControlliAttivi(adattatore.controlliModificaReferente(page)), `controlli attivi su ${percorso}`).toBe(0);
	}
});
