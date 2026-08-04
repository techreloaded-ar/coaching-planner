// Intestazioni e costruzione delle risposte HTTP che trasportano dati del
// collaboratore autenticato.
//
// Questo modulo NON tocca il database e non risolve la sessione: contiene
// soltanto la convenzione di risposta condivisa dai confini dati dell'area
// attività (`/api/attivita/calendario`, `/api/attivita/giornata`,
// `/api/attivita/contesto-inserimento`, `/api/attivita/offerte-cliente`),
// così le quattro route non possono divergere sulle intestazioni.

import { NextResponse } from "next/server";

/**
 * Intestazioni delle risposte con dati del collaboratore.
 *
 * `private, no-store` impedisce qualunque cache HTTP condivisa o del browser:
 * la finestra di staleness della scheda è governata **esclusivamente** dalla
 * cache client in memoria, non da una seconda cache implicita.
 * `Vary: Cookie` evita che un'infrastruttura intermedia consideri equivalenti
 * risposte appartenenti a sessioni diverse.
 */
export const INTESTAZIONI_DATI_PRIVATI = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
} as const;

/**
 * Costruisce una risposta JSON con le intestazioni dei dati privati.
 *
 * @param corpo - Corpo serializzabile della risposta (DTO oppure `{ errore }`)
 * @param status - Codice di stato HTTP dell'esito
 * @returns Risposta JSON con `Cache-Control: private, no-store` e `Vary: Cookie`
 */
export function rispostaDatiPrivati(
  corpo: unknown,
  status: number
): NextResponse {
  return NextResponse.json(corpo, {
    status,
    headers: INTESTAZIONI_DATI_PRIVATI,
  });
}
