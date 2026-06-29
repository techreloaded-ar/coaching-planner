/**
 * Test per lo script diagnostico SiteGround (US-004 - TASK-03)
 *
 * Verifica:
 * - Fallimento con messaggio chiaro quando manca la connection string (CLI o DATABASE_URL)
 * - Fallimento con messaggio chiaro quando la stringa è malformata
 * - Nessuna stampa di segreti nell'output (funzione redactConnectionString)
 * - Rilevamento corretto del flag TLS
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	redactConnectionString,
	extractHost,
	extractDatabase,
	validateConnectionString,
	hasTlsFlag,
	runDiagnostics,
} from "@/../scripts/siteground-connectivity-check";

// ── Mock di process.exit per intercettare l'uscita ────────────────

function mockProcessExit(): ReturnType<typeof vi.spyOn> {
	return vi
		.spyOn(process, "exit")
		.mockImplementation((code?: string | number | null | undefined) => {
			throw new Error(`process.exit(${code})`);
		}) as unknown as ReturnType<typeof vi.spyOn>;
}

// ── redactConnectionString ───────────────────────────────────────

describe("redactConnectionString", () => {
	it("dovrebbe oscurare la password in una stringa di connessione valida", () => {
		const result = redactConnectionString(
			"postgresql://utente:password123@host.siteground.com:5432/miodb?sslmode=require",
		);
		expect(result).toContain("utente");
		expect(result).not.toContain("password123");
		expect(result).toContain("***");
		expect(result).toContain("host.siteground.com");
		expect(result).toContain("miodb");
	});

	it("dovrebbe oscurare anche password con caratteri speciali", () => {
		const result = redactConnectionString(
			"postgresql://admin:P@ss!w0rd%23@db.example.com:5432/db",
		);
		expect(result).not.toContain("P@ss!w0rd%23");
		expect(result).toContain("***");
	});

	it("dovrebbe funzionare anche senza password nell'URL", () => {
		const result = redactConnectionString(
			"postgresql://utente@host.siteground.com:5432/db",
		);
		expect(result).toContain("utente");
		expect(result).not.toContain("***");
	});

	it("dovrebbe restituire un placeholder per URL malformati", () => {
		const result = redactConnectionString("questa-non-è-una-url");
		expect(result).toContain("malformata");
		expect(result).toContain("oscurata");
	});

	it("non dovrebbe mai stampare la password in chiaro", () => {
		const samples = [
			"postgresql://u:secret@h:5432/db",
			"postgresql://user:my-super-secret-password@host.com:5432/db?sslmode=require",
			"postgresql://admin:12345@localhost:5432/test",
		];
		for (const sample of samples) {
			const password = new URL(sample).password;
			const result = redactConnectionString(sample);
			expect(result).not.toContain(password);
		}
	});
});

// ── extractHost ──────────────────────────────────────────────────

describe("extractHost", () => {
	it("dovrebbe estrarre l'hostname da una stringa di connessione valida", () => {
		expect(extractHost("postgresql://u:p@db.siteground.com:5432/db")).toBe(
			"db.siteground.com",
		);
	});

	it("dovrebbe restituire il placeholder per URL malformati", () => {
		expect(extractHost("non-valida")).toBe("[host sconosciuto]");
	});
});

// ── extractDatabase ──────────────────────────────────────────────

describe("extractDatabase", () => {
	it("dovrebbe estrarre il nome database", () => {
		expect(extractDatabase("postgresql://u:p@h:5432/mio_db_produzione")).toBe(
			"mio_db_produzione",
		);
	});

	it("dovrebbe gestire database con query string", () => {
		expect(extractDatabase("postgresql://u:p@h:5432/db?sslmode=require")).toBe(
			"db",
		);
	});

	it("dovrebbe restituire il placeholder per URL malformati", () => {
		expect(extractDatabase("non-valida")).toBe("[database sconosciuto]");
	});

	it("dovrebbe restituire il placeholder per database mancante", () => {
		expect(extractDatabase("postgresql://u:p@h:5432")).toBe(
			"[database sconosciuto]",
		);
	});
});

// ── validateConnectionString ─────────────────────────────────────

describe("validateConnectionString", () => {
	it("dovrebbe fallire quando manca la connection string", () => {
		const result = validateConnectionString(undefined);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.message).toContain("DATABASE_URL");
			expect(result.message).toContain("argomento CLI");
			expect(result.message).toContain("non configurata");
		}
	});

	it("dovrebbe fallire quando la variabile è vuota", () => {
		const result = validateConnectionString("");
		expect(result.valid).toBe(false);
	});

	it("dovrebbe fallire quando la variabile è solo spazi", () => {
		const result = validateConnectionString("   ");
		expect(result.valid).toBe(false);
	});

	it("dovrebbe fallire con protocollo non PostgreSQL", () => {
		const result = validateConnectionString("mysql://u:p@h:3306/db");
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.message).toContain("Protocollo");
		}
	});

	it("dovrebbe fallire senza hostname", () => {
		// new URL() rifiuta hostname vuoto, quindi finisce nel catch
		const result = validateConnectionString("postgresql://u:p@:5432/db");
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.message).toContain("malformata");
		}
	});

	it("dovrebbe fallire senza database", () => {
		const result = validateConnectionString("postgresql://u:p@host:5432");
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.message).toContain("database");
		}
	});

	it("dovrebbe fallire per URL completamente malformato", () => {
		const result = validateConnectionString("garbage%%%");
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.message).toContain("malformata");
		}
	});

	it("dovrebbe accettare una stringa di connessione valida", () => {
		const result = validateConnectionString(
			"postgresql://utente:password@host.siteground.com:5432/miodb?sslmode=require",
		);
		expect(result.valid).toBe(true);
		if (result.valid) {
			expect(result.value).toBe(
				"postgresql://utente:password@host.siteground.com:5432/miodb?sslmode=require",
			);
		}
	});

	it("dovrebbe accettare protocollo 'postgres:' oltre a 'postgresql:'", () => {
		const result = validateConnectionString("postgres://u:p@host:5432/db");
		expect(result.valid).toBe(true);
	});
});

// ── hasTlsFlag ───────────────────────────────────────────────────

describe("hasTlsFlag", () => {
	it("dovrebbe riconoscere sslmode=require", () => {
		expect(hasTlsFlag("postgresql://u:p@h:5432/db?sslmode=require")).toBe(true);
	});

	it("dovrebbe riconoscere sslmode=verify-full", () => {
		expect(hasTlsFlag("postgresql://u:p@h:5432/db?sslmode=verify-full")).toBe(
			true,
		);
	});

	it("dovrebbe riconoscere sslmode=verify-ca", () => {
		expect(hasTlsFlag("postgresql://u:p@h:5432/db?sslmode=verify-ca")).toBe(
			true,
		);
	});

	it("dovrebbe riconoscere ssl=true", () => {
		expect(hasTlsFlag("postgresql://u:p@h:5432/db?ssl=true")).toBe(true);
	});

	it("dovrebbe restituire false senza flag TLS", () => {
		expect(hasTlsFlag("postgresql://u:p@h:5432/db")).toBe(false);
	});
});

// ── runDiagnostics (casi di errore, no connessione reale) ────────

describe("runDiagnostics — casi di errore", () => {
	beforeEach(() => {
		mockProcessExit();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("dovrebbe uscire con errore quando manca la connection string", () => {
		expect(() => runDiagnostics(undefined)).toThrow("process.exit");
	});

	it("dovrebbe uscire con errore quando la variabile è vuota", () => {
		expect(() => runDiagnostics("")).toThrow("process.exit");
	});

	it("dovrebbe stampare un messaggio di errore (non segreti) su stderr", () => {
		const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => runDiagnostics(undefined)).toThrow("process.exit");
		expect(stderrSpy).toHaveBeenCalled();
		const errorOutput = stderrSpy.mock.calls.map((c) => c.join(" ")).join(" ");
		expect(errorOutput).toContain("DATABASE_URL");
		expect(errorOutput).toContain("argomento CLI");
		expect(errorOutput).toContain("non configurata");
	});
});
