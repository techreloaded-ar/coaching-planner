// Modulo di validazione pura per dati offerta (ADR-006)
// Nessuna dipendenza da framework — funzioni pure.

import {
	isGestioneTrasferta,
	isModalitaPrezzoOfferta,
	type ModalitaPrezzoOfferta,
} from "@/domain/types";

/** Dati in ingresso per la validazione di un'offerta */
export interface DatiOffertaInput {
	codice: string;
	descrizione: string;
	tariffaGiornaliera: string;
	giorniPrevisti: string;
	gestioneTrasferta: string;
	/** Considerato solo se la gestione trasferta è FORFETTARIA */
	importoTrasfertaForfettaria: string;
	/** "A_GIORNATA" (predefinita se assente o vuota) oppure "A_CORPO" */
	modalitaPrezzo?: string;
	/** Considerato solo se la modalità di prezzo è A_CORPO */
	importoACorpo?: string;
}

/** Mappa campo → messaggio di errore. Vuota se la validazione passa. */
export type ErroriValidazioneOfferta = Record<string, string>;

const RE_IMPORTO = /^\d+(?:[.,]\d{1,2})?$/;
const RE_INTERO = /^-?\d+$/;

/**
 * Modalità di prezzo indicata nel form: vuota o assente vale "a giornata",
 * come per le offerte create prima che esistesse la scelta. `null` se non valida.
 */
export function modalitaPrezzoDaInput(
	valore: string | undefined,
): ModalitaPrezzoOfferta | null {
	if (!valore || valore.trim() === "") return "A_GIORNATA";
	return isModalitaPrezzoOfferta(valore) ? valore : null;
}

/** Lunghezza massima ammessa per il codice offerta: sufficiente per gli schemi in uso, evita badge illimitati in UI. */
export const LUNGHEZZA_MASSIMA_CODICE = 60;

export interface TariffaNormalizzata {
	valore: string;
	centesimi: bigint;
}

/**
 * Normalizza un importo decimale nel formato Prisma-friendly `123.45`.
 * Accetta sia virgola italiana sia punto come separatore decimale.
 */
export function normalizzaTariffaGiornaliera(
	valore: string,
): TariffaNormalizzata | null {
	const pulito = valore.trim().replace(/\s+/g, "");

	if (!RE_IMPORTO.test(pulito)) {
		return null;
	}

	const [interaRaw, decimaleRaw = ""] = pulito.replace(",", ".").split(".");
	const intera = String(BigInt(interaRaw));
	const decimale = decimaleRaw.padEnd(2, "0");
	const centesimi = BigInt(intera) * BigInt(100) + BigInt(decimale);

	return {
		valore: `${intera}.${decimale}`,
		centesimi,
	};
}

/**
 * Valida i dati di un'offerta e restituisce una mappa campo → errore.
 * Restituisce `{}` se tutti i controlli passano.
 */
export function validaOfferta(
	dati: DatiOffertaInput,
): ErroriValidazioneOfferta {
	const errori: ErroriValidazioneOfferta = {};

	if (!dati.codice || dati.codice.trim() === "") {
		errori.codice = "Il codice offerta è obbligatorio";
	} else if (dati.codice.trim().length > LUNGHEZZA_MASSIMA_CODICE) {
		errori.codice = `Il codice offerta non può superare ${LUNGHEZZA_MASSIMA_CODICE} caratteri`;
	}

	const modalitaPrezzo = modalitaPrezzoDaInput(dati.modalitaPrezzo);
	if (!modalitaPrezzo) {
		errori.modalitaPrezzo = "Scegli se l'offerta è a giornata o a corpo";
	}

	// Descrizione, tariffa giornaliera, importo a corpo e giorni previsti sono
	// facoltativi: validati solo se valorizzati. A corpo la tariffa non si
	// inserisce (è calcolata), a giornata l'importo a corpo è ignorato.
	if (modalitaPrezzo === "A_CORPO") {
		const importo = (dati.importoACorpo ?? "").trim();
		if (importo !== "") {
			const normalizzato = normalizzaTariffaGiornaliera(importo);
			if (!normalizzato) {
				errori.importoACorpo = "Importo non valido: usa massimo 2 decimali";
			} else if (normalizzato.centesimi <= BigInt(0)) {
				errori.importoACorpo = "L'importo a corpo deve essere maggiore di zero";
			}
		}
	} else if (dati.tariffaGiornaliera && dati.tariffaGiornaliera.trim() !== "") {
		const tariffa = normalizzaTariffaGiornaliera(dati.tariffaGiornaliera);

		if (!tariffa) {
			errori.tariffaGiornaliera = "Importo non valido: usa massimo 2 decimali";
		} else if (tariffa.centesimi <= BigInt(0)) {
			errori.tariffaGiornaliera =
				"La tariffa giornaliera deve essere maggiore di zero";
		}
	}

	if (dati.giorniPrevisti && dati.giorniPrevisti.trim() !== "") {
		const giorni = dati.giorniPrevisti.trim();

		if (!RE_INTERO.test(giorni)) {
			errori.giorniPrevisti = "Inserisci un numero intero di giorni (es. 10)";
		} else if (parseInt(giorni, 10) <= 0) {
			errori.giorniPrevisti =
				"I giorni previsti devono essere maggiori di zero";
		}
	}

	if (!isGestioneTrasferta(dati.gestioneTrasferta)) {
		errori.gestioneTrasferta = "Scegli come gestire le trasferte";
	} else if (dati.gestioneTrasferta === "FORFETTARIA") {
		const importo = dati.importoTrasfertaForfettaria.trim();

		if (importo === "") {
			errori.importoTrasfertaForfettaria =
				"L'importo forfettario per giorno di trasferta è obbligatorio";
		} else {
			const normalizzato = normalizzaTariffaGiornaliera(importo);

			if (!normalizzato) {
				errori.importoTrasfertaForfettaria =
					"Importo non valido: usa massimo 2 decimali";
			} else if (normalizzato.centesimi <= BigInt(0)) {
				errori.importoTrasfertaForfettaria =
					"L'importo forfettario deve essere maggiore di zero";
			}
		}
	}

	return errori;
}
