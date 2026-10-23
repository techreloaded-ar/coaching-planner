/**
 * Aritmetica di date e mesi in UTC, senza dipendenze dall'app: usabile sia da Vitest sia da Playwright.
 */
import type { DataGiorno, TokenMese } from "./contratto-comune";

export function tokenDa(anno: number, mese: number): TokenMese {
	return `${anno}-${String(mese).padStart(2, "0")}`;
}

export function giornoDi(token: TokenMese, giorno: number): DataGiorno {
	return `${token}-${String(giorno).padStart(2, "0")}`;
}

export function meseDopo(token: TokenMese, delta = 1): TokenMese {
	const [anno, mese] = token.split("-").map(Number);
	const d = new Date(Date.UTC(anno, mese - 1 + delta, 1));
	return tokenDa(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

export function giornoDopo(data: DataGiorno, delta = 1): DataGiorno {
	const d = new Date(`${data}T00:00:00.000Z`);
	d.setUTCDate(d.getUTCDate() + delta);
	return d.toISOString().slice(0, 10);
}

/** Data per le factory (colonna DATE): mezzanotte UTC del giorno indicato. */
export function dataUtc(data: DataGiorno): Date {
	return new Date(`${data}T00:00:00.000Z`);
}

/** Ultima domenica del mese (giorno del cambio ora in Europa/Roma a marzo e ottobre). */
export function ultimaDomenica(anno: number, mese: number): DataGiorno {
	const ultimo = new Date(Date.UTC(anno, mese, 0));
	ultimo.setUTCDate(ultimo.getUTCDate() - ultimo.getUTCDay());
	return ultimo.toISOString().slice(0, 10);
}

