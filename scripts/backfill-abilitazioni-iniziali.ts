/**
 * Backfill una tantum delle abilitazioni offerta iniziali (US-042)
 *
 * Uso:
 *   npm run db:backfill-abilitazioni
 *   npx tsx scripts/backfill-abilitazioni-iniziali.ts
 *
 * Requisiti:
 *   - Variabile d'ambiente DATABASE_URL configurata (connessione PostgreSQL)
 *
 * Obiettivo:
 *   Al primo rilascio ogni collaboratore deve risultare abilitato sulle
 *   offerte attive su cui ha almeno una riga di attività. Il pre-popolamento
 *   è una tantum: se esiste già almeno una AbilitazioneOfferta lo script non
 *   scrive nulla, così da non ricreare abilitazioni revocate ai run
 *   successivi.
 */

import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// ── Backfill (esportato per testabilità) ─────────────────────────

interface CoppiaAbilitazione {
	collaboratoreId: string;
	offertaId: string;
}

/**
 * Interfaccia minima del client richiesto dal backfill: solo i metodi
 * `abilitazioneOfferta.count`, `abilitazioneOfferta.createMany` e
 * `rigaAttivita.findMany`, con tipi strutturali minimi e nessuna dipendenza
 * dal client Prisma generato nella firma.
 */
export interface ClientBackfillAbilitazioni {
	abilitazioneOfferta: {
		count(): Promise<number>;
		createMany(args: {
			data: CoppiaAbilitazione[];
		}): Promise<{ count: number }>;
	};
	rigaAttivita: {
		findMany(args: {
			where: { offerta: { attiva: true } };
			select: { collaboratoreId: true; offertaId: true };
			distinct: ["collaboratoreId", "offertaId"];
		}): Promise<CoppiaAbilitazione[]>;
	};
}

export type EsitoBackfillAbilitazioniIniziali =
	| { esito: "gia-popolato"; inserite: 0 }
	| { esito: "nessuna-attivita"; inserite: 0 }
	| { esito: "popolato"; inserite: number };

export async function eseguiBackfillAbilitazioniIniziali(
	client: ClientBackfillAbilitazioni,
): Promise<EsitoBackfillAbilitazioniIniziali> {
	const abilitazioniEsistenti = await client.abilitazioneOfferta.count();

	if (abilitazioniEsistenti > 0) {
		return { esito: "gia-popolato", inserite: 0 };
	}

	const coppie = await client.rigaAttivita.findMany({
		where: { offerta: { attiva: true } },
		select: { collaboratoreId: true, offertaId: true },
		distinct: ["collaboratoreId", "offertaId"],
	});

	if (coppie.length === 0) {
		return { esito: "nessuna-attivita", inserite: 0 };
	}

	const risultato = await client.abilitazioneOfferta.createMany({
		data: coppie.map((coppia) => ({
			collaboratoreId: coppia.collaboratoreId,
			offertaId: coppia.offertaId,
		})),
	});

	return { esito: "popolato", inserite: risultato.count };
}

// ── Entry point da CLI ───────────────────────────────────────────

if (
	process.argv[1]?.endsWith("backfill-abilitazioni-iniziali.ts") ||
	process.argv[1]?.endsWith("backfill-abilitazioni-iniziali.js")
) {
	loadEnvConfig(process.cwd());

	if (!process.env.DATABASE_URL) {
		console.error(
			"❌ ERRORE: DATABASE_URL non è configurata. " +
				"Copia .env.example in .env.local e imposta la stringa di connessione PostgreSQL.",
		);
		process.exit(1);
	}

	void main();
}

async function main(): Promise<void> {
	const prisma = new PrismaClient({
		adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
	});

	try {
		const risultato = await eseguiBackfillAbilitazioniIniziali(prisma);

		if (risultato.esito === "popolato") {
			console.log(
				`✅ Backfill abilitazioni completato: ${risultato.inserite} abilitazioni iniziali inserite.`,
			);
		} else if (risultato.esito === "gia-popolato") {
			console.log(
				"ℹ️  Abilitazioni già presenti: backfill una tantum saltato, nessuna scrittura effettuata.",
			);
		} else {
			console.log(
				"ℹ️  Nessuna riga di attività su offerte attive: nessuna abilitazione da inserire.",
			);
		}
	} catch (err) {
		console.error(
			`❌ ERRORE: backfill abilitazioni iniziali fallito: ${(err as Error).message}`,
		);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}
