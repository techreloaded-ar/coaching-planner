import { describe, expect, it } from "vitest";
import { contestoEventoSimulato } from "../../scripts/popola-dati-valutazione-jev";
import {
	calcolaMetriche,
	corpoRichiestaJev,
	dominiEsterni,
	offertaProposta,
	type EsitoCaso,
} from "../../scripts/valuta-jev-associazioni";

const esito = (attesa: string | null, scelta: string | null, cliente: number, confidenza: number): EsitoCaso => ({
	offertaAttesaId: attesa,
	evidenza: attesa === null ? "nessuna" : "dominio",
	offertaSceltaId: scelta,
	confidenza,
	probabilitaClienteIdentificato: cliente,
	probabilitaNonLavorativo: 0,
});

const offerta = (id: string, ragioneSociale: string) => ({
	id,
	codice: "OFF",
	descrizione: "Coaching",
	ragioneSociale,
	attiva: true,
	createdAt: new Date("2026-03-01T00:00:00Z"),
});

describe("valutazione Jev", () => {
	it("propone un'offerta solo se il cliente è identificato e la confidenza supera la soglia", () => {
		expect(offertaProposta(esito("a", "a", 0.9, 0.8), 0.7)).toBe("a");
		expect(offertaProposta(esito("a", "a", 0.3, 0.99), 0)).toBeNull();
		expect(offertaProposta(esito("a", "a", 0.9, 0.6), 0.7)).toBeNull();
		expect(offertaProposta(esito(null, null, 0, 0), 0)).toBeNull();
	});

	it("conta come giusto «nessuna corrispondenza» quando è la risposta attesa", () => {
		const metriche = calcolaMetriche([
			esito("a", "a", 0.9, 0.9), // proposta corretta
			esito("a", "b", 0.9, 0.9), // offerta sbagliata
			esito(null, "a", 0.8, 0.9), // proposta ma attesa nessuna
			esito(null, "a", 0.1, 0.9), // nessuna, giusto grazie a clientIdentified
			esito(null, "a", 0.2, 0.95), // nessuna, giusto grazie a clientIdentified anche con scelta sicura
		]);
		const sogliaZero = metriche.soglie.find((s) => s.soglia === 0)!;

		expect(sogliaZero).toMatchObject({
			proposte: 3,
			corrette: 1,
			"offerta sbagliata": 1,
			"proposta ma attesa nessuna": 1,
			"nessuna ma attesa offerta": 0,
			precisione: "33.3%",
			richiamo: "50.0%",
			"esiti giusti": "60.0%",
		});
		expect(metriche.clienteIdentificatoQuandoNonAtteso).toBe("33.3%");
		expect(metriche.perEvidenza.find((r) => r.evidenza === "nessuna")).toMatchObject({
			casi: 3,
			"esiti giusti @0": "66.7%",
		});
	});

	it("toglie i domini interni dagli invitati", () => {
		expect(dominiEsterni(["agilereloaded.it", "acmelogistica.it", "AgileReloaded.it"])).toEqual([
			"acmelogistica.it",
		]);
	});

	it("costruisce la richiesta in inglese con le domande clientIdentified e offer", () => {
		const { evento } = contestoEventoSimulato("ACM-COACH", "Daily", new Date("2026-09-14T00:00:00Z"), 1.5, 7);
		const corpo = corpoRichiestaJev("~typesafe/jev-latest", {
			numero: 1,
			collaboratore: "Giulia Conti",
			evento,
			evidenza: "dominio",
			offertaRegistrataId: "a",
			offertaAttesaId: "a",
			opzioni: [offerta("a", "Acme"), offerta("b", "Acme"), offerta("c", "Rossi")],
		});

		expect(Object.keys(corpo.questions)).toEqual(["clientIdentified", "offer", "notWorkRelated"]);
		expect(corpo.questions.clientIdentified.instructions.clients).toEqual(["Acme", "Rossi"]);
		expect(Object.keys(corpo.questions.offer.criteria)).toEqual(["Acme – OFF", "Acme – OFF (2)", "Rossi – OFF"]);
	});

	it("riconosce il cliente dal dominio o dal nome citato nel testo, mai per le offerte interne", () => {
		const giorno = new Date("2026-09-14T00:00:00Z");
		for (let seme = 0; seme < 300; seme++) {
			const generico = contestoEventoSimulato("ACM-COACH", "Allineamento settimanale", giorno, 1, seme);
			const conDominio = generico.evento.attendeeDomains.includes("acmelogistica.it");
			const citato = `${generico.evento.title} ${generico.evento.description}`.toLowerCase().includes("acme");
			expect(generico.evidenza).toBe(conDominio ? "dominio" : citato ? "testo" : "nessuna");

			const preparazione = contestoEventoSimulato("BVL-TRASF", "Preparazione workshop per Banca Valdostana", giorno, 1, seme);
			expect(preparazione.evidenza).not.toBe("nessuna");

			expect(contestoEventoSimulato("INT-SALES", "Call prevendita", giorno, 1, seme).evidenza).toBe("nessuna");
		}
	});
});
