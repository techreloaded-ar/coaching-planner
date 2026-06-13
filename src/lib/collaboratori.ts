import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import type { Collaboratore } from "@/generated/prisma/client";

// ── API collaboratori (back office, solo amministratore) ─────────

export interface CollaboratoreConUtente extends Collaboratore {
  utente: { email: string };
}

/**
 * Elenca tutti i collaboratori (attivi e disattivati), con l'email
 * dell'utente associato.
 * Accesso riservato all'amministratore.
 */
export async function elencaCollaboratori(): Promise<CollaboratoreConUtente[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.collaboratore.findMany({
    orderBy: { cognome: "asc" },
    include: { utente: { select: { email: true } } },
  });
}

/**
 * Restituisce un collaboratore per ID, con l'email dell'utente associato.
 * Accesso riservato all'amministratore.
 * Restituisce null se il collaboratore non esiste.
 */
export async function collaboratorePerId(
  id: string,
): Promise<CollaboratoreConUtente | null> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.collaboratore.findUnique({
    where: { id },
    include: { utente: { select: { email: true } } },
  });
}

/**
 * Elenca i soli collaboratori attivi, ordinati per cognome.
 * Unica fonte per le selezioni operative (attività, report, ecc.).
 * Accesso riservato all'amministratore.
 */
export async function elencaCollaboratoriSelezionabili(): Promise<Collaboratore[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.collaboratore.findMany({
    where: { attivo: true },
    orderBy: { cognome: "asc" },
  });
}
