"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  risolviProfiloCollaboratoreCorrente,
  type StatoProfiloCollaboratore,
} from "@/lib/dal";
import type { Collaboratore } from "@/generated/prisma/client";
import { validaOre, validaKmTrasferta, calcolaRimborsoTrasferta } from "@/domain/consuntivi";
import { offerteAbilitatePerCliente, scaglioniRimborsoTrasferta } from "@/lib/attivita";

// ── Tipi ────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean;
  error?: string;
}

// ── Helpers ─────────────────────────────────────────────────────

function messaggioProfiloNonDisponibile(
  profilo: Exclude<StatoProfiloCollaboratore, { stato: "ATTIVO" }>
): string {
  return profilo.stato === "ASSENTE"
    ? "Il tuo account non ha un profilo Collaboratore. Richiedi il censimento nell'Anagrafica collaboratori."
    : "Il tuo profilo Collaboratore è disattivato. Chiedi a un amministratore di riattivarlo.";
}

/** Restituisce solo il profilo corrente attivo, senza consentire fallback. */
async function richiediCollaboratoreOperativo(): Promise<
  Collaboratore | ActionResult
> {
  const profilo = await risolviProfiloCollaboratoreCorrente();

  if (profilo.stato === "ATTIVO") {
    return profilo.collaboratore;
  }

  return { success: false, error: messaggioProfiloNonDisponibile(profilo) };
}

/**
 * Verifica che la riga appartenga al collaboratore corrente e ne restituisce
 * i dati essenziali (offertaId, clienteId) per i controlli successivi.
 */
async function caricaRigaDelCollaboratore(
  rigaId: string,
  collaboratoreId: string
): Promise<{ errore: ActionResult | null; riga?: { offertaId: string; clienteId: string } }> {
  const riga = await db.rigaAttivita.findUnique({
    where: { id: rigaId },
    select: { collaboratoreId: true, offertaId: true, clienteId: true },
  });

  if (!riga) {
    return { errore: { success: false, error: "Riga non trovata" } };
  }

  if (riga.collaboratoreId !== collaboratoreId) {
    return {
      errore: {
        success: false,
        error: "Non puoi modificare le attività di un altro collaboratore",
      },
    };
  }

  return {
    errore: null,
    riga: { offertaId: riga.offertaId, clienteId: riga.clienteId },
  };
}

/**
 * Verifica che l'offerta appartenga al cliente e sia attiva.
 * Restituisce null se ok, altrimenti un ActionResult con errore.
 */
async function verificaOffertaCliente(
  offertaId: string,
  clienteId: string
): Promise<ActionResult | null> {
  const offerta = await db.offerta.findUnique({
    where: { id: offertaId },
    select: { clienteId: true, attiva: true },
  });

  if (!offerta) {
    return { success: false, error: "Offerta non trovata" };
  }

  if (offerta.clienteId !== clienteId) {
    return { success: false, error: "L'offerta non appartiene al cliente selezionato" };
  }

  if (!offerta.attiva) {
    return { success: false, error: "L'offerta non è più attiva" };
  }

  return null;
}

/**
 * Verifica che il collaboratore sia abilitato a registrare attività
 * sull'offerta indicata.
 * Restituisce null se ok, altrimenti un ActionResult con errore.
 */
async function verificaAbilitazioneOfferta(
  collaboratoreId: string,
  offertaId: string
): Promise<ActionResult | null> {
  const abilitazione = await db.abilitazioneOfferta.findUnique({
    where: {
      collaboratoreId_offertaId: { collaboratoreId, offertaId },
    },
  });

  if (!abilitazione) {
    return {
      success: false,
      error: "Non sei abilitato a registrare attività su questa offerta",
    };
  }

  return null;
}

/**
 * Valida il campo trasfertaKm lato server.
 * - vuoto => km null (nessuna trasferta)
 * - valore valido e coperto da scaglione => km intero
 * - oltre soglia massima => errore
 */
async function validaTrasfertaKmServer(
  trasfertaKmRaw: string | null
): Promise<ActionResult & { km?: number | null }> {
  // Campo non presente o vuoto: nessuna trasferta
  if (!trasfertaKmRaw || trasfertaKmRaw.trim() === "") {
    return { success: true, km: null };
  }

  // Validazione dominio: solo interi positivi
  const validazione = validaKmTrasferta(trasfertaKmRaw);
  if (!validazione.valido) {
    return { success: false, error: validazione.errore };
  }

  const km = validazione.valore!;

  // Verifica che i km rientrino in uno scaglione
  const scaglioni = await scaglioniRimborsoTrasferta();
  const risultato = calcolaRimborsoTrasferta(km, scaglioni);

  if (risultato.stato === "OLTRE_SOGLIA") {
    return { success: false, error: risultato.messaggio };
  }

  if (risultato.stato === "NESSUNO_SCAGLIONE") {
    return { success: false, error: risultato.messaggio };
  }

  return { success: true, km };
}

// ── Server Actions ──────────────────────────────────────────────
//
// Invalidazione dopo una scrittura riuscita: oltre al giorno e al riepilogo,
// ogni action invalida `/attivita`, il percorso server del calendario mensile.
// Questa è la protezione del rendering SSR/RSC. La cache client dei mesi ha una
// propria invalidazione esplicita, applicata dal dettaglio giornata: le due
// mitigazioni sono complementari e nessuna delle due sostituisce l'altra.
// Un esito `{ success: false }` o un'eccezione non invalida nulla.

/**
 * Crea una nuova riga attività per il collaboratore corrente.
 *
 * Campi attesi nel FormData:
 * - clienteId, offertaId, ore, nota, fatturabile, data (YYYY-MM-DD)
 */
export async function creaRiga(
  formData: FormData
): Promise<ActionResult> {
  const collaboratore = await richiediCollaboratoreOperativo();
  if ("success" in collaboratore) {
    return collaboratore;
  }

  const clienteId = formData.get("clienteId") as string;
  const offertaId = formData.get("offertaId") as string;
  const oreRaw = formData.get("ore") as string;
  const nota = (formData.get("nota") as string) || null;
  const fatturabileRaw = formData.get("fatturabile");
  const dataStr = formData.get("data") as string;
  const trasfertaKmRaw = formData.get("trasfertaKm") as string | null;

  // Validazione campi obbligatori
  if (!clienteId || !offertaId || !oreRaw || !dataStr) {
    return { success: false, error: "Compila tutti i campi obbligatori" };
  }

  // Verifica offerta-cliente
  const erroreOfferta = await verificaOffertaCliente(offertaId, clienteId);
  if (erroreOfferta) return erroreOfferta;

  // Verifica abilitazione del collaboratore sull'offerta
  const erroreAbilitazione = await verificaAbilitazioneOfferta(collaboratore.id, offertaId);
  if (erroreAbilitazione) return erroreAbilitazione;

  // Validazione ore
  const risultatoOre = validaOre(oreRaw);
  if (!risultatoOre.valido) {
    return { success: false, error: risultatoOre.errore };
  }

  // Validazione trasferta km
  const validazioneKm = await validaTrasfertaKmServer(trasfertaKmRaw);
  if (!validazioneKm.success) {
    return { success: false, error: validazioneKm.error };
  }

  // Validazione data
  const matchData = /^\d{4}-\d{2}-\d{2}$/.exec(dataStr);
  if (!matchData) {
    return { success: false, error: "Data non valida" };
  }
  const [anno, mese, giorno] = dataStr.split("-").map(Number);
  // Mantiene il giorno civile anche quando server e database usano fusi diversi.
  const data = new Date(Date.UTC(anno, mese - 1, giorno, 12));

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
      trasfertaKm: validazioneKm.km ?? null,
    },
  });

  revalidatePath(`/attivita/${dataStr}`);
  revalidatePath("/attivita/riepilogo");
  revalidatePath("/attivita");

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
  const collaboratore = await richiediCollaboratoreOperativo();
  if ("success" in collaboratore) {
    return collaboratore;
  }

  const rigaId = formData.get("rigaId") as string;
  if (!rigaId) {
    return { success: false, error: "ID riga mancante" };
  }

  // Verifica proprietà
  const { errore: erroreProprietario, riga } = await caricaRigaDelCollaboratore(
    rigaId,
    collaboratore.id
  );
  if (erroreProprietario) return erroreProprietario;
  // caricaRigaDelCollaboratore garantisce `riga` valorizzato quando non c'è
  // errore; questo controllo esplicito restringe il tipo (niente `riga!`) e
  // resta robusto anche a refactoring futuri del contratto della funzione.
  if (!riga) {
    return { success: false, error: "Riga non trovata" };
  }

  // Costruisci i dati da aggiornare
  const updateData: Record<string, unknown> = {};

  const clienteId = formData.get("clienteId") as string;
  const offertaId = formData.get("offertaId") as string;

  if (clienteId) updateData.clienteId = clienteId;
  if (offertaId) updateData.offertaId = offertaId;

  // Valori risultanti dopo l'eventuale aggiornamento (quelli inviati dal form,
  // altrimenti quelli già presenti sulla riga).
  const offertaFinale = offertaId || riga.offertaId;
  const clienteFinale = clienteId || riga.clienteId;

  // Se la coppia offerta-cliente risultante differisce da quella attuale della
  // riga (perché è cambiata l'offerta, il cliente, o entrambi), verifica
  // sempre che l'offerta appartenga davvero al cliente indicato: il controllo
  // di coerenza non deve mai essere saltato solo perché l'offerta è rimasta
  // invariata. La verifica di ABILITAZIONE invece resta legata al solo
  // cambio di offerta: righe storiche su offerte non più abilitate restano
  // modificabili finché l'offerta non cambia (AC-4/AC-5).
  if (offertaFinale !== riga.offertaId || clienteFinale !== riga.clienteId) {
    const erroreOfferta = await verificaOffertaCliente(offertaFinale, clienteFinale);
    if (erroreOfferta) return erroreOfferta;

    if (offertaFinale !== riga.offertaId) {
      const erroreAbilitazione = await verificaAbilitazioneOfferta(
        collaboratore.id,
        offertaFinale
      );
      if (erroreAbilitazione) return erroreAbilitazione;
    }
  }

  const oreRaw = formData.get("ore") as string;
  if (oreRaw) {
    const risultatoOre = validaOre(oreRaw);
    if (!risultatoOre.valido) {
      return { success: false, error: risultatoOre.errore };
    }
    updateData.ore = risultatoOre.valore!;
  }

  // trasfertaKm: se il form contiene il campo
  if (formData.has("trasfertaKm")) {
    const trasfertaKmRaw = formData.get("trasfertaKm") as string | null;
    const validazioneKm = await validaTrasfertaKmServer(trasfertaKmRaw);
    if (!validazioneKm.success) {
      return { success: false, error: validazioneKm.error };
    }
    updateData.trasfertaKm = validazioneKm.km ?? null;
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
    updateData.data = new Date(Date.UTC(anno, mese - 1, giorno, 12));
  }

  await db.rigaAttivita.update({
    where: { id: rigaId },
    data: updateData,
  });

  revalidatePath(`/attivita/${dataStr}`);
  revalidatePath("/attivita/riepilogo");
  revalidatePath("/attivita");

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
  const collaboratore = await richiediCollaboratoreOperativo();
  if ("success" in collaboratore) {
    return collaboratore;
  }

  if (!rigaId) {
    return { success: false, error: "ID riga mancante" };
  }

  // Verifica proprietà
  const { errore: erroreProprietario } = await caricaRigaDelCollaboratore(
    rigaId,
    collaboratore.id
  );
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
  revalidatePath("/attivita/riepilogo");
  revalidatePath("/attivita");

  return { success: true };
}

/**
 * Rimuove la trasferta da una riga attività (imposta trasfertaKm a null).
 * Verifica che la riga appartenga al collaboratore corrente.
 *
 * @param rigaId - ID della riga da cui rimuovere la trasferta
 */
export async function rimuoviTrasferta(
  rigaId: string
): Promise<ActionResult> {
  const collaboratore = await richiediCollaboratoreOperativo();
  if ("success" in collaboratore) {
    return collaboratore;
  }

  if (!rigaId) {
    return { success: false, error: "ID riga mancante" };
  }

  // Verifica proprietà (riusa helper esistente)
  const { errore: erroreProprietario } = await caricaRigaDelCollaboratore(
    rigaId,
    collaboratore.id
  );
  if (erroreProprietario) return erroreProprietario;

  // Recupera la data della riga per il revalidate
  const riga = await db.rigaAttivita.findUnique({
    where: { id: rigaId },
    select: { data: true },
  });

  await db.rigaAttivita.update({
    where: { id: rigaId },
    data: { trasfertaKm: null },
  });

  if (riga) {
    const data = riga.data;
    const dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
    revalidatePath(`/attivita/${dataStr}`);
  }
  revalidatePath("/attivita/riepilogo");
  revalidatePath("/attivita");

  return { success: true };
}

/**
 * Server Action per recuperare le offerte attive di un cliente su cui il
 * collaboratore corrente è abilitato.
 * Chiamabile dal client per il cascade select cliente → offerta.
 */
export async function fetchOffertePerCliente(
  clienteId: string
): Promise<{ success: boolean; data?: { id: string; codice: string; descrizione: string }[]; error?: string }> {
  const collaboratore = await richiediCollaboratoreOperativo();
  if ("success" in collaboratore) {
    return collaboratore;
  }

  try {
    const offerte = await offerteAbilitatePerCliente(clienteId);
    return { success: true, data: offerte };
  } catch {
    return { success: false, error: "Errore nel recupero delle offerte" };
  }
}
