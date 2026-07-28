/**
 * Test per lo script di bootstrap idempotente dell'amministratore iniziale (US-041)
 *
 * Verifica, sul confine di persistenza (client `ClientBootstrap` iniettato):
 * - AC-1: se l'utente non esiste, viene creato con ruolo AMMINISTRATORE,
 *   nome predefinito non vuoto e email normalizzata (trim + lowercase)
 * - AC-2: se l'utente esiste già, nessuna scrittura viene effettuata
 * - AC-3: senza email valorizzata (o solo spazi), la validazione fallisce
 *   con un messaggio che referenzia la variabile d'ambiente attesa, senza
 *   invocare alcun metodo del client
 */

import { describe, it, expect, vi } from "vitest";
import {
	NOME_PREDEFINITO_AMMINISTRATORE,
	COGNOME_PREDEFINITO_AMMINISTRATORE,
	validaEmailAmministratoreIniziale,
	eseguiBootstrapAmministratoreIniziale,
	type ClientBootstrap,
} from "@/../scripts/bootstrap-amministratore-iniziale";

// ── Client finto ──────────────────────────────────────────────────

function creaClientFinto(): ClientBootstrap {
	return {
		utente: {
			findUnique: vi.fn(),
			create: vi.fn(),
		},
	};
}

// ── AC-1: creazione quando l'utente non esiste ────────────────────

describe("eseguiBootstrapAmministratoreIniziale — AC-1 (utente assente)", () => {
	it("crea l'amministratore con email normalizzata, ruolo AMMINISTRATORE e nome predefinito non vuoto", async () => {
		const client = creaClientFinto();
		const utenteCreato = {
			id: "utente-nuovo",
			nome: NOME_PREDEFINITO_AMMINISTRATORE,
			cognome: COGNOME_PREDEFINITO_AMMINISTRATORE,
			email: "admin@example.com",
			ruolo: "AMMINISTRATORE",
		};
		vi.mocked(client.utente.findUnique).mockResolvedValue(null);
		vi.mocked(client.utente.create).mockResolvedValue(utenteCreato);

		const validazione = validaEmailAmministratoreIniziale(
			" Admin@Example.com ",
		);
		expect(validazione.valida).toBe(true);
		const email = validazione.valida ? validazione.email : "";
		expect(email).toBe("admin@example.com");

		const risultato = await eseguiBootstrapAmministratoreIniziale(
			client,
			email,
		);

		expect(client.utente.create).toHaveBeenCalledTimes(1);
		expect(client.utente.create).toHaveBeenCalledWith({
			data: {
				email: "admin@example.com",
				ruolo: "AMMINISTRATORE",
				nome: NOME_PREDEFINITO_AMMINISTRATORE,
				cognome: COGNOME_PREDEFINITO_AMMINISTRATORE,
			},
		});
		expect(NOME_PREDEFINITO_AMMINISTRATORE.trim()).not.toBe("");
		expect(COGNOME_PREDEFINITO_AMMINISTRATORE.trim()).not.toBe("");

		expect(risultato).toEqual({ esito: "creato", utente: utenteCreato });
	});
});

// ── AC-2: nessuna scrittura quando l'utente esiste già ─────────────

describe("eseguiBootstrapAmministratoreIniziale — AC-2 (utente già esistente)", () => {
	it("non crea né modifica nulla e restituisce l'utente esistente invariato", async () => {
		const client = creaClientFinto();
		const utenteEsistente = {
			id: "utente-esistente-id",
			nome: "Mario",
			cognome: "Rossi",
			email: "admin@example.com",
			ruolo: "COLLABORATORE",
			attivo: false,
		};
		vi.mocked(client.utente.findUnique).mockResolvedValue(utenteEsistente);

		const risultato = await eseguiBootstrapAmministratoreIniziale(
			client,
			"admin@example.com",
		);

		expect(client.utente.create).not.toHaveBeenCalled();
		expect(client.utente.findUnique).toHaveBeenCalledTimes(1);
		expect(risultato).toEqual({
			esito: "gia-esistente",
			utente: utenteEsistente,
		});
		if (risultato.esito === "gia-esistente") {
			expect(risultato.utente.id).toBe("utente-esistente-id");
			expect(risultato.utente.ruolo).toBe("COLLABORATORE");
			expect(
				(risultato.utente as typeof utenteEsistente).attivo,
			).toBe(false);
		}
	});
});

// ── AC-3: validazione dell'email mancante ─────────────────────────

describe("validaEmailAmministratoreIniziale — AC-3 (email non configurata)", () => {
	it.each([
		["undefined", undefined],
		["stringa vuota", ""],
		["solo spazi", "   "],
	])(
		"restituisce valida:false con messaggio su AMMINISTRATORE_INIZIALE_EMAIL quando il valore è %s",
		(_descrizione, valore) => {
			const client = creaClientFinto();

			const risultato = validaEmailAmministratoreIniziale(valore);

			expect(risultato.valida).toBe(false);
			if (!risultato.valida) {
				expect(risultato.messaggio).toContain(
					"AMMINISTRATORE_INIZIALE_EMAIL",
				);
			}
			expect(client.utente.findUnique).not.toHaveBeenCalled();
			expect(client.utente.create).not.toHaveBeenCalled();
		},
	);

	it("normalizza un'email valida con spazi e maiuscole (trim + lowercase)", () => {
		const risultato = validaEmailAmministratoreIniziale(
			" ADMIN@Example.COM ",
		);

		expect(risultato.valida).toBe(true);
		if (risultato.valida) {
			expect(risultato.email).toBe("admin@example.com");
		}
	});
});

// ── Idempotenza esplicita su due esecuzioni consecutive ────────────

describe("eseguiBootstrapAmministratoreIniziale — idempotenza su esecuzioni ripetute", () => {
	it("non richiama create alla seconda esecuzione se l'utente è già stato creato dalla prima", async () => {
		const client = creaClientFinto();
		const utenteCreato = {
			id: "utente-idempotente",
			nome: NOME_PREDEFINITO_AMMINISTRATORE,
			cognome: COGNOME_PREDEFINITO_AMMINISTRATORE,
			email: "admin@example.com",
			ruolo: "AMMINISTRATORE",
		};

		vi.mocked(client.utente.findUnique).mockResolvedValueOnce(null);
		vi.mocked(client.utente.create).mockResolvedValueOnce(utenteCreato);

		const primoRisultato = await eseguiBootstrapAmministratoreIniziale(
			client,
			"admin@example.com",
		);
		expect(primoRisultato).toEqual({ esito: "creato", utente: utenteCreato });

		vi.mocked(client.utente.findUnique).mockResolvedValueOnce(utenteCreato);

		const secondoRisultato = await eseguiBootstrapAmministratoreIniziale(
			client,
			"admin@example.com",
		);

		expect(secondoRisultato).toEqual({
			esito: "gia-esistente",
			utente: utenteCreato,
		});
		expect(client.utente.create).toHaveBeenCalledTimes(1);
	});
});
