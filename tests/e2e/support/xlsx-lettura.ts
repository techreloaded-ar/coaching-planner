import { crc32 } from "node:zlib";

/**
 * Lettore xlsx minimale per i test (unit ed e2e): legge solo zip "store",
 * verifica i CRC32 e restituisce le parti XML e le celle dei fogli.
 */

export type CellaLetta = string | number | null;

export interface FoglioLetto {
	nome: string;
	righe: CellaLetta[][];
}

export interface XlsxLetto {
	parti: Record<string, string>;
	fogli: FoglioLetto[];
}

function decodificaXml(testo: string): string {
	return testo
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&");
}

function indiceColonna(lettere: string): number {
	let indice = 0;
	for (const lettera of lettere) {
		indice = indice * 26 + (lettera.charCodeAt(0) - 64);
	}
	return indice - 1;
}

function leggiParti(buffer: Buffer): Record<string, string> {
	const finestra = Math.max(0, buffer.length - 22 - 0xffff);
	let fine = -1;
	for (let i = buffer.length - 22; i >= finestra; i--) {
		if (buffer.readUInt32LE(i) === 0x06054b50) {
			fine = i;
			break;
		}
	}
	if (fine < 0) {
		throw new Error("Zip non valido: end of central directory assente");
	}

	const numeroVoci = buffer.readUInt16LE(fine + 10);
	let cursore = buffer.readUInt32LE(fine + 16);
	const parti: Record<string, string> = {};

	for (let voce = 0; voce < numeroVoci; voce++) {
		if (buffer.readUInt32LE(cursore) !== 0x02014b50) {
			throw new Error("Zip non valido: central directory corrotta");
		}
		const metodo = buffer.readUInt16LE(cursore + 10);
		const crcDichiarato = buffer.readUInt32LE(cursore + 16);
		const dimensione = buffer.readUInt32LE(cursore + 24);
		const lunghezzaNome = buffer.readUInt16LE(cursore + 28);
		const lunghezzaExtra = buffer.readUInt16LE(cursore + 30);
		const lunghezzaCommento = buffer.readUInt16LE(cursore + 32);
		const offsetLocale = buffer.readUInt32LE(cursore + 42);
		const nome = buffer.toString("utf8", cursore + 46, cursore + 46 + lunghezzaNome);

		if (metodo !== 0) {
			throw new Error(`Metodo di compressione non supportato per ${nome}`);
		}

		const lunghezzaNomeLocale = buffer.readUInt16LE(offsetLocale + 26);
		const lunghezzaExtraLocale = buffer.readUInt16LE(offsetLocale + 28);
		const inizioDati = offsetLocale + 30 + lunghezzaNomeLocale + lunghezzaExtraLocale;
		const dati = buffer.subarray(inizioDati, inizioDati + dimensione);

		if (crc32(dati) !== crcDichiarato) {
			throw new Error(`CRC non valido per ${nome}`);
		}

		parti[nome] = dati.toString("utf8");
		cursore += 46 + lunghezzaNome + lunghezzaExtra + lunghezzaCommento;
	}

	return parti;
}

function leggiCelle(xmlFoglio: string): CellaLetta[][] {
	const righe: CellaLetta[][] = [];

	for (const rigaMatch of xmlFoglio.matchAll(/<row r="(\d+)"(?:\/>|>([\s\S]*?)<\/row>)/g)) {
		const numeroRiga = Number(rigaMatch[1]);
		const riga: CellaLetta[] = [];
		const contenuto = rigaMatch[2] ?? "";

		for (const cellaMatch of contenuto.matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
			const colonna = indiceColonna(cellaMatch[1]);
			const testo = /<t[^>]*>([\s\S]*?)<\/t>/.exec(cellaMatch[3]);
			const numero = /<v>([\s\S]*?)<\/v>/.exec(cellaMatch[3]);
			while (riga.length < colonna) riga.push(null);
			riga[colonna] = testo
				? decodificaXml(testo[1])
				: numero
					? Number(numero[1])
					: null;
		}

		while (righe.length < numeroRiga - 1) righe.push([]);
		righe[numeroRiga - 1] = riga;
	}

	return righe;
}

export function leggiXlsx(buffer: Buffer): XlsxLetto {
	const parti = leggiParti(buffer);
	const workbook = parti["xl/workbook.xml"];
	const relazioni = parti["xl/_rels/workbook.xml.rels"];
	if (!workbook || !relazioni) {
		throw new Error("xlsx non valido: workbook o relazioni assenti");
	}

	const bersagli = new Map<string, string>();
	for (const m of relazioni.matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
		bersagli.set(m[1], m[2]);
	}

	const fogli: FoglioLetto[] = [];
	for (const m of workbook.matchAll(/<sheet name="([^"]*)"[^>]*r:id="([^"]+)"/g)) {
		const bersaglio = bersagli.get(m[2]);
		const xml = bersaglio ? parti[`xl/${bersaglio}`] : undefined;
		if (xml === undefined) {
			throw new Error(`Foglio ${m[1]} senza parte associata`);
		}
		fogli.push({ nome: decodificaXml(m[1]), righe: leggiCelle(xml) });
	}

	return { parti, fogli };
}
