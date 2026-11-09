import type { CategoriaAttivita, ModalitaTariffa, Ruolo, GestioneTrasferta } from "@/generated/prisma/client";

export type Celle = Record<string, string>;
export interface Schede { clienti: Celle[]; offerte: Celle[]; coach: Celle[]; giornate: Celle[] }
export interface Giornata {
  collaboratoreId: string;
  clienteId: string;
  offertaId: string | null;
  data: string;
  ore: string;
  categoria: CategoriaAttivita;
  inAffiancamento?: boolean;
  rimborsoTrasfertaImporto: string | null;
  rimborsoTrasfertaEtichetta: string | null;
  nota: string | null;
}
export interface Esistente extends Giornata { id: string; versione: string }
export interface ClienteImport { id: string; ragioneSociale: string; dettagli: Celle; dati: Celle; verifica: boolean }
export interface CoachImport {
  profiloEsistente?: boolean;
  attivo?: boolean;
  tariffe?: { validaDalMese: string; validaAlMese: string | null; modalita: ModalitaTariffa; importo: string }[];
  utenteEsistente?: boolean;
  id: string; userId: string; nome: string; cognome: string; email: string; partitaIva: string;
  ruolo: Ruolo; modalita: ModalitaTariffa; importo: string; dalMese: string;
}
export interface OffertaImport {
  ripiego?: boolean;
  id: string; clienteId: string; codice: string; descrizione: string; tariffaGiornaliera: string;
  giorniPrevisti: number; gestioneTrasferta: GestioneTrasferta; importoTrasfertaForfettaria: string | null;
  attiva: boolean; numeroOrdine: string | null; accountAgileReloaded: string | null; anno: number;
}
export interface Anagrafiche {
  clienti: ClienteImport[]; coach: CoachImport[]; offerte: OffertaImport[]; avvisi: string[];
}
export type StatoRiga = "PRONTA" | "AGGIORNARE" | "VERIFICARE" | "NON_IMPORTABILE" | "PRESENTE" | "IGNORATA" | "SCOMPARSA";
export interface RigaAnteprima {
  senzaCodice?: { motivo: "MANCANTE" | "SCONOSCIUTA" | "AMBIGUA"; codiceOriginale: string };
  chiave: string;
  numero: number;
  grezzi: Celle;
  stato: StatoRiga;
  motivo: string;
  proposta: Giornata | null;
  candidati: Esistente[];
  collegataId?: string;
  suggerimento?: string;
}
export interface Registro {
  chiave: string; dati: Celle; rigaAttivitaId: string | null; impronta: string | null; ignorata: boolean;
}
export interface Archivio {
  clienti: { id: string; ragioneSociale: string }[];
  utenti: { id: string; email: string; ruolo?: Ruolo; attivo?: boolean; collaboratore: { id: string; attivo?: boolean; tariffe?: { validaDalMese: string; validaAlMese: string | null; modalita: ModalitaTariffa; importo: string }[] } | null }[];
  offerte: { id: string; codice: string; clienteId: string }[];
  giornate: Esistente[];
  rimborsi: { etichetta: string; importo: string }[];
  registro: Registro[];
}
export interface Piano {
  versione: 6;
  origine: string;
  modalita: "INCREMENTALE" | "RESET";
  revisioneArchivio: string;
  anagrafiche: Anagrafiche;
  righe: RigaAnteprima[];
  ai: string;
  schede: Schede;
  riferimenti: {
    clienti: { id: string; ragioneSociale: string }[];
    coach: { id: string; etichetta: string }[];
    offerte: { id: string; codice: string; clienteId: string }[];
  };
  esito?: { aggiunte: number; aggiornate: number; riconosciute: number; ignorate: number; eliminate: number };
}
export interface Decisione { chiave: string; azione: "NUOVA" | "AGGIORNA" | "COLLEGA" | "IGNORA" | "SENZA_CODICE" | "ELIMINA"; destinazione?: string }
