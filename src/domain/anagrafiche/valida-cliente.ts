// Modulo di validazione pura per dati cliente (ADR-006)
// Nessuna dipendenza da framework — funzioni pure.

/** Dati in ingresso per la validazione di un cliente */
export interface DatiClienteInput {
  ragioneSociale: string;
  partitaIva: string;
  codiceFiscale?: string;
  indirizzo?: string;
  citta?: string;
  cap?: string;
  provincia?: string;
  pec?: string;
  codiceDestinatario?: string;
}

/** Mappa campo → messaggio di errore. Vuoto se la validazione passa. */
export type ErroriValidazione = Record<string, string>;

// ---------------------------------------------------------------------------
// Regex pre-compilate (istanziate una volta sola)
// ---------------------------------------------------------------------------

const RE_CIFRE_11 = /^\d{11}$/;
const RE_CIFRE_5 = /^\d{5}$/;
const RE_ALFANUM_16 = /^[A-Z0-9]{16}$/;
const RE_LETTERE_2 = /^[A-Za-z]{2}$/;
const RE_ALFANUM_7 = /^[A-Za-z0-9]{7}$/;
const RE_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// ---------------------------------------------------------------------------
// Validazione
// ---------------------------------------------------------------------------

/**
 * Valida i dati di un cliente e restituisce un oggetto con gli eventuali
 * errori, indicizzati per nome campo.
 *
 * Restituisce `{}` se tutti i controlli passano.
 */
export function validaCliente(dati: DatiClienteInput): ErroriValidazione {
  const errori: ErroriValidazione = {};

  // --- Campi obbligatori ---

  if (!dati.ragioneSociale || dati.ragioneSociale.trim() === "") {
    errori.ragioneSociale = "La ragione sociale è obbligatoria";
  }

  if (!dati.partitaIva || dati.partitaIva.trim() === "") {
    errori.partitaIva = "La partita IVA è obbligatoria";
  } else if (!RE_CIFRE_11.test(dati.partitaIva.trim())) {
    errori.partitaIva = "La partita IVA deve essere di 11 cifre";
  }

  // --- Campi opzionali (validati solo se valorizzati) ---

  if (dati.codiceFiscale && dati.codiceFiscale.trim() !== "") {
    const cf = dati.codiceFiscale.trim().toUpperCase();
    if (!RE_CIFRE_11.test(cf) && !RE_ALFANUM_16.test(cf)) {
      errori.codiceFiscale =
        "Codice fiscale non valido: 11 cifre o 16 caratteri alfanumerici";
    }
  }

  if (dati.cap && dati.cap.trim() !== "") {
    if (!RE_CIFRE_5.test(dati.cap.trim())) {
      errori.cap = "Il CAP è di 5 cifre";
    }
  }

  if (dati.provincia && dati.provincia.trim() !== "") {
    if (!RE_LETTERE_2.test(dati.provincia.trim())) {
      errori.provincia = "Sigla di 2 lettere (es. MI)";
    }
  }

  if (dati.pec && dati.pec.trim() !== "") {
    if (!RE_EMAIL.test(dati.pec.trim())) {
      errori.pec = "Inserisci un indirizzo PEC valido";
    }
  }

  if (dati.codiceDestinatario && dati.codiceDestinatario.trim() !== "") {
    if (!RE_ALFANUM_7.test(dati.codiceDestinatario.trim())) {
      errori.codiceDestinatario =
        "Il codice SDI è di 7 caratteri alfanumerici";
    }
  }

  return errori;
}
