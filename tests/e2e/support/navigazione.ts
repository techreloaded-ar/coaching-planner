import type { Page } from "@playwright/test";

/** Navigazione della sidebar comune a tutte le aree autenticate. */
export function navigazionePrincipale(page: Page) {
	return page.getByRole("navigation", { name: "Navigazione principale", exact: true });
}

/** Voce della sidebar con il nome indicato (es. «Clienti», «Riepilogo mese»). */
export function voceNavigazione(page: Page, nome: string) {
	return navigazionePrincipale(page).getByRole("link", { name: nome, exact: true });
}
