/**
 * Landing autenticata comune.
 *
 * Importabile ovunque (anche da proxy.ts) perché non usa "server-only",
 * React cache, Prisma o cookie.
 */

/** Unica landing per ogni utente autenticato. */
export const HOME_AUTENTICATA = "/attivita";
