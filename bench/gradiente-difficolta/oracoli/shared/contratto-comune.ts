/**
 * Tipi comuni ai contratti degli oracoli T1–T4.
 *
 * Installazione: la cartella `shared/` viene copiata in `<consegna>/__oracolo__/shared/`
 * (vedi `installa_oracolo.py`), quindi i contratti la importano come `./shared/...`
 * e gli adattatori come `../shared/...`.
 *
 * Regola generale: un adattatore TRADUCE (firme, nomi dei campi, stringa→numero con
 * `Number(...)`, locator). Non arrotonda, non somma, non filtra, non controlla ruoli:
 * se una capacità non esiste lancia `new NonImplementato("motivo")`.
 */

export class NonImplementato extends Error {
	constructor(motivo: string) {
		super(motivo);
		this.name = "NonImplementato";
	}
}

/** Token mese "YYYY-MM". */
export type TokenMese = string;

/** Giorno di calendario "YYYY-MM-DD". */
export type DataGiorno = string;

/** Utente con cui l'oracolo firma il cookie di sessione (id = Utente.id a database). */
export type UtenteSessione = {
	id: string;
	ruolo: string;
	nome: string;
	email: string;
};

/**
 * Importi del report Fatturazione Clienti per UN cliente in un mese.
 * Proiezione 1:1 dei campi del report reale della consegna (nella baseline:
 * `reportFatturazioneClientiMese(token).perCliente[i]` di `src/lib/report.ts`).
 * Valori numerici ottenuti con `Number(...)` dalle stringhe del report, senza arrotondare.
 */
export type ImportiClienteFatturazione = {
	clienteId: string;
	imponibileManodopera: number;
	rimborsiTrasferta: number;
	importoTotale: number;
	perOfferta: Array<{
		offertaId: string;
		giornateFatturabili: number;
		imponibile: number;
	}>;
};

/**
 * Riepilogo mensile del collaboratore in sessione (nella baseline `riepilogoMese(token)`
 * di `src/lib/attivita.ts`). Proiezione 1:1: `imponibileManodopera` = `breakdown.imponibileManodopera`,
 * `totaleRimborsi` = `totali.totaleRimborsi`, ecc., convertiti con `Number(...)`.
 */
export type RiepilogoMeseCollaboratore = {
	oreTotali: number;
	oreFatturabili: number;
	giornateTotali: number;
	giornateFatturabili: number;
	imponibileManodopera: number;
	totaleRimborsi: number;
	importoFattura: number;
	perOfferta: Array<{
		offertaId: string;
		oreTotali: number;
		oreFatturabili: number;
		giornateTotali: number;
		giornateFatturabili: number;
		rimborsiTrasferta: number;
	}>;
};

/**
 * Avanzamento di UNA offerta (nella baseline una voce di `elencaOfferteConAvanzamento()` o
 * `elencaOffertePerClienteConAvanzamento(clienteId)` di `src/lib/offerte.ts`).
 * `percentualeUtilizzo` è la frazione 0..1 come nella baseline (0,075 = 7,5 %).
 */
export type AvanzamentoOfferta = {
	offertaId: string;
	giornatePreviste: number;
	giornateErogate: number;
	residuo: number;
	percentualeUtilizzo: number;
	perCollaboratore: Array<{ collaboratoreId: string; oreErogate: number; giornateErogate: number }>;
	matrice: {
		mesi: TokenMese[];
		righe: Array<{
			collaboratoreId: string;
			giornatePerMese: Record<TokenMese, number>;
			totaleGiornate: number;
		}>;
		totaliPerMese: Record<TokenMese, number>;
		totaleGiornate: number;
	};
};
