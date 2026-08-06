/**
 * Test del seam di sicurezza della preparazione del database e2e (US-059 - TASK-03).
 *
 * Verifica, senza aprire alcuna connessione a un database reale:
 * - la normalizzazione dell'identità di un database a partire dalla stringa di connessione
 * - la guardia che rifiuta un database e2e coincidente con il database applicativo (AC-4)
 * - la traduzione degli errori di rete in un messaggio azionabile (AC-5)
 * - la creazione del database e2e quando non esiste (AC-1)
 * - la sequenza SQL emessa dal ripristino dello schema pulito (AC-2)
 * - l'ambiente dei processi figli, che deve puntare sempre al database e2e (AC-3)
 *
 * Il modulo `pg` è sostituito da un client finto: nessun test contatta PostgreSQL.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	descriviIdentitaDatabase,
	sonoLoStessoDatabase,
	assertDatabaseE2eDistintoDaDatabaseApplicativo,
	messaggioDatabaseNonRaggiungibile,
	garantisciDatabaseE2eEsistente,
	ripristinaSchemaPulitoDatabaseE2e,
	costruisciAmbienteE2e,
} from "../e2e/e2e-database-safety";

// ── Client PostgreSQL finto ──────────────────────────────────────
//
// Registra query e ciclo di vita del client senza aprire connessioni.

const registroPostgres = vi.hoisted(() => ({
	stringheDiConnessioneUsate: [] as string[],
	queryEseguite: [] as string[],
	eventiCicloDiVita: [] as string[],
	erroreSullaConnessione: null as unknown,
	// Errori consumati uno per chiamata a `connect`, per gli scenari che aprono
	// più connessioni in sequenza (database inesistente → database di manutenzione).
	erroriSullaConnessionePerChiamata: [] as unknown[],
	erroreSullaQuery: null as { schema: RegExp; errore: unknown } | null,
}));

vi.mock("pg", () => {
	class ClientFinto {
		constructor(configurazione: { connectionString: string }) {
			registroPostgres.stringheDiConnessioneUsate.push(
				configurazione.connectionString,
			);
		}

		async connect(): Promise<void> {
			registroPostgres.eventiCicloDiVita.push("connect");

			if (registroPostgres.erroriSullaConnessionePerChiamata.length > 0) {
				const errore =
					registroPostgres.erroriSullaConnessionePerChiamata.shift();

				if (errore) {
					throw errore;
				}

				return;
			}

			if (registroPostgres.erroreSullaConnessione) {
				throw registroPostgres.erroreSullaConnessione;
			}
		}

		async query(testoQuery: string): Promise<{ rows: unknown[] }> {
			registroPostgres.queryEseguite.push(testoQuery);

			const erroreConfigurato = registroPostgres.erroreSullaQuery;

			if (erroreConfigurato?.schema.test(testoQuery)) {
				throw erroreConfigurato.errore;
			}

			return { rows: [] };
		}

		async end(): Promise<void> {
			registroPostgres.eventiCicloDiVita.push("end");
		}
	}

	return { default: { Client: ClientFinto }, Client: ClientFinto };
});

beforeEach(() => {
	registroPostgres.stringheDiConnessioneUsate.length = 0;
	registroPostgres.queryEseguite.length = 0;
	registroPostgres.eventiCicloDiVita.length = 0;
	registroPostgres.erroreSullaConnessione = null;
	registroPostgres.erroriSullaConnessionePerChiamata.length = 0;
	registroPostgres.erroreSullaQuery = null;
});

const URL_DATABASE_APPLICATIVO =
	"postgresql://coaching:sup3r-s3gr3ta@localhost:5432/coaching_planner";
const URL_DATABASE_E2E =
	"postgresql://coaching:sup3r-s3gr3ta@localhost:5432/coaching_planner_e2e";

// ── descriviIdentitaDatabase ─────────────────────────────────────

describe("descriviIdentitaDatabase", () => {
	it("dovrebbe normalizzare l'host in minuscolo", () => {
		const identita = descriviIdentitaDatabase(
			"postgresql://utente:segreta@DB.Example.COM:5432/coaching_planner",
		);

		expect(identita.host).toBe("db.example.com");
	});

	it("dovrebbe ricondurre gli alias locali a un unico host", () => {
		expect(
			descriviIdentitaDatabase("postgresql://u:p@127.0.0.1:5432/db").host,
		).toBe("localhost");
		expect(
			descriviIdentitaDatabase("postgresql://u:p@localhost:5432/db").host,
		).toBe("localhost");
	});

	it("dovrebbe risolvere la porta implicita a 5432", () => {
		expect(
			descriviIdentitaDatabase("postgresql://u:p@db.example.com/coaching_planner")
				.porta,
		).toBe(5432);
	});

	it("dovrebbe conservare la porta esplicita quando è diversa da quella predefinita", () => {
		expect(
			descriviIdentitaDatabase("postgresql://u:p@db.example.com:6543/db").porta,
		).toBe(6543);
	});

	it("dovrebbe estrarre il nome del database dal path", () => {
		expect(
			descriviIdentitaDatabase(URL_DATABASE_E2E).nomeDatabase,
		).toBe("coaching_planner_e2e");
	});

	it("dovrebbe ignorare la query string nel nome del database", () => {
		expect(
			descriviIdentitaDatabase(
				"postgresql://u:p@localhost:5432/coaching_planner?sslmode=require",
			).nomeDatabase,
		).toBe("coaching_planner");
	});

	it("dovrebbe lanciare un errore esplicito per una stringa non interpretabile", () => {
		expect(() => descriviIdentitaDatabase("questa-non-e-una-url")).toThrow(
			/Stringa di connessione PostgreSQL non valida/,
		);
	});

	it("non dovrebbe riportare la password nell'errore di stringa non interpretabile", () => {
		let messaggio = "";

		try {
			descriviIdentitaDatabase(
				"host=localhost port=5432 dbname=coaching_planner user=u password=sup3r-s3gr3ta",
			);
		} catch (errore) {
			messaggio = (errore as Error).message;
		}

		expect(messaggio).toMatch(/Stringa di connessione PostgreSQL non valida/);
		expect(messaggio).not.toContain("sup3r-s3gr3ta");
	});

	it("dovrebbe rifiutare una stringa senza nome del database", () => {
		// Senza path `pg` ripiegherebbe su PGDATABASE o sul nome utente: la
		// guardia d'identità non potrebbe più decidere e il reset distruttivo
		// finirebbe su un database non identificato.
		expect(() =>
			descriviIdentitaDatabase("postgresql://u:p@localhost:5432"),
		).toThrow(/manca il nome del database/);
		expect(() =>
			descriviIdentitaDatabase("postgresql://u:p@localhost:5432/"),
		).toThrow(/manca il nome del database/);
	});

	it("dovrebbe normalizzare lo slash finale nel nome del database", () => {
		expect(
			descriviIdentitaDatabase(
				"postgresql://u:p@localhost:5432/coaching_planner/",
			).nomeDatabase,
		).toBe("coaching_planner");
	});

	it("non dovrebbe aprire alcuna connessione per descrivere l'identità", () => {
		descriviIdentitaDatabase(URL_DATABASE_E2E);

		expect(registroPostgres.stringheDiConnessioneUsate).toEqual([]);
		expect(registroPostgres.eventiCicloDiVita).toEqual([]);
	});
});

// ── sonoLoStessoDatabase ─────────────────────────────────────────

describe("sonoLoStessoDatabase", () => {
	it("dovrebbe riconoscere come identici due URL che differiscono solo per credenziali", () => {
		expect(
			sonoLoStessoDatabase(
				"postgresql://utente:una@localhost:5432/coaching_planner",
				"postgresql://altro:altra@localhost:5432/coaching_planner",
			),
		).toBe(true);
	});

	it("dovrebbe distinguere due database diversi sulla stessa istanza", () => {
		expect(
			sonoLoStessoDatabase(URL_DATABASE_E2E, URL_DATABASE_APPLICATIVO),
		).toBe(false);
	});
});

// ── assertDatabaseE2eDistintoDaDatabaseApplicativo (AC-4) ────────

describe("assertDatabaseE2eDistintoDaDatabaseApplicativo", () => {
	it("dovrebbe rifiutare due URL identici", () => {
		expect(() =>
			assertDatabaseE2eDistintoDaDatabaseApplicativo(
				URL_DATABASE_APPLICATIVO,
				URL_DATABASE_APPLICATIVO,
			),
		).toThrow(/coincide con il database di sviluppo/);
	});

	it("dovrebbe nominare il database coinvolto senza esporre la password", () => {
		let messaggio = "";

		try {
			assertDatabaseE2eDistintoDaDatabaseApplicativo(
				URL_DATABASE_APPLICATIVO,
				URL_DATABASE_APPLICATIVO,
			);
		} catch (errore) {
			messaggio = (errore as Error).message;
		}

		expect(messaggio).toContain("coaching_planner");
		expect(messaggio).not.toContain("sup3r-s3gr3ta");
	});

	it("dovrebbe rifiutare host equivalenti con porta implicita (localhost vs 127.0.0.1)", () => {
		expect(() =>
			assertDatabaseE2eDistintoDaDatabaseApplicativo(
				"postgresql://user:password@localhost:5432/coaching_planner",
				"postgresql://user:password@127.0.0.1/coaching_planner",
			),
		).toThrow(/coincide con il database di sviluppo/);
	});

	it("dovrebbe accettare un database e2e dedicato sulla stessa istanza", () => {
		expect(() =>
			assertDatabaseE2eDistintoDaDatabaseApplicativo(
				URL_DATABASE_E2E,
				URL_DATABASE_APPLICATIVO,
			),
		).not.toThrow();
	});

	it("dovrebbe accettare un database applicativo non configurato", () => {
		expect(() =>
			assertDatabaseE2eDistintoDaDatabaseApplicativo(URL_DATABASE_E2E, undefined),
		).not.toThrow();
		expect(() =>
			assertDatabaseE2eDistintoDaDatabaseApplicativo(URL_DATABASE_E2E, ""),
		).not.toThrow();
		expect(() =>
			assertDatabaseE2eDistintoDaDatabaseApplicativo(URL_DATABASE_E2E, "   "),
		).not.toThrow();
	});

	it("dovrebbe rifiutare anche quando le due stringhe differiscono solo per lo slash finale", () => {
		expect(() =>
			assertDatabaseE2eDistintoDaDatabaseApplicativo(
				"postgresql://user:password@localhost:5432/coaching_planner/",
				URL_DATABASE_APPLICATIVO,
			),
		).toThrow(/coincide con il database di sviluppo/);
	});

	it("dovrebbe decidere senza contattare il database", () => {
		expect(() =>
			assertDatabaseE2eDistintoDaDatabaseApplicativo(
				URL_DATABASE_APPLICATIVO,
				URL_DATABASE_APPLICATIVO,
			),
		).toThrow();

		expect(registroPostgres.stringheDiConnessioneUsate).toEqual([]);
		expect(registroPostgres.eventiCicloDiVita).toEqual([]);
	});
});

// ── messaggioDatabaseNonRaggiungibile (AC-5) ─────────────────────

describe("messaggioDatabaseNonRaggiungibile", () => {
	const codiciDiRete = [
		"ECONNREFUSED",
		"ENOTFOUND",
		"ETIMEDOUT",
		"EAI_AGAIN",
	] as const;

	for (const codice of codiciDiRete) {
		it(`dovrebbe suggerire l'avvio del database locale per ${codice}`, () => {
			const errore = Object.assign(new Error("boom"), { code: codice });

			const messaggio = messaggioDatabaseNonRaggiungibile(
				errore,
				URL_DATABASE_E2E,
			);

			expect(messaggio).not.toBeNull();
			expect(messaggio).toContain("docker compose up -d");
			expect(messaggio).toContain("localhost");
			expect(messaggio).toContain("5432");
			expect(messaggio).toContain(codice);
		});
	}

	it("dovrebbe restituire null per un errore applicativo senza codice di rete", () => {
		expect(
			messaggioDatabaseNonRaggiungibile(
				new Error("errore applicativo"),
				URL_DATABASE_E2E,
			),
		).toBeNull();
	});

	it("dovrebbe restituire null per un errore con codice non di rete", () => {
		const errore = Object.assign(new Error("permesso negato"), {
			code: "42501",
		});

		expect(messaggioDatabaseNonRaggiungibile(errore, URL_DATABASE_E2E)).toBeNull();
	});

	it("dovrebbe restare azionabile anche con una stringa di connessione illeggibile", () => {
		const errore = Object.assign(new Error("boom"), { code: "ECONNREFUSED" });

		const messaggio = messaggioDatabaseNonRaggiungibile(errore, "non-una-url");

		expect(messaggio).toContain("docker compose up -d");
	});
});

// ── ripristinaSchemaPulitoDatabaseE2e (AC-2) ─────────────────────

describe("ripristinaSchemaPulitoDatabaseE2e", () => {
	it("dovrebbe ricreare lo schema public azzerandolo prima", async () => {
		await ripristinaSchemaPulitoDatabaseE2e(URL_DATABASE_E2E);

		expect(registroPostgres.queryEseguite).toHaveLength(2);
		expect(registroPostgres.queryEseguite[0]).toMatch(
			/DROP SCHEMA IF EXISTS public CASCADE/,
		);
		expect(registroPostgres.queryEseguite[1]).toMatch(/CREATE SCHEMA public/);
	});

	it("dovrebbe operare sul database e2e indicato", async () => {
		await ripristinaSchemaPulitoDatabaseE2e(URL_DATABASE_E2E);

		expect(registroPostgres.stringheDiConnessioneUsate).toEqual([
			URL_DATABASE_E2E,
		]);
	});

	it("dovrebbe aprire e chiudere il client una sola volta", async () => {
		await ripristinaSchemaPulitoDatabaseE2e(URL_DATABASE_E2E);

		expect(registroPostgres.eventiCicloDiVita).toEqual(["connect", "end"]);
	});

	it("dovrebbe chiudere il client anche quando una query fallisce", async () => {
		registroPostgres.erroreSullaQuery = {
			schema: /DROP SCHEMA/,
			errore: new Error("permesso negato"),
		};

		await expect(
			ripristinaSchemaPulitoDatabaseE2e(URL_DATABASE_E2E),
		).rejects.toThrow("permesso negato");

		expect(registroPostgres.eventiCicloDiVita).toEqual(["connect", "end"]);
		expect(registroPostgres.queryEseguite).toEqual([
			expect.stringMatching(/DROP SCHEMA IF EXISTS public CASCADE/),
		]);
	});

	it("dovrebbe tradurre un errore di rete in un messaggio azionabile", async () => {
		registroPostgres.erroreSullaConnessione = Object.assign(new Error("boom"), {
			code: "ECONNREFUSED",
		});

		await expect(
			ripristinaSchemaPulitoDatabaseE2e(URL_DATABASE_E2E),
		).rejects.toThrow(/docker compose up -d/);
	});
});

// ── garantisciDatabaseE2eEsistente (AC-1) ────────────────────────

describe("garantisciDatabaseE2eEsistente", () => {
	it("non dovrebbe creare nulla quando il database e2e risponde", async () => {
		await garantisciDatabaseE2eEsistente(URL_DATABASE_E2E);

		expect(registroPostgres.queryEseguite).toEqual([]);
		expect(registroPostgres.eventiCicloDiVita).toEqual(["connect", "end"]);
	});

	it("dovrebbe creare il database dal database di manutenzione quando non esiste", async () => {
		registroPostgres.erroriSullaConnessionePerChiamata = [
			Object.assign(new Error("database non trovato"), { code: "3D000" }),
			null,
		];

		await garantisciDatabaseE2eEsistente(URL_DATABASE_E2E);

		expect(registroPostgres.stringheDiConnessioneUsate[1]).toContain(
			"/postgres",
		);
		expect(registroPostgres.queryEseguite).toEqual([
			'CREATE DATABASE "coaching_planner_e2e"',
		]);
	});

	it("dovrebbe tollerare la creazione concorrente dello stesso database", async () => {
		registroPostgres.erroriSullaConnessionePerChiamata = [
			Object.assign(new Error("database non trovato"), { code: "3D000" }),
			null,
		];
		registroPostgres.erroreSullaQuery = {
			schema: /CREATE DATABASE/,
			errore: Object.assign(new Error("già esistente"), { code: "42P04" }),
		};

		await expect(
			garantisciDatabaseE2eEsistente(URL_DATABASE_E2E),
		).resolves.toBeUndefined();
	});

	it("dovrebbe rilanciare un errore di creazione diverso dalla corsa fra processi", async () => {
		registroPostgres.erroriSullaConnessionePerChiamata = [
			Object.assign(new Error("database non trovato"), { code: "3D000" }),
			null,
		];
		registroPostgres.erroreSullaQuery = {
			schema: /CREATE DATABASE/,
			errore: Object.assign(new Error("permesso negato"), { code: "42501" }),
		};

		await expect(
			garantisciDatabaseE2eEsistente(URL_DATABASE_E2E),
		).rejects.toThrow("permesso negato");
	});

	it("dovrebbe tradurre l'istanza irraggiungibile in un messaggio azionabile", async () => {
		registroPostgres.erroreSullaConnessione = Object.assign(new Error("boom"), {
			code: "ECONNREFUSED",
		});

		await expect(
			garantisciDatabaseE2eEsistente(URL_DATABASE_E2E),
		).rejects.toThrow(/docker compose up -d/);
	});
});

// ── costruisciAmbienteE2e (AC-3) ─────────────────────────────────

describe("costruisciAmbienteE2e", () => {
	const ambienteDiPartenza: NodeJS.ProcessEnv = {
		NODE_ENV: "test",
		DATABASE_URL: URL_DATABASE_APPLICATIVO,
		PATH: "/bin",
	};

	it("dovrebbe sostituire il DATABASE_URL di sviluppo con quello e2e", () => {
		const ambiente = costruisciAmbienteE2e(ambienteDiPartenza, URL_DATABASE_E2E);

		expect(ambiente.DATABASE_URL).toBe(URL_DATABASE_E2E);
		expect(ambiente.DATABASE_URL).not.toBe(URL_DATABASE_APPLICATIVO);
	});

	it("dovrebbe esporre lo stesso URL anche come E2E_DATABASE_URL", () => {
		const ambiente = costruisciAmbienteE2e(ambienteDiPartenza, URL_DATABASE_E2E);

		expect(ambiente.E2E_DATABASE_URL).toBe(URL_DATABASE_E2E);
	});

	it("dovrebbe marcare l'ambiente come modalità di test e2e", () => {
		const ambiente = costruisciAmbienteE2e(ambienteDiPartenza, URL_DATABASE_E2E);

		expect(ambiente.E2E_TEST_MODE).toBe("true");
	});

	it("dovrebbe conservare le altre variabili dell'ambiente originale", () => {
		const ambiente = costruisciAmbienteE2e(
			{ ...ambienteDiPartenza, NEXTAUTH_SECRET: "segreto" },
			URL_DATABASE_E2E,
		);

		expect(ambiente.PATH).toBe("/bin");
		expect(ambiente.NEXTAUTH_SECRET).toBe("segreto");
	});

	it("non dovrebbe mutare l'ambiente ricevuto", () => {
		const ambienteOriginale: NodeJS.ProcessEnv = {
			NODE_ENV: "test",
			DATABASE_URL: URL_DATABASE_APPLICATIVO,
		};

		costruisciAmbienteE2e(ambienteOriginale, URL_DATABASE_E2E);

		expect(ambienteOriginale.DATABASE_URL).toBe(URL_DATABASE_APPLICATIVO);
		expect(ambienteOriginale.E2E_TEST_MODE).toBeUndefined();
	});
});
