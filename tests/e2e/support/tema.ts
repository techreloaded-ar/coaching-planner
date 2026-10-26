import { expect, type Page } from "@playwright/test";

export type TemaTest = "chiaro" | "scuro" | "browser";

/** Sfondo del body con il tema chiaro e scuro (variabili --background di globals.css). */
export const SFONDO_CHIARO = "rgb(255, 255, 255)";
export const SFONDO_SCURO = "rgb(10, 10, 10)";

export function selettoreTema(page: Page) {
	return page.getByRole("group", { name: "Tema" });
}

/** Sceglie un tema dopo aver atteso l'idratazione del selettore (click su handler client). */
export async function scegliTema(page: Page, etichetta: "Chiaro" | "Scuro" | "Browser") {
	const selettore = selettoreTema(page);
	await expect(selettore).toHaveAttribute("data-idratata", "true");
	const pulsante = selettore.getByRole("button", { name: etichetta, exact: true });
	await pulsante.click();
	await expect(pulsante).toHaveAttribute("aria-pressed", "true");
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
