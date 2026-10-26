import { expect, type Page } from "@playwright/test";

/** Sfondo del body con il tema chiaro e scuro (variabili --background di globals.css). */
export const SFONDO_CHIARO = "rgb(255, 255, 255)";
export const SFONDO_SCURO = "rgb(10, 10, 10)";

export type EtichettaTema = "Chiaro" | "Scuro" | "Browser";

/** Pulsante-icona del selettore nell'intestazione. */
export function pulsanteTema(page: Page) {
	return page.getByRole("button", { name: "Tema", exact: true });
}

/** Pannello a comparsa con le tre opzioni. */
export function pannelloTema(page: Page) {
	return page.getByRole("group", { name: "Scegli il tema" });
}

export function opzioneTema(page: Page, etichetta: EtichettaTema) {
	return pannelloTema(page).getByRole("button", { name: etichetta, exact: true });
}

/** Apre il pannello dopo aver atteso l'idratazione del selettore (click su handler client). */
export async function apriPannelloTema(page: Page) {
	await expect(page.getByTestId("selettore-tema")).toHaveAttribute("data-idratata", "true");
	await pulsanteTema(page).click();
	await expect(pannelloTema(page)).toBeVisible();
}

/** Sceglie un tema dal pannello: il pannello si chiude e il documento porta il nuovo tema. */
export async function scegliTema(page: Page, etichetta: EtichettaTema) {
	await apriPannelloTema(page);
	await opzioneTema(page, etichetta).click();
	await expect(pannelloTema(page)).toBeHidden();
	await expect(page.locator("html")).toHaveAttribute("data-tema", etichetta.toLowerCase());
}

/**
 * Verifica che la pagina sia resa nell'aspetto atteso: sfondo del body,
 * `color-scheme` dei controlli nativi e un'utility `dark:` di Tailwind
 * (colore del primo heading: chiaro su sfondo scuro, scuro su sfondo chiaro).
 */
export async function attendiAspetto(page: Page, aspetto: "chiaro" | "scuro") {
	await expect(page.locator("body")).toHaveCSS(
		"background-color",
		aspetto === "scuro" ? SFONDO_SCURO : SFONDO_CHIARO,
	);
	await expect(page.locator("html")).toHaveCSS("color-scheme", aspetto === "scuro" ? "dark" : "light");
	await expect
		.poll(() =>
			page.locator("h1").first().evaluate((titolo) => {
				const contesto = document.createElement("canvas").getContext("2d")!;
				contesto.fillStyle = getComputedStyle(titolo).color;
				contesto.fillRect(0, 0, 1, 1);
				const [r, g, b] = contesto.getImageData(0, 0, 1, 1).data;
				return (r + g + b) / 3 > 128 ? "testo-chiaro" : "testo-scuro";
			}),
		)
		.toBe(aspetto === "scuro" ? "testo-chiaro" : "testo-scuro");
}

/** L'icona del pulsante segue l'aspetto effettivo: sole se chiaro, luna se scuro. */
export async function attendiIconaTema(page: Page, icona: "sole" | "luna") {
	const visibile = page.getByTestId(icona === "sole" ? "icona-tema-sole" : "icona-tema-luna");
	const nascosta = page.getByTestId(icona === "sole" ? "icona-tema-luna" : "icona-tema-sole");
	await expect(visibile).toBeVisible();
	await expect(nascosta).toBeHidden();
}

/** Il selettore sta subito a sinistra del pulsante Esci, nella stessa riga dell'intestazione. */
export async function attendiSelettoreAccantoAEsci(page: Page) {
	const banner = page.getByRole("banner");
	const selettore = banner.getByTestId("selettore-tema");
	await expect(selettore).toBeVisible();
	expect(
		await selettore.evaluate(
			(elemento) => elemento.nextElementSibling?.querySelector("[data-esci]") !== null,
		),
	).toBe(true);
	const riquadroSelettore = (await selettore.boundingBox())!;
	const riquadroEsci = (await banner.locator("[data-esci]").boundingBox())!;
	expect(riquadroSelettore.x + riquadroSelettore.width).toBeLessThanOrEqual(riquadroEsci.x);
	expect(riquadroEsci.x - (riquadroSelettore.x + riquadroSelettore.width)).toBeLessThan(40);
}
