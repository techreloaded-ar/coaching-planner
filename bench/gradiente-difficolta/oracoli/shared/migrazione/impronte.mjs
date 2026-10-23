// Impronte delle tabelle per il gate di migrazione (additività e dati preesistenti).
//   node impronte.mjs                     → tutte le tabelle di `public` con tutte le colonne
//   node impronte.mjs --come <prima.json> → stesse tabelle e colonne del file dato (colonne mancanti segnalate)
// Env: DATABASE_URL. Stampa JSON: { tabelle: { nome: { colonne: [..], righe: n, impronta: md5 | null, mancanti: [..] } } }
import { readFileSync } from "node:fs";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const virgolette = (nome) => `"${nome.replace(/"/g, '""')}"`;

const { rows: colonne } = await client.query(
	`SELECT table_name, column_name FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name <> '_prisma_migrations' ORDER BY table_name, ordinal_position`,
);
const attuali = {};
for (const { table_name: tabella, column_name: colonna } of colonne) (attuali[tabella] ??= []).push(colonna);

const indice = process.argv.indexOf("--come");
const riferimento = indice > 0 ? JSON.parse(readFileSync(process.argv[indice + 1], "utf8")).tabelle : null;
const richieste = riferimento
	? Object.fromEntries(Object.entries(riferimento).map(([t, v]) => [t, v.colonne]))
	: attuali;

const tabelle = {};
for (const [tabella, elenco] of Object.entries(richieste)) {
	const presenti = elenco.filter((c) => attuali[tabella]?.includes(c));
	const mancanti = elenco.filter((c) => !attuali[tabella]?.includes(c));
	if (!attuali[tabella] || presenti.length === 0) {
		tabelle[tabella] = { colonne: elenco, righe: null, impronta: null, mancanti };
		continue;
	}
	const riga = `row(${presenti.map(virgolette).join(", ")})::text`;
	const { rows } = await client.query(
		`SELECT count(*)::int AS righe, md5(coalesce(string_agg(${riga}, '|' ORDER BY ${riga}), '')) AS impronta FROM ${virgolette(tabella)}`,
	);
	tabelle[tabella] = { colonne: elenco, righe: rows[0].righe, impronta: rows[0].impronta, mancanti };
}
await client.end();
process.stdout.write(JSON.stringify({ tabelle }, null, 1));
