import type { Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";

/**
 * Test e2e — US-047: Anagrafica collaboratori a sola modifica
 *
 * Scenari:
 * - AC-1: il censimento non è più disponibile dall'anagrafica collaboratori
 * - AC-2/AC-3: lo stato attivo/disattivato è in sola lettura, senza controlli
 *   Disattiva/Riattiva
 * - AC-4: la modifica dei dati anagrafici e della tariffa viene persistita
 * - AC-5: l'email di accesso è in sola lettura e non viene alterata dal salvataggio
 */

function tabellaCollaboratori(page: Page) {
	return page.locator("table[aria-label='Elenco collaboratori']");
}

function rigaCollaboratore(page: Page, nomeCompleto: string) {
	return tabellaCollaboratori(page)
		.locator("tbody tr")
		.filter({ hasText: nomeCompleto });
}

test.describe("Anagrafica collaboratori", () => {
	test.beforeEach(async ({ page }) => {
		await accediComeAdmin(page);
	});

	test("censimento non disponibile: nessun link e redirect dalla rotta diretta", async ({
		page,
	}) => {
		await page.goto("/anagrafiche/collaboratori");
		await expect(
			page.getByRole("heading", { name: "Collaboratori", exact: true }),
		).toBeVisible();

		// AC-1: nessun link per censire un nuovo collaboratore dall'elenco.
		await expect(
			page.getByRole("link", { name: "Nuovo collaboratore" }),
		).toHaveCount(0);

		// AC-1: la rotta diretta di censimento reindirizza alla schermata utenti.
		await page.goto("/anagrafiche/collaboratori/nuovo");
		await page.waitForURL("**/anagrafiche/utenti");
		await expect(
			page.getByRole("heading", { name: "Utenti", exact: true }),
		).toBeVisible();
	});

	test("stato in sola lettura: badge visibili, nessun controllo Disattiva/Riattiva", async ({
		page,
		factory,
	}) => {
		const attivo = await factory.createCollaboratore();
		const disattivato = await factory.createCollaboratore({ attivo: false });
		const nomeCompletoAttivo = `${attivo.collaboratore.nome} ${attivo.collaboratore.cognome}`;
		const nomeCompletoDisattivato = `${disattivato.collaboratore.nome} ${disattivato.collaboratore.cognome}`;

		await page.goto("/anagrafiche/collaboratori");
		await expect(
			page.getByRole("heading", { name: "Collaboratori", exact: true }),
		).toBeVisible();

		const rigaAttiva = rigaCollaboratore(page, nomeCompletoAttivo);
		await expect(rigaAttiva.getByText("Attivo", { exact: true })).toBeVisible();
		await expect(
			rigaAttiva.getByRole("button", { name: "Disattiva" }),
		).toHaveCount(0);
		await expect(
			rigaAttiva.getByRole("button", { name: "Riattiva" }),
		).toHaveCount(0);

		const rigaDisattivata = rigaCollaboratore(page, nomeCompletoDisattivato);
		await expect(
			rigaDisattivata.getByText("Disattivato", { exact: true }),
		).toBeVisible();
		await expect(
			rigaDisattivata.getByRole("button", { name: "Disattiva" }),
		).toHaveCount(0);
		await expect(
			rigaDisattivata.getByRole("button", { name: "Riattiva" }),
		).toHaveCount(0);

		// Anche nella schermata di modifica non compare alcun controllo di stato.
		await rigaAttiva.getByRole("link", { name: "Modifica" }).click();
		await page.waitForURL(/\/anagrafiche\/collaboratori\/[^/]+\/modifica$/);
		await expect(
			page.getByRole("heading", { name: "Modifica collaboratore" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Disattiva" }),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Riattiva" }),
		).toHaveCount(0);
	});

	test("modifica persistita: nome e tariffa aggiornati restano dopo il reload", async ({
		page,
		factory,
	}) => {
		const { collaboratore } = await factory.createCollaboratore();
		const nomeCompletoOriginale = `${collaboratore.nome} ${collaboratore.cognome}`;
		const nuovoNome = `${collaboratore.nome} Aggiornato`;
		const nuovaTariffa = "777,50";

		await page.goto("/anagrafiche/collaboratori");
		const riga = rigaCollaboratore(page, nomeCompletoOriginale);
		await riga.getByRole("link", { name: "Modifica" }).click();

		await page.waitForURL(/\/anagrafiche\/collaboratori\/[^/]+\/modifica$/);
		await expect(
			page.getByRole("heading", { name: "Modifica collaboratore" }),
		).toBeVisible();

		await page.getByLabel(/^Nome\b/).fill(nuovoNome);
		const campoTariffa = page.getByLabel("Tariffa giornaliera");
		await campoTariffa.clear();
		await campoTariffa.fill(nuovaTariffa);

		await page.getByRole("button", { name: "Salva modifiche" }).click();
		await page.waitForURL("**/anagrafiche/collaboratori?esito=salvato");

		const nomeCompletoAggiornato = `${nuovoNome} ${collaboratore.cognome}`;
		const rigaAggiornata = rigaCollaboratore(page, nomeCompletoAggiornato);
		await expect(
			rigaAggiornata.getByText(nomeCompletoAggiornato, { exact: true }),
		).toBeVisible();
		await expect(rigaAggiornata.getByText("777,50")).toBeVisible();

		await page.reload();
		const rigaRicaricata = rigaCollaboratore(page, nomeCompletoAggiornato);
		await expect(
			rigaRicaricata.getByText(nomeCompletoAggiornato, { exact: true }),
		).toBeVisible();
		await expect(rigaRicaricata.getByText("777,50")).toBeVisible();
	});

	test("email in sola lettura: campo readOnly e invariata dopo il salvataggio", async ({
		page,
		factory,
	}) => {
		const { collaboratore, utente } = await factory.createCollaboratore();
		const nomeCompleto = `${collaboratore.nome} ${collaboratore.cognome}`;

		await page.goto("/anagrafiche/collaboratori");
		const riga = rigaCollaboratore(page, nomeCompleto);
		await riga.getByRole("link", { name: "Modifica" }).click();

		await page.waitForURL(/\/anagrafiche\/collaboratori\/[^/]+\/modifica$/);
		await expect(
			page.getByRole("heading", { name: "Modifica collaboratore" }),
		).toBeVisible();

		const campoEmail = page.getByLabel("Email di accesso");
		await expect(campoEmail).toHaveValue(utente.email);
		await expect(campoEmail).toHaveJSProperty("readOnly", true);

		// Salva senza toccare l'email: deve restare quella originale in elenco.
		await page.getByRole("button", { name: "Salva modifiche" }).click();
		await page.waitForURL("**/anagrafiche/collaboratori?esito=salvato");

		const rigaAggiornata = rigaCollaboratore(page, nomeCompleto);
		await expect(
			rigaAggiornata.getByText(utente.email, { exact: true }),
		).toBeVisible();
	});
});
