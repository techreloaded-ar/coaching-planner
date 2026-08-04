// Cache della giornata di attività e del contesto di inserimento —
// specializzazioni della macchina di cache generica della scheda
// (`cache-dati-scheda.ts`).
//
// Sono due cache distinte perché la loro invalidazione è distinta: le righe di
// una giornata cambiano ad ogni mutazione di quel giorno, mentre clienti e voci
// di rimborso sono invarianti rispetto al giorno. Tenerle separate è ciò che
// impedisce al contesto di essere richiesto ad ogni cambio giorno.
//
// Entrambe accettano la guardia d'identità condivisa con la cache dei mesi: una
// risposta che dichiara un altro collaboratore svuota tutte le cache della
// scheda, non solo quella che se ne è accorta.

import type {
  ContestoInserimentoGiornata,
  DatiGiornataAttivita,
} from "@/lib/attivita-contract";
import {
  CacheDatiScheda,
  type GuardiaIdentitaScheda,
  type LetturaCache,
  type NotificaIdentitaCambiata,
  type Orologio,
} from "./cache-dati-scheda";

// ── Costanti di consistenza ─────────────────────────────────────

/**
 * Numero massimo di giornate conservate contemporaneamente (espulsione LRU):
 * un mese pieno, così una navigazione giorno per giorno dentro lo stesso mese
 * non espelle mai il giorno da cui si è partiti.
 */
export const MASSIMO_GIORNATE_IN_CACHE = 31;

/**
 * Chiave unica sotto cui è conservato il contesto di inserimento: la risorsa è
 * una sola per scheda, quindi la cache ha una voce sola.
 */
export const CHIAVE_CONTESTO_INSERIMENTO = "contesto-inserimento";

// ── Tipi ────────────────────────────────────────────────────────

/** Esito di una lettura sincrona dalla cache delle giornate. */
export type LetturaGiornata = LetturaCache<DatiGiornataAttivita>;

/** Esito di una lettura sincrona dalla cache del contesto di inserimento. */
export type LetturaContestoInserimento =
  LetturaCache<ContestoInserimentoGiornata>;

/** Lettura remota di una giornata; la chiave è la data YYYY-MM-DD. */
export type CaricatoreGiornata = (data: string) => Promise<DatiGiornataAttivita>;

/** Lettura remota del contesto di inserimento; non ha parametri. */
export type CaricatoreContestoInserimento =
  () => Promise<ContestoInserimentoGiornata>;

export interface OpzioniCacheGiornate {
  /** Lettura remota di una giornata; l'unica sorgente di dati della cache. */
  caricatore: CaricatoreGiornata;
  /** Orologio iniettabile: i test controllano il tempo, non lo attendono. */
  orologio?: Orologio;
  durataFreshMs?: number;
  massimoGiornate?: number;
  /** Guardia d'identità condivisa con le altre cache della stessa scheda. */
  guardia?: GuardiaIdentitaScheda;
  /** Usata solo quando non viene passata una guardia condivisa. */
  onIdentitaCambiata?: NotificaIdentitaCambiata;
}

export interface OpzioniCacheContestoInserimento {
  /** Lettura remota del contesto; l'unica sorgente di dati della cache. */
  caricatore: CaricatoreContestoInserimento;
  /** Orologio iniettabile: i test controllano il tempo, non lo attendono. */
  orologio?: Orologio;
  durataFreshMs?: number;
  /** Guardia d'identità condivisa con le altre cache della stessa scheda. */
  guardia?: GuardiaIdentitaScheda;
  /** Usata solo quando non viene passata una guardia condivisa. */
  onIdentitaCambiata?: NotificaIdentitaCambiata;
}

// ── Cache delle giornate ────────────────────────────────────────

/**
 * Cache delle righe di attività per giorno, indicizzata per data YYYY-MM-DD.
 *
 * Tutte le garanzie sono quelle di `CacheDatiScheda`: finestra fresca di 300
 * secondi, rivalidazione singola in background, deduplica delle richieste
 * concorrenti, resistenza agli errori di rete, epoche che neutralizzano le
 * risposte in volo dopo un'invalidazione, svuotamento al cambio di identità.
 */
export class CacheGiornateAttivita extends CacheDatiScheda<DatiGiornataAttivita> {
  constructor(opzioni: OpzioniCacheGiornate) {
    super({
      caricatore: opzioni.caricatore,
      chiaveDi: (dati) => dati.data,
      massimoVoci: opzioni.massimoGiornate ?? MASSIMO_GIORNATE_IN_CACHE,
      orologio: opzioni.orologio,
      durataFreshMs: opzioni.durataFreshMs,
      guardia: opzioni.guardia,
      onIdentitaCambiata: opzioni.onIdentitaCambiata,
    });
  }

  /** Date in cache, dalla meno alla più recentemente usata. */
  giorniInCache(): string[] {
    return this.chiaviInCache();
  }
}

// ── Cache del contesto di inserimento ───────────────────────────

/**
 * Cache del contesto di inserimento — clienti selezionabili e voci di rimborso
 * trasferta — per una singola sessione di scheda.
 *
 * È una cache a voce singola: la risorsa è invariante rispetto al giorno,
 * quindi il cambio giorno la legge senza emettere richieste. La sua freschezza
 * è delimitata dalle stesse mitigazioni del mese: scadenza a 300 secondi e
 * rivalidazione forzata al ritorno sulla scheda.
 *
 * I metodi ereditati accettano la chiave per compatibilità con la macchina
 * generica, ma la omettono per comodità: la chiave è sempre
 * `CHIAVE_CONTESTO_INSERIMENTO`.
 */
export class CacheContestoInserimento extends CacheDatiScheda<ContestoInserimentoGiornata> {
  constructor(opzioni: OpzioniCacheContestoInserimento) {
    super({
      caricatore: () => opzioni.caricatore(),
      chiaveDi: () => CHIAVE_CONTESTO_INSERIMENTO,
      massimoVoci: 1,
      orologio: opzioni.orologio,
      durataFreshMs: opzioni.durataFreshMs,
      guardia: opzioni.guardia,
      onIdentitaCambiata: opzioni.onIdentitaCambiata,
    });
  }

  read(chiave: string = CHIAVE_CONTESTO_INSERIMENTO): LetturaContestoInserimento | null {
    return super.read(chiave);
  }

  load(
    chiave: string = CHIAVE_CONTESTO_INSERIMENTO,
  ): Promise<ContestoInserimentoGiornata> {
    return super.load(chiave);
  }

  revalida(
    chiave: string = CHIAVE_CONTESTO_INSERIMENTO,
  ): Promise<ContestoInserimentoGiornata> {
    return super.revalida(chiave);
  }

  prefetch(chiave: string = CHIAVE_CONTESTO_INSERIMENTO): void {
    super.prefetch(chiave);
  }

  invalidate(...chiavi: string[]): void {
    super.invalidate(
      ...(chiavi.length > 0 ? chiavi : [CHIAVE_CONTESTO_INSERIMENTO]),
    );
  }

  /** `true` quando il contesto è presente in cache, fresco o scaduto. */
  haContesto(): boolean {
    return this.chiaviInCache().length > 0;
  }
}
