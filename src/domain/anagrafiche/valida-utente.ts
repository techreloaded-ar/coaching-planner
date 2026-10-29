// Modulo di validazione pura per dati utente.
// Nessuna dipendenza da framework — funzioni pure.

import { validaCampoPartitaIva } from "./valida-collaboratore";
import { validaVoceTariffa } from "../tariffe";

/** Dati in ingresso per il censimento di un utente con ruoli combinabili */
export interface DatiCensimentoUtenteInput {
  nome: string;
  email: string;
  ruoloAmministratore: boolean;
  ruoloCollaboratore: boolean;
  cognome: string;
  partitaIva: string;
  /** Tariffa iniziale del profilo collaboratore */
  modalitaTariffa: string;
  importoTariffa: string;
  tariffaValidaDalMese: string;
}

/** Dati in ingresso per la modifica di un utente con ruoli a checkbox */
export interface DatiModificaUtenteInput {
  nome: string;
  email: string;
  ruoloAmministratore: boolean;
  ruoloCollaboratore: boolean;
  cognome: string;
  partitaIva: string;
  /** Tariffa iniziale del profilo collaboratore */
  modalitaTariffa: string;
  importoTariffa: string;
  tariffaValidaDalMese: string;
  profiloPresente: boolean;
}

/** Mappa campo → messaggio di errore. Vuota se la validazione passa. */
export type ErroriValidazione = Record<string, string>;

export const RUOLI_AMMESSI = ["AMMINISTRATORE", "COLLABORATORE"] as const;

const RE_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** Valida la tariffa iniziale del profilo, con chiavi di errore dei campi del form utente. */
function erroriTariffaIniziale(dati: {
  modalitaTariffa: string;
  importoTariffa: string;
  tariffaValidaDalMese: string;
}): ErroriValidazione {
  const errori = validaVoceTariffa({
    validaDalMese: dati.tariffaValidaDalMese,
    modalita: dati.modalitaTariffa,
    importo: dati.importoTariffa,
  });
  const campi: Record<string, string> = {
    validaDalMese: "tariffaValidaDalMese",
    modalita: "modalitaTariffa",
    importo: "importoTariffa",
  };
  return Object.fromEntries(
    Object.entries(errori).map(([campo, messaggio]) => [campi[campo], messaggio]),
  );
}

/**
 * Valida i dati di censimento di un utente con ruoli combinabili
 * (Amministratore e/o Collaboratore).
 *
 * Il cognome è un campo anagrafico ed è sempre obbligatorio, a prescindere
 * dai ruoli selezionati. Quando il ruolo Collaboratore è selezionato, i campi
 * profilo (partita IVA, tariffa iniziale) sono validati con gli identici
 * controlli e messaggi dell'anagrafica collaboratori. Se il ruolo
 * Collaboratore non è selezionato, i campi profilo vengono ignorati.
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

  if (!dati.cognome || dati.cognome.trim() === "") {
    errori.cognome = "Il cognome è obbligatorio";
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
    const errorePartitaIva = validaCampoPartitaIva(dati.partitaIva);
    if (errorePartitaIva) {
      errori.partitaIva = errorePartitaIva;
    }

    Object.assign(errori, erroriTariffaIniziale(dati));
  }

  return errori;
}

/**
 * Valida i dati di modifica di un utente con ruoli a checkbox
 * (Amministratore e/o Collaboratore).
 *
 * Il cognome è un campo anagrafico ed è sempre obbligatorio, a prescindere
 * dai ruoli selezionati e dallo stato del profilo collaboratore. I campi
 * profilo (partita IVA, tariffa iniziale) sono obbligatori e validati con
 * gli identici controlli e messaggi dell'anagrafica collaboratori solo
 * quando il ruolo Collaboratore è selezionato E il profilo collaboratore non
 * è ancora presente (`profiloPresente: false`). Se il profilo esiste già
 * (`profiloPresente: true`) i campi profilo vengono sempre ignorati, così
 * come quando il ruolo Collaboratore non è selezionato.
 *
 * Restituisce `{}` se tutti i controlli passano.
 */
export function validaModificaUtente(
  dati: DatiModificaUtenteInput
): ErroriValidazione {
  const errori: ErroriValidazione = {};

  if (!dati.nome || dati.nome.trim() === "") {
    errori.nome = "Il nome è obbligatorio";
  }

  if (!dati.cognome || dati.cognome.trim() === "") {
    errori.cognome = "Il cognome è obbligatorio";
  }

  if (!dati.email || dati.email.trim() === "") {
    errori.email = "L'email di accesso è obbligatoria";
  } else if (!RE_EMAIL.test(dati.email.trim())) {
    errori.email = "Inserisci un indirizzo email valido";
  }

  if (!dati.ruoloAmministratore && !dati.ruoloCollaboratore) {
    errori.ruoli = "Seleziona almeno un ruolo";
  }

  if (dati.ruoloCollaboratore && !dati.profiloPresente) {
    const errorePartitaIva = validaCampoPartitaIva(dati.partitaIva);
    if (errorePartitaIva) {
      errori.partitaIva = errorePartitaIva;
    }

    Object.assign(errori, erroriTariffaIniziale(dati));
  }

  return errori;
}
