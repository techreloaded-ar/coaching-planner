// Modulo di protezione pura per operazioni sugli amministratori.
// Nessuna dipendenza da framework — funzione pura.

import type { Ruolo } from "@/domain/types";

/** Operazione richiesta su un utente. */
export type OperazioneSuUtente =
  | { tipo: "INVALIDAZIONE" }
  | { tipo: "CAMBIO_RUOLO"; nuovoRuolo: Ruolo };

export const MESSAGGIO_ULTIMO_AMMINISTRATORE =
  "Operazione non consentita: è l'ultimo amministratore attivo del sistema";

/**
 * Indica se l'operazione rimuoverebbe l'ultimo amministratore attivo.
 */
export function violaProtezioneUltimoAmministratore(
  utente: { ruolo: Ruolo; attivo: boolean },
  operazione: OperazioneSuUtente,
  altriAmministratoriAttivi: number
): boolean {
  return (
    utente.ruolo === "AMMINISTRATORE" &&
    utente.attivo === true &&
    altriAmministratoriAttivi === 0 &&
    (operazione.tipo === "INVALIDAZIONE" ||
      operazione.nuovoRuolo !== "AMMINISTRATORE")
  );
}
