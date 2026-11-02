import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import type { Prisma, RigaAttivitaSospesa } from "@/generated/prisma/client";
import {
  ELEMENTI_PER_PAGINA,
  calcolaPaginaElenco,
  inizioPagina,
  type PaginaElenco,
} from "@/lib/paginazione";
import type { FiltroRigheSospese, StatoRigaSospesa } from "@/domain/righe-sospese";

// ── API righe sospese dell'import (back office, solo amministratore) ──

/** Riga mostrata in elenco: la nota per ora resta solo nel database. */
export type RigaSospesaInElenco = Omit<RigaAttivitaSospesa, "nota">;

export interface ElencoRigheSospese extends PaginaElenco {
  righe: RigaSospesaInElenco[];
  /** Righe ancora da risolvere, a prescindere dai filtri. */
  totaleRigheAperte: number;
  filtro: FiltroRigheSospese;
}

const CONDIZIONE_STATO: Record<StatoRigaSospesa, Prisma.RigaAttivitaSospesaWhereInput> = {
  aperte: { risoltaIl: null },
  risolte: { risoltaIl: { not: null } },
  tutte: {},
};

/**
 * Elenca le righe sospese a pagine secondo stato e motivo. Le righe di un
 * import condividono `createdAt` (una sola transazione): le più recenti per
 * prime, poi per data, collaboratore e cliente grezzi.
 * Accesso riservato all'amministratore.
 */
export async function elencaRigheSospese({
  pagina,
  filtro,
}: {
  pagina: number;
  filtro: FiltroRigheSospese;
}): Promise<ElencoRigheSospese> {
  await richiediRuoloApi("AMMINISTRATORE");

  const where: Prisma.RigaAttivitaSospesaWhereInput = {
    ...CONDIZIONE_STATO[filtro.stato],
    ...(filtro.motivo ? { motivo: filtro.motivo } : {}),
  };

  const [totaleRighe, totaleRigheAperte] = await Promise.all([
    db.rigaAttivitaSospesa.count({ where }),
    db.rigaAttivitaSospesa.count({ where: CONDIZIONE_STATO.aperte }),
  ]);
  const paginaElenco = calcolaPaginaElenco(pagina, totaleRighe);

  const righe = await db.rigaAttivitaSospesa.findMany({
    where,
    omit: { nota: true },
    orderBy: [
      { createdAt: "desc" },
      { data: "asc" },
      { collaboratore: "asc" },
      { cliente: "asc" },
      { id: "asc" },
    ],
    skip: inizioPagina(paginaElenco.paginaCorrente),
    take: ELEMENTI_PER_PAGINA,
  });

  return { ...paginaElenco, righe, totaleRigheAperte, filtro };
}
