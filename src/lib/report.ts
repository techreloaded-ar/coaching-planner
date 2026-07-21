import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import { parseTokenMese } from "@/domain/calendario";
import type {
  RigaAttivita,
  Offerta,
  Cliente,
  Collaboratore,
  ScaglioneKm,
} from "@/generated/prisma/client";
import {
  calcolaReportFatturazioneClienti,
  type RigaReportFatturazione,
  type ScaglioneRimborso,
  type ReportFatturazioneClienti,
} from "@/domain/consuntivi";

// ── Tipi ────────────────────────────────────────────────────────

/**
 * Risultato serializzabile del report di fatturazione clienti per un mese.
 * Pronto per essere consumato da un Client Component: nessun Date o Decimal grezzo.
 */
export interface RisultatoReportFatturazione extends ReportFatturazioneClienti {
  /** Token YYYY-MM del mese di riferimento */
  token: string;
}

/** Riga attività arricchita con offerta e cliente */
interface RigaAttivitaConContesto extends RigaAttivita {
  offerta: Offerta;
  cliente: Cliente;
  collaboratore: Collaboratore;
}

// ── API pubblica ────────────────────────────────────────────────

/**
 * Calcola il report di fatturazione clienti per un intero mese, aggregando le
 * righe attività di TUTTI i collaboratori.
 *
 * Accesso riservato all'amministratore (`richiediRuoloApi("AMMINISTRATORE")`).
 * Se il token mese non è valido restituisce un risultato vuoto senza errori.
 *
 * L'importo da fatturare usa la tariffa giornaliera dell'OFFERTA (non del
 * collaboratore). Il risultato è interamente serializzabile.
 *
 * @param token - Token YYYY-MM del mese
 * @returns Report per cliente con totali, pronto per un Client Component
 */
export async function reportFatturazioneClientiMese(
  token: string,
): Promise<RisultatoReportFatturazione> {
  await richiediRuoloApi("AMMINISTRATORE");

  const parsed = parseTokenMese(token);
  if (!parsed) {
    return {
      token,
      perCliente: [],
      totali: {
        imponibileManodopera: "0.00",
        totaleRimborsi: "0.00",
        importoTotale: "0.00",
      },
    };
  }

  const { anno, mese } = parsed;

  // Intervallo del mese: dal primo all'ultimo giorno
  const inizio = new Date(anno, mese - 1, 1);
  const fine = new Date(anno, mese, 0); // giorno 0 del mese successivo = ultimo del corrente

  // Nessun filtro collaboratoreId: l'amministratore vede tutti i collaboratori
  const righe = await db.rigaAttivita.findMany({
    where: {
      data: {
        gte: inizio,
        lte: fine,
      },
    },
    include: {
      offerta: true,
      cliente: true,
      collaboratore: true,
    },
    orderBy: { data: "asc" },
  });

  const scaglioni: ScaglioneRimborso[] = (
    await db.scaglioneKm.findMany({
      orderBy: { finoAKm: "asc" },
    })
  ).map((s: ScaglioneKm) => ({
    finoAKm: s.finoAKm,
    importo: s.importo.toString(),
  }));

  const righeMappate: RigaReportFatturazione[] = righe.map(
    (riga: RigaAttivitaConContesto) => ({
      clienteId: riga.clienteId,
      clienteRagioneSociale: riga.cliente.ragioneSociale,
      offertaId: riga.offertaId,
      offertaCodice: riga.offerta.codice,
      offertaDescrizione: riga.offerta.descrizione,
      tariffaOffertaGiornaliera: riga.offerta.tariffaGiornaliera.toString(),
      collaboratoreId: riga.collaboratoreId,
      collaboratoreNome: `${riga.collaboratore.nome} ${riga.collaboratore.cognome}`,
      ore: Number(riga.ore),
      fatturabile: riga.fatturabile,
      trasfertaKm: riga.trasfertaKm,
    }),
  );

  const report = calcolaReportFatturazioneClienti(righeMappate, scaglioni);

  return { token, ...report };
}
