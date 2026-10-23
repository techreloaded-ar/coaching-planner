// Ricrea vuoto lo schema `public` del database DEDICATO alla migrazione con dati.
// Rifiuta di procedere senza ORACOLO_CONFERMA_AZZERAMENTO uguale al nome del database.
import pg from "pg";

const url = new URL(process.env.DATABASE_URL ?? "");
const nome = url.pathname.replace(/^\//, "");
if (!nome || process.env.ORACOLO_CONFERMA_AZZERAMENTO !== nome) {
	console.error(`azzeramento rifiutato: ORACOLO_CONFERMA_AZZERAMENTO deve valere "${nome}"`);
	process.exit(3);
}
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
await client.query("DROP SCHEMA IF EXISTS public CASCADE");
await client.query("CREATE SCHEMA public");
await client.end();
console.log(`schema public ricreato su ${nome}`);
