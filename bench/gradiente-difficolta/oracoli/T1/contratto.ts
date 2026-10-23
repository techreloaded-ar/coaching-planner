/**
 * T1 · «Referente del cliente» — contratto dell'adattatore.
 *
 * L'adattatore collega l'oracolo alle interfacce REALI della consegna (server action, funzioni
 * di lettura, pagine). Traduce firme, nomi dei campi del FormData e locator; non valida, non
 * normalizza, non controlla ruoli. Capacità assente → `throw new NonImplementato("motivo")`.
 *
 * File da produrre nella consegna:
 *   __oracolo__/adattatore/integrazione.ts → export const adattatoreIntegrazione: AdattatoreIntegrazione
 *   __oracolo__/adattatore/browser.ts      → export const adattatoreBrowser: AdattatoreBrowser
 */
import type { Locator, Page } from "@playwright/test";
import type { ImportiClienteFatturazione, TokenMese } from "./shared/contratto-comune";

export * from "./shared/contratto-comune";

/** Valori come digitati nel form; "" = campo lasciato vuoto. L'adattatore li inoltra INVARIATI. */
export type ReferenteInput = { nome: string; email: string; telefono: string };

/** Valori persistiti, letti senza reinterpretazione (null = colonna/riga assente). */
export type ReferentePersistito = { nome: string | null; email: string | null; telefono: string | null };

/**
 * Livello integrazione. La sessione è già impostata dall'oracolo (cookie firmato reale):
 * l'adattatore chiama le server action / funzioni della consegna come farebbe l'interfaccia.
 * Esiti negativi possono essere restituiti o lanciati: l'oracolo verifica la persistenza.
 */
export interface AdattatoreIntegrazione {
	/**
	 * Server action reale di CREAZIONE cliente. `anagrafica` contiene ragione sociale e partita
	 * IVA valide; gli altri campi anagrafici della baseline restano vuoti; i campi referente
	 * vanno nel FormData con i nomi usati dal form della consegna, con i valori ricevuti.
	 */
	creaCliente(anagrafica: { ragioneSociale: string; partitaIva: string }, referente: ReferenteInput): Promise<unknown>;
	/**
	 * Server action reale di MODIFICA del referente (quella usata dal form di modifica). Se la
	 * consegna aggiorna referente e anagrafica nella stessa action, l'adattatore rimanda gli altri
	 * campi del cliente con i valori persistiti correnti, come li precompila il form.
	 */
	aggiornaReferente(clienteId: string, referente: ReferenteInput): Promise<unknown>;
	/** Lettura diretta della persistenza della consegna (Prisma `db` o SQL), senza trasformazioni. */
	referentePersistito(clienteId: string): Promise<ReferentePersistito>;
	/**
	 * Funzione di lettura reale usata dalla pagina di dettaglio cliente (baseline: `clientePerId`).
	 * null se la funzione non restituisce il cliente.
	 */
	clientePerDettaglio(clienteId: string): Promise<{ ragioneSociale: string; referente: ReferentePersistito } | null>;
	/** Report Fatturazione Clienti reale (baseline `reportFatturazioneClientiMese`) proiettato sul cliente. */
	importiFatturazioneCliente(token: TokenMese, clienteId: string): Promise<ImportiClienteFatturazione | null>;
	/**
	 * Ruolo del «cliente» (utente esterno). null = la consegna non introduce un ruolo dedicato:
	 * l'oracolo usa un utente COLLABORATORE senza profilo Collaboratore.
	 */
	ruoloUtenteCliente: string | null;
}

/** Livello browser (Playwright contro `next start`). Le pagine sono già autenticate. */
export interface AdattatoreBrowser {
	/** Setup sintetico (SQL via `e2ePrisma` dei support e2e): scrive i valori dati, senza validazione. */
	impostaReferente(clienteId: string, referente: { nome: string; email: string; telefono: string }): Promise<void>;
	percorsoElencoClienti(): string;
	percorsoDettaglioCliente(clienteId: string): string;
	/** Pagina con il form che permette di modificare il referente. */
	percorsoModificaReferente(clienteId: string): string;
	percorsoReportFatturazione(token: TokenMese): string;
	/** Riga/scheda del cliente nell'elenco clienti. */
	voceClienteInElenco(page: Page, ragioneSociale: string): Locator;
	/** Intestazione (o scheda) del cliente nel report Fatturazione Clienti già aperto. */
	intestazioneClienteReport(page: Page, clienteId: string): Locator;
	/** I campi del referente nel form già aperto (nome, email, telefono). */
	campiReferente(page: Page): { nome: Locator; email: Locator; telefono: Locator };
	/** Invia il form già compilato e ritorna quando l'esito (navigazione o errore) è visibile. */
	salvaForm(page: Page): Promise<void>;
	/** Messaggio di errore relativo all'email del referente, nel form corrente. */
	erroreEmailReferente(page: Page): Locator;
	/**
	 * Tutti i controlli che nella pagina corrente consentirebbero di modificare il referente
	 * (campi del form, pulsanti/link «Modifica» del cliente). Per un non amministratore
	 * l'oracolo si aspetta zero controlli attivi.
	 */
	controlliModificaReferente(page: Page): Locator;
}
