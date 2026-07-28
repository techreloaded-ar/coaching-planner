"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import {
  normalizzaTariffaGiornaliera,
  validaCollaboratore,
  type DatiCollaboratoreInput,
  type ErroriValidazione,
} from "@/domain/anagrafiche/valida-collaboratore";

// ── Tipi per useActionState ─────────────────────────────────────

export interface StatoAction {
  errori: ErroriValidazione;
  successo?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Estrae i dati del collaboratore dal FormData e li normalizza.
 */
function datiDaForm(formData: FormData): DatiCollaboratoreInput {
  return {
    nome: ((formData.get("nome") as string) ?? "").trim(),
    cognome: ((formData.get("cognome") as string) ?? "").trim(),
    partitaIva: ((formData.get("partitaIva") as string) ?? "").trim(),
    tariffaGiornaliera: ((formData.get("tariffaGiornaliera") as string) ?? "").trim(),
  };
}

/**
 * Verifica che l'utente sia amministratore.
 * Lancia ErroreAutorizzazione se non lo è.
 */
async function guardiaAmministratore(): Promise<void> {
  await richiediRuoloApi("AMMINISTRATORE");
}

// ── Server Actions ──────────────────────────────────────────────

/**
 * Aggiorna un collaboratore esistente, sincronizzando anche il nome
 * dell'utente associato. Il censimento e l'email di accesso sono
 * governati dalla schermata utenti (US-045/US-046).
 *
 * Usabile con useActionState.
 */
export async function aggiornaCollaboratore(
  _prevState: StatoAction,
  formData: FormData
): Promise<StatoAction> {
  await guardiaAmministratore();

  const id = formData.get("id") as string;
  if (!id) {
    return { errori: { _form: "ID collaboratore mancante" } };
  }

  const dati = datiDaForm(formData);
  const errori = validaCollaboratore(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  const tariffa = normalizzaTariffaGiornaliera(dati.tariffaGiornaliera);
  if (!tariffa) {
    return {
      errori: {
        tariffaGiornaliera: "Importo non valido: usa massimo 2 decimali",
      },
    };
  }

  const collaboratoreEsistente = await db.collaboratore.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!collaboratoreEsistente) {
    return { errori: { _form: "Collaboratore non trovato" } };
  }

  await db.$transaction(async (tx) => {
    await tx.collaboratore.update({
      where: { id },
      data: {
        nome: dati.nome,
        cognome: dati.cognome,
        partitaIva: dati.partitaIva,
        tariffaGiornaliera: tariffa.valore,
      },
    });

    await tx.utente.update({
      where: { id: collaboratoreEsistente.userId },
      data: { nome: dati.nome, cognome: dati.cognome },
    });
  });

  revalidatePath("/anagrafiche/collaboratori");
  redirect("/anagrafiche/collaboratori?esito=salvato");
}
