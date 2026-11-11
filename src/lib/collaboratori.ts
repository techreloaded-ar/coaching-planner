import "server-only";

import { db } from "@/lib/db";
import { richiediPermessoApi } from "@/lib/dal";
import type { Collaboratore } from "@/generated/prisma/client";
import type { TariffaApplicata } from "@/domain/tariffe";

// ── API collaboratori (back office, permesso GESTIRE_COLLABORATORI) 

export interface CollaboratoreConUtente extends Collaboratore {
  utente: { email: string };
}

export interface CollaboratoreConTariffe extends CollaboratoreConUtente {
  tariffe: TariffaApplicata[];
}

/** Voce dello storico tariffe pronta per il client (importo come stringa). */
export interface VoceStoricoTariffa extends TariffaApplicata {
  id: string;
}

/**
 * Elenca tutti i collaboratori (attivi e disattivati), con l'email
 * dell'utente associato e lo storico delle tariffe.
 * Richiede il permesso GESTIRE_COLLABORATORI.
 */
export async function elencaCollaboratori(): Promise<CollaboratoreConTariffe[]> {
  await richiediPermessoApi("GESTIRE_COLLABORATORI");

  const collaboratori = await db.collaboratore.findMany({
    orderBy: { cognome: "asc" },
    include: {
      utente: { select: { email: true } },
      tariffe: { select: { validaDalMese: true, validaAlMese: true, modalita: true, importo: true } },
    },
  });

  return collaboratori.map((collaboratore) => ({
    ...collaboratore,
    tariffe: collaboratore.tariffe.map((tariffa) => ({
      ...tariffa,
      importo: tariffa.importo.toFixed(2),
    })),
  }));
}

/**
 * Storico tariffe di un collaboratore, dalla più recente.
 * Richiede il permesso GESTIRE_COLLABORATORI.
 */
export async function storicoTariffeCollaboratore(
  collaboratoreId: string,
): Promise<VoceStoricoTariffa[]> {
  await richiediPermessoApi("GESTIRE_COLLABORATORI");

  const tariffe = await db.tariffaCollaboratore.findMany({
    where: { collaboratoreId },
    orderBy: { validaDalMese: "desc" },
    select: { id: true, validaDalMese: true, validaAlMese: true, modalita: true, importo: true },
  });

  return tariffe.map((tariffa) => ({ ...tariffa, importo: tariffa.importo.toFixed(2) }));
}

/**
 * Restituisce un collaboratore per ID, con l'email dell'utente associato.
 * Richiede il permesso GESTIRE_COLLABORATORI.
 * Restituisce null se il collaboratore non esiste.
 */
export async function collaboratorePerId(
  id: string,
): Promise<CollaboratoreConUtente | null> {
  await richiediPermessoApi("GESTIRE_COLLABORATORI");

  return db.collaboratore.findUnique({
    where: { id },
    include: { utente: { select: { email: true } } },
  });
}

/**
 * Elenca i soli collaboratori attivi, ordinati per cognome.
 * Unica fonte per le selezioni operative (attività, report, ecc.).
 * Richiede il permesso GESTIRE_COLLABORATORI.
 */
export async function elencaCollaboratoriSelezionabili(): Promise<Collaboratore[]> {
  await richiediPermessoApi("GESTIRE_COLLABORATORI");

  return db.collaboratore.findMany({
    where: { attivo: true },
    orderBy: { cognome: "asc" },
  });
}

