"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import {
  leggiPosizioneElencoDaForm,
  urlPosizioneElenco,
} from "@/lib/paginazione";
import { leggiIdSelezionati } from "@/lib/selezione-elenco";

/**
 * Server action per disattivare o riattivare uno o più clienti (un campo `id`
 * per cliente). Chiamata dalla barra azioni dell'elenco clienti; riporta alla
 * stessa pagina e ricerca dell'elenco.
 */
export async function cambiaStatoAction(formData: FormData) {
  await richiediRuoloApi("AMMINISTRATORE");

  const idClienti = leggiIdSelezionati(formData);
  const attivo = formData.get("attivo") === "true";
  const urlElenco = urlPosizioneElenco(
    "/anagrafiche/clienti",
    leggiPosizioneElencoDaForm(formData),
  );

  if (idClienti.length === 0) {
    redirect(urlElenco);
  }

  await db.cliente.updateMany({
    where: { id: { in: idClienti } },
    data: { attivo },
  });

  revalidatePath("/anagrafiche/clienti");
  redirect(urlElenco);
}
