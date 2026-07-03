// Modulo di dominio Consuntivi — funzioni pure per calcoli
// Conversioni, rimborsi, totali saranno implementati nelle spec successive.

import { ORE_PER_GIORNATA } from "../types";

export { ORE_PER_GIORNATA } from "../types";

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

// ── Report fatturazione clienti ─────────────────────────────────

/**
 * Riga elementare di attività per il report di fatturazione (dipendenza-zero).
 * Rappresenta un contributo di un collaboratore su una offerta di un cliente.
 */
export interface RigaReportFatturazione {
  clienteId: string;
  clienteRagioneSociale: string;
  offertaId: string;
  offertaCodice: string;
  offertaDescrizione: string;
  /** Tariffa giornaliera dell'offerta (serializzabile come stringa o numero) */
  tariffaOffertaGiornaliera: string | number;
  ore: number;
  fatturabile: boolean;
  trasfertaKm: number | null;
}

/** Voce di dettaglio di una singola offerta nel report cliente */
export interface VoceOffertaReport {
  offertaId: string;
  offertaCodice: string;
  offertaDescrizione: string;
  tariffaGiornaliera: string;
  giornateFatturabili: number;
  imponibile: string;
}

/** Voce di report aggregata per singolo cliente */
export interface VoceClienteReport {
  clienteId: string;
  clienteRagioneSociale: string;
  perOfferta: VoceOffertaReport[];
  rimborsiTrasferta: string;
  imponibileManodopera: string;
  importoTotale: string;
}

/** Report complessivo di fatturazione, per cliente e con totali di riepilogo */
export interface ReportFatturazioneClienti {
  perCliente: VoceClienteReport[];
  totali: {
    imponibileManodopera: string;
    totaleRimborsi: string;
    importoTotale: string;
  };
}

/**
 * Aggrega le righe attività del mese (di tutti i collaboratori) per cliente e,
 * dentro ogni cliente, per offerta, calcolando l'importo da fatturare con la
 * tariffa dell'offerta e ribaltando i rimborsi trasferta al cliente.
 *
 * Funzione pura: nessuna dipendenza da framework o Prisma.
 *
 * @param righe - Righe elementari di attività da aggregare
 * @param scaglioni - Scaglioni per il calcolo dei rimborsi trasferta
 * @returns Report per cliente con totali di riepilogo
 */
export function calcolaReportFatturazioneClienti(
  righe: RigaReportFatturazione[],
  scaglioni: ScaglioneRimborso[],
): ReportFatturazioneClienti {
  interface AccumulatoreOfferta {
    offertaId: string;
    offertaCodice: string;
    offertaDescrizione: string;
    tariffaGiornaliera: number;
    oreFatturabili: number;
  }

  interface AccumulatoreCliente {
    clienteId: string;
    clienteRagioneSociale: string;
    offerte: Map<string, AccumulatoreOfferta>;
    rimborsiTrasferta: number;
  }

  const clienti = new Map<string, AccumulatoreCliente>();

  for (const riga of righe) {
    let cliente = clienti.get(riga.clienteId);
    if (!cliente) {
      cliente = {
        clienteId: riga.clienteId,
        clienteRagioneSociale: riga.clienteRagioneSociale,
        offerte: new Map(),
        rimborsiTrasferta: 0,
      };
      clienti.set(riga.clienteId, cliente);
    }

    let offerta = cliente.offerte.get(riga.offertaId);
    if (!offerta) {
      offerta = {
        offertaId: riga.offertaId,
        offertaCodice: riga.offertaCodice,
        offertaDescrizione: riga.offertaDescrizione,
        tariffaGiornaliera: Number(riga.tariffaOffertaGiornaliera),
        oreFatturabili: 0,
      };
      cliente.offerte.set(riga.offertaId, offerta);
    }

    if (riga.fatturabile) {
      offerta.oreFatturabili += riga.ore;
    }

    if (riga.trasfertaKm != null) {
      const rimborso = calcolaRimborsoTrasferta(riga.trasfertaKm, scaglioni);
      if (rimborso.stato === "OK" && rimborso.importo != null) {
        cliente.rimborsiTrasferta += parseFloat(rimborso.importo);
      }
    }
  }

  let totaleImponibileManodopera = 0;
  let totaleRimborsi = 0;
  let totaleImporto = 0;

  const perCliente: VoceClienteReport[] = [];

  for (const cliente of clienti.values()) {
    const perOfferta: VoceOffertaReport[] = [];
    let imponibileManodoperaCliente = 0;

    for (const offerta of cliente.offerte.values()) {
      const giornateFatturabili = offerta.oreFatturabili / ORE_PER_GIORNATA;
      const imponibile = giornateFatturabili * offerta.tariffaGiornaliera;

      if (giornateFatturabili > 0) {
        imponibileManodoperaCliente += imponibile;
        perOfferta.push({
          offertaId: offerta.offertaId,
          offertaCodice: offerta.offertaCodice,
          offertaDescrizione: offerta.offertaDescrizione,
          tariffaGiornaliera: offerta.tariffaGiornaliera.toFixed(2),
          giornateFatturabili,
          imponibile: imponibile.toFixed(2),
        });
      }
    }

    const rimborsiCliente = cliente.rimborsiTrasferta;

    if (perOfferta.length === 0 && rimborsiCliente <= 0) {
      continue;
    }

    perOfferta.sort((a, b) => a.offertaCodice.localeCompare(b.offertaCodice));

    const importoTotaleCliente = imponibileManodoperaCliente + rimborsiCliente;

    perCliente.push({
      clienteId: cliente.clienteId,
      clienteRagioneSociale: cliente.clienteRagioneSociale,
      perOfferta,
      rimborsiTrasferta: rimborsiCliente.toFixed(2),
      imponibileManodopera: imponibileManodoperaCliente.toFixed(2),
      importoTotale: importoTotaleCliente.toFixed(2),
    });

    totaleImponibileManodopera += imponibileManodoperaCliente;
    totaleRimborsi += rimborsiCliente;
    totaleImporto += importoTotaleCliente;
  }

  perCliente.sort((a, b) =>
    a.clienteRagioneSociale.localeCompare(b.clienteRagioneSociale),
  );

  return {
    perCliente,
    totali: {
      imponibileManodopera: totaleImponibileManodopera.toFixed(2),
      totaleRimborsi: totaleRimborsi.toFixed(2),
      importoTotale: totaleImporto.toFixed(2),
    },
  };
}
