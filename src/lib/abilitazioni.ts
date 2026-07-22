import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";

// ── API abilitazioni (back office, solo amministratore) ──────────

export interface OffertaAbilitata {
  offertaId: string;
  codice: string;
  descrizione: string;
  clienteRagioneSociale: string;
  offertaAttiva: boolean;
}

export interface OffertaAbilitabile {
  offertaId: string;
  codice: string;
  descrizione: string;
  clienteRagioneSociale: string;
}

/**
 * Elenca le offerte a cui il collaboratore è abilitato, con codice offerta e
 * ragione sociale del cliente, ordinate per ragione sociale e poi per codice.
 *
 * Un'offerta abilitata e poi disattivata resta elencata (con offertaAttiva a
 * false): l'abilitazione storica non viene rimossa.
 *
 * Accesso riservato all'amministratore.
 */
export async function elencaOfferteAbilitate(
  collaboratoreId: string,
): Promise<OffertaAbilitata[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  const abilitazioni = await db.abilitazioneOfferta.findMany({
    where: { collaboratoreId },
    include: {
      offerta: {
        include: { cliente: { select: { ragioneSociale: true } } },
      },
    },
    orderBy: [
      { offerta: { cliente: { ragioneSociale: "asc" } } },
      { offerta: { codice: "asc" } },
    ],
  });

  return abilitazioni.map((abilitazione) => ({
    offertaId: abilitazione.offerta.id,
    codice: abilitazione.offerta.codice,
    descrizione: abilitazione.offerta.descrizione,
    clienteRagioneSociale: abilitazione.offerta.cliente.ragioneSociale,
    offertaAttiva: abilitazione.offerta.attiva,
  }));
}

/**
 * Elenca le offerte attive a cui il collaboratore non è ancora abilitato, con
 * codice offerta e ragione sociale del cliente, ordinate per ragione sociale e
 * poi per codice. Fonte per il dialog di ricerca e selezione.
 *
 * Accesso riservato all'amministratore.
 */
export async function elencaOfferteAbilitabili(
  collaboratoreId: string,
): Promise<OffertaAbilitabile[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  const offerte = await db.offerta.findMany({
    where: {
      attiva: true,
      abilitazioniCollaboratori: { none: { collaboratoreId } },
    },
    include: { cliente: { select: { ragioneSociale: true } } },
    orderBy: [{ cliente: { ragioneSociale: "asc" } }, { codice: "asc" }],
  });

  return offerte.map((offerta) => ({
    offertaId: offerta.id,
    codice: offerta.codice,
    descrizione: offerta.descrizione,
    clienteRagioneSociale: offerta.cliente.ragioneSociale,
  }));
}
