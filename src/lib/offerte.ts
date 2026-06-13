import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import type { Offerta, Cliente } from "@/generated/prisma/client";

export interface OffertaConCliente extends Offerta {
  cliente: Cliente;
}

/**
 * Elenca le offerte di un cliente ordinate per codice.
 * Accesso riservato all'amministratore.
 */
export async function elencaOffertePerCliente(
  clienteId: string
): Promise<Offerta[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.offerta.findMany({
    where: { clienteId },
    orderBy: { codice: "asc" },
  });
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
