"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { richiediCollaboratoreCorrente } from "@/lib/dal";
import { validaOre } from "@/domain/consuntivi";
import { offerteAttivePerCliente } from "@/lib/attivita";

// ── Tipi ────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean;
  error?: string;
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Verifica che la riga appartenga al collaboratore corrente.
 */
async function verificaProprietario(
  rigaId: string,
  collaboratoreId: string
): Promise<ActionResult | null> {
  const riga = await db.rigaAttivita.findUnique({
    where: { id: rigaId },
    select: { collaboratoreId: true },
  });

  if (!riga) {
    return { success: false, error: "Riga non trovata" };
  }

  if (riga.collaboratoreId !== collaboratoreId) {
    return {
      success: false,
      error: "Non puoi modificare le attività di un altro collaboratore",
    };
  }

  return null; // ok
}

// ── Server Actions ──────────────────────────────────────────────

/**
 * Crea una nuova riga attività per il collaboratore corrente.
 *
 * Campi attesi nel FormData:
 * - clienteId, offertaId, ore, nota, fatturabile, data (YYYY-MM-DD)
 */
export async function creaRiga(
  formData: FormData
): Promise<ActionResult> {
  const collaboratore = await richiediCollaboratoreCorrente();
  if (!collaboratore) {
    return { success: false, error: "Devi essere un collaboratore per registrare attività" };
  }

  const clienteId = formData.get("clienteId") as string;
  const offertaId = formData.get("offertaId") as string;
  const oreRaw = formData.get("ore") as string;
  const nota = (formData.get("nota") as string) || null;
  const fatturabileRaw = formData.get("fatturabile");
  const dataStr = formData.get("data") as string;

  // Validazione campi obbligatori
  if (!clienteId || !offertaId || !oreRaw || !dataStr) {
    return { success: false, error: "Compila tutti i campi obbligatori" };
  }

  // Validazione ore
  const risultatoOre = validaOre(oreRaw);
  if (!risultatoOre.valido) {
    return { success: false, error: risultatoOre.errore };
  }

  // Validazione data
  const matchData = /^\d{4}-\d{2}-\d{2}$/.exec(dataStr);
  if (!matchData) {
    return { success: false, error: "Data non valida" };
  }
  const [anno, mese, giorno] = dataStr.split("-").map(Number);
  const data = new Date(anno, mese - 1, giorno);

  // Parsing fatturabile
  const fatturabile = fatturabileRaw === "on" || fatturabileRaw === "true";

  await db.rigaAttivita.create({
    data: {
      collaboratoreId: collaboratore.id,
      clienteId,
      offertaId,
      data,
      ore: risultatoOre.valore!,
      nota,
      fatturabile,
    },
  });

  revalidatePath(`/attivita/${dataStr}`);

  return { success: true };
}

/**
 * Modifica una riga attività esistente.
 *
 * Campi attesi nel FormData:
 * - rigaId, clienteId?, offertaId?, ore?, nota?, fatturabile?, data?
 */
export async function modificaRiga(
  formData: FormData
): Promise<ActionResult> {
  const collaboratore = await richiediCollaboratoreCorrente();
  if (!collaboratore) {
    return { success: false, error: "Devi essere un collaboratore per modificare attività" };
  }

  const rigaId = formData.get("rigaId") as string;
  if (!rigaId) {
    return { success: false, error: "ID riga mancante" };
  }

  // Verifica proprietà
  const erroreProprietario = await verificaProprietario(rigaId, collaboratore.id);
  if (erroreProprietario) return erroreProprietario;

  // Costruisci i dati da aggiornare
  const updateData: Record<string, unknown> = {};

  const clienteId = formData.get("clienteId") as string;
  if (clienteId) updateData.clienteId = clienteId;

  const offertaId = formData.get("offertaId") as string;
  if (offertaId) updateData.offertaId = offertaId;

  const oreRaw = formData.get("ore") as string;
  if (oreRaw) {
    const risultatoOre = validaOre(oreRaw);
    if (!risultatoOre.valido) {
      return { success: false, error: risultatoOre.errore };
    }
    updateData.ore = risultatoOre.valore!;
  }

  // nota: può essere stringa vuota (l'utente vuole rimuovere la nota)
  if (formData.has("nota")) {
    const nota = formData.get("nota") as string;
    updateData.nota = nota || null;
  }

  // fatturabile: la checkbox non viene inviata se deselezionata
  if (formData.has("fatturabile")) {
    const fatturabileRaw = formData.get("fatturabile");
    updateData.fatturabile = fatturabileRaw === "on" || fatturabileRaw === "true";
  }

  const dataStr = formData.get("data") as string;
  if (dataStr) {
    const matchData = /^\d{4}-\d{2}-\d{2}$/.exec(dataStr);
    if (!matchData) {
      return { success: false, error: "Data non valida" };
    }
    const [anno, mese, giorno] = dataStr.split("-").map(Number);
    updateData.data = new Date(anno, mese - 1, giorno);
  }

  await db.rigaAttivita.update({
    where: { id: rigaId },
    data: updateData,
  });

  revalidatePath(`/attivita/${dataStr}`);

  return { success: true };
}

/**
 * Elimina una riga attività.
 *
 * @param rigaId - ID della riga da eliminare
 */
export async function eliminaRiga(
  rigaId: string
): Promise<ActionResult> {
  const collaboratore = await richiediCollaboratoreCorrente();
  if (!collaboratore) {
    return { success: false, error: "Devi essere un collaboratore per eliminare attività" };
  }

  if (!rigaId) {
    return { success: false, error: "ID riga mancante" };
  }

  // Verifica proprietà
  const erroreProprietario = await verificaProprietario(rigaId, collaboratore.id);
  if (erroreProprietario) return erroreProprietario;

  // Recupera la data della riga per il revalidate
  const riga = await db.rigaAttivita.findUnique({
    where: { id: rigaId },
    select: { data: true },
  });

  await db.rigaAttivita.delete({
    where: { id: rigaId },
  });

  if (riga) {
    const data = riga.data;
    const dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
    revalidatePath(`/attivita/${dataStr}`);
  }

  return { success: true };
}

/**
 * Server Action per recuperare le offerte attive di un cliente.
 * Chiamabile dal client per il cascade select cliente → offerta.
 */
export async function fetchOffertePerCliente(
  clienteId: string
): Promise<{ success: boolean; data?: { id: string; codice: string; descrizione: string }[]; error?: string }> {
  try {
    const offerte = await offerteAttivePerCliente(clienteId);
    return { success: true, data: offerte };
  } catch {
    return { success: false, error: "Errore nel recupero delle offerte" };
  }
}
