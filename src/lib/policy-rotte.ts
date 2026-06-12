/**
 * Modulo puro di policy delle rotte.
 *
 * Importabile ovunque (anche da proxy.ts, edge runtime) perché non
 * usa "server-only", React cache, Prisma o cookie.
 *
 * Centralizza:
 *  - l'elenco delle rotte di back office e front office
 *  - la mappatura percorso → ruolo richiesto
 *  - la destinazione di default per ogni ruolo (homePerRuolo)
 */

import type { Ruolo } from "@/domain/types";

// ── Costanti: prefissi di rotta ─────────────────────────────────

/** Prefissi di percorso riservati agli amministratori (back office). */
export const ROTTE_BACK_OFFICE = [
  "/anagrafiche",
  "/offerte",
  "/collaboratori",
  "/report",
] as const;

/** Prefissi di percorso riservati ai collaboratori (front office). */
export const ROTTE_FRONT_OFFICE = [
  "/attivita",
] as const;

// ── Mappatura percorso → ruolo richiesto ────────────────────────

/**
 * Dato un pathname, restituisce il ruolo necessario per accedere alla rotta.
 *
 * Regole:
 * - match per prefisso: /anagrafiche/123 → back office
 * - rotte non coperte → null (pubbliche o neutre)
 *
 * @returns "AMMINISTRATORE" | "COLLABORATORE" | null
 */
export function ruoloRichiestoPerRotta(
  pathname: string
): Ruolo | null {
  if (matchPrefisso(pathname, ROTTE_BACK_OFFICE)) return "AMMINISTRATORE";
  if (matchPrefisso(pathname, ROTTE_FRONT_OFFICE)) return "COLLABORATORE";
  return null;
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

// ── Mappatura ruolo → destinazione (home) ───────────────────────

/**
 * Restituisce il percorso di destinazione predefinito per il ruolo.
 *
 * Unica fonte di verità: sostituisce le copie duplicate in proxy.ts,
 * callback Google e dal.ts.
 */
export function homePerRuolo(ruolo: Ruolo): string {
  return ruolo === "AMMINISTRATORE" ? "/anagrafiche" : "/attivita";
}
