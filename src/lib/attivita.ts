import "server-only";

import { db } from "@/lib/db";
import { richiediCollaboratoreCorrente, ErroreAutorizzazione } from "@/lib/dal";
import { parseTokenMese } from "@/domain/calendario";
import type { RigaAttivita, Offerta, Cliente, ScaglioneKm } from "@/generated/prisma/client";
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

/** Sintesi delle ore di un cliente in un giorno */
export interface SintesiClienteGiorno {
  /** Id del cliente */
  clienteId: string;
  /** Ragione sociale del cliente */
  ragioneSociale: string;
  /** Ore sommate per il cliente nel giorno, su tutte le offerte */
  ore: number;
}

/** Sintesi aggregata di un giorno */
export interface SintesiGiorno {
  /** Data in formato YYYY-MM-DD */
  data: string;
  /** Numero di righe registrate */
  righe: number;
  /** Ore totali */
  oreTotali: number;
  /** Sintesi per cliente, in ordine di prima apparizione nel giorno */
  clienti: SintesiClienteGiorno[];
}

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

  // Aggregazione per giorno
  const perGiorno = new Map<string, SintesiGiorno>();

  for (const riga of righe) {
    const chiave = formattaDataISO(riga.data);
    const esistente = perGiorno.get(chiave);
    const ore = Number(riga.ore);

    if (esistente) {
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
    } else {
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
    }
  }

  return { perGiorno, righe };
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
 * Restituisce le offerte attive per un cliente specifico.
 *
 * Accessibile al collaboratore autenticato. Lancia ErroreAutorizzazione
 * se non autenticato o se non è un collaboratore.
 *
 * @param clienteId - ID del cliente di cui recuperare le offerte attive
 * @returns Lista offerte attive con id, codice e descrizione, ordinate per codice
 */
export async function offerteAttivePerCliente(
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
