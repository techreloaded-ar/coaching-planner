/**
 * Oracolo T3 · livello integrazione. Titoli "[area] CODICE descrizione".
 * Collaboratori e offerte con storia tariffaria sono preparati da `adattatoreDati` nella schema
 * della consegna; clienti, abilitazioni e righe dalla factory e2e (tabelle invariate dal compito).
 * M1–M3 vivono in `migrazione/migrazione.test.ts`, eseguito dallo script `migrazione_con_dati.py`.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { createE2eDataFactory } from "../tests/e2e/support/factory";
import { mesePassatoRiservato } from "../tests/e2e/support/date";
import type { Offerta } from "../src/generated/prisma/client";
import { creaRiga } from "@/lib/actions/righe-attivita";
import { come, conSessione, dataUtc, giornoDi, giornoDopo, meseDopo, tenta, tokenDa, utenteDi } from "./shared/integrazione";
import type { EntitaTariffata, TariffaIniziale, UtenteSessione, ValiditaTariffa } from "./contratto";
import { adattatoreDati as dati } from "./adattatore/dati";
import { adattatoreIntegrazione as adattatore } from "./adattatore/integrazione";

const NAMESPACE = `oracolo-t3-int-${process.pid}-${Date.now()}`;
const factory = createE2eDataFactory(NAMESPACE);
let amministratore: UtenteSessione;
let progressivo = 0;

const oggi = new Date();
const annoCorrente = oggi.getUTCFullYear();
const meseCorrente = tokenDa(annoCorrente, oggi.getUTCMonth() + 1);
/** Prima data sicuramente futura usata per le tariffe pianificate in anticipo. */
const CAPODANNO_PROSSIMO = `${annoCorrente + 1}-01-01`;

function ns(): string {
	progressivo += 1;
	return `${NAMESPACE}-${progressivo}`;
}

async function collaboratoreCon(tariffe: TariffaIniziale[]) {
	return dati.creaCollaboratore({ namespace: ns(), ruolo: "COLLABORATORE", tariffe });
}

async function offertaCon(tariffe: TariffaIniziale[], giorniPrevisti = 10) {
	const cliente = await factory.createCliente();
	const { offertaId, codice } = await dati.creaOfferta({ namespace: ns(), clienteId: cliente.id, giorniPrevisti, tariffe });
	return { cliente, offertaId, codice, offerta: { id: offertaId, clienteId: cliente.id } as Offerta };
}

async function riga(collaboratoreId: string, offerta: Offerta, data: string, ore: string, fatturabile = true) {
	return factory.createRigaAttivita({
		collaboratore: { id: collaboratoreId } as never,
		offerta,
		data: dataUtc(data),
		ore,
		fatturabile,
	});
}

const offertaEntita = (id: string): EntitaTariffata => ({ tipo: "offerta", id });
const collaboratoreEntita = (id: string): EntitaTariffata => ({ tipo: "collaboratore", id });

function ordina(v: ValiditaTariffa[]): ValiditaTariffa[] {
	return [...v].sort((a, b) => (a.decorrenza ?? "").localeCompare(b.decorrenza ?? ""));
}

/** Violazioni della catena di validità: duplicati, sovrapposizioni, buchi, ultima chiusa. */
function problemiCatena(validita: ValiditaTariffa[]): string[] {
	const v = ordina(validita);
	const problemi: string[] = [];
	const decorrenze = v.map((x) => x.decorrenza ?? "∅");
	if (new Set(decorrenze).size !== decorrenze.length) problemi.push(`decorrenze duplicate: ${decorrenze.join(", ")}`);
	for (let i = 0; i < v.length - 1; i++) {
		const attesa = giornoDopo(v[i + 1].decorrenza!, -1);
		if (dati.semanticaFine === "esplicita" && v[i].fine !== attesa) {
			problemi.push(`validità ${v[i].decorrenza ?? "iniziale"} termina il ${v[i].fine ?? "(aperta)"} invece del ${attesa}`);
		}
		if (dati.semanticaFine === "implicita" && v[i].fine !== null && v[i].fine !== attesa) {
			problemi.push(`validità ${v[i].decorrenza ?? "iniziale"} con fine incoerente ${v[i].fine}`);
		}
	}
	if (v.length > 0 && v[v.length - 1].fine !== null) problemi.push(`l'ultima validità è chiusa il ${v[v.length - 1].fine}`);
	return problemi;
}

async function riepilogoDi(utente: UtenteSessione, token: string) {
	await come(utente);
	return adattatore.riepilogoMese(token);
}

async function fatturazione(token: string, clienteId: string) {
	await come(amministratore);
	const voce = await adattatore.importiFatturazioneCliente(token, clienteId);
	expect(voce, `il cliente compare nel report ${token}`).not.toBeNull();
	return voce!;
}

beforeAll(async () => {
	amministratore = utenteDi({ utente: await factory.createUtente({ ruolo: "AMMINISTRATORE" }) });
});

// ── validità (5) ────────────────────────────────────────────────────────────

describe("validita", () => {
	test("[validita] V1 nuova tariffa offerta futura inseribile anticipatamente", async () => {
		const o = await offertaCon([{ decorrenza: null, tariffa: 600 }]);
		await come(amministratore);
		await tenta(() => adattatore.pianificaTariffa(offertaEntita(o.offertaId), { decorrenza: CAPODANNO_PROSSIMO, tariffa: 650 }));
		const v = ordina(await dati.validita(offertaEntita(o.offertaId)));
		expect(v).toHaveLength(2);
		expect(v[0].tariffa).toBe(600);
		expect(v[1]).toMatchObject({ decorrenza: CAPODANNO_PROSSIMO, tariffa: 650, fine: null });
	});

	test("[validita] V2 nuova tariffa collaboratore futura inseribile anticipatamente", async () => {
		const c = await collaboratoreCon([{ decorrenza: null, tariffa: 400 }]);
		await come(amministratore);
		await tenta(() => adattatore.pianificaTariffa(collaboratoreEntita(c.collaboratoreId), { decorrenza: CAPODANNO_PROSSIMO, tariffa: 430 }));
		const v = ordina(await dati.validita(collaboratoreEntita(c.collaboratoreId)));
		expect(v).toHaveLength(2);
		expect(v[0].tariffa).toBe(400);
		expect(v[1]).toMatchObject({ decorrenza: CAPODANNO_PROSSIMO, tariffa: 430, fine: null });
	});

	test("[validita] V3 ultima tariffa correggibile senza mutare validità anteriori", async () => {
		const o = await offertaCon([{ decorrenza: null, tariffa: 600 }]);
		await come(amministratore);
		await tenta(() => adattatore.pianificaTariffa(offertaEntita(o.offertaId), { decorrenza: CAPODANNO_PROSSIMO, tariffa: 650 }));
		const prima = ordina(await dati.validita(offertaEntita(o.offertaId)));
		expect(prima, "precondizione: tariffa futura pianificata").toHaveLength(2);
		await tenta(() => adattatore.correggiUltimaTariffa(offertaEntita(o.offertaId), { tariffa: 665 }));
		const dopo = ordina(await dati.validita(offertaEntita(o.offertaId)));
		expect(dopo).toHaveLength(2);
		expect(dopo[0]).toEqual(prima[0]);
		expect(dopo[1]).toMatchObject({ decorrenza: CAPODANNO_PROSSIMO, tariffa: 665 });
	});

	test("[validita] V4 seconda tariffa stessa decorrenza rifiutata", async () => {
		const c = await collaboratoreCon([{ decorrenza: null, tariffa: 400 }]);
		await come(amministratore);
		await tenta(() => adattatore.pianificaTariffa(collaboratoreEntita(c.collaboratoreId), { decorrenza: CAPODANNO_PROSSIMO, tariffa: 430 }));
		await tenta(() => adattatore.pianificaTariffa(collaboratoreEntita(c.collaboratoreId), { decorrenza: CAPODANNO_PROSSIMO, tariffa: 999 }));
		const v = ordina(await dati.validita(collaboratoreEntita(c.collaboratoreId)));
		expect(v).toHaveLength(2);
		expect(v.filter((x) => x.decorrenza === CAPODANNO_PROSSIMO)).toEqual([expect.objectContaining({ tariffa: 430 })]);
	});

	test("[validita] V5 nessun buco tra validità consecutive, precedente aperta fino a successiva", async () => {
		const o = await offertaCon([{ decorrenza: null, tariffa: 600 }]);
		const seconda = `${annoCorrente + 1}-07-01`;
		await come(amministratore);
		await tenta(() => adattatore.pianificaTariffa(offertaEntita(o.offertaId), { decorrenza: CAPODANNO_PROSSIMO, tariffa: 650 }));
		await tenta(() => adattatore.pianificaTariffa(offertaEntita(o.offertaId), { decorrenza: seconda, tariffa: 700 }));
		const v = ordina(await dati.validita(offertaEntita(o.offertaId)));
		expect(v.map((x) => x.tariffa)).toEqual([600, 650, 700]);
		expect(problemiCatena(v)).toEqual([]);
	});
});

// ── calcoli alla data della riga (6) ────────────────────────────────────────

describe("calcoli", () => {
	test("[calcoli] C1 riepilogo personale applica tariffa alla data riga", async () => {
		const m = mesePassatoRiservato("ORACOLO-T3-C1");
		const c = await collaboratoreCon([
			{ decorrenza: null, tariffa: 400 },
			{ decorrenza: giornoDi(m, 15), tariffa: 500 },
		]);
		const o = await offertaCon([{ decorrenza: null, tariffa: 600 }]);
		await riga(c.collaboratoreId, o.offerta, giornoDi(m, 10), "8");
		await riga(c.collaboratoreId, o.offerta, giornoDi(m, 20), "8");
		const r = await riepilogoDi(c.utente, m);
		expect(r.giornateFatturabili).toBeCloseTo(2, 9);
		expect(r.imponibileManodopera).toBeCloseTo(900, 6);
		expect(r.importoFattura).toBeCloseTo(900, 6);
	});

	test("[calcoli] C2 report cliente applica tariffa offerta alla data riga", async () => {
		const m = mesePassatoRiservato("ORACOLO-T3-C2");
		const c = await collaboratoreCon([{ decorrenza: null, tariffa: 400 }]);
		const o = await offertaCon([
			{ decorrenza: null, tariffa: 600 },
			{ decorrenza: giornoDi(m, 15), tariffa: 700 },
		]);
		await riga(c.collaboratoreId, o.offerta, giornoDi(m, 10), "8");
		await riga(c.collaboratoreId, o.offerta, giornoDi(m, 20), "4");
		const f = await fatturazione(m, o.cliente.id);
		expect(f.imponibileManodopera).toBeCloseTo(950, 6);
		expect(f.perOfferta.find((x) => x.offertaId === o.offertaId)?.imponibile).toBeCloseTo(950, 6);
		expect(f.importoTotale).toBeCloseTo(950, 6);
	});

	test("[calcoli] C3 avanzamento offerte mantiene importi e giornate corretti", async () => {
		const m1 = mesePassatoRiservato("ORACOLO-T3-C3", 2);
		const m2 = meseDopo(m1, 1);
		const c = await collaboratoreCon([{ decorrenza: null, tariffa: 400 }]);
		const o = await offertaCon(
			[
				{ decorrenza: null, tariffa: 600 },
				{ decorrenza: giornoDi(m2, 1), tariffa: 700 },
			],
			10,
		);
		await riga(c.collaboratoreId, o.offerta, giornoDi(m1, 20), "8");
		await riga(c.collaboratoreId, o.offerta, giornoDi(m2, 5), "4");
		await riga(c.collaboratoreId, o.offerta, giornoDi(m2, 6), "2", false);
		await come(amministratore);
		const a = await adattatore.avanzamentoOfferta(o.offertaId, o.cliente.id);
		expect(a).not.toBeNull();
		expect(a!.giornateErogate).toBeCloseTo(1.5, 9);
		expect(a!.residuo).toBeCloseTo(8.5, 9);
		expect(a!.percentualeUtilizzo).toBeCloseTo(0.15, 9);
		expect(a!.matrice.totaliPerMese[m1]).toBeCloseTo(1, 9);
		expect(a!.matrice.totaliPerMese[m2]).toBeCloseTo(0.5, 9);
		expect((await fatturazione(m1, o.cliente.id)).imponibileManodopera).toBeCloseTo(600, 6);
		expect((await fatturazione(m2, o.cliente.id)).imponibileManodopera).toBeCloseTo(350, 6);
	});

	test("[calcoli] C4 giorno precedente e giorno di decorrenza usano tariffe diverse", async () => {
		const anno = Number(mesePassatoRiservato("ORACOLO-T3-C4").slice(0, 4)) - 1;
		const capodanno = `${anno}-01-01`;
		const vigilia = `${anno - 1}-12-31`;
		const c = await collaboratoreCon([
			{ decorrenza: null, tariffa: 400 },
			{ decorrenza: capodanno, tariffa: 500 },
		]);
		const o = await offertaCon([
			{ decorrenza: null, tariffa: 600 },
			{ decorrenza: capodanno, tariffa: 700 },
		]);
		await riga(c.collaboratoreId, o.offerta, vigilia, "8");
		await riga(c.collaboratoreId, o.offerta, capodanno, "8");
		expect((await riepilogoDi(c.utente, vigilia.slice(0, 7))).imponibileManodopera).toBeCloseTo(400, 6);
		expect((await riepilogoDi(c.utente, capodanno.slice(0, 7))).imponibileManodopera).toBeCloseTo(500, 6);
		expect((await fatturazione(vigilia.slice(0, 7), o.cliente.id)).imponibileManodopera).toBeCloseTo(600, 6);
		expect((await fatturazione(capodanno.slice(0, 7), o.cliente.id)).imponibileManodopera).toBeCloseTo(700, 6);
	});

	test("[calcoli] C5 riga retrodatata usa tariffa storica anche inserita oggi", async () => {
		const m = mesePassatoRiservato("ORACOLO-T3-C5");
		const decorrenza = giornoDi(m, 1);
		const c = await collaboratoreCon([
			{ decorrenza: null, tariffa: 400 },
			{ decorrenza, tariffa: 500 },
		]);
		const o = await offertaCon([
			{ decorrenza: null, tariffa: 600 },
			{ decorrenza, tariffa: 700 },
		]);
		await factory.createAbilitazioneOfferta({ collaboratore: { id: c.collaboratoreId } as never, offerta: o.offerta });
		await come(c.utente);
		for (const data of [giornoDopo(decorrenza, -1), decorrenza]) {
			const form = new FormData();
			for (const [k, v] of Object.entries({ clienteId: o.cliente.id, offertaId: o.offertaId, ore: "8", fatturabile: "on", data, nota: "retrodatata oracolo" })) {
				form.set(k, v);
			}
			const esito = await tenta(() => creaRiga(form));
			expect((esito as { success?: boolean }).success, `riga del ${data} inserita oggi`).toBe(true);
		}
		const precedente = meseDopo(m, -1);
		expect((await riepilogoDi(c.utente, precedente)).imponibileManodopera).toBeCloseTo(400, 6);
		expect((await riepilogoDi(c.utente, m)).imponibileManodopera).toBeCloseTo(500, 6);
		expect((await fatturazione(precedente, o.cliente.id)).imponibileManodopera).toBeCloseTo(600, 6);
		expect((await fatturazione(m, o.cliente.id)).imponibileManodopera).toBeCloseTo(700, 6);
	});

	test("[calcoli] C6 tariffa futura non cambia il mese corrente o passato", async () => {
		const passato = mesePassatoRiservato("ORACOLO-T3-C6");
		const c = await collaboratoreCon([{ decorrenza: null, tariffa: 400 }]);
		const o = await offertaCon([{ decorrenza: null, tariffa: 600 }]);
		await riga(c.collaboratoreId, o.offerta, giornoDi(passato, 9), "8");
		await riga(c.collaboratoreId, o.offerta, giornoDi(meseCorrente, 1), "6");
		const foto = async () => ({
			riepilogoCorrente: await riepilogoDi(c.utente, meseCorrente),
			riepilogoPassato: await riepilogoDi(c.utente, passato),
			fatturaCorrente: await fatturazione(meseCorrente, o.cliente.id),
			fatturaPassato: await fatturazione(passato, o.cliente.id),
		});
		const prima = await foto();
		expect(prima.riepilogoCorrente.imponibileManodopera).toBeCloseTo(300, 6);
		expect(prima.fatturaPassato.imponibileManodopera).toBeCloseTo(600, 6);

		const futura = giornoDi(meseDopo(meseCorrente, 1), 1);
		await come(amministratore);
		await tenta(() => adattatore.pianificaTariffa(collaboratoreEntita(c.collaboratoreId), { decorrenza: futura, tariffa: 480 }));
		await tenta(() => adattatore.pianificaTariffa(offertaEntita(o.offertaId), { decorrenza: futura, tariffa: 720 }));
		expect((await dati.validita(collaboratoreEntita(c.collaboratoreId))).map((v) => v.tariffa)).toContain(480);
		expect((await dati.validita(offertaEntita(o.offertaId))).map((v) => v.tariffa)).toContain(720);
		expect(await foto()).toEqual(prima);
	});
});

// ── concorrenza (2) ─────────────────────────────────────────────────────────

/**
 * Inserimenti contemporanei dallo stesso processo dell'app: il client Prisma della consegna usa un
 * pool `pg`, quindi le operazioni concorrenti viaggiano su connessioni Postgres distinte e si
 * intercalano agli await esattamente come due richieste parallele al server.
 */
async function garaSullaStessaEntita(entita: EntitaTariffata): Promise<void> {
	const amministratori = [amministratore, utenteDi({ utente: await factory.createUtente({ ruolo: "AMMINISTRATORE" }) })];
	let attese = (await dati.validita(entita)).length;
	for (let giro = 0; giro < 6; giro++) {
		const decorrenza = giornoDi(meseDopo(CAPODANNO_PROSSIMO.slice(0, 7), giro), 1);
		await Promise.all(
			[0, 1, 2].map((i) =>
				conSessione(amministratori[i % 2], () =>
					tenta(() => adattatore.pianificaTariffa(entita, { decorrenza, tariffa: 700 + giro * 10 + i })),
				),
			),
		);
		const v = await dati.validita(entita);
		expect(v.filter((x) => x.decorrenza === decorrenza), `giro ${giro}: una sola validità dal ${decorrenza}`).toHaveLength(1);
		expect(v.length, `giro ${giro}: esattamente una validità in più`).toBe(++attese);
		expect(problemiCatena(v), `giro ${giro}`).toEqual([]);
	}
	// Due decorrenze diverse in contemporanea: possono riuscire entrambe, ma senza sovrapposizioni.
	const a = `${annoCorrente + 2}-03-01`;
	const b = `${annoCorrente + 2}-04-01`;
	await Promise.all([
		conSessione(amministratori[0], () => tenta(() => adattatore.pianificaTariffa(entita, { decorrenza: a, tariffa: 901 }))),
		conSessione(amministratori[1], () => tenta(() => adattatore.pianificaTariffa(entita, { decorrenza: b, tariffa: 902 }))),
	]);
	const finale = await dati.validita(entita);
	expect(finale.length).toBeGreaterThan(attese);
	expect(problemiCatena(finale)).toEqual([]);
}

describe("concorrenza", () => {
	test("[concorrenza] N1 due inserimenti concorrenti stessa offerta non sovrappongono validità", async () => {
		const o = await offertaCon([{ decorrenza: null, tariffa: 600 }]);
		await garaSullaStessaEntita(offertaEntita(o.offertaId));
	}, 240_000);

	test("[concorrenza] N2 due inserimenti concorrenti stesso collaboratore non sovrappongono validità", async () => {
		const c = await collaboratoreCon([{ decorrenza: null, tariffa: 400 }]);
		await garaSullaStessaEntita(collaboratoreEntita(c.collaboratoreId));
	}, 240_000);
});

// ── autorizzazioni (1) ──────────────────────────────────────────────────────

describe("autorizzazioni", () => {
	test("[autorizzazioni] A1 non amministratore non inserisce/corregge tariffe", async () => {
		const c = await collaboratoreCon([{ decorrenza: null, tariffa: 400 }]);
		const o = await offertaCon([{ decorrenza: null, tariffa: 600 }]);
		await come(amministratore);
		await tenta(() => adattatore.pianificaTariffa(offertaEntita(o.offertaId), { decorrenza: CAPODANNO_PROSSIMO, tariffa: 650 }));
		await tenta(() => adattatore.pianificaTariffa(collaboratoreEntita(c.collaboratoreId), { decorrenza: CAPODANNO_PROSSIMO, tariffa: 430 }));
		const prima = {
			offerta: ordina(await dati.validita(offertaEntita(o.offertaId))),
			collaboratore: ordina(await dati.validita(collaboratoreEntita(c.collaboratoreId))),
		};
		expect(prima.offerta, "precondizione: l'amministratore pianifica").toHaveLength(2);
		expect(prima.collaboratore, "precondizione: l'amministratore pianifica").toHaveLength(2);

		for (const utente of [c.utente, null]) {
			await come(utente);
			for (const entita of [offertaEntita(o.offertaId), collaboratoreEntita(c.collaboratoreId)]) {
				await tenta(() => adattatore.pianificaTariffa(entita, { decorrenza: `${annoCorrente + 2}-01-01`, tariffa: 999 }));
				await tenta(() => adattatore.correggiUltimaTariffa(entita, { tariffa: 1 }));
			}
		}
		expect(ordina(await dati.validita(offertaEntita(o.offertaId)))).toEqual(prima.offerta);
		expect(ordina(await dati.validita(collaboratoreEntita(c.collaboratoreId)))).toEqual(prima.collaboratore);
	});
});
