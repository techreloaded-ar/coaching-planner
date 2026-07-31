import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";

/**
 * Test e2e — US-054: Configurazione delle voci di rimborso trasferta
 *
 * Scenari:
 * - Validazione campi obbligatori senza creazione
 * - Creazione con etichetta univoca e verifica in elenco
 * - Modifica dell'importo persistita dopo reload
 * - Eliminazione con conferma che rimuove la voce dall'elenco
 *
 * VoceRimborsoTrasferta non ha vincoli di unicità: l'isolamento fra worker è
 * garantito da un'etichetta univoca per test, senza registri di risorse riservate.
 */

/** Etichetta univoca per test, così le righe di worker concorrenti non si confondono. */
function etichettaUnivoca(prefisso: string): string {
	return `E2E US-054 ${prefisso} ${randomUUID()}`;
}

function tabellaVociRimborso(page: Page): Locator {
	return page.locator("table[aria-label='Elenco voci di rimborso trasferta']");
}

test.describe("Anagrafica voci di rimborso trasferta", () => {
	test.beforeEach(async ({ page }) => {
		await accediComeAdmin(page);
	});

	test("validazione campi obbligatori senza creazione", async ({ page }) => {
		await page.goto("/anagrafiche/voci-rimborso/nuovo");
		await expect(
			page.getByRole("heading", { name: "Nuova voce di rimborso" }),
		).toBeVisible();

		// Invia il form vuoto
		await page.getByRole("button", { name: "Crea voce" }).click();

		// Banner di errore generale
		await expect(page.getByText(/Controlla i campi evidenziati/)).toBeVisible();

		// Messaggi di errore per i campi obbligatori
		await expect(page.getByText("L'etichetta è obbligatoria")).toBeVisible();
		await expect(
			page.getByText("L'importo forfettario è obbligatorio"),
		).toBeVisible();

		// Nessun redirect: siamo ancora su /nuovo
		await expect(page).toHaveURL(/\/anagrafiche\/voci-rimborso\/nuovo/);
	});

	test("creazione e modifica dell'importo persistita dopo reload", async ({
		page,
	}) => {
		const etichetta = etichettaUnivoca("Creazione");

		await page.goto("/anagrafiche/voci-rimborso/nuovo");
		await expect(
			page.getByRole("heading", { name: "Nuova voce di rimborso" }),
		).toBeVisible();

		await page.getByLabel("Etichetta").fill(etichetta);
		await page.getByLabel("Importo forfettario").fill("12,50");
		await page.getByRole("button", { name: "Crea voce" }).click();

		// Redirect con esito creato
		await page.waitForURL("**/anagrafiche/voci-rimborso?esito=creato");
		await expect(
			page.getByRole("heading", { name: "Voci di rimborso trasferta" }),
		).toBeVisible();
		await expect(
			page.getByText("Voce di rimborso creata e inserita nella configurazione"),
		).toBeVisible();

		// La voce appena creata è in elenco con la sua etichetta e il suo importo
		const tabella = tabellaVociRimborso(page);
		const riga = tabella.locator("tbody tr").filter({ hasText: etichetta }).first();
		await expect(riga.getByText(/12,50/)).toBeVisible();

		// Apri il form di modifica della voce
		await riga.getByRole("link", { name: "Modifica" }).click();
		await page.waitForURL(/\/anagrafiche\/voci-rimborso\/[^/]+$/);
		await expect(
			page.getByRole("heading", { name: "Modifica voce di rimborso" }),
		).toBeVisible();
		await expect(page.getByLabel("Etichetta")).toHaveValue(etichetta);

		// Cambia l'importo forfettario
		const campoImporto = page.getByLabel("Importo forfettario");
		await campoImporto.fill("18,00");
		await page.getByRole("button", { name: "Salva modifiche" }).click();

		await page.waitForURL("**/anagrafiche/voci-rimborso?esito=salvato");
		await expect(
			page.getByText("Modifiche alla voce di rimborso salvate"),
		).toBeVisible();

		const rigaModificata = tabella
			.locator("tbody tr")
			.filter({ hasText: etichetta })
			.first();
		await expect(rigaModificata.getByText(/18,00/)).toBeVisible();

		// Ricarica la pagina e verifica la persistenza
		await page.reload();
		await page.waitForURL("**/anagrafiche/voci-rimborso**");
		const rigaRicaricata = tabella
			.locator("tbody tr")
			.filter({ hasText: etichetta })
			.first();
		await expect(rigaRicaricata.getByText(/18,00/)).toBeVisible();
	});

	test("eliminazione con conferma rimuove la voce dall'elenco", async ({
		page,
		factory,
	}) => {
		const etichetta = etichettaUnivoca("Eliminazione");
		await factory.createVoceRimborsoTrasferta({ etichetta, importo: "9.00" });

		await page.goto("/anagrafiche/voci-rimborso");

		const tabella = tabellaVociRimborso(page);
		const riga = tabella.locator("tbody tr").filter({ hasText: etichetta }).first();
		await expect(riga).toBeVisible();

		// Apri la modale di conferma eliminazione
		await riga.getByRole("button", { name: "Elimina" }).click();
		await expect(
			page.getByRole("dialog", { name: `Eliminare la voce «${etichetta}»?` }),
		).toBeVisible();
		await page
			.getByRole("dialog")
			.getByRole("button", { name: "Elimina voce" })
			.click();

		await page.waitForURL("**/anagrafiche/voci-rimborso?esito=eliminato");
		await expect(page.getByText("Voce di rimborso eliminata")).toBeVisible();

		await expect(
			tabella.locator("tbody tr").filter({ hasText: etichetta }),
		).toHaveCount(0);
	});
});
