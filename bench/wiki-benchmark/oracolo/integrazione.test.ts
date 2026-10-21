/**
 * Oracolo, livello integrazione. Ogni test ha il titolo "[area] ID descrizione": il valutatore
 * calcola i punti per area da questi titoli. Ogni test usa un mese suo (la chiusura è globale).
 * Gli esiti sono sempre verificati sullo stato del database, mai sul messaggio restituito.
 */
import { beforeAll, describe, expect, test, vi } from "vitest";

// Token di sessione per chiamata: AsyncLocalStorage isola le operazioni contemporanee,
// il valore di default serve alle operazioni sequenziali.
const sessione = await vi.hoisted(async () => {
	const { AsyncLocalStorage } = await import("node:async_hooks");
	const storage = new AsyncLocalStorage<string | null>();
	return {
		storage,
		predefinito: null as string | null,
		corrente(): string | null {
			const perChiamata = storage.getStore();
			return perChiamata === undefined ? this.predefinito : perChiamata;
		},
	};
});

vi.mock("next/headers", () => ({
	cookies: async () => {
		const token = sessione.corrente();
		return {
			get: (name: string) => (token ? { name, value: token } : undefined),
			getAll: () => (token ? [{ name: "sessione", value: token }] : []),
			has: () => Boolean(token),
			set: () => undefined,
			delete: () => undefined,
		};
	},
	headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({
	revalidatePath: () => undefined,
	revalidateTag: () => undefined,
	updateTag: () => undefined,
	refresh: () => undefined,
	unstable_cache: (fn: unknown) => fn,
}));
vi.mock("next/navigation", () => ({
	redirect: (url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	},
	permanentRedirect: (url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	},
	notFound: () => {
		throw new Error("NEXT_NOT_FOUND");
	},
	forbidden: () => {
		throw new Error("NEXT_FORBIDDEN");
	},
	unauthorized: () => {
		throw new Error("NEXT_UNAUTHORIZED");
	},
}));

import {
	creaRiga,
	duplicaRigaSuGiorni,
	eliminaRiga,
	modificaRiga,
	rimuoviRimborsoTrasferta,
} from "@/lib/actions/righe-attivita";
import { reportFatturazioneClientiMese } from "@/lib/report";
import { creaTokenSessione } from "@/lib/session-token";
import { e2ePrisma } from "../tests/e2e/support/prisma";
import { createE2eDataFactory, type CollaboratoreTestData } from "../tests/e2e/support/factory";
import type { Mese } from "./contratto";
import { adattatoreIntegrazione as adattatore } from "./adattatore/integrazione";

type Utente = CollaboratoreTestData["utente"];

const factory = createE2eDataFactory(`oracolo-integrazione-${process.pid}-${Date.now()}`);
let collaboratoreA: CollaboratoreTestData;
let collaboratoreB: CollaboratoreTestData;
let amministratore: CollaboratoreTestData;
let clienteId: string;
let clienteNome: string;
let offertaId: string;
let voceRimborsoId: string;

// ── tempo e mesi ────────────────────────────────────────────────────────────

const oggi = new Date();

/** Mese spostato di `delta` rispetto al mese corrente (negativo = passato). */
function meseRelativo(delta: number): Mese {
	const d = new Date(oggi.getFullYear(), oggi.getMonth() + delta, 1);
	return { anno: d.getFullYear(), mese: d.getMonth() + 1 };
}

/** Ogni test riserva un mese passato distinto; i mesi -1 … -13 restano al livello browser. */
let prossimoMese = -14;
function meseRiservato(): Mese {
	return meseRelativo(prossimoMese--);
}

function giorno(m: Mese, g: number): string {
	return `${m.anno}-${String(m.mese).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
}

// ── sessione e operazioni ───────────────────────────────────────────────────

async function tokenDi(utente: Utente | null): Promise<string | null> {
	if (!utente) return null;
	const { token } = await creaTokenSessione({
		utenteId: utente.id,
		ruolo: utente.ruolo,
		nome: utente.nome,
		email: utente.email,
	} as Parameters<typeof creaTokenSessione>[0]);
	return token;
}

/** Imposta la sessione per le operazioni sequenziali successive. */
async function come(utente: Utente | null): Promise<void> {
	sessione.predefinito = await tokenDi(utente);
}

/** Esegue `operazione` con la sessione di `utente`, isolata dalle operazioni contemporanee. */
async function conSessione<T>(utente: Utente, operazione: () => Promise<T>): Promise<T> {
	const token = await tokenDi(utente);
	return sessione.storage.run(token, operazione);
}

/** Esegue un'operazione ignorando esiti lanciati: l'oracolo guarda lo stato, non la risposta. */
async function tenta<T>(operazione: () => Promise<T>): Promise<T | Error> {
	try {
		return await operazione();
	} catch (errore) {
		return errore instanceof Error ? errore : new Error(String(errore));
	}
}

function riuscita(esito: unknown): boolean {
	return Boolean(esito) && !(esito instanceof Error) && (esito as { success?: boolean }).success === true;
}

function formRiga(dati: Record<string, string>): FormData {
	const form = new FormData();
	for (const [chiave, valore] of Object.entries(dati)) form.set(chiave, valore);
	return form;
}

function datiNuovaRiga(data: string, ore = "1"): Record<string, string> {
	return { clienteId, offertaId, ore, nota: `oracolo ${data}`, fatturabile: "on", data };
}

async function righeDelMese(collaboratore: CollaboratoreTestData, m: Mese) {
	const inizio = giorno(m, 1);
	const fine = giorno(meseSuccessivo(m), 1);
	const { rows } = await e2ePrisma.query(
		`SELECT "id", "data", "ore"::text AS "ore", "nota", "rimborsoTrasfertaEtichetta"
		 FROM "RigaAttivita" WHERE "collaboratoreId" = $1 AND "data" >= $2::date AND "data" < $3::date`,
		[collaboratore.collaboratore.id, inizio, fine],
	);
	return rows as Array<{ id: string; data: Date; ore: string; nota: string | null; rimborsoTrasfertaEtichetta: string | null }>;
}

function meseSuccessivo(m: Mese): Mese {
	return m.mese === 12 ? { anno: m.anno + 1, mese: 1 } : { anno: m.anno, mese: m.mese + 1 };
}

async function rigaInMese(collaboratore: CollaboratoreTestData, m: Mese, g = 10, conRimborso = false) {
	return factory.createRigaAttivita({
		collaboratore,
		cliente: { id: clienteId } as never,
		offerta: { id: offertaId } as never,
		data: new Date(Date.UTC(m.anno, m.mese - 1, g)),
		ore: "2",
		nota: "riga esistente",
		rimborsoTrasfertaEtichetta: conRimborso ? "Trasferta oracolo" : null,
		rimborsoTrasfertaImporto: conRimborso ? "30.00" : null,
	});
}

async function chiudiDaAmministratore(m: Mese): Promise<void> {
	await come(amministratore.utente);
	await tenta(() => adattatore.chiudiMese(m));
	expect(await adattatore.meseChiuso(m), "precondizione: l'amministratore chiude il mese").toBe(true);
}

beforeAll(async () => {
	collaboratoreA = await factory.createCollaboratore();
	collaboratoreB = await factory.createCollaboratore();
	amministratore = await factory.createCollaboratore({ utenteOptions: { ruolo: "AMMINISTRATORE" } });
	const { cliente, offerta } = await factory.createClienteConOfferta();
	clienteId = cliente.id;
	clienteNome = cliente.ragioneSociale;
	offertaId = offerta.id;
	for (const c of [collaboratoreA, collaboratoreB, amministratore]) {
		await factory.createAbilitazioneOfferta({ collaboratore: c, offerta });
	}
	voceRimborsoId = (await factory.createVoceRimborsoTrasferta({ etichetta: "Trasferta oracolo", importo: "30.00" })).id;
	expect(clienteNome).toBeTruthy();
	expect(voceRimborsoId).toBeTruthy();
});

// ── chiusura e riapertura (12) ──────────────────────────────────────────────

describe("chiusura", () => {
	test("[chiusura] C1 l'amministratore chiude un mese concluso", async () => {
		const m = meseRiservato();
		await come(amministratore.utente);
		await tenta(() => adattatore.chiudiMese(m));
		expect(await adattatore.meseChiuso(m)).toBe(true);
	});

	test("[chiusura] C2 il mese corrente non si può chiudere", async () => {
		const m = meseRelativo(0);
		await come(amministratore.utente);
		await tenta(() => adattatore.chiudiMese(m));
		expect(await adattatore.meseChiuso(m)).toBe(false);
	});

	test("[chiusura] C3 un mese futuro non si può chiudere", async () => {
		const m = meseRelativo(2);
		await come(amministratore.utente);
		await tenta(() => adattatore.chiudiMese(m));
		expect(await adattatore.meseChiuso(m)).toBe(false);
	});

	test("[chiusura] C4 l'amministratore riapre con motivazione", async () => {
		const m = meseRiservato();
		await chiudiDaAmministratore(m);
		await tenta(() => adattatore.riapriMese(m, "Errore di imputazione ore"));
		expect(await adattatore.meseChiuso(m)).toBe(false);
	});

	test("[chiusura] C5 la riapertura senza motivazione è rifiutata", async () => {
		const m = meseRiservato();
		await chiudiDaAmministratore(m);
		await tenta(() => adattatore.riapriMese(m, null));
		await tenta(() => adattatore.riapriMese(m, "   "));
		expect(await adattatore.meseChiuso(m)).toBe(true);
	});
});

// ── blocco su tutti i percorsi di scrittura (22) ────────────────────────────

describe("blocco", () => {
	test("[blocco] B1 creazione di una riga in un mese chiuso rifiutata", async () => {
		const m = meseRiservato();
		await chiudiDaAmministratore(m);
		await come(collaboratoreA.utente);
		await tenta(() => creaRiga(formRiga(datiNuovaRiga(giorno(m, 12)))));
		expect(await righeDelMese(collaboratoreA, m)).toHaveLength(0);
	});

	test("[blocco] B2 modifica di una riga di un mese chiuso rifiutata", async () => {
		const m = meseRiservato();
		const riga = await rigaInMese(collaboratoreA, m);
		await chiudiDaAmministratore(m);
		await come(collaboratoreA.utente);
		await tenta(() => modificaRiga(formRiga({ rigaId: riga.id, ...datiNuovaRiga(giorno(m, 10), "5") })));
		const [dopo] = await righeDelMese(collaboratoreA, m);
		expect(Number(dopo.ore)).toBe(2);
	});

	test("[blocco] B3 eliminazione di una riga di un mese chiuso rifiutata", async () => {
		const m = meseRiservato();
		const riga = await rigaInMese(collaboratoreA, m);
		await chiudiDaAmministratore(m);
		await come(collaboratoreA.utente);
		await tenta(() => eliminaRiga(riga.id));
		expect((await righeDelMese(collaboratoreA, m)).map((r) => r.id)).toContain(riga.id);
	});

	test("[blocco] B4 rimozione del rimborso trasferta in un mese chiuso rifiutata", async () => {
		const m = meseRiservato();
		const riga = await rigaInMese(collaboratoreA, m, 10, true);
		await chiudiDaAmministratore(m);
		await come(collaboratoreA.utente);
		await tenta(() => rimuoviRimborsoTrasferta(riga.id));
		const [dopo] = await righeDelMese(collaboratoreA, m);
		expect(dopo.rimborsoTrasfertaEtichetta).toBe("Trasferta oracolo");
	});

	test("[blocco] B5 duplicazione da un mese aperto verso un mese chiuso rifiutata", async () => {
		const chiuso = meseRiservato();
		const aperto = meseRiservato();
		const sorgente = await rigaInMese(collaboratoreA, aperto);
		await chiudiDaAmministratore(chiuso);
		await come(collaboratoreA.utente);
		await tenta(() => duplicaRigaSuGiorni(sorgente.id, [giorno(chiuso, 5), giorno(chiuso, 6)]));
		expect(await righeDelMese(collaboratoreA, chiuso)).toHaveLength(0);
	});

	test("[blocco] B6 spostare una riga di un mese aperto dentro un mese chiuso è rifiutato", async () => {
		const chiuso = meseRiservato();
		const aperto = meseRiservato();
		const riga = await rigaInMese(collaboratoreA, aperto);
		await chiudiDaAmministratore(chiuso);
		await come(collaboratoreA.utente);
		await tenta(() => modificaRiga(formRiga({ rigaId: riga.id, ...datiNuovaRiga(giorno(chiuso, 8), "2") })));
		expect(await righeDelMese(collaboratoreA, chiuso)).toHaveLength(0);
	});

	test("[blocco] B7 anche l'amministratore con profilo collaboratore è bloccato", async () => {
		const m = meseRiservato();
		await chiudiDaAmministratore(m);
		await come(amministratore.utente);
		await tenta(() => creaRiga(formRiga(datiNuovaRiga(giorno(m, 12)))));
		expect(await righeDelMese(amministratore, m)).toHaveLength(0);
	});

	test("[blocco] B8 un mese aperto adiacente resta scrivibile", async () => {
		const chiuso = meseRiservato();
		const adiacente = meseRiservato(); // il mese precedente a `chiuso`, riservato a questo test
		await chiudiDaAmministratore(chiuso);
		await come(collaboratoreA.utente);
		const esito = await tenta(() => creaRiga(formRiga(datiNuovaRiga(giorno(adiacente, 3)))));
		expect(riuscita(esito)).toBe(true);
		expect(await righeDelMese(collaboratoreA, adiacente)).toHaveLength(1);
	});

	test("[blocco] B9 dopo la riapertura le scritture tornano possibili", async () => {
		const m = meseRiservato();
		await chiudiDaAmministratore(m);
		await tenta(() => adattatore.riapriMese(m, "Correzione ore"));
		await come(collaboratoreA.utente);
		await tenta(() => creaRiga(formRiga(datiNuovaRiga(giorno(m, 12)))));
		expect(await righeDelMese(collaboratoreA, m)).toHaveLength(1);
	});
});

// ── autorizzazioni (12) ─────────────────────────────────────────────────────

describe("autorizzazioni", () => {
	test("[autorizzazioni] A1 un collaboratore non può chiudere un mese", async () => {
		const m = meseRiservato();
		await come(collaboratoreB.utente);
		await tenta(() => adattatore.chiudiMese(m));
		expect(await adattatore.meseChiuso(m)).toBe(false);
	});

	test("[autorizzazioni] A2 un collaboratore non può riaprire un mese chiuso", async () => {
		const m = meseRiservato();
		await chiudiDaAmministratore(m);
		await come(collaboratoreB.utente);
		await tenta(() => adattatore.riapriMese(m, "Voglio modificare"));
		expect(await adattatore.meseChiuso(m)).toBe(true);
	});

	test("[autorizzazioni] A3 senza sessione non si può chiudere né riaprire", async () => {
		const aperto = meseRiservato();
		const chiuso = meseRiservato();
		await chiudiDaAmministratore(chiuso);
		await come(null);
		await tenta(() => adattatore.chiudiMese(aperto));
		await tenta(() => adattatore.riapriMese(chiuso, "Anonimo"));
		expect(await adattatore.meseChiuso(aperto)).toBe(false);
		expect(await adattatore.meseChiuso(chiuso)).toBe(true);
	});
});

// ── concorrenza (10) ────────────────────────────────────────────────────────

describe("concorrenza", () => {
	test("[concorrenza] K1 scritture contemporanee alla chiusura: nessun successo perso o fantasma, nessuna scrittura dopo la chiusura", async () => {
		for (let round = 0; round < 10; round++) {
			const m = meseRiservato();
			const avviate = Array.from({ length: 12 }, (_, i) =>
				conSessione(collaboratoreA.utente, () => tenta(() => creaRiga(formRiga(datiNuovaRiga(giorno(m, i + 1), "0.5"))))),
			);
			const chiusura = conSessione(amministratore.utente, () => tenta(() => adattatore.chiudiMese(m)));
			const esiti = await Promise.all(avviate);
			await chiusura;
			expect(await adattatore.meseChiuso(m), `round ${round}: mese chiuso`).toBe(true);

			const successi = esiti.filter(riuscita).length;
			expect((await righeDelMese(collaboratoreA, m)).length, `round ${round}: righe = successi`).toBe(successi);

			await come(collaboratoreA.utente);
			await tenta(() => creaRiga(formRiga(datiNuovaRiga(giorno(m, 20), "0.5"))));
			expect((await righeDelMese(collaboratoreA, m)).length, `round ${round}: dopo la chiusura`).toBe(successi);
		}
	}, 180_000);

	test("[concorrenza] K2 due chiusure contemporanee producono un solo evento di chiusura", async () => {
		const m = meseRiservato();
		await Promise.all([
			conSessione(amministratore.utente, () => tenta(() => adattatore.chiudiMese(m))),
			conSessione(amministratore.utente, () => tenta(() => adattatore.chiudiMese(m))),
		]);
		expect(await adattatore.meseChiuso(m)).toBe(true);
		const eventi = await adattatore.storico(m);
		expect(eventi.filter((e) => e.tipo === "chiusura")).toHaveLength(1);
	});
});

// ── tracciabilità (6) ───────────────────────────────────────────────────────

describe("tracciabilita", () => {
	test("[tracciabilita] T1 la chiusura registra autore e momento", async () => {
		const m = meseRiservato();
		const prima = Date.now() - 1000;
		await chiudiDaAmministratore(m);
		const eventi = await adattatore.storico(m);
		expect(eventi).toHaveLength(1);
		expect(eventi[0].tipo).toBe("chiusura");
		expect(eventi[0].autoreUtenteId).toBe(amministratore.utente.id);
		expect(eventi[0].quando.getTime()).toBeGreaterThanOrEqual(prima);
	});

	test("[tracciabilita] T2 chiudi, riapri, richiudi conserva tre eventi con la motivazione", async () => {
		const m = meseRiservato();
		await chiudiDaAmministratore(m);
		await tenta(() => adattatore.riapriMese(m, "Errore di imputazione ore"));
		await tenta(() => adattatore.chiudiMese(m));
		const eventi = [...(await adattatore.storico(m))].sort((a, b) => a.quando.getTime() - b.quando.getTime());
		expect(eventi.map((e) => e.tipo)).toEqual(["chiusura", "riapertura", "chiusura"]);
		expect(eventi[1].motivazione).toBe("Errore di imputazione ore");
	});
});

// ── persistenza: dati invariati (parte di 8, il resto nel gate) ─────────────

describe("persistenza", () => {
	test("[persistenza] P3 chiudere non altera righe né report di fatturazione", async () => {
		const m = meseRiservato();
		await rigaInMese(collaboratoreA, m, 4);
		await rigaInMese(collaboratoreB, m, 5, true);
		const token = `${m.anno}-${String(m.mese).padStart(2, "0")}`;
		await come(amministratore.utente);
		const reportPrima = JSON.stringify(await reportFatturazioneClientiMese(token));
		const righePrima = JSON.stringify([await righeDelMese(collaboratoreA, m), await righeDelMese(collaboratoreB, m)]);
		await chiudiDaAmministratore(m);
		await come(amministratore.utente);
		expect(JSON.stringify([await righeDelMese(collaboratoreA, m), await righeDelMese(collaboratoreB, m)])).toBe(righePrima);
		const reportDopo = await reportFatturazioneClientiMese(token);
		// La consegna può aggiungere al report un campo di stato (anche già presente prima della chiusura):
		// si confrontano i soli campi della baseline (`RisultatoReportFatturazione` in src/lib/report.ts).
		const campiBaseline = ["token", "perCliente", "totali"] as const;
		const soloBaseline = (r: unknown) =>
			JSON.stringify(Object.fromEntries(campiBaseline.map((k) => [k, (r as Record<string, unknown>)[k]])));
		expect(soloBaseline(reportDopo)).toBe(soloBaseline(JSON.parse(reportPrima)));
	});
});
