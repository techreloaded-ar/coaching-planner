// Tipi di dominio condivisi per Coaching Planner

/** Conversione fissa: 1 giornata = 8 ore */
export const ORE_PER_GIORNATA = 8;

/**
 * Le ore sono salvate con due decimali (`Decimal(4,2)`): il dominio le somma
 * e le confronta come interi in centesimi di ora, mai come somme in virgola
 * mobile, che su valori come 7,3 accumulano errori (80 ore che diventano
 * 80,00000000000001 e un'offerta esaurita che risulta oltre budget).
 */
export const CENTESIMI_PER_ORA = 100;
export const CENTESIMI_PER_GIORNATA = ORE_PER_GIORNATA * CENTESIMI_PER_ORA;

/** Unica conversione al confine: ore a due decimali → centesimi di ora interi. */
export function oreInCentesimi(ore: number): number {
  return Math.round(ore * CENTESIMI_PER_ORA);
}

/** Somma esatta di ore: avviene sugli interi in centesimi di ora. */
export function sommaOre(...ore: number[]): number {
  return (
    ore.reduce((totale, valore) => totale + oreInCentesimi(valore), 0) /
    CENTESIMI_PER_ORA
  );
}

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

/** Come Agile Reloaded fattura le trasferte al cliente per un'offerta */
export const GESTIONI_TRASFERTA = ["INCLUSA", "FORFETTARIA"] as const;

export type GestioneTrasferta = (typeof GESTIONI_TRASFERTA)[number];

export function isGestioneTrasferta(valore: unknown): valore is GestioneTrasferta {
  return GESTIONI_TRASFERTA.includes(valore as GestioneTrasferta);
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
