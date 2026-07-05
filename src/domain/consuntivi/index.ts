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

// ── Avanzamento offerte ──────────────────────────────────────────

/** Soglia di percentuale di utilizzo oltre la quale un'offerta è considerata in allerta */
export const SOGLIA_ALLERTA_UTILIZZO = 0.85;

/** Stati possibili di avanzamento di un'offerta rispetto al budget in giornate previste */
export type StatoAvanzamentoOfferta =
  | "IN_CORSO"
  | "IN_ALLERTA"
  | "ESAURITA"
  | "OLTRE_BUDGET";

/** Metadati di un'offerta ai fini del calcolo dell'avanzamento (dipendenza-zero) */
export interface OffertaAvanzamento {
  offertaId: string;
  offertaCodice: string;
  offertaDescrizione: string;
  clienteId: string;
  clienteRagioneSociale: string;
  giorniPrevisti: number;
}

/** Riga elementare di attività ai fini del calcolo dell'avanzamento */
export interface RigaAvanzamento {
  offertaId: string;
  collaboratoreId: string;
  collaboratoreNome: string;
  ore: number;
  fatturabile: boolean;
}

/** Dettaglio dell'erogato per singolo collaboratore su un'offerta */
export interface VoceCollaboratoreAvanzamento {
  collaboratoreId: string;
  collaboratoreNome: string;
  oreErogate: number;
  giornateErogate: number;
}

/** Voce di avanzamento di una singola offerta */
export interface VoceAvanzamentoOfferta {
  offertaId: string;
  offertaCodice: string;
  offertaDescrizione: string;
  clienteId: string;
  clienteRagioneSociale: string;
  giornatePreviste: number;
  giornateErogate: number;
  residuo: number;
  percentualeUtilizzo: number;
  stato: StatoAvanzamentoOfferta;
  perCollaboratore: VoceCollaboratoreAvanzamento[];
}

/** Report complessivo di avanzamento delle offerte, con totali di riepilogo */
export interface ReportAvanzamentoOfferte {
  perOfferta: VoceAvanzamentoOfferta[];
  totali: {
    giornatePrevisteTotali: number;
    giornateErogateTotali: number;
    residuoTotale: number;
  };
}

/**
 * Calcola l'avanzamento (giornate erogate vs previste) di ciascuna offerta,
 * aggregando le sole ore fatturabili per collaboratore.
 *
 * Funzione pura: nessuna dipendenza da framework o Prisma.
 *
 * @param offerte - Metadati delle offerte da includere nel report (tutte incluse, anche senza attività)
 * @param righe - Righe elementari di attività da aggregare (solo le fatturabili concorrono all'erogato)
 * @returns Report di avanzamento per offerta con totali di riepilogo
 */
export function calcolaAvanzamentoOfferte(
  offerte: OffertaAvanzamento[],
  righe: RigaAvanzamento[],
): ReportAvanzamentoOfferte {
  interface AccumulatoreCollaboratore {
    collaboratoreId: string;
    collaboratoreNome: string;
    oreErogate: number;
  }

  interface AccumulatoreOfferta {
    offertaId: string;
    oreErogateTotali: number;
    collaboratori: Map<string, AccumulatoreCollaboratore>;
  }

  const accumulatori = new Map<string, AccumulatoreOfferta>();

  for (const riga of righe) {
    if (!riga.fatturabile) {
      continue;
    }

    let accumulatoreOfferta = accumulatori.get(riga.offertaId);
    if (!accumulatoreOfferta) {
      accumulatoreOfferta = {
        offertaId: riga.offertaId,
        oreErogateTotali: 0,
        collaboratori: new Map(),
      };
      accumulatori.set(riga.offertaId, accumulatoreOfferta);
    }

    accumulatoreOfferta.oreErogateTotali += riga.ore;

    const accumulatoreCollaboratore = accumulatoreOfferta.collaboratori.get(
      riga.collaboratoreId,
    ) ?? {
      collaboratoreId: riga.collaboratoreId,
      collaboratoreNome: riga.collaboratoreNome,
      oreErogate: 0,
    };
    accumulatoreCollaboratore.oreErogate += riga.ore;
    accumulatoreOfferta.collaboratori.set(riga.collaboratoreId, accumulatoreCollaboratore);
  }

  let giornatePrevisteTotali = 0;
  let giornateErogateTotali = 0;
  let residuoTotale = 0;

  const perOfferta: VoceAvanzamentoOfferta[] = offerte.map((offerta) => {
    const accumulatoreOfferta = accumulatori.get(offerta.offertaId);
    const oreErogate = accumulatoreOfferta?.oreErogateTotali ?? 0;
    const giornateErogate = oreErogate / ORE_PER_GIORNATA;
    const giornatePreviste = offerta.giorniPrevisti;
    const residuo = giornatePreviste - giornateErogate;

    const percentualeUtilizzo =
      giornatePreviste > 0
        ? giornateErogate / giornatePreviste
        : giornateErogate > 0
          ? 1.01
          : 0;

    let stato: StatoAvanzamentoOfferta;
    if (residuo < 0) {
      stato = "OLTRE_BUDGET";
    } else if (residuo === 0 && giornatePreviste > 0) {
      stato = "ESAURITA";
    } else if (percentualeUtilizzo >= SOGLIA_ALLERTA_UTILIZZO && residuo > 0) {
      stato = "IN_ALLERTA";
    } else {
      stato = "IN_CORSO";
    }

    const perCollaboratore: VoceCollaboratoreAvanzamento[] = Array.from(
      accumulatoreOfferta?.collaboratori.values() ?? [],
    )
      .map((collaboratore) => ({
        collaboratoreId: collaboratore.collaboratoreId,
        collaboratoreNome: collaboratore.collaboratoreNome,
        oreErogate: collaboratore.oreErogate,
        giornateErogate: collaboratore.oreErogate / ORE_PER_GIORNATA,
      }))
      .sort((a, b) => {
        if (b.giornateErogate !== a.giornateErogate) {
          return b.giornateErogate - a.giornateErogate;
        }
        return a.collaboratoreNome.localeCompare(b.collaboratoreNome);
      });

    giornatePrevisteTotali += giornatePreviste;
    giornateErogateTotali += giornateErogate;
    residuoTotale += residuo;

    return {
      offertaId: offerta.offertaId,
      offertaCodice: offerta.offertaCodice,
      offertaDescrizione: offerta.offertaDescrizione,
      clienteId: offerta.clienteId,
      clienteRagioneSociale: offerta.clienteRagioneSociale,
      giornatePreviste,
      giornateErogate,
      residuo,
      percentualeUtilizzo,
      stato,
      perCollaboratore,
    };
  });

  perOfferta.sort((a, b) => {
    if (b.percentualeUtilizzo !== a.percentualeUtilizzo) {
      return b.percentualeUtilizzo - a.percentualeUtilizzo;
    }
    return a.offertaCodice.localeCompare(b.offertaCodice);
  });

  return {
    perOfferta,
    totali: {
      giornatePrevisteTotali,
      giornateErogateTotali,
      residuoTotale,
    },
  };
}
