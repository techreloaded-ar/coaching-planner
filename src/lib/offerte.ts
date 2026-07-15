import "server-only";

import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";
import type {
  Offerta,
  Cliente,
  Collaboratore,
  RigaAttivita,
} from "@/generated/prisma/client";
import {
  calcolaAvanzamentoOfferte,
  type OffertaAvanzamento,
  type RigaAvanzamento,
  type StatoAvanzamentoOfferta,
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
  tariffaGiornaliera: string;
  giorniPrevisti: number;
  attiva: boolean;
  giornateErogate: number;
  residuo: number;
  stato: StatoAvanzamentoOfferta;
  numeroRigheAttivita: number;
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

/**
 * Elenca in modo trasversale TUTTE le offerte di TUTTI i clienti con il loro
 * avanzamento (giornate erogate, residuo, stato), riusando il calcolo di
 * dominio `calcolaAvanzamentoOfferte` senza duplicare alcuna logica.
 *
 * Accesso riservato all'amministratore (`richiediRuoloApi("AMMINISTRATORE")`).
 * Ogni offerta esistente compare nell'elenco, anche quelle senza righe attività
 * (in tal caso: giornate erogate 0 e residuo pari alle giornate previste).
 *
 * Il risultato è interamente serializzabile: la tariffa è una stringa, non sono
 * esposti valori Decimal o Date grezzi.
 *
 * Ordinamento: prima le offerte attive esaurite/oltre budget, poi le altre
 * attive, infine quelle non attive; dentro ogni gruppo per ragione sociale
 * cliente e poi per codice offerta.
 */
export async function elencaOfferteConAvanzamento(): Promise<
  VoceElencoOfferta[]
> {
  await richiediRuoloApi("AMMINISTRATORE");

  const offerte = await db.offerta.findMany({
    include: { cliente: true },
  });

  const righe = await db.rigaAttivita.findMany({
    include: { collaboratore: true },
  });

  const offerteMappate: OffertaAvanzamento[] = offerte.map(
    (offerta: OffertaConCliente) => ({
      offertaId: offerta.id,
      offertaCodice: offerta.codice,
      offertaDescrizione: offerta.descrizione,
      clienteId: offerta.clienteId,
      clienteRagioneSociale: offerta.cliente.ragioneSociale,
      giorniPrevisti: offerta.giorniPrevisti,
    }),
  );

  const righeMappate: RigaAvanzamento[] = righe.map(
    (riga: RigaAttivitaConCollaboratore) => ({
      offertaId: riga.offertaId,
      collaboratoreId: riga.collaboratoreId,
      collaboratoreNome: `${riga.collaboratore.nome} ${riga.collaboratore.cognome}`,
      ore: Number(riga.ore),
      fatturabile: riga.fatturabile,
    }),
  );

  const { perOfferta } = calcolaAvanzamentoOfferte(offerteMappate, righeMappate);

  const avanzamentoPerOfferta = new Map(
    perOfferta.map((voce) => [voce.offertaId, voce]),
  );

  const numeroRighePerOfferta = new Map<string, number>();
  for (const riga of righe) {
    numeroRighePerOfferta.set(
      riga.offertaId,
      (numeroRighePerOfferta.get(riga.offertaId) ?? 0) + 1,
    );
  }

  const voci: VoceElencoOfferta[] = offerte.map((offerta: OffertaConCliente) => {
    const avanzamento = avanzamentoPerOfferta.get(offerta.id);

    return {
      offertaId: offerta.id,
      codice: offerta.codice,
      descrizione: offerta.descrizione,
      clienteId: offerta.clienteId,
      clienteRagioneSociale: offerta.cliente.ragioneSociale,
      tariffaGiornaliera: offerta.tariffaGiornaliera.toString(),
      giorniPrevisti: offerta.giorniPrevisti,
      attiva: offerta.attiva,
      giornateErogate: avanzamento?.giornateErogate ?? 0,
      residuo: avanzamento?.residuo ?? offerta.giorniPrevisti,
      stato: avanzamento?.stato ?? "IN_CORSO",
      numeroRigheAttivita: numeroRighePerOfferta.get(offerta.id) ?? 0,
    };
  });

  voci.sort((a, b) => {
    const gruppoA = gruppoOrdinamento(a.attiva, a.stato);
    const gruppoB = gruppoOrdinamento(b.attiva, b.stato);
    if (gruppoA !== gruppoB) {
      return gruppoA - gruppoB;
    }
    const perCliente = a.clienteRagioneSociale.localeCompare(
      b.clienteRagioneSociale,
    );
    if (perCliente !== 0) {
      return perCliente;
    }
    return a.codice.localeCompare(b.codice);
  });

  return voci;
}
