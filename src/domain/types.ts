// Tipi di dominio condivisi per Coaching Planner

/** Conversione fissa: 1 giornata = 8 ore */
export const ORE_PER_GIORNATA = 8;

/** Ruoli utente */
export type Ruolo = "AMMINISTRATORE" | "COLLABORATORE";

/** Cliente */
export interface Cliente {
  id: string;
  ragioneSociale: string;
  partitaIva?: string;
  indirizzo?: string;
  citta?: string;
  cap?: string;
  provincia?: string;
  attivo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Offerta associata a un cliente */
export interface Offerta {
  id: string;
  codice: string;
  descrizione: string;
  clienteId: string;
  tariffaGiornaliera: number; // Decimal
  giorniPrevisti: number;
  attiva: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Collaboratore */
export interface Collaboratore {
  id: string;
  nome: string;
  cognome: string;
  partitaIva: string;
  tariffaGiornaliera: number; // Decimal
  attivo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Scaglione chilometrico per rimborsi trasferta */
export interface ScaglioneKm {
  id: string;
  finoAKm: number;
  importo: number; // Decimal
  createdAt: Date;
  updatedAt: Date;
}

/** Riga di attività giornaliera */
export interface RigaAttivita {
  id: string;
  collaboratoreId: string;
  clienteId: string;
  offertaId: string;
  data: Date;
  ore: number;
  nota?: string;
  fatturabile: boolean;
  trasfertaKm?: number;
  createdAt: Date;
  updatedAt: Date;
}
