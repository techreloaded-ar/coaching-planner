/** Contratto del file JSON prodotto dalla fase «prima» (ORACOLO_FOTO_PRIMA). */
import type {
	AvanzamentoOfferta,
	DataGiorno,
	ImportiClienteFatturazione,
	RiepilogoMeseCollaboratore,
	TokenMese,
	UtenteSessione,
} from "../contratto-comune";

export type FotoPrima = {
	generata: string;
	amministratore: UtenteSessione;
	/** Tutti i mesi con almeno una riga attività (dataset + eventuali righe del seed). */
	mesi: TokenMese[];
	/** Tutte le offerte presenti prima della migrazione, con la tariffa corrente e la prima data di riga. */
	offerte: Array<{ id: string; clienteId: string; tariffa: number; primaRiga: DataGiorno | null }>;
	/** Tutti i collaboratori presenti prima della migrazione. */
	collaboratori: Array<{ id: string; tariffa: number; primaRiga: DataGiorno | null; utente: UtenteSessione }>;
	/** [mese][clienteId] → importi del report Fatturazione Clienti della baseline. */
	fatturazione: Record<TokenMese, Record<string, ImportiClienteFatturazione>>;
	/** [mese][collaboratoreId] → riepilogo mensile della baseline (solo collaboratori con righe). */
	riepiloghi: Record<TokenMese, Record<string, RiepilogoMeseCollaboratore>>;
	/** [offertaId] → avanzamento della baseline. */
	avanzamento: Record<string, AvanzamentoOfferta>;
	/** `row_to_json` di tutte le righe attività ordinate per id, una per riga di testo. */
	righe: string;
};
