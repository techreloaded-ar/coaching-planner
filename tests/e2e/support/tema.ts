import { expect, type Page } from "@playwright/test";

/** Sfondo del body con il tema chiaro, scuro e Natale (variabili --background di globals.css). */
export const SFONDO_CHIARO = "rgb(255, 255, 255)";
export const SFONDO_SCURO = "rgb(10, 10, 10)";
export const SFONDO_NATALE = "rgb(14, 23, 38)";

export type EtichettaTema = "Chiaro" | "Scuro" | "Browser" | "Natale";

const SFONDO_PER_ASPETTO = { chiaro: SFONDO_CHIARO, scuro: SFONDO_SCURO, natale: SFONDO_NATALE } as const;

/** Gruppo di opzioni del tema nella pagina Impostazioni. */
export function selettoreTema(page: Page) {
	return page.getByRole("radiogroup", { name: "Tema", exact: true });
}

export function opzioneTema(page: Page, etichetta: EtichettaTema) {
	return selettoreTema(page).getByRole("radio", { name: etichetta, exact: true });
}

/** Sceglie un tema nella pagina Impostazioni già aperta: l'opzione risulta selezionata e il documento porta il nuovo tema. */
export async function scegliTema(page: Page, etichetta: EtichettaTema) {
	await expect(page.getByTestId("selettore-tema")).toHaveAttribute("data-idratata", "true");
	// L'input radio è visivamente nascosto: si clicca l'etichetta, come l'utente.
	await selettoreTema(page).getByText(etichetta, { exact: true }).click();
	await expect(opzioneTema(page, etichetta)).toBeChecked();
	await expect(page.locator("html")).toHaveAttribute("data-tema", etichetta.toLowerCase());
}

/**
 * Verifica che la pagina sia resa nell'aspetto atteso: sfondo del body,
 * `color-scheme` dei controlli nativi e un'utility `dark:` di Tailwind
 * (colore del primo heading: chiaro su sfondo scuro, scuro su sfondo chiaro).
 * Il tema Natale è un tema scuro con il proprio sfondo blu notte.
 */
export async function attendiAspetto(page: Page, aspetto: "chiaro" | "scuro" | "natale") {
	const scuro = aspetto !== "chiaro";
	await expect(page.locator("body")).toHaveCSS("background-color", SFONDO_PER_ASPETTO[aspetto]);
	await expect(page.locator("html")).toHaveCSS("color-scheme", scuro ? "dark" : "light");
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
		.toBe(scuro ? "testo-chiaro" : "testo-scuro");
}
