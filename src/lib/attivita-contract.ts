// Contratto dati del calendario attività, condiviso fra server e client.
//
// Questo modulo NON importa `server-only` e non tocca il database: contiene
// soltanto tipi serializzabili. Serve al rendering RSC iniziale, al route
// handler `GET /api/attivita/calendario` e alla cache client del calendario,
// che devono parlare esattamente la stessa lingua.

/** Sintesi delle ore di un cliente in un giorno. */
export interface SintesiClienteGiorno {
  /** Id del cliente */
  clienteId: string;
  /** Ragione sociale del cliente */
  ragioneSociale: string;
  /** Ore sommate per il cliente nel giorno, su tutte le offerte */
  ore: number;
}

/** Sintesi aggregata di un giorno. */
export interface SintesiGiorno {
  /** Data in formato YYYY-MM-DD */
  data: string;
  /** Numero di righe registrate */
  righe: number;
  /** Ore totali */
  oreTotali: number;
  /** Sintesi per cliente, in ordine di prima apparizione nel giorno */
  clienti: SintesiClienteGiorno[];
}

/**
 * Dati minimi di un mese del calendario.
 *
 * Contiene il token del mese e la sintesi per giorno: etichetta del mese e
 * griglia delle 42 celle sono derivate nel client dalle funzioni pure di
 * `@/domain/calendario`, così non viaggiano nel payload.
 */
export interface DatiCalendarioMese {
  /** Token YYYY-MM del mese descritto */
  token: string;
  /**
   * Collaboratore a cui appartengono i dati, derivato dalla sessione server.
   *
   * Non è un parametro accettato dal client: è l'identità **dichiarata** dalla
   * risposta. Serve alla cache client per accorgersi che la sessione della
   * scheda è cambiata sotto di lei — per esempio dopo un accesso con un altro
   * account nella stessa finestra — e svuotarsi invece di mostrare i dati del
   * collaboratore precedente.
   */
  collaboratoreId: string;
  /** Sintesi per giorno, indicizzata per data YYYY-MM-DD */
  sintesiPerGiorno: Record<string, SintesiGiorno>;
}
