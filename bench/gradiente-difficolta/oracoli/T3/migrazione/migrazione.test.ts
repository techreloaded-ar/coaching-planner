/**
 * Oracolo T3 · controlli M1–M3 della migrazione con dati. Titoli "[migrazione] Mn ...".
 * Eseguito da `migrazione_con_dati.py` sulla copia della consegna, DOPO che la fase «prima» ha
 * popolato e fotografato il database con la baseline e dopo `prisma migrate deploy` della consegna.
 * Le letture passano dall'adattatore della consegna; i valori attesi vengono dalla foto della baseline.
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, test } from "vitest";
import { e2ePrisma } from "../../tests/e2e/support/prisma";
import { come } from "../shared/integrazione";
import type { FotoPrima } from "../shared/migrazione/foto-prima";
import type { ImportiClienteFatturazione, RiepilogoMeseCollaboratore } from "../contratto";
import { adattatoreDati as dati } from "../adattatore/dati";
import { adattatoreIntegrazione as adattatore } from "../adattatore/integrazione";

let foto: FotoPrima;
const oggi = new Date().toISOString().slice(0, 10);

beforeAll(() => {
	const percorso = process.env.ORACOLO_FOTO_PRIMA;
	if (!percorso) throw new Error("ORACOLO_FOTO_PRIMA obbligatoria: eseguire tramite migrazione_con_dati.py");
	foto = JSON.parse(readFileSync(percorso, "utf8")) as FotoPrima;
});

/** Importi al centesimo (assorbe solo il rumore della virgola mobile), giornate esatte. */
function confrontaImporti(etichetta: string, dopo: Record<string, number>, prima: Record<string, number>, campiGiornate: string[]) {
	for (const [campo, atteso] of Object.entries(prima)) {
		if (typeof atteso !== "number") continue;
		const osservato = dopo[campo];
		if (!campiGiornate.includes(campo) && Number.isFinite(osservato) && Math.abs(osservato - atteso) >= 0.005) {
			throw new Error(`VIOLAZIONE_CRITICA_IMPORTO_PASSATO: ${etichetta} · ${campo}: ${atteso} → ${osservato}`);
		}
		expect(dopo[campo], `${etichetta} · ${campo}`).toBeCloseTo(atteso, campiGiornate.includes(campo) ? 9 : 2);
	}
}

function confrontaFatturazione(etichetta: string, dopo: ImportiClienteFatturazione | null, prima: ImportiClienteFatturazione) {
	expect(dopo, `${etichetta}: cliente assente dopo la migrazione`).not.toBeNull();
	confrontaImporti(etichetta, dopo as unknown as Record<string, number>, prima as unknown as Record<string, number>, []);
	expect(dopo!.perOfferta.map((o) => o.offertaId).sort(), `${etichetta}: offerte`).toEqual(prima.perOfferta.map((o) => o.offertaId).sort());
	for (const offerta of prima.perOfferta) {
		const voce = dopo!.perOfferta.find((o) => o.offertaId === offerta.offertaId)!;
		confrontaImporti(`${etichetta} · offerta ${offerta.offertaId}`, voce as unknown as Record<string, number>, offerta as unknown as Record<string, number>, [
			"giornateFatturabili",
		]);
	}
}

function confrontaRiepilogo(etichetta: string, dopo: RiepilogoMeseCollaboratore, prima: RiepilogoMeseCollaboratore) {
	const giornate = ["oreTotali", "oreFatturabili", "giornateTotali", "giornateFatturabili"];
	confrontaImporti(etichetta, dopo as unknown as Record<string, number>, prima as unknown as Record<string, number>, giornate);
	expect(dopo.perOfferta.map((o) => o.offertaId).sort(), `${etichetta}: offerte`).toEqual(prima.perOfferta.map((o) => o.offertaId).sort());
	for (const voce of prima.perOfferta) {
		const corrispondente = dopo.perOfferta.find((o) => o.offertaId === voce.offertaId)!;
		confrontaImporti(`${etichetta} · offerta ${voce.offertaId}`, corrispondente as unknown as Record<string, number>, voce as unknown as Record<string, number>, giornate);
	}
}

describe("migrazione", () => {
	test("[migrazione] M1 tariffe attuali convertite in validità iniziale aperta", async () => {
		expect(foto.offerte.length + foto.collaboratori.length).toBeGreaterThan(5);
		const entita = [
			...foto.offerte.map((o) => ({ entita: { tipo: "offerta" as const, id: o.id }, tariffa: o.tariffa, primaRiga: o.primaRiga })),
			...foto.collaboratori.map((c) => ({ entita: { tipo: "collaboratore" as const, id: c.id }, tariffa: c.tariffa, primaRiga: c.primaRiga })),
		];
		for (const { entita: e, tariffa, primaRiga } of entita) {
			const validita = await dati.validita(e);
			expect(validita, `${e.tipo} ${e.id}: una sola validità dopo la migrazione`).toHaveLength(1);
			const [unica] = validita;
			expect(unica.tariffa, `${e.tipo} ${e.id}: tariffa conservata`).toBe(tariffa);
			expect(unica.fine, `${e.tipo} ${e.id}: validità aperta`).toBeNull();
			const limite = primaRiga && primaRiga < oggi ? primaRiga : oggi;
			expect(unica.decorrenza === null || unica.decorrenza <= limite, `${e.tipo} ${e.id}: decorrenza ${unica.decorrenza} copre le righe dal ${limite}`).toBe(true);
		}
	});

	test("[migrazione] M2 report di tutti i mesi popolati invariati prima/dopo migrate deploy", async () => {
		expect(foto.mesi.length).toBeGreaterThanOrEqual(30);
		for (const token of foto.mesi) {
			await come(foto.amministratore);
			for (const [clienteId, prima] of Object.entries(foto.fatturazione[token])) {
				confrontaFatturazione(`fatturazione ${token} cliente ${clienteId}`, await adattatore.importiFatturazioneCliente(token, clienteId), prima);
			}
			for (const [collaboratoreId, prima] of Object.entries(foto.riepiloghi[token])) {
				const collaboratore = foto.collaboratori.find((c) => c.id === collaboratoreId)!;
				await come(collaboratore.utente);
				confrontaRiepilogo(`riepilogo ${token} collaboratore ${collaboratoreId}`, await adattatore.riepilogoMese(token), prima);
			}
		}
		await come(foto.amministratore);
		for (const [offertaId, prima] of Object.entries(foto.avanzamento)) {
			const offerta = foto.offerte.find((o) => o.id === offertaId)!;
			const dopo = await adattatore.avanzamentoOfferta(offertaId, offerta.clienteId);
			expect(dopo, `avanzamento ${offertaId}`).not.toBeNull();
			expect(dopo!.giornateErogate, `avanzamento ${offertaId}`).toBeCloseTo(prima.giornateErogate, 9);
			expect(dopo!.residuo, `avanzamento ${offertaId}`).toBeCloseTo(prima.residuo, 9);
			expect(dopo!.matrice.totaliPerMese, `matrice ${offertaId}`).toEqual(prima.matrice.totaliPerMese);
		}
	}, 600_000);

	test("[migrazione] M3 righe attività invariate byte per byte prima/dopo migrazione", async () => {
		const { rows } = await e2ePrisma.query(`SELECT row_to_json(r)::text AS riga FROM "RigaAttivita" r ORDER BY r."id"`);
		const dopo = rows.map((r) => r.riga as string).join("\n");
		expect(dopo.split("\n").length).toBe(foto.righe.split("\n").length);
		expect(dopo).toBe(foto.righe);
	});
});
