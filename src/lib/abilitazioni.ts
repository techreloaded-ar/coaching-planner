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

export interface CollaboratoreIngaggiato {
  collaboratoreId: string;
  nome: string;
  cognome: string;
  email: string;
  collaboratoreAttivo: boolean;
}

export interface CollaboratoreIngaggiabile {
  collaboratoreId: string;
  nome: string;
  cognome: string;
  email: string;
}

/**
 * Elenca i collaboratori ingaggiati sull'offerta, con nome, cognome ed email,
 * ordinati per cognome e poi per nome.
 *
 * Un collaboratore ingaggiato e poi disattivato resta elencato (con
 * collaboratoreAttivo a false): l'ingaggio storico non viene rimosso.
 *
 * Accesso riservato all'amministratore.
 */
export async function elencaCollaboratoriIngaggiati(
  offertaId: string,
): Promise<CollaboratoreIngaggiato[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  const abilitazioni = await db.abilitazioneOfferta.findMany({
    where: { offertaId },
    include: {
      collaboratore: {
        select: {
          id: true,
          nome: true,
          cognome: true,
          attivo: true,
          utente: { select: { email: true } },
        },
      },
    },
    orderBy: [
      { collaboratore: { cognome: "asc" } },
      { collaboratore: { nome: "asc" } },
    ],
  });

  return abilitazioni.map((abilitazione) => ({
    collaboratoreId: abilitazione.collaboratore.id,
    nome: abilitazione.collaboratore.nome,
    cognome: abilitazione.collaboratore.cognome,
    email: abilitazione.collaboratore.utente.email,
    collaboratoreAttivo: abilitazione.collaboratore.attivo,
  }));
}

/**
 * Elenca i collaboratori attivi non ancora ingaggiati sull'offerta, con nome,
 * cognome ed email, ordinati per cognome e poi per nome. Fonte per il dialog
 * di ricerca e selezione.
 *
 * Accesso riservato all'amministratore.
 */
export async function elencaCollaboratoriIngaggiabili(
  offertaId: string,
): Promise<CollaboratoreIngaggiabile[]> {
  await richiediRuoloApi("AMMINISTRATORE");

  const collaboratori = await db.collaboratore.findMany({
    where: {
      attivo: true,
      abilitazioniOfferte: { none: { offertaId } },
    },
    select: {
      id: true,
      nome: true,
      cognome: true,
      utente: { select: { email: true } },
    },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });

  return collaboratori.map((collaboratore) => ({
    collaboratoreId: collaboratore.id,
    nome: collaboratore.nome,
    cognome: collaboratore.cognome,
    email: collaboratore.utente.email,
  }));
}
