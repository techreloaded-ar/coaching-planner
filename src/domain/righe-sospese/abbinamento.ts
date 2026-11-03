// Abbinamento delle righe del foglio di pianificazione storico alle anagrafiche.
// Funzioni pure, riusate dallo script di import e dalle future azioni guidate
// sulle righe sospese (vedi docs/righe-attivita-sospese-approccio.md).

import type { CategoriaAttivita, MotivoSospensione } from "@/generated/prisma/client";

/** Confronto tra foglio e anagrafiche: spazi compattati, maiuscolo. */
export function normalizzaTesto(valore: string | null | undefined): string {
  return (valore ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/** Solo lettere e cifre: tollera spazi e punteggiatura diversi nel codice offerta. */
export function compattaCodice(valore: string | null | undefined): string {
  return normalizzaTesto(valore).replace(/[^A-Z0-9]/g, "");
}

/** Codice usato per le offerte del foglio prive di codice. */
export const CODICE_OFFERTA_MANCANTE = "SENZA CODICE";

/** Sotto questa lunghezza un codice contenuto in un altro è una coincidenza, non una corrispondenza. */
const LUNGHEZZA_MINIMA_CODICE_PARZIALE = 8;

export interface OffertaAbbinabile {
  id: string;
  codice: string;
  clienteId: string;
}

export type EsitoRicercaOfferta =
  | { offerta: OffertaAbbinabile; dedotta?: string }
  /** Codice vuoto e nessuna offerta deducibile: riga "offerta da definire". */
  | { offerta: null }
  | { motivo: Extract<MotivoSospensione, "OFFERTA_SCONOSCIUTA" | "OFFERTA_ALTRO_CLIENTE">; nota: string };

/**
 * Cerca l'offerta di una riga tra quelle del suo cliente: codice uguale, poi
 * uguale a meno di spazi e punteggiatura, poi contenuto/contenente se la
 * corrispondenza è una sola. Con codice vuoto usa l'offerta "SENZA CODICE" o
 * l'unica offerta del cliente, altrimenti lascia l'offerta da definire.
 */
export function cercaOfferta(
  codice: string | null | undefined,
  offerteDelCliente: OffertaAbbinabile[],
  tutteLeOfferte: OffertaAbbinabile[],
  nomiClienti: Map<string, string>,
): EsitoRicercaOfferta {
  const codiceNormalizzato = normalizzaTesto(codice);
  if (!codiceNormalizzato) {
    const senzaCodice = offerteDelCliente.find((o) => normalizzaTesto(o.codice) === CODICE_OFFERTA_MANCANTE);
    if (senzaCodice) return { offerta: senzaCodice, dedotta: `offerta "${CODICE_OFFERTA_MANCANTE}" del cliente` };
    if (offerteDelCliente.length === 1) return { offerta: offerteDelCliente[0], dedotta: "unica offerta del cliente" };
    return { offerta: null };
  }

  const esatta = offerteDelCliente.find((o) => normalizzaTesto(o.codice) === codiceNormalizzato);
  if (esatta) return { offerta: esatta };

  const compatto = compattaCodice(codice);
  const simili = offerteDelCliente.filter((o) => compattaCodice(o.codice) === compatto);
  if (simili.length === 1) return { offerta: simili[0], dedotta: "stesso codice a meno di spazi e punteggiatura" };

  if (compatto.length >= LUNGHEZZA_MINIMA_CODICE_PARZIALE) {
    const parziali = offerteDelCliente.filter((o) => {
      const suo = compattaCodice(o.codice);
      return suo.includes(compatto) || (suo.length >= LUNGHEZZA_MINIMA_CODICE_PARZIALE && compatto.includes(suo));
    });
    if (parziali.length === 1) return { offerta: parziali[0], dedotta: `codice simile a "${parziali[0].codice}"` };
    if (parziali.length > 1) {
      return { motivo: "OFFERTA_SCONOSCIUTA", nota: `Codice ambiguo tra ${parziali.map((o) => `"${o.codice}"`).join(", ")}` };
    }
  }

  const altrui = tutteLeOfferte.filter((o) => compattaCodice(o.codice) === compatto);
  if (altrui.length > 0) {
    const clienti = [...new Set(altrui.map((o) => nomiClienti.get(o.clienteId) ?? o.clienteId))];
    return { motivo: "OFFERTA_ALTRO_CLIENTE", nota: `Codice intestato a: ${clienti.join(", ")}` };
  }
  return { motivo: "OFFERTA_SCONOSCIUTA", nota: "Nessuna offerta del cliente con questo codice" };
}

const CATEGORIA_PER_TIPOLOGIA: Record<string, CategoriaAttivita> = {
  FATTURABILE: "FATTURABILE",
  "NON FATTURABILE": "NON_FATTURABILE",
  INVESTIMENTO: "INVESTIMENTO",
  // Valori storici del foglio
  PIANIFICATA: "FATTURABILE",
  PAIR: "NON_FATTURABILE",
};

/**
 * Categoria della riga dalla "Tipologia Fatturazione" del foglio. Vuota: le
 * ore sul cliente interno non si fatturano, le altre sì. Sconosciuta: null.
 */
export function categoriaDaTipologia(tipologia: string | null | undefined, clienteInterno: boolean): CategoriaAttivita | null {
  const chiave = normalizzaTesto(tipologia);
  if (!chiave) return clienteInterno ? "NON_FATTURABILE" : "FATTURABILE";
  return CATEGORIA_PER_TIPOLOGIA[chiave] ?? null;
}

/** Giorno 1 del calendario Excel (seriale 1 = 1° gennaio 1900, con il bug del 1900 bisestile). */
const EPOCA_SERIALE_EXCEL = Date.UTC(1899, 11, 30);
const MILLISECONDI_PER_GIORNO = 86_400_000;

/**
 * Data in `YYYY-MM-DD` da `YYYY-MM-DD`, `DD/MM/YYYY`, `D/M/YY` o da un seriale
 * Excel (numero di giorni, come esporta un xlsx); null se illeggibile.
 */
export function leggiData(valore: string | null | undefined): string | null {
  const testo = (valore ?? "").trim();
  let anno: number, mese: number, giorno: number;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(testo);
  if (m) [anno, mese, giorno] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if (/^\d{5}(?:\.0+)?$/.test(testo)) return new Date(EPOCA_SERIALE_EXCEL + Number(testo) * MILLISECONDI_PER_GIORNO).toISOString().slice(0, 10);
  else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(testo))) {
    [giorno, mese] = [Number(m[1]), Number(m[2])];
    anno = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  } else return null;
  const data = new Date(Date.UTC(anno, mese - 1, giorno));
  if (data.getUTCFullYear() !== anno || data.getUTCMonth() !== mese - 1 || data.getUTCDate() !== giorno) return null;
  return data.toISOString().slice(0, 10);
}

/** Numero da una cella: accetta la virgola decimale italiana; null se vuoto o non numerico. */
export function leggiNumero(valore: string | null | undefined): number | null {
  const testo = (valore ?? "").trim().replace(/\s/g, "");
  if (!testo) return null;
  const normalizzato = testo.includes(",") && !testo.includes(".") ? testo.replace(",", ".") : testo.replace(/,/g, "");
  const numero = Number(normalizzato);
  return Number.isFinite(numero) ? numero : null;
}

/** "Sì", "Si", "Yes", "true", "1" → true. */
export function leggiSiNo(valore: string | null | undefined): boolean {
  return /^(s[iì]|yes|true|1|x)$/i.test((valore ?? "").trim());
}
