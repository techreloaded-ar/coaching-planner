/**
 * Oracolo T2 · livello integrazione. Titoli "[area] CODICE descrizione".
 * Ogni test usa cliente, offerte e collaboratori propri (factory) in mesi riservati: le
 * asserzioni guardano solo le proprie entità, salvo P1 che fotografa l'intero database.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { createE2eDataFactory, type CollaboratoreTestData } from "../tests/e2e/support/factory";
import { mesePassatoRiservato } from "../tests/e2e/support/date";
import type { Cliente, Offerta } from "../src/generated/prisma/client";
import {
	come,
	creaUtenteCliente,
	dataUtc,
	giornoDi,
	improntaDatabase,
	meseDopo,
	tenta,
	utenteDi,
} from "./shared/integrazione";
import type { ClienteMarginalita, ReportMarginalita, RifiutoMarginalita, UtenteSessione } from "./contratto";
import { adattatoreIntegrazione as adattatore } from "./adattatore/integrazione";

const factory = createE2eDataFactory(`oracolo-t2-int-${process.pid}-${Date.now()}`);
let amministratore: UtenteSessione;

type Scenario = { cliente: Cliente; offerta: Offerta; collaboratore: CollaboratoreTestData };

async function scenario(tariffaOfferta = "640.00", tariffaCollaboratore = "400.00"): Promise<Scenario> {
	const { cliente, offerta } = await factory.createClienteConOfferta({}, { tariffaGiornaliera: tariffaOfferta });
	const collaboratore = await factory.createCollaboratore({ tariffaGiornaliera: tariffaCollaboratore });
	await factory.createAbilitazioneOfferta({ collaboratore, offerta });
	return { cliente, offerta, collaboratore };
}

async function riga(
	s: { cliente: Cliente; offerta: Offerta; collaboratore: CollaboratoreTestData },
	token: string,
	giorno: number,
	ore: string,
	extra: { fatturabile?: boolean; rimborso?: string } = {},
) {
	return factory.createRigaAttivita({
		collaboratore: s.collaboratore,
		cliente: s.cliente,
		offerta: s.offerta,
		data: dataUtc(giornoDi(token, giorno)),
		ore,
		fatturabile: extra.fatturabile ?? true,
		rimborsoTrasfertaEtichetta: extra.rimborso ? "Trasferta oracolo" : null,
		rimborsoTrasfertaImporto: extra.rimborso ?? null,
	});
}

function eRifiuto(esito: unknown): esito is RifiutoMarginalita {
	return Boolean(esito) && (esito as RifiutoMarginalita).rifiutato === true;
}

async function report(da: string, a: string, utente: UtenteSessione | null = amministratore): Promise<ReportMarginalita> {
	await come(utente);
	const esito = await adattatore.reportMarginalita(da, a);
	expect(eRifiuto(esito), "il report deve essere restituito").toBe(false);
	return esito as ReportMarginalita;
}

async function voceCliente(da: string, a: string, clienteId: string): Promise<ClienteMarginalita> {
	const voce = (await report(da, a)).perCliente.find((c) => c.clienteId === clienteId);
	expect(voce, "il cliente compare nel report").toBeDefined();
	return voce!;
}

/** Percentuale in punti (37.5), qualunque sia la scala dichiarata dalla consegna. */
function inPunti(valore: number | null): number | null {
	if (valore === null) return null;
	return adattatore.scalaPercentuale === "frazione" ? valore * 100 : valore;
}

beforeAll(async () => {
	amministratore = utenteDi({ utente: await factory.createUtente({ ruolo: "AMMINISTRATORE" }) });
});

// ── ricavi (4) ──────────────────────────────────────────────────────────────

describe("ricavi", () => {
	test("[ricavi] R1 8 ore fatturabili × tariffa offerta 640 = 640", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-R1");
		const s = await scenario();
		await riga(s, m, 3, "8");
		const voce = await voceCliente(m, m, s.cliente.id);
		expect(voce.ricavi).toBeCloseTo(640, 6);
		expect(voce.perOfferta.find((o) => o.offertaId === s.offerta.id)?.ricavi).toBeCloseTo(640, 6);
	});

	test("[ricavi] R2 4 ore fatturabili × tariffa offerta 640 = 320", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-R2");
		const s = await scenario();
		await riga(s, m, 4, "4");
		expect((await voceCliente(m, m, s.cliente.id)).ricavi).toBeCloseTo(320, 6);
	});

	test("[ricavi] R3 riga non fatturabile non genera ricavo", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-R3");
		const s = await scenario();
		await riga(s, m, 5, "8");
		await riga(s, m, 6, "4", { fatturabile: false });
		const voce = await voceCliente(m, m, s.cliente.id);
		expect(voce.ricavi).toBeCloseTo(640, 6);
		expect(voce.costi, "la riga non fatturabile resta un costo").toBeCloseTo(600, 6);
	});

	test("[ricavi] R4 rimborsi trasferta esclusi dai ricavi", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-R4");
		const s = await scenario();
		await riga(s, m, 7, "8", { rimborso: "55.00" });
		expect((await voceCliente(m, m, s.cliente.id)).ricavi).toBeCloseTo(640, 6);
	});
});

// ── costi (4) ───────────────────────────────────────────────────────────────

describe("costi", () => {
	test("[costi] C1 8 ore × tariffa collaboratore 400 = 400", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-C1");
		const s = await scenario();
		await riga(s, m, 3, "8");
		const voce = await voceCliente(m, m, s.cliente.id);
		expect(voce.costi).toBeCloseTo(400, 6);
		expect(voce.perOfferta.find((o) => o.offertaId === s.offerta.id)?.costi).toBeCloseTo(400, 6);
	});

	test("[costi] C2 4 ore non fatturabili generano costo 200", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-C2");
		const s = await scenario();
		await riga(s, m, 8, "4", { fatturabile: false });
		const voce = await voceCliente(m, m, s.cliente.id);
		expect(voce.costi).toBeCloseTo(200, 6);
		expect(voce.ricavi).toBeCloseTo(0, 6);
	});

	test("[costi] C3 rimborsi esclusi dai costi", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-C3");
		const s = await scenario();
		await riga(s, m, 9, "8", { rimborso: "55.00" });
		await riga(s, m, 10, "4", { fatturabile: false, rimborso: "20.00" });
		expect((await voceCliente(m, m, s.cliente.id)).costi).toBeCloseTo(600, 6);
	});

	test("[costi] C4 due collaboratori con tariffe differenti sono distinti", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-C4");
		const s = await scenario("640.00", "400.00");
		const secondo = await factory.createCollaboratore({ tariffaGiornaliera: "300.00" });
		await factory.createAbilitazioneOfferta({ collaboratore: secondo, offerta: s.offerta });
		await riga(s, m, 11, "8");
		await riga({ ...s, collaboratore: secondo }, m, 11, "8");
		const voce = await voceCliente(m, m, s.cliente.id);
		const collaboratori = voce.perCollaboratore ?? voce.perOfferta.find((o) => o.offertaId === s.offerta.id)?.perCollaboratore;
		expect(collaboratori, "dettaglio per collaboratore presente").toBeTruthy();
		const costoDi = (id: string) => collaboratori!.find((c) => c.collaboratoreId === id)?.costi;
		expect(costoDi(s.collaboratore.collaboratore.id)).toBeCloseTo(400, 6);
		expect(costoDi(secondo.collaboratore.id)).toBeCloseTo(300, 6);
		expect(voce.costi).toBeCloseTo(700, 6);
	});
});

// ── margini (3) ─────────────────────────────────────────────────────────────

describe("margini", () => {
	test("[margini] M1 ricavo 640 e costo 400 producono margine 240 e 37,5 %", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-M1");
		const s = await scenario();
		await riga(s, m, 12, "8");
		const voce = await voceCliente(m, m, s.cliente.id);
		expect(voce.margine).toBeCloseTo(240, 6);
		expect(inPunti(voce.marginePercentuale)).toBeCloseTo(37.5, 6);
		const offerta = voce.perOfferta.find((o) => o.offertaId === s.offerta.id)!;
		expect(offerta.margine).toBeCloseTo(240, 6);
		expect(inPunti(offerta.marginePercentuale)).toBeCloseTo(37.5, 6);
	});

	test("[margini] M2 ricavo zero e costo positivo producono perdita, percentuale non infinita", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-M2");
		const s = await scenario();
		await riga(s, m, 13, "4", { fatturabile: false });
		const voce = await voceCliente(m, m, s.cliente.id);
		expect(voce.ricavi).toBeCloseTo(0, 6);
		expect(voce.margine).toBeCloseTo(-200, 6);
		const percentuale = voce.marginePercentuale;
		expect(percentuale === null || Number.isFinite(percentuale), `percentuale ${percentuale}`).toBe(true);
	});

	test("[margini] M3 totali cliente, offerta e collaboratore riconciliano", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-M3");
		const s = await scenario("640.00", "400.00");
		const secondaOfferta = await factory.createOfferta({ cliente: s.cliente, tariffaGiornaliera: "720.00" });
		const secondo = await factory.createCollaboratore({ tariffaGiornaliera: "360.00" });
		await factory.createAbilitazioneOfferta({ collaboratore: s.collaboratore, offerta: secondaOfferta });
		await factory.createAbilitazioneOfferta({ collaboratore: secondo, offerta: s.offerta });
		await factory.createAbilitazioneOfferta({ collaboratore: secondo, offerta: secondaOfferta });
		await riga(s, m, 14, "8");
		await riga(s, m, 15, "2", { fatturabile: false });
		await riga({ ...s, collaboratore: secondo }, m, 14, "6");
		await riga({ ...s, offerta: secondaOfferta }, m, 16, "4");
		await riga({ ...s, offerta: secondaOfferta, collaboratore: secondo }, m, 17, "8", { rimborso: "30.00" });

		const voce = await voceCliente(m, m, s.cliente.id);
		// ricavi: 640 + 6/8·640 + 4/8·720 + 720 = 640 + 480 + 360 + 720; costi: 400·(8+2+4)/8 + 360·(6+8)/8
		expect(voce.ricavi).toBeCloseTo(2200, 6);
		expect(voce.costi).toBeCloseTo(700 + 630, 6);
		expect(voce.margine).toBeCloseTo(2200 - 1330, 6);
		expect(voce.perOfferta).toHaveLength(2);
		const somma = (valori: number[]) => valori.reduce((a, b) => a + b, 0);
		expect(somma(voce.perOfferta.map((o) => o.ricavi))).toBeCloseTo(voce.ricavi, 6);
		expect(somma(voce.perOfferta.map((o) => o.costi))).toBeCloseTo(voce.costi, 6);
		expect(somma(voce.perOfferta.map((o) => o.margine))).toBeCloseTo(voce.margine, 6);

		const livelloCliente = voce.perCollaboratore;
		const livelloOfferta = voce.perOfferta.map((o) => o.perCollaboratore);
		expect(livelloCliente !== null || livelloOfferta.every((c) => c !== null), "dettaglio collaboratori presente").toBe(true);
		const tuttiCollaboratori = livelloCliente ?? livelloOfferta.flatMap((c) => c ?? []);
		expect(somma(tuttiCollaboratori.map((c) => c.costi))).toBeCloseTo(voce.costi, 6);
		if (livelloCliente === null) {
			for (const offerta of voce.perOfferta) {
				expect(somma(offerta.perCollaboratore!.map((c) => c.costi))).toBeCloseTo(offerta.costi, 6);
			}
		}
		const costiPrimo = somma(
			tuttiCollaboratori.filter((c) => c.collaboratoreId === s.collaboratore.collaboratore.id).map((c) => c.costi),
		);
		expect(costiPrimo).toBeCloseTo(700, 6);
	});
});

// ── periodo (3) ─────────────────────────────────────────────────────────────

describe("periodo", () => {
	test("[periodo] D1 mese iniziale e finale inclusi, mesi adiacenti esclusi", async () => {
		const prima = mesePassatoRiservato("ORACOLO-T2-D1", 5);
		const inizio = meseDopo(prima, 1);
		const centro = meseDopo(prima, 2);
		const fine = meseDopo(prima, 3);
		const dopo = meseDopo(prima, 4);
		const s = await scenario();
		await riga(s, prima, 28, "8");
		await riga(s, inizio, 1, "1");
		await riga(s, centro, 15, "2");
		await riga(s, fine, 28, "4");
		await riga(s, dopo, 1, "8");
		const voce = await voceCliente(inizio, fine, s.cliente.id);
		expect(voce.ricavi).toBeCloseTo((7 / 8) * 640, 6);
		expect(voce.costi).toBeCloseTo((7 / 8) * 400, 6);
	});

	test("[periodo] D2 periodo a cavallo anno corretto", async () => {
		const anno = Number(mesePassatoRiservato("ORACOLO-T2-D2").slice(0, 4)) - 1;
		const s = await scenario();
		await riga(s, `${anno}-10`, 31, "8");
		await riga(s, `${anno}-11`, 30, "2");
		await riga(s, `${anno}-12`, 31, "4");
		await riga(s, `${anno + 1}-01`, 2, "8");
		await riga(s, `${anno + 1}-02`, 1, "8");
		const voce = await voceCliente(`${anno}-11`, `${anno + 1}-01`, s.cliente.id);
		expect(voce.ricavi).toBeCloseTo((14 / 8) * 640, 6);
		expect(voce.costi).toBeCloseTo((14 / 8) * 400, 6);
	});

	test("[periodo] D3 periodo invertito rifiutato", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-D3");
		const s = await scenario();
		await riga(s, m, 10, "8");
		await riga(s, meseDopo(m, 1), 10, "8");
		await come(amministratore);
		const esito = await tenta(() => adattatore.reportMarginalita(meseDopo(m, 1), m));
		const rifiutato = esito instanceof Error || eRifiuto(esito);
		expect(rifiutato, "il periodo invertito deve essere rifiutato, non riordinato né svuotato in silenzio").toBe(true);
		const valido = await voceCliente(m, meseDopo(m, 1), s.cliente.id);
		expect(valido.ricavi, "lo stesso periodo nel verso corretto funziona").toBeCloseTo(1280, 6);
	});
});

// ── autorizzazioni (3) ──────────────────────────────────────────────────────

describe("autorizzazioni", () => {
	async function accessoNegato(utente: UtenteSessione | null, chiave: string): Promise<void> {
		const m = mesePassatoRiservato(chiave);
		const s = await scenario();
		await riga(s, m, 18, "8");
		await come(utente);
		const esito = await tenta(() => adattatore.reportMarginalita(m, m));
		const negato =
			esito instanceof Error ||
			eRifiuto(esito) ||
			!(esito as ReportMarginalita).perCliente?.some((c) => c.clienteId === s.cliente.id);
		if (!negato && chiave === "ORACOLO-T2-A1") {
			throw new Error("VIOLAZIONE_CRITICA_DATI_ALTRUI: il collaboratore legge il cliente del collaboratore fixture distinto");
		}
		expect(negato, "nessun dato di marginalità per chi non è amministratore").toBe(true);
	}

	test("[autorizzazioni] A1 collaboratore non accede al report", async () => {
		const collaboratore = await factory.createCollaboratore();
		await accessoNegato(utenteDi(collaboratore), "ORACOLO-T2-A1");
	});

	test("[autorizzazioni] A2 cliente non accede al report", async () => {
		await accessoNegato(await creaUtenteCliente(factory, adattatore.ruoloUtenteCliente ?? "COLLABORATORE"), "ORACOLO-T2-A2");
	});

	test("[autorizzazioni] A3 anonimo non accede al report", async () => {
		await accessoNegato(null, "ORACOLO-T2-A3");
	});
});

// ── persistenza (2) ─────────────────────────────────────────────────────────

describe("persistenza", () => {
	test("[persistenza] P1 lettura report non muta database né schema", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-P1");
		const s = await scenario();
		await riga(s, m, 19, "8");
		await riga(s, m, 20, "4", { fatturabile: false, rimborso: "12.00" });
		const prima = await improntaDatabase();
		const voce = await voceCliente(m, m, s.cliente.id);
		await report(meseDopo(m, -2), meseDopo(m, 2));
		expect(voce.ricavi).toBeCloseTo(640, 6);
		const dopo = await improntaDatabase();
		expect(dopo.schema).toBe(prima.schema);
		expect(dopo.tabelle).toEqual(prima.tabelle);
	});

	test("[persistenza] P2 ricavi uguali alla manodopera fatturazione sullo stesso periodo", async () => {
		const m = mesePassatoRiservato("ORACOLO-T2-P2");
		const successivo = meseDopo(m, 1);
		// Tariffe scelte perché ogni imponibile sia esatto al centesimo (nessun mezzo centesimo da arrotondare).
		const s = await scenario("592.00", "410.00");
		const secondaOfferta = await factory.createOfferta({ cliente: s.cliente, tariffaGiornaliera: "520.00" });
		await factory.createAbilitazioneOfferta({ collaboratore: s.collaboratore, offerta: secondaOfferta });
		await riga(s, m, 3, "7.5");
		await riga(s, m, 4, "3", { fatturabile: false, rimborso: "18.00" });
		await riga({ ...s, offerta: secondaOfferta }, m, 5, "5.25", { rimborso: "40.00" });
		await riga(s, successivo, 6, "6.75");

		await come(amministratore);
		const fatturaMese = await adattatore.importiFatturazioneCliente(m, s.cliente.id);
		const fatturaSuccessivo = await adattatore.importiFatturazioneCliente(successivo, s.cliente.id);
		expect(fatturaMese && fatturaSuccessivo, "il cliente compare nel report fatturazione").toBeTruthy();

		const sulMese = await voceCliente(m, m, s.cliente.id);
		expect(sulMese.ricavi).toBeCloseTo(fatturaMese!.imponibileManodopera, 2);
		for (const offerta of fatturaMese!.perOfferta) {
			expect(sulMese.perOfferta.find((o) => o.offertaId === offerta.offertaId)?.ricavi).toBeCloseTo(offerta.imponibile, 2);
		}
		const suiDueMesi = await voceCliente(m, successivo, s.cliente.id);
		expect(suiDueMesi.ricavi).toBeCloseTo(fatturaMese!.imponibileManodopera + fatturaSuccessivo!.imponibileManodopera, 2);
	});
});
