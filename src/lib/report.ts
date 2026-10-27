import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import { parseTokenMese } from "@/domain/calendario";
import type {
  RigaAttivita,
  Offerta,
  Cliente,
  Collaboratore,
} from "@/generated/prisma/client";
import {
  calcolaReportFatturazioneClienti,
  calcolaMarginalitaClienti,
  type RigaReportFatturazione,
  type ReportFatturazioneClienti,
  type RigaMarginalita,
  type ReportMarginalita,
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

/** Report di marginalità per un periodo di mesi interi, serializzabile. */
export interface RisultatoReportMarginalita extends ReportMarginalita {
  /** Primo mese del periodo (token YYYY-MM) */
  da: string;
  /** Ultimo mese del periodo (token YYYY-MM), incluso */
  a: string;
}

/** Riga attività arricchita con offerta e cliente */
interface RigaAttivitaConContesto extends RigaAttivita {
  offerta: Offerta;
  cliente: Cliente;
  collaboratore: Pick<Collaboratore, "nome" | "cognome">;
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
      collaboratore: { select: { nome: true, cognome: true } },
    },
    orderBy: { data: "asc" },
  });

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
      rimborsoTrasfertaImporto: riga.rimborsoTrasfertaImporto?.toString() ?? null,
    }),
  );

  const report = calcolaReportFatturazioneClienti(righeMappate);

  return { token, ...report };
}

/**
 * Calcola la marginalità (ricavi, costi, margine) per cliente e per offerta su
 * un periodo di mesi interi, aggregando le righe fatturabili di TUTTI i
 * collaboratori.
 *
 * Accesso riservato all'amministratore. I ricavi usano la tariffa
 * dell'OFFERTA, i costi la tariffa del COLLABORATORE autore della riga.
 * Se un token non è valido restituisce un report vuoto senza errori.
 *
 * @param da - Primo mese del periodo (YYYY-MM)
 * @param a - Ultimo mese del periodo (YYYY-MM), incluso
 */
export async function reportMarginalitaPeriodo(
  da: string,
  a: string,
): Promise<RisultatoReportMarginalita> {
  await richiediRuoloApi("AMMINISTRATORE");

  const parsedDa = parseTokenMese(da);
  const parsedA = parseTokenMese(a);
  if (!parsedDa || !parsedA) {
    return { da, a, ...calcolaMarginalitaClienti([]) };
  }

  const inizio = new Date(parsedDa.anno, parsedDa.mese - 1, 1);
  const fine = new Date(parsedA.anno, parsedA.mese, 0);

  const righeDb = await db.rigaAttivita.findMany({
    where: { fatturabile: true, data: { gte: inizio, lte: fine } },
    include: {
      offerta: true,
      cliente: true,
      collaboratore: { select: { tariffaGiornaliera: true } },
    },
  });

  const righe: RigaMarginalita[] = righeDb.map((riga) => ({
    clienteId: riga.clienteId,
    clienteRagioneSociale: riga.cliente.ragioneSociale,
    offertaId: riga.offertaId,
    offertaCodice: riga.offerta.codice,
    offertaDescrizione: riga.offerta.descrizione,
    tariffaOffertaGiornaliera: riga.offerta.tariffaGiornaliera.toString(),
    tariffaCollaboratoreGiornaliera:
      riga.collaboratore.tariffaGiornaliera.toString(),
    ore: Number(riga.ore),
    fatturabile: riga.fatturabile,
  }));

  return { da, a, ...calcolaMarginalitaClienti(righe) };
}
