import { expect, type Page } from "@playwright/test";

/** Avatar dell'utente collegato nell'intestazione: apre il menu dell'account. */
export function pulsanteMenuAccount(page: Page) {
	return page.getByRole("banner").getByRole("button", { name: "Menu dell'account", exact: true });
}

/** Avatar dell'utente con il nome indicato (il nome è solo nel title, non nel testo della barra). */
export function avatarUtente(page: Page, nome: string) {
	return page.getByRole("banner").getByTitle(nome, { exact: true });
}

/** Pannello a comparsa con nome, email, ruolo, Impostazioni ed Esci. */
export function pannelloAccount(page: Page) {
	return page.getByRole("group", { name: "Account", exact: true });
}

/** Apre il menu dopo aver atteso l'idratazione (click su handler client). */
export async function apriMenuAccount(page: Page) {
	await expect(page.getByTestId("menu-account")).toHaveAttribute("data-idratata", "true");
	await pulsanteMenuAccount(page).click();
	await expect(pannelloAccount(page)).toBeVisible();
}

/** Disconnette l'utente dal menu dell'account e attende la radice con il messaggio di uscita. */
export async function esci(page: Page) {
	await apriMenuAccount(page);
	await pannelloAccount(page).getByRole("button", { name: "Esci", exact: true }).click();
	await page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("logout") === "1");
}

/** Apre le Impostazioni dal menu dell'account: si arriva sulla categoria Tema. */
export async function apriImpostazioni(page: Page) {
	await apriMenuAccount(page);
	await pannelloAccount(page).getByRole("link", { name: "Impostazioni", exact: true }).click();
	await page.waitForURL("**/impostazioni/tema");
	await expect(page.getByRole("heading", { name: "Impostazioni", level: 1 })).toBeVisible();
}

/** Barra laterale delle Impostazioni con le categorie. */
export function categorieImpostazioni(page: Page) {
	return page.getByRole("navigation", { name: "Categorie delle impostazioni", exact: true });
}

/** Apre una categoria dalla barra laterale e attende che sia quella evidenziata. */
export async function apriCategoriaImpostazioni(page: Page, categoria: "Tema" | "Connettori") {
	const voce = categorieImpostazioni(page).getByRole("link", { name: categoria, exact: true });
	await voce.click();
	await page.waitForURL(`**/impostazioni/${categoria.toLowerCase()}`);
	await expect(voce).toHaveAttribute("aria-current", "page");
	await expect(page.getByRole("heading", { name: categoria, level: 2 })).toBeVisible();
}
