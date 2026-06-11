import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionCookie, deleteSession } from "@/lib/session";
import type { Ruolo } from "@/domain/types";
import type { Utente } from "@/generated/prisma/client";

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
    select: { id: true, ruolo: true, nome: true, email: true },
  });

  if (!utente) return null;

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
 * Se non lo è, reindirizza a /login.
 * Usa React cache per memoizzare la query a DB nella stessa richiesta.
 * Rinnova la scadenza della sessione a ogni utilizzo (sliding).
 */
export const verificaSessione = cache(
  async (): Promise<SessioneUtente> => {
    const sessione = await _risolviSessione();
    if (!sessione) {
      redirect("/login");
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
 * a /login; se ha un ruolo diverso, reindirizza alla propria area.
 */
export const richiediRuolo = cache(
  async (ruoloRichiesto: Ruolo): Promise<SessioneUtente> => {
    const sessione = await verificaSessione();

    if (sessione.ruolo !== ruoloRichiesto) {
      // Reindirizza all'area corretta per il proprio ruolo
      const destinazione =
        sessione.ruolo === "AMMINISTRATORE" ? "/anagrafiche" : "/attivita";
      redirect(destinazione);
    }

    return sessione;
  }
);

/**
 * Server Action di logout: elimina la sessione e reindirizza a /login.
 */
export async function disconnetti(): Promise<void> {
  "use server";
  await deleteSession();
  redirect("/login?logout=1");
}
