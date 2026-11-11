import "server-only";

import { db } from "@/lib/db";
import { richiediPermessoApi } from "@/lib/dal";
import type { VoceRimborsoTrasferta } from "@/generated/prisma/client";

/**
 * Elenca le voci di rimborso trasferta in ordine di creazione.
 * Unica fonte per la vista di configurazione e per il calcolo dei rimborsi.
 * Richiede il permesso GESTIRE_VOCI_RIMBORSO.
 */
export async function elencaVociRimborso(): Promise<VoceRimborsoTrasferta[]> {
  await richiediPermessoApi("GESTIRE_VOCI_RIMBORSO");

  return db.voceRimborsoTrasferta.findMany({
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Restituisce una voce di rimborso trasferta per ID.
 * Richiede il permesso GESTIRE_VOCI_RIMBORSO.
 */
export async function vocePerId(id: string): Promise<VoceRimborsoTrasferta | null> {
  await richiediPermessoApi("GESTIRE_VOCI_RIMBORSO");

  return db.voceRimborsoTrasferta.findUnique({
    where: { id },
  });
}
