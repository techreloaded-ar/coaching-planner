/**
 * Contratto dell'adattatore che collega l'oracolo a una singola consegna.
 *
 * Ogni consegna sceglie liberamente nomi, modelli, route e forme dei dati: l'adattatore
 * traduce queste operazioni astratte nelle interfacce realmente prodotte, SENZA implementare
 * capacità mancanti e senza modificare il codice applicativo. Se una capacità non esiste
 * nella consegna, l'operazione lancia `new NonImplementato("...")`.
 *
 * File da produrre nella consegna:
 *   __oracolo__/adattatore/integrazione.ts  → export const adattatoreIntegrazione: AdattatoreIntegrazione
 *   __oracolo__/adattatore/browser.ts       → export const adattatoreBrowser: AdattatoreBrowser
 */
import type { Locator, Page } from "@playwright/test";

export class NonImplementato extends Error {}

/** Mese di calendario: `mese` va da 1 a 12. */
export type Mese = { anno: number; mese: number };

export type EventoStorico = {
	tipo: "chiusura" | "riapertura";
	/** id dell'Utente che ha eseguito l'operazione, se la consegna lo registra */
	autoreUtenteId: string | null;
	quando: Date;
	motivazione: string | null;
};

/**
 * Livello integrazione (Vitest, stesso processo dell'app, database reale).
 * La sessione dell'utente corrente è già impostata dall'oracolo tramite il cookie firmato
 * (`next/headers` è simulato): l'adattatore deve chiamare le server action / route handler /
 * funzioni di dominio REALI della consegna, esattamente come farebbe l'interfaccia.
 * Esiti negativi possono essere restituiti o lanciati: l'oracolo verifica sempre lo stato.
 */
export interface AdattatoreIntegrazione {
	/** Chiede la chiusura del mese con la sessione corrente. */
	chiudiMese(mese: Mese): Promise<unknown>;
	/** Chiede la riapertura; `motivazione` null = nessuna motivazione fornita. */
	riapriMese(mese: Mese, motivazione: string | null): Promise<unknown>;
	/** Stato persistito del mese, letto dalla persistenza della consegna (non dalla sessione). */
	meseChiuso(mese: Mese): Promise<boolean>;
	/** Storico persistito, in qualsiasi ordine. Lancia NonImplementato se la consegna non lo registra. */
	storico(mese: Mese): Promise<EventoStorico[]>;
}

/**
 * Livello browser (Playwright contro `next start` della consegna).
 * La pagina è già autenticata con il ruolo indicato da ogni operazione.
 */
export interface AdattatoreBrowser {
	/** Da amministratore: chiude il mese usando solo l'interfaccia. Ritorna quando l'esito è visibile. */
	chiudiMese(page: Page, mese: Mese): Promise<void>;
	/** Da amministratore: riapre il mese con motivazione usando solo l'interfaccia. */
	riapriMese(page: Page, mese: Mese, motivazione: string): Promise<void>;
	/** Elemento che segnala "mese chiuso" nella pagina corrente (calendario o dettaglio giornata). */
	indicatoreMeseChiuso(page: Page): Locator;
	/**
	 * Controlli ATTIVI per aggiungere, modificare, eliminare o duplicare righe nel dettaglio
	 * giornata corrente. In un mese chiuso l'oracolo si aspetta zero elementi abilitati.
	 */
	azioniModificaGiornata(page: Page): Locator;
	/**
	 * Da amministratore: apre il report in cui la consegna mostra lo stato del mese e ritorna
	 * l'elemento che dice "chiuso". Lancia NonImplementato se i report non mostrano lo stato.
	 */
	statoMeseNelReport(page: Page, mese: Mese): Promise<Locator>;
	/**
	 * Da collaboratore, nel dettaglio giornata già aperto: compila il form di una nuova riga
	 * con le etichette date, SENZA inviarlo.
	 */
	compilaNuovaRiga(
		page: Page,
		riga: { cliente: string; offerta: string; clienteId: string; offertaId: string; ore: string },
	): Promise<void>;
	/** Invia il form compilato da `compilaNuovaRiga`. */
	inviaNuovaRiga(page: Page): Promise<void>;
	/** Messaggio di errore mostrato dopo un salvataggio rifiutato. */
	messaggioErrore(page: Page): Locator;
	/** Percorsi delle pagine nuove della funzionalità (es. gestione mesi), per i controlli a 390 px. */
	pagineFunzionalita(mese: Mese): string[];
}
