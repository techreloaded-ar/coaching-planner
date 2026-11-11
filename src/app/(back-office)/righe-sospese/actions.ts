"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { richiediPermessoApi } from "@/lib/dal";
import { leggiIdSelezionati } from "@/lib/selezione-elenco";

/**
 * Segna come risolte (`risolta` = "true") o di nuovo da risolvere le righe
 * sospese selezionate (un campo `id` per riga). Una riga già risolta conserva
 * la data di risoluzione originale.
 */
export async function cambiaRisoluzioneRigheSospeseAction(formData: FormData) {
  await richiediPermessoApi("GESTIRE_RIGHE_SOSPESE");

  const idRighe = leggiIdSelezionati(formData);
  const risolta = formData.get("risolta") === "true";

  if (idRighe.length > 0) {
    await db.rigaAttivitaSospesa.updateMany({
      where: { id: { in: idRighe }, risoltaIl: risolta ? null : { not: null } },
      data: { risoltaIl: risolta ? new Date() : null },
    });
  }

  revalidatePath("/righe-sospese");
}
