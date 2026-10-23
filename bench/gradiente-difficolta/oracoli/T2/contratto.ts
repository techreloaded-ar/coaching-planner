/**
 * T2 · «Analisi della marginalità» — contratto dell'adattatore.
 *
 * L'adattatore collega l'oracolo alla funzione di lettura REALE del report di marginalità
 * (quella che alimenta la pagina) e alla pagina stessa. Traduce firme e nomi dei campi; converte
 * stringhe in numeri con `Number(...)`. NON somma, NON arrotonda, NON ricalcola margini o
 * percentuali, NON filtra per ruolo o periodo: se la consegna non espone un valore, il campo è
 * `null` (dove il tipo lo consente) oppure l'operazione lancia `NonImplementato`.
 *
 * File da produrre nella consegna:
 *   __oracolo__/adattatore/integrazione.ts → export const adattatoreIntegrazione: AdattatoreIntegrazione
 *   __oracolo__/adattatore/browser.ts      → export const adattatoreBrowser: AdattatoreBrowser
 */
import type { Locator, Page } from "@playwright/test";
import type { ImportiClienteFatturazione, TokenMese } from "./shared/contratto-comune";

export * from "./shared/contratto-comune";

/** Valori di una voce del report così come li espone la consegna. */
export type VoceMarginalita = {
	ricavi: number;
	costi: number;
	margine: number;
	/** Margine percentuale nella scala dichiarata da `scalaPercentuale`; null se la consegna non lo calcola per quella voce (es. ricavi 0). */
	marginePercentuale: number | null;
};

export type CollaboratoreMarginalita = Omit<VoceMarginalita, "ricavi" | "margine" | "marginePercentuale"> & {
	collaboratoreId: string;
	/** null se la consegna non attribuisce ricavi/margine al singolo collaboratore. */
	ricavi: number | null;
	margine: number | null;
	marginePercentuale: number | null;
};

export type OffertaMarginalita = VoceMarginalita & {
	offertaId: string;
	/** Dettaglio collaboratori DENTRO l'offerta; null se la consegna lo espone solo a livello cliente. */
	perCollaboratore: CollaboratoreMarginalita[] | null;
};

export type ClienteMarginalita = VoceMarginalita & {
	clienteId: string;
	perOfferta: OffertaMarginalita[];
	/** Dettaglio collaboratori a livello cliente; null se la consegna lo espone solo per offerta. */
	perCollaboratore: CollaboratoreMarginalita[] | null;
};

export type ReportMarginalita = {
	perCliente: ClienteMarginalita[];
};

/** Esito di rifiuto restituito (non lanciato) dalla consegna, tradotto dall'adattatore. */
export type RifiutoMarginalita = { rifiutato: true; motivo: string | null };

export interface AdattatoreIntegrazione {
	/**
	 * Report di marginalità per il periodo da `da` ad `a` (mesi YYYY-MM, estremi come scelti
	 * dall'utente), con la sessione corrente. Chiama la stessa catena che usa la pagina: se la
	 * pagina valida il periodo con una funzione della consegna prima di leggere, l'adattatore
	 * chiama quella funzione e poi la lettura, senza aggiungere controlli propri.
	 * Errori lanciati dalla consegna (ruolo, periodo) si propagano; un esito di errore restituito
	 * si traduce in `{ rifiutato: true, motivo }`.
	 */
	reportMarginalita(da: TokenMese, a: TokenMese): Promise<ReportMarginalita | RifiutoMarginalita>;
	/** "punti" se 37,5 % è esposto come 37.5; "frazione" se come 0.375. */
	scalaPercentuale: "punti" | "frazione";
	/** Report Fatturazione Clienti reale (baseline `reportFatturazioneClientiMese`) proiettato sul cliente. */
	importiFatturazioneCliente(token: TokenMese, clienteId: string): Promise<ImportiClienteFatturazione | null>;
	/** Ruolo del «cliente» (utente esterno); null = utente COLLABORATORE senza profilo Collaboratore. */
	ruoloUtenteCliente: string | null;
}

/** Livello browser. Pagine già autenticate come amministratore. */
export interface AdattatoreBrowser {
	/** Apre il report sul periodo dato (URL o controlli) e ritorna quando il risultato è visibile. */
	apriReport(page: Page, da: TokenMese, a: TokenMese): Promise<void>;
	/** Con il report aperto: cambia mese iniziale e finale SOLO tramite i controlli dell'interfaccia. */
	impostaPeriodoDaInterfaccia(page: Page, da: TokenMese, a: TokenMese): Promise<void>;
	/** Sezione/scheda del cliente nel report aperto (comprende il dettaglio per offerta e collaboratore, espanso se serve). */
	sezioneCliente(page: Page, clienteId: string, ragioneSociale: string): Promise<Locator>;
	/** Pagina iniziale del back-office amministratore da cui parte la navigazione (baseline: "/anagrafiche"). */
	percorsoBackOffice(): string;
	/** Link/voce di menu del back-office che porta al report. */
	collegamentoAlReport(page: Page): Locator;
	/** Elemento che identifica la pagina del report (intestazione o contenitore). */
	contenitoreReport(page: Page): Locator;
}
