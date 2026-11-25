import type { Page } from "@playwright/test";
import { accediAlBackOfficeComeAdmin, accediComeCollaboratore } from "./support/auth";
import { test, expect } from "./support/fixtures";
import { navigazionePrincipale, voceNavigazione } from "./support/navigazione";

/**
 * Scheletro di caricamento al clic su una voce del menu: la voce si accende
 * subito, il contenuto passa allo scheletro della pagina di destinazione
 * (annunciato come caricamento in corso) e i dati lo sostituiscono appena
 * arrivano; menu laterale e intestazione restano al loro posto.
 *
 * Il tempo non viene mai atteso: la richiesta della pagina di arrivo (il
 * payload RSC della navigazione client) è trattenuta finché le asserzioni
 * sullo stato intermedio non sono passate.
 *
 * Gli scenari navigano e basta: nessun dato viene scritto.
 */

/** Promise il cui esito è deciso dal test, non dal tempo. */
function cancelloRilasciabile() {
	let rilascia!: () => void;
	const attesa = new Promise<void>((resolve) => {
		rilascia = resolve;
	});
	return { attesa, rilascia };
}

/**
 * Trattiene le richieste GET della pagina `percorso` (non i prefetch) finché
 * il test non chiama `rilascia`.
 */
async function trattieniPagina(page: Page, percorso: string) {
	const cancello = cancelloRilasciabile();
	const versoPercorso = (url: URL) => url.pathname === percorso;
	await page.route(versoPercorso, async (route) => {
		const richiesta = route.request();
		if (
			richiesta.method() === "GET" &&
			richiesta.headers()["next-router-prefetch"] === undefined
		) {
			await cancello.attesa;
		}
		await route.continue();
	});
	return {
		rilascia: cancello.rilascia,
		rimuovi: () => page.unroute(versoPercorso),
	};
}

test.describe("Scheletro di caricamento dalla navigazione principale", () => {
	test("Offerte: la voce si accende e compare lo scheletro dell'elenco, poi i dati", async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
		const titoloClienti = page.getByRole("heading", { level: 1, name: "Clienti", exact: true });
		const titoloOfferte = page.getByRole("heading", { level: 1, name: "Offerte", exact: true });
		await expect(titoloClienti).toBeVisible();

		const paginaOfferte = await trattieniPagina(page, "/offerte");
		// Il clic arriva a React solo a idratazione avvenuta: si ripete finché
		// lo scheletro non compare (polling su stato osservabile).
		const scheletro = page.getByTestId("scheletro-pagina");
		await expect(async () => {
			await voceNavigazione(page, "Offerte").click();
			await expect(scheletro).toBeVisible({ timeout: 1_000 });
		}).toPass();

		// Con la pagina ancora trattenuta: voce attiva già quella di arrivo,
		// pagina di partenza nascosta, scheletro al suo posto.
		await expect(voceNavigazione(page, "Offerte")).toHaveAttribute("aria-current", "page");
		await expect(voceNavigazione(page, "Clienti")).not.toHaveAttribute("aria-current", "page");
		await expect(scheletro).toHaveAttribute("role", "status");
		await expect(scheletro).toHaveAttribute("aria-busy", "true");
		await expect(scheletro).toHaveAttribute("data-variante", "elenco");
		await expect(scheletro).toContainText("Caricamento in corso…");
		await expect(titoloClienti).toBeHidden();
		await expect(navigazionePrincipale(page)).toBeVisible();

		paginaOfferte.rilascia();

		await expect(page).toHaveURL(/\/offerte$/);
		await expect(titoloOfferte).toBeVisible();
		await expect(scheletro).toHaveCount(0);
		await expect(voceNavigazione(page, "Offerte")).toHaveAttribute("aria-current", "page");
		await paginaOfferte.rimuovi();
	});

	test("Registro attività: dal riepilogo compare subito lo scheletro del calendario, poi il mese", async ({ page }) => {
		await accediComeCollaboratore(page);
		const calendario = page.getByLabel("Calendario mensile delle attività");
		const riepilogo = page.getByTestId("summary-giornate-totali");

		await page.goto("/attivita/riepilogo");
		await expect(riepilogo).toBeVisible();

		const paginaCalendario = await trattieniPagina(page, "/attivita");
		const scheletro = page.getByTestId("scheletro-pagina");
		await expect(async () => {
			await voceNavigazione(page, "Registro attività").click();
			await expect(scheletro).toBeVisible({ timeout: 1_000 });
		}).toPass();

		await expect(voceNavigazione(page, "Registro attività")).toHaveAttribute("aria-current", "page");
		await expect(voceNavigazione(page, "Riepilogo mensile")).not.toHaveAttribute("aria-current", "page");
		await expect(scheletro).toHaveAttribute("aria-busy", "true");
		await expect(scheletro).toHaveAttribute("data-variante", "calendario");
		await expect(riepilogo).toBeHidden();
		// L'intestazione dell'area resta al suo posto sopra lo scheletro.
		await expect(page.getByRole("banner").getByRole("heading", { name: "Le mie attività", exact: true })).toBeVisible();

		paginaCalendario.rilascia();

		await expect(page).toHaveURL(/\/attivita(\?.*)?$/);
		await expect(calendario).toBeVisible();
		await expect(scheletro).toHaveCount(0);
		await paginaCalendario.rimuovi();
	});
});
