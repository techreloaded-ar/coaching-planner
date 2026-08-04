// Cache dei mesi del calendario — specializzazione della macchina di cache
// generica della scheda (`cache-dati-scheda.ts`).
//
// Qui resta soltanto ciò che è proprio dei mesi: la chiave è il token del mese
// e il limite LRU è di dodici mesi. Semantica, garanzie e firma pubblica sono
// invariate rispetto a US-052: `tests/unit/calendario-cache-provider.test.ts`
// continua a passare senza una riga di modifica, ed è la prova che la
// generalizzazione non ha cambiato comportamento.
//
// Non conosce l'idea di «mese attivo»: quella decisione appartiene al
// componente calendario.

import type { DatiCalendarioMese } from "@/lib/attivita-contract";
import {
  CacheDatiScheda,
  DURATA_FRESH_MS,
  type GuardiaIdentitaScheda,
  type LetturaCache,
  type NotificaIdentitaCambiata,
  type Orologio,
  type StatoVoceCache,
} from "./cache-dati-scheda";

// ── Costanti di consistenza ─────────────────────────────────────

/**
 * Finestra durante la quale una entry è considerata fresca: 300 secondi.
 * Ri-esportata dalla macchina generica per non rompere gli import esistenti.
 */
export { DURATA_FRESH_MS };

/** Numero massimo di mesi conservati contemporaneamente (espulsione LRU). */
export const MASSIMO_MESI_IN_CACHE = 12;

// ── Tipi ────────────────────────────────────────────────────────

export type StatoEntryCalendario = StatoVoceCache;

/** Esito di una lettura sincrona dalla cache dei mesi. */
export type LetturaCalendario = LetturaCache<DatiCalendarioMese>;

export type CaricatoreMese = (token: string) => Promise<DatiCalendarioMese>;

export type { Orologio };

export interface OpzioniCacheCalendario {
  /** Lettura remota di un mese; l'unica sorgente di dati della cache. */
  caricatore: CaricatoreMese;
  /** Orologio iniettabile: i test controllano il tempo, non lo attendono. */
  orologio?: Orologio;
  durataFreshMs?: number;
  massimoMesi?: number;
  /**
   * Guardia d'identità condivisa con le altre cache della stessa scheda
   * (giornate e contesto di inserimento). Se assente ne viene creata una
   * privata, inizializzata con `onIdentitaCambiata`.
   */
  guardia?: GuardiaIdentitaScheda;
  /**
   * Invocata quando una risposta dichiara un collaboratore diverso da quello
   * dei dati già in cache: la sessione della scheda è cambiata sotto di noi.
   * La cache è già stata svuotata quando questa callback viene chiamata.
   */
  onIdentitaCambiata?: NotificaIdentitaCambiata;
}

/**
 * Cache dei mesi del calendario per una singola sessione di scheda.
 *
 * Tutte le garanzie sono quelle di `CacheDatiScheda`: finestra fresca,
 * rivalidazione singola in background, deduplica delle richieste concorrenti,
 * resistenza agli errori di rete, epoche che neutralizzano le risposte in volo
 * dopo un'invalidazione, svuotamento al cambio di identità.
 */
export class CacheCalendarioMesi extends CacheDatiScheda<DatiCalendarioMese> {
  constructor(opzioni: OpzioniCacheCalendario) {
    super({
      caricatore: opzioni.caricatore,
      chiaveDi: (dati) => dati.token,
      massimoVoci: opzioni.massimoMesi ?? MASSIMO_MESI_IN_CACHE,
      orologio: opzioni.orologio,
      durataFreshMs: opzioni.durataFreshMs,
      guardia: opzioni.guardia,
      onIdentitaCambiata: opzioni.onIdentitaCambiata,
    });
  }

  /** Token dei mesi in cache, dal meno al più recentemente usato. */
  tokenInCache(): string[] {
    return this.chiaviInCache();
  }
}
