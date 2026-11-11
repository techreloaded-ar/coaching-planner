import "server-only";

import { db } from "@/lib/db";
import { richiediPermessoApi } from "@/lib/dal";
import { ORE_PER_GIORNATA, fatturataDalCollaboratore, sommaOre } from "@/domain/types";

// ── API abilitazioni (back office, permesso GESTIRE_ABILITAZIONI) 

export interface OffertaAbilitata {
  offertaId: string;
  codice: string;
  descrizione: string;
  clienteId: string;
  clienteRagioneSociale: string;
  /** Giornate che il collaboratore fattura ad Agile Reloaded sull'offerta, su tutto lo storico. */
  giorniFatturati: number;
  /** Ultimo mese (YYYY-MM) con ore del collaboratore sull'offerta, di qualunque categoria; null se nessuna. */
  ultimoMeseConOre: string | null;
}

export interface OffertaAbilitabile {
  offertaId: string;
  codice: string;
  descrizione: string;
  clienteRagioneSociale: string;
}

/**
 * Elenca le offerte attive a cui il collaboratore è abilitato, con cliente,
 * giornate fatturate e ultimo mese con ore, ordinate per ragione sociale e poi
 * per codice.
 *
 * Le abilitazioni su offerte non attive restano nel database ma non vengono
 * elencate.
 *
 * Richiede il permesso GESTIRE_ABILITAZIONI.
 */
export async function elencaOfferteAbilitate(
  collaboratoreId: string,
): Promise<OffertaAbilitata[]> {
  await richiediPermessoApi("GESTIRE_ABILITAZIONI");

  const abilitazioni = await db.abilitazioneOfferta.findMany({
    where: { collaboratoreId, offerta: { attiva: true } },
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

  if (abilitazioni.length === 0) {
    return [];
  }

  const somme = await db.rigaAttivita.groupBy({
    by: ["offertaId", "categoria"],
    where: {
      collaboratoreId,
      offertaId: { in: abilitazioni.map((abilitazione) => abilitazione.offertaId) },
    },
    _sum: { ore: true },
    _max: { data: true },
  });

  const orePerOfferta = new Map<string, number[]>();
  const ultimoMesePerOfferta = new Map<string, string>();
  for (const gruppo of somme) {
    if (gruppo.offertaId === null) continue;
    if (fatturataDalCollaboratore(gruppo.categoria)) {
      const ore = orePerOfferta.get(gruppo.offertaId) ?? [];
      ore.push(Number(gruppo._sum.ore ?? 0));
      orePerOfferta.set(gruppo.offertaId, ore);
    }
    // I mesi YYYY-MM si ordinano come stringhe.
    const mese = gruppo._max.data?.toISOString().slice(0, 7);
    if (mese && mese > (ultimoMesePerOfferta.get(gruppo.offertaId) ?? "")) {
      ultimoMesePerOfferta.set(gruppo.offertaId, mese);
    }
  }

  return abilitazioni.map((abilitazione) => ({
    offertaId: abilitazione.offerta.id,
    codice: abilitazione.offerta.codice,
    descrizione: abilitazione.offerta.descrizione,
    clienteId: abilitazione.offerta.clienteId,
    clienteRagioneSociale: abilitazione.offerta.cliente.ragioneSociale,
    giorniFatturati:
      sommaOre(...(orePerOfferta.get(abilitazione.offertaId) ?? [])) / ORE_PER_GIORNATA,
    ultimoMeseConOre: ultimoMesePerOfferta.get(abilitazione.offertaId) ?? null,
  }));
}

/**
 * Elenca le offerte attive a cui il collaboratore non è ancora abilitato, con
 * codice offerta e ragione sociale del cliente, ordinate per ragione sociale e
 * poi per codice. Fonte per il dialog di ricerca e selezione.
 *
 * Richiede il permesso GESTIRE_ABILITAZIONI.
 */
export async function elencaOfferteAbilitabili(
  collaboratoreId: string,
): Promise<OffertaAbilitabile[]> {
  await richiediPermessoApi("GESTIRE_ABILITAZIONI");

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
 * Richiede il permesso GESTIRE_ABILITAZIONI.
 */
export async function elencaCollaboratoriIngaggiati(
  offertaId: string,
): Promise<CollaboratoreIngaggiato[]> {
  await richiediPermessoApi("GESTIRE_ABILITAZIONI");

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
 * Richiede il permesso GESTIRE_ABILITAZIONI.
 */
export async function elencaCollaboratoriIngaggiabili(
  offertaId: string,
): Promise<CollaboratoreIngaggiabile[]> {
  await richiediPermessoApi("GESTIRE_ABILITAZIONI");

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
