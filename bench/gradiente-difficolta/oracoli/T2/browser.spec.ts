/**
 * Oracolo T2 · livello browser. Titoli "[area] CODICE descrizione".
 * Ogni test crea amministratore, cliente, offerta e collaboratore propri; mesi riservati.
 */
import { test, expect } from "../tests/e2e/support/fixtures";
import type { E2eDataFactory } from "../tests/e2e/support/factory";
import { mesePassatoRiservato } from "../tests/e2e/support/date";
import { eccedenzaOrizzontale, nuovaPagina, regexImporto } from "./shared/browser";
import { meseDopo } from "./shared/date-oracolo";
import { adattatoreBrowser as adattatore } from "./adattatore/browser";

async function scenario(factory: E2eDataFactory, righe: Array<{ token: string; giorno: number; ore: string; fatturabile?: boolean }>) {
	const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
	const { cliente, offerta } = await factory.createClienteConOfferta({}, { tariffaGiornaliera: "640.00" });
	const collaboratore = await factory.createCollaboratore({ tariffaGiornaliera: "400.00" });
	await factory.createAbilitazioneOfferta({ collaboratore, offerta });
	for (const r of righe) {
		await factory.createRigaAttivita({
			collaboratore,
			cliente,
			offerta,
			data: new Date(`${r.token}-${String(r.giorno).padStart(2, "0")}T00:00:00.000Z`),
			ore: r.ore,
			fatturabile: r.fatturabile ?? true,
		});
	}
	return { amministratore, cliente, offerta, collaboratore };
}

test("[visibilita] S1 report mostra cliente, offerte e collaboratori con importi", async ({ browser, factory }, testInfo) => {
	const m = mesePassatoRiservato("ORACOLO-T2-S1");
	const s = await scenario(factory, [{ token: m, giorno: 10, ore: "8" }]);
	const { page } = await nuovaPagina(browser, testInfo, s.amministratore.email);
	await adattatore.apriReport(page, m, m);
	const sezione = await adattatore.sezioneCliente(page, s.cliente.id, s.cliente.ragioneSociale);
	await expect(sezione).toContainText(s.cliente.ragioneSociale);
	await expect(sezione).toContainText(s.offerta.codice);
	await expect(sezione).toContainText(s.collaboratore.collaboratore.cognome);
	await expect(sezione).toContainText(regexImporto(640));
	await expect(sezione).toContainText(regexImporto(400));
	await expect(sezione).toContainText(regexImporto(240));
});

test("[visibilita] S2 report raggiungibile dal back-office amministratore", async ({ browser, factory }, testInfo) => {
	const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
	const { page } = await nuovaPagina(browser, testInfo, amministratore.email);
	await page.goto(adattatore.percorsoBackOffice());
	const collegamento = adattatore.collegamentoAlReport(page);
	await expect(collegamento).toBeVisible();
	await collegamento.click();
	await expect(adattatore.contenitoreReport(page)).toBeVisible();
});

test("[visibilita] S3 filtro mese iniziale e finale modifica il risultato", async ({ browser, factory }, testInfo) => {
	const m = mesePassatoRiservato("ORACOLO-T2-S3");
	const successivo = meseDopo(m, 1);
	const s = await scenario(factory, [
		{ token: m, giorno: 12, ore: "4" },
		{ token: successivo, giorno: 3, ore: "4" },
	]);
	const { page } = await nuovaPagina(browser, testInfo, s.amministratore.email);
	await adattatore.apriReport(page, m, m);
	const soloPrimo = await adattatore.sezioneCliente(page, s.cliente.id, s.cliente.ragioneSociale);
	await expect(soloPrimo).toContainText(regexImporto(320));
	await expect(soloPrimo).not.toContainText(regexImporto(640));

	await adattatore.impostaPeriodoDaInterfaccia(page, m, successivo);
	const dueMesi = await adattatore.sezioneCliente(page, s.cliente.id, s.cliente.ragioneSociale);
	await expect(dueMesi).toContainText(regexImporto(640));
	await expect(dueMesi).toContainText(regexImporto(400));
});

test("[visibilita] U1 report fruibile a 390 px senza overflow pagina", async ({ browser, factory }, testInfo) => {
	const m = mesePassatoRiservato("ORACOLO-T2-U1");
	const s = await scenario(factory, [
		{ token: m, giorno: 5, ore: "8" },
		{ token: m, giorno: 6, ore: "4", fatturabile: false },
	]);
	const { page } = await nuovaPagina(browser, testInfo, s.amministratore.email, 390);
	await adattatore.apriReport(page, m, m);
	const sezione = await adattatore.sezioneCliente(page, s.cliente.id, s.cliente.ragioneSociale);
	await expect(sezione).toContainText(s.cliente.ragioneSociale);
	await page.waitForLoadState("networkidle");
	expect(await eccedenzaOrizzontale(page)).toBeLessThanOrEqual(1);
});

test("[visibilita] U2 report fruibile a 1440 px senza errori JavaScript", async ({ browser, factory }, testInfo) => {
	const m = mesePassatoRiservato("ORACOLO-T2-U2");
	const s = await scenario(factory, [
		{ token: m, giorno: 7, ore: "8" },
		{ token: meseDopo(m, 1), giorno: 8, ore: "2" },
	]);
	const { page, erroriJs } = await nuovaPagina(browser, testInfo, s.amministratore.email, 1440);
	await adattatore.apriReport(page, m, meseDopo(m, 1));
	const sezione = await adattatore.sezioneCliente(page, s.cliente.id, s.cliente.ragioneSociale);
	await expect(sezione).toContainText(regexImporto(800));
	await page.waitForLoadState("networkidle");
	expect(await eccedenzaOrizzontale(page)).toBeLessThanOrEqual(1);
	expect(erroriJs).toEqual([]);
});
