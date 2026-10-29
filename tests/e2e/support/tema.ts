import { expect, type Page } from "@playwright/test";

/** Sfondo del body con il tema chiaro e scuro (variabili --background di globals.css). */
export const SFONDO_CHIARO = "rgb(255, 255, 255)";
export const SFONDO_SCURO = "rgb(10, 10, 10)";

export type EtichettaTema = "Chiaro" | "Scuro" | "Browser";

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
