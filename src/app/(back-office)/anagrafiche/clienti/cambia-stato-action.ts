"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";

/**
 * Server action per cambiare lo stato attivo/disattivo di un cliente.
 * Chiamata direttamente dai form nella tabella clienti.
 */
export async function cambiaStatoAction(formData: FormData) {
  await richiediRuoloApi("AMMINISTRATORE");

  const id = formData.get("id") as string;
  const attivo = formData.get("attivo") === "true";

  if (!id) {
    redirect("/anagrafiche/clienti");
  }

  await db.cliente.update({
    where: { id },
    data: { attivo },
  });

  revalidatePath("/anagrafiche/clienti");
  redirect("/anagrafiche/clienti");
}
