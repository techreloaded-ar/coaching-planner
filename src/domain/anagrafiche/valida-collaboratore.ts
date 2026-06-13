// Modulo di validazione pura per dati collaboratore (ADR-006)
// Nessuna dipendenza da framework — funzioni pure.

/** Dati in ingresso per la validazione di un collaboratore */
export interface DatiCollaboratoreInput {
  nome: string;
  cognome: string;
  email: string;
  partitaIva: string;
  tariffaGiornaliera: string;
}

/** Mappa campo → messaggio di errore. Vuota se la validazione passa. */
export type ErroriValidazione = Record<string, string>;

// ---------------------------------------------------------------------------
// Regex pre-compilate (istanziate una volta sola)
// ---------------------------------------------------------------------------

const RE_CIFRE_11 = /^\d{11}$/;
const RE_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const RE_IMPORTO = /^\d+(?:[.,]\d{1,2})?$/;

// ---------------------------------------------------------------------------
// Normalizzazione tariffa
// ---------------------------------------------------------------------------

export interface TariffaNormalizzata {
  valore: string;
  centesimi: bigint;
}

/**
 * Normalizza un importo decimale nel formato Prisma-friendly `123.45`.
 * Accetta sia virgola italiana sia punto come separatore decimale.
 */
export function normalizzaTariffaGiornaliera(
  valore: string
): TariffaNormalizzata | null {
  const pulito = valore.trim().replace(/\s+/g, "");

  if (!RE_IMPORTO.test(pulito)) {
    return null;
  }

  const [interaRaw, decimaleRaw = ""] = pulito.replace(",", ".").split(".");
  const intera = String(BigInt(interaRaw));
  const decimale = decimaleRaw.padEnd(2, "0");
  const centesimi = BigInt(intera) * BigInt(100) + BigInt(decimale);

  return {
    valore: `${intera}.${decimale}`,
    centesimi,
  };
}

// ---------------------------------------------------------------------------
// Validazione
// ---------------------------------------------------------------------------

/**
 * Valida i dati di un collaboratore e restituisce un oggetto con gli
 * eventuali errori, indicizzati per nome campo.
 *
 * Restituisce `{}` se tutti i controlli passano.
 */
export function validaCollaboratore(
  dati: DatiCollaboratoreInput
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

  if (!dati.partitaIva || dati.partitaIva.trim() === "") {
    errori.partitaIva = "La partita IVA è obbligatoria";
  } else if (!RE_CIFRE_11.test(dati.partitaIva.trim())) {
    errori.partitaIva = "La partita IVA deve essere di 11 cifre";
  }

  if (!dati.tariffaGiornaliera || dati.tariffaGiornaliera.trim() === "") {
    errori.tariffaGiornaliera = "La tariffa giornaliera è obbligatoria";
  } else {
    const tariffa = normalizzaTariffaGiornaliera(dati.tariffaGiornaliera);

    if (!tariffa) {
      errori.tariffaGiornaliera =
        "Importo non valido: usa massimo 2 decimali";
    } else if (tariffa.centesimi <= BigInt(0)) {
      errori.tariffaGiornaliera =
        "La tariffa giornaliera deve essere maggiore di zero";
    }
  }

  return errori;
}
