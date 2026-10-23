/**
 * Fase «prima» della migrazione con dati (NON è un controllo a punteggio: il titolo non ha codice).
 * Gira sul worktree della BASELINE, dopo `prisma migrate deploy` + seed, con l'oracolo installato e
 * l'adattatore nullo. Popola un dataset deterministico e realistico e fotografa con le funzioni
 * reali della baseline: report fatturazione per cliente e mese, riepilogo per collaboratore e
 * mese, avanzamento per offerta, righe attività serializzate, tariffe correnti.
 * Uscita: file JSON in ORACOLO_FOTO_PRIMA (contratto `FotoPrima`).
 */
import { writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import { createE2eDataFactory, type CollaboratoreTestData } from "../../../tests/e2e/support/factory";
import { e2ePrisma } from "../../../tests/e2e/support/prisma";
import type { Offerta } from "../../../src/generated/prisma/client";
import { come, dataUtc, giornoDi, meseDopo, tokenDa, ultimaDomenica, utenteDi } from "../integrazione";
import { proiezioniBaseline } from "../proiezioni-baseline";
import type { FotoPrima } from "./foto-prima";

const ORE = ["0.25", "0.5", "1", "2.75", "3", "3", "4", "6.5", "7.5", "8"];
const RIMBORSI = ["12.50", "35.00", "48.20"];

/** Generatore pseudo-casuale deterministico (mulberry32): stesso dataset a ogni esecuzione. */
function generatore(seme: number) {
	let a = seme >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

test("fase prima: popola dati realistici e fotografa tutti i mesi", async () => {
	const destinazione = process.env.ORACOLO_FOTO_PRIMA;
	expect(destinazione, "ORACOLO_FOTO_PRIMA obbligatoria").toBeTruthy();
	const casuale = generatore(20260101);
	const scegli = <T>(valori: readonly T[]): T => valori[Math.floor(casuale() * valori.length)];
	const factory = createE2eDataFactory("oracolo-migrazione-dati");

	const amministratore = utenteDi({ utente: await factory.createUtente({ ruolo: "AMMINISTRATORE" }) });
	const collaboratori: CollaboratoreTestData[] = [];
	for (const tariffa of ["350.00", "400.00", "420.00", "515.00"]) {
		collaboratori.push(await factory.createCollaboratore({ tariffaGiornaliera: tariffa }));
	}
	const offerte: Offerta[] = [];
	for (const [indice, tariffe] of [["480.00", "640.00"], ["550.00"], ["600.00", "700.00"]].entries()) {
		const cliente = await factory.createCliente({ ragioneSociale: `Cliente migrazione ${indice + 1}` });
		for (const tariffa of tariffe) {
			offerte.push(await factory.createOfferta({ cliente, tariffaGiornaliera: tariffa, giorniPrevisti: 40 + indice * 15 }));
		}
	}

	// 30 mesi conclusi + il mese corrente; date di confine, cambi ora, frazioni, non fatturabili, rimborsi.
	const oggi = new Date();
	const corrente = tokenDa(oggi.getUTCFullYear(), oggi.getUTCMonth() + 1);
	const mesi = Array.from({ length: 31 }, (_, i) => meseDopo(corrente, i - 30));
	for (const token of mesi) {
		const [anno, mese] = token.split("-").map(Number);
		const ultimo = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
		const limite = token === corrente ? Math.max(1, oggi.getUTCDate() - 1) : ultimo;
		const giorni = new Set<string>([giornoDi(token, 1), giornoDi(token, Math.min(limite, ultimo))]);
		if (mese === 3 || mese === 10) giorni.add(ultimaDomenica(anno, mese));
		while (giorni.size < Math.min(7, limite)) giorni.add(giornoDi(token, 1 + Math.floor(casuale() * limite)));
		for (const data of giorni) {
			if (data > giornoDi(corrente, Math.max(1, oggi.getUTCDate()))) continue;
			const collaboratore = scegli(collaboratori);
			const offerta = offerte[(collaboratori.indexOf(collaboratore) + Math.floor(casuale() * 3)) % offerte.length];
			const conRimborso = casuale() > 0.75;
			await factory.createRigaAttivita({
				collaboratore,
				offerta,
				data: dataUtc(data),
				ore: scegli(ORE),
				fatturabile: casuale() > 0.2,
				rimborsoTrasfertaEtichetta: conRimborso ? "Trasferta migrazione" : null,
				rimborsoTrasfertaImporto: conRimborso ? scegli(RIMBORSI) : null,
			});
		}
	}

	// Fotografia con le funzioni reali della baseline.
	const { rows: popolati } = await e2ePrisma.query(
		`SELECT DISTINCT to_char("data", 'YYYY-MM') AS token FROM "RigaAttivita" ORDER BY 1`,
	);
	const { rows: clienti } = await e2ePrisma.query(`SELECT DISTINCT "clienteId" FROM "RigaAttivita"`);
	const { rows: tariffeOfferte } = await e2ePrisma.query(
		`SELECT o."id", o."clienteId", o."tariffaGiornaliera"::text AS tariffa, min(r."data")::text AS prima
		 FROM "Offerta" o LEFT JOIN "RigaAttivita" r ON r."offertaId" = o."id" GROUP BY o."id"`,
	);
	const { rows: tariffeCollaboratori } = await e2ePrisma.query(
		`SELECT c."id", c."tariffaGiornaliera"::text AS tariffa, min(r."data")::text AS prima, u."id" AS "utenteId",
		        u."ruolo"::text AS ruolo, u."nome", u."cognome", u."email"
		 FROM "Collaboratore" c JOIN "Utente" u ON u."id" = c."userId" LEFT JOIN "RigaAttivita" r ON r."collaboratoreId" = c."id"
		 GROUP BY c."id", u."id"`,
	);
	const { rows: righe } = await e2ePrisma.query(`SELECT row_to_json(r)::text AS riga FROM "RigaAttivita" r ORDER BY r."id"`);

	const foto: FotoPrima = {
		generata: new Date().toISOString(),
		amministratore,
		mesi: popolati.map((r) => r.token as string),
		offerte: tariffeOfferte.map((r) => ({ id: r.id, clienteId: r.clienteId, tariffa: Number(r.tariffa), primaRiga: r.prima })),
		collaboratori: tariffeCollaboratori.map((r) => ({
			id: r.id,
			tariffa: Number(r.tariffa),
			primaRiga: r.prima,
			utente: { id: r.utenteId, ruolo: r.ruolo, nome: `${r.nome} ${r.cognome}`, email: r.email },
		})),
		fatturazione: {},
		riepiloghi: {},
		avanzamento: {},
		righe: righe.map((r) => r.riga as string).join("\n"),
	};
	for (const token of foto.mesi) {
		await come(amministratore);
		foto.fatturazione[token] = {};
		for (const { clienteId } of clienti) {
			const voce = await proiezioniBaseline.importiFatturazioneCliente(token, clienteId);
			if (voce) foto.fatturazione[token][clienteId] = voce;
		}
		foto.riepiloghi[token] = {};
		for (const c of foto.collaboratori.filter((x) => x.primaRiga !== null)) {
			await come(c.utente);
			foto.riepiloghi[token][c.id] = await proiezioniBaseline.riepilogoMese(token);
		}
	}
	await come(amministratore);
	for (const o of foto.offerte) {
		const voce = await proiezioniBaseline.avanzamentoOfferta(o.id, o.clienteId);
		if (voce) foto.avanzamento[o.id] = voce;
	}
	expect(foto.mesi.length).toBeGreaterThanOrEqual(30);
	expect(Object.values(foto.fatturazione).every((perCliente) => Object.keys(perCliente).length > 0)).toBe(true);
	writeFileSync(destinazione!, JSON.stringify(foto, null, 1));
}, 600_000);
