/**
 * Oracolo T4 · livello integrazione. Titoli "[area] CODICE descrizione".
 * Riproduce i sintomi del profilo con entità proprie («Ada/Marco Esempio» creati dalla factory,
 * mai le entità seed) e verifica le giornate e gli importi esatti: le frazioni non si perdono.
 * Le rappresentazioni arrotondate della UI sono verificate solo nel livello browser.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { createE2eDataFactory, type CollaboratoreTestData } from "../tests/e2e/support/factory";
import { mesePassatoRiservato } from "../tests/e2e/support/date";
import { e2ePrisma } from "../tests/e2e/support/prisma";
import type { Cliente, Offerta } from "../src/generated/prisma/client";
import {
	come,
	dataUtc,
	fotoRigheCollaboratore,
	giornoDi,
	meseDopo,
	ultimaDomenica,
	utenteDi,
} from "./shared/integrazione";
import type { RiepilogoMeseCollaboratore, UtenteSessione } from "./contratto";
import { adattatoreIntegrazione as adattatore } from "./adattatore/integrazione";

const factory = createE2eDataFactory(`oracolo-t4-int-${process.pid}-${Date.now()}`);
let amministratore: UtenteSessione;
const PRECISIONE = 9;

type Scenario = { cliente: Cliente; offerta: Offerta; ada: CollaboratoreTestData; marco: CollaboratoreTestData };

async function scenario(giorniPrevisti = 10): Promise<Scenario> {
	const { cliente, offerta } = await factory.createClienteConOfferta({}, { tariffaGiornaliera: "640.00", giorniPrevisti });
	const ada = await factory.createCollaboratore({ nome: "Ada", cognome: `Esempio ${factory.namespace.slice(-6)}`, tariffaGiornaliera: "400.00" });
	const marco = await factory.createCollaboratore({ nome: "Marco", cognome: `Esempio ${factory.namespace.slice(-6)}`, tariffaGiornaliera: "400.00" });
	return { cliente, offerta, ada, marco };
}

async function riga(
	collaboratore: CollaboratoreTestData,
	offerta: Offerta,
	data: string,
	ore: string,
	extra: { fatturabile?: boolean; rimborso?: string } = {},
) {
	return factory.createRigaAttivita({
		collaboratore,
		offerta,
		data: dataUtc(data),
		ore,
		fatturabile: extra.fatturabile ?? true,
		rimborsoTrasfertaEtichetta: extra.rimborso ? "Trasferta oracolo" : null,
		rimborsoTrasfertaImporto: extra.rimborso ?? null,
	});
}

async function riepilogoDi(collaboratore: CollaboratoreTestData, token: string): Promise<RiepilogoMeseCollaboratore> {
	await come(utenteDi(collaboratore));
	return adattatore.riepilogoMese(token);
}

async function avanzamento(s: Scenario, offerta: Offerta = s.offerta) {
	await come(amministratore);
	const voce = await adattatore.avanzamentoOfferta(offerta.id, s.cliente.id);
	expect(voce, "l'offerta compare nell'avanzamento").not.toBeNull();
	return voce!;
}

function perOfferta(r: RiepilogoMeseCollaboratore, offertaId: string) {
	const voce = r.perOfferta.find((v) => v.offertaId === offertaId);
	expect(voce, "l'offerta compare nel riepilogo").toBeDefined();
	return voce!;
}

beforeAll(async () => {
	amministratore = utenteDi({ utente: await factory.createUtente({ ruolo: "AMMINISTRATORE" }) });
});

// ── sintomo (6) ─────────────────────────────────────────────────────────────

describe("sintomo", () => {
	test("[sintomo] S1 3+3 ore fatturabili producono 0,75 giornate e imponibile 300 a tariffa 400", async () => {
		const m = mesePassatoRiservato("ORACOLO-T4-S1");
		const s = await scenario();
		await riga(s.ada, s.offerta, giornoDi(m, 12), "3");
		await riga(s.ada, s.offerta, giornoDi(m, 19), "3");
		const r = await riepilogoDi(s.ada, m);
		expect(r.oreFatturabili).toBeCloseTo(6, PRECISIONE);
		expect(r.giornateFatturabili).toBeCloseTo(0.75, PRECISIONE);
		expect(r.giornateTotali).toBeCloseTo(0.75, PRECISIONE);
		expect(r.imponibileManodopera).toBeCloseTo(300, PRECISIONE);
		expect(r.importoFattura).toBeCloseTo(300, PRECISIONE);
		expect(perOfferta(r, s.offerta.id).giornateFatturabili).toBeCloseTo(0.75, PRECISIONE);
	});

	test("[sintomo] S2 0,25+0,25 ore mantengono precisione senza troncamento per riga", async () => {
		const m = mesePassatoRiservato("ORACOLO-T4-S2");
		const s = await scenario();
		await riga(s.ada, s.offerta, giornoDi(m, 3), "0.25");
		await riga(s.ada, s.offerta, giornoDi(m, 4), "0.25");
		const r = await riepilogoDi(s.ada, m);
		expect(r.giornateFatturabili).toBeCloseTo(0.0625, PRECISIONE);
		expect(r.giornateTotali).toBeCloseTo(0.0625, PRECISIONE);
		expect(r.imponibileManodopera).toBeCloseTo(25, PRECISIONE);
		expect(perOfferta(r, s.offerta.id).giornateTotali).toBeCloseTo(0.0625, PRECISIONE);
	});

	test("[sintomo] S3 8 ore intere conservano 1 giornata", async () => {
		const m = mesePassatoRiservato("ORACOLO-T4-S3");
		const s = await scenario();
		await riga(s.marco, s.offerta, giornoDi(m, 12), "8");
		const r = await riepilogoDi(s.marco, m);
		expect(r.giornateFatturabili).toBeCloseTo(1, PRECISIONE);
		expect(r.imponibileManodopera).toBeCloseTo(400, PRECISIONE);
		expect(r.importoFattura).toBeCloseTo(400, PRECISIONE);
	});

	test("[sintomo] S4 righe non fatturabili aumentano giornate totali, non imponibile", async () => {
		const m = mesePassatoRiservato("ORACOLO-T4-S4");
		const s = await scenario();
		await riga(s.ada, s.offerta, giornoDi(m, 5), "3");
		await riga(s.ada, s.offerta, giornoDi(m, 6), "3", { fatturabile: false });
		const r = await riepilogoDi(s.ada, m);
		expect(r.oreTotali).toBeCloseTo(6, PRECISIONE);
		expect(r.oreFatturabili).toBeCloseTo(3, PRECISIONE);
		expect(r.giornateTotali).toBeCloseTo(0.75, PRECISIONE);
		expect(r.giornateFatturabili).toBeCloseTo(0.375, PRECISIONE);
		expect(r.imponibileManodopera).toBeCloseTo(150, PRECISIONE);
		expect(perOfferta(r, s.offerta.id).giornateTotali).toBeCloseTo(0.75, PRECISIONE);
	});

	test("[sintomo] S5 rimborsi aggiunti invariati anche per righe non fatturabili", async () => {
		const m = mesePassatoRiservato("ORACOLO-T4-S5");
		const s = await scenario();
		await riga(s.ada, s.offerta, giornoDi(m, 7), "3", { rimborso: "25.50" });
		await riga(s.ada, s.offerta, giornoDi(m, 8), "3", { fatturabile: false, rimborso: "30.00" });
		const r = await riepilogoDi(s.ada, m);
		expect(r.totaleRimborsi).toBeCloseTo(55.5, PRECISIONE);
		expect(perOfferta(r, s.offerta.id).rimborsiTrasferta).toBeCloseTo(55.5, PRECISIONE);
		expect(r.imponibileManodopera).toBeCloseTo(150, PRECISIONE);
		expect(r.importoFattura).toBeCloseTo(205.5, PRECISIONE);
	});

	test("[sintomo] S6 mese senza righe restituisce zero ore, zero giornate e zero importo", async () => {
		const m = mesePassatoRiservato("ORACOLO-T4-S6");
		const s = await scenario();
		await riga(s.ada, s.offerta, giornoDi(meseDopo(m, -1), 15), "3");
		const r = await riepilogoDi(s.ada, m);
		expect(r.oreTotali).toBe(0);
		expect(r.oreFatturabili).toBe(0);
		expect(r.giornateTotali).toBe(0);
		expect(r.giornateFatturabili).toBe(0);
		expect(r.imponibileManodopera).toBe(0);
		expect(r.totaleRimborsi).toBe(0);
		expect(r.importoFattura).toBe(0);
		expect(r.perOfferta).toEqual([]);
	});
});

// ── famiglia del difetto: avanzamento offerte (4) ───────────────────────────

describe("famiglia", () => {
	test("[famiglia] F1 avanzamento offerte: 3+3 ore = 0,75 giornate", async () => {
		const m = mesePassatoRiservato("ORACOLO-T4-F1");
		const s = await scenario();
		await riga(s.ada, s.offerta, giornoDi(m, 12), "3");
		await riga(s.ada, s.offerta, giornoDi(m, 19), "3");
		const a = await avanzamento(s);
		expect(a.giornateErogate).toBeCloseTo(0.75, PRECISIONE);
		const ada = a.perCollaboratore.find((c) => c.collaboratoreId === s.ada.collaboratore.id);
		expect(ada?.giornateErogate).toBeCloseTo(0.75, PRECISIONE);
	});

	test("[famiglia] F2 avanzamento offerte: residuo e percentuale coerenti", async () => {
		const m = mesePassatoRiservato("ORACOLO-T4-F2");
		const s = await scenario(10);
		await riga(s.ada, s.offerta, giornoDi(m, 12), "3");
		await riga(s.ada, s.offerta, giornoDi(m, 19), "3");
		await riga(s.ada, s.offerta, giornoDi(m, 20), "5", { fatturabile: false });
		const a = await avanzamento(s);
		expect(a.giornatePreviste).toBe(10);
		expect(a.giornateErogate).toBeCloseTo(0.75, PRECISIONE);
		expect(a.residuo).toBeCloseTo(9.25, PRECISIONE);
		expect(a.percentualeUtilizzo).toBeCloseTo(0.075, PRECISIONE);
	});

	test("[famiglia] F3 matrice mensile e totali avanzamento riconciliano", async () => {
		const m1 = mesePassatoRiservato("ORACOLO-T4-F3", 2);
		const m2 = meseDopo(m1, 1);
		const s = await scenario();
		await riga(s.ada, s.offerta, giornoDi(m1, 12), "3");
		await riga(s.ada, s.offerta, giornoDi(m1, 19), "3");
		await riga(s.ada, s.offerta, giornoDi(m2, 2), "2.5");
		await riga(s.marco, s.offerta, giornoDi(m1, 20), "1");
		const a = await avanzamento(s);
		const matrice = a.matrice;
		const rigaDi = (c: CollaboratoreTestData) => matrice.righe.find((r) => r.collaboratoreId === c.collaboratore.id)!;
		expect(rigaDi(s.ada).giornatePerMese[m1]).toBeCloseTo(0.75, PRECISIONE);
		expect(rigaDi(s.ada).giornatePerMese[m2]).toBeCloseTo(0.3125, PRECISIONE);
		expect(rigaDi(s.ada).totaleGiornate).toBeCloseTo(1.0625, PRECISIONE);
		expect(rigaDi(s.marco).giornatePerMese[m1]).toBeCloseTo(0.125, PRECISIONE);
		expect(matrice.totaliPerMese[m1]).toBeCloseTo(0.875, PRECISIONE);
		expect(matrice.totaliPerMese[m2]).toBeCloseTo(0.3125, PRECISIONE);
		expect(matrice.totaleGiornate).toBeCloseTo(1.1875, PRECISIONE);
		expect(a.giornateErogate, "totale dell'offerta = totale della matrice").toBeCloseTo(matrice.totaleGiornate, PRECISIONE);
		const sommaPerCollaboratore = a.perCollaboratore.reduce((t, c) => t + c.giornateErogate, 0);
		expect(sommaPerCollaboratore).toBeCloseTo(a.giornateErogate, PRECISIONE);
	});

	test("[famiglia] F4 più offerte e collaboratori non perdono frazioni", async () => {
		const m = mesePassatoRiservato("ORACOLO-T4-F4");
		const s = await scenario();
		const seconda = await factory.createOfferta({ cliente: s.cliente, tariffaGiornaliera: "500.00", giorniPrevisti: 5 });
		await riga(s.ada, s.offerta, giornoDi(m, 2), "3");
		await riga(s.ada, s.offerta, giornoDi(m, 3), "3");
		await riga(s.ada, seconda, giornoDi(m, 4), "1.5");
		await riga(s.ada, seconda, giornoDi(m, 5), "1.5");
		await riga(s.marco, s.offerta, giornoDi(m, 6), "3");

		const r = await riepilogoDi(s.ada, m);
		expect(perOfferta(r, s.offerta.id).giornateFatturabili).toBeCloseTo(0.75, PRECISIONE);
		expect(perOfferta(r, seconda.id).giornateFatturabili).toBeCloseTo(0.375, PRECISIONE);
		expect(r.giornateFatturabili).toBeCloseTo(1.125, PRECISIONE);
		expect(r.imponibileManodopera).toBeCloseTo(450, PRECISIONE);

		const prima = await avanzamento(s, s.offerta);
		const dopo = await avanzamento(s, seconda);
		expect(prima.giornateErogate).toBeCloseTo(1.125, PRECISIONE);
		expect(dopo.giornateErogate).toBeCloseTo(0.375, PRECISIONE);

		await come(amministratore);
		const fattura = await adattatore.importiFatturazioneCliente(m, s.cliente.id);
		expect(fattura, "il cliente compare nel report fatturazione").not.toBeNull();
		const giornateFattura = (id: string) => fattura!.perOfferta.find((o) => o.offertaId === id)?.giornateFatturabili;
		expect(giornateFattura(s.offerta.id), "stesse basi in giornate del report fatturazione").toBeCloseTo(prima.giornateErogate, PRECISIONE);
		expect(giornateFattura(seconda.id)).toBeCloseTo(dopo.giornateErogate, PRECISIONE);
	});
});

// ── causa: il report fatturazione era già corretto (3) ──────────────────────

describe("causa", () => {
	test("[causa] C1 report fatturazione corretto conserva importi prima/dopo fix", async () => {
		const m = mesePassatoRiservato("ORACOLO-T4-C1");
		const s = await scenario();
		await riga(s.ada, s.offerta, giornoDi(m, 12), "3");
		await riga(s.ada, s.offerta, giornoDi(m, 19), "3", { rimborso: "12.40" });
		await riga(s.ada, s.offerta, giornoDi(m, 20), "2", { fatturabile: false });
		await come(amministratore);
		const fattura = await adattatore.importiFatturazioneCliente(m, s.cliente.id);
		expect(fattura).not.toBeNull();
		const offerta = fattura!.perOfferta.find((o) => o.offertaId === s.offerta.id)!;
		expect(offerta.giornateFatturabili).toBeCloseTo(0.75, PRECISIONE);
		expect(offerta.imponibile).toBeCloseTo(480, PRECISIONE);
		expect(fattura!.imponibileManodopera).toBeCloseTo(480, PRECISIONE);
		expect(fattura!.rimborsiTrasferta).toBeCloseTo(12.4, PRECISIONE);
		expect(fattura!.importoTotale).toBeCloseTo(492.4, PRECISIONE);
	});

	test("[causa] C2 ore attività e date non riscritte per allineare i report", async () => {
		const m = mesePassatoRiservato("ORACOLO-T4-C2");
		const s = await scenario();
		await riga(s.ada, s.offerta, giornoDi(m, 12), "3");
		await riga(s.ada, s.offerta, giornoDi(m, 19), "3", { rimborso: "9.90" });
		await riga(s.ada, s.offerta, giornoDi(m, 21), "0.25", { fatturabile: false });
		const prima = await fotoRigheCollaboratore(s.ada.collaboratore.id);
		await riepilogoDi(s.ada, m);
		await avanzamento(s);
		await come(amministratore);
		await adattatore.importiFatturazioneCliente(m, s.cliente.id);
		expect(await fotoRigheCollaboratore(s.ada.collaboratore.id)).toBe(prima);
		expect(prima.split("\n")).toHaveLength(3);
	});

	test("[causa] C3 righe nelle date di cambio ora restano nello stesso mese", async () => {
		const anno = Number(mesePassatoRiservato("ORACOLO-T4-C3").slice(0, 4)) - 1;
		const marzo = `${anno}-03`;
		const ottobre = `${anno}-10`;
		const s = await scenario();
		// Ore che il troncamento per riga non altera (4 h = 0,5; 2 h = 0,25): qui conta solo il mese di attribuzione.
		await riga(s.ada, s.offerta, ultimaDomenica(anno, 3), "4");
		await riga(s.ada, s.offerta, giornoDi(marzo, 31), "4");
		await riga(s.ada, s.offerta, giornoDi(`${anno}-04`, 1), "2");
		await riga(s.ada, s.offerta, ultimaDomenica(anno, 10), "4");
		await riga(s.ada, s.offerta, giornoDi(ottobre, 31), "4");
		await riga(s.ada, s.offerta, giornoDi(`${anno}-11`, 1), "2");

		for (const [token, giornate] of [
			[marzo, 1],
			[`${anno}-04`, 0.25],
			[ottobre, 1],
			[`${anno}-11`, 0.25],
		] as const) {
			const r = await riepilogoDi(s.ada, token);
			expect(r.giornateFatturabili, `riepilogo ${token}`).toBeCloseTo(giornate, PRECISIONE);
			await come(amministratore);
			const fattura = await adattatore.importiFatturazioneCliente(token, s.cliente.id);
			expect(fattura?.perOfferta.find((o) => o.offertaId === s.offerta.id)?.giornateFatturabili, `fatturazione ${token}`).toBeCloseTo(
				giornate,
				PRECISIONE,
			);
		}
		const a = await avanzamento(s);
		expect(a.matrice.mesi.slice().sort()).toEqual([marzo, `${anno}-04`, ottobre, `${anno}-11`]);
		expect(a.matrice.totaliPerMese[marzo]).toBeCloseTo(1, PRECISIONE);
		expect(a.matrice.totaliPerMese[ottobre]).toBeCloseTo(1, PRECISIONE);
		expect(a.giornateErogate).toBeCloseTo(2.5, PRECISIONE);
	});
});

// ── persistenza (1) ─────────────────────────────────────────────────────────

const MIGRAZIONI_BASELINE = [
	"20260611132357_init",
	"20260612100000_add_fatturazione_cliente",
	"20260615120000_add_unique_scaglione_km_fino_a_km",
	"20260721084945_aggiungi_stato_attivo_utente",
	"20260722133929_aggiungi_abilitazione_offerta",
	"20260728135453_aggiungi_cognome_utente",
	"20260728201452_indice_calendario_collaboratore",
	"20260731142725_voci_rimborso_trasferta_libere",
];

const COLONNE_RIGA_ATTIVITA_BASELINE = [
	"clienteId:text",
	"collaboratoreId:text",
	"createdAt:timestamp without time zone",
	"data:date",
	"fatturabile:boolean",
	"id:text",
	"nota:text",
	"offertaId:text",
	"ore:numeric",
	"rimborsoTrasfertaEtichetta:text",
	"rimborsoTrasfertaImporto:numeric",
	"updatedAt:timestamp without time zone",
];

describe("persistenza", () => {
	test("[persistenza] P1 nessuna migrazione o modifica delle righe attività richiesta dal fix", async () => {
		// Lo stato è quello del database migrato dal gate con `prisma migrate deploy` della consegna.
		const { rows: migrazioni } = await e2ePrisma.query(
			`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`,
		);
		expect(migrazioni.map((r) => r.migration_name as string).sort()).toEqual(MIGRAZIONI_BASELINE);
		const { rows: colonne } = await e2ePrisma.query(
			`SELECT column_name || ':' || data_type AS colonna FROM information_schema.columns
			 WHERE table_schema = 'public' AND table_name = 'RigaAttivita'`,
		);
		expect(colonne.map((r) => r.colonna as string).sort()).toEqual(COLONNE_RIGA_ATTIVITA_BASELINE);
	});
});
