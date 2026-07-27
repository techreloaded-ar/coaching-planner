// Modulo di validazione pura per dati utente.
// Nessuna dipendenza da framework — funzioni pure.

import {
  validaCampoPartitaIva,
  validaCampoTariffaGiornaliera,
} from "./valida-collaboratore";

/** Dati in ingresso per la validazione di un utente */
export interface DatiUtenteInput {
  nome: string;
  email: string;
  ruolo: string;
}

/** Dati in ingresso per il censimento di un utente con ruoli combinabili */
export interface DatiCensimentoUtenteInput {
  nome: string;
  email: string;
  ruoloAmministratore: boolean;
  ruoloCollaboratore: boolean;
  cognome: string;
  partitaIva: string;
  tariffaGiornaliera: string;
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

/**
 * Valida i dati di censimento di un utente con ruoli combinabili
 * (Amministratore e/o Collaboratore).
 *
 * Quando il ruolo Collaboratore è selezionato, i campi profilo (cognome,
 * partita IVA, tariffa giornaliera) sono validati con gli identici controlli
 * e messaggi dell'anagrafica collaboratori. Se il ruolo Collaboratore non è
 * selezionato, i campi profilo vengono ignorati.
 *
 * Restituisce `{}` se tutti i controlli passano.
 */
export function validaCensimentoUtente(
  dati: DatiCensimentoUtenteInput
): ErroriValidazione {
  const errori: ErroriValidazione = {};

  if (!dati.nome || dati.nome.trim() === "") {
    errori.nome = "Il nome è obbligatorio";
  }

  if (!dati.email || dati.email.trim() === "") {
    errori.email = "L'email di accesso è obbligatoria";
  } else if (!RE_EMAIL.test(dati.email.trim())) {
    errori.email = "Inserisci un indirizzo email valido";
  }

  if (!dati.ruoloAmministratore && !dati.ruoloCollaboratore) {
    errori.ruoli = "Seleziona almeno un ruolo";
  }

  if (dati.ruoloCollaboratore) {
    if (!dati.cognome || dati.cognome.trim() === "") {
      errori.cognome = "Il cognome è obbligatorio";
    }

    const errorePartitaIva = validaCampoPartitaIva(dati.partitaIva);
    if (errorePartitaIva) {
      errori.partitaIva = errorePartitaIva;
    }

    const erroreTariffa = validaCampoTariffaGiornaliera(
      dati.tariffaGiornaliera
    );
    if (erroreTariffa) {
      errori.tariffaGiornaliera = erroreTariffa;
    }
  }

  return errori;
}
