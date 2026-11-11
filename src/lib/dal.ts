import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionCookie, deleteSession } from "@/lib/session";
import type { Ruolo } from "@/domain/types";
import { permessiDelRuolo, type Permesso } from "@/domain/permessi";
import type { Collaboratore } from "@/generated/prisma/client";
import { HOME_AUTENTICATA } from "@/lib/policy-rotte";

// ── Tipi ────────────────────────────────────────────────────────

export interface SessioneUtente {
  utenteId: string;
  ruolo: Ruolo;
  nome: string;
  email: string;
  /** Permessi derivati dal ruolo riletto a DB a ogni richiesta */
  permessi: readonly Permesso[];
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
      cognome: true,
      email: true,
      attivo: true,
      collaboratore: { select: { attivo: true } },
    },
  });

  if (!utente) return null;

  if (utente.attivo === false) {
    // Utente disattivato → sessione non valida
    return null;
  }

  if (
    utente.ruolo === "COLLABORATORE" &&
    utente.collaboratore &&
    utente.collaboratore.attivo === false
  ) {
    // Collaboratore disattivato → sessione non valida
    return null;
  }

  // Ruolo e permessi dal record a DB, mai dal cookie
  const ruolo = utente.ruolo as Ruolo;
  return {
    utenteId: utente.id,
    ruolo,
    nome: `${utente.nome} ${utente.cognome}`,
    email: utente.email,
    permessi: permessiDelRuolo(ruolo),
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
 * Richiede un permesso del catalogo.
 *
 * Se l'utente non è autenticato reindirizza alla radice (pagina di accesso);
 * senza il permesso richiesto reindirizza all'area autenticata comune.
 * Pensato per l'uso nei layout e nelle pagine RSC.
 */
export const richiediPermesso = cache(
  async (permesso: Permesso): Promise<SessioneUtente> => {
    const sessione = await verificaSessione();
    if (!sessione.permessi.includes(permesso)) {
      redirect(HOME_AUTENTICATA);
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
 * (401) o non ha il permesso richiesto (403).
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
 * invece di reindirizzare alla radice pubblica. Pensata per route handler e
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
 * Versione API di richiediPermesso: lancia ErroreAutorizzazione(401) senza
 * sessione e ErroreAutorizzazione(403) senza il permesso richiesto. Pensata
 * per route handler e Server Action chiamate via fetch.
 */
export async function richiediPermessoApi(
  permesso: Permesso
): Promise<SessioneUtente> {
  const sessione = await richiediSessioneApi();
  if (!sessione.permessi.includes(permesso)) {
    throw new ErroreAutorizzazione(403, `Permesso richiesto: ${permesso}`);
  }
  return sessione;
}

/**
 * Variante di richiediPermessoApi per le query condivise tra aree: basta uno
 * qualsiasi dei permessi ammessi. 401 senza sessione, 403 se non ne ha nessuno.
 */
export async function richiediAlmenoUnPermessoApi(
  permessiAmmessi: readonly Permesso[]
): Promise<SessioneUtente> {
  const sessione = await richiediSessioneApi();
  if (!permessiAmmessi.some((p) => sessione.permessi.includes(p))) {
    throw new ErroreAutorizzazione(
      403,
      `Permesso richiesto: uno tra ${permessiAmmessi.join(", ")}`
    );
  }
  return sessione;
}

// ── Profilo Collaboratore ───────────────────────────────────────

/** Stato del profilo Collaboratore dell'utente autenticato corrente. */
export type StatoProfiloCollaboratore =
  | { stato: "ATTIVO"; collaboratore: Collaboratore }
  | { stato: "ASSENTE" }
  | { stato: "DISATTIVATO" };

/**
 * Risolve il profilo Collaboratore collegato all'utente in sessione.
 *
 * Lancia ErroreAutorizzazione(401) se non autenticato. Un amministratore può
 * mantenere la sessione anche se il suo profilo è disattivato: in quel caso
 * il risultato consente al front office di mostrare uno stato esplicativo,
 * senza rendere il profilo utilizzabile per attività.
 *
 * @param sessioneGiaVerificata - Sessione già risolta e verificata dal
 *   chiamante (per esempio da `verificaSessione` in una pagina RSC). Quando è
 *   fornita, il profilo viene letto senza ripetere la risoluzione della
 *   sessione: un round-trip in meno sul percorso caldo. Senza argomento il
 *   comportamento è invariato, sessione inclusa.
 */
export async function risolviProfiloCollaboratoreCorrente(
  sessioneGiaVerificata?: SessioneUtente
): Promise<StatoProfiloCollaboratore> {
  const sessione = sessioneGiaVerificata ?? (await richiediSessioneApi());
  const collaboratore = await db.collaboratore.findUnique({
    where: { userId: sessione.utenteId },
  });

  if (!collaboratore) {
    return { stato: "ASSENTE" };
  }

  if (!collaboratore.attivo) {
    return { stato: "DISATTIVATO" };
  }

  return { stato: "ATTIVO", collaboratore };
}

/**
 * Restituisce il solo profilo Collaboratore operativo dell'utente corrente.
 *
 * Lancia ErroreAutorizzazione(401) se non autenticato. Per un profilo assente
 * o disattivato restituisce null, così letture e mutazioni non possono usare
 * un collaboratore non operativo.
 */
export async function richiediCollaboratoreCorrente(): Promise<Collaboratore | null> {
  const profilo = await risolviProfiloCollaboratoreCorrente();
  return profilo.stato === "ATTIVO" ? profilo.collaboratore : null;
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
