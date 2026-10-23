/**
 * Helper comuni del livello browser (Playwright contro `next start` della consegna).
 * Nessuna assert qui: contesti, accesso, misure osservabili.
 */
import type { Browser, Page, TestInfo } from "@playwright/test";
import { accediCome } from "../../tests/e2e/support/auth";

export type PaginaOracolo = { page: Page; erroriJs: string[] };

/**
 * Nuovo contesto autenticato con fuso Europe/Rome e locale it-IT (fissati dal progetto),
 * larghezza 1440 o 390 px. Gli errori JavaScript non gestiti finiscono in `erroriJs`.
 */
export async function nuovaPagina(
	browser: Browser,
	testInfo: TestInfo,
	email: string | null,
	larghezza: 1440 | 390 = 1440,
): Promise<PaginaOracolo> {
	const uso = testInfo.project.use;
	const context = await browser.newContext({
		baseURL: uso.baseURL,
		timezoneId: uso.timezoneId ?? "Europe/Rome",
		locale: uso.locale ?? "it-IT",
		viewport: { width: larghezza, height: larghezza === 390 ? 844 : 900 },
		isMobile: larghezza === 390,
		hasTouch: larghezza === 390,
	});
	const page = await context.newPage();
	const erroriJs: string[] = [];
	page.on("pageerror", (errore) => erroriJs.push(`${page.url()}: ${errore.message}`));
	if (email) await accediCome(page, email);
	return { page, erroriJs };
}

/** Pixel di scorrimento orizzontale della pagina oltre la viewport (0 = nessun overflow). */
export async function eccedenzaOrizzontale(page: Page): Promise<number> {
	return page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
}

/**
 * Espressione regolare per un importo in formato it-IT con due decimali, con o senza
 * separatore delle migliaia (Chromium formatta 1300 come "1300,00" o "1.300,00" a seconda di ICU).
 */
export function regexImporto(valore: number): RegExp {
	const [interi, decimali] = Math.abs(valore).toFixed(2).split(".");
	const conPunti = interi.replace(/\B(?=(\d{3})+(?!\d))/g, "\\.?");
	const segno = valore < 0 ? "[-−]\\s?" : "";
	return new RegExp(`(^|[^\\d,.])${segno}${conPunti},${decimali}(?!\\d)`);
}

/** Espressione regolare per un numero it-IT con le cifre decimali date (es. 0,75). */
export function regexNumero(testo: string): RegExp {
	return new RegExp(`(^|[^\\d,])${testo.replace(/[.,]/g, (c) => `\\${c}`)}(?![\\d])`);
}

/** Espressione regolare tollerante ai separatori per un telefono dato come cifre (es. "+390115551234"). */
export function regexTelefono(telefono: string): RegExp {
	const cifre = telefono.replace(/[^\d+]/g, "");
	return new RegExp(cifre.split("").map((c) => (c === "+" ? "\\+?" : c)).join("[\\s.\\-/()]*"));
}

/** Controlli visibili e abilitati (un controllo disabilitato o nascosto non conta). */
export async function contaControlliAttivi(locator: import("@playwright/test").Locator): Promise<number> {
	return locator.evaluateAll(
		(elementi) =>
			elementi.filter((e) => {
				const el = e as HTMLElement & { disabled?: boolean; readOnly?: boolean };
				const stile = getComputedStyle(el);
				return (
					!el.disabled &&
					!el.readOnly &&
					el.getAttribute("aria-disabled") !== "true" &&
					stile.visibility !== "hidden" &&
					stile.display !== "none" &&
					el.getClientRects().length > 0
				);
			}).length,
	);
}
