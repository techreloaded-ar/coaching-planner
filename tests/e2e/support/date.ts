const MESE_TOKEN_PATTERN = /^\d{4}-\d{2}$/;
const MESI_RISERVATI_BASE_OFFSET = 12;
const MESI_RISERVATI_FINESTRA = 120;
const MESI_ESCLUSIVI_BASE_OFFSET = 360;
const MESI_ESCLUSIVI_AMPIEZZA_SLOT = 2;

/**
 * Slot espliciti per i mesi riservati "esclusivi": le chiavi dei test che
 * asseriscono valori globali del mese (totali del report fatturazione,
 * mese vuoto). L'assegnazione via hash su una finestra di 120 mesi può far
 * collidere chiavi diverse, e per questi test qualunque riga fatturabile
 * estranea nel mese rompe l'asserzione: qui l'unicità del mese è garantita
 * per costruzione dallo slot esplicito, non dalla fortuna dell'hash.
 *
 * La banda parte 360 mesi indietro, oltre ogni mese raggiungibile dalle
 * chiavi hash: offset base 12 + hash % 120 = max 131, più gli extra usati
 * dai test (la finestra contigua di dettaglio-avanzamento-offerta arriva a
 * ~299 mesi). Ogni slot occupa 2 mesi, così `mesePassatoRiservato(codice)`
 * resta dentro lo slot senza toccare quello adiacente.
 *
 * Ogni nuovo test che asserisce totali o vuoto dell'intero mese deve
 * registrare qui la propria chiave con uno slot libero.
 */
const SLOT_MESI_RISERVATI_ESCLUSIVI: Record<string, number> = {
	"US-023-TASK-07-REPORT-FATTURAZIONE-CLIENTI": 0,
	"US-023-TASK-08-REPORT-FATTURAZIONE-CLIENTI-SPEC": 1,
	"US-023-TASK-08-REPORT-FATTURAZIONE-CLIENTI-DEMO": 2,
	"US-023-TASK-08-REPORT-FATTURAZIONE-CLIENTI-VUOTO": 3,
	"US-037-DETTAGLIO-COLLABORATORI": 4,
	"US-037-ESPANSIONE-SINGOLA": 5,
	"US-037-SOLO-RIMBORSI": 6,
};

{
	const slot = Object.values(SLOT_MESI_RISERVATI_ESCLUSIVI);

	if (new Set(slot).size !== slot.length) {
		throw new Error(
			"Slot duplicati in SLOT_MESI_RISERVATI_ESCLUSIVI: ogni chiave esclusiva deve avere un mese distinto",
		);
	}
}

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

export function offsetMeseRiservato(codiceSpec: string): number {
	const codiceNormalizzato = codiceSpec.trim();

	if (!codiceNormalizzato) {
		throw new Error("Codice spec richiesto per mese riservato e2e");
	}

	const slotEsclusivo = SLOT_MESI_RISERVATI_ESCLUSIVI[codiceNormalizzato];

	if (slotEsclusivo !== undefined) {
		return -(
			MESI_ESCLUSIVI_BASE_OFFSET +
			slotEsclusivo * MESI_ESCLUSIVI_AMPIEZZA_SLOT
		);
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

	if (
		SLOT_MESI_RISERVATI_ESCLUSIVI[codiceSpec.trim()] !== undefined &&
		mesiIndietro >= MESI_ESCLUSIVI_AMPIEZZA_SLOT
	) {
		throw new Error(
			`Offset ${mesiIndietro} fuori dallo slot esclusivo di ${codiceSpec}: ` +
				`amplia MESI_ESCLUSIVI_AMPIEZZA_SLOT o usa un offset minore`,
		);
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
