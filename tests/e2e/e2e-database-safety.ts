import pg from "pg";

const PUBLIC_SCHEMA = "public";
const PRISMA_MIGRATIONS_TABLE = "_prisma_migrations";
const DATABASE_DI_MANUTENZIONE = "postgres";
const PORTA_POSTGRES_PREDEFINITA = 5432;

/** Codice SQLSTATE `invalid_catalog_name`: il database indicato non esiste. */
const CODICE_DATABASE_INESISTENTE = "3D000";
/** Codice SQLSTATE `duplicate_database`: il database esiste già. */
const CODICE_DATABASE_GIA_ESISTENTE = "42P04";

const HOST_LOCALI_EQUIVALENTI = new Set([
	"localhost",
	"127.0.0.1",
	"::1",
	"[::1]",
]);

const CODICI_ERRORE_CONNESSIONE = new Set([
	"ECONNREFUSED",
	"ENOTFOUND",
	"EHOSTUNREACH",
	"ETIMEDOUT",
	"EAI_AGAIN",
]);

const COMANDO_AVVIO_DATABASE_LOCALE = "docker compose up -d";

export type IdentitaDatabase = {
	host: string;
	porta: number;
	nomeDatabase: string;
};

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

function formatQualifiedTableName(tableName: string): string {
	return `${quoteIdentifier(PUBLIC_SCHEMA)}.${quoteIdentifier(tableName)}`;
}

function codiceErrore(errore: unknown): string | undefined {
	if (typeof errore !== "object" || errore === null) {
		return undefined;
	}

	const codice = (errore as { code?: unknown }).code;

	return typeof codice === "string" ? codice : undefined;
}

/**
 * Normalizza una stringa di connessione PostgreSQL nell'identità del database a
 * cui punta: host (con gli alias locali ricondotti a `localhost`), porta
 * esplicita e nome del database. È la base del confronto fra database e2e e
 * database applicativo e non apre alcuna connessione.
 */
export function descriviIdentitaDatabase(
	stringaConnessione: string,
): IdentitaDatabase {
	let url: URL;

	try {
		url = new URL(stringaConnessione);
	} catch {
		// Il messaggio non riporta mai la stringa: può contenere la password.
		throw new Error(
			"Stringa di connessione PostgreSQL non valida: attesa una URL nella forma postgresql://utente:password@host:porta/database.",
		);
	}

	const hostGrezzo = url.hostname.toLowerCase();
	const nomeDatabase = decodeURIComponent(
		url.pathname.replace(/^\//, "").replace(/\/+$/, ""),
	);

	// Senza nome database esplicito `pg` ripiegherebbe su PGDATABASE o sul nome
	// utente: la guardia d'identità non potrebbe più decidere su quale database
	// finisce il reset distruttivo, quindi rifiutiamo la stringa fail-closed.
	if (!nomeDatabase) {
		throw new Error(
			"Stringa di connessione PostgreSQL non valida: manca il nome del database dopo l'host.",
		);
	}

	return {
		host: HOST_LOCALI_EQUIVALENTI.has(hostGrezzo) ? "localhost" : hostGrezzo,
		porta: url.port ? Number(url.port) : PORTA_POSTGRES_PREDEFINITA,
		nomeDatabase,
	};
}

function descriviIdentitaSePossibile(
	stringaConnessione: string,
): IdentitaDatabase | null {
	try {
		return descriviIdentitaDatabase(stringaConnessione);
	} catch {
		return null;
	}
}

function formattaIdentita(identita: IdentitaDatabase): string {
	return `${identita.host}:${identita.porta}/${identita.nomeDatabase}`;
}

/** Vero quando le due stringhe di connessione puntano allo stesso database. */
export function sonoLoStessoDatabase(prima: string, seconda: string): boolean {
	const identitaPrima = descriviIdentitaDatabase(prima);
	const identitaSeconda = descriviIdentitaDatabase(seconda);

	return (
		identitaPrima.host === identitaSeconda.host &&
		identitaPrima.porta === identitaSeconda.porta &&
		identitaPrima.nomeDatabase === identitaSeconda.nomeDatabase
	);
}

/**
 * Guardia d'identità: rifiuta l'esecuzione quando il database e2e coincide con
 * il database applicativo.
 *
 * È volutamente **sintattica** — non apre connessioni e non legge dati — così da
 * poter essere valutata prima di qualsiasi accesso al database, incluse le
 * operazioni distruttive della preparazione e2e. Il messaggio non contiene mai
 * la stringa di connessione completa, per non esporre la password.
 */
export function assertDatabaseE2eDistintoDaDatabaseApplicativo(
	urlDatabaseE2e: string,
	urlDatabaseApplicativo: string | undefined,
): void {
	const urlApplicativo = urlDatabaseApplicativo?.trim();

	if (!urlApplicativo) {
		return;
	}

	if (!sonoLoStessoDatabase(urlDatabaseE2e, urlApplicativo)) {
		return;
	}

	const identita = descriviIdentitaDatabase(urlDatabaseE2e);

	throw new Error(
		`Il database e2e configurato in E2E_DATABASE_URL coincide con il database di sviluppo indicato da DATABASE_URL (${formattaIdentita(identita)}). ` +
			"La suite e2e azzera lo schema del database e2e a ogni run: eseguirla su questo database distruggerebbe i dati applicativi. " +
			"Configura un database dedicato, per esempio `coaching_planner_e2e`, e rilancia la suite.",
	);
}

/**
 * Traduce un errore di connessione in un messaggio azionabile.
 *
 * Restituisce `null` per ogni errore che non sia di rete, così che gli errori
 * applicativi restino visibili così come sono, senza essere mascherati.
 */
export function messaggioDatabaseNonRaggiungibile(
	errore: unknown,
	stringaConnessione: string,
): string | null {
	const codice = codiceErrore(errore);

	if (!codice || !CODICI_ERRORE_CONNESSIONE.has(codice)) {
		return null;
	}

	const identita = descriviIdentitaSePossibile(stringaConnessione);
	const destinazione = identita
		? `${identita.host}:${identita.porta}`
		: "l'host configurato";

	return (
		`Il database locale non risponde su ${destinazione} (${codice}). ` +
		`Avvia l'istanza PostgreSQL con \`${COMANDO_AVVIO_DATABASE_LOCALE}\` e rilancia la suite e2e.`
	);
}

function traduciErroreDiConnessione(
	errore: unknown,
	stringaConnessione: string,
): unknown {
	const messaggio = messaggioDatabaseNonRaggiungibile(errore, stringaConnessione);

	return messaggio ? new Error(messaggio, { cause: errore }) : errore;
}

async function withDatabaseClient<T>(
	connectionString: string,
	callback: (client: pg.Client) => Promise<T>,
): Promise<T> {
	const client = new pg.Client({ connectionString });

	await client.connect();

	try {
		return await callback(client);
	} finally {
		await client.end();
	}
}

async function listApplicationTables(client: pg.Client): Promise<string[]> {
	const result = await client.query<{ table_name: string }>(
		`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
      AND table_name <> $2
    ORDER BY table_name ASC
  `,
		[PUBLIC_SCHEMA, PRISMA_MIGRATIONS_TABLE],
	);

	return result.rows.map(({ table_name }) => table_name);
}

export function requireE2eDatabaseUrl(): string {
	const e2eDatabaseUrl = process.env.E2E_DATABASE_URL?.trim();

	if (!e2eDatabaseUrl) {
		throw new Error(
			"E2E_DATABASE_URL is required for end-to-end database operations.",
		);
	}

	return e2eDatabaseUrl;
}

async function creaDatabaseE2e(
	stringaConnessione: string,
	nomeDatabase: string,
): Promise<void> {
	const urlManutenzione = new URL(stringaConnessione);
	urlManutenzione.pathname = `/${DATABASE_DI_MANUTENZIONE}`;

	await withDatabaseClient(urlManutenzione.toString(), async (client) => {
		try {
			await client.query(`CREATE DATABASE ${quoteIdentifier(nomeDatabase)}`);
		} catch (errore) {
			// Corsa fra processi: qualcun altro lo ha appena creato. Va bene così.
			if (codiceErrore(errore) !== CODICE_DATABASE_GIA_ESISTENTE) {
				throw errore;
			}
		}
	});
}

/**
 * Garantisce che il database e2e esista: se PostgreSQL risponde `3D000` lo crea
 * collegandosi al database di manutenzione della stessa istanza.
 *
 * Serve sui volumi Docker già inizializzati, dove gli script di
 * `docker/postgres/initdb/` non vengono più rieseguiti.
 */
export async function garantisciDatabaseE2eEsistente(
	stringaConnessione: string,
): Promise<void> {
	const identita = descriviIdentitaDatabase(stringaConnessione);
	const client = new pg.Client({ connectionString: stringaConnessione });

	try {
		await client.connect();
	} catch (errore) {
		if (codiceErrore(errore) === CODICE_DATABASE_INESISTENTE) {
			await creaDatabaseE2e(stringaConnessione, identita.nomeDatabase);
			return;
		}

		throw traduciErroreDiConnessione(errore, stringaConnessione);
	}

	await client.end();
}

/**
 * Riporta il database e2e a uno stato pulito ricreandone lo schema `public`.
 *
 * È **l'operazione distruttiva** della preparazione e2e: deve sempre essere
 * preceduta da `assertDatabaseE2eDistintoDaDatabaseApplicativo`, che è l'unica
 * garanzia che il database azzerato non sia quello applicativo. Ricreare lo
 * schema, invece di svuotare le tabelle, sana anche uno stato di migrazione
 * incompleto lasciato da un run interrotto.
 *
 * Vincolo d'ordine da non perdere: Playwright avvia i plugin — quindi il
 * `webServer` — prima dei `globalSetup`, perciò questo reset gira con il server
 * Next già in piedi. Con connessioni idle il DROP passa, ma una transazione
 * aperta sul database e2e lo metterebbe in attesa di lock.
 */
export async function ripristinaSchemaPulitoDatabaseE2e(
	stringaConnessione: string,
): Promise<void> {
	try {
		await withDatabaseClient(stringaConnessione, async (client) => {
			await client.query(`DROP SCHEMA IF EXISTS ${PUBLIC_SCHEMA} CASCADE`);
			await client.query(`CREATE SCHEMA ${PUBLIC_SCHEMA}`);
		});
	} catch (errore) {
		throw traduciErroreDiConnessione(errore, stringaConnessione);
	}
}

/**
 * Ambiente dei processi figli della preparazione e2e (migrazioni, seed, web
 * server).
 *
 * `DATABASE_URL` viene **sovrascritto**, non ereditato: i comandi Prisma leggono
 * quella variabile e devono agire sul database e2e, mai su quello di sviluppo
 * che l'ambiente del processo padre può avere valorizzato.
 */
export function costruisciAmbienteE2e(
	ambiente: NodeJS.ProcessEnv,
	urlDatabaseE2e: string,
): NodeJS.ProcessEnv {
	return {
		...ambiente,
		DATABASE_URL: urlDatabaseE2e,
		E2E_DATABASE_URL: urlDatabaseE2e,
		E2E_TEST_MODE: "true",
	};
}

export async function clearE2eApplicationData(
	connectionString: string,
): Promise<void> {
	await withDatabaseClient(connectionString, async (client) => {
		const applicationTables = await listApplicationTables(client);

		if (applicationTables.length === 0) {
			return;
		}

		const qualifiedTableNames = applicationTables
			.map((tableName) => formatQualifiedTableName(tableName))
			.join(", ");

		await client.query(
			`TRUNCATE TABLE ${qualifiedTableNames} RESTART IDENTITY CASCADE`,
		);
	});
}
