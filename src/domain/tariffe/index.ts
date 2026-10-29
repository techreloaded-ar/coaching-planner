// Storico tariffe dei collaboratori: funzioni pure, nessuna dipendenza da
// framework o Prisma.

import { normalizzaTariffaGiornaliera } from "../anagrafiche/valida-collaboratore";
import { etichettaMeseBreve, mesePrecedente, parseTokenMese } from "../calendario";

export const MODALITA_TARIFFA = ["GIORNALIERA", "FISSO_MENSILE"] as const;
export type ModalitaTariffa = (typeof MODALITA_TARIFFA)[number];

export const ETICHETTA_MODALITA_TARIFFA: Record<ModalitaTariffa, string> = {
  GIORNALIERA: "Giornaliera",
  FISSO_MENSILE: "Fisso mensile",
};

export const UNITA_TARIFFA: Record<ModalitaTariffa, string> = {
  GIORNALIERA: "/ giorno",
  FISSO_MENSILE: "/ mese",
};

/** Tariffa applicata in un mese: modalità e importo (euro, stringa decimale) */
export interface TariffaApplicata {
  modalita: ModalitaTariffa;
  importo: string;
  /** Mese YYYY-MM da cui la tariffa è valida */
  validaDalMese: string;
}

/**
 * Restituisce la voce valida nel mese `mese` (YYYY-MM): quella con il mese di
 * decorrenza più recente non successivo a `mese`. `null` se il mese precede la
 * prima voce. I token YYYY-MM si confrontano correttamente come stringhe.
 */
export function tariffaValidaNelMese<T extends { validaDalMese: string }>(
  voci: readonly T[],
  mese: string,
): T | null {
  let valida: T | null = null;
  for (const voce of voci) {
    if (
      voce.validaDalMese <= mese &&
      (valida === null || voce.validaDalMese > valida.validaDalMese)
    ) {
      valida = voce;
    }
  }
  return valida;
}

// ── Validazione ─────────────────────────────────────────────────

export interface DatiVoceTariffaInput {
  validaDalMese: string;
  modalita: string;
  importo: string;
}

export type ErroriValidazione = Record<string, string>;

export function eModalitaTariffa(valore: string): valore is ModalitaTariffa {
  return (MODALITA_TARIFFA as readonly string[]).includes(valore);
}

/**
 * Valida una voce dello storico tariffe. Le chiavi degli errori sono i nomi
 * dei campi: `validaDalMese`, `modalita`, `importo`.
 */
export function validaVoceTariffa(dati: DatiVoceTariffaInput): ErroriValidazione {
  const errori: ErroriValidazione = {};

  if (!parseTokenMese(dati.validaDalMese.trim())) {
    errori.validaDalMese = "Indica il mese da cui la tariffa è valida";
  }

  if (!eModalitaTariffa(dati.modalita)) {
    errori.modalita = "Scegli la modalità della tariffa";
  }

  if (!dati.importo || dati.importo.trim() === "") {
    errori.importo = "L'importo è obbligatorio";
  } else {
    const importo = normalizzaTariffaGiornaliera(dati.importo);
    if (!importo) {
      errori.importo = "Importo non valido: usa massimo 2 decimali";
    } else if (importo.centesimi <= BigInt(0)) {
      errori.importo = "L'importo deve essere maggiore di zero";
    }
  }

  return errori;
}

export const MESSAGGIO_MESE_TARIFFA_OCCUPATO =
  "Esiste già una tariffa per questo mese: modifica quella";

// ── Etichette ───────────────────────────────────────────────────

/** Etichetta breve di un token YYYY-MM, es. "lug 2026". */
export function etichettaMeseTariffa(token: string): string {
  const parsed = parseTokenMese(token);
  return parsed ? `${etichettaMeseBreve(parsed.mese)} ${parsed.anno}` : token;
}

/**
 * Periodo di validità di ogni voce dello storico, indicizzato per voce.
 * L'ultima voce resta aperta ("→ in corso").
 */
export function periodiDiValidita<T extends { validaDalMese: string }>(
  voci: readonly T[],
): Map<T, string> {
  const ordinate = [...voci].sort((a, b) => a.validaDalMese.localeCompare(b.validaDalMese));
  return new Map(
    ordinate.map((voce, indice) => {
      const successiva = ordinate[indice + 1];
      const inizio = etichettaMeseTariffa(voce.validaDalMese);
      if (!successiva) return [voce, `${inizio} → in corso`];
      const fine = mesePrecedente(successiva.validaDalMese);
      return [
        voce,
        fine === voce.validaDalMese ? inizio : `${inizio} → ${etichettaMeseTariffa(fine)}`,
      ];
    }),
  );
}
