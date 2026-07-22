/**
 * Bootstrap idempotente dell'amministratore iniziale (US-041)
 *
 * Uso:
 *   npm run db:bootstrap-amministratore
 *   npx tsx scripts/bootstrap-amministratore-iniziale.ts
 *
 * Requisiti:
 *   - Variabile d'ambiente AMMINISTRATORE_INIZIALE_EMAIL valorizzata con
 *     l'indirizzo email dell'amministratore da garantire
 *   - Variabile d'ambiente DATABASE_URL configurata (connessione PostgreSQL)
 *
 * Garanzia di idempotenza:
 *   - Se AMMINISTRATORE_INIZIALE_EMAIL manca o è vuota, lo script termina
 *     con errore SENZA istanziare alcun client Prisma e SENZA alcuna
 *     connessione al database.
 *   - Se esiste già un Utente con l'email indicata, lo script non esegue
 *     alcuna scrittura: si limita a segnalarlo in output e termina con successo.
 *   - Se l'utente non esiste, viene creato con ruolo AMMINISTRATORE, nome
 *     predefinito non vuoto e stato attivo (default di schema).
 *   - Lo script non promuove né riattiva utenti già censiti: agisce solo in
 *     assenza di un Utente con quella email.
 */

import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// ── Costanti ──────────────────────────────────────────────────────

export const NOME_PREDEFINITO_AMMINISTRATORE = "Amministratore Iniziale";

// ── Validazione input (esportata per testabilità) ────────────────

export function validaEmailAmministratoreIniziale(
	valore: string | undefined,
): { valida: true; email: string } | { valida: false; messaggio: string } {
	const email = (valore ?? "").trim().toLowerCase();

	if (email === "") {
		return {
			valida: false,
			messaggio:
				"Variabile d'ambiente AMMINISTRATORE_INIZIALE_EMAIL non configurata.\n" +
				"  Imposta AMMINISTRATORE_INIZIALE_EMAIL nell'ambiente (o in .env.local) " +
				"con l'indirizzo email dell'amministratore da garantire.\n" +
				'  Esempio: AMMINISTRATORE_INIZIALE_EMAIL="admin@esempio.it"',
		};
	}

	return { valida: true, email };
}

// ── Bootstrap (esportato per testabilità) ────────────────────────

interface UtenteBootstrap {
	id: string;
	nome: string;
	email: string;
	ruolo: string;
}

/**
 * Interfaccia minima del client richiesto dal bootstrap: solo i metodi
 * `utente.findUnique` e `utente.create`, con tipi strutturali minimi e
 * nessuna dipendenza dal client Prisma generato nella firma.
 */
export interface ClientBootstrap {
	utente: {
		findUnique(args: {
			where: { email: string };
		}): Promise<UtenteBootstrap | null>;
		create(args: {
			data: { nome: string; email: string; ruolo: "AMMINISTRATORE" };
		}): Promise<UtenteBootstrap>;
	};
}

export type EsitoBootstrapAmministratoreIniziale =
	| { esito: "gia-esistente"; utente: UtenteBootstrap }
	| { esito: "creato"; utente: UtenteBootstrap };

export async function eseguiBootstrapAmministratoreIniziale(
	client: ClientBootstrap,
	email: string,
): Promise<EsitoBootstrapAmministratoreIniziale> {
	const utenteEsistente = await client.utente.findUnique({
		where: { email },
	});

	if (utenteEsistente) {
		return { esito: "gia-esistente", utente: utenteEsistente };
	}

	const utenteCreato = await client.utente.create({
		data: {
			nome: NOME_PREDEFINITO_AMMINISTRATORE,
			email,
			ruolo: "AMMINISTRATORE",
		},
	});

	return { esito: "creato", utente: utenteCreato };
}

// ── Entry point da CLI ───────────────────────────────────────────

if (
	process.argv[1]?.endsWith("bootstrap-amministratore-iniziale.ts") ||
	process.argv[1]?.endsWith("bootstrap-amministratore-iniziale.js")
) {
	loadEnvConfig(process.cwd());

	// AC-3: la validazione della variabile avviene PRIMA di istanziare
	// qualunque client Prisma — nessuna connessione, nessuna scrittura
	// quando la variabile manca.
	const validazioneEmail = validaEmailAmministratoreIniziale(
		process.env.AMMINISTRATORE_INIZIALE_EMAIL,
	);

	if (!validazioneEmail.valida) {
		console.error(`❌ ERRORE: ${validazioneEmail.messaggio}`);
		process.exit(1);
	}

	if (!process.env.DATABASE_URL) {
		console.error(
			"❌ ERRORE: DATABASE_URL non è configurata. " +
				"Copia .env.example in .env.local e imposta la stringa di connessione PostgreSQL.",
		);
		process.exit(1);
	}

	void main(validazioneEmail.email);
}

async function main(email: string): Promise<void> {
	const prisma = new PrismaClient({
		adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
	});

	try {
		const risultato = await eseguiBootstrapAmministratoreIniziale(
			prisma,
			email,
		);

		if (risultato.esito === "creato") {
			console.log(
				`✅ Amministratore iniziale creato: email="${risultato.utente.email}", ruolo="${risultato.utente.ruolo}".`,
			);
		} else {
			console.log(
				`ℹ️  Utente con email "${risultato.utente.email}" già esistente: nessuna scrittura effettuata.`,
			);
		}
	} catch (err) {
		console.error(
			`❌ ERRORE: bootstrap amministratore iniziale fallito: ${(err as Error).message}`,
		);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}
