// Macchina di cache dei mesi del calendario — logica pura, senza React.
//
// Vive separata dal provider per essere verificabile con clock e caricatore
// iniettati, senza montare componenti. Non conosce l'idea di «mese attivo»:
// quella decisione appartiene al componente calendario.
//
// Nessuna dipendenza da storage persistente (localStorage, sessionStorage,
// IndexedDB, service worker) e nessuna libreria di caching: la cache vive
// esclusivamente nella memoria della scheda.

import type { DatiCalendarioMese } from "@/lib/attivita-contract";

// ── Costanti di consistenza ─────────────────────────────────────

/** Finestra durante la quale una entry è considerata fresca: 300 secondi. */
export const DURATA_FRESH_MS = 300_000;

/** Numero massimo di mesi conservati contemporaneamente (espulsione LRU). */
export const MASSIMO_MESI_IN_CACHE = 12;

// ── Tipi ────────────────────────────────────────────────────────

export type StatoEntryCalendario = "fresco" | "scaduto";

/** Esito di una lettura sincrona dalla cache. */
export interface LetturaCalendario {
  dati: DatiCalendarioMese;
  stato: StatoEntryCalendario;
  /** Istante in cui la entry è stata scritta */
  cachedAt: number;
  /** Istante in cui la entry smette di essere fresca */
  expiresAt: number;
  /** Età della entry al momento della lettura, in millisecondi */
  eta: number;
}

export type CaricatoreMese = (token: string) => Promise<DatiCalendarioMese>;

export type Orologio = () => number;

export interface OpzioniCacheCalendario {
  /** Lettura remota di un mese; l'unica sorgente di dati della cache. */
  caricatore: CaricatoreMese;
  /** Orologio iniettabile: i test controllano il tempo, non lo attendono. */
  orologio?: Orologio;
  durataFreshMs?: number;
  massimoMesi?: number;
  /**
   * Invocata quando una risposta dichiara un collaboratore diverso da quello
   * dei dati già in cache: la sessione della scheda è cambiata sotto di noi.
   * La cache è già stata svuotata quando questa callback viene chiamata.
   */
  onIdentitaCambiata?: (collaboratoreId: string) => void;
}

interface VoceCache {
  dati: DatiCalendarioMese;
  cachedAt: number;
}

/**
 * Cache dei mesi del calendario per una singola sessione di scheda.
 *
 * Garanzie:
 * - una entry fresca viene restituita **senza** invocare il caricatore;
 * - una entry scaduta viene restituita subito e provoca **una sola**
 *   rivalidazione in background;
 * - richieste concorrenti sullo stesso mese condividono una sola Promise;
 * - un errore di rete non cancella un dato valido già presente;
 * - un'invalidazione impedisce anche alle risposte già in volo di ripopolare
 *   la entry con dati precedenti alla mutazione;
 * - nessun mese di un collaboratore diverso può convivere con i mesi già in
 *   cache: se una risposta dichiara un'altra identità, la cache si svuota.
 */
export class CacheCalendarioMesi {
  private readonly voci = new Map<string, VoceCache>();
  private readonly inVolo = new Map<string, Promise<DatiCalendarioMese>>();
  private readonly epoche = new Map<string, number>();
  private readonly ascoltatori = new Set<(token: string) => void>();

  private readonly caricatore: CaricatoreMese;
  private readonly orologio: Orologio;
  private readonly durataFreshMs: number;
  private readonly massimoMesi: number;
  private readonly onIdentitaCambiata?: (collaboratoreId: string) => void;

  /**
   * Collaboratore a cui appartengono i dati attualmente in cache, dichiarato
   * dalla prima scrittura. `null` finché la cache è vuota.
   */
  private identita: string | null = null;

  constructor(opzioni: OpzioniCacheCalendario) {
    this.caricatore = opzioni.caricatore;
    this.orologio = opzioni.orologio ?? (() => Date.now());
    this.durataFreshMs = opzioni.durataFreshMs ?? DURATA_FRESH_MS;
    this.massimoMesi = opzioni.massimoMesi ?? MASSIMO_MESI_IN_CACHE;
    this.onIdentitaCambiata = opzioni.onIdentitaCambiata;
  }

  /** Collaboratore dei dati in cache, `null` se la cache è vuota. */
  identitaInCache(): string | null {
    return this.identita;
  }

  // ── Osservabilità (usata dai test e dalla diagnostica) ────────

  /** Token in cache, dal meno al più recentemente usato. */
  tokenInCache(): string[] {
    return [...this.voci.keys()];
  }

  /** Numero di caricamenti attualmente in volo. */
  caricamentiInVolo(): number {
    return this.inVolo.size;
  }

  // ── Scritture ────────────────────────────────────────────────

  /**
   * Inserisce nella cache un mese ottenuto altrove (tipicamente il DTO del
   * rendering server iniziale), rendendolo fresco a partire da adesso.
   */
  seed(dati: DatiCalendarioMese): void {
    this.scrivi(dati.token, dati);
  }

  /** Rimuove i mesi indicati e impedisce alle risposte in volo di riscriverli. */
  invalidate(...token: string[]): void {
    for (const chiave of token) {
      this.voci.delete(chiave);
      this.inVolo.delete(chiave);
      this.epoche.set(chiave, (this.epoche.get(chiave) ?? 0) + 1);
      this.notifica(chiave);
    }
  }

  /**
   * Svuota la cache: nessun dato di una sessione precedente sopravvive.
   * Anche le risposte già in volo diventano inefficaci.
   */
  clear(): void {
    const tokenPresenti = [...this.voci.keys(), ...this.inVolo.keys()];
    this.voci.clear();
    this.inVolo.clear();
    this.identita = null;
    for (const chiave of new Set(tokenPresenti)) {
      this.epoche.set(chiave, (this.epoche.get(chiave) ?? 0) + 1);
    }
  }

  // ── Letture ──────────────────────────────────────────────────

  /**
   * Lettura sincrona: non tocca la rete e non invoca il caricatore.
   * Aggiorna la recency della entry, che è ciò che l'LRU osserva.
   */
  read(token: string): LetturaCalendario | null {
    const voce = this.voci.get(token);
    if (!voce) return null;

    // Marca la entry come usata di recente.
    this.voci.delete(token);
    this.voci.set(token, voce);

    const adesso = this.orologio();
    const expiresAt = voce.cachedAt + this.durataFreshMs;

    return {
      dati: voce.dati,
      stato: adesso < expiresAt ? "fresco" : "scaduto",
      cachedAt: voce.cachedAt,
      expiresAt,
      eta: adesso - voce.cachedAt,
    };
  }

  /**
   * Restituisce il mese, garantendo un dato.
   *
   * - entry fresca ⇒ risolve immediatamente, **zero** invocazioni del caricatore;
   * - entry scaduta ⇒ risolve immediatamente con il dato vecchio e avvia una
   *   sola rivalidazione in background;
   * - entry assente ⇒ attende il caricatore, deduplicando le richieste
   *   concorrenti sullo stesso mese.
   */
  async load(token: string): Promise<DatiCalendarioMese> {
    const lettura = this.read(token);

    if (lettura?.stato === "fresco") {
      return lettura.dati;
    }

    if (lettura?.stato === "scaduto") {
      // Rivalidazione silenziosa: un errore non deve invalidare un dato utile.
      void this.revalida(token).catch(() => undefined);
      return lettura.dati;
    }

    return this.revalida(token);
  }

  /**
   * Forza una lettura remota del mese, deduplicata con le richieste già in
   * volo per lo stesso token. Propaga gli errori al chiamante.
   */
  revalida(token: string): Promise<DatiCalendarioMese> {
    const giaInVolo = this.inVolo.get(token);
    if (giaInVolo) return giaInVolo;

    const epocaAllAvvio = this.epoche.get(token) ?? 0;

    const caricamento = this.caricatore(token)
      .then((dati) => {
        // Se nel frattempo il mese è stato invalidato o la cache svuotata,
        // questa risposta è antecedente alla mutazione: non deve ripopolare.
        if ((this.epoche.get(token) ?? 0) === epocaAllAvvio) {
          this.scrivi(token, dati);
        }
        return dati;
      })
      .finally(() => {
        if (this.inVolo.get(token) === caricamento) {
          this.inVolo.delete(token);
        }
      });

    this.inVolo.set(token, caricamento);
    return caricamento;
  }

  /**
   * Precarica un mese in background. Non fa nulla se la entry è già fresca e
   * non propaga errori: un prefetch fallito è un'occasione mancata, non un
   * guasto da mostrare all'utente.
   */
  prefetch(token: string): void {
    if (this.read(token)?.stato === "fresco") return;
    void this.revalida(token).catch(() => undefined);
  }

  // ── Notifiche ────────────────────────────────────────────────

  /**
   * Registra un ascoltatore invocato quando un mese cambia in cache, così un
   * aggiornamento in background può raggiungere il mese visualizzato.
   */
  subscribe(ascoltatore: (token: string) => void): () => void {
    this.ascoltatori.add(ascoltatore);
    return () => {
      this.ascoltatori.delete(ascoltatore);
    };
  }

  // ── Interni ──────────────────────────────────────────────────

  private scrivi(token: string, dati: DatiCalendarioMese): void {
    // Guardia d'identità: una risposta che dichiara un altro collaboratore
    // significa che la sessione della scheda è cambiata (per esempio un accesso
    // con un altro account nella stessa finestra). In quel caso nessun dato
    // precedente può restare leggibile, nemmeno per un fresh hit.
    if (this.identita !== null && this.identita !== dati.collaboratoreId) {
      this.clear();
      this.onIdentitaCambiata?.(dati.collaboratoreId);
      return;
    }
    this.identita = dati.collaboratoreId;

    this.voci.delete(token);
    this.voci.set(token, { dati, cachedAt: this.orologio() });

    // Espulsione LRU: la entry meno recentemente usata è la prima della Map.
    while (this.voci.size > this.massimoMesi) {
      const primaChiave = this.voci.keys().next().value;
      if (primaChiave === undefined) break;
      this.voci.delete(primaChiave);
    }

    this.notifica(token);
  }

  private notifica(token: string): void {
    for (const ascoltatore of this.ascoltatori) {
      ascoltatore(token);
    }
  }
}
