import "server-only";

import { db } from "@/lib/db";
import { richiediAlmenoUnPermessoApi, richiediPermessoApi } from "@/lib/dal";
import type { Cliente, Prisma } from "@/generated/prisma/client";
import {
  ELEMENTI_PER_PAGINA,
  calcolaPaginaElenco,
  inizioPagina,
  type PaginaElenco,
  type PosizioneElenco,
} from "@/lib/paginazione";
import {
  TIPI_STATO_CLIENTE,
  TIPI_STATO_CLIENTE_PREDEFINITI,
  statoCliente,
  type StatoCliente,
  type TipoStatoCliente,
} from "@/domain/anagrafiche/stato-cliente";

// ── API clienti (back office, guardie per permesso) ─────────────

/** Cliente con lo stato derivato dalle sue offerte. */
export type ClienteConStato = Cliente & { stato: StatoCliente };

/** Pagina dell'elenco clienti con i conteggi per stato dell'intero insieme cercato. */
export interface ElencoClientiPaginato extends PaginaElenco {
  clienti: ClienteConStato[];
  conteggiPerStato: Record<TipoStatoCliente, number>;
  /** Stati selezionati nel quick filter (ignorati se c'è una ricerca). */
  statiSelezionati: TipoStatoCliente[];
}

/** Condizione Prisma equivalente a `statoCliente(...).tipo === tipo`. */
const CONDIZIONE_STATO: Record<TipoStatoCliente, Prisma.ClienteWhereInput> = {
  ATTIVO: { offerte: { some: { attiva: true } } },
  NUOVO: { offerte: { none: {} } },
  NON_ATTIVO: { AND: [{ offerte: { some: {} } }, { offerte: { none: { attiva: true } } }] },
};

const SELEZIONE_OFFERTE_PER_STATO = { offerte: { select: { attiva: true } } } as const;

function conStato({ offerte, ...cliente }: Cliente & { offerte: { attiva: boolean }[] }): ClienteConStato {
  return { ...cliente, stato: statoCliente(offerte) };
}

/**
 * Elenca i clienti a pagine, in ordine alfabetico per ragione sociale.
 * Senza ricerca mostra solo i clienti negli stati selezionati; la ricerca,
 * senza distinzione maiuscole/minuscole, filtra per ragione sociale, P.IVA o
 * città su tutto l'archivio a prescindere dallo stato. I conteggi per stato
 * riguardano l'insieme cercato. Una pagina oltre l'ultima restituisce
 * l'ultima pagina valida.
 * Richiede il permesso GESTIRE_CLIENTI.
 */
export async function elencaClientiPaginati({
  ricerca,
  pagina,
  stati = [...TIPI_STATO_CLIENTE_PREDEFINITI],
}: PosizioneElenco & { stati?: TipoStatoCliente[] }): Promise<ElencoClientiPaginato> {
  await richiediPermessoApi("GESTIRE_CLIENTI");

  const filtro = { contains: ricerca, mode: "insensitive" } as const;
  const whereRicerca: Prisma.ClienteWhereInput = ricerca
    ? {
        OR: [
          { ragioneSociale: filtro },
          { partitaIva: filtro },
          { citta: filtro },
        ],
      }
    : {};
  const where: Prisma.ClienteWhereInput = ricerca
    ? whereRicerca
    : { OR: stati.map((tipo) => CONDIZIONE_STATO[tipo]) };

  const [totaleClienti, ...conteggi] = await Promise.all([
    db.cliente.count({ where }),
    ...TIPI_STATO_CLIENTE.map((tipo) =>
      db.cliente.count({ where: { AND: [whereRicerca, CONDIZIONE_STATO[tipo]] } }),
    ),
  ]);
  const paginaElenco = calcolaPaginaElenco(pagina, totaleClienti);

  const clienti = await db.cliente.findMany({
    where,
    include: SELEZIONE_OFFERTE_PER_STATO,
    orderBy: [{ ragioneSociale: "asc" }, { id: "asc" }],
    skip: inizioPagina(paginaElenco.paginaCorrente),
    take: ELEMENTI_PER_PAGINA,
  });

  return {
    ...paginaElenco,
    clienti: clienti.map(conStato),
    conteggiPerStato: Object.fromEntries(
      TIPI_STATO_CLIENTE.map((tipo, indice) => [tipo, conteggi[indice]]),
    ) as Record<TipoStatoCliente, number>,
    statiSelezionati: stati,
  };
}

/**
 * Restituisce un cliente per ID con il suo stato derivato.
 * Condivisa da dettaglio cliente, offerte del cliente e dettaglio marginalità:
 * basta uno dei permessi di queste aree.
 * Restituisce null se il cliente non esiste.
 */
export async function clientePerId(id: string): Promise<ClienteConStato | null> {
  await richiediAlmenoUnPermessoApi([
    "GESTIRE_CLIENTI",
    "GESTIRE_OFFERTE",
    "CONSULTARE_REPORT_MARGINALITA",
  ]);

  const cliente = await db.cliente.findUnique({
    where: { id },
    include: SELEZIONE_OFFERTE_PER_STATO,
  });
  return cliente ? conStato(cliente) : null;
}

/**
 * Elenca tutti i clienti, ordinati per ragione sociale: ogni cliente può
 * ricevere nuove offerte, qualunque sia il suo stato.
 * Condivisa dalle aree clienti e offerte: basta uno dei due permessi.
 */
export async function elencaClientiSelezionabili(): Promise<Cliente[]> {
  await richiediAlmenoUnPermessoApi(["GESTIRE_CLIENTI", "GESTIRE_OFFERTE"]);

  return db.cliente.findMany({
    orderBy: { ragioneSociale: "asc" },
  });
}
