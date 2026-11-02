import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import {
	apriPaginaOfferte,
	attendiTabellaOfferteClienteIdratata,
} from "./support/offerte";

/**
 * Note libere su più righe per clienti, offerte e utenti, riservate agli
 * amministratori. Ogni scenario modifica solo entità create dalla factory.
 */

function campoNote(page: Page) {
	return page.getByRole("textbox", { name: /^Note\b/ });
}

/** Le note sono salvate così come scritte: il form le invia con a capo CRLF. */
function testoNote(...righe: string[]): RegExp {
	return new RegExp(`^${righe.join("\\r?\\n")}$`);
}

test.describe("Note delle anagrafiche", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("note cliente: su più righe nella scheda, sparisce se svuotata", async ({
		page,
		factory,
	}) => {
		const cliente = await factory.createCliente();
		const noteScheda = page.getByTestId("note-anagrafica");

		await page.goto(`/anagrafiche/clienti/${cliente.id}`);
		await expect(page.getByRole("heading", { level: 1, name: cliente.ragioneSociale })).toBeVisible();
		await expect(noteScheda).toHaveCount(0);

		await page.goto(`/anagrafiche/clienti/${cliente.id}/modifica`);
		await campoNote(page).fill("Referente amministrativo: Laura\nFatture entro il 5");
		await page.getByRole("button", { name: "Salva modifiche" }).click();
		await page.waitForURL("**/anagrafiche/clienti?esito=salvato");

		await page.goto(`/anagrafiche/clienti/${cliente.id}`);
		await expect(noteScheda.locator("p")).toHaveText(
			testoNote("Referente amministrativo: Laura", "Fatture entro il 5"),
		);

		// Note di soli spazi equivalgono a nessuna nota.
		await page.goto(`/anagrafiche/clienti/${cliente.id}/modifica`);
		await expect(campoNote(page)).toHaveValue(
			"Referente amministrativo: Laura\nFatture entro il 5",
		);
		await campoNote(page).fill("   \n  ");
		await page.getByRole("button", { name: "Salva modifiche" }).click();
		await page.waitForURL("**/anagrafiche/clienti?esito=salvato");

		await page.goto(`/anagrafiche/clienti/${cliente.id}`);
		await expect(page.getByRole("heading", { level: 1, name: cliente.ragioneSociale })).toBeVisible();
		await expect(noteScheda).toHaveCount(0);
	});

	test("note offerta: visibili nel dettaglio avanzamento, in scheda cliente e in Offerte", async ({
		page,
		factory,
	}) => {
		const codice = `E2E-NOTE-${randomUUID().slice(0, 8)}`.toUpperCase();
		const { cliente, offerta } = await factory.createClienteConOfferta({}, { codice });
		const dettaglio = page.getByRole("region", { name: `Dettaglio avanzamento ${codice}` });

		await page.goto(`/anagrafiche/clienti/${cliente.id}/offerte/${offerta.id}`);
		await expect(page.getByLabel("Codice")).toHaveValue(codice);
		await campoNote(page).fill("Ordine n. 42\nScade a fine anno");
		await page.getByRole("button", { name: "Salva offerta" }).click();
		await page.waitForURL(/\?esito=offerta-salvata$/);

		// Scheda cliente
		await attendiTabellaOfferteClienteIdratata(page);
		await page
			.getByRole("table", { name: "Offerte del cliente" })
			.getByText(codice, { exact: true })
			.click();
		await expect(dettaglio.getByTestId("note-anagrafica").locator("p")).toHaveText(
			testoNote("Ordine n. 42", "Scade a fine anno"),
		);

		// Pagina Offerte trasversale
		await apriPaginaOfferte(page, codice);
		await page
			.getByRole("table", { name: "Elenco offerte" })
			.getByText(codice, { exact: true })
			.click();
		await expect(dettaglio.getByTestId("note-anagrafica").locator("p")).toHaveText(
			testoNote("Ordine n. 42", "Scade a fine anno"),
		);
	});

	test("note utente: ritrovate riaprendo il form di modifica", async ({
		page,
		collaboratore,
	}) => {
		const percorsoModifica = `/anagrafiche/utenti/${collaboratore.utente.id}/modifica`;

		await page.goto(percorsoModifica);
		await expect(page.getByRole("heading", { name: "Modifica utente" })).toBeVisible();
		await expect(campoNote(page)).toHaveValue("");
		await campoNote(page).fill("Disponibile solo il martedì\nPreferisce email");
		await page.getByRole("button", { name: "Salva modifiche", exact: true }).click();
		await page.waitForURL(
			(url) =>
				url.pathname === "/anagrafiche/utenti" && url.searchParams.get("esito") === "salvato",
		);

		await page.goto(percorsoModifica);
		await expect(campoNote(page)).toHaveValue("Disponibile solo il martedì\nPreferisce email");
	});
});
