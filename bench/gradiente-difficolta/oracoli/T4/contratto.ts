/**
 * T4 · «I totali non tornano» — contratto dell'adattatore.
 *
 * Tutte le capacità esistono già nella baseline: l'adattatore collega le funzioni REALI della
 * consegna (riepilogo mensile, avanzamento offerte, report fatturazione) e le loro pagine,
 * traducendo nomi dei campi e convertendo stringhe con `Number(...)`. Non arrotonda, non somma,
 * non riconverte ore in giornate: un valore che la consegna non espone fa lanciare `NonImplementato`.
 * Se la consegna cambia nomi o firme, l'adattatore segue la consegna; i valori restano i suoi.
 *
 * File da produrre nella consegna:
 *   __oracolo__/adattatore/integrazione.ts → export const adattatoreIntegrazione: AdattatoreIntegrazione
 *   __oracolo__/adattatore/browser.ts      → export const adattatoreBrowser: AdattatoreBrowser
 * Riferimento: `adattatore-nullo/` collega la baseline e vale come esempio di mappatura.
 */
import type { Locator, Page } from "@playwright/test";
import type {
	AvanzamentoOfferta,
	ImportiClienteFatturazione,
	RiepilogoMeseCollaboratore,
	TokenMese,
} from "./shared/contratto-comune";

export * from "./shared/contratto-comune";

export interface AdattatoreIntegrazione {
	/** Riepilogo mensile del collaboratore in sessione (baseline `riepilogoMese` di `src/lib/attivita.ts`). */
	riepilogoMese(token: TokenMese): Promise<RiepilogoMeseCollaboratore>;
	/** Avanzamento di un'offerta, sessione amministratore (baseline `elencaOffertePerClienteConAvanzamento`). null se assente. */
	avanzamentoOfferta(offertaId: string, clienteId: string): Promise<AvanzamentoOfferta | null>;
	/** Report Fatturazione Clienti, sessione amministratore, proiettato sul cliente. null se il cliente non compare. */
	importiFatturazioneCliente(token: TokenMese, clienteId: string): Promise<ImportiClienteFatturazione | null>;
}

/** Livello browser. Pagine già autenticate con il ruolo indicato dal test. */
export interface AdattatoreBrowser {
	/** Pagina del riepilogo mensile del collaboratore (baseline `/attivita/riepilogo?mese=YYYY-MM`). */
	percorsoRiepilogo(token: TokenMese): string;
	/** Elemento con l'importo fattura del riepilogo aperto. */
	importoFatturaRiepilogo(page: Page): Locator;
	/** Elemento con le giornate fatturabili totali del riepilogo aperto. */
	giornateFatturabiliRiepilogo(page: Page): Locator;
	/**
	 * Da amministratore: apre la pagina di avanzamento offerte e ritorna l'elemento (riga o
	 * scheda) che mostra l'erogato dell'offerta indicata.
	 */
	apriAvanzamentoOfferta(page: Page, offerta: { id: string; codice: string; clienteId: string }): Promise<Locator>;
	/** Pagina dell'avanzamento offerte (per i controlli responsive e di isolamento). */
	percorsoAvanzamento(): string;
	percorsoReportFatturazione(token: TokenMese): string;
	/** Scheda del cliente nel report Fatturazione Clienti già aperto. */
	schedaClienteReport(page: Page, clienteId: string): Locator;
}
