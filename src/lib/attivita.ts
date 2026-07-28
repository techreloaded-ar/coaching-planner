import "server-only";

import { db } from "@/lib/db";
import { richiediCollaboratoreCorrente, ErroreAutorizzazione } from "@/lib/dal";
import { parseTokenMese } from "@/domain/calendario";
import type { RigaAttivita, Offerta, Cliente, ScaglioneKm } from "@/generated/prisma/client";
import type {
  DatiCalendarioMese,
  SintesiClienteGiorno,
  SintesiGiorno,
} from "@/lib/attivita-contract";
import {
  calcolaRiepilogoMese,
  type ScaglioneRimborso,
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
 * Recupera le righe attività del collaboratore corrente per una data specifica.
 *
 * Include offerta e cliente. Ordinate per ora di creazione.
 * Lancia ErroreAutorizzazione se non autenticato o se non è un collaboratore.
 *
 * @param dataStr - Data in formato YYYY-MM-DD
 * @returns Righe attività del giorno con contesto offerta e cliente
 */
export async function righeDelGiorno(
  dataStr: string
): Promise<RigaAttivitaConContesto[]> {
  const collaboratore = await richiediCollaboratoreCorrente();
  if (!collaboratore) {
    throw new ErroreAutorizzazione(
      401,
      "Devi essere un collaboratore per visualizzare le attività"
    );
  }

  // Parsa la data YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataStr);
  if (!match) return [];

  const anno = parseInt(match[1], 10);
  const mese = parseInt(match[2], 10);
  const giorno = parseInt(match[3], 10);

  const inizio = new Date(anno, mese - 1, giorno);
  const fine = new Date(anno, mese - 1, giorno, 23, 59, 59, 999);

  return db.rigaAttivita.findMany({
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
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Restituisce i clienti attivi per la select del form attività.
 *
 * Accessibile al collaboratore autenticato (a differenza di src/lib/clienti.ts
 * che è admin-only). Lancia ErroreAutorizzazione se non autenticato o se non
 * è un collaboratore.
 *
 * @returns Lista clienti attivi con id e ragione sociale, ordinati per ragione sociale
 */
export async function clientiAttiviPerSelezione(): Promise<
  { id: string; ragioneSociale: string }[]
> {
  const collaboratore = await richiediCollaboratoreCorrente();
  if (!collaboratore) {
    throw new ErroreAutorizzazione(
      401,
      "Devi essere un collaboratore per visualizzare i clienti"
    );
  }

  return db.cliente.findMany({
    where: { attivo: true },
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
 * Restituisce gli scaglioni km per il calcolo del rimborso trasferta.
 *
 * Accessibile al collaboratore autenticato (a differenza di src/lib/scaglioni.ts
 * che è admin-only). Lancia ErroreAutorizzazione se non autenticato o se non
 * è un collaboratore.
 *
 * @returns Scaglioni ordinati per soglia crescente
 */
export async function scaglioniRimborsoTrasferta(): Promise<ScaglioneRimborso[]> {
  const collaboratore = await richiediCollaboratoreCorrente();
  if (!collaboratore) {
    throw new ErroreAutorizzazione(
      401,
      "Devi essere un collaboratore per visualizzare gli scaglioni di rimborso"
    );
  }

  const scaglioni = await db.scaglioneKm.findMany({
    orderBy: { finoAKm: "asc" },
  });

  return scaglioni.map((s: ScaglioneKm) => ({
    finoAKm: s.finoAKm,
    importo: s.importo.toString(),
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

  const [righeDb, scaglioni] = await Promise.all([
    db.rigaAttivita.findMany({
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
    }),
    scaglioniRimborsoTrasferta(),
  ]);

  const tariffa = collaboratore.tariffaGiornaliera.toString();
  const righe: RigaRiepilogo[] = righeDb.map((riga) => ({
    offertaId: riga.offerta.id,
    offertaCodice: riga.offerta.codice,
    offertaDescrizione: riga.offerta.descrizione,
    clienteRagioneSociale: riga.cliente.ragioneSociale,
    ore: Number(riga.ore),
    fatturabile: riga.fatturabile,
    trasfertaKm: riga.trasfertaKm ?? null,
  }));

  const riepilogo = calcolaRiepilogoMese(righe, tariffa, scaglioni);

  return {
    token,
    perOfferta: riepilogo.perOfferta,
    totali: riepilogo.totali,
    importoFattura: riepilogo.importoFattura,
    breakdown: riepilogo.breakdown,
    tariffaGiornaliera: tariffa,
  };
}
