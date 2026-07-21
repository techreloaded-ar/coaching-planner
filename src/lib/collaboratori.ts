import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import type { Collaboratore } from "@/generated/prisma/client";
import type { RigaAttivitaConContesto } from "@/lib/attivita";

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

/**
 * Restituisce lo storico completo delle righe attività di un collaboratore,
 * con offerta e cliente associati, ordinate per data crescente (a parità di
 * data, per data di creazione crescente). Nessun filtro temporale: lo storico
 * è completo, pronto per il raggruppamento mensile.
 * Accesso riservato all'amministratore.
 */
export async function storicoAttivitaCollaboratore(
  collaboratoreId: string,
): Promise<RigaAttivitaConContesto[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.rigaAttivita.findMany({
    where: { collaboratoreId },
    include: { offerta: true, cliente: true },
    orderBy: [{ data: "asc" }, { createdAt: "asc" }],
  });
}
