import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import { fatturataAlCliente, type GestioneTrasferta } from "@/domain/types";
import {
  ELEMENTI_PER_PAGINA,
  calcolaPaginaElenco,
  inizioPagina,
  type PaginaElenco,
  type PosizioneElenco,
} from "@/lib/paginazione";
import type {
  Prisma,
  Offerta,
  Cliente,
  Collaboratore,
  RigaAttivita,
} from "@/generated/prisma/client";
import {
  calcolaAvanzamentoOfferte,
  type OffertaAvanzamento,
  type RigaAvanzamento,
  type StatoAvanzamentoOfferta,
  type VoceCollaboratoreAvanzamento,
  type MatriceMensileAvanzamento,
} from "@/domain/consuntivi";

export interface OffertaConCliente extends Offerta {
  cliente: Cliente;
}

/** Riga attività arricchita con il collaboratore collegato */
interface RigaAttivitaConCollaboratore extends RigaAttivita {
  collaboratore: Collaboratore;
}

/**
 * Voce dell'elenco trasversale delle offerte con il relativo avanzamento.
 * Interamente serializzabile: nessun Decimal o Date grezzo esposto.
 */
export interface VoceElencoOfferta {
  offertaId: string;
  codice: string;
  descrizione: string;
  clienteId: string;
  clienteRagioneSociale: string;
  /** null se la tariffa non è ancora definita */
  tariffaGiornaliera: string | null;
  /** null (come residuo e percentuale) se l'offerta non ha giorni previsti */
  giorniPrevisti: number | null;
  gestioneTrasferta: GestioneTrasferta;
  /** Importo fatturato per giorno di trasferta; null se la trasferta è inclusa */
  importoTrasfertaForfettaria: string | null;
  attiva: boolean;
  giornateErogate: number;
  residuo: number | null;
  /** Percentuale di utilizzo del budget previsto dall'offerta. */
  percentualeUtilizzo: number | null;
  stato: StatoAvanzamentoOfferta;
  /** Dettaglio delle giornate erogate per ciascun collaboratore. */
  perCollaboratore: VoceCollaboratoreAvanzamento[];
  /** Matrice mensile (mese x collaboratore) delle giornate erogate. */
  matriceMensile: MatriceMensileAvanzamento;
  numeroRigheAttivita: number;
}

/**
 * Restituisce un'offerta per ID, includendo il cliente di appartenenza.
 * Accesso riservato all'amministratore.
 */
export async function offertaPerId(
  id: string
): Promise<OffertaConCliente | null> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.offerta.findUnique({
    where: { id },
    include: { cliente: true },
  });
}

/** Priorità di ordinamento di gruppo: più basso = più in alto nell'elenco. */
function gruppoOrdinamento(
  attiva: boolean,
  stato: StatoAvanzamentoOfferta,
): number {
  if (!attiva) {
    return 3;
  }
  if (stato === "OLTRE_BUDGET" || stato === "ESAURITA") {
    return 1;
  }
  return 2;
}

/** Metadati di un'offerta come attesi dal calcolo di dominio dell'avanzamento. */
function offertaPerAvanzamento(offerta: OffertaConCliente): OffertaAvanzamento {
  return {
    offertaId: offerta.id,
    offertaCodice: offerta.codice,
    offertaDescrizione: offerta.descrizione,
    clienteId: offerta.clienteId,
    clienteRagioneSociale: offerta.cliente.ragioneSociale,
    giorniPrevisti: offerta.giorniPrevisti,
  };
}

/** Costruisce voci serializzabili di avanzamento a partire da offerte e attività. */
function costruisciVociElencoOfferte(
  offerte: OffertaConCliente[],
  righe: RigaAttivitaConCollaboratore[],
): VoceElencoOfferta[] {
  const offerteMappate = offerte.map(offertaPerAvanzamento);

  const righeMappate: RigaAvanzamento[] = righe.map(
    (riga: RigaAttivitaConCollaboratore) => ({
      offertaId: riga.offertaId,
      collaboratoreId: riga.collaboratoreId,
      collaboratoreNome: `${riga.collaboratore.nome} ${riga.collaboratore.cognome}`,
      ore: Number(riga.ore),
      fatturabile: fatturataAlCliente(riga.categoria),
      mese: riga.data.toISOString().slice(0, 7),
    }),
  );

  const { perOfferta } = calcolaAvanzamentoOfferte(offerteMappate, righeMappate);

  const avanzamentoPerOfferta = new Map(
    perOfferta.map((voce) => [voce.offertaId, voce]),
  );

  const numeroRighePerOfferta = new Map<string, number>();
  for (const riga of righe) {
    numeroRighePerOfferta.set(
      riga.offertaId,
      (numeroRighePerOfferta.get(riga.offertaId) ?? 0) + 1,
    );
  }

  return offerte.map((offerta: OffertaConCliente) => {
    const avanzamento = avanzamentoPerOfferta.get(offerta.id);

    return {
      offertaId: offerta.id,
      codice: offerta.codice,
      descrizione: offerta.descrizione,
      clienteId: offerta.clienteId,
      clienteRagioneSociale: offerta.cliente.ragioneSociale,
      tariffaGiornaliera: offerta.tariffaGiornaliera?.toString() ?? null,
      giorniPrevisti: offerta.giorniPrevisti,
      gestioneTrasferta: offerta.gestioneTrasferta,
      importoTrasfertaForfettaria:
        offerta.importoTrasfertaForfettaria?.toString() ?? null,
      attiva: offerta.attiva,
      giornateErogate: avanzamento?.giornateErogate ?? 0,
      residuo: avanzamento?.residuo ?? offerta.giorniPrevisti,
      percentualeUtilizzo: avanzamento ? avanzamento.percentualeUtilizzo : 0,
      stato: avanzamento?.stato ?? "IN_CORSO",
      perCollaboratore: avanzamento?.perCollaboratore ?? [],
      matriceMensile: avanzamento?.matriceMensile ?? {
        mesi: [],
        righe: [],
        totaliPerMese: {},
        totaleGiornate: 0,
      },
      numeroRigheAttivita: numeroRighePerOfferta.get(offerta.id) ?? 0,
    };
  });
}

/** Pagina dell'elenco trasversale offerte con i contatori dell'intero insieme filtrato. */
export interface ElencoOffertePaginato extends PaginaElenco {
  offerte: VoceElencoOfferta[];
  attive: number;
  nonAttive: number;
  /** Offerte attive con residuo esaurito o negativo («da presidiare»). */
  critiche: number;
}

/**
 * Elenca in modo trasversale le offerte di tutti i clienti, a pagine, con il
 * loro avanzamento (giornate erogate, residuo, stato), riusando il calcolo di
 * dominio `calcolaAvanzamentoOfferte` senza duplicare alcuna logica.
 *
 * Accesso riservato all'amministratore (`richiediRuoloApi("AMMINISTRATORE")`).
 * La ricerca, senza distinzione maiuscole/minuscole, filtra per ragione sociale
 * del cliente, codice o descrizione su tutto l'archivio. Le offerte senza righe
 * attività compaiono con giornate erogate 0 e residuo pari alle previste.
 *
 * Ordinamento sull'intero insieme filtrato: prima le offerte attive
 * esaurite/oltre budget, poi le altre attive, infine quelle non attive; dentro
 * ogni gruppo per ragione sociale cliente e poi per codice offerta.
 *
 * Per ordinare e contare basta la somma delle ore per offerta e categoria;
 * le righe attività di dettaglio (per collaboratore, matrice mensile) sono
 * lette solo per le offerte della pagina restituita.
 */
export async function elencaOfferteConAvanzamentoPaginate({
  ricerca,
  pagina,
}: PosizioneElenco): Promise<ElencoOffertePaginato> {
  await richiediRuoloApi("AMMINISTRATORE");

  const filtro = { contains: ricerca, mode: "insensitive" } as const;
  const where: Prisma.OffertaWhereInput = ricerca
    ? {
        OR: [
          { codice: filtro },
          { descrizione: filtro },
          { cliente: { ragioneSociale: filtro } },
        ],
      }
    : {};

  // ponytail: ordinamento in memoria sulle intestazioni delle offerte filtrate
  // (senza righe attività); con decine di migliaia di offerte spostarlo in SQL.
  const offerte = await db.offerta.findMany({
    where,
    include: { cliente: true },
  });

  const orePerOffertaECategoria = await db.rigaAttivita.groupBy({
    by: ["offertaId", "categoria"],
    where: ricerca ? { offerta: where } : undefined,
    _sum: { ore: true },
  });

  const { perOfferta } = calcolaAvanzamentoOfferte(
    offerte.map(offertaPerAvanzamento),
    orePerOffertaECategoria.map(
      (gruppo): RigaAvanzamento => ({
        offertaId: gruppo.offertaId,
        collaboratoreId: "",
        collaboratoreNome: "",
        ore: Number(gruppo._sum.ore ?? 0),
        fatturabile: fatturataAlCliente(gruppo.categoria),
        mese: "",
      }),
    ),
  );
  const avanzamentoPerOfferta = new Map(
    perOfferta.map((voce) => [voce.offertaId, voce]),
  );

  const offerteOrdinate = offerte
    .map((offerta) => ({ offerta, avanzamento: avanzamentoPerOfferta.get(offerta.id)! }))
    .sort((a, b) => {
      const gruppoA = gruppoOrdinamento(a.offerta.attiva, a.avanzamento.stato);
      const gruppoB = gruppoOrdinamento(b.offerta.attiva, b.avanzamento.stato);
      if (gruppoA !== gruppoB) {
        return gruppoA - gruppoB;
      }
      const perCliente = a.offerta.cliente.ragioneSociale.localeCompare(
        b.offerta.cliente.ragioneSociale,
      );
      if (perCliente !== 0) {
        return perCliente;
      }
      return a.offerta.codice.localeCompare(b.offerta.codice);
    });

  const attive = offerteOrdinate.filter(({ offerta }) => offerta.attiva).length;
  const critiche = offerteOrdinate.filter(
    ({ offerta, avanzamento }) =>
      gruppoOrdinamento(offerta.attiva, avanzamento.stato) === 1,
  ).length;

  const paginaElenco = calcolaPaginaElenco(pagina, offerte.length);
  const inizio = inizioPagina(paginaElenco.paginaCorrente);
  const offertePagina = offerteOrdinate
    .slice(inizio, inizio + ELEMENTI_PER_PAGINA)
    .map(({ offerta }) => offerta);

  const righe =
    offertePagina.length > 0
      ? await db.rigaAttivita.findMany({
          where: { offertaId: { in: offertePagina.map((offerta) => offerta.id) } },
          include: { collaboratore: true },
        })
      : [];

  return {
    ...paginaElenco,
    offerte: costruisciVociElencoOfferte(offertePagina, righe),
    attive,
    nonAttive: offerte.length - attive,
    critiche,
  };
}

/**
 * Elenca le offerte di un cliente con il relativo avanzamento, ordinate per
 * codice. Il risultato è interamente serializzabile: la tariffa è una stringa
 * e non espone valori Decimal o Date grezzi.
 *
 * Accesso riservato all'amministratore.
 */
export async function elencaOffertePerClienteConAvanzamento(
  clienteId: string,
): Promise<VoceElencoOfferta[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  const offerte = await db.offerta.findMany({
    where: { clienteId },
    include: { cliente: true },
  });

  const righe = await db.rigaAttivita.findMany({
    where: { offerta: { clienteId } },
    include: { collaboratore: true },
  });

  const voci = costruisciVociElencoOfferte(offerte, righe);
  voci.sort((a, b) => a.codice.localeCompare(b.codice));

  return voci;
}
