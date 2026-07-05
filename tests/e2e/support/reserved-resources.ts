import type { TestInfo } from "@playwright/test";

export type IntervalloScaglioniKm = Readonly<{
	da: number;
	a: number;
	descrizione: string;
}>;

export type SorgenteSogliaStabile =
	| number
	| string
	| Pick<TestInfo, "workerIndex">;

// Registro esplicito legittimo: ScaglioneKm è globale e finoAKm è unico.
// Gli e2e usano intervalli riservati per non alterare i seed sotto 1000 km.
export const REGISTRO_SCAGLIONI_KM = {
	seed: {
		da: 0,
		a: 999,
		descrizione: "Seed e2e e dati base sotto 1000 km",
	},
	anagraficaScaglioni: {
		da: 9000,
		a: 9999,
		descrizione: "tests/e2e/anagrafica-scaglioni.spec.ts",
	},
	demoAnagraficaScaglioni: {
		da: 6000,
		a: 6999,
		descrizione: "tests/e2e/demo__anagrafica-scaglioni.spec.ts",
	},
	nuoviTest: {
		daMinima: 10000,
		descrizione:
			"Nuovi test: assegnare un intervallo esplicito e non sovrapposto da 10000 km in su",
	},
} as const;

function assertIntervallo(intervallo: IntervalloScaglioniKm): void {
	if (
		!Number.isSafeInteger(intervallo.da) ||
		!Number.isSafeInteger(intervallo.a) ||
		intervallo.da < 0 ||
		intervallo.a < intervallo.da
	) {
		throw new Error(
			`Intervallo scaglioni km non valido: ${intervallo.da}-${intervallo.a}`,
		);
	}
}

function hashStabile(value: string): number {
	let hash = 2166136261;

	for (const character of value) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}

	return hash >>> 0;
}

function tokenSorgente(sorgente: SorgenteSogliaStabile): string {
	if (typeof sorgente === "number") {
		if (!Number.isSafeInteger(sorgente)) {
			throw new Error(`Sorgente numerica soglia km non valida: ${sorgente}`);
		}

		return `numero-${sorgente}`;
	}

	if (typeof sorgente === "string") {
		const valore = sorgente.trim();

		if (!valore) {
			throw new Error("Sorgente testuale soglia km non valida");
		}

		return `testo-${valore}`;
	}

	return `worker-${sorgente.workerIndex}`;
}

export function intervalloNuoviScaglioniKm(
	da: number,
	a: number,
	descrizione: string,
): IntervalloScaglioniKm {
	const intervallo = { da, a, descrizione };
	assertIntervallo(intervallo);

	if (da < REGISTRO_SCAGLIONI_KM.nuoviTest.daMinima) {
		throw new Error(
			"Gli intervalli per nuovi test scaglioni km devono partire da 10000 km in su",
		);
	}

	return intervallo;
}

export function soglieStabiliInIntervallo(
	intervallo: IntervalloScaglioniKm,
	sorgente: SorgenteSogliaStabile,
	quante = 1,
	opzioni: { passo?: number; salt?: string | number } = {},
): number[] {
	assertIntervallo(intervallo);

	if (intervallo.da < 1000) {
		throw new Error(
			`Le soglie km generate dagli e2e devono stare sopra 1000 km: ${intervallo.da}-${intervallo.a}`,
		);
	}

	if (!Number.isInteger(quante) || quante < 1) {
		throw new Error(`Numero soglie km non valido: ${quante}`);
	}

	const passo = opzioni.passo ?? 1;

	if (!Number.isInteger(passo) || passo < 1) {
		throw new Error(`Passo soglie km non valido: ${passo}`);
	}

	const spazioRichiesto = (quante - 1) * passo;
	const ampiezzaDisponibile = intervallo.a - intervallo.da + 1 - spazioRichiesto;

	if (ampiezzaDisponibile < 1) {
		throw new Error(
			`Intervallo ${intervallo.da}-${intervallo.a} troppo piccolo per ${quante} soglie con passo ${passo}`,
		);
	}

	const salt = opzioni.salt === undefined ? "" : `:${opzioni.salt}`;
	const base =
		intervallo.da +
		(hashStabile(`${tokenSorgente(sorgente)}${salt}`) % ampiezzaDisponibile);

	return Array.from({ length: quante }, (_, indice) => base + indice * passo);
}

export function sogliaStabileInIntervallo(
	intervallo: IntervalloScaglioniKm,
	sorgente: SorgenteSogliaStabile,
	opzioni: { salt?: string | number } = {},
): number {
	return soglieStabiliInIntervallo(intervallo, sorgente, 1, opzioni)[0];
}
