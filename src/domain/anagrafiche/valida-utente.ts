// Modulo di validazione pura per dati utente.
// Nessuna dipendenza da framework — funzioni pure.

/** Dati in ingresso per la validazione di un utente */
export interface DatiUtenteInput {
  nome: string;
  email: string;
  ruolo: string;
}

/** Mappa campo → messaggio di errore. Vuota se la validazione passa. */
export type ErroriValidazione = Record<string, string>;

export const RUOLI_AMMESSI = ["AMMINISTRATORE", "COLLABORATORE"] as const;

const RE_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Valida i dati di un utente e restituisce un oggetto con gli eventuali
 * errori, indicizzati per nome campo.
 *
 * Restituisce `{}` se tutti i controlli passano.
 */
export function validaUtente(dati: DatiUtenteInput): ErroriValidazione {
  const errori: ErroriValidazione = {};

  if (!dati.nome || dati.nome.trim() === "") {
    errori.nome = "Il nome è obbligatorio";
  }

  if (!dati.email || dati.email.trim() === "") {
    errori.email = "L'email di accesso è obbligatoria";
  } else if (!RE_EMAIL.test(dati.email.trim())) {
    errori.email = "Inserisci un indirizzo email valido";
  }

  if (
    !dati.ruolo ||
    !RUOLI_AMMESSI.includes(
      dati.ruolo as (typeof RUOLI_AMMESSI)[number]
    )
  ) {
    errori.ruolo = "Seleziona un ruolo valido";
  }

  return errori;
}
