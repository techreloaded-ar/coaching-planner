/**
 * Oracolo T4 · livello browser. Titoli "[area] CODICE descrizione".
 * Le pagine mostrano valori arrotondati: l'avanzamento della baseline usa un decimale, quindi
 * 0,75 giornate può apparire come 0,8 gg (valore esatto verificato in F1 dell'integrazione).
 */
import { test, expect } from "../tests/e2e/support/fixtures";
import type { E2eDataFactory } from "../tests/e2e/support/factory";
import { dataNelMesePassatoRiservato, mesePassatoRiservato } from "../tests/e2e/support/date";
import { eccedenzaOrizzontale, nuovaPagina, regexImporto, regexNumero } from "./shared/browser";
import { adattatoreBrowser as adattatore } from "./adattatore/browser";

/** Caso del profilo: Ada, due righe fatturabili da 3 ore il 12 e il 19, tariffa 400, offerta 640. */
async function casoAda(factory: E2eDataFactory, chiave: string) {
	const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
	const { cliente, offerta } = await factory.createClienteConOfferta({}, { tariffaGiornaliera: "640.00", giorniPrevisti: 10 });
	const ada = await factory.createCollaboratore({ nome: "Ada", tariffaGiornaliera: "400.00" });
	const marco = await factory.createCollaboratore({ nome: "Marco", tariffaGiornaliera: "400.00" });
	for (const c of [ada, marco]) await factory.createAbilitazioneOfferta({ collaboratore: c, offerta });
	for (const giorno of [12, 19]) {
		await factory.createRigaAttivita({
			collaboratore: ada,
			cliente,
			offerta,
			data: new Date(`${dataNelMesePassatoRiservato(chiave, giorno)}T00:00:00.000Z`),
			ore: "3",
			nota: `riga oracolo ada ${giorno}`,
		});
	}
	await factory.createRigaAttivita({
		collaboratore: marco,
		cliente,
		offerta,
		data: new Date(`${dataNelMesePassatoRiservato(chiave, 20)}T00:00:00.000Z`),
		ore: "8",
		nota: "riga oracolo marco",
	});
	return { amministratore, cliente, offerta, ada, marco, token: mesePassatoRiservato(chiave) };
}

test("[interfaccia] U1 riepilogo mostra importi corretti per il caso 3+3 ore", async ({ browser, factory }, testInfo) => {
	const s = await casoAda(factory, "ORACOLO-T4-U1");
	const { page } = await nuovaPagina(browser, testInfo, s.ada.utente.email);
	await page.goto(adattatore.percorsoRiepilogo(s.token));
	await expect(adattatore.importoFatturaRiepilogo(page)).toContainText(regexImporto(300));
	await expect(adattatore.giornateFatturabiliRiepilogo(page)).toContainText(regexNumero("0,75"));
});

test("[interfaccia] U2 avanzamento mostra l'erogato corretto nel caso 3+3 ore", async ({ browser, factory }, testInfo) => {
	// Solo le due righe di Ada: l'erogato dell'offerta è esattamente 0,75 giornate.
	const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
	const { cliente, offerta } = await factory.createClienteConOfferta({}, { tariffaGiornaliera: "640.00", giorniPrevisti: 10 });
	const ada = await factory.createCollaboratore({ nome: "Ada", tariffaGiornaliera: "400.00" });
	for (const giorno of [12, 19]) {
		await factory.createRigaAttivita({
			collaboratore: ada,
			cliente,
			offerta,
			data: new Date(`${dataNelMesePassatoRiservato("ORACOLO-T4-U2", giorno)}T00:00:00.000Z`),
			ore: "3",
		});
	}
	const { page } = await nuovaPagina(browser, testInfo, amministratore.email);
	const voce = await adattatore.apriAvanzamentoOfferta(page, { id: offerta.id, codice: offerta.codice, clienteId: cliente.id });
	await expect(voce).toContainText(offerta.codice);
	// 0,75 esatto oppure 0,8 con il decimale unico della UI baseline; la baseline difettosa mostra 0,7 (0,74).
	await expect(voce).toContainText(/(^|[^\d,])(0,75|0,8)(?!\d)/);
});

test("[interfaccia] U3 report fatturazione resta invariato", async ({ browser, factory }, testInfo) => {
	const s = await casoAda(factory, "ORACOLO-T4-U3");
	const { page } = await nuovaPagina(browser, testInfo, s.amministratore.email);
	await page.goto(adattatore.percorsoReportFatturazione(s.token));
	const scheda = adattatore.schedaClienteReport(page, s.cliente.id);
	// 6 ore di Ada (0,75 gg) + 8 ore di Marco (1 gg) a tariffa offerta 640 = 480 + 640.
	await expect(scheda).toContainText(s.cliente.ragioneSociale);
	await expect(scheda).toContainText(regexImporto(1120));
});

test("[interfaccia] U4 riepilogo e avanzamento fruibili a 390 px", async ({ browser, factory }, testInfo) => {
	const s = await casoAda(factory, "ORACOLO-T4-U4");
	const collaboratrice = await nuovaPagina(browser, testInfo, s.ada.utente.email, 390);
	await collaboratrice.page.goto(adattatore.percorsoRiepilogo(s.token));
	await expect(adattatore.importoFatturaRiepilogo(collaboratrice.page)).toBeVisible();
	await collaboratrice.page.waitForLoadState("networkidle");
	expect(await eccedenzaOrizzontale(collaboratrice.page), "overflow nel riepilogo").toBeLessThanOrEqual(1);

	const admin = await nuovaPagina(browser, testInfo, s.amministratore.email, 390);
	const voce = await adattatore.apriAvanzamentoOfferta(admin.page, { id: s.offerta.id, codice: s.offerta.codice, clienteId: s.cliente.id });
	await expect(voce).toContainText(s.offerta.codice);
	await admin.page.waitForLoadState("networkidle");
	expect(await eccedenzaOrizzontale(admin.page), "overflow nell'avanzamento").toBeLessThanOrEqual(1);
});

test("[interfaccia] U5 pagine a 1440 px senza errori JavaScript", async ({ browser, factory }, testInfo) => {
	const s = await casoAda(factory, "ORACOLO-T4-U5");
	const collaboratrice = await nuovaPagina(browser, testInfo, s.ada.utente.email, 1440);
	await collaboratrice.page.goto(adattatore.percorsoRiepilogo(s.token));
	await expect(adattatore.importoFatturaRiepilogo(collaboratrice.page)).toBeVisible();
	await collaboratrice.page.waitForLoadState("networkidle");

	const admin = await nuovaPagina(browser, testInfo, s.amministratore.email, 1440);
	await expect(
		await adattatore.apriAvanzamentoOfferta(admin.page, { id: s.offerta.id, codice: s.offerta.codice, clienteId: s.cliente.id }),
	).toContainText(s.offerta.codice);
	await admin.page.waitForLoadState("networkidle");
	await admin.page.goto(adattatore.percorsoReportFatturazione(s.token));
	await expect(adattatore.schedaClienteReport(admin.page, s.cliente.id)).toBeVisible();
	await admin.page.waitForLoadState("networkidle");

	expect([...collaboratrice.erroriJs, ...admin.erroriJs]).toEqual([]);
});

test("[interfaccia] U6 isolamento collaboratori preservato", async ({ browser, factory }, testInfo) => {
	const s = await casoAda(factory, "ORACOLO-T4-U6");
	const { page } = await nuovaPagina(browser, testInfo, s.marco.utente.email);
	await page.goto(adattatore.percorsoRiepilogo(s.token));
	// Marco vede solo la propria giornata da 8 ore (400 €), mai le righe o l'importo di Ada.
	await expect(adattatore.importoFatturaRiepilogo(page)).toContainText(regexImporto(400));
	await expect(page.getByText("riga oracolo ada 12")).toHaveCount(0);
	await expect(adattatore.importoFatturaRiepilogo(page)).not.toContainText(regexImporto(700));

	await page.goto(adattatore.percorsoAvanzamento());
	await page.waitForLoadState("networkidle");
	await expect(page.getByText(s.offerta.codice)).toHaveCount(0);
	await page.goto(adattatore.percorsoReportFatturazione(s.token));
	await page.waitForLoadState("networkidle");
	await expect(page.getByText(s.cliente.ragioneSociale)).toHaveCount(0);
});
