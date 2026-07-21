import "server-only";

import type { Ruolo } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { richiediRuoloApi } from "@/lib/dal";

export interface UtenteConProfiloCollaboratore {
  id: string;
  nome: string;
  email: string;
  ruolo: Ruolo;
  attivo: boolean;
  collaboratore: { attivo: boolean } | null;
}

const selezioneUtenteConProfiloCollaboratore = {
  id: true,
  nome: true,
  email: true,
  ruolo: true,
  attivo: true,
  collaboratore: { select: { attivo: true } },
} as const;

/**
 * Elenca tutti gli utenti, incluso lo stato del profilo collaboratore collegato.
 * Accesso riservato all'amministratore.
 */
export async function elencaUtenti(): Promise<
  UtenteConProfiloCollaboratore[]
> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.utente.findMany({
    orderBy: { nome: "asc" },
    select: selezioneUtenteConProfiloCollaboratore,
  });
}

/**
 * Restituisce un utente per ID con lo stato del profilo collaboratore collegato.
 * Accesso riservato all'amministratore.
 */
export async function utentePerId(
  id: string
): Promise<UtenteConProfiloCollaboratore | null> {
  await richiediRuoloApi("AMMINISTRATORE");

  return db.utente.findUnique({
    where: { id },
    select: selezioneUtenteConProfiloCollaboratore,
  });
}
