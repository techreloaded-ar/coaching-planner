import "server-only";

import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  ErroreAutorizzazione,
  richiediSessioneApi,
  risolviProfiloCollaboratoreCorrente,
  type SessioneUtente,
} from "@/lib/dal";
import { HOME_AUTENTICATA } from "@/lib/policy-rotte";
import type { Collaboratore } from "@/generated/prisma/client";

// ── Foglio attività consultato da un amministratore ─────────────
//
// Il foglio attività è di norma quello del collaboratore in sessione. Un
// amministratore può aprire quello di un altro collaboratore indicandone l'id
// nell'URL (`?collaboratore=<id>`): l'id è soltanto una richiesta, e queste
// funzioni sono l'unico punto in cui diventa un collaboratore autorizzato.
// Le letture `...PerCollaboratoreAutorizzato` ricevono quindi l'id da qui o dal
// DAL, mai direttamente dal browser.

/** Messaggio dei rifiuti di scrittura sul foglio di un collaboratore disattivato. */
export const MESSAGGIO_FOGLIO_SOLA_LETTURA =
  "Il collaboratore è disattivato: il suo foglio attività è in sola lettura";

/**
 * Risolve il collaboratore di cui un amministratore consulta il foglio.
 *
 * Lancia ErroreAutorizzazione(401) senza sessione e (403) se l'utente non è
 * amministratore. Restituisce null se il collaboratore non esiste. Un
 * collaboratore disattivato è restituito: la consultazione è ammessa, la
 * modifica no (vedi `MESSAGGIO_FOGLIO_SOLA_LETTURA`).
 */
export async function risolviCollaboratoreConsultato(
  collaboratoreId: string,
  sessioneGiaVerificata?: SessioneUtente
): Promise<Collaboratore | null> {
  const sessione = sessioneGiaVerificata ?? (await richiediSessioneApi());

  if (sessione.ruolo !== "AMMINISTRATORE") {
    throw new ErroreAutorizzazione(
      403,
      "Solo un amministratore può accedere al foglio attività di un altro collaboratore"
    );
  }

  return db.collaboratore.findUnique({ where: { id: collaboratoreId } });
}

/**
 * Collaboratore del foglio richiesto da una route dell'area attività.
 *
 * - senza id: il proprio profilo, solo se attivo; altrimenti
 *   ErroreAutorizzazione(403) "Profilo collaboratore non operativo";
 * - con id: il collaboratore consultato, solo per un amministratore;
 *   null se non esiste.
 */
export async function risolviCollaboratoreDelFoglio(
  collaboratoreIdRichiesto: string | null | undefined
): Promise<Collaboratore | null> {
  if (collaboratoreIdRichiesto) {
    return risolviCollaboratoreConsultato(collaboratoreIdRichiesto);
  }

  const profilo = await risolviProfiloCollaboratoreCorrente();
  if (profilo.stato !== "ATTIVO") {
    throw new ErroreAutorizzazione(403, "Profilo collaboratore non operativo");
  }

  return profilo.collaboratore;
}

/**
 * Collaboratore consultato da una pagina RSC dell'area attività.
 *
 * Senza id restituisce null: la pagina mostra il proprio foglio. Un non
 * amministratore che indica un id viene riportato al proprio foglio; un id
 * inesistente produce la pagina non trovata.
 */
export async function collaboratoreConsultatoDellaPagina(
  sessione: SessioneUtente,
  collaboratoreIdRichiesto: string | undefined
): Promise<Collaboratore | null> {
  if (!collaboratoreIdRichiesto) return null;

  if (sessione.ruolo !== "AMMINISTRATORE") {
    redirect(HOME_AUTENTICATA);
  }

  const collaboratore = await risolviCollaboratoreConsultato(
    collaboratoreIdRichiesto,
    sessione
  );
  if (!collaboratore) {
    notFound();
  }

  return collaboratore;
}

/** Voce del selettore del foglio attività nell'intestazione del front office. */
export interface CollaboratoreDelSelettore {
  id: string;
  nome: string;
  cognome: string;
  attivo: boolean;
}

/**
 * Collaboratori tra cui un amministratore può scegliere il foglio da
 * consultare, ordinati per cognome e nome. Accesso riservato all'amministratore.
 */
export async function collaboratoriDelSelettore(
  sessione: SessioneUtente
): Promise<CollaboratoreDelSelettore[]> {
  if (sessione.ruolo !== "AMMINISTRATORE") {
    throw new ErroreAutorizzazione(403, "Accesso riservato all'amministratore");
  }

  return db.collaboratore.findMany({
    select: { id: true, nome: true, cognome: true, attivo: true },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
}
