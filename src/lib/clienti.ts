import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import type { Cliente, Prisma } from "@/generated/prisma/client";
import {
  ELEMENTI_PER_PAGINA,
  calcolaPaginaElenco,
  inizioPagina,
  type PaginaElenco,
  type PosizioneElenco,
} from "@/lib/paginazione";

// ── API clienti (back office, solo amministratore) ──────────────

/** Pagina dell'elenco clienti con i contatori dell'intero insieme filtrato. */
export interface ElencoClientiPaginato extends PaginaElenco {
  clienti: Cliente[];
  attivi: number;
  disattivati: number;
}

/**
 * Elenca i clienti (attivi e disattivati) a pagine, in ordine alfabetico per
 * ragione sociale. La ricerca, senza distinzione maiuscole/minuscole, filtra
 * per ragione sociale, P.IVA o città su tutto l'archivio; i contatori
 * riguardano l'intero insieme filtrato. Una pagina oltre l'ultima restituisce
 * l'ultima pagina valida.
 * Accesso riservato all'amministratore.
 */
export async function elencaClientiPaginati({
  ricerca,
  pagina,
}: PosizioneElenco): Promise<ElencoClientiPaginato> {
  await richiediRuoloApi("AMMINISTRATORE");

  const filtro = { contains: ricerca, mode: "insensitive" } as const;
  const where: Prisma.ClienteWhereInput = ricerca
    ? {
        OR: [
          { ragioneSociale: filtro },
          { partitaIva: filtro },
          { citta: filtro },
        ],
      }
    : {};

  const [totaleClienti, attivi] = await Promise.all([
    db.cliente.count({ where }),
    db.cliente.count({ where: { AND: [where, { attivo: true }] } }),
  ]);
  const paginaElenco = calcolaPaginaElenco(pagina, totaleClienti);

  const clienti = await db.cliente.findMany({
    where,
    orderBy: [{ ragioneSociale: "asc" }, { id: "asc" }],
    skip: inizioPagina(paginaElenco.paginaCorrente),
    take: ELEMENTI_PER_PAGINA,
  });

  return {
    ...paginaElenco,
    clienti,
    attivi,
    disattivati: totaleClienti - attivi,
  };
}

/**
 * Restituisce un cliente per ID.
 * Accesso riservato all'amministratore.
 * Restituisce null se il cliente non esiste.
 */
export async function clientePerId(id: string): Promise<Cliente | null> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.cliente.findUnique({
    where: { id },
  });
}

/**
 * Elenca i soli clienti attivi, ordinati per ragione sociale.
 * Unica fonte per le selezioni operative (offerte, attività, ecc.).
 * Accesso riservato all'amministratore.
 */
export async function elencaClientiSelezionabili(): Promise<Cliente[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.cliente.findMany({
    where: { attivo: true },
    orderBy: { ragioneSociale: "asc" },
  });
}
