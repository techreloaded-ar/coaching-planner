// Contratto dati dell'area attività, condiviso fra server e client.
//
// Questo modulo NON importa `server-only` e non tocca il database: contiene
// soltanto tipi serializzabili. Serve al rendering RSC iniziale, ai route
// handler dell'area attività e alle cache client della scheda, che devono
// parlare esattamente la stessa lingua.

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

/** Riga attività dopo serializzazione (Date → string, Decimal → number/string) */
export interface RigaAttivitaClient {
  id: string;
  /** Data in formato YYYY-MM-DD */
  data: string;
  ore: number;
  nota: string | null;
  fatturabile: boolean;
  rimborsoTrasfertaEtichetta: string | null;
  rimborsoTrasfertaImporto: string | null;
  offerta: {
    id: string;
    codice: string;
    descrizione: string;
  };
  cliente: {
    id: string;
    ragioneSociale: string;
  };
}

/** Cliente per la select del form riga attività */
export interface ClienteSelect {
  id: string;
  ragioneSociale: string;
}

/** Voce di rimborso trasferta selezionabile nel form riga attività */
export interface VoceRimborsoTrasfertaSelezionabile {
  id: string;
  etichetta: string;
  importo: string;
}

/**
 * Dati di una giornata di attività.
 *
 * Contiene la data descritta e le righe già serializzate per il client: è ciò
 * che la scheda mostra quando apre o cambia giorno.
 */
export interface DatiGiornataAttivita {
  /** Data in formato YYYY-MM-DD della giornata descritta */
  data: string;
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
  /** Righe della giornata, ordinate per data di creazione crescente */
  righe: RigaAttivitaClient[];
}

/**
 * Contesto di inserimento di una riga attività.
 *
 * È invariante rispetto al giorno: raccoglie i dati che popolano il form
 * (clienti selezionabili e voci di rimborso trasferta), così il cambio giorno
 * non deve richiederli di nuovo.
 */
export interface ContestoInserimentoGiornata {
  /**
   * Collaboratore a cui appartiene il contesto, derivato dalla sessione server.
   *
   * Come per `DatiCalendarioMese`, non è un parametro accettato dal client: è
   * l'identità **dichiarata** dalla risposta, e serve alla cache client per
   * svuotarsi quando la sessione della scheda cambia sotto di lei.
   */
  collaboratoreId: string;
  /** Clienti attivi su cui il collaboratore ha almeno un'offerta abilitata */
  clienti: ClienteSelect[];
  /** Voci di rimborso trasferta selezionabili */
  vociRimborso: VoceRimborsoTrasfertaSelezionabile[];
}
