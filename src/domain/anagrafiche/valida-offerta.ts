// Modulo di validazione pura per dati offerta (ADR-006)
// Nessuna dipendenza da framework — funzioni pure.

/** Dati in ingresso per la validazione di un'offerta */
export interface DatiOffertaInput {
	codice: string;
	descrizione: string;
	tariffaGiornaliera: string;
	giorniPrevisti: string;
}

/** Mappa campo → messaggio di errore. Vuota se la validazione passa. */
export type ErroriValidazioneOfferta = Record<string, string>;

const RE_IMPORTO = /^\d+(?:[.,]\d{1,2})?$/;
const RE_INTERO = /^-?\d+$/;

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

	if (!dati.descrizione || dati.descrizione.trim() === "") {
		errori.descrizione = "La descrizione è obbligatoria";
	}

	if (!dati.tariffaGiornaliera || dati.tariffaGiornaliera.trim() === "") {
		errori.tariffaGiornaliera = "La tariffa giornaliera è obbligatoria";
	} else {
		const tariffa = normalizzaTariffaGiornaliera(dati.tariffaGiornaliera);

		if (!tariffa) {
			errori.tariffaGiornaliera = "Importo non valido: usa massimo 2 decimali";
		} else if (tariffa.centesimi <= BigInt(0)) {
			errori.tariffaGiornaliera =
				"La tariffa giornaliera deve essere maggiore di zero";
		}
	}

	if (!dati.giorniPrevisti || dati.giorniPrevisti.trim() === "") {
		errori.giorniPrevisti = "I giorni previsti sono obbligatori";
	} else {
		const giorni = dati.giorniPrevisti.trim();

		if (!RE_INTERO.test(giorni)) {
			errori.giorniPrevisti = "Inserisci un numero intero di giorni (es. 10)";
		} else if (parseInt(giorni, 10) <= 0) {
			errori.giorniPrevisti =
				"I giorni previsti devono essere maggiori di zero";
		}
	}

	return errori;
}
