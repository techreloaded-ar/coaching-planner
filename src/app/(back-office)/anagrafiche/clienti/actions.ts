"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import {
  validaCliente,
  type DatiClienteInput,
  type ErroriValidazione,
} from "@/domain/anagrafiche/valida-cliente";

// ── Tipi per useActionState ─────────────────────────────────────

export interface StatoAction {
  errori: ErroriValidazione;
  successo?: boolean;
}

function statoIniziale(): StatoAction {
  return { errori: {} };
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Estrae i dati del cliente dal FormData e li normalizza.
 */
function datiDaForm(formData: FormData): DatiClienteInput {
  return {
    ragioneSociale: (formData.get("ragioneSociale") as string) ?? "",
    partitaIva: (formData.get("partitaIva") as string) ?? "",
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
 * Verifica che l'utente sia amministratore.
 * Lancia ErroreAutorizzazione se non lo è.
 */
async function guardiaAmministratore(): Promise<void> {
  await richiediRuoloApi("AMMINISTRATORE");
}

// ── Server Actions ──────────────────────────────────────────────

/**
 * Crea un nuovo cliente.
 *
 * Usabile con useActionState:
 *   const [stato, azione] = useActionState(creaCliente, statoIniziale());
 */
export async function creaCliente(
  _prevState: StatoAction,
  formData: FormData
): Promise<StatoAction> {
  await guardiaAmministratore();

  const dati = datiDaForm(formData);
  const errori = validaCliente(dati);

  if (Object.keys(errori).length > 0) {
    return { errori };
  }

  await db.cliente.create({
    data: {
      ragioneSociale: dati.ragioneSociale.trim(),
      partitaIva: dati.partitaIva.trim(),
      codiceFiscale: dati.codiceFiscale || null,
      indirizzo: dati.indirizzo || null,
      citta: dati.citta || null,
      cap: dati.cap || null,
      provincia: dati.provincia || null,
      pec: dati.pec || null,
      codiceDestinatario: dati.codiceDestinatario || null,
      attivo: true,
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
  await guardiaAmministratore();

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
      partitaIva: dati.partitaIva.trim(),
      codiceFiscale: dati.codiceFiscale || null,
      indirizzo: dati.indirizzo || null,
      citta: dati.citta || null,
      cap: dati.cap || null,
      provincia: dati.provincia || null,
      pec: dati.pec || null,
      codiceDestinatario: dati.codiceDestinatario || null,
    },
  });

  revalidatePath("/anagrafiche/clienti");
  redirect("/anagrafiche/clienti?esito=salvato");
}

/**
 * Attiva o disattiva un cliente.
 *
 * Usabile con useActionState.
 */
export async function cambiaStatoCliente(
  _prevState: StatoAction,
  formData: FormData
): Promise<StatoAction> {
  await guardiaAmministratore();

  const id = formData.get("id") as string;
  const nuovoStato = formData.get("attivo") === "true";

  if (!id) {
    return { errori: { _form: "ID cliente mancante" } };
  }

  await db.cliente.update({
    where: { id },
    data: { attivo: nuovoStato },
  });

  revalidatePath("/anagrafiche/clienti");
  return {
    errori: {},
    successo: true,
  };
}
