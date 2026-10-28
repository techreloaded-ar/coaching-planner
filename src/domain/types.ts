// Tipi di dominio condivisi per Coaching Planner

/** Conversione fissa: 1 giornata = 8 ore */
export const ORE_PER_GIORNATA = 8;

/** Ruoli utente */
export type Ruolo = "AMMINISTRATORE" | "COLLABORATORE";

/** Categorie di un'attività, in ordine di presentazione */
export const CATEGORIE_ATTIVITA = [
  "FATTURABILE",
  "NON_FATTURABILE",
  "INVESTIMENTO",
] as const;

/** Chi fattura l'attività: collaboratore → Agile Reloaded e/o Agile Reloaded → cliente */
export type CategoriaAttivita = (typeof CATEGORIE_ATTIVITA)[number];

export const CATEGORIA_ATTIVITA_PREDEFINITA: CategoriaAttivita = "FATTURABILE";

/** Etichetta e significato di ogni categoria, mostrati al collaboratore */
export const DESCRIZIONE_CATEGORIA_ATTIVITA: Record<
  CategoriaAttivita,
  { etichetta: string; significato: string }
> = {
  FATTURABILE: {
    etichetta: "Fatturabile",
    significato:
      "La fatturi ad Agile Reloaded e Agile Reloaded la fattura al cliente.",
  },
  NON_FATTURABILE: {
    etichetta: "Non fatturabile",
    significato:
      "La fatturi ad Agile Reloaded, ma Agile Reloaded non la fattura al cliente.",
  },
  INVESTIMENTO: {
    etichetta: "Investimento",
    significato:
      "Non la fatturi ad Agile Reloaded e Agile Reloaded non la fattura al cliente.",
  },
};

export function isCategoriaAttivita(valore: unknown): valore is CategoriaAttivita {
  return CATEGORIE_ATTIVITA.includes(valore as CategoriaAttivita);
}

/** Agile Reloaded fattura l'attività al cliente finale */
export function fatturataAlCliente(categoria: CategoriaAttivita): boolean {
  return categoria === "FATTURABILE";
}

/** Il collaboratore fattura l'attività ad Agile Reloaded */
export function fatturataDalCollaboratore(categoria: CategoriaAttivita): boolean {
  return categoria !== "INVESTIMENTO";
}

/** Payload JWT della sessione stateless */
export interface PayloadSessione {
  utenteId: string;
  ruolo: Ruolo;
  nome: string;
  email: string;
  expiresAt: number; // timestamp Unix in secondi
}

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

/** Voce di rimborso trasferta a etichetta libera */
export interface VoceRimborsoTrasferta {
  id: string;
  etichetta: string;
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
  categoria: CategoriaAttivita;
  rimborsoTrasfertaEtichetta?: string;
  rimborsoTrasfertaImporto?: number;
  createdAt: Date;
  updatedAt: Date;
}
