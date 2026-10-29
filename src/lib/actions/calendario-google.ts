"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { richiediCollaboratoreCorrente } from "@/lib/dal";

/**
 * Scollega il calendario Google del collaboratore corrente rimuovendo il token
 * di rinnovo salvato. Gli eventi già confermati o rifiutati restano gestiti.
 */
export async function scollegaCalendarioGoogle(): Promise<void> {
  const collaboratore = await richiediCollaboratoreCorrente();
  if (!collaboratore) return;

  await db.collegamentoCalendarioGoogle.deleteMany({
    where: { collaboratoreId: collaboratore.id },
  });

  revalidatePath("/impostazioni");
  revalidatePath("/attivita");
}

/**
 * Rifiuta la proposta di un evento del calendario: l'evento non viene più
 * proposto al collaboratore corrente e nessuna riga viene creata.
 */
export async function rifiutaPropostaCalendario(
  eventoCalendarioId: string
): Promise<{ success: boolean; error?: string }> {
  const collaboratore = await richiediCollaboratoreCorrente();
  if (!collaboratore) {
    return { success: false, error: "Profilo collaboratore non operativo" };
  }

  if (typeof eventoCalendarioId !== "string" || eventoCalendarioId.trim() === "") {
    return { success: false, error: "Evento non valido" };
  }

  await db.eventoCalendarioGestito.createMany({
    data: [{ collaboratoreId: collaboratore.id, eventoCalendarioId }],
    skipDuplicates: true,
  });

  return { success: true };
}
