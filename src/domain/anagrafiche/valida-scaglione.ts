// Modulo di validazione pura per dati scaglione km (ADR-006)
// Nessuna dipendenza da framework — funzioni pure.

import { normalizzaTariffaGiornaliera } from "./valida-offerta";

/** Dati in ingresso per la validazione di uno scaglione km */
export interface DatiScaglioneInput {
	finoAKm: string;
	importo: string;
}

/** Mappa campo → messaggio di errore. Vuota se la validazione passa. */
export type ErroriValidazioneScaglione = Record<string, string>;

/** Scaglione esistente usato per il controllo di unicità della soglia */
export interface ScaglioneEsistente {
	id: string;
	finoAKm: number;
}

const RE_INTERO_POSITIVO = /^\d+$/;

/**
 * Valida i dati di uno scaglione km e restituisce una mappa campo → errore.
 * Restituisce `{}` se tutti i controlli passano.
 */
export function validaScaglione(
	dati: DatiScaglioneInput,
): ErroriValidazioneScaglione {
	const errori: ErroriValidazioneScaglione = {};

	if (!dati.finoAKm || dati.finoAKm.trim() === "") {
		errori.finoAKm = "La soglia massima è obbligatoria";
	} else {
		const soglia = dati.finoAKm.trim();

		if (!RE_INTERO_POSITIVO.test(soglia)) {
			errori.finoAKm = "Inserisci un numero intero di chilometri";
		} else if (parseInt(soglia, 10) <= 0) {
			errori.finoAKm = "La soglia deve essere maggiore di zero";
		}
	}

	if (!dati.importo || dati.importo.trim() === "") {
		errori.importo = "L'importo forfettario è obbligatorio";
	} else {
		const importo = normalizzaTariffaGiornaliera(dati.importo);

		if (!importo) {
			errori.importo = "Importo non valido: usa massimo 2 decimali";
		} else if (importo.centesimi <= BigInt(0)) {
			errori.importo = "L'importo deve essere maggiore di zero";
		}
	}

	return errori;
}

/**
 * Verifica che la soglia `finoAKm` non sia già usata da un altro scaglione.
 * Esclude lo scaglione `idEscluso` (caso di modifica dello stesso record).
 *
 * Restituisce un messaggio di errore se la soglia è duplicata, altrimenti `null`.
 */
export function verificaSogliaUnica(
	finoAKm: number,
	soglieEsistenti: ScaglioneEsistente[],
	idEscluso?: string,
): string | null {
	const duplicata = soglieEsistenti.some(
		(scaglione) => scaglione.finoAKm === finoAKm && scaglione.id !== idEscluso,
	);

	if (duplicata) {
		return "Esiste già uno scaglione con questa soglia: le soglie non possono sovrapporsi";
	}

	return null;
}
