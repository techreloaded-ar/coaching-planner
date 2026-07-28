"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DatiCalendarioMese } from "@/lib/attivita-contract";
import {
  CacheCalendarioMesi,
  type LetturaCalendario,
} from "./calendario-cache";

// ── Errore di sessione ──────────────────────────────────────────

/**
 * La lettura del mese ha incontrato una sessione non più valida.
 *
 * Non è un errore recuperabile con un retry: la cache viene svuotata e il
 * consumer deve uscire dall'isola client con una navigazione completa.
 */
export class ErroreSessioneCalendario extends Error {
  readonly statusCode: number;

  constructor(statusCode: number) {
    super("Sessione non più valida per la lettura del calendario");
    this.name = "ErroreSessioneCalendario";
    this.statusCode = statusCode;
  }
}

// ── API esposta ai consumer ─────────────────────────────────────

export interface ApiCacheCalendario {
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
  /**
   * Notifica che la sessione non è più quella con cui la cache è stata
   * popolata — decaduta (`401`/`403`) oppure sostituita da un altro account
   * nella stessa finestra — e che serve una navigazione completa.
   */
  subscribeSessioneScaduta(ascoltatore: () => void): () => void;
}

const ContestoCacheCalendario = createContext<ApiCacheCalendario | null>(null);

/**
 * Accede alla cache dei mesi del calendario.
 *
 * Restituisce `null` fuori dal provider, così un componente può funzionare
 * anche senza isola client invece di lanciare durante il rendering.
 */
export function useCacheCalendario(): ApiCacheCalendario | null {
  return useContext(ContestoCacheCalendario);
}

// ── Lettura remota del mese ─────────────────────────────────────

interface Contenitore {
  chiave: string;
  cache: CacheCalendarioMesi;
  ascoltatoriSessione: Set<() => void>;
}

function creaContenitore(chiaveSessione: string): Contenitore {
  const contenitore: Contenitore = {
    chiave: chiaveSessione,
    ascoltatoriSessione: new Set<() => void>(),
    // Sostituito subito sotto: il caricatore deve poter riferire il
    // contenitore per svuotare la cache quando la sessione decade.
    cache: undefined as unknown as CacheCalendarioMesi,
  };
  contenitore.cache = new CacheCalendarioMesi({
    caricatore: (token) => leggiMeseDaEndpoint(token, contenitore),
    // La sessione della scheda è cambiata sotto di noi: la cache si è già
    // svuotata, il consumer deve uscire dall'isola con una navigazione
    // completa invece di continuare a mostrare i mesi del collaboratore
    // precedente.
    onIdentitaCambiata: () => {
      for (const ascoltatore of contenitore.ascoltatoriSessione) {
        ascoltatore();
      }
    },
  });

  return contenitore;
}

async function leggiMeseDaEndpoint(
  token: string,
  contenitore: Contenitore
): Promise<DatiCalendarioMese> {
  const risposta = await fetch(
    `/api/attivita/calendario?mese=${encodeURIComponent(token)}`,
    { headers: { Accept: "application/json" }, credentials: "same-origin" }
  );

  // Il proxy globale reindirizza le rotte protette prive di sessione: una
  // risposta reindirizzata vale quindi come 401, non come dato valido.
  if (risposta.status === 401 || risposta.status === 403 || risposta.redirected) {
    contenitore.cache.clear();
    for (const ascoltatore of contenitore.ascoltatoriSessione) {
      ascoltatore();
    }
    throw new ErroreSessioneCalendario(
      risposta.redirected ? 401 : risposta.status
    );
  }

  if (!risposta.ok) {
    throw new Error(
      `Lettura del mese ${token} non riuscita (HTTP ${risposta.status})`
    );
  }

  return (await risposta.json()) as DatiCalendarioMese;
}

// ── Provider ────────────────────────────────────────────────────

/**
 * Monta la cache dei mesi del calendario per l'area attività.
 *
 * La cache è legata a `chiaveSessione`: il layout monta il provider con quella
 * stessa chiave come `key` di React, quindi un cambio di sessione smonta
 * l'istanza — svuotandola — e ne crea una nuova. Nessun dato di un account
 * precedente resta leggibile. Vive solo nella memoria della scheda: reload,
 * logout e uscita dal layout la distruggono.
 */
export default function CalendarioCacheProvider({
  chiaveSessione,
  children,
}: {
  chiaveSessione: string;
  children: ReactNode;
}) {
  const [contenitore] = useState(() => creaContenitore(chiaveSessione));

  // Metodi stabili: le route figlie non si ridisegnano per colpa del contesto.
  const api = useMemo<ApiCacheCalendario>(() => {
    const { cache, ascoltatoriSessione } = contenitore;
    return {
      seed: (dati) => cache.seed(dati),
      read: (token) => cache.read(token),
      load: (token) => cache.load(token),
      revalida: (token) => cache.revalida(token),
      prefetch: (token) => cache.prefetch(token),
      invalidate: (...token) => cache.invalidate(...token),
      clear: () => cache.clear(),
      subscribe: (ascoltatore) => cache.subscribe(ascoltatore),
      subscribeSessioneScaduta: (ascoltatore) => {
        ascoltatoriSessione.add(ascoltatore);
        return () => {
          ascoltatoriSessione.delete(ascoltatore);
        };
      },
    };
    // `contenitore` cambia identità solo al cambio di sessione.
  }, [contenitore]);

  // Uscendo dall'area attività la cache non deve sopravvivere.
  useEffect(() => {
    const cache = contenitore.cache;
    return () => cache.clear();
  }, [contenitore]);

  return (
    <ContestoCacheCalendario.Provider value={api}>
      {children}
    </ContestoCacheCalendario.Provider>
  );
}
