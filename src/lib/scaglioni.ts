import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import type { ScaglioneKm } from "@/generated/prisma/client";

/**
 * Elenca gli scaglioni km ordinati per soglia crescente.
 * Unica fonte per la vista di configurazione e per il futuro calcolo dei rimborsi.
 * Accesso riservato all'amministratore.
 */
export async function elencaScaglioni(): Promise<ScaglioneKm[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.scaglioneKm.findMany({
    orderBy: { finoAKm: "asc" },
  });
}

/**
 * Restituisce uno scaglione km per ID.
 * Accesso riservato all'amministratore.
 */
export async function scaglionePerId(id: string): Promise<ScaglioneKm | null> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.scaglioneKm.findUnique({
    where: { id },
  });
}
