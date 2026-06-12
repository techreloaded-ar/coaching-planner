/**
 * Spike diagnostico — Connettività TLS al Postgres SiteGround (US-004)
 *
 * Uso:
 *   npx tsx scripts/siteground-connectivity-check.ts
 *
 * Requisiti:
 *   - Variabile d'ambiente SITEGROUND_DATABASE_URL configurata in .env.local
 *     (formato: postgresql://<utente>:<password>@<host>:5432/<database>?sslmode=require)
 *
 * Lo script è non distruttivo: esegue solo query di metadati in lettura.
 * Non stampa mai credenziali, password o token nell'output.
 */

import "dotenv/config";
import pg from "pg";

// ── Funzioni di utilità (esportate per testabilità) ──────────────

export function redactConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    // Se il parsing fallisce, oscura completamente
    return "[stringa di connessione malformata — oscurata]";
  }
}

export function extractHost(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "[host sconosciuto]";
  }
}

export function extractDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, "") || "[database sconosciuto]";
  } catch {
    return "[database sconosciuto]";
  }
}

export function validateConnectionString(url: string | undefined): { valid: true; value: string } | { valid: false; message: string } {
  if (!url || url.trim() === "") {
    return {
      valid: false,
      message:
        "SITEGROUND_DATABASE_URL non è configurata.\n" +
        "  Copia .env.example in .env.local e imposta la stringa di connessione SiteGround.\n" +
        "  Esempio: SITEGROUND_DATABASE_URL=\"postgresql://utente:password@host:5432/db?sslmode=require\"",
    };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
      return {
        valid: false,
        message: `Protocollo non supportato: "${parsed.protocol}". Usare postgresql://.`,
      };
    }
    if (!parsed.hostname) {
      return {
        valid: false,
        message: "Stringa di connessione malformata: hostname mancante.",
      };
    }
    if (!parsed.pathname || parsed.pathname === "/") {
      return {
        valid: false,
        message: "Stringa di connessione malformata: nome database mancante.",
      };
    }
  } catch {
    return {
      valid: false,
      message: "Stringa di connessione malformata: impossibile parsare l'URL.",
    };
  }

  return { valid: true, value: url };
}

export function hasTlsFlag(url: string): boolean {
  return url.includes("sslmode=require") ||
    url.includes("sslmode=verify-full") ||
    url.includes("sslmode=verify-ca") ||
    url.includes("ssl=true") ||
    url.includes("ssl=1");
}

// ── Validazione input ────────────────────────────────────────────

function exitWithError(message: string): never {
  console.error(`❌ ERRORE: ${message}`);
  process.exit(1);
}

export function runDiagnostics(connectionString: string | undefined): ReturnType<typeof runConnectivityCheck> | never {
  const validation = validateConnectionString(connectionString);
  if (!validation.valid) {
    exitWithError(validation.message);
  }

  const url = validation.value;

  if (!hasTlsFlag(url)) {
    console.warn(
      "⚠️  AVVISO: La stringa di connessione non contiene un flag TLS (sslmode=require, ecc.).\n" +
        "   SiteGround richiede TLS. La connessione potrebbe fallire.\n"
    );
  }

  return runConnectivityCheck(url);
}

// ── Connessione e diagnostica ────────────────────────────────────

export async function runConnectivityCheck(connectionString: string) {
  const host = extractHost(connectionString);
  const database = extractDatabase(connectionString);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Spike diagnostico — Connettività SiteGround PostgreSQL");
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log(`Host:     ${host}`);
  console.log(`Database: ${database}`);
  console.log(`Stringa:  ${redactConnectionString(connectionString)}\n`);

  const client = new pg.Client({ connectionString });

  // ── Connessione ───────────────────────────────────────────────

  console.log("🔄 Tentativo di connessione TLS in corso...");

  const connectStart = performance.now();
  let connectElapsed = 0;
  try {
    await client.connect();
    connectElapsed = performance.now() - connectStart;
    console.log("✅ Connessione TLS stabilita con successo!");
  } catch (err) {
    const elapsed = ((performance.now() - connectStart) / 1000).toFixed(1);
    console.log(`⏱️  Tempo trascorso prima del fallimento: ${elapsed}s\n`);
    console.error(`❌ Connessione fallita: ${(err as Error).message}`);

    const errorMsg = (err as Error).message;
    console.log("\n── Analisi dell'errore ──────────────────────────────────");
    if (errorMsg.includes("certificate") || errorMsg.includes("TLS") || errorMsg.includes("SSL") || errorMsg.includes("self-signed")) {
      console.log("🔍 L'errore riguarda il certificato TLS/SSL.");
      console.log("   Possibili cause:");
      console.log("   - Il certificato del server non è riconosciuto dalla CA di sistema");
      console.log("   - sslmode=require non è accettato dal server");
      console.log("   - Il server richiede sslmode=verify-full o una CA specifica");
      console.log("   Azione: verificare con SiteGround se è richiesto un certificato CA personalizzato");
    } else if (errorMsg.includes("ENOTFOUND") || errorMsg.includes("EAI_AGAIN")) {
      console.log("🔍 Host non risolvibile. Verificare che l'hostname sia corretto e raggiungibile.");
    } else if (errorMsg.includes("timeout") || errorMsg.includes("ETIMEDOUT")) {
      console.log("🔍 Timeout di connessione. Verificare che l'host e la porta siano accessibili dalla rete corrente.");
    } else if (errorMsg.includes("password") || errorMsg.includes("authentication")) {
      console.log("🔍 Errore di autenticazione. Verificare username e password.");
    }
    console.log("────────────────────────────────────────────────────────\n");

    // Assicura la chiusura del client anche in caso di errore di connessione
    try { await client.end(); } catch { /* il client potrebbe non essere connesso */ }
    return { success: false, error: errorMsg, elapsed };
  }

  try {
    // ── Query di metadati ──────────────────────────────────────────

    console.log("\n── Diagnostica PostgreSQL ──────────────────────────────");

    // Versione
    const versionStart = performance.now();
    const versionRes = await client.query("SELECT version()");
    const versionElapsed = performance.now() - versionStart;
    const versionStr = versionRes.rows[0].version as string;
    const pgVersion = versionStr.match(/PostgreSQL ([\d.]+)/)?.[1] ?? "[non rilevata]";
    console.log(`Versione PostgreSQL: ${pgVersion}`);
    console.log(`Versione completa:   ${versionStr.split(",")[0]}`);

    // Server encoding
    const encRes = await client.query("SHOW server_encoding");
    console.log(`Server encoding:     ${encRes.rows[0].server_encoding}`);

    // Timezone
    const tzRes = await client.query("SHOW timezone");
    const tzValue = tzRes.rows[0]?.Timezone ?? tzRes.rows[0]?.timezone ?? Object.values(tzRes.rows[0] ?? {})[0] ?? "non disponibile";
    console.log(`Timezone server:     ${tzValue}`);

    // SSL attivo
    const sslRes = await client.query("SHOW ssl");
    console.log(`SSL attivo:          ${sslRes.rows[0].ssl}`);

    // Connessioni correnti
    const connRes = await client.query(
      "SELECT count(*) as total FROM pg_stat_activity"
    );
    console.log(`Connessioni attive:  ${connRes.rows[0].total}`);

    // ── Latenza ────────────────────────────────────────────────────

    const latencyStart = performance.now();
    await client.query("SELECT 1");
    const latencyElapsed = performance.now() - latencyStart;
    const roundTripMs = latencyElapsed.toFixed(1);
    console.log(`Latenza round-trip:  ${roundTripMs}ms`);

    // ── Cataloghi ──────────────────────────────────────────────────

    const tablesRes = await client.query(`
      SELECT count(*) as total
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `);
    console.log(`Tabelle pubbliche:   ${tablesRes.rows[0].total}`);

    // ── Prisma compatibility check ─────────────────────────────────

    console.log("\n── Compatibilità Prisma ────────────────────────────────");
    const pgMajor = parseInt(pgVersion.split(".")[0], 10);
    const pgMinor = parseInt(pgVersion.split(".")[1] || "0", 10);

    // Prisma 7.x requirements: PostgreSQL 9.4+ (per pg advisory lock)
    // But for adapter-pg (driver-level): PostgreSQL 12+ is recommended
    const minMajor = 12;
    if (pgMajor >= minMajor) {
      console.log(`✅ PostgreSQL ${pgVersion} è compatibile con Prisma 7.x (richiede ≥ ${minMajor}.0)`);
    } else if (pgMajor >= 9 && pgMinor >= 4) {
      console.log(`⚠️  PostgreSQL ${pgVersion} è tecnicamente compatibile ma precedente alla versione raccomandata (≥ ${minMajor}.0).`);
      console.log("   Prisma 7.x con pg-adapter potrebbe funzionare ma non è garantito.");
    } else {
      console.log(`❌ PostgreSQL ${pgVersion} NON è compatibile con Prisma 7.x (richiede ≥ 9.4).`);
    }

    console.log("\n── Riepilogo performance ───────────────────────────────");
    console.log(`Connessione TLS:     ${(connectElapsed / 1000).toFixed(2)}s`);
    console.log(`Query versione:      ${(versionElapsed).toFixed(1)}ms`);
    console.log(`Round-trip minimo:   ${roundTripMs}ms`);
    console.log("────────────────────────────────────────────────────────");

    console.log("\n✅ Diagnostica completata. Connessione chiusa correttamente.");
    console.log("═══════════════════════════════════════════════════════════\n");

    return {
      success: true,
      pgVersion,
      connectElapsedMs: connectElapsed,
      versionElapsedMs: versionElapsed,
      roundTripMs: parseFloat(roundTripMs),
    };
  } finally {
    // Garantisce la chiusura del client anche in caso di errore durante le query
    try { await client.end(); } catch { /* il client potrebbe essere già chiuso */ }
  }
}

// ── Entry point da CLI ───────────────────────────────────────────

if (process.argv[1]?.endsWith("siteground-connectivity-check.ts") || process.argv[1]?.endsWith("siteground-connectivity-check.js")) {
  runDiagnostics(process.env.SITEGROUND_DATABASE_URL);
}
