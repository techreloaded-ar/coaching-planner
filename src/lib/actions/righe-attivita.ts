"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  ErroreAutorizzazione,
  risolviProfiloCollaboratoreCorrente,
  type StatoProfiloCollaboratore,
} from "@/lib/dal";
import {
  MESSAGGIO_FOGLIO_SOLA_LETTURA,
  risolviCollaboratoreConsultato,
} from "@/lib/foglio-attivita";
import type { Collaboratore, RigaAttivita } from "@/generated/prisma/client";
import { validaOre } from "@/domain/consuntivi";
import {
  CATEGORIA_ATTIVITA_PREDEFINITA,
  isCategoriaAttivita,
} from "@/domain/types";

// ── Tipi ────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Dati della riga di origine necessari ai controlli di ammissibilità e alla
 * duplicazione: oltre alla coppia offerta/cliente include tutto il contenuto
 * replicabile su un altro giorno, compresa la fotografia del rimborso trasferta
 * già congelata sulla riga.
 */
type DatiRigaDiOrigine = Pick<
  RigaAttivita,
  | "offertaId"
  | "clienteId"
  | "data"
  | "ore"
  | "nota"
  | "categoria"
  | "rimborsoTrasfertaEtichetta"
  | "rimborsoTrasfertaImporto"
>;

// ── Helpers ─────────────────────────────────────────────────────

function messaggioProfiloNonDisponibile(
  profilo: Exclude<StatoProfiloCollaboratore, { stato: "ATTIVO" }>
): string {
  return profilo.stato === "ASSENTE"
    ? "Il tuo account non ha un profilo Collaboratore. Richiedi il censimento nell'Anagrafica collaboratori."
    : "Il tuo profilo Collaboratore è disattivato. Chiedi a un amministratore di riattivarlo.";
}

/**
 * Restituisce il collaboratore attivo del foglio su cui si scrive.
 *
 * Senza `collaboratoreIdConsultato` è il profilo corrente attivo, senza
 * fallback. Con l'id è il collaboratore il cui foglio un amministratore sta
 * modificando: valgono le stesse regole del suo proprietario, e un
 * collaboratore disattivato resta in sola lettura.
 */
async function richiediCollaboratoreOperativo(
  collaboratoreIdConsultato?: string | null
): Promise<Collaboratore | ActionResult> {
  if (collaboratoreIdConsultato) {
    return richiediCollaboratoreConsultatoModificabile(collaboratoreIdConsultato);
  }

  const profilo = await risolviProfiloCollaboratoreCorrente();

  if (profilo.stato === "ATTIVO") {
    return profilo.collaboratore;
  }

  return { success: false, error: messaggioProfiloNonDisponibile(profilo) };
}

async function richiediCollaboratoreConsultatoModificabile(
  collaboratoreId: string
): Promise<Collaboratore | ActionResult> {
  let collaboratore: Collaboratore | null;
  try {
    collaboratore = await risolviCollaboratoreConsultato(collaboratoreId);
  } catch (errore) {
    if (errore instanceof ErroreAutorizzazione) {
      return { success: false, error: errore.message };
    }
    throw errore;
  }

  if (!collaboratore) {
    return { success: false, error: "Collaboratore non trovato" };
  }

  if (!collaboratore.attivo) {
    return { success: false, error: MESSAGGIO_FOGLIO_SOLA_LETTURA };
  }

  return collaboratore;
}

/**
 * Verifica che la riga appartenga al collaboratore corrente e ne restituisce
 * il contenuto (coppia offerta/cliente più i campi replicabili) per i
 * controlli successivi e per la duplicazione.
 */
async function caricaRigaDelCollaboratore(
  rigaId: string,
  collaboratoreId: string
): Promise<{ errore: ActionResult | null; riga?: DatiRigaDiOrigine }> {
  const riga = await db.rigaAttivita.findUnique({
    where: { id: rigaId },
    select: {
      collaboratoreId: true,
      offertaId: true,
      clienteId: true,
      data: true,
      ore: true,
      nota: true,
      categoria: true,
      rimborsoTrasfertaEtichetta: true,
      rimborsoTrasfertaImporto: true,
    },
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
    riga: {
      offertaId: riga.offertaId,
      clienteId: riga.clienteId,
      data: riga.data,
      ore: riga.ore,
      nota: riga.nota,
      categoria: riga.categoria,
      rimborsoTrasfertaEtichetta: riga.rimborsoTrasfertaEtichetta,
      rimborsoTrasfertaImporto: riga.rimborsoTrasfertaImporto,
    },
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
 * Verifica che il cliente esista e sia attivo: è l'unico vincolo di una riga
 * senza offerta, perché ogni cliente attivo è selezionabile.
 * Restituisce null se ok, altrimenti un ActionResult con errore.
 */
async function verificaClienteAttivo(
  clienteId: string
): Promise<ActionResult | null> {
  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { attivo: true },
  });

  if (!cliente) {
    return { success: false, error: "Cliente non trovato" };
  }

  if (!cliente.attivo) {
    return { success: false, error: "Il cliente non è più attivo" };
  }

  return null;
}

/**
 * Verifica l'ammissibilità di una coppia cliente/offerta per una riga nuova:
 * con offerta valgono le regole dell'offerta (attiva, del cliente, abilitata),
 * senza offerta basta un cliente attivo.
 */
async function verificaClienteEOffertaPerNuovaRiga(
  collaboratoreId: string,
  clienteId: string,
  offertaId: string | null
): Promise<ActionResult | null> {
  if (!offertaId) {
    return verificaClienteAttivo(clienteId);
  }

  const erroreOfferta = await verificaOffertaCliente(offertaId, clienteId);
  if (erroreOfferta) return erroreOfferta;

  return verificaAbilitazioneOfferta(collaboratoreId, offertaId);
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

/**
 * Formatta come token `YYYY-MM-DD` il giorno civile di una riga già salvata.
 *
 * Usa i getter UTC di proposito: la colonna è `@db.Date`, Prisma la restituisce
 * a mezzanotte UTC e `creaRiga` la scrive a mezzogiorno UTC. I getter locali
 * sposterebbero il giorno indietro nei fusi a offset negativo.
 */
function giornoDellaRiga(data: Date): string {
  const anno = data.getUTCFullYear();
  const mese = String(data.getUTCMonth() + 1).padStart(2, "0");
  const giorno = String(data.getUTCDate()).padStart(2, "0");
  return `${anno}-${mese}-${giorno}`;
}

/**
 * Normalizza i giorni di destinazione della duplicazione: valida il formato,
 * deduplica, esclude il giorno di origine e ordina in modo crescente.
 *
 * Il giorno di origine non è un errore ma un no-op da scartare: la selezione
 * lato client lo esclude già, questa è la difesa server-side.
 */
function normalizzaGiorniDestinazione(
  giorni: string[] | undefined,
  giornoOrigine: string
): { errore: ActionResult | null; giorni?: string[] } {
  if (!Array.isArray(giorni) || giorni.length === 0) {
    return {
      errore: { success: false, error: "Scegli almeno un giorno di destinazione" },
    };
  }

  const giorniPuliti = giorni.map((giorno) => giorno.trim());

  if (giorniPuliti.some((giorno) => !/^\d{4}-\d{2}-\d{2}$/.test(giorno))) {
    return { errore: { success: false, error: "Data non valida" } };
  }

  const giorniDistinti = [...new Set(giorniPuliti)].filter(
    (giorno) => giorno !== giornoOrigine
  );

  if (giorniDistinti.length === 0) {
    return {
      errore: {
        success: false,
        error: "Scegli almeno un giorno di destinazione diverso da quello di origine",
      },
    };
  }

  return { errore: null, giorni: giorniDistinti.sort() };
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
 * - collaboratoreConsultatoId? quando un amministratore scrive sul foglio di
 *   un altro collaboratore (vedi `richiediCollaboratoreOperativo`)
 * - clienteId, ore, nota, data (YYYY-MM-DD)
 * - offertaId? facoltativa: vuota = offerta da definire
 * - categoria? (FATTURABILE | NON_FATTURABILE | INVESTIMENTO), predefinita FATTURABILE
 * - eventoCalendarioId? quando la riga nasce da una proposta del calendario:
 *   l'evento viene segnato come gestito nella stessa transazione, così non
 *   viene più proposto
 */
export async function creaRiga(
  formData: FormData
): Promise<ActionResult> {
  const collaboratore = await richiediCollaboratoreOperativo(
    formData.get("collaboratoreConsultatoId") as string | null
  );
  if ("success" in collaboratore) {
    return collaboratore;
  }

  const clienteId = formData.get("clienteId") as string;
  const offertaId = (formData.get("offertaId") as string | null) || null;
  const oreRaw = formData.get("ore") as string;
  const nota = (formData.get("nota") as string) || null;
  const categoria =
    formData.get("categoria") ?? CATEGORIA_ATTIVITA_PREDEFINITA;
  const dataStr = formData.get("data") as string;
  const voceRimborsoTrasfertaIdRaw = formData.get("voceRimborsoTrasfertaId") as
    | string
    | null;
  const eventoCalendarioId =
    (formData.get("eventoCalendarioId") as string | null)?.trim() || null;

  // Validazione campi obbligatori
  if (!clienteId || !oreRaw || !dataStr) {
    return { success: false, error: "Compila tutti i campi obbligatori" };
  }

  const erroreAmmissibilita = await verificaClienteEOffertaPerNuovaRiga(
    collaboratore.id,
    clienteId,
    offertaId
  );
  if (erroreAmmissibilita) return erroreAmmissibilita;

  // Validazione ore
  const risultatoOre = validaOre(oreRaw);
  if (!risultatoOre.valido) {
    return { success: false, error: risultatoOre.errore };
  }

  if (!isCategoriaAttivita(categoria)) {
    return { success: false, error: "Categoria attività non valida" };
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

  const creazioneRiga = db.rigaAttivita.create({
    data: {
      collaboratoreId: collaboratore.id,
      clienteId,
      offertaId,
      data,
      ore: risultatoOre.valore!,
      nota,
      categoria,
      rimborsoTrasfertaEtichetta: fotografiaRimborso.etichetta ?? null,
      rimborsoTrasfertaImporto: fotografiaRimborso.importo ?? null,
    },
  });

  if (eventoCalendarioId) {
    // Senza skipDuplicates: una seconda conferma dello stesso evento (per
    // esempio da un'altra scheda) viola l'unicità e annulla la transazione,
    // così non nasce una riga duplicata.
    try {
      await db.$transaction([
        creazioneRiga,
        db.eventoCalendarioGestito.create({
          data: { collaboratoreId: collaboratore.id, eventoCalendarioId },
        }),
      ]);
    } catch (errore) {
      if ((errore as { code?: string })?.code === "P2002") {
        return { success: false, error: "Questo impegno del calendario è già stato registrato" };
      }
      throw errore;
    }
  } else {
    await creazioneRiga;
  }

  revalidatePath(`/attivita/${dataStr}`);
  revalidatePath("/attivita/riepilogo");
  revalidatePath("/attivita");

  return { success: true };
}

/**
 * Modifica una riga attività esistente.
 *
 * Campi attesi nel FormData:
 * - collaboratoreConsultatoId? come in `creaRiga`
 * - rigaId, clienteId?, offertaId?, ore?, nota?, categoria?, data?
 * - offertaId presente ma vuota = offerta da definire; assente = invariata
 */
export async function modificaRiga(
  formData: FormData
): Promise<ActionResult> {
  const collaboratore = await richiediCollaboratoreOperativo(
    formData.get("collaboratoreConsultatoId") as string | null
  );
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
  const offertaId = formData.has("offertaId")
    ? (formData.get("offertaId") as string) || null
    : undefined;

  if (clienteId) updateData.clienteId = clienteId;
  if (offertaId !== undefined) updateData.offertaId = offertaId;

  // Valori risultanti dopo l'eventuale aggiornamento (quelli inviati dal form,
  // altrimenti quelli già presenti sulla riga).
  const offertaFinale = offertaId === undefined ? riga.offertaId : offertaId;
  const clienteFinale = clienteId || riga.clienteId;

  // Se la coppia offerta-cliente risultante differisce da quella attuale della
  // riga (perché è cambiata l'offerta, il cliente, o entrambi), verifica
  // sempre che l'offerta appartenga davvero al cliente indicato: il controllo
  // di coerenza non deve mai essere saltato solo perché l'offerta è rimasta
  // invariata. La verifica di ABILITAZIONE invece resta legata al solo
  // cambio di offerta: righe storiche su offerte non più abilitate restano
  // modificabili finché l'offerta non cambia (AC-4/AC-5).
  // Senza offerta l'unico vincolo è che il cliente, se cambiato, sia attivo.
  if (offertaFinale === null) {
    if (clienteFinale !== riga.clienteId) {
      const erroreCliente = await verificaClienteAttivo(clienteFinale);
      if (erroreCliente) return erroreCliente;
    }
  } else if (offertaFinale !== riga.offertaId || clienteFinale !== riga.clienteId) {
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

  if (formData.has("categoria")) {
    const categoria = formData.get("categoria");
    if (!isCategoriaAttivita(categoria)) {
      return { success: false, error: "Categoria attività non valida" };
    }
    updateData.categoria = categoria;
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
  rigaId: string,
  collaboratoreConsultatoId?: string | null
): Promise<ActionResult> {
  const collaboratore = await richiediCollaboratoreOperativo(
    collaboratoreConsultatoId
  );
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
  rigaId: string,
  collaboratoreConsultatoId?: string | null
): Promise<ActionResult> {
  const collaboratore = await richiediCollaboratoreOperativo(
    collaboratoreConsultatoId
  );
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
 * Duplica una riga attività già salvata su uno o più giorni scelti.
 *
 * Il rimborso trasferta viene **propagato** dalla riga di origine, cioè copiato
 * dalla fotografia già congelata su di essa: il catalogo corrente delle voci non
 * viene mai riletto, quindi una duplicazione non può reintrodurre importi
 * cambiati dopo il salvataggio della riga sorgente.
 *
 * L'ammissibilità applicata è quella della **creazione** (offerta attiva,
 * coerente col cliente e abilitata per il collaboratore, oppure cliente
 * attivo per una riga con offerta da definire), non quella più
 * clemente di `modificaRiga`: qui non si aggiorna una riga storica, si creano
 * righe nuove, che devono rispettare le regole valide oggi.
 *
 * La scrittura è unica e atomica: o tutti i giorni ammessi ricevono la copia,
 * o non viene creata alcuna riga.
 *
 * @param rigaId - ID della riga di origine
 * @param giorni - giorni di destinazione in formato `YYYY-MM-DD`
 */
export async function duplicaRigaSuGiorni(
  rigaId: string,
  giorni: string[],
  collaboratoreConsultatoId?: string | null
): Promise<ActionResult & { giorniCreati?: number }> {
  const collaboratore = await richiediCollaboratoreOperativo(
    collaboratoreConsultatoId
  );
  if ("success" in collaboratore) {
    return collaboratore;
  }

  if (!rigaId) {
    return { success: false, error: "ID riga mancante" };
  }

  // Verifica proprietà e recupero del contenuto da replicare
  const { errore: erroreProprietario, riga } = await caricaRigaDelCollaboratore(
    rigaId,
    collaboratore.id
  );
  if (erroreProprietario) return erroreProprietario;
  // Restringimento di tipo esplicito, come in `modificaRiga`.
  if (!riga) {
    return { success: false, error: "Riga non trovata" };
  }

  const { errore: erroreGiorni, giorni: giorniDestinazione } =
    normalizzaGiorniDestinazione(giorni, giornoDellaRiga(riga.data));
  if (erroreGiorni) return erroreGiorni;
  if (!giorniDestinazione) {
    return { success: false, error: "Scegli almeno un giorno di destinazione" };
  }

  // Riverifica dell'ammissibilità sulla coppia cliente/offerta di origine
  const erroreAmmissibilita = await verificaClienteEOffertaPerNuovaRiga(
    collaboratore.id,
    riga.clienteId,
    riga.offertaId
  );
  if (erroreAmmissibilita) return erroreAmmissibilita;

  await db.rigaAttivita.createMany({
    data: giorniDestinazione.map((giornoDestinazione) => {
      const [anno, mese, giorno] = giornoDestinazione.split("-").map(Number);
      return {
        collaboratoreId: collaboratore.id,
        clienteId: riga.clienteId,
        offertaId: riga.offertaId,
        // Mantiene il giorno civile anche quando server e database usano fusi
        // diversi, esattamente come in `creaRiga`.
        data: new Date(Date.UTC(anno, mese - 1, giorno, 12)),
        ore: riga.ore,
        nota: riga.nota,
        categoria: riga.categoria,
        rimborsoTrasfertaEtichetta: riga.rimborsoTrasfertaEtichetta,
        rimborsoTrasfertaImporto: riga.rimborsoTrasfertaImporto,
      };
    }),
  });

  for (const giornoDestinazione of giorniDestinazione) {
    revalidatePath(`/attivita/${giornoDestinazione}`);
  }
  revalidatePath("/attivita/riepilogo");
  revalidatePath("/attivita");

  return { success: true, giorniCreati: giorniDestinazione.length };
}

// Il cascade select cliente → offerta non passa più da una Server Action: la
// lettura vive in `GET /api/attivita/offerte-cliente`. La risposta di una
// Server Action riconcilia l'albero RSC del router con l'URL corrente e, dopo
// un cambio giorno scritto con la History API dall'isola della giornata, quella
// riconciliazione rimonta la pagina azzerando il form in compilazione.
