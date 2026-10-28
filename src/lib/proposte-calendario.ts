import "server-only";

import { db } from "@/lib/db";
import { decifraToken } from "@/lib/cifratura-token";
import { eventiAttornoAlGiorno } from "@/lib/calendario-google";
import { analizzaEventiCalendario } from "@/lib/jev";
import { proposteDaEventi, type EventoGoogle } from "@/domain/calendario-google";
import type { ProposteCalendarioGiornata } from "@/lib/attivita-contract";

// Read model delle proposte di ore dal calendario Google. Riceve il
// collaboratore già autorizzato dal chiamante, come le altre letture
// `...PerCollaboratoreAutorizzato` dell'area attività.

/** `true` se il collaboratore ha collegato il proprio calendario. */
export async function calendarioCollegato(collaboratoreId: string): Promise<boolean> {
  const collegamento = await db.collegamentoCalendarioGoogle.findUnique({
    where: { collaboratoreId },
    select: { id: true },
  });
  return collegamento !== null;
}

/**
 * Proposte della giornata `YYYY-MM-DD` per il collaboratore indicato.
 *
 * Una richiesta a Jev per proposta, e solo se ci sono proposte e offerte
 * abilitate: gli eventi che giudica non lavorativi sono esclusi, e cliente e
 * offerta sono precompilati solo con cliente identificato, confidenza sopra
 * soglia e offerta attiva. Un calendario illeggibile produce lo stato `ERRORE`
 * senza eccezioni: la giornata resta utilizzabile per l'inserimento manuale.
 */
export async function proposteCalendarioPerCollaboratoreAutorizzato(
  giorno: string,
  collaboratoreId: string
): Promise<ProposteCalendarioGiornata> {
  const collegamento = await db.collegamentoCalendarioGoogle.findUnique({
    where: { collaboratoreId },
    select: { refreshTokenCifrato: true },
  });

  if (!collegamento) {
    return { stato: "NON_COLLEGATO", proposte: [] };
  }

  let eventi: EventoGoogle[];
  try {
    eventi = await eventiAttornoAlGiorno(
      decifraToken(collegamento.refreshTokenCifrato),
      giorno
    );
  } catch (errore) {
    console.error(
      "Lettura del calendario Google non riuscita:",
      errore instanceof Error ? errore.message : errore
    );
    return { stato: "ERRORE", proposte: [] };
  }

  const gestiti = await db.eventoCalendarioGestito.findMany({
    where: { collaboratoreId, eventoCalendarioId: { in: eventi.map((e) => e.id) } },
    select: { eventoCalendarioId: true },
  });
  const proposte = proposteDaEventi(
    eventi,
    giorno,
    new Set(gestiti.map((g) => g.eventoCalendarioId))
  );

  if (proposte.length === 0) {
    return { stato: "COLLEGATO", proposte: [] };
  }

  // Anche le offerte chiuse: servono a Jev per distinguere un rinnovo dal
  // contratto precedente, ma non vengono mai precompilate.
  const offerte = await db.offerta.findMany({
    where: {
      cliente: { attivo: true },
      abilitazioniCollaboratori: { some: { collaboratoreId } },
    },
    select: {
      id: true,
      codice: true,
      descrizione: true,
      attiva: true,
      createdAt: true,
      cliente: { select: { id: true, ragioneSociale: true } },
    },
    orderBy: { codice: "asc" },
  });
  const offertePerId = new Map(offerte.map((o) => [o.id, o]));

  const { associazioni, nonLavorativi } = await analizzaEventiCalendario(
    proposte,
    offerte,
    giorno
  );

  return {
    stato: "COLLEGATO",
    proposte: proposte.filter((p) => !nonLavorativi.has(p.eventoId)).map((p) => {
      const offerta = offertePerId.get(associazioni.get(p.eventoId) ?? "");
      return {
        eventoId: p.eventoId,
        titolo: p.titolo,
        inizio: p.inizio,
        fine: p.fine,
        ore: p.ore,
        cliente: offerta ? offerta.cliente : null,
        offerta: offerta
          ? { id: offerta.id, codice: offerta.codice, descrizione: offerta.descrizione }
          : null,
      };
    }),
  };
}
