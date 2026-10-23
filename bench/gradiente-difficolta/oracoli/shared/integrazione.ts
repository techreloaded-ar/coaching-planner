/**
 * Helper comuni del livello integrazione (Vitest, stesso processo dell'app, Postgres reale).
 * Nessuna assert qui: solo sessione, esecuzione tollerante e lettura dello stato.
 */
import { creaTokenSessione } from "@/lib/session-token";
import { e2ePrisma } from "../../tests/e2e/support/prisma";
import type { CollaboratoreTestData, E2eDataFactory } from "../../tests/e2e/support/factory";
import { NonImplementato, type UtenteSessione } from "./contratto-comune";

type StatoSessioneOracolo = {
	storage: import("node:async_hooks").AsyncLocalStorage<string | null>;
	predefinito: string | null;
};

function statoSessione(): StatoSessioneOracolo {
	const stato = (globalThis as unknown as { __oracoloSessione?: StatoSessioneOracolo }).__oracoloSessione;
	if (!stato) throw new Error("setup-integrazione.ts non caricato: controlla setupFiles nel vitest.config.ts");
	return stato;
}

export function utenteDi(dati: CollaboratoreTestData | { utente: CollaboratoreTestData["utente"] }): UtenteSessione {
	const { utente } = dati;
	return { id: utente.id, ruolo: utente.ruolo, nome: `${utente.nome} ${utente.cognome}`, email: utente.email };
}

async function tokenDi(utente: UtenteSessione | null): Promise<string | null> {
	if (!utente) return null;
	const { token } = await creaTokenSessione({
		utenteId: utente.id,
		ruolo: utente.ruolo,
		nome: utente.nome,
		email: utente.email,
	} as Parameters<typeof creaTokenSessione>[0]);
	return token;
}

/** Imposta la sessione per le operazioni sequenziali successive (null = anonimo). */
export async function come(utente: UtenteSessione | null): Promise<void> {
	statoSessione().predefinito = await tokenDi(utente);
}

/** Esegue `operazione` con la sessione di `utente`, isolata dalle operazioni contemporanee. */
export async function conSessione<T>(utente: UtenteSessione | null, operazione: () => Promise<T>): Promise<T> {
	const token = await tokenDi(utente);
	return statoSessione().storage.run(token, operazione);
}

/**
 * Esegue un'operazione di prodotto ignorando l'esito lanciato (redirect, errore di ruolo,
 * validazione): l'oracolo verifica lo stato. `NonImplementato` NON viene mai assorbito,
 * così una capacità mancante fa fallire il controllo invece di sembrare un rifiuto.
 */
export async function tenta<T>(operazione: () => Promise<T>): Promise<T | Error> {
	try {
		return await operazione();
	} catch (errore) {
		if (errore instanceof NonImplementato || (errore as Error)?.name === "NonImplementato") throw errore;
		return errore instanceof Error ? errore : new Error(String(errore));
	}
}

/** Redirect di successo di Next (simulato da setup-integrazione). */
export function eRedirect(esito: unknown): boolean {
	return esito instanceof Error && esito.message.startsWith("NEXT_REDIRECT:");
}

/** Utente autenticato privo di ruolo amministrativo e di profilo Collaboratore (il «cliente»). */
export async function creaUtenteCliente(factory: E2eDataFactory, ruolo = "COLLABORATORE"): Promise<UtenteSessione> {
	const utente = await factory.createUtente({ nome: "Referente", ruolo: ruolo as "COLLABORATORE" });
	return { id: utente.id, ruolo: utente.ruolo, nome: `${utente.nome} ${utente.cognome}`, email: utente.email };
}

export { dataUtc, giornoDi, giornoDopo, meseDopo, tokenDa, ultimaDomenica } from "./date-oracolo";

// ── stato del database ─────────────────────────────────────────────────────

/** Righe attività di un collaboratore serializzate colonna per colonna (confronto byte per byte). */
export async function fotoRigheCollaboratore(collaboratoreId: string): Promise<string> {
	const { rows } = await e2ePrisma.query(
		`SELECT row_to_json(r)::text AS riga FROM "RigaAttivita" r WHERE r."collaboratoreId" = $1 ORDER BY r."id"`,
		[collaboratoreId],
	);
	return rows.map((r) => r.riga as string).join("\n");
}

/** Impronta di tutte le tabelle applicative e dello schema `public` (per i controlli «nessuna scrittura»). */
export async function improntaDatabase(): Promise<{ schema: string; tabelle: Record<string, string> }> {
	const { rows: colonne } = await e2ePrisma.query(
		`SELECT table_name, column_name, data_type, is_nullable, coalesce(column_default, '') AS predefinito
		 FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
	);
	const { rows: indici } = await e2ePrisma.query(
		`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`,
	);
	const { rows: tabelle } = await e2ePrisma.query(
		`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
	);
	const impronte: Record<string, string> = {};
	for (const { table_name: nome } of tabelle as Array<{ table_name: string }>) {
		const { rows } = await e2ePrisma.query(
			`SELECT count(*)::text || ':' || coalesce(md5(string_agg(t::text, '|' ORDER BY t::text)), '') AS impronta FROM "${nome.replace(/"/g, '""')}" t`,
		);
		impronte[nome] = rows[0].impronta as string;
	}
	return { schema: JSON.stringify([colonne, indici]), tabelle: impronte };
}
