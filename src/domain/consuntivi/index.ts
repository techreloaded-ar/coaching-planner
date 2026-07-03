// Modulo di dominio Consuntivi — funzioni pure per calcoli
// Conversioni, rimborsi, totali saranno implementati nelle spec successive.

import { ORE_PER_GIORNATA } from "../types";

export { ORE_PER_GIORNATA };

// ── Tipi ────────────────────────────────────────────────────────

/** Risultato della validazione delle ore */
export interface RisultatoValidazioneOre {
  valido: boolean;
  valore?: number;
  errore?: string;
}

/** Tipo dominio per uno scaglione di rimborso km (senza dipendenze Prisma) */
export interface ScaglioneRimborso {
  finoAKm: number;
  /** Importo forfettario serializzabile (stringa o numero) */
  importo: string | number;
}

/** Risultato della validazione dei km trasferta */
export interface RisultatoValidazioneKm {
  valido: boolean;
  valore?: number;
  errore?: string;
}

/** Stati possibili del calcolo rimborso */
export type StatoCalcoloRimborso = "OK" | "NESSUNO_SCAGLIONE" | "OLTRE_SOGLIA";

/** Risultato del calcolo del rimborso trasferta */
export interface RisultatoCalcoloRimborso {
  stato: StatoCalcoloRimborso;
  messaggio?: string;
  km?: number;
  importo?: string;
  finoAKm?: number;
  labelFascia?: string;
}

/** Riga di input per il riepilogo mensile del collaboratore */
export interface RigaRiepilogo {
  offertaId: string;
  offertaCodice: string;
  offertaDescrizione: string;
  clienteRagioneSociale: string;
  ore: number;
  fatturabile: boolean;
  trasfertaKm: number | null;
}

/** Voce aggregata del riepilogo mensile per offerta */
export interface VoceRiepilogoOfferta {
  offertaId: string;
  offertaCodice: string;
  offertaDescrizione: string;
  clienteRagioneSociale: string;
  oreTotali: number;
  oreFatturabili: number;
  giornateTotali: number;
  giornateFatturabili: number;
  rimborsiTrasferta: string;
}

/** Totali aggregati del riepilogo mensile */
export interface TotaliRiepilogoMese {
  oreTotali: number;
  oreFatturabili: number;
  giornateTotali: number;
  giornateFatturabili: number;
  totaleRimborsi: string;
}

/** Breakdown dell'importo fattura per la UI */
export interface BreakdownRiepilogoMese {
  giornateFatturabili: string;
  tariffaGiornaliera: string;
  imponibileManodopera: string;
  totaleRimborsi: string;
}

/** Struttura di output del riepilogo mensile */
export interface RiepilogoMese {
  perOfferta: VoceRiepilogoOfferta[];
  totali: TotaliRiepilogoMese;
  importoFattura: string;
  breakdown: BreakdownRiepilogoMese;
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

// ── Validazione km trasferta ────────────────────────────────────

const RE_INTERO_POSITIVO = /^\d+$/;

/**
 * Valida una stringa di input utente che rappresenta i km di una trasferta.
 *
 * Regole:
 * - La stringa non deve essere vuota
 * - Deve rappresentare un numero intero positivo
 * - Non accetta decimali, virgole, punti o testo
 *
 * @param input - La stringa inserita dall'utente
 * @returns RisultatoValidazioneKm con esito e, se valido, il valore numerico
 */
export function validaKmTrasferta(input: string): RisultatoValidazioneKm {
  const normalizzato = input.trim();

  if (normalizzato === "") {
    return { valido: false, errore: "Inserisci la distanza in km" };
  }

  if (!RE_INTERO_POSITIVO.test(normalizzato)) {
    return { valido: false, errore: "Inserisci un numero intero di chilometri" };
  }

  const km = parseInt(normalizzato, 10);

  if (km <= 0) {
    return { valido: false, errore: "La distanza deve essere maggiore di zero" };
  }

  return { valido: true, valore: km };
}

// ── Calcolo rimborso trasferta ──────────────────────────────────

/**
 * Calcola il rimborso forfettario per una trasferta in base ai km e agli
 * scaglioni configurati.
 *
 * Ordina gli scaglioni per soglia crescente e seleziona il primo con
 * `finoAKm >= km`.
 *
 * @param km - Distanza percorsa (intero positivo)
 * @param scaglioni - Scaglioni configurati (possono non essere ordinati)
 * @returns RisultatoCalcoloRimborso con stato e dettagli del rimborso
 */
export function calcolaRimborsoTrasferta(
  km: number,
  scaglioni: ScaglioneRimborso[],
): RisultatoCalcoloRimborso {
  if (scaglioni.length === 0) {
    return {
      stato: "NESSUNO_SCAGLIONE",
      messaggio: "Nessuno scaglione di rimborso configurato",
    };
  }

  // Ordina per soglia crescente (copia per non mutare l'originale)
  const ordinati = [...scaglioni].sort((a, b) => a.finoAKm - b.finoAKm);
  const massimo = ordinati[ordinati.length - 1];

  if (km > massimo.finoAKm) {
    return {
      stato: "OLTRE_SOGLIA",
      messaggio: `La distanza supera la soglia massima di ${massimo.finoAKm} km`,
      km,
    };
  }

  const scaglione = ordinati.find((s) => s.finoAKm >= km);

  if (!scaglione) {
    return {
      stato: "NESSUNO_SCAGLIONE",
      messaggio: "Nessuno scaglione applicabile per la distanza indicata",
      km,
    };
  }

  const importoStr = typeof scaglione.importo === "number"
    ? scaglione.importo.toFixed(2)
    : String(scaglione.importo);

  return {
    stato: "OK",
    km,
    importo: importoStr,
    finoAKm: scaglione.finoAKm,
    labelFascia: `fino a ${scaglione.finoAKm} km`,
  };
}

// ── Riepilogo mensile ───────────────────────────────────────────

function formattaImporto(valore: number): string {
  return valore.toFixed(2);
}

/**
 * Aggrega le righe attività del mese per offerta e calcola il riepilogo
 * economico complessivo del collaboratore.
 */
export function calcolaRiepilogoMese(
  righe: RigaRiepilogo[],
  tariffaGiornaliera: string | number,
  scaglioni: ScaglioneRimborso[],
): RiepilogoMese {
  const tariffa = Number(tariffaGiornaliera);
  const tariffaNumerica = Number.isFinite(tariffa) ? tariffa : 0;
  const aggregati = new Map<
    string,
    Omit<VoceRiepilogoOfferta, "rimborsiTrasferta"> & { rimborsiTrasferta: number }
  >();

  let oreTotali = 0;
  let oreFatturabili = 0;
  let totaleRimborsi = 0;

  for (const riga of righe) {
    const voce = aggregati.get(riga.offertaId) ?? {
      offertaId: riga.offertaId,
      offertaCodice: riga.offertaCodice,
      offertaDescrizione: riga.offertaDescrizione,
      clienteRagioneSociale: riga.clienteRagioneSociale,
      oreTotali: 0,
      oreFatturabili: 0,
      giornateTotali: 0,
      giornateFatturabili: 0,
      rimborsiTrasferta: 0,
    };

    voce.oreTotali += riga.ore;
    oreTotali += riga.ore;

    if (riga.fatturabile) {
      voce.oreFatturabili += riga.ore;
      oreFatturabili += riga.ore;
    }

    if (riga.trasfertaKm != null) {
      const rimborso = calcolaRimborsoTrasferta(riga.trasfertaKm, scaglioni);

      if (rimborso.stato === "OK" && rimborso.importo != null) {
        const importoNumerico = Number.parseFloat(rimborso.importo);

        if (!Number.isNaN(importoNumerico)) {
          voce.rimborsiTrasferta += importoNumerico;
          totaleRimborsi += importoNumerico;
        }
      }
    }

    aggregati.set(riga.offertaId, voce);
  }

  const giornateTotali = oreTotali / ORE_PER_GIORNATA;
  const giornateFatturabili = oreFatturabili / ORE_PER_GIORNATA;
  const imponibileManodopera = giornateFatturabili * tariffaNumerica;

  const perOfferta = Array.from(aggregati.values()).map((voce) => ({
    ...voce,
    giornateTotali: voce.oreTotali / ORE_PER_GIORNATA,
    giornateFatturabili: voce.oreFatturabili / ORE_PER_GIORNATA,
    rimborsiTrasferta: formattaImporto(voce.rimborsiTrasferta),
  }));

  return {
    perOfferta,
    totali: {
      oreTotali,
      oreFatturabili,
      giornateTotali,
      giornateFatturabili,
      totaleRimborsi: formattaImporto(totaleRimborsi),
    },
    importoFattura: formattaImporto(imponibileManodopera + totaleRimborsi),
    breakdown: {
      giornateFatturabili: formattaImporto(giornateFatturabili),
      tariffaGiornaliera: formattaImporto(tariffaNumerica),
      imponibileManodopera: formattaImporto(imponibileManodopera),
      totaleRimborsi: formattaImporto(totaleRimborsi),
    },
  };
}
