const MESE_TOKEN_PATTERN = /^\d{4}-\d{2}$/;
const MESI_RISERVATI_BASE_OFFSET = 12;
const MESI_RISERVATI_FINESTRA = 120;

function pad2(value: number): string {
	return String(value).padStart(2, "0");
}

function assertGiornoValido(giorno: number): void {
	if (!Number.isInteger(giorno) || giorno < 1 || giorno > 31) {
		throw new Error(`Giorno non valido per data e2e: ${giorno}`);
	}
}

function assertMeseToken(meseToken: string): void {
	if (!MESE_TOKEN_PATTERN.test(meseToken)) {
		throw new Error(`Token mese e2e non valido: ${meseToken}`);
	}
}

function hashStabile(value: string): number {
	let hash = 5381;

	for (const character of value) {
		hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
	}

	return hash >>> 0;
}

export function meseCorrenteToken(offsetMesi = 0): string {
	const data = new Date();
	data.setDate(1);
	data.setMonth(data.getMonth() + offsetMesi);

	return `${data.getFullYear()}-${pad2(data.getMonth() + 1)}`;
}

export function mesePassatoToken(mesiIndietro = 1): string {
	if (!Number.isInteger(mesiIndietro) || mesiIndietro < 1) {
		throw new Error(`Offset mese passato e2e non valido: ${mesiIndietro}`);
	}

	return meseCorrenteToken(-mesiIndietro);
}

export function dataNelMese(meseToken: string, giorno: number): string {
	assertMeseToken(meseToken);
	assertGiornoValido(giorno);

	return `${meseToken}-${pad2(giorno)}`;
}

export function dataNelMeseCorrente(giorno: number): string {
	return dataNelMese(meseCorrenteToken(), giorno);
}

function offsetMeseRiservato(codiceSpec: string): number {
	const codiceNormalizzato = codiceSpec.trim();

	if (!codiceNormalizzato) {
		throw new Error("Codice spec richiesto per mese riservato e2e");
	}

	return -(
		MESI_RISERVATI_BASE_OFFSET +
		(hashStabile(codiceNormalizzato) % MESI_RISERVATI_FINESTRA)
	);
}

export function meseRiservato(codiceSpec: string): string {
	return meseCorrenteToken(offsetMeseRiservato(codiceSpec));
}

export function mesePassatoRiservato(
	codiceSpec: string,
	mesiIndietro = 1,
): string {
	if (!Number.isInteger(mesiIndietro) || mesiIndietro < 1) {
		throw new Error(`Offset mese passato riservato non valido: ${mesiIndietro}`);
	}

	return meseCorrenteToken(offsetMeseRiservato(codiceSpec) - mesiIndietro);
}

export function dataNelMeseRiservato(
	codiceSpec: string,
	giorno: number,
): string {
	return dataNelMese(meseRiservato(codiceSpec), giorno);
}

export function dataNelMesePassatoRiservato(
	codiceSpec: string,
	giorno: number,
	mesiIndietro = 1,
): string {
	return dataNelMese(mesePassatoRiservato(codiceSpec, mesiIndietro), giorno);
}
