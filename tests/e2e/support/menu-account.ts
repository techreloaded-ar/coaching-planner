import { expect, type Page } from "@playwright/test";

/** Sidebar comune a tutte le aree autenticate: l'account dell'utente collegato è in fondo. */
export function sidebar(page: Page) {
	return page.getByRole("complementary", { name: "Barra laterale", exact: true });
}

/** Avatar dell'utente collegato in fondo alla sidebar: apre il menu dell'account. */
export function pulsanteMenuAccount(page: Page) {
	return sidebar(page).getByRole("button", { name: "Menu dell'account", exact: true });
}

/** Avatar dell'utente con il nome indicato (nome anche nel title, visibile a sidebar collassata). */
export function avatarUtente(page: Page, nome: string) {
	return sidebar(page).getByTitle(nome, { exact: true });
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

/** Sotto 920 px la sidebar è un menu a scomparsa aperto dal pulsante ≡ dell'intestazione. */
export async function apriMenuNavigazione(page: Page) {
	await expect(page.getByTestId("menu-account")).toHaveAttribute("data-idratata", "true");
	await page.getByRole("button", { name: "Apri menu di navigazione", exact: true }).click();
	await expect(sidebar(page)).toBeVisible();
}

/** Disconnette l'utente dal menu dell'account e attende la radice con il messaggio di uscita. */
export async function esci(page: Page) {
	await apriMenuAccount(page);
	await pannelloAccount(page).getByRole("button", { name: "Esci", exact: true }).click();
	await page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("logout") === "1");
}

/** Modale delle Impostazioni, aperta sopra la pagina corrente. */
export function modaleImpostazioni(page: Page) {
	return page.getByRole("dialog", { name: "Impostazioni", exact: true });
}

/** Apre le Impostazioni dal menu dell'account: la modale si apre sulla categoria Tema. */
export async function apriImpostazioni(page: Page) {
	await apriMenuAccount(page);
	await pannelloAccount(page).getByRole("button", { name: "Impostazioni", exact: true }).click();
	await expect(modaleImpostazioni(page)).toBeVisible();
	await expect(voceCategoriaImpostazioni(page, "Tema")).toHaveAttribute("aria-current", "true");
}

/** Categorie della modale Impostazioni. */
export function categorieImpostazioni(page: Page) {
	return modaleImpostazioni(page).getByRole("navigation", { name: "Categorie delle impostazioni", exact: true });
}

export function voceCategoriaImpostazioni(page: Page, categoria: "Tema" | "Connettori") {
	return categorieImpostazioni(page).getByRole("button", { name: categoria, exact: true });
}

/** Apre una categoria della modale e attende che sia quella evidenziata. */
export async function apriCategoriaImpostazioni(page: Page, categoria: "Tema" | "Connettori") {
	const voce = voceCategoriaImpostazioni(page, categoria);
	await voce.click();
	await expect(voce).toHaveAttribute("aria-current", "true");
	await expect(modaleImpostazioni(page).getByRole("heading", { name: categoria, level: 3 })).toBeVisible();
}
