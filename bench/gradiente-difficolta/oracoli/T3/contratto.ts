/**
 * T3 · «Tariffe con validità nel tempo» — contratto dell'adattatore.
 *
 * Tre file nella consegna:
 *   __oracolo__/adattatore/dati.ts         → export const adattatoreDati: AdattatoreDati
 *   __oracolo__/adattatore/integrazione.ts → export const adattatoreIntegrazione: AdattatoreIntegrazione
 *   __oracolo__/adattatore/browser.ts      → export const adattatoreBrowser: AdattatoreBrowser
 *
 * `AdattatoreDati` è SOLO preparazione sintetica dei dati (SQL tramite `e2ePrisma` di
 * tests/e2e/support/prisma, perché gira anche dentro Playwright): scrive collaboratori e offerte
 * con una storia tariffaria nella schema REALE della consegna (anche se le tariffe sono state
 * spostate su nuove tabelle), come li avrebbe scritti il prodotto. Non valida, non rifiuta, non
 * calcola importi. La factory e2e della consegna NON è usata per offerte e collaboratori: se è
 * incompatibile con la nuova schema, il gate di regressione ne conserva il fallimento a parte.
 *
 * `AdattatoreIntegrazione` chiama le server action e le funzioni di lettura REALI (sessione già
 * impostata dall'oracolo con cookie firmato). Nessun controllo di autorizzazione, di
 * sovrapposizione o calcolo di importi può stare nell'adattatore: una capacità assente lancia
 * `NonImplementato`.
 */
import type { Locator, Page } from "@playwright/test";
import type {
	AvanzamentoOfferta,
	DataGiorno,
	ImportiClienteFatturazione,
	RiepilogoMeseCollaboratore,
	TokenMese,
	UtenteSessione,
} from "./shared/contratto-comune";

export * from "./shared/contratto-comune";

export type EntitaTariffata = { tipo: "offerta" | "collaboratore"; id: string };

/**
 * Validità iniziale per il setup. `decorrenza: null` = validità aperta verso il passato, come quella
 * prodotta dalla migrazione per le tariffe preesistenti (l'adattatore usa la stessa rappresentazione
 * della migrazione della consegna, es. NULL o data sentinella).
 */
export type TariffaIniziale = { decorrenza: DataGiorno | null; tariffa: number };

/**
 * Validità come persistita, senza ricalcoli. `decorrenza` null o data sentinella usata dalla consegna
 * per «da sempre». `fine` = ultimo giorno incluso se la consegna lo MEMORIZZA; null se aperta o se la
 * consegna non memorizza la fine (vedi `semanticaFine`).
 */
export type ValiditaTariffa = { decorrenza: DataGiorno | null; fine: DataGiorno | null; tariffa: number };

export interface AdattatoreDati {
	/**
	 * Crea Utente + Collaboratore attivo con la storia tariffaria data (ordinata per decorrenza).
	 * Con `semanticaFine: "esplicita"` scrive anche le fini come le scriverebbe il prodotto. Se la
	 * schema conserva una tariffa «corrente» su Collaboratore, la valorizza come farebbe il prodotto.
	 */
	creaCollaboratore(opzioni: {
		namespace: string;
		ruolo: "COLLABORATORE" | "AMMINISTRATORE";
		tariffe: TariffaIniziale[];
	}): Promise<{ utente: UtenteSessione; collaboratoreId: string; cognome: string }>;
	/** Crea un'Offerta attiva del cliente con la storia tariffaria data (stesse regole). */
	creaOfferta(opzioni: {
		namespace: string;
		clienteId: string;
		giorniPrevisti: number;
		tariffe: TariffaIniziale[];
	}): Promise<{ offertaId: string; codice: string }>;
	/** Validità persistite dell'entità, in qualsiasi ordine, lette dalla persistenza senza trasformazioni. */
	validita(entita: EntitaTariffata): Promise<ValiditaTariffa[]>;
	/** "esplicita" se la consegna memorizza la fine di ogni validità chiusa; "implicita" se la fine è la decorrenza successiva. */
	semanticaFine: "esplicita" | "implicita";
}

export interface AdattatoreIntegrazione {
	/** Server action reale: nuova tariffa con decorrenza (anche futura) per l'entità. */
	pianificaTariffa(entita: EntitaTariffata, nuova: { decorrenza: DataGiorno; tariffa: number }): Promise<unknown>;
	/** Server action reale: corregge l'importo dell'ULTIMA validità dell'entità (stessa decorrenza). */
	correggiUltimaTariffa(entita: EntitaTariffata, correzione: { tariffa: number }): Promise<unknown>;
	/** Riepilogo mensile del collaboratore in sessione (baseline `riepilogoMese`). */
	riepilogoMese(token: TokenMese): Promise<RiepilogoMeseCollaboratore>;
	/** Report Fatturazione Clienti, sessione amministratore, proiettato sul cliente. */
	importiFatturazioneCliente(token: TokenMese, clienteId: string): Promise<ImportiClienteFatturazione | null>;
	/** Avanzamento di un'offerta, sessione amministratore. */
	avanzamentoOfferta(offertaId: string, clienteId: string): Promise<AvanzamentoOfferta | null>;
}

export interface AdattatoreBrowser {
	/** Da amministratore: crea un'offerta dal form ESISTENTE (cliente già esistente) e attende l'esito. */
	creaOffertaDaForm(
		page: Page,
		dati: { clienteId: string; codice: string; descrizione: string; tariffa: string; giorniPrevisti: string },
	): Promise<void>;
	/** Da amministratore: modifica la descrizione di un'offerta dal form ESISTENTE e attende l'esito. */
	modificaDescrizioneOffertaDaForm(page: Page, offerta: { id: string; clienteId: string }, descrizione: string): Promise<void>;
	/** Da amministratore: modifica il cognome di un collaboratore dal form ESISTENTE e attende l'esito. */
	modificaCognomeCollaboratoreDaForm(page: Page, collaboratoreId: string, cognome: string): Promise<void>;
	/** Da amministratore: pianifica una tariffa futura SOLO tramite l'interfaccia e attende l'esito. */
	pianificaTariffaDaInterfaccia(page: Page, entita: EntitaTariffata, nuova: { decorrenza: DataGiorno; tariffa: string }): Promise<void>;
	/** Pagine di gestione tariffe dell'entità (per il controllo a 390 px). */
	percorsiGestioneTariffe(entita: EntitaTariffata): string[];
	/** Elemento della pagina di gestione tariffe che elenca le validità (per verificare che la pagina sia caricata). */
	elencoValidita(page: Page): Locator;
	percorsoReportFatturazione(token: TokenMese): string;
	schedaClienteReport(page: Page, clienteId: string): Locator;
	/** Pagina di avanzamento offerte. */
	percorsoAvanzamento(): string;
}
