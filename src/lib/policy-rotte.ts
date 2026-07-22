/**
 * Modulo puro di policy delle rotte.
 *
 * Importabile ovunque (anche da proxy.ts) perché non usa "server-only",
 * React cache, Prisma o cookie.
 */

import type { Ruolo } from "@/domain/types";

/** Livelli di accesso alle rotte non pubbliche. */
export type PoliticaAccesso = "AUTENTICATO" | "AMMINISTRATORE";

/** Unica landing per ogni utente autenticato. */
export const HOME_AUTENTICATA = "/attivita";

// ── Costanti: prefissi di rotta ─────────────────────────────────

/** Prefissi di percorso riservati agli amministratori (back office). */
export const ROTTE_BACK_OFFICE = [
  "/anagrafiche",
  "/offerte",
  "/collaboratori",
  "/report",
] as const;

/** Prefissi dell'area autenticata comune (front office). */
export const ROTTE_FRONT_OFFICE = [HOME_AUTENTICATA] as const;

// ── Mappatura percorso → policy di accesso ──────────────────────

/**
 * Restituisce la policy di accesso per una rotta non pubblica.
 *
 * Le sole rotte amministrative richiedono il ruolo AMMINISTRATORE;
 * /attivita e le sue sottorotte richiedono una sessione valida. Il fallback
 * conserva la protezione delle rotte non pubbliche non ancora classificate.
 */
export function politicaAccessoPerRotta(pathname: string): PoliticaAccesso {
  if (matchPrefisso(pathname, ROTTE_BACK_OFFICE)) return "AMMINISTRATORE";
  if (matchPrefisso(pathname, ROTTE_FRONT_OFFICE)) return "AUTENTICATO";
  return "AUTENTICATO";
}

/**
 * Compatibilità temporanea per i consumer che usano ancora la vecchia API.
 * La policy autorevole è politicaAccessoPerRotta: `null` non identifica una
 * rotta pubblica e non deve essere usato per prendere decisioni di accesso.
 *
 * @deprecated Usa politicaAccessoPerRotta.
 */
export function ruoloRichiestoPerRotta(pathname: string): Ruolo | null {
  return politicaAccessoPerRotta(pathname) === "AMMINISTRATORE"
    ? "AMMINISTRATORE"
    : null;
}

// ── Helper: match per prefisso ──────────────────────────────────

function matchPrefisso(
  pathname: string,
  prefissi: readonly string[]
): boolean {
  // Normalizza: rimuovi eventuale trailing slash (ma non la radice "/")
  const normalised = pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;

  return prefissi.some(
    (p) => normalised === p || normalised.startsWith(p + "/")
  );
}
