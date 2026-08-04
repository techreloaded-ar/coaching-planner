// Macchina di cache dei dati di una scheda del browser — logica pura, senza React.
//
// È la generalizzazione della cache dei mesi del calendario introdotta da
// US-052: stessa semantica già provata (finestra fresca, espulsione LRU,
// single-flight, epoche di invalidazione, notifiche), parametrizzata dal tipo
// del DTO e dalla funzione che ne ricava la chiave. Le specializzazioni —
// mesi del calendario, giornate di attività, contesto di inserimento — non
// riscrivono la macchina a stati: la configurano.
//
// Vive separata dai provider React per essere verificabile con orologio e
// caricatore iniettati, senza montare componenti.
//
// Nessuna dipendenza da storage persistente (localStorage, sessionStorage,
// IndexedDB, service worker) e nessuna libreria di caching: la cache vive
// esclusivamente nella memoria della scheda.

// ── Costanti di consistenza ─────────────────────────────────────

/** Finestra durante la quale una voce è considerata fresca: 300 secondi. */
export const DURATA_FRESH_MS = 300_000;

// ── Tipi ────────────────────────────────────────────────────────

export type StatoVoceCache = "fresco" | "scaduto";

/** Esito di una lettura sincrona dalla cache. */
export interface LetturaCache<T> {
  dati: T;
  stato: StatoVoceCache;
  /** Istante in cui la voce è stata scritta */
  cachedAt: number;
  /** Istante in cui la voce smette di essere fresca */
  expiresAt: number;
  /** Età della voce al momento della lettura, in millisecondi */
  eta: number;
}

export type CaricatoreDatiScheda<T> = (chiave: string) => Promise<T>;

export type Orologio = () => number;

/**
 * Contratto minimo dei DTO conservabili: ogni risposta dichiara il
 * collaboratore a cui appartiene, così la guardia d'identità può accorgersi
 * che la sessione della scheda è cambiata sotto di lei.
 */
export interface DatiDiCollaboratore {
  collaboratoreId: string;
}

/** Ciò che la guardia d'identità sa fare a una cache registrata. */
export interface CacheSvuotabile {
  clear(): void;
}

export type NotificaIdentitaCambiata = (collaboratoreId: string) => void;

// ── Guardia d'identità ──────────────────────────────────────────

/**
 * Identità del collaboratore condivisa fra tutte le cache della stessa scheda.
 *
 * L'identità non appartiene alla singola cache perché una risposta che dichiara
 * un altro collaboratore invalida **tutti** i dati della scheda, non solo quelli
 * della cache che se ne è accorta: senza condivisione un cambio account rilevato
 * dal calendario lascerebbe leggibili le giornate del collaboratore precedente,
 * e un fresh hit non emette per costruzione alcuna richiesta che possa
 * accorgersene.
 */
export class GuardiaIdentitaScheda {
  private readonly cacheRegistrate = new Set<CacheSvuotabile>();
  private readonly onIdentitaCambiata?: NotificaIdentitaCambiata;

  /**
   * Collaboratore a cui appartengono i dati attualmente in cache, dichiarato
   * dalla prima scrittura. `null` finché nessuna cache contiene dati suoi.
   */
  private identita: string | null = null;

  constructor(onIdentitaCambiata?: NotificaIdentitaCambiata) {
    this.onIdentitaCambiata = onIdentitaCambiata;
  }

  /** Registra una cache da svuotare quando l'identità cambia. */
  registra(cache: CacheSvuotabile): void {
    this.cacheRegistrate.add(cache);
  }

  /** Collaboratore dei dati in cache, `null` se nessuna identità è registrata. */
  identitaRegistrata(): string | null {
    return this.identita;
  }

  /** Dimentica l'identità senza toccare le cache registrate. */
  reset(): void {
    this.identita = null;
  }

  /**
   * Autorizza la scrittura di dati che dichiarano `collaboratoreId`.
   *
   * - identità assente o coincidente ⇒ `true`, e l'identità resta registrata;
   * - identità diversa ⇒ svuota **tutte** le cache registrate, dimentica
   *   l'identità, invoca **una sola volta** la callback di cambio identità e
   *   restituisce `false`: la scrittura non deve avvenire.
   */
  verifica(collaboratoreId: string): boolean {
    if (this.identita !== null && this.identita !== collaboratoreId) {
      for (const cache of this.cacheRegistrate) {
        cache.clear();
      }
      this.identita = null;
      this.onIdentitaCambiata?.(collaboratoreId);
      return false;
    }

    this.identita = collaboratoreId;
    return true;
  }
}

// ── Opzioni ─────────────────────────────────────────────────────

export interface OpzioniCacheDatiScheda<T> {
  /** Lettura remota di una voce; l'unica sorgente di dati della cache. */
  caricatore: CaricatoreDatiScheda<T>;
  /** Ricava dal DTO la chiave sotto cui conservarlo, usata da `seed`. */
  chiaveDi: (dati: T) => string;
  /** Numero massimo di voci conservate contemporaneamente (espulsione LRU). */
  massimoVoci: number;
  /** Orologio iniettabile: i test controllano il tempo, non lo attendono. */
  orologio?: Orologio;
  durataFreshMs?: number;
  /**
   * Guardia d'identità condivisa con le altre cache della stessa scheda.
   * Se assente ne viene creata una privata, inizializzata con
   * `onIdentitaCambiata`.
   */
  guardia?: GuardiaIdentitaScheda;
  /**
   * Invocata quando una risposta dichiara un collaboratore diverso da quello
   * dei dati già in cache: la sessione della scheda è cambiata sotto di noi.
   * Le cache sono già state svuotate quando questa callback viene chiamata.
   *
   * Ignorata quando viene passata una `guardia` condivisa: in quel caso la
   * callback appartiene alla guardia, che notifica una sola volta per l'intera
   * scheda.
   */
  onIdentitaCambiata?: NotificaIdentitaCambiata;
}

// ── Macchina di cache ───────────────────────────────────────────

/**
 * Cache di una risorsa della scheda, per una singola sessione di scheda.
 *
 * Garanzie:
 * - una voce fresca viene restituita **senza** invocare il caricatore;
 * - una voce scaduta viene restituita subito e provoca **una sola**
 *   rivalidazione in background;
 * - richieste concorrenti sulla stessa chiave condividono una sola Promise;
 * - un errore di rete non cancella un dato valido già presente;
 * - un'invalidazione impedisce anche alle risposte già in volo di ripopolare
 *   la voce con dati precedenti alla mutazione;
 * - nessun dato di un collaboratore diverso può convivere con quelli già in
 *   cache: se una risposta dichiara un'altra identità, tutte le cache della
 *   scheda registrate sulla stessa guardia si svuotano.
 */
export class CacheDatiScheda<T extends DatiDiCollaboratore>
  implements CacheSvuotabile
{
  private readonly voci = new Map<string, VoceCache<T>>();
  private readonly inVolo = new Map<string, Promise<T>>();
  private readonly epoche = new Map<string, number>();
  private readonly ascoltatori = new Set<(chiave: string) => void>();

  private readonly caricatore: CaricatoreDatiScheda<T>;
  private readonly chiaveDi: (dati: T) => string;
  private readonly orologio: Orologio;
  private readonly durataFreshMs: number;
  private readonly massimoVoci: number;
  private readonly guardia: GuardiaIdentitaScheda;

  constructor(opzioni: OpzioniCacheDatiScheda<T>) {
    this.caricatore = opzioni.caricatore;
    this.chiaveDi = opzioni.chiaveDi;
    this.orologio = opzioni.orologio ?? (() => Date.now());
    this.durataFreshMs = opzioni.durataFreshMs ?? DURATA_FRESH_MS;
    this.massimoVoci = opzioni.massimoVoci;
    this.guardia =
      opzioni.guardia ?? new GuardiaIdentitaScheda(opzioni.onIdentitaCambiata);
    this.guardia.registra(this);
  }

  /** Guardia d'identità di questa cache, condivisibile con le altre. */
  guardiaIdentita(): GuardiaIdentitaScheda {
    return this.guardia;
  }

  /** Collaboratore dei dati in cache, `null` se la cache è vuota. */
  identitaInCache(): string | null {
    return this.guardia.identitaRegistrata();
  }

  // ── Osservabilità (usata dai test e dalla diagnostica) ────────

  /** Chiavi in cache, dalla meno alla più recentemente usata. */
  chiaviInCache(): string[] {
    return [...this.voci.keys()];
  }

  /** Numero di caricamenti attualmente in volo. */
  caricamentiInVolo(): number {
    return this.inVolo.size;
  }

  // ── Scritture ────────────────────────────────────────────────

  /**
   * Inserisce nella cache un dato ottenuto altrove (tipicamente il DTO del
   * rendering server iniziale), rendendolo fresco a partire da adesso.
   */
  seed(dati: T): void {
    this.scrivi(this.chiaveDi(dati), dati);
  }

  /** Rimuove le voci indicate e impedisce alle risposte in volo di riscriverle. */
  invalidate(...chiavi: string[]): void {
    for (const chiave of chiavi) {
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
    const chiaviPresenti = [...this.voci.keys(), ...this.inVolo.keys()];
    this.voci.clear();
    this.inVolo.clear();
    this.guardia.reset();
    for (const chiave of new Set(chiaviPresenti)) {
      this.epoche.set(chiave, (this.epoche.get(chiave) ?? 0) + 1);
    }
  }

  // ── Letture ──────────────────────────────────────────────────

  /**
   * Lettura sincrona: non tocca la rete e non invoca il caricatore.
   * Aggiorna la recency della voce, che è ciò che l'LRU osserva.
   */
  read(chiave: string): LetturaCache<T> | null {
    const voce = this.voci.get(chiave);
    if (!voce) return null;

    // Marca la voce come usata di recente.
    this.voci.delete(chiave);
    this.voci.set(chiave, voce);

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
   * Restituisce il dato, garantendo una risposta.
   *
   * - voce fresca ⇒ risolve immediatamente, **zero** invocazioni del caricatore;
   * - voce scaduta ⇒ risolve immediatamente con il dato vecchio e avvia una
   *   sola rivalidazione in background;
   * - voce assente ⇒ attende il caricatore, deduplicando le richieste
   *   concorrenti sulla stessa chiave.
   */
  async load(chiave: string): Promise<T> {
    const lettura = this.read(chiave);

    if (lettura?.stato === "fresco") {
      return lettura.dati;
    }

    if (lettura?.stato === "scaduto") {
      // Rivalidazione silenziosa: un errore non deve invalidare un dato utile.
      void this.revalida(chiave).catch(() => undefined);
      return lettura.dati;
    }

    return this.revalida(chiave);
  }

  /**
   * Forza una lettura remota, deduplicata con le richieste già in volo per la
   * stessa chiave. Propaga gli errori al chiamante.
   */
  revalida(chiave: string): Promise<T> {
    const giaInVolo = this.inVolo.get(chiave);
    if (giaInVolo) return giaInVolo;

    const epocaAllAvvio = this.epoche.get(chiave) ?? 0;

    const caricamento = this.caricatore(chiave)
      .then((dati) => {
        // Se nel frattempo la voce è stata invalidata o la cache svuotata,
        // questa risposta è antecedente alla mutazione: non deve ripopolare.
        if ((this.epoche.get(chiave) ?? 0) === epocaAllAvvio) {
          this.scrivi(chiave, dati);
        }
        return dati;
      })
      .finally(() => {
        if (this.inVolo.get(chiave) === caricamento) {
          this.inVolo.delete(chiave);
        }
      });

    this.inVolo.set(chiave, caricamento);
    return caricamento;
  }

  /**
   * Precarica una voce in background. Non fa nulla se è già fresca e non
   * propaga errori: un prefetch fallito è un'occasione mancata, non un guasto
   * da mostrare all'utente.
   */
  prefetch(chiave: string): void {
    if (this.read(chiave)?.stato === "fresco") return;
    void this.revalida(chiave).catch(() => undefined);
  }

  // ── Notifiche ────────────────────────────────────────────────

  /**
   * Registra un ascoltatore invocato quando una voce cambia in cache, così un
   * aggiornamento in background può raggiungere la vista corrente.
   */
  subscribe(ascoltatore: (chiave: string) => void): () => void {
    this.ascoltatori.add(ascoltatore);
    return () => {
      this.ascoltatori.delete(ascoltatore);
    };
  }

  // ── Interni ──────────────────────────────────────────────────

  private scrivi(chiave: string, dati: T): void {
    // Guardia d'identità: una risposta che dichiara un altro collaboratore
    // significa che la sessione della scheda è cambiata (per esempio un accesso
    // con un altro account nella stessa finestra). In quel caso nessun dato
    // precedente può restare leggibile, nemmeno per un fresh hit.
    if (!this.guardia.verifica(dati.collaboratoreId)) return;

    this.voci.delete(chiave);
    this.voci.set(chiave, { dati, cachedAt: this.orologio() });

    // Espulsione LRU: la voce meno recentemente usata è la prima della Map.
    while (this.voci.size > this.massimoVoci) {
      const primaChiave = this.voci.keys().next().value;
      if (primaChiave === undefined) break;
      this.voci.delete(primaChiave);
    }

    this.notifica(chiave);
  }

  private notifica(chiave: string): void {
    for (const ascoltatore of this.ascoltatori) {
      ascoltatore(chiave);
    }
  }
}

interface VoceCache<T> {
  dati: T;
  cachedAt: number;
}
