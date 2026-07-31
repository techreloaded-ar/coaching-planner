import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import type { VoceRimborsoTrasferta } from "@/generated/prisma/client";

/**
 * Elenca le voci di rimborso trasferta in ordine di creazione.
 * Unica fonte per la vista di configurazione e per il calcolo dei rimborsi.
 * Accesso riservato all'amministratore.
 */
export async function elencaVociRimborso(): Promise<VoceRimborsoTrasferta[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.voceRimborsoTrasferta.findMany({
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Restituisce una voce di rimborso trasferta per ID.
 * Accesso riservato all'amministratore.
 */
export async function vocePerId(id: string): Promise<VoceRimborsoTrasferta | null> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.voceRimborsoTrasferta.findUnique({
    where: { id },
  });
}
