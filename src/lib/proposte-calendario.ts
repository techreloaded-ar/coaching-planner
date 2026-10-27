import "server-only";

import { db } from "@/lib/db";
import { decifraToken } from "@/lib/cifratura-token";
import { eventiAttornoAlGiorno } from "@/lib/calendario-google";
import { analizzaEventiCalendario } from "@/lib/gemini";
import { proposteDaEventi, type EventoGoogle } from "@/domain/calendario-google";
import type { ProposteCalendarioGiornata } from "@/lib/attivita-contract";

// Read model delle proposte di ore dal calendario Google. Riceve il
// collaboratore già autorizzato dal chiamante, come le altre letture
// `...PerCollaboratoreAutorizzato` dell'area attività.

/** Righe recenti passate a Gemini come esempi di associazione nota → offerta. */
const NUMERO_ESEMPI_ASSOCIAZIONE = 30;

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
 * Una sola chiamata a Gemini per invocazione, e solo se ci sono proposte e
 * offerte abilitate: gli eventi che giudica non lavorativi sono esclusi, e
 * cliente e offerta sono precompilati solo con confidenza alta. Un calendario illeggibile produce lo stato `ERRORE` senza
 * eccezioni: la giornata resta utilizzabile per l'inserimento manuale.
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

  const offerte = await db.offerta.findMany({
    where: {
      attiva: true,
      cliente: { attivo: true },
      abilitazioniCollaboratori: { some: { collaboratoreId } },
    },
    select: {
      id: true,
      codice: true,
      descrizione: true,
      cliente: { select: { id: true, ragioneSociale: true } },
    },
    orderBy: { codice: "asc" },
  });
  const offertePerId = new Map(offerte.map((o) => [o.id, o]));
  const righeRecenti =
    offerte.length === 0
      ? []
      : await db.rigaAttivita.findMany({
          where: {
            collaboratoreId,
            nota: { not: "" },
            offertaId: { in: offerte.map((o) => o.id) },
          },
          select: { nota: true, offertaId: true },
          orderBy: [{ data: "desc" }, { createdAt: "desc" }],
          take: NUMERO_ESEMPI_ASSOCIAZIONE,
        });
  const esempi = righeRecenti.flatMap((r) =>
    r.nota ? [{ nota: r.nota, offertaId: r.offertaId }] : []
  );

  const { associazioni, nonLavorativi } = await analizzaEventiCalendario(
    proposte,
    offerte,
    esempi
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
