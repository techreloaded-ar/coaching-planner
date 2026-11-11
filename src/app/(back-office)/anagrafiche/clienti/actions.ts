"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { richiediPermessoApi } from "@/lib/dal";
import {
  validaCliente,
  type DatiClienteInput,
  type ErroriValidazione,
} from "@/domain/anagrafiche/valida-cliente";
import { leggiNoteDaForm, leggiTestoFacoltativoDaForm } from "@/domain/anagrafiche/note";

// ── Tipi per useActionState ─────────────────────────────────────

export interface StatoAction {
  errori: ErroriValidazione;
  successo?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Estrae i dati del cliente dal FormData e li normalizza.
 */
function datiDaForm(formData: FormData): DatiClienteInput {
  return {
    ragioneSociale: (formData.get("ragioneSociale") as string) ?? "",
    partitaIva: (formData.get("partitaIva") as string)?.trim() || "",
    codiceFiscale:
      (formData.get("codiceFiscale") as string)?.trim().toUpperCase() || "",
    indirizzo: (formData.get("indirizzo") as string)?.trim() || "",
    citta: (formData.get("citta") as string)?.trim() || "",
    cap: (formData.get("cap") as string)?.trim() || "",
    provincia:
      (formData.get("provincia") as string)?.trim().toUpperCase() || "",
    pec: (formData.get("pec") as string)?.trim() || "",
    codiceDestinatario:
      (formData.get("codiceDestinatario") as string)?.trim().toUpperCase() || "",
  };
}

/**
 * Verifica che l'utente abbia il permesso GESTIRE_CLIENTI.
 * Lancia ErroreAutorizzazione se non lo ha.
 */
async function guardiaGestioneClienti(): Promise<void> {
  await richiediPermessoApi("GESTIRE_CLIENTI");
}

// ── Server Actions ──────────────────────────────────────────────

/**
 * Crea un nuovo cliente.
 *
 * Usabile con useActionState.
 */
export async function creaCliente(
  _prevState: StatoAction,
  formData: FormData
): Promise<StatoAction> {
  await guardiaGestioneClienti();

  const dati = datiDaForm(formData);
  const errori = validaCliente(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  await db.cliente.create({
    data: {
      ragioneSociale: dati.ragioneSociale.trim(),
      partitaIva: dati.partitaIva || null,
      codiceFiscale: dati.codiceFiscale || null,
      indirizzo: dati.indirizzo || null,
      citta: dati.citta || null,
      cap: dati.cap || null,
      provincia: dati.provincia || null,
      pec: dati.pec || null,
      codiceDestinatario: dati.codiceDestinatario || null,
      personaRiferimento: leggiTestoFacoltativoDaForm(formData, "personaRiferimento"),
      note: leggiNoteDaForm(formData),
    },
  });

  revalidatePath("/anagrafiche/clienti");
  redirect("/anagrafiche/clienti?esito=creato");
}

/**
 * Aggiorna un cliente esistente.
 *
 * Usabile con useActionState.
 */
export async function aggiornaCliente(
  _prevState: StatoAction,
  formData: FormData
): Promise<StatoAction> {
  await guardiaGestioneClienti();

  const id = formData.get("id") as string;
  if (!id) {
    return { errori: { _form: "ID cliente mancante" } };
  }

  const dati = datiDaForm(formData);
  const errori = validaCliente(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  await db.cliente.update({
    where: { id },
    data: {
      ragioneSociale: dati.ragioneSociale.trim(),
      partitaIva: dati.partitaIva || null,
      codiceFiscale: dati.codiceFiscale || null,
      indirizzo: dati.indirizzo || null,
      citta: dati.citta || null,
      cap: dati.cap || null,
      provincia: dati.provincia || null,
      pec: dati.pec || null,
      codiceDestinatario: dati.codiceDestinatario || null,
      personaRiferimento: leggiTestoFacoltativoDaForm(formData, "personaRiferimento"),
      note: leggiNoteDaForm(formData),
    },
  });

  revalidatePath("/anagrafiche/clienti");
  redirect("/anagrafiche/clienti?esito=salvato");
}
