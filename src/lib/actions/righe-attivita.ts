"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  risolviProfiloCollaboratoreCorrente,
  type StatoProfiloCollaboratore,
} from "@/lib/dal";
import type { Collaboratore } from "@/generated/prisma/client";
import { validaOre } from "@/domain/consuntivi";
import { offerteAbilitatePerCliente } from "@/lib/attivita";

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
 * Fotografa etichetta e importo correnti della voce di rimborso selezionata.
 *
 * La riga conserva una copia dei valori al momento del salvataggio: modifiche
 * successive al catalogo delle voci non devono alterare le righe già salvate.
 * - selezione assente/vuota => nessun rimborso sulla riga
 * - voce inesistente => errore
 */
async function fotografaVoceRimborsoTrasferta(
  voceIdRaw: string | null
): Promise<ActionResult & { etichetta?: string | null; importo?: string | null }> {
  if (!voceIdRaw || voceIdRaw.trim() === "") {
    return { success: true, etichetta: null, importo: null };
  }

  const voce = await db.voceRimborsoTrasferta.findUnique({
    where: { id: voceIdRaw },
  });

  if (!voce) {
    return {
      success: false,
      error: "La voce di rimborso selezionata non è più disponibile",
    };
  }

  return {
    success: true,
    etichetta: voce.etichetta,
    importo: voce.importo.toString(),
  };
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
  const voceRimborsoTrasfertaIdRaw = formData.get("voceRimborsoTrasfertaId") as
    | string
    | null;

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

  // Fotografia della voce di rimborso trasferta selezionata
  const fotografiaRimborso = await fotografaVoceRimborsoTrasferta(
    voceRimborsoTrasfertaIdRaw
  );
  if (!fotografiaRimborso.success) {
    return { success: false, error: fotografiaRimborso.error };
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
      rimborsoTrasfertaEtichetta: fotografiaRimborso.etichetta ?? null,
      rimborsoTrasfertaImporto: fotografiaRimborso.importo ?? null,
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

  // Rimborso trasferta: solo se il form contiene la selezione. Se il campo è
  // assente il rimborso già fotografato sulla riga resta invariato.
  if (formData.has("voceRimborsoTrasfertaId")) {
    const voceRimborsoTrasfertaIdRaw = formData.get("voceRimborsoTrasfertaId") as
      | string
      | null;
    const fotografiaRimborso = await fotografaVoceRimborsoTrasferta(
      voceRimborsoTrasfertaIdRaw
    );
    if (!fotografiaRimborso.success) {
      return { success: false, error: fotografiaRimborso.error };
    }
    updateData.rimborsoTrasfertaEtichetta = fotografiaRimborso.etichetta ?? null;
    updateData.rimborsoTrasfertaImporto = fotografiaRimborso.importo ?? null;
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
 * Rimuove il rimborso trasferta fotografato su una riga attività.
 * Verifica che la riga appartenga al collaboratore corrente.
 *
 * @param rigaId - ID della riga da cui rimuovere il rimborso
 */
export async function rimuoviRimborsoTrasferta(
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
    data: { rimborsoTrasfertaEtichetta: null, rimborsoTrasfertaImporto: null },
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
