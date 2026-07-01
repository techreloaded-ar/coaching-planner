import "server-only";

import { db } from "@/lib/db";
import { richiediCollaboratoreCorrente } from "@/lib/dal";
import { parseTokenMese } from "@/domain/calendario";
import type { RigaAttivita, Offerta, Cliente } from "@/generated/prisma/client";

// ── Tipi ────────────────────────────────────────────────────────

/** Riga attività arricchita con offerta e cliente */
export interface RigaAttivitaConContesto extends RigaAttivita {
  offerta: Offerta;
  cliente: Cliente;
}

/** Sintesi aggregata di un giorno */
export interface SintesiGiorno {
  /** Data in formato YYYY-MM-DD */
  data: string;
  /** Numero di righe registrate */
  righe: number;
  /** Ore totali */
  oreTotali: number;
  /** Codici offerta distinti del giorno */
  codici: string[];
}

/** Risultato completo del mese */
export interface AttivitaMese {
  /** Mappatura data YYYY-MM-DD → sintesi */
  perGiorno: Map<string, SintesiGiorno>;
  /** Righe complete del mese (con offerta e cliente) */
  righe: RigaAttivitaConContesto[];
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
 * Le righe sono ordinate per data crescente e includono offerta e cliente.
 * L'aggregazione per giorno produce una sintesi con numero di righe, ore totali
 * e codici offerta distinti.
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
    orderBy: { data: "asc" },
  });

  // Aggregazione per giorno
  const perGiorno = new Map<string, SintesiGiorno>();

  for (const riga of righe) {
    const chiave = formattaDataISO(riga.data);
    const esistente = perGiorno.get(chiave);

    if (esistente) {
      esistente.righe += 1;
      esistente.oreTotali += Number(riga.ore);
      if (!esistente.codici.includes(riga.offerta.codice)) {
        esistente.codici.push(riga.offerta.codice);
      }
    } else {
      perGiorno.set(chiave, {
        data: chiave,
        righe: 1,
        oreTotali: Number(riga.ore),
        codici: [riga.offerta.codice],
      });
    }
  }

  return { perGiorno, righe };
}
