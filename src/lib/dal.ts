import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionCookie, deleteSession } from "@/lib/session";
import type { Ruolo } from "@/domain/types";
import type { Collaboratore } from "@/generated/prisma/client";
import { homePerRuolo } from "@/lib/policy-rotte";

// ── Tipi ────────────────────────────────────────────────────────

export interface SessioneUtente {
  utenteId: string;
  ruolo: Ruolo;
  nome: string;
  email: string;
}

// ── Helpers privati ─────────────────────────────────────────────

/**
 * Legge la sessione dal cookie e verifica che l'utente esista ancora a DB.
 * Restituisce null se la sessione è assente, scaduta o l'utente non esiste più.
 */
async function _risolviSessione(): Promise<SessioneUtente | null> {
  const cookie = await getSessionCookie();
  if (!cookie) return null;

  // Verifica che l'utente esista ancora
  const utente = await db.utente.findUnique({
    where: { id: cookie.utenteId },
    select: {
      id: true,
      ruolo: true,
      nome: true,
      email: true,
      collaboratore: { select: { attivo: true } },
    },
  });

  if (!utente) return null;

  if (
    utente.ruolo === "COLLABORATORE" &&
    utente.collaboratore &&
    utente.collaboratore.attivo === false
  ) {
    // Collaboratore disattivato → sessione non valida
    return null;
  }

  return {
    utenteId: utente.id,
    ruolo: utente.ruolo as Ruolo,
    nome: utente.nome,
    email: utente.email,
  };
}

// ── API pubbliche ───────────────────────────────────────────────

/**
 * Verifica che l'utente sia autenticato.
 * Se non lo è, reindirizza alla radice (pagina di accesso).
 * Usa React cache per memoizzare la query a DB nella stessa richiesta.
 * Rinnova la scadenza della sessione a ogni utilizzo (sliding).
 */
export const verificaSessione = cache(
  async (): Promise<SessioneUtente> => {
    const sessione = await _risolviSessione();
    if (!sessione) {
      redirect("/");
    }
    // Il rinnovo sliding della scadenza è gestito dal proxy.ts,
    // che ri-firma il JWT con un nuovo exp a ogni richiesta.
    return sessione;
  }
);

/**
 * Restituisce l'utente corrente se autenticato, altrimenti null.
 * Non reindirizza — utile per controlli condizionali.
 */
export const utenteCorrente = cache(
  async (): Promise<SessioneUtente | null> => {
    return _risolviSessione();
  }
);

/**
 * Richiede un ruolo specifico. Se l'utente non è autenticato reindirizza
 * alla radice (pagina di accesso); se ha un ruolo diverso, reindirizza alla propria area.
 * Pensato per l'uso nei layout e nelle pagine RSC.
 */
export const richiediRuolo = cache(
  async (ruoloRichiesto: Ruolo): Promise<SessioneUtente> => {
    const sessione = await verificaSessione();

    if (sessione.ruolo !== ruoloRichiesto) {
      redirect(homePerRuolo(sessione.ruolo));
    }

    return sessione;
  }
);

/**
 * Server Action di logout: elimina la sessione e reindirizza alla radice
 * con il messaggio di disconnessione.
 */
export async function disconnetti(): Promise<void> {
  "use server";
  await deleteSession();
  redirect("/?logout=1");
}

// ── Errore di autorizzazione ────────────────────────────────────

/**
 * Errore lanciato dalle guardie API quando l'utente non è autenticato
 * (401) o non ha il ruolo richiesto (403).
 *
 * Le route handler o le Server Action chiamate via fetch possono
 * catturarlo e restituire la risposta HTTP appropriata.
 */
export class ErroreAutorizzazione extends Error {
  readonly statusCode: 401 | 403;

  constructor(statusCode: 401 | 403, message: string) {
    super(message);
    this.name = "ErroreAutorizzazione";
    this.statusCode = statusCode;
  }
}

// ── Guardie per API / Server Action (lanciano, non reindirizzano) ─

/**
 * Versione API di verificaSessione: lancia ErroreAutorizzazione(401)
 * invece di reindirizzare a /login. Pensata per route handler e
 * Server Action chiamate via fetch.
 */
export async function richiediSessioneApi(): Promise<SessioneUtente> {
  const sessione = await _risolviSessione();
  if (!sessione) {
    throw new ErroreAutorizzazione(401, "Non autenticato");
  }
  return sessione;
}

/**
 * Versione API di richiediRuolo: lancia ErroreAutorizzazione(403)
 * se il ruolo non corrisponde. Pensata per route handler e
 * Server Action chiamate via fetch.
 */
export async function richiediRuoloApi(
  ruoloRichiesto: Ruolo
): Promise<SessioneUtente> {
  const sessione = await richiediSessioneApi();

  if (sessione.ruolo !== ruoloRichiesto) {
    throw new ErroreAutorizzazione(
      403,
      `Ruolo richiesto: ${ruoloRichiesto}, ruolo effettivo: ${sessione.ruolo}`
    );
  }

  return sessione;
}

// ── Profilo Collaboratore ───────────────────────────────────────

/**
 * Risolve il profilo Collaboratore collegato all'utente in sessione.
 *
 * Lancia ErroreAutorizzazione(401) se non autenticato.
 * Restituisce null se l'utente è autenticato ma non ha un profilo
 * Collaboratore associato (es. amministratore puro).
 */
export async function richiediCollaboratoreCorrente(): Promise<Collaboratore | null> {
  const sessione = await richiediSessioneApi();

  const collaboratore = await db.collaboratore.findUnique({
    where: { userId: sessione.utenteId },
  });

  return collaboratore;
}

// ── Segregazione dei dati ───────────────────────────────────────

/**
 * Verifica che l'utente corrente possa accedere ai dati del
 * collaboratore specificato.
 *
 * Regole:
 * - AMMINISTRATORE: accesso pieno a tutti i collaboratori
 * - COLLABORATORE: può accedere solo ai propri dati
 *
 * Lancia ErroreAutorizzazione(401) se non autenticato.
 * Lancia ErroreAutorizzazione(403) se il collaboratore tenta di
 *   accedere ai dati di un altro.
 *
 * @param collaboratoreId - L'ID del collaboratore i cui dati vengono richiesti
 * @returns La sessione dell'utente corrente se autorizzato
 */
export async function verificaAccessoDatiCollaboratore(
  collaboratoreId: string
): Promise<SessioneUtente> {
  const sessione = await richiediSessioneApi();

  // L'amministratore può accedere a tutto
  if (sessione.ruolo === "AMMINISTRATORE") {
    return sessione;
  }

  // Il collaboratore può accedere solo ai propri dati
  const profilo = await db.collaboratore.findUnique({
    where: { userId: sessione.utenteId },
    select: { id: true },
  });

  if (!profilo || profilo.id !== collaboratoreId) {
    throw new ErroreAutorizzazione(
      403,
      "Accesso negato: puoi accedere solo ai tuoi dati"
    );
  }

  return sessione;
}
