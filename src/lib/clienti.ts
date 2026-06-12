import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import type { Cliente } from "@/generated/prisma/client";

// ── API clienti (back office, solo amministratore) ──────────────

/**
 * Elenca tutti i clienti (attivi e disattivati).
 * Accesso riservato all'amministratore.
 */
export async function elencaClienti(): Promise<Cliente[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.cliente.findMany({
    orderBy: { ragioneSociale: "asc" },
  });
}

/**
 * Restituisce un cliente per ID.
 * Accesso riservato all'amministratore.
 * Restituisce null se il cliente non esiste.
 */
export async function clientePerId(id: string): Promise<Cliente | null> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.cliente.findUnique({
    where: { id },
  });
}

/**
 * Elenca i soli clienti attivi, ordinati per ragione sociale.
 * Unica fonte per le selezioni operative (offerte, attività, ecc.).
 * Accesso riservato all'amministratore.
 */
export async function elencaClientiSelezionabili(): Promise<Cliente[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.cliente.findMany({
    where: { attivo: true },
    orderBy: { ragioneSociale: "asc" },
  });
}
