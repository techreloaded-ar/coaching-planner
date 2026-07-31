// Modulo di validazione pura per dati voce di rimborso trasferta (ADR-006)
// Nessuna dipendenza da framework — funzioni pure.

import { normalizzaTariffaGiornaliera } from "./valida-offerta";

/** Dati in ingresso per la validazione di una voce di rimborso trasferta */
export interface DatiVoceRimborsoInput {
	etichetta: string;
	importo: string;
}

/** Mappa campo → messaggio di errore. Vuota se la validazione passa. */
export type ErroriValidazioneVoceRimborso = Record<string, string>;

/**
 * Valida i dati di una voce di rimborso e restituisce una mappa campo → errore.
 * Restituisce `{}` se tutti i controlli passano.
 */
export function validaVoceRimborso(
	dati: DatiVoceRimborsoInput,
): ErroriValidazioneVoceRimborso {
	const errori: ErroriValidazioneVoceRimborso = {};

	if (!dati.etichetta || dati.etichetta.trim() === "") {
		errori.etichetta = "L'etichetta è obbligatoria";
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
