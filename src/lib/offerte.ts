import "server-only";

import { db } from "@/lib/db";
import { richiediAlmenoUnPermessoApi, richiediPermessoApi } from "@/lib/dal";
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
  type AvanzamentoGiornateOfferta,
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
  /** Numero d'ordine del cliente; null se assente. */
  numeroOrdine: string | null;
  /** Chi in Agile Reloaded gestisce l'offerta; null se assente. */
  accountAgileReloaded: string | null;
  /** Note libere dell'amministratore; null se assenti. */
  note: string | null;
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
  /** Collaboratori con attività sull'offerta ma senza abilitazione; `attivo` dice se si possono abilitare. */
  collaboratoriNonAbilitati: { collaboratoreId: string; attivo: boolean }[];
}

/**
 * Restituisce un'offerta per ID, includendo il cliente di appartenenza.
 * Condivisa da dettaglio offerta e pagina ingaggi: basta uno dei due permessi.
 */
export async function offertaPerId(
  id: string
): Promise<OffertaConCliente | null> {
  await richiediAlmenoUnPermessoApi(["GESTIRE_OFFERTE", "GESTIRE_ABILITAZIONI"]);

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

/** Somma delle ore di un'offerta per categoria, come restituita da `groupBy`. */
interface SommaOrePerOffertaECategoria {
  offertaId: string | null;
  categoria: RigaAttivita["categoria"];
  inAffiancamento?: boolean;
  _sum: { ore: Prisma.Decimal | null };
}

/**
 * Righe elementari per il calcolo dell'avanzamento ricavate dalle somme delle
 * ore per offerta e categoria: bastano per erogato, residuo e stato, non per
 * il dettaglio per collaboratore o per mese.
 */
function righeAvanzamentoDaSomme(
  somme: SommaOrePerOffertaECategoria[],
): RigaAvanzamento[] {
  return somme.map((gruppo) => ({
    offertaId: gruppo.offertaId ?? "",
    collaboratoreId: "",
    collaboratoreNome: "",
    ore: Number(gruppo._sum.ore ?? 0),
    inAffiancamento: gruppo.inAffiancamento,
    fatturabile: fatturataAlCliente(gruppo.categoria),
    mese: "",
  }));
}

/**
 * Avanzamento in giornate (erogate su previste, stato) delle offerte indicate,
 * con lo stesso calcolo dell'anagrafica offerte: concorrono le ore fatturate
 * al cliente da tutti i collaboratori, senza limiti di periodo.
 *
 * Nessun controllo di ruolo: lo usa anche l'area attività del collaboratore,
 * e l'autorizzazione a vedere le offerte indicate resta al chiamante.
 */
export async function avanzamentoGiornateOfferte(
  offerte: { id: string; giorniPrevisti: number | null }[],
): Promise<Map<string, AvanzamentoGiornateOfferta>> {
  if (offerte.length === 0) {
    return new Map();
  }

  const orePerOffertaECategoria = await db.rigaAttivita.groupBy({
    by: ["offertaId", "categoria", "inAffiancamento"],
    where: { offertaId: { in: offerte.map((offerta) => offerta.id) } },
    _sum: { ore: true },
  });

  const { perOfferta } = calcolaAvanzamentoOfferte(
    offerte.map((offerta) => ({
      offertaId: offerta.id,
      offertaCodice: "",
      offertaDescrizione: "",
      clienteId: "",
      clienteRagioneSociale: "",
      giorniPrevisti: offerta.giorniPrevisti,
    })),
    righeAvanzamentoDaSomme(orePerOffertaECategoria),
  );

  return new Map(
    perOfferta.map((voce) => [
      voce.offertaId,
      {
        giornateErogate: voce.giornateErogate,
        giorniPrevisti: voce.giornatePreviste,
        stato: voce.stato,
      },
    ]),
  );
}

/** Coppie offerta–collaboratore abilitate per le offerte indicate. */
function abilitazioniDelleOfferte(offertaIds: string[]) {
  return db.abilitazioneOfferta.findMany({
    where: { offertaId: { in: offertaIds } },
    select: { offertaId: true, collaboratoreId: true },
  });
}

/** Costruisce voci serializzabili di avanzamento a partire da offerte e attività. */
function costruisciVociElencoOfferte(
  offerte: OffertaConCliente[],
  righe: RigaAttivitaConCollaboratore[],
  abilitazioni: { offertaId: string; collaboratoreId: string }[],
): VoceElencoOfferta[] {
  const coppieAbilitate = new Set(
    abilitazioni.map((a) => `${a.offertaId}:${a.collaboratoreId}`),
  );
  const nonAbilitatiPerOfferta = new Map<string, Map<string, boolean>>();
  for (const riga of righe) {
    if (riga.offertaId === null) continue;
    if (coppieAbilitate.has(`${riga.offertaId}:${riga.collaboratoreId}`)) continue;
    const nonAbilitati = nonAbilitatiPerOfferta.get(riga.offertaId) ?? new Map();
    nonAbilitati.set(riga.collaboratoreId, riga.collaboratore.attivo);
    nonAbilitatiPerOfferta.set(riga.offertaId, nonAbilitati);
  }

  const offerteMappate = offerte.map(offertaPerAvanzamento);

  const righeMappate: RigaAvanzamento[] = righe.map(
    (riga: RigaAttivitaConCollaboratore) => ({
      // Le righe sono lette per offerta: l'id è sempre valorizzato.
      offertaId: riga.offertaId ?? "",
      collaboratoreId: riga.collaboratoreId,
      collaboratoreNome: `${riga.collaboratore.nome} ${riga.collaboratore.cognome}`,
      ore: Number(riga.ore),
      inAffiancamento: riga.inAffiancamento,
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
    if (riga.offertaId === null) continue;
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
      numeroOrdine: offerta.numeroOrdine,
      accountAgileReloaded: offerta.accountAgileReloaded,
      note: offerta.note,
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
      collaboratoriNonAbilitati: [
        ...(nonAbilitatiPerOfferta.get(offerta.id) ?? []),
      ].map(([collaboratoreId, attivo]) => ({ collaboratoreId, attivo })),
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
 * Richiede il permesso GESTIRE_OFFERTE (`richiediPermessoApi("GESTIRE_OFFERTE")`).
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
  await richiediPermessoApi("GESTIRE_OFFERTE");

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
    by: ["offertaId", "categoria", "inAffiancamento"],
    // Le ore senza offerta non avanzano alcuna offerta.
    where: ricerca ? { offerta: where } : { offertaId: { not: null } },
    _sum: { ore: true },
  });

  const { perOfferta } = calcolaAvanzamentoOfferte(
    offerte.map(offertaPerAvanzamento),
    righeAvanzamentoDaSomme(orePerOffertaECategoria),
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

  const idsOffertePagina = offertePagina.map((offerta) => offerta.id);
  const [righe, abilitazioni] =
    offertePagina.length > 0
      ? await Promise.all([
          db.rigaAttivita.findMany({
            where: { offertaId: { in: idsOffertePagina } },
            include: { collaboratore: true },
          }),
          abilitazioniDelleOfferte(idsOffertePagina),
        ])
      : [[], []];

  return {
    ...paginaElenco,
    offerte: costruisciVociElencoOfferte(offertePagina, righe, abilitazioni),
    attive,
    nonAttive: offerte.length - attive,
    critiche,
  };
}

/**
 * Elenca le offerte di un cliente con il relativo avanzamento: prima le
 * attive, poi le disattivate, ciascun gruppo ordinato per codice. Il risultato è interamente serializzabile: la tariffa è una stringa
 * e non espone valori Decimal o Date grezzi.
 *
 * Condivisa dalle aree clienti e offerte: basta uno dei due permessi.
 */
export async function elencaOffertePerClienteConAvanzamento(
  clienteId: string,
): Promise<VoceElencoOfferta[]> {
  await richiediAlmenoUnPermessoApi(["GESTIRE_CLIENTI", "GESTIRE_OFFERTE"]);

  const offerte = await db.offerta.findMany({
    where: { clienteId },
    include: { cliente: true },
  });

  const [righe, abilitazioni] = await Promise.all([
    db.rigaAttivita.findMany({
      where: { offerta: { clienteId } },
      include: { collaboratore: true },
    }),
    abilitazioniDelleOfferte(offerte.map((offerta) => offerta.id)),
  ]);

  const voci = costruisciVociElencoOfferte(offerte, righe, abilitazioni);
  // Prima le attive, poi le disattivate; dentro ciascun gruppo per codice.
  voci.sort(
    (a, b) =>
      Number(b.attiva) - Number(a.attiva) || a.codice.localeCompare(b.codice),
  );

  return voci;
}
