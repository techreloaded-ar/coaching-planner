"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ContestoInserimentoGiornata,
  DatiCalendarioMese,
  DatiGiornataAttivita,
} from "@/lib/attivita-contract";
import {
  ErroreIdentitaSchedaCambiata,
  GuardiaIdentitaScheda,
} from "./cache-dati-scheda";
import {
  CacheCalendarioMesi,
  type LetturaCalendario,
} from "./calendario-cache";
import {
  CacheContestoInserimento,
  CacheGiornateAttivita,
  type LetturaContestoInserimento,
  type LetturaGiornata,
} from "./giornata-cache";

// ── Errore di sessione ──────────────────────────────────────────

/**
 * Una lettura dell'area attività ha incontrato una sessione non più valida.
 *
 * Non è un errore recuperabile con un retry: tutte le cache della scheda
 * vengono svuotate e il consumer deve uscire dall'isola client con una
 * navigazione completa.
 */
export class ErroreSessioneAttivita extends Error {
  readonly statusCode: number;

  constructor(statusCode: number) {
    super("Sessione non più valida per la lettura dell'area attività");
    this.name = "ErroreSessioneAttivita";
    this.statusCode = statusCode;
  }
}

export { ErroreIdentitaSchedaCambiata };

// ── API esposte ai consumer ─────────────────────────────────────

/**
 * Parte comune delle tre API: la notifica di sessione non più valida è unica
 * per scheda, quindi ogni consumer si iscrive allo stesso canale qualunque
 * cache stia usando.
 */
interface ApiSessioneScheda {
  /**
   * Notifica che la sessione non è più quella con cui le cache sono state
   * popolate — decaduta (`401`/`403`) oppure sostituita da un altro account
   * nella stessa finestra — e che serve una navigazione completa.
   */
  subscribeSessioneScaduta(ascoltatore: () => void): () => void;
}

export interface ApiCacheCalendario extends ApiSessioneScheda {
  /** Inserisce il mese ottenuto dal rendering server, rendendolo fresco. */
  seed(dati: DatiCalendarioMese): void;
  /** Lettura sincrona: nessuna rete, nessun caricatore. */
  read(token: string): LetturaCalendario | null;
  /** Restituisce il mese, dalla cache se fresco, altrimenti dalla rete. */
  load(token: string): Promise<DatiCalendarioMese>;
  /** Forza una lettura remota del mese, deduplicata. */
  revalida(token: string): Promise<DatiCalendarioMese>;
  /** Precarica in background; errori silenziosi. */
  prefetch(token: string): void;
  /** Rimuove i mesi indicati, anche se una risposta è in volo. */
  invalidate(...token: string[]): void;
  /** Svuota la cache. */
  clear(): void;
  /** Notifica i cambiamenti di un mese in cache (anche in background). */
  subscribe(ascoltatore: (token: string) => void): () => void;
}

export interface ApiCacheGiornate extends ApiSessioneScheda {
  /** Inserisce la giornata ottenuta dal rendering server, rendendola fresca. */
  seed(dati: DatiGiornataAttivita): void;
  /** Lettura sincrona per data YYYY-MM-DD: nessuna rete, nessun caricatore. */
  read(data: string): LetturaGiornata | null;
  /** Restituisce la giornata, dalla cache se fresca, altrimenti dalla rete. */
  load(data: string): Promise<DatiGiornataAttivita>;
  /** Forza una lettura remota della giornata, deduplicata. */
  revalida(data: string): Promise<DatiGiornataAttivita>;
  /** Precarica in background; errori silenziosi. */
  prefetch(data: string): void;
  /** Rimuove le giornate indicate, anche se una risposta è in volo. */
  invalidate(...data: string[]): void;
  /** Svuota la cache. */
  clear(): void;
  /** Notifica i cambiamenti di una giornata in cache (anche in background). */
  subscribe(ascoltatore: (data: string) => void): () => void;
}

export interface ApiCacheContestoInserimento extends ApiSessioneScheda {
  /** Inserisce il contesto ottenuto dal rendering server, rendendolo fresco. */
  seed(dati: ContestoInserimentoGiornata): void;
  /** Lettura sincrona: nessuna rete, nessun caricatore. */
  read(): LetturaContestoInserimento | null;
  /** Restituisce il contesto, dalla cache se fresco, altrimenti dalla rete. */
  load(): Promise<ContestoInserimentoGiornata>;
  /** Forza una lettura remota del contesto, deduplicata. */
  revalida(): Promise<ContestoInserimentoGiornata>;
  /** Precarica in background; errori silenziosi. */
  prefetch(): void;
  /** Rimuove il contesto, anche se una risposta è in volo. */
  invalidate(): void;
  /** Svuota la cache. */
  clear(): void;
  /** Notifica i cambiamenti del contesto in cache (anche in background). */
  subscribe(ascoltatore: (chiave: string) => void): () => void;
}

/** Offerta abilitata di un cliente, per il cascade select del form riga. */
export interface OffertaAbilitataCliente {
  id: string;
  codice: string;
  descrizione: string;
}

/**
 * Lettura delle offerte abilitate di un cliente.
 *
 * Non è una cache — dipende dal cliente scelto nel form, non dal giorno — ma
 * passa dallo stesso confine di lettura delle tre cache, e quindi dallo stesso
 * canale di sessione: una sessione decaduta su questa lettura deve provocare la
 * navigazione completa promessa dall'area, non una tendina che si svuota in
 * silenzio.
 */
export interface ApiOfferteCliente extends ApiSessioneScheda {
  /** Offerte attive del cliente su cui il collaboratore è abilitato. */
  leggi(clienteId: string): Promise<OffertaAbilitataCliente[]>;
}

/** Le letture della scheda, esposte insieme da un solo contesto React. */
interface ApiCacheAttivita {
  calendario: ApiCacheCalendario;
  giornate: ApiCacheGiornate;
  contestoInserimento: ApiCacheContestoInserimento;
  offerteCliente: ApiOfferteCliente;
}

const ContestoCacheAttivita = createContext<ApiCacheAttivita | null>(null);

/**
 * Accede alla cache dei mesi del calendario.
 *
 * Restituisce `null` fuori dal provider, così un componente può funzionare
 * anche senza isola client invece di lanciare durante il rendering.
 */
export function useCacheCalendario(): ApiCacheCalendario | null {
  return useContext(ContestoCacheAttivita)?.calendario ?? null;
}

/**
 * Accede alla cache delle giornate di attività.
 *
 * Restituisce `null` fuori dal provider, con la stessa logica di
 * `useCacheCalendario`.
 */
export function useCacheGiornate(): ApiCacheGiornate | null {
  return useContext(ContestoCacheAttivita)?.giornate ?? null;
}

/**
 * Accede alla cache del contesto di inserimento (clienti e voci di rimborso).
 *
 * Restituisce `null` fuori dal provider, con la stessa logica di
 * `useCacheCalendario`.
 */
export function useCacheContestoInserimento(): ApiCacheContestoInserimento | null {
  return useContext(ContestoCacheAttivita)?.contestoInserimento ?? null;
}

/**
 * Accede alla lettura delle offerte abilitate di un cliente.
 *
 * Restituisce `null` fuori dal provider, con la stessa logica di
 * `useCacheCalendario`: il consumer resta funzionante con una lettura propria,
 * ma senza il canale di sessione della scheda.
 */
export function useLetturaOfferteCliente(): ApiOfferteCliente | null {
  return useContext(ContestoCacheAttivita)?.offerteCliente ?? null;
}

// ── Contenitore delle cache della scheda ────────────────────────

export interface Contenitore {
  chiave: string;
  guardia: GuardiaIdentitaScheda;
  cacheMesi: CacheCalendarioMesi;
  cacheGiornate: CacheGiornateAttivita;
  cacheContesto: CacheContestoInserimento;
  ascoltatoriSessione: Set<() => void>;
}

/**
 * Costruisce le cache della scheda con la guardia d'identità e il canale di
 * sessione condivisi.
 *
 * È esportata come cucitura di verifica: la condivisione della guardia fra le
 * **tre** cache è una garanzia di sicurezza — un cambio account rilevato dal
 * calendario deve rendere illeggibili anche giornate e contesto — e va provata
 * sul contenitore reale, non su una sua ricostruzione nel test.
 */
export function creaContenitoreCacheAttivita(
  chiaveSessione: string
): Contenitore {
  const ascoltatoriSessione = new Set<() => void>();

  const notificaSessioneNonPiuValida = () => {
    for (const ascoltatore of ascoltatoriSessione) {
      ascoltatore();
    }
  };

  // Una sola identità per la scheda: una risposta che dichiara un altro
  // collaboratore svuota **tutte** le cache registrate e notifica una sola
  // volta il consumer, che esce dall'isola con una navigazione completa invece
  // di continuare a mostrare i dati del collaboratore precedente.
  const guardia = new GuardiaIdentitaScheda(notificaSessioneNonPiuValida);

  const contenitore: Contenitore = {
    chiave: chiaveSessione,
    guardia,
    ascoltatoriSessione,
    // Sostituite subito sotto: i caricatori devono poter riferire il
    // contenitore per svuotare tutte le cache quando la sessione decade.
    cacheMesi: undefined as unknown as CacheCalendarioMesi,
    cacheGiornate: undefined as unknown as CacheGiornateAttivita,
    cacheContesto: undefined as unknown as CacheContestoInserimento,
  };

  contenitore.cacheMesi = new CacheCalendarioMesi({
    guardia,
    caricatore: (token) => leggiMeseDaEndpoint(token, contenitore),
  });
  contenitore.cacheGiornate = new CacheGiornateAttivita({
    guardia,
    caricatore: (data) => leggiGiornataDaEndpoint(data, contenitore),
  });
  contenitore.cacheContesto = new CacheContestoInserimento({
    guardia,
    caricatore: () => leggiContestoInserimentoDaEndpoint(contenitore),
  });

  return contenitore;
}

function svuotaTutteLeCache(contenitore: Contenitore): void {
  contenitore.cacheMesi.clear();
  contenitore.cacheGiornate.clear();
  contenitore.cacheContesto.clear();
}

/** Svuota tutte le cache della scheda e notifica gli ascoltatori di sessione. */
function abbandonaSessione(contenitore: Contenitore): void {
  svuotaTutteLeCache(contenitore);
  for (const ascoltatore of contenitore.ascoltatoriSessione) {
    ascoltatore();
  }
}

// ── Letture remote ──────────────────────────────────────────────

/**
 * Esegue la richiesta e traduce gli esiti di sessione in
 * `ErroreSessioneAttivita`, allo stesso modo per le tre risorse.
 *
 * Il proxy globale reindirizza le rotte protette prive di sessione: una
 * risposta reindirizzata vale quindi come 401, non come dato valido.
 */
async function leggiDaEndpoint<T>(
  url: string,
  contenitore: Contenitore,
  descrizioneLettura: string
): Promise<T> {
  const risposta = await fetch(url, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });

  if (risposta.status === 401 || risposta.status === 403 || risposta.redirected) {
    abbandonaSessione(contenitore);
    throw new ErroreSessioneAttivita(
      risposta.redirected ? 401 : risposta.status
    );
  }

  if (!risposta.ok) {
    throw new Error(
      `${descrizioneLettura} non riuscita (HTTP ${risposta.status})`
    );
  }

  return (await risposta.json()) as T;
}

function leggiMeseDaEndpoint(
  token: string,
  contenitore: Contenitore
): Promise<DatiCalendarioMese> {
  return leggiDaEndpoint<DatiCalendarioMese>(
    `/api/attivita/calendario?mese=${encodeURIComponent(token)}`,
    contenitore,
    `Lettura del mese ${token}`
  );
}

function leggiGiornataDaEndpoint(
  data: string,
  contenitore: Contenitore
): Promise<DatiGiornataAttivita> {
  return leggiDaEndpoint<DatiGiornataAttivita>(
    `/api/attivita/giornata?data=${encodeURIComponent(data)}`,
    contenitore,
    `Lettura della giornata ${data}`
  );
}

async function leggiOfferteClienteDaEndpoint(
  clienteId: string,
  contenitore: Contenitore
): Promise<OffertaAbilitataCliente[]> {
  const dati = await leggiDaEndpoint<{ offerte: OffertaAbilitataCliente[] }>(
    `/api/attivita/offerte-cliente?cliente=${encodeURIComponent(clienteId)}`,
    contenitore,
    "Lettura delle offerte del cliente"
  );

  return dati.offerte;
}

function leggiContestoInserimentoDaEndpoint(
  contenitore: Contenitore
): Promise<ContestoInserimentoGiornata> {
  return leggiDaEndpoint<ContestoInserimentoGiornata>(
    "/api/attivita/contesto-inserimento",
    contenitore,
    "Lettura del contesto di inserimento"
  );
}

// ── Provider ────────────────────────────────────────────────────

/**
 * Monta le cache dell'area attività: mesi del calendario, giornate di attività
 * e contesto di inserimento.
 *
 * Le tre cache condividono una sola guardia d'identità e un solo canale di
 * notifica di sessione non più valida, così un cambio account rilevato da una
 * qualsiasi di esse rende illeggibili anche le altre.
 *
 * Le cache sono legate a `chiaveSessione`: il layout monta il provider con
 * quella stessa chiave come `key` di React, quindi un cambio di sessione smonta
 * l'istanza — svuotandola — e ne crea una nuova. Nessun dato di un account
 * precedente resta leggibile. Vivono solo nella memoria della scheda: reload,
 * logout e uscita dal layout le distruggono.
 */
export default function AttivitaCacheProvider({
  chiaveSessione,
  children,
}: {
  chiaveSessione: string;
  children: ReactNode;
}) {
  const [contenitore] = useState(() =>
    creaContenitoreCacheAttivita(chiaveSessione)
  );

  // Metodi stabili: le route figlie non si ridisegnano per colpa del contesto.
  const api = useMemo<ApiCacheAttivita>(() => {
    const { cacheMesi, cacheGiornate, cacheContesto, ascoltatoriSessione } =
      contenitore;

    // Un solo canale di sessione non più valida per l'intera scheda, condiviso
    // dalle tre API.
    const subscribeSessioneScaduta = (ascoltatore: () => void) => {
      ascoltatoriSessione.add(ascoltatore);
      return () => {
        ascoltatoriSessione.delete(ascoltatore);
      };
    };

    return {
      calendario: {
        seed: (dati) => cacheMesi.seed(dati),
        read: (token) => cacheMesi.read(token),
        load: (token) => cacheMesi.load(token),
        revalida: (token) => cacheMesi.revalida(token),
        prefetch: (token) => cacheMesi.prefetch(token),
        invalidate: (...token) => cacheMesi.invalidate(...token),
        clear: () => cacheMesi.clear(),
        subscribe: (ascoltatore) => cacheMesi.subscribe(ascoltatore),
        subscribeSessioneScaduta,
      },
      giornate: {
        seed: (dati) => cacheGiornate.seed(dati),
        read: (data) => cacheGiornate.read(data),
        load: (data) => cacheGiornate.load(data),
        revalida: (data) => cacheGiornate.revalida(data),
        prefetch: (data) => cacheGiornate.prefetch(data),
        invalidate: (...data) => cacheGiornate.invalidate(...data),
        clear: () => cacheGiornate.clear(),
        subscribe: (ascoltatore) => cacheGiornate.subscribe(ascoltatore),
        subscribeSessioneScaduta,
      },
      contestoInserimento: {
        seed: (dati) => cacheContesto.seed(dati),
        read: () => cacheContesto.read(),
        load: () => cacheContesto.load(),
        revalida: () => cacheContesto.revalida(),
        prefetch: () => cacheContesto.prefetch(),
        invalidate: () => cacheContesto.invalidate(),
        clear: () => cacheContesto.clear(),
        subscribe: (ascoltatore) => cacheContesto.subscribe(ascoltatore),
        subscribeSessioneScaduta,
      },
      offerteCliente: {
        leggi: (clienteId) =>
          leggiOfferteClienteDaEndpoint(clienteId, contenitore),
        subscribeSessioneScaduta,
      },
    };
    // `contenitore` cambia identità solo al cambio di sessione.
  }, [contenitore]);

  // Uscendo dall'area attività nessuna delle cache deve sopravvivere.
  useEffect(() => {
    return () => svuotaTutteLeCache(contenitore);
  }, [contenitore]);

  return (
    <ContestoCacheAttivita.Provider value={api}>
      {children}
    </ContestoCacheAttivita.Provider>
  );
}
