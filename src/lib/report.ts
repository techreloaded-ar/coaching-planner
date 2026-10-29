import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import { fatturataAlCliente } from "@/domain/types";
import { meseSuccessivo, parseTokenMese } from "@/domain/calendario";
import { tariffaValidaNelMese } from "@/domain/tariffe";
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
  type FissoMensileCollaboratore,
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
        totaleTrasferteForfettarie: "0.00",
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
      fatturabile: fatturataAlCliente(riga.categoria),
      rimborsoTrasfertaImporto: riga.rimborsoTrasfertaImporto?.toString() ?? null,
      data: riga.data.toISOString().slice(0, 10),
      gestioneTrasfertaOfferta: riga.offerta.gestioneTrasferta,
      importoTrasfertaForfettariaOfferta:
        riga.offerta.importoTrasfertaForfettaria?.toString() ?? null,
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
 * dell'OFFERTA, i costi la tariffa del COLLABORATORE autore della riga valida
 * nel mese della riga; i fissi mensili si ripartiscono sulle offerte del mese.
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

  const [righeDb, collaboratori] = await Promise.all([
    db.rigaAttivita.findMany({
      where: {
        categoria: { in: ["FATTURABILE", "NON_FATTURABILE"] },
        data: { gte: inizio, lte: fine },
      },
      include: {
        offerta: true,
        cliente: true,
      },
    }),
    db.collaboratore.findMany({
      select: {
        id: true,
        attivo: true,
        tariffe: {
          where: { validaDalMese: { lte: a } },
          select: { validaDalMese: true, modalita: true, importo: true },
        },
      },
    }),
  ]);

  const tariffePerCollaboratore = new Map(
    collaboratori.map((collaboratore) => [collaboratore.id, collaboratore.tariffe]),
  );

  const righe: RigaMarginalita[] = righeDb.map((riga) => {
    const mese = riga.data.toISOString().slice(0, 7);
    const tariffa = tariffaValidaNelMese(
      tariffePerCollaboratore.get(riga.collaboratoreId) ?? [],
      mese,
    );
    return {
      clienteId: riga.clienteId,
      clienteRagioneSociale: riga.cliente.ragioneSociale,
      offertaId: riga.offertaId,
      offertaCodice: riga.offerta.codice,
      offertaDescrizione: riga.offerta.descrizione,
      tariffaOffertaGiornaliera: riga.offerta.tariffaGiornaliera.toString(),
      collaboratoreId: riga.collaboratoreId,
      mese,
      modalitaTariffaCollaboratore: tariffa?.modalita ?? null,
      importoTariffaCollaboratore: tariffa?.importo.toString() ?? 0,
      ore: Number(riga.ore),
      categoria: riga.categoria,
    };
  });

  // Fissi mensili dovuti nel periodo: collaboratori attivi, più chi ha ore nel
  // mese anche se oggi disattivato.
  const conRigheNelMese = new Set(righe.map((riga) => `${riga.collaboratoreId}|${riga.mese}`));
  const fissiMensili: FissoMensileCollaboratore[] = [];
  for (let mese = da; mese <= a; mese = meseSuccessivo(mese)) {
    for (const collaboratore of collaboratori) {
      const tariffa = tariffaValidaNelMese(collaboratore.tariffe, mese);
      if (
        tariffa?.modalita === "FISSO_MENSILE" &&
        (collaboratore.attivo || conRigheNelMese.has(`${collaboratore.id}|${mese}`))
      ) {
        fissiMensili.push({
          collaboratoreId: collaboratore.id,
          mese,
          importo: tariffa.importo.toString(),
        });
      }
    }
  }

  return { da, a, ...calcolaMarginalitaClienti(righe, fissiMensili) };
}
