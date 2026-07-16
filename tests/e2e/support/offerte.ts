import { expect, type Page } from "@playwright/test";

/**
 * Attende in modo web-first che una tabella marcata con `data-idratata`
 * sia idratata, cioè che i suoi gestori di click siano attivi. L'HTML
 * server-rendered espone `data-idratata="false"`: cliccare handler client
 * prima del passaggio a "true" produce click no-op e test flaky.
 */
export async function attendiTabellaIdratata(
	page: Page,
	nomeTabella: string,
): Promise<void> {
	await expect(page.getByRole("table", { name: nomeTabella })).toHaveAttribute(
		"data-idratata",
		"true",
	);
}

/** Tabella trasversale delle offerte (pagina /offerte). */
export async function attendiTabellaOfferteIdratata(
	page: Page,
): Promise<void> {
	await attendiTabellaIdratata(page, "Elenco offerte");
}

/** Tabella delle offerte nella pagina di dettaglio cliente. */
export async function attendiTabellaOfferteClienteIdratata(
	page: Page,
): Promise<void> {
	await attendiTabellaIdratata(page, "Offerte del cliente");
}

/**
 * Naviga alla pagina Offerte dal menu principale e attende che la tabella
 * trasversale sia idratata, quindi pronta ai click sulle righe.
 */
export async function apriPaginaOfferte(page: Page): Promise<void> {
	await page
		.getByRole("navigation", { name: "Navigazione principale" })
		.getByRole("link", { name: "Offerte", exact: true })
		.click();
	await page.waitForURL(/\/offerte(?:\?.*)?$/);
	await attendiTabellaOfferteIdratata(page);
}
