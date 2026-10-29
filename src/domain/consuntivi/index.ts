// Modulo di dominio Consuntivi — funzioni pure per calcoli
// Conversioni, rimborsi, totali saranno implementati nelle spec successive.

import {
  CATEGORIE_ATTIVITA,
  CENTESIMI_PER_GIORNATA,
  fatturataAlCliente,
  fatturataDalCollaboratore,
  ORE_PER_GIORNATA,
  eNumeroDecimale,
  haPiuDiDueDecimali,
  MESSAGGIO_ORE_TROPPI_DECIMALI,
  oreInCentesimi,
  sommaOre,
  type CategoriaAttivita,
  type GestioneTrasferta,
} from "../types";
import type { ModalitaTariffa, TariffaApplicata } from "../tariffe";

export { ORE_PER_GIORNATA, MESSAGGIO_ORE_TROPPI_DECIMALI };

// ── Tipi ────────────────────────────────────────────────────────

/** Risultato della validazione delle ore */
export interface RisultatoValidazioneOre {
  valido: boolean;
  valore?: number;
  errore?: string;
}

/** Riga di input per il riepilogo mensile del collaboratore */
export interface RigaRiepilogo {
  offertaId: string;
  offertaCodice: string;
  offertaDescrizione: string;
  clienteRagioneSociale: string;
  ore: number;
  categoria: CategoriaAttivita;
  /** Importo del rimborso trasferta fotografato sulla riga (serializzabile) */
  rimborsoTrasfertaImporto: string | number | null;
}

/** Ore suddivise per categoria di attività */
export type OrePerCategoria = Record<CategoriaAttivita, number>;

/**
 * Voce aggregata del riepilogo mensile per offerta.
 * "Da fatturare" = ore che il collaboratore fattura ad Agile Reloaded
 * (Fatturabile + Non fatturabile).
 */
export interface VoceRiepilogoOfferta {
  offertaId: string;
  offertaCodice: string;
  offertaDescrizione: string;
  clienteRagioneSociale: string;
  oreTotali: number;
  orePerCategoria: OrePerCategoria;
  oreDaFatturare: number;
  giornateTotali: number;
  giornateDaFatturare: number;
  rimborsiTrasferta: string;
}

/** Totali aggregati del riepilogo mensile */
export interface TotaliRiepilogoMese {
  oreTotali: number;
  orePerCategoria: OrePerCategoria;
  oreDaFatturare: number;
  giornateTotali: number;
  giornateDaFatturare: number;
  totaleRimborsi: string;
}

/** Breakdown dell'importo fattura per la UI */
export interface BreakdownRiepilogoMese {
  giornateDaFatturare: string;
  /** Modalità della tariffa valida nel mese; null se il mese precede la prima tariffa */
  modalitaTariffa: ModalitaTariffa | null;
  /** Importo della tariffa: euro al giorno (giornaliera) o al mese (fisso) */
  importoTariffa: string;
  /** Mese YYYY-MM da cui vale la tariffa applicata */
  tariffaValidaDalMese: string | null;
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
 * - Al massimo due decimali significativi (la precisione di salvataggio)
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

  if (isNaN(numero) || !eNumeroDecimale(normalizzato)) {
    return { valido: false, errore: "Valore non valido: inserisci un numero" };
  }

  if (numero <= 0) {
    return { valido: false, errore: "Inserisci un numero maggiore di zero" };
  }

  if (numero > 24) {
    return { valido: false, errore: "Il valore non può superare 24 ore" };
  }

  if (haPiuDiDueDecimali(normalizzato)) {
    return { valido: false, errore: MESSAGGIO_ORE_TROPPI_DECIMALI };
  }

  return { valido: true, valore: numero };
}

// ── Riepilogo mensile ───────────────────────────────────────────

function formattaImporto(valore: number): string {
  return valore.toFixed(2);
}

export function orePerCategoriaVuote(): OrePerCategoria {
  return Object.fromEntries(
    CATEGORIE_ATTIVITA.map((categoria) => [categoria, 0]),
  ) as OrePerCategoria;
}

/**
 * Aggrega le righe attività del mese per offerta e calcola il riepilogo
 * economico complessivo del collaboratore con la tariffa valida nel mese.
 * Giornaliera: il compenso considera le ore Fatturabile e Non fatturabile,
 * mai quelle di Investimento. Fisso mensile: il compenso è il fisso, a
 * prescindere dalle ore. Senza tariffa il compenso è zero.
 */
export function calcolaRiepilogoMese(
  righe: RigaRiepilogo[],
  tariffa: TariffaApplicata | null,
): RiepilogoMese {
  const importo = Number(tariffa?.importo);
  const tariffaNumerica = Number.isFinite(importo) ? importo : 0;
  const aggregati = new Map<
    string,
    Omit<VoceRiepilogoOfferta, "rimborsiTrasferta"> & { rimborsiTrasferta: number }
  >();

  let oreTotali = 0;
  let oreDaFatturare = 0;
  const orePerCategoria = orePerCategoriaVuote();
  let totaleRimborsi = 0;

  for (const riga of righe) {
    const voce = aggregati.get(riga.offertaId) ?? {
      offertaId: riga.offertaId,
      offertaCodice: riga.offertaCodice,
      offertaDescrizione: riga.offertaDescrizione,
      clienteRagioneSociale: riga.clienteRagioneSociale,
      oreTotali: 0,
      orePerCategoria: orePerCategoriaVuote(),
      oreDaFatturare: 0,
      giornateTotali: 0,
      giornateDaFatturare: 0,
      rimborsiTrasferta: 0,
    };

    voce.oreTotali = sommaOre(voce.oreTotali, riga.ore);
    oreTotali = sommaOre(oreTotali, riga.ore);
    voce.orePerCategoria[riga.categoria] = sommaOre(voce.orePerCategoria[riga.categoria], riga.ore);
    orePerCategoria[riga.categoria] = sommaOre(orePerCategoria[riga.categoria], riga.ore);

    if (fatturataDalCollaboratore(riga.categoria)) {
      voce.oreDaFatturare = sommaOre(voce.oreDaFatturare, riga.ore);
      oreDaFatturare = sommaOre(oreDaFatturare, riga.ore);
    }

    if (riga.rimborsoTrasfertaImporto != null) {
      const importoNumerico = Number(riga.rimborsoTrasfertaImporto);

      if (!Number.isNaN(importoNumerico)) {
        voce.rimborsiTrasferta += importoNumerico;
        totaleRimborsi += importoNumerico;
      }
    }

    aggregati.set(riga.offertaId, voce);
  }

  const giornateTotali = oreTotali / ORE_PER_GIORNATA;
  const giornateDaFatturare = oreDaFatturare / ORE_PER_GIORNATA;
  const imponibileManodopera =
    tariffa?.modalita === "FISSO_MENSILE"
      ? tariffaNumerica
      : giornateDaFatturare * tariffaNumerica;

  const perOfferta = Array.from(aggregati.values()).map((voce) => ({
    ...voce,
    giornateTotali: voce.oreTotali / ORE_PER_GIORNATA,
    giornateDaFatturare: voce.oreDaFatturare / ORE_PER_GIORNATA,
    rimborsiTrasferta: formattaImporto(voce.rimborsiTrasferta),
  }));

  return {
    perOfferta,
    totali: {
      oreTotali,
      orePerCategoria,
      oreDaFatturare,
      giornateTotali,
      giornateDaFatturare,
      totaleRimborsi: formattaImporto(totaleRimborsi),
    },
    importoFattura: formattaImporto(imponibileManodopera + totaleRimborsi),
    breakdown: {
      giornateDaFatturare: formattaImporto(giornateDaFatturare),
      modalitaTariffa: tariffa?.modalita ?? null,
      importoTariffa: formattaImporto(tariffaNumerica),
      tariffaValidaDalMese: tariffa?.validaDalMese ?? null,
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
  /** Identificativo del collaboratore autore della riga */
  collaboratoreId: string;
  /** Nome completo del collaboratore autore della riga */
  collaboratoreNome: string;
  ore: number;
  /** Agile Reloaded fattura la riga al cliente (categoria Fatturabile) */
  fatturabile: boolean;
  /** Importo del rimborso trasferta fotografato sulla riga (serializzabile) */
  rimborsoTrasfertaImporto: string | number | null;
  /** Giorno della riga (YYYY-MM-DD): serve a contare i giorni di trasferta */
  data: string;
  /** Come l'offerta fattura le trasferte al cliente */
  gestioneTrasfertaOfferta: GestioneTrasferta;
  /** Importo per giorno di trasferta dell'offerta; null se inclusa */
  importoTrasfertaForfettariaOfferta: string | number | null;
}

/** Dettaglio fatturabile di un collaboratore all'interno di una singola offerta */
export interface VoceCollaboratoreOffertaReport {
  collaboratoreId: string;
  collaboratoreNome: string;
  oreFatturabili: number;
  giornateFatturabili: number;
  imponibile: string;
}

/** Voce di dettaglio di una singola offerta nel report cliente */
export interface VoceOffertaReport {
  offertaId: string;
  offertaCodice: string;
  offertaDescrizione: string;
  tariffaGiornaliera: string;
  giornateFatturabili: number;
  imponibile: string;
  /** Combinazioni distinte collaboratore + giorno con rimborso trasferta (solo offerte forfettarie) */
  giorniTrasferta: number;
  /** Importo per giorno di trasferta; null se la trasferta è inclusa nella tariffa */
  importoTrasfertaForfettaria: string | null;
  /** giorniTrasferta × importoTrasfertaForfettaria */
  importoTrasferte: string;
  perCollaboratore: VoceCollaboratoreOffertaReport[];
}

/** Voce di report aggregata per singolo cliente */
export interface VoceClienteReport {
  clienteId: string;
  clienteRagioneSociale: string;
  perOfferta: VoceOffertaReport[];
  trasferteForfettarie: string;
  imponibileManodopera: string;
  importoTotale: string;
}

/** Report complessivo di fatturazione, per cliente e con totali di riepilogo */
export interface ReportFatturazioneClienti {
  perCliente: VoceClienteReport[];
  totali: {
    imponibileManodopera: string;
    totaleTrasferteForfettarie: string;
    importoTotale: string;
  };
}

/**
 * Aggrega le righe attività del mese (di tutti i collaboratori) per cliente e,
 * dentro ogni cliente, per offerta, calcolando l'importo da fatturare con la
 * tariffa dell'offerta e le trasferte forfettarie secondo la gestione
 * trasferte dell'offerta. I rimborsi pagati ai collaboratori non sono
 * ribaltati al cliente: segnano solo i giorni di trasferta.
 *
 * Funzione pura: nessuna dipendenza da framework o Prisma.
 *
 * @param righe - Righe elementari di attività da aggregare
 * @returns Report per cliente con totali di riepilogo
 */
export function calcolaReportFatturazioneClienti(
  righe: RigaReportFatturazione[],
): ReportFatturazioneClienti {
  interface AccumulatoreCollaboratoreOfferta {
    collaboratoreId: string;
    collaboratoreNome: string;
    oreFatturabili: number;
  }

  interface AccumulatoreOfferta {
    offertaId: string;
    offertaCodice: string;
    offertaDescrizione: string;
    tariffaGiornaliera: number;
    oreFatturabili: number;
    collaboratori: Map<string, AccumulatoreCollaboratoreOfferta>;
    importoTrasfertaForfettaria: number | null;
    /** Chiavi "collaboratoreId|data" dei giorni di trasferta */
    giorniTrasferta: Set<string>;
  }

  interface AccumulatoreCliente {
    clienteId: string;
    clienteRagioneSociale: string;
    offerte: Map<string, AccumulatoreOfferta>;
  }

  const clienti = new Map<string, AccumulatoreCliente>();

  for (const riga of righe) {
    let cliente = clienti.get(riga.clienteId);
    if (!cliente) {
      cliente = {
        clienteId: riga.clienteId,
        clienteRagioneSociale: riga.clienteRagioneSociale,
        offerte: new Map(),
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
        collaboratori: new Map(),
        importoTrasfertaForfettaria:
          riga.gestioneTrasfertaOfferta === "FORFETTARIA" &&
          riga.importoTrasfertaForfettariaOfferta != null
            ? Number(riga.importoTrasfertaForfettariaOfferta)
            : null,
        giorniTrasferta: new Set(),
      };
      cliente.offerte.set(riga.offertaId, offerta);
    }

    if (riga.fatturabile) {
      offerta.oreFatturabili = sommaOre(offerta.oreFatturabili, riga.ore);

      const collaboratore = offerta.collaboratori.get(riga.collaboratoreId) ?? {
        collaboratoreId: riga.collaboratoreId,
        collaboratoreNome: riga.collaboratoreNome,
        oreFatturabili: 0,
      };
      collaboratore.oreFatturabili = sommaOre(collaboratore.oreFatturabili, riga.ore);
      offerta.collaboratori.set(riga.collaboratoreId, collaboratore);
    }

    // Qualunque categoria: conta che il collaboratore fosse in trasferta
    if (
      riga.rimborsoTrasfertaImporto != null &&
      offerta.importoTrasfertaForfettaria !== null
    ) {
      offerta.giorniTrasferta.add(`${riga.collaboratoreId}|${riga.data}`);
    }
  }

  let totaleImponibileManodopera = 0;
  let totaleTrasferteForfettarie = 0;
  let totaleImporto = 0;

  const perCliente: VoceClienteReport[] = [];

  for (const cliente of clienti.values()) {
    const perOfferta: VoceOffertaReport[] = [];
    let imponibileManodoperaCliente = 0;
    let trasferteForfettarieCliente = 0;
    const imponibileGrezzoPerVoce = new Map<
      VoceCollaboratoreOffertaReport,
      number
    >();

    for (const offerta of cliente.offerte.values()) {
      const giornateFatturabili = offerta.oreFatturabili / ORE_PER_GIORNATA;
      const imponibile = giornateFatturabili * offerta.tariffaGiornaliera;
      const giorniTrasferta = offerta.giorniTrasferta.size;
      // In centesimi interi: giorni × importo senza errori di virgola mobile
      const importoTrasferte =
        offerta.importoTrasfertaForfettaria === null
          ? 0
          : (Math.round(offerta.importoTrasfertaForfettaria * 100) *
              giorniTrasferta) /
            100;

      if (giornateFatturabili > 0 || importoTrasferte > 0) {
        imponibileManodoperaCliente += imponibile;
        trasferteForfettarieCliente += importoTrasferte;

        const perCollaboratore: VoceCollaboratoreOffertaReport[] = Array.from(
          offerta.collaboratori.values(),
        )
          .map((collaboratore) => {
            const giornateCollaboratore =
              collaboratore.oreFatturabili / ORE_PER_GIORNATA;
            const imponibileGrezzo =
              giornateCollaboratore * offerta.tariffaGiornaliera;
            const voce: VoceCollaboratoreOffertaReport = {
              collaboratoreId: collaboratore.collaboratoreId,
              collaboratoreNome: collaboratore.collaboratoreNome,
              oreFatturabili: collaboratore.oreFatturabili,
              giornateFatturabili: giornateCollaboratore,
              imponibile: imponibileGrezzo.toFixed(2),
            };
            imponibileGrezzoPerVoce.set(voce, imponibileGrezzo);
            return voce;
          })
          .sort((a, b) => {
            if (b.oreFatturabili !== a.oreFatturabili) {
              return b.oreFatturabili - a.oreFatturabili;
            }
            return a.collaboratoreNome.localeCompare(b.collaboratoreNome);
          });

        perOfferta.push({
          offertaId: offerta.offertaId,
          offertaCodice: offerta.offertaCodice,
          offertaDescrizione: offerta.offertaDescrizione,
          tariffaGiornaliera: offerta.tariffaGiornaliera.toFixed(2),
          giornateFatturabili,
          imponibile: imponibile.toFixed(2),
          giorniTrasferta,
          importoTrasfertaForfettaria:
            offerta.importoTrasfertaForfettaria?.toFixed(2) ?? null,
          importoTrasferte: importoTrasferte.toFixed(2),
          perCollaboratore,
        });
      }
    }

    if (perOfferta.length === 0) {
      continue;
    }

    perOfferta.sort((a, b) => a.offertaCodice.localeCompare(b.offertaCodice));

    // Allocazione a resto massimo (largest remainder) in centesimi interi
    // sull'elenco piatto di tutte le voci collaboratore del cliente, ancorata
    // all'imponibile manodopera visualizzato del cliente (AC-2, requisito a
    // livello cliente). La riconciliazione è quindi sul totale cliente, non
    // per singola offerta: la somma dei collaboratori di un'offerta può
    // discostarsi di massimo 1 centesimo dall'imponibile di quell'offerta,
    // ma il dettaglio UI non mostra un subtotale per offerta, quindi lo
    // scostamento non è osservabile. Ancorare anche per offerta romperebbe
    // la garanzia a livello cliente se la somma degli imponibili di offerta
    // arrotondati non coincide col totale cliente arrotondato (arrotondamenti
    // indipendenti preesistenti, fuori perimetro di questa allocazione).
    const vociPiatte = perOfferta.flatMap((voce) => voce.perCollaboratore);
    if (vociPiatte.length > 0) {
      const targetCents = Math.round(
        Number(imponibileManodoperaCliente.toFixed(2)) * 100,
      );
      const dettagli = vociPiatte.map((voce) => {
        const rawCents = imponibileGrezzoPerVoce.get(voce)! * 100;
        const floorCents = Math.floor(rawCents + 1e-6);
        return { voce, floorCents, frazione: rawCents - floorCents };
      });
      const sommaFloorCents = dettagli.reduce((s, d) => s + d.floorCents, 0);
      let residuoDaDistribuire = targetCents - sommaFloorCents;

      const centesimiFinali = new Map(
        dettagli.map((d) => [d.voce, d.floorCents]),
      );
      const perFrazione = dettagli
        .map((d, indice) => ({ ...d, indice }))
        .sort((a, b) => {
          if (b.frazione !== a.frazione) {
            return b.frazione - a.frazione;
          }
          return a.indice - b.indice;
        });
      for (const d of perFrazione) {
        if (residuoDaDistribuire <= 0) {
          break;
        }
        centesimiFinali.set(d.voce, centesimiFinali.get(d.voce)! + 1);
        residuoDaDistribuire -= 1;
      }

      for (const voce of vociPiatte) {
        voce.imponibile = (centesimiFinali.get(voce)! / 100).toFixed(2);
      }
    }

    const importoTotaleCliente =
      imponibileManodoperaCliente + trasferteForfettarieCliente;

    perCliente.push({
      clienteId: cliente.clienteId,
      clienteRagioneSociale: cliente.clienteRagioneSociale,
      perOfferta,
      trasferteForfettarie: trasferteForfettarieCliente.toFixed(2),
      imponibileManodopera: imponibileManodoperaCliente.toFixed(2),
      importoTotale: importoTotaleCliente.toFixed(2),
    });

    totaleImponibileManodopera += imponibileManodoperaCliente;
    totaleTrasferteForfettarie += trasferteForfettarieCliente;
    totaleImporto += importoTotaleCliente;
  }

  perCliente.sort((a, b) =>
    a.clienteRagioneSociale.localeCompare(b.clienteRagioneSociale),
  );

  return {
    perCliente,
    totali: {
      imponibileManodopera: totaleImponibileManodopera.toFixed(2),
      totaleTrasferteForfettarie: totaleTrasferteForfettarie.toFixed(2),
      importoTotale: totaleImporto.toFixed(2),
    },
  };
}

// ── Marginalità clienti e offerte ───────────────────────────────

/**
 * Riga elementare di attività per l'analisi di marginalità (dipendenza-zero).
 * Porta la tariffa dell'offerta (ricavo) e quella del collaboratore valida nel
 * mese della riga (costo).
 */
export interface RigaMarginalita {
  clienteId: string;
  clienteRagioneSociale: string;
  offertaId: string;
  offertaCodice: string;
  offertaDescrizione: string;
  tariffaOffertaGiornaliera: string | number;
  collaboratoreId: string;
  /** Token YYYY-MM della data della riga */
  mese: string;
  /** Modalità della tariffa del collaboratore valida nel mese; null se nessuna */
  modalitaTariffaCollaboratore: ModalitaTariffa | null;
  /** Importo della tariffa del collaboratore valida nel mese (giornaliera: €/giorno) */
  importoTariffaCollaboratore: string | number;
  ore: number;
  categoria: CategoriaAttivita;
}

/** Fisso mensile di un collaboratore in vigore in un mese del periodo. */
export interface FissoMensileCollaboratore {
  collaboratoreId: string;
  /** Token YYYY-MM */
  mese: string;
  importo: string | number;
}

/** Importi economici di una voce di marginalità (importi in euro con 2 decimali) */
export interface ImportiMarginalita {
  giornateFatturabili: number;
  ricavi: string;
  costi: string;
  margine: string;
  /** Margine / ricavi; `null` quando i ricavi sono zero */
  marginePercentuale: number | null;
  margineNegativo: boolean;
}

export interface VoceOffertaMarginalita extends ImportiMarginalita {
  offertaId: string;
  offertaCodice: string;
  offertaDescrizione: string;
  /** Quota dei costi che viene da fissi mensili ripartiti sull'offerta */
  fissoRipartito: string;
}

export interface VoceClienteMarginalita extends ImportiMarginalita {
  clienteId: string;
  clienteRagioneSociale: string;
  perOfferta: VoceOffertaMarginalita[];
}

export interface ReportMarginalita {
  perCliente: VoceClienteMarginalita[];
  /** Fissi mensili di collaboratori senza ore nel mese: pesano solo sul totale */
  fissiNonAttribuibili: string;
  totali: ImportiMarginalita;
}

function importiMarginalita(
  oreFatturabili: number,
  ricaviGrezzi: number,
  costiGrezzi: number,
): ImportiMarginalita {
  const ricavi = ricaviGrezzi.toFixed(2);
  const costi = costiGrezzi.toFixed(2);
  const ricaviCentesimi = Math.round(Number(ricavi) * 100);
  const margineCentesimi = ricaviCentesimi - Math.round(Number(costi) * 100);

  return {
    giornateFatturabili: oreFatturabili / ORE_PER_GIORNATA,
    ricavi,
    costi,
    margine: (margineCentesimi / 100).toFixed(2),
    marginePercentuale:
      ricaviCentesimi > 0 ? margineCentesimi / ricaviCentesimi : null,
    margineNegativo: margineCentesimi < 0,
  };
}

function tariffaNumerica(tariffa: string | number): number {
  const numero = Number(tariffa);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Ripartisce `totaleCentesimi` in proporzione ai `pesi` (interi positivi)
 * con il metodo dei resti più grandi: la somma delle quote è esattamente il
 * totale.
 */
export function ripartisciInProporzione(
  totaleCentesimi: number,
  pesi: number[],
): number[] {
  const sommaPesi = pesi.reduce((somma, peso) => somma + peso, 0);
  if (sommaPesi <= 0) return pesi.map(() => 0);

  const quote = pesi.map((peso) => Math.floor((totaleCentesimi * peso) / sommaPesi));
  const resti = pesi.map((peso, indice) => ({
    indice,
    resto: (totaleCentesimi * peso) % sommaPesi,
  }));
  let daAssegnare = totaleCentesimi - quote.reduce((somma, quota) => somma + quota, 0);
  resti.sort((a, b) => b.resto - a.resto || a.indice - b.indice);
  for (const { indice } of resti) {
    if (daAssegnare <= 0) break;
    quote[indice] += 1;
    daAssegnare -= 1;
  }
  return quote;
}

/**
 * Aggrega le righe attività per cliente e offerta calcolando ricavi (giornate
 * Fatturabile × tariffa offerta), costi e margine. Le righe Investimento non
 * generano né ricavi né costi. I rimborsi trasferta sono esclusi: sono
 * passanti.
 *
 * Costi, sempre con la tariffa del collaboratore valida nel mese della riga:
 * - Giornaliera: giornate Fatturabile e Non fatturabile × tariffa.
 * - Fisso mensile: ogni fisso di `fissiMensili` si ripartisce sulle offerte in
 *   proporzione alle ore Fatturabile e Non fatturabile del collaboratore in
 *   quel mese; senza ore finisce in `fissiNonAttribuibili`.
 *
 * Gli arrotondamenti dei ricavi seguono `calcolaReportFatturazioneClienti`,
 * così coincidono al centesimo con l'imponibile manodopera del report
 * fatturazione.
 *
 * Funzione pura: nessuna dipendenza da framework o Prisma.
 */
export function calcolaMarginalitaClienti(
  righe: RigaMarginalita[],
  fissiMensili: FissoMensileCollaboratore[] = [],
): ReportMarginalita {
  interface Accumulatore {
    ore: number;
    ricavi: number;
    costi: number;
  }
  interface AccumulatoreOfferta extends Accumulatore {
    tariffaOfferta: number;
    offertaCodice: string;
    offertaDescrizione: string;
    fissoRipartitoCentesimi: number;
  }
  interface AccumulatoreCliente {
    clienteRagioneSociale: string;
    offerte: Map<string, AccumulatoreOfferta>;
  }

  const clienti = new Map<string, AccumulatoreCliente>();
  // collaboratoreId|mese → offerta → ore (in centesimi) svolte a fisso mensile
  const oreAFisso = new Map<string, Map<AccumulatoreOfferta, number>>();

  for (const riga of righe) {
    if (!fatturataDalCollaboratore(riga.categoria)) {
      continue;
    }

    let cliente = clienti.get(riga.clienteId);
    if (!cliente) {
      cliente = {
        clienteRagioneSociale: riga.clienteRagioneSociale,
        offerte: new Map(),
      };
      clienti.set(riga.clienteId, cliente);
    }

    let offerta = cliente.offerte.get(riga.offertaId);
    if (!offerta) {
      offerta = {
        offertaCodice: riga.offertaCodice,
        offertaDescrizione: riga.offertaDescrizione,
        tariffaOfferta: tariffaNumerica(riga.tariffaOffertaGiornaliera),
        ore: 0,
        ricavi: 0,
        costi: 0,
        fissoRipartitoCentesimi: 0,
      };
      cliente.offerte.set(riga.offertaId, offerta);
    }

    if (fatturataAlCliente(riga.categoria)) {
      offerta.ore = sommaOre(offerta.ore, riga.ore);
    }

    if (riga.modalitaTariffaCollaboratore === "FISSO_MENSILE") {
      const chiave = `${riga.collaboratoreId}|${riga.mese}`;
      const perOfferta = oreAFisso.get(chiave) ?? new Map<AccumulatoreOfferta, number>();
      perOfferta.set(offerta, (perOfferta.get(offerta) ?? 0) + oreInCentesimi(riga.ore));
      oreAFisso.set(chiave, perOfferta);
    } else if (riga.modalitaTariffaCollaboratore === "GIORNALIERA") {
      offerta.costi +=
        (riga.ore / ORE_PER_GIORNATA) *
        tariffaNumerica(riga.importoTariffaCollaboratore);
    }
  }

  let fissiNonAttribuibiliCentesimi = 0;
  for (const fisso of fissiMensili) {
    const fissoCentesimi = Math.round(tariffaNumerica(fisso.importo) * 100);
    const perOfferta = oreAFisso.get(`${fisso.collaboratoreId}|${fisso.mese}`);
    if (!perOfferta) {
      fissiNonAttribuibiliCentesimi += fissoCentesimi;
      continue;
    }
    const offerte = [...perOfferta.keys()];
    const quote = ripartisciInProporzione(
      fissoCentesimi,
      offerte.map((offerta) => perOfferta.get(offerta)!),
    );
    offerte.forEach((offerta, indice) => {
      offerta.costi += quote[indice] / 100;
      offerta.fissoRipartitoCentesimi += quote[indice];
    });
  }

  const totale: Accumulatore = { ore: 0, ricavi: 0, costi: 0 };
  const perCliente: VoceClienteMarginalita[] = [];

  for (const [clienteId, cliente] of clienti) {
    const sommaCliente: Accumulatore = { ore: 0, ricavi: 0, costi: 0 };
    const perOfferta: VoceOffertaMarginalita[] = [];

    for (const [offertaId, offerta] of cliente.offerte) {
      if (offerta.ore <= 0 && offerta.costi <= 0) {
        continue;
      }
      // Stessa formula di calcolaReportFatturazioneClienti: ore totali / 8 × tariffa
      offerta.ricavi = (offerta.ore / ORE_PER_GIORNATA) * offerta.tariffaOfferta;
      sommaCliente.ore = sommaOre(sommaCliente.ore, offerta.ore);
      sommaCliente.ricavi += offerta.ricavi;
      sommaCliente.costi += offerta.costi;
      perOfferta.push({
        offertaId,
        offertaCodice: offerta.offertaCodice,
        offertaDescrizione: offerta.offertaDescrizione,
        fissoRipartito: (offerta.fissoRipartitoCentesimi / 100).toFixed(2),
        ...importiMarginalita(offerta.ore, offerta.ricavi, offerta.costi),
      });
    }

    if (perOfferta.length === 0) {
      continue;
    }

    perOfferta.sort((a, b) => a.offertaCodice.localeCompare(b.offertaCodice));
    totale.ore = sommaOre(totale.ore, sommaCliente.ore);
    totale.ricavi += sommaCliente.ricavi;
    totale.costi += sommaCliente.costi;
    perCliente.push({
      clienteId,
      clienteRagioneSociale: cliente.clienteRagioneSociale,
      perOfferta,
      ...importiMarginalita(
        sommaCliente.ore,
        sommaCliente.ricavi,
        sommaCliente.costi,
      ),
    });
  }

  perCliente.sort((a, b) =>
    a.clienteRagioneSociale.localeCompare(b.clienteRagioneSociale),
  );

  totale.costi += fissiNonAttribuibiliCentesimi / 100;

  return {
    perCliente,
    fissiNonAttribuibili: (fissiNonAttribuibiliCentesimi / 100).toFixed(2),
    totali: importiMarginalita(totale.ore, totale.ricavi, totale.costi),
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
  /** Agile Reloaded fattura la riga al cliente (categoria Fatturabile) */
  fatturabile: boolean;
  /** Token mese YYYY-MM della data della riga */
  mese: string;
}

/** Dettaglio dell'erogato per singolo collaboratore su un'offerta */
export interface VoceCollaboratoreAvanzamento {
  collaboratoreId: string;
  collaboratoreNome: string;
  oreErogate: number;
  giornateErogate: number;
}

/** Riga della matrice mensile: giornate erogate da un collaboratore, ripartite per mese */
export interface RigaMatriceMensileAvanzamento {
  collaboratoreId: string;
  collaboratoreNome: string;
  giornatePerMese: Record<string, number>;
  totaleGiornate: number;
}

/** Matrice mensile (mese x collaboratore) delle giornate erogate su un'offerta */
export interface MatriceMensileAvanzamento {
  mesi: string[];
  righe: RigaMatriceMensileAvanzamento[];
  totaliPerMese: Record<string, number>;
  totaleGiornate: number;
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
  matriceMensile: MatriceMensileAvanzamento;
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
    orePerMese: Map<string, number>;
  }

  interface AccumulatoreOfferta {
    offertaId: string;
    oreErogateTotali: number;
    collaboratori: Map<string, AccumulatoreCollaboratore>;
    mesi: Set<string>;
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
        mesi: new Set(),
      };
      accumulatori.set(riga.offertaId, accumulatoreOfferta);
    }

    accumulatoreOfferta.oreErogateTotali = sommaOre(accumulatoreOfferta.oreErogateTotali, riga.ore);
    accumulatoreOfferta.mesi.add(riga.mese);

    const accumulatoreCollaboratore = accumulatoreOfferta.collaboratori.get(
      riga.collaboratoreId,
    ) ?? {
      collaboratoreId: riga.collaboratoreId,
      collaboratoreNome: riga.collaboratoreNome,
      oreErogate: 0,
      orePerMese: new Map<string, number>(),
    };
    accumulatoreCollaboratore.oreErogate = sommaOre(accumulatoreCollaboratore.oreErogate, riga.ore);
    accumulatoreCollaboratore.orePerMese.set(
      riga.mese,
      sommaOre(accumulatoreCollaboratore.orePerMese.get(riga.mese) ?? 0, riga.ore),
    );
    accumulatoreOfferta.collaboratori.set(riga.collaboratoreId, accumulatoreCollaboratore);
  }

  let giornatePrevisteTotali = 0;
  let giornateErogateTotali = 0;
  let residuoTotale = 0;

  const perOfferta: VoceAvanzamentoOfferta[] = offerte.map((offerta) => {
    const accumulatoreOfferta = accumulatori.get(offerta.offertaId);
    // Budget, erogato e residuo si confrontano come interi in centesimi di ora:
    // giornate e residuo decimali sono solo valori derivati da mostrare.
    const erogateCentesimi = oreInCentesimi(
      accumulatoreOfferta?.oreErogateTotali ?? 0,
    );
    const giornatePreviste = offerta.giorniPrevisti;
    const budgetCentesimi = giornatePreviste * CENTESIMI_PER_GIORNATA;
    const residuoCentesimi = budgetCentesimi - erogateCentesimi;
    const giornateErogate = erogateCentesimi / CENTESIMI_PER_GIORNATA;
    const residuo = residuoCentesimi / CENTESIMI_PER_GIORNATA;

    const percentualeUtilizzo =
      budgetCentesimi > 0
        ? erogateCentesimi / budgetCentesimi
        : erogateCentesimi > 0
          ? 1.01
          : 0;

    let stato: StatoAvanzamentoOfferta;
    if (residuoCentesimi < 0) {
      stato = "OLTRE_BUDGET";
    } else if (residuoCentesimi === 0 && budgetCentesimi > 0) {
      stato = "ESAURITA";
    } else if (percentualeUtilizzo >= SOGLIA_ALLERTA_UTILIZZO && residuoCentesimi > 0) {
      stato = "IN_ALLERTA";
    } else {
      stato = "IN_CORSO";
    }

    const collaboratoriOrdinati = Array.from(
      accumulatoreOfferta?.collaboratori.values() ?? [],
    ).sort((a, b) => {
      if (b.oreErogate !== a.oreErogate) {
        return b.oreErogate - a.oreErogate;
      }
      return a.collaboratoreNome.localeCompare(b.collaboratoreNome);
    });

    const perCollaboratore: VoceCollaboratoreAvanzamento[] =
      collaboratoriOrdinati.map((collaboratore) => ({
        collaboratoreId: collaboratore.collaboratoreId,
        collaboratoreNome: collaboratore.collaboratoreNome,
        oreErogate: collaboratore.oreErogate,
        giornateErogate: collaboratore.oreErogate / ORE_PER_GIORNATA,
      }));

    const mesi = Array.from(accumulatoreOfferta?.mesi ?? []).sort();

    const righeMatrice: RigaMatriceMensileAvanzamento[] =
      collaboratoriOrdinati.map((collaboratore) => {
        const giornatePerMese: Record<string, number> = {};
        for (const [mese, ore] of collaboratore.orePerMese) {
          giornatePerMese[mese] = ore / ORE_PER_GIORNATA;
        }
        return {
          collaboratoreId: collaboratore.collaboratoreId,
          collaboratoreNome: collaboratore.collaboratoreNome,
          giornatePerMese,
          totaleGiornate: collaboratore.oreErogate / ORE_PER_GIORNATA,
        };
      });

    const totaliPerMese: Record<string, number> = {};
    for (const mese of mesi) {
      let sommaMese = 0;
      for (const rigaMatrice of righeMatrice) {
        sommaMese += rigaMatrice.giornatePerMese[mese] ?? 0;
      }
      totaliPerMese[mese] = sommaMese;
    }

    const matriceMensile: MatriceMensileAvanzamento = {
      mesi,
      righe: righeMatrice,
      totaliPerMese,
      totaleGiornate: giornateErogate,
    };

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
      matriceMensile,
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

/** Riga elementare di attività per lo storico (serializzabile, senza dipendenze Prisma) */
export interface RigaStoricoAttivita {
  /** Identificativo univoco della riga attività (id del record Prisma), usato come chiave stabile in UI */
  id: string;
  /** Data dell'attività in formato YYYY-MM-DD */
  data: string;
  clienteRagioneSociale: string;
  offertaCodice: string;
  offertaDescrizione: string;
  ore: number;
  categoria: CategoriaAttivita;
  nota: string | null;
}

/** Gruppo mensile dello storico attività, con totali di ore e giornate equivalenti */
export interface MeseStoricoAttivita {
  /** Token del mese in formato YYYY-MM */
  token: string;
  righe: RigaStoricoAttivita[];
  oreTotali: number;
  giornateTotali: number;
}

/**
 * Raggruppa le righe attività per mese solare (token YYYY-MM derivato dai
 * primi 7 caratteri di `data`), calcolando per ciascun mese i totali di ore
 * e di giornate equivalenti (ore / ORE_PER_GIORNATA), arrotondati a 2 decimali.
 *
 * Le righe dentro ogni gruppo preservano l'ordine di input (l'ordinamento per
 * data crescente è responsabilità del chiamante). I gruppi sono restituiti in
 * ordine di token decrescente (mese più recente prima).
 *
 * Funzione pura: nessuna dipendenza da framework o Prisma.
 *
 * @param righe - Righe elementari di attività da raggruppare
 * @returns Gruppi mensili ordinati per token decrescente; array vuoto se input vuoto
 */
export function raggruppaAttivitaPerMese(
  righe: RigaStoricoAttivita[],
): MeseStoricoAttivita[] {
  const gruppi = new Map<string, RigaStoricoAttivita[]>();

  for (const riga of righe) {
    const token = riga.data.slice(0, 7);
    const gruppo = gruppi.get(token);
    if (gruppo) {
      gruppo.push(riga);
    } else {
      gruppi.set(token, [riga]);
    }
  }

  return Array.from(gruppi.entries())
    .map(([token, righeMese]) => {
      const oreTotali = sommaOre(...righeMese.map((riga) => riga.ore));
      return {
        token,
        righe: righeMese,
        oreTotali,
        giornateTotali:
          Math.round((oreTotali / ORE_PER_GIORNATA) * 100) / 100,
      };
    })
    .sort((a, b) => b.token.localeCompare(a.token));
}
