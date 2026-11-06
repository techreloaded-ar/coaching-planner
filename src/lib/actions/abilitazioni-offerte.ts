"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Abilita un collaboratore a un'offerta su cui ha già registrato attività,
 * direttamente dal foglio attività o dal dettaglio offerta.
 *
 * Stesse regole delle abilitazioni dall'anagrafica: solo amministratore,
 * offerta attiva, collaboratore attivo. Idempotente grazie al vincolo unico
 * (collaboratoreId, offertaId).
 */
export async function abilitaCollaboratoreSuOfferta(
  collaboratoreId: string,
  offertaId: string
): Promise<ActionResult> {
  await richiediRuoloApi("AMMINISTRATORE");

  const [offerta, collaboratore] = await Promise.all([
    db.offerta.findUnique({ where: { id: offertaId }, select: { attiva: true } }),
    db.collaboratore.findUnique({ where: { id: collaboratoreId }, select: { attivo: true } }),
  ]);

  if (!offerta?.attiva) {
    return { success: false, error: "L'offerta non è attiva" };
  }
  if (!collaboratore?.attivo) {
    return { success: false, error: "Il collaboratore non è attivo" };
  }

  await db.abilitazioneOfferta.createMany({
    data: [{ collaboratoreId, offertaId }],
    skipDuplicates: true,
  });

  revalidatePath("/attivita", "layout");
  revalidatePath("/offerte", "layout");
  revalidatePath("/anagrafiche", "layout");
  return { success: true };
}
