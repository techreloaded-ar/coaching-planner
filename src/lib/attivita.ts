import "server-only";

import { db } from "@/lib/db";
import { richiediCollaboratoreCorrente, ErroreAutorizzazione } from "@/lib/dal";
import { parseDataGiorno, parseTokenMese } from "@/domain/calendario";
import type { RigaAttivita, Offerta, Cliente } from "@/generated/prisma/client";
import type {
  ClienteSelect,
  ContestoInserimentoGiornata,
  DatiCalendarioMese,
  DatiGiornataAttivita,
  RigaAttivitaClient,
  SintesiClienteGiorno,
  SintesiGiorno,
  VoceRimborsoTrasfertaSelezionabile,
} from "@/lib/attivita-contract";
import {
  calcolaRiepilogoMese,
  type RigaRiepilogo,
  type VoceRiepilogoOfferta,
  type TotaliRiepilogoMese,
  type BreakdownRiepilogoMese,
} from "@/domain/consuntivi";

// ── Tipi ────────────────────────────────────────────────────────

/** Riga attività arricchita con offerta e cliente */
export interface RigaAttivitaConContesto extends RigaAttivita {
  offerta: Offerta;
  cliente: Cliente;
}

// Le sintesi del calendario vivono in `@/lib/attivita-contract`, perché sono
// condivise con il client e con il route handler. Qui restano ri-esportate per
// non spezzare gli import esistenti dei consumatori server.
export type { SintesiClienteGiorno, SintesiGiorno };

/** Risultato completo del mese */
export interface AttivitaMese {
  /** Mappatura data YYYY-MM-DD → sintesi */
  perGiorno: Map<string, SintesiGiorno>;
  /** Righe complete del mese (con offerta e cliente) */
  righe: RigaAttivitaConContesto[];
}

/** Risultato serializzabile del riepilogo mensile */
export interface RisultatoRiepilogoMese {
  token: string;
  perOfferta: VoceRiepilogoOfferta[];
  totali: TotaliRiepilogoMese;
  importoFattura: string;
  breakdown: BreakdownRiepilogoMese;
  tariffaGiornaliera: string;
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Formatta una Date in stringa YYYY-MM-DD.
 */
function formattaDataISO(data: Date): string {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const g = String(data.getDate()).padStart(2, "0");
  return `${a}-${m}-${g}`;
}

/** Riga minima necessaria all'aggregazione giornaliera del calendario. */
interface RigaPerSintesiGiornaliera {
  data: Date;
  ore: unknown;
  cliente: { id: string; ragioneSociale: string };
}

/**
 * Aggrega per giorno le righe di un mese già ordinate per data e creazione.
 *
 * Somma le ore per cliente su più offerte e preserva l'ordine di prima
 * apparizione del cliente nel giorno. Condivisa da `attivitaDelMese` e dalla
 * lettura specializzata del calendario, così le due non possono divergere.
 */
function aggregaSintesiPerGiorno(
  righe: readonly RigaPerSintesiGiornaliera[]
): Map<string, SintesiGiorno> {
  const perGiorno = new Map<string, SintesiGiorno>();

  for (const riga of righe) {
    const chiave = formattaDataISO(riga.data);
    const ore = Number(riga.ore);
    const esistente = perGiorno.get(chiave);

    if (!esistente) {
      perGiorno.set(chiave, {
        data: chiave,
        righe: 1,
        oreTotali: ore,
        clienti: [
          {
            clienteId: riga.cliente.id,
            ragioneSociale: riga.cliente.ragioneSociale,
            ore,
          },
        ],
      });
      continue;
    }

    esistente.righe += 1;
    esistente.oreTotali += ore;

    const sintesiCliente = esistente.clienti.find(
      (c) => c.clienteId === riga.cliente.id
    );
    if (sintesiCliente) {
      sintesiCliente.ore += ore;
    } else {
      esistente.clienti.push({
        clienteId: riga.cliente.id,
        ragioneSociale: riga.cliente.ragioneSociale,
        ore,
      });
    }
  }

  return perGiorno;
}

/** Estremi half-open del mese: `[primo del mese, primo del mese successivo)`. */
function intervalloMese(anno: number, mese: number): { inizio: Date; fine: Date } {
  return {
    inizio: new Date(anno, mese - 1, 1),
    fine: new Date(anno, mese, 1),
  };
}

// ── API pubblica ────────────────────────────────────────────────

/**
 * Recupera le righe attività del collaboratore corrente per un intero mese.
 *
 * Risolve il collaboratore via `richiediCollaboratoreCorrente()`:
 * - Se l'utente non è autenticato, lancia ErroreAutorizzazione(401)
 * - Se l'utente non ha un profilo Collaboratore, restituisce un risultato vuoto
 *
 * Le righe sono ordinate per data crescente e, a parità di data, per data di
 * creazione crescente; includono offerta e cliente. L'aggregazione per giorno
 * produce una sintesi con numero di righe, ore totali e sintesi per cliente
 * (ore sommate su più offerte, in ordine di prima apparizione nel giorno).
 *
 * @param token - Token YYYY-MM del mese
 * @returns AttivitaMese con righe complete e aggregazione per giorno
 */
export async function attivitaDelMese(token: string): Promise<AttivitaMese> {
  const parsed = parseTokenMese(token);
  if (!parsed) {
    return { perGiorno: new Map(), righe: [] };
  }

  const collaboratore = await richiediCollaboratoreCorrente();
  if (!collaboratore) {
    return { perGiorno: new Map(), righe: [] };
  }

  const { anno, mese } = parsed;

  // Intervallo del mese: dal primo all'ultimo giorno
  const inizio = new Date(anno, mese - 1, 1);
  const fine = new Date(anno, mese, 0); // giorno 0 del mese successivo = ultimo del corrente

  const righe = await db.rigaAttivita.findMany({
    where: {
      collaboratoreId: collaboratore.id,
      data: {
        gte: inizio,
        lte: fine,
      },
    },
    include: {
      offerta: true,
      cliente: true,
    },
    orderBy: [{ data: "asc" }, { createdAt: "asc" }],
  });

  return { perGiorno: aggregaSintesiPerGiorno(righe), righe };
}

/**
 * Lettura specializzata del calendario mensile per un collaboratore **già
 * autorizzato**.
 *
 * A differenza di `attivitaDelMese`, questa funzione non risolve sessione né
 * profilo: riceve l'id del collaboratore da chi ha già effettuato il controllo
 * (pagina RSC o route handler), evitando di ripetere la catena
 * sessione → profilo dentro la query.
 *
 * **Contratto di sicurezza:** l'id deve provenire esclusivamente dal DAL, mai
 * da search params, body o header. Il chiamante è responsabile
 * dell'autorizzazione; questa funzione è una lettura, non una guardia.
 *
 * Seleziona il minimo necessario alla griglia (`data`, `ore`, `createdAt` e
 * `cliente { id, ragioneSociale }`), usa un intervallo half-open sul mese e
 * ordina per data e creazione, così l'ordine di prima apparizione dei clienti
 * nel giorno è deterministico.
 *
 * @param token - Token YYYY-MM del mese
 * @param collaboratoreId - Id del collaboratore già autorizzato dal chiamante
 * @returns DTO serializzabile del mese; token non valido ⇒ mese vuoto
 */
export async function datiCalendarioMesePerCollaboratoreAutorizzato(
  token: string,
  collaboratoreId: string
): Promise<DatiCalendarioMese> {
  const parsed = parseTokenMese(token);
  if (!parsed) {
    return { token, collaboratoreId, sintesiPerGiorno: {} };
  }

  const { inizio, fine } = intervalloMese(parsed.anno, parsed.mese);

  const righe = await db.rigaAttivita.findMany({
    where: {
      collaboratoreId,
      data: {
        gte: inizio,
        lt: fine,
      },
    },
    select: {
      data: true,
      ore: true,
      createdAt: true,
      cliente: {
        select: {
          id: true,
          ragioneSociale: true,
        },
      },
    },
    orderBy: [{ data: "asc" }, { createdAt: "asc" }],
  });

  return {
    token,
    collaboratoreId,
    sintesiPerGiorno: Object.fromEntries(aggregaSintesiPerGiorno(righe)),
  };
}

/**
 * Lettura della giornata di attività per un collaboratore **già autorizzato**.
 *
 * Come `datiCalendarioMesePerCollaboratoreAutorizzato`, non risolve sessione né
 * profilo: riceve l'id del collaboratore da chi ha già effettuato il controllo
 * (pagina RSC o route handler).
 *
 * **Contratto di sicurezza:** l'id deve provenire esclusivamente dal DAL, mai
 * da search params, body o header. Il chiamante è responsabile
 * dell'autorizzazione; questa funzione è una lettura, non una guardia.
 *
 * Su data non nel formato `YYYY-MM-DD`, o su data inesistente nel calendario,
 * restituisce il DTO con righe vuote senza interrogare il database: è lo stesso
 * esito della lettura mensile su token non valido, e **non** è una guardia di
 * autorizzazione.
 *
 * La serializzazione delle righe vive qui e in un solo punto, così rendering
 * server ed endpoint HTTP non possono divergere.
 *
 * @param dataStr - Data in formato YYYY-MM-DD
 * @param collaboratoreId - Id del collaboratore già autorizzato dal chiamante
 * @returns DTO serializzabile della giornata; data non valida ⇒ giornata vuota
 */
export async function righeDelGiornoPerCollaboratoreAutorizzato(
  dataStr: string,
  collaboratoreId: string
): Promise<DatiGiornataAttivita> {
  const parsed = parseDataGiorno(dataStr);
  if (!parsed) {
    return { data: dataStr, collaboratoreId, righe: [] };
  }

  const { anno, mese, giorno } = parsed;
  const inizio = new Date(anno, mese - 1, giorno);
  const fine = new Date(anno, mese - 1, giorno, 23, 59, 59, 999);

  const righe = await db.rigaAttivita.findMany({
    where: {
      collaboratoreId,
      data: {
        gte: inizio,
        lte: fine,
      },
    },
    include: {
      offerta: true,
      cliente: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    data: dataStr,
    collaboratoreId,
    righe: righe.map(serializzaRigaAttivita),
  };
}

/** Serializza una riga attività per il client (Date → string, Decimal → number/string). */
function serializzaRigaAttivita(
  riga: RigaAttivitaConContesto
): RigaAttivitaClient {
  return {
    id: riga.id,
    data: formattaDataISO(riga.data),
    ore: Number(riga.ore),
    nota: riga.nota,
    fatturabile: riga.fatturabile,
    rimborsoTrasfertaEtichetta: riga.rimborsoTrasfertaEtichetta,
    rimborsoTrasfertaImporto: riga.rimborsoTrasfertaImporto?.toString() ?? null,
    offerta: {
      id: riga.offerta.id,
      codice: riga.offerta.codice,
      descrizione: riga.offerta.descrizione,
    },
    cliente: {
      id: riga.cliente.id,
      ragioneSociale: riga.cliente.ragioneSociale,
    },
  };
}

/**
 * Lettura del contesto di inserimento per un collaboratore **già autorizzato**.
 *
 * Raccoglie in un solo DTO i dati che popolano il form riga attività e che sono
 * invarianti rispetto al giorno: clienti selezionabili e voci di rimborso
 * trasferta. Le due letture vengono eseguite in parallelo.
 *
 * **Contratto di sicurezza:** vale lo stesso contratto di
 * `righeDelGiornoPerCollaboratoreAutorizzato`: l'id deve provenire dal DAL e
 * l'autorizzazione è responsabilità del chiamante.
 *
 * @param collaboratoreId - Id del collaboratore già autorizzato dal chiamante
 * @returns DTO serializzabile del contesto di inserimento
 */
export async function contestoInserimentoPerCollaboratoreAutorizzato(
  collaboratoreId: string
): Promise<ContestoInserimentoGiornata> {
  const [clienti, vociRimborso] = await Promise.all([
    leggiClientiAttiviPerSelezione(collaboratoreId),
    leggiVociRimborsoTrasfertaPerSelezione(),
  ]);

  return { collaboratoreId, clienti, vociRimborso };
}

/**
 * Restituisce i clienti attivi su cui il collaboratore corrente ha almeno
 * un'offerta attiva abilitata, per la select del form attività (US-049).
 *
 * Accessibile al collaboratore autenticato (a differenza di src/lib/clienti.ts
 * che è admin-only). Lancia ErroreAutorizzazione se non autenticato o se non
 * è un collaboratore.
 *
 * @returns Lista clienti attivi e abilitati con id e ragione sociale, ordinati per ragione sociale
 */
export async function clientiAttiviPerSelezione(): Promise<ClienteSelect[]> {
  const collaboratore = await richiediCollaboratoreCorrente();
  if (!collaboratore) {
    throw new ErroreAutorizzazione(
      401,
      "Devi essere un collaboratore per visualizzare i clienti"
    );
  }

  return leggiClientiAttiviPerSelezione(collaboratore.id);
}

/**
 * Query dei clienti selezionabili, senza guardia di autorizzazione.
 *
 * Condivisa da `clientiAttiviPerSelezione`, che risolve il collaboratore dalla
 * sessione, e da `contestoInserimentoPerCollaboratoreAutorizzato`, che riceve
 * un id già autorizzato dal chiamante: le due non possono divergere.
 */
function leggiClientiAttiviPerSelezione(
  collaboratoreId: string
): Promise<ClienteSelect[]> {
  return db.cliente.findMany({
    where: {
      attivo: true,
      offerte: {
        some: {
          attiva: true,
          abilitazioniCollaboratori: {
            some: { collaboratoreId },
          },
        },
      },
    },
    select: {
      id: true,
      ragioneSociale: true,
    },
    orderBy: { ragioneSociale: "asc" },
  });
}

/**
 * Restituisce le offerte attive del cliente su cui il collaboratore corrente
 * è abilitato.
 *
 * Accessibile al collaboratore autenticato. Lancia ErroreAutorizzazione
 * se non autenticato o se non è un collaboratore.
 *
 * @param clienteId - ID del cliente di cui recuperare le offerte attive
 * @returns Lista offerte attive e abilitate con id, codice e descrizione, ordinate per codice
 */
export async function offerteAbilitatePerCliente(
  clienteId: string
): Promise<{ id: string; codice: string; descrizione: string }[]> {
  const collaboratore = await richiediCollaboratoreCorrente();
  if (!collaboratore) {
    throw new ErroreAutorizzazione(
      401,
      "Devi essere un collaboratore per visualizzare le offerte"
    );
  }

  return db.offerta.findMany({
    where: {
      clienteId,
      attiva: true,
      abilitazioniCollaboratori: { some: { collaboratoreId: collaboratore.id } },
    },
    select: {
      id: true,
      codice: true,
      descrizione: true,
    },
    orderBy: { codice: "asc" },
  });
}

/**
 * Restituisce le voci di rimborso trasferta selezionabili dal collaboratore.
 *
 * Accessibile al collaboratore autenticato (a differenza dell'area back-office
 * che è admin-only). Lancia ErroreAutorizzazione se non autenticato o se non
 * è un collaboratore.
 *
 * @returns Voci ordinate per data di creazione crescente
 */
export async function vociRimborsoTrasfertaPerSelezione(): Promise<
  VoceRimborsoTrasfertaSelezionabile[]
> {
  const collaboratore = await richiediCollaboratoreCorrente();
  if (!collaboratore) {
    throw new ErroreAutorizzazione(
      401,
      "Devi essere un collaboratore per visualizzare le voci di rimborso"
    );
  }

  return leggiVociRimborsoTrasfertaPerSelezione();
}

/**
 * Query delle voci di rimborso selezionabili, senza guardia di autorizzazione.
 *
 * Le voci non dipendono dal collaboratore: la guardia resta nella funzione
 * esportata, mentre questa è condivisa con
 * `contestoInserimentoPerCollaboratoreAutorizzato`.
 */
async function leggiVociRimborsoTrasfertaPerSelezione(): Promise<
  VoceRimborsoTrasfertaSelezionabile[]
> {
  const voci = await db.voceRimborsoTrasferta.findMany({
    orderBy: { createdAt: "asc" },
  });

  return voci.map((voce) => ({
    id: voce.id,
    etichetta: voce.etichetta,
    importo: voce.importo.toString(),
  }));
}

function creaRiepilogoVuoto(token: string, tariffaGiornaliera = "0.00"): RisultatoRiepilogoMese {
  return {
    token,
    perOfferta: [],
    totali: {
      oreTotali: 0,
      oreFatturabili: 0,
      giornateTotali: 0,
      giornateFatturabili: 0,
      totaleRimborsi: "0.00",
    },
    importoFattura: "0.00",
    breakdown: {
      giornateFatturabili: "0.00",
      tariffaGiornaliera,
      imponibileManodopera: "0.00",
      totaleRimborsi: "0.00",
    },
    tariffaGiornaliera,
  };
}

/**
 * Restituisce il riepilogo mensile del collaboratore corrente pronto per il client.
 */
export async function riepilogoMese(token: string): Promise<RisultatoRiepilogoMese> {
  const parsed = parseTokenMese(token);
  if (!parsed) {
    return creaRiepilogoVuoto(token);
  }

  const collaboratore = await richiediCollaboratoreCorrente();
  if (!collaboratore) {
    return creaRiepilogoVuoto(token);
  }

  const { anno, mese } = parsed;
  const inizio = new Date(anno, mese - 1, 1);
  const fine = new Date(anno, mese, 0);

  const righeDb = await db.rigaAttivita.findMany({
    where: {
      collaboratoreId: collaboratore.id,
      data: {
        gte: inizio,
        lte: fine,
      },
    },
    include: {
      offerta: true,
      cliente: true,
    },
    orderBy: { data: "asc" },
  });

  const tariffa = collaboratore.tariffaGiornaliera.toString();
  const righe: RigaRiepilogo[] = righeDb.map((riga) => ({
    offertaId: riga.offerta.id,
    offertaCodice: riga.offerta.codice,
    offertaDescrizione: riga.offerta.descrizione,
    clienteRagioneSociale: riga.cliente.ragioneSociale,
    ore: Number(riga.ore),
    fatturabile: riga.fatturabile,
    rimborsoTrasfertaImporto: riga.rimborsoTrasfertaImporto?.toString() ?? null,
  }));

  const riepilogo = calcolaRiepilogoMese(righe, tariffa);

  return {
    token,
    perOfferta: riepilogo.perOfferta,
    totali: riepilogo.totali,
    importoFattura: riepilogo.importoFattura,
    breakdown: riepilogo.breakdown,
    tariffaGiornaliera: tariffa,
  };
}
