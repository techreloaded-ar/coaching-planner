import { describe, it, expect } from "vitest";
import { redirect } from "next/navigation";

import { MESSAGGIO_ERRORE_DI_RETE } from "@/components/indicatore-salvataggio";
import {
	conAggiunte,
	conVoceTariffa,
	elencoLeggibile,
	eseguiMutazione,
	esitoDaStato,
	messaggioMutazioneNonRiuscita,
	ordinaPerClienteECodice,
	ordinaPerCognomeENome,
} from "@/lib/mutazioni-ottimistiche";
import { periodiDiValidita } from "@/domain/tariffe";

describe("ordinamenti degli elenchi provvisori", () => {
	it("ordina per cognome e poi per nome, senza distinguere maiuscole e accenti", () => {
		const ordinati = ordinaPerCognomeENome([
			{ nome: "Luca", cognome: "rossi" },
			{ nome: "Anna", cognome: "Bianchi" },
			{ nome: "Carlo", cognome: "Rossi" },
			{ nome: "Ève", cognome: "Àlberti" },
		]);

		expect(ordinati.map((persona) => `${persona.cognome} ${persona.nome}`)).toEqual([
			"Àlberti Ève",
			"Bianchi Anna",
			"Rossi Carlo",
			"rossi Luca",
		]);
	});

	it("ordina per ragione sociale del cliente e poi per codice offerta", () => {
		const ordinate = ordinaPerClienteECodice([
			{ clienteRagioneSociale: "Gamma", codice: "G-2" },
			{ clienteRagioneSociale: "Alfa", codice: "A-2" },
			{ clienteRagioneSociale: "Gamma", codice: "G-1" },
			{ clienteRagioneSociale: "Alfa", codice: "A-1" },
		]);

		expect(ordinate.map((offerta) => offerta.codice)).toEqual(["A-1", "A-2", "G-1", "G-2"]);
	});

	it("non modifica l'elenco ricevuto", () => {
		const elenco = [
			{ nome: "B", cognome: "B" },
			{ nome: "A", cognome: "A" },
		];
		ordinaPerCognomeENome(elenco);
		expect(elenco[0].cognome).toBe("B");
	});
});

describe("conAggiunte", () => {
	it("aggiunge solo gli elementi nuovi e riordina", () => {
		const elenco = [
			{ collaboratoreId: "c-1", nome: "Anna", cognome: "Rossi" },
			{ collaboratoreId: "c-2", nome: "Bruno", cognome: "Verdi" },
		];
		const risultato = conAggiunte(
			elenco,
			[
				{ collaboratoreId: "c-3", nome: "Carla", cognome: "Bianchi" },
				{ collaboratoreId: "c-1", nome: "Anna", cognome: "Rossi" },
			],
			(collaboratore) => collaboratore.collaboratoreId,
			ordinaPerCognomeENome,
		);

		expect(risultato.map((collaboratore) => collaboratore.collaboratoreId)).toEqual([
			"c-3",
			"c-1",
			"c-2",
		]);
	});
});

describe("conVoceTariffa", () => {
	const storico = [
		{ id: "t-2026-07", validaDalMese: "2026-07", validaAlMese: null },
		{ id: "t-2026-01", validaDalMese: "2026-01", validaAlMese: null },
		{ id: "t-2025-01", validaDalMese: "2025-01", validaAlMese: null },
	];

	it("inserisce una voce nuova al suo posto, dalla più recente", () => {
		const nuova = { id: "provvisoria-1", validaDalMese: "2026-03", validaAlMese: null };
		const risultato = conVoceTariffa(storico, nuova, null);

		expect(risultato.map((voce) => voce.id)).toEqual([
			"t-2026-07",
			"provvisoria-1",
			"t-2026-01",
			"t-2025-01",
		]);
	});

	it("sostituisce la voce modificata e la riordina se cambia mese", () => {
		const modificata = { id: "t-2026-01", validaDalMese: "2026-09", validaAlMese: null };
		const risultato = conVoceTariffa(storico, modificata, "t-2026-01");

		expect(risultato.map((voce) => [voce.id, voce.validaDalMese])).toEqual([
			["t-2026-01", "2026-09"],
			["t-2026-07", "2026-07"],
			["t-2025-01", "2025-01"],
		]);
	});

	it("ricalcola i periodi di validità sull'elenco provvisorio", () => {
		const nuova = { id: "provvisoria-1", validaDalMese: "2026-03", validaAlMese: null };
		const risultato = conVoceTariffa(storico, nuova, null);
		const periodi = periodiDiValidita(risultato);

		expect(periodi.get(risultato[1])).toBe("mar 2026 → giu 2026");
		expect(periodi.get(risultato[2])).toBe("gen 2026 → feb 2026");
	});
});

describe("messaggi delle mutazioni non riuscite", () => {
	it("elenca nomi e codici in forma leggibile", () => {
		expect(elencoLeggibile([])).toBe("");
		expect(elencoLeggibile(["A"])).toBe("A");
		expect(elencoLeggibile(["A", "B"])).toBe("A e B");
		expect(elencoLeggibile(["A", "B", "C"])).toBe("A, B e C");
	});

	it("dice cosa non è riuscito e il motivo dato dal server", () => {
		expect(
			messaggioMutazioneNonRiuscita("La revoca di Mario Rossi non è riuscita", "L'offerta non è attiva"),
		).toBe("La revoca di Mario Rossi non è riuscita: l'offerta non è attiva");
	});

	it("conserva le sigle in apertura del motivo", () => {
		expect(messaggioMutazioneNonRiuscita("L'ingaggio non è riuscito", "ID offerta mancante")).toBe(
			"L'ingaggio non è riuscito: ID offerta mancante",
		);
	});

	it("senza motivo indica la rete o il server come causa", () => {
		expect(messaggioMutazioneNonRiuscita("L'eliminazione non è riuscita", null)).toBe(
			`L'eliminazione non è riuscita. ${MESSAGGIO_ERRORE_DI_RETE}`,
		);
	});
});

describe("esito delle server action", () => {
	it("considera riuscito uno stato con successo o senza errori", () => {
		expect(esitoDaStato({ errori: {}, successo: true })).toEqual({ riuscita: true });
		expect(esitoDaStato({ errori: {} })).toEqual({ riuscita: true });
		expect(esitoDaStato(undefined)).toEqual({ riuscita: true });
	});

	it("usa l'errore di forma o il primo errore di campo come motivo", () => {
		expect(esitoDaStato({ errori: { _form: "Offerta non trovata" } })).toEqual({
			riuscita: false,
			errori: { _form: "Offerta non trovata" },
			motivo: "Offerta non trovata",
		});
		expect(esitoDaStato({ errori: { validaDalMese: "Mese occupato" } })).toMatchObject({
			riuscita: false,
			motivo: "Mese occupato",
		});
	});

	it("trasforma un errore lanciato (rete) in esito non riuscito senza motivo", async () => {
		const esito = await eseguiMutazione(() => Promise.reject(new TypeError("Failed to fetch")));
		expect(esito).toEqual({ riuscita: false, errori: {}, motivo: null });
	});

	it("rilancia il redirect di Next, che deve proseguire", async () => {
		await expect(
			eseguiMutazione(async () => {
				redirect("/anagrafiche/voci-rimborso?esito=eliminato");
			}),
		).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
	});
});
