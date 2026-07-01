// Modulo di dominio Consuntivi — funzioni pure per calcoli
// Conversioni, rimborsi, totali saranno implementati nelle spec successive.

export { ORE_PER_GIORNATA } from "../types";

// ── Tipi ────────────────────────────────────────────────────────

/** Risultato della validazione delle ore */
export interface RisultatoValidazioneOre {
  valido: boolean;
  valore?: number;
  errore?: string;
}

// ── Validazione ore ─────────────────────────────────────────────

/**
 * Valida una stringa di input utente che rappresenta le ore lavorate.
 *
 * Regole:
 * - La stringa non deve essere vuota
 * - Deve rappresentare un numero valido (dopo normalizzazione virgola → punto)
 * - Il valore deve essere > 0
 * - Il valore non deve superare 24 ore
 *
 * @param input - La stringa inserita dall'utente
 * @returns RisultatoValidazioneOre con esito e, se valido, il valore numerico
 */
export function validaOre(input: string): RisultatoValidazioneOre {
  const normalizzato = input.trim().replace(",", ".");

  if (normalizzato === "") {
    return { valido: false, errore: "Inserisci un valore per le ore" };
  }

  const numero = Number(normalizzato);

  if (isNaN(numero)) {
    return { valido: false, errore: "Valore non valido: inserisci un numero" };
  }

  if (numero <= 0) {
    return { valido: false, errore: "Inserisci un numero maggiore di zero" };
  }

  if (numero > 24) {
    return { valido: false, errore: "Il valore non può superare 24 ore" };
  }

  return { valido: true, valore: numero };
}
