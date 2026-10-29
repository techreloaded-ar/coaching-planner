import type { Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";

/**
 * Test e2e — storico tariffe del collaboratore (giornaliera o fisso mensile).
 *
 * Il collaboratore della factory è disattivato: un fisso mensile in vigore di un
 * collaboratore attivo peserebbe come «fisso non attribuibile» sulla
 * marginalità di ogni mese successivo, anche nei mesi riservati di altri test.
 */

function storico(page: Page) {
	return page.getByRole("table", { name: "Storico tariffe" });
}

function rigaStorico(page: Page, mese: string) {
	return storico(page).locator("tbody tr").filter({ hasText: mese });
}

async function aggiungiTariffa(
	page: Page,
	{ mese, modalita, importo }: { mese: string; modalita: "Giornaliera" | "Fisso mensile"; importo: string },
) {
	await page.getByRole("button", { name: "Nuova tariffa", exact: true }).click();
	const modulo = page.getByRole("form", { name: "Nuova tariffa" });
	await modulo.getByLabel("Valida dal mese").fill(mese);
	await modulo.getByText(modalita, { exact: true }).click();
	await modulo.getByLabel(/^Importo/).fill(importo);
	await modulo.getByRole("button", { name: "Salva tariffa" }).click();
	return modulo;
}

test.describe("Storico tariffe collaboratore", () => {
	test.beforeEach(async ({ page }) => {
		await accediComeAdmin(page);
	});

	test("aggiunge, rifiuta il mese occupato, modifica ed elimina le tariffe mostrando quella in vigore", async ({
		page,
		factory,
	}) => {
		const { collaboratore } = await factory.createCollaboratore({
			attivo: false,
			tariffe: [{ validaDalMese: "2025-01", modalita: "GIORNALIERA", importo: "400.00" }],
		});
		const nomeCompleto = `${collaboratore.nome} ${collaboratore.cognome}`;

		await page.goto(`/anagrafiche/collaboratori/${collaboratore.id}`);
		await expect(page.getByRole("heading", { name: nomeCompleto })).toBeVisible();
		await expect(page.getByTestId("tariffa-attuale")).toContainText("Giornaliera · da gen 2025");

		// Due nuove tariffe: il modulo si chiude a ogni salvataggio riuscito.
		const modulo = await aggiungiTariffa(page, { mese: "2026-01", modalita: "Giornaliera", importo: "450" });
		await expect(modulo).toHaveCount(0);
		await aggiungiTariffa(page, { mese: "2026-07", modalita: "Fisso mensile", importo: "6500" });
		await expect(page.getByRole("form", { name: "Nuova tariffa" })).toHaveCount(0);

		// Storico dalla più recente, con periodi di validità e badge «in vigore».
		await expect(storico(page).locator("tbody tr")).toHaveCount(3);
		await expect(storico(page).locator("tbody tr").first()).toContainText("lug 2026");
		await expect(rigaStorico(page, "lug 2026")).toContainText("in vigore");
		await expect(rigaStorico(page, "lug 2026")).toContainText(/6\.?500,00\s*€\s*\/ mese/);
		await expect(rigaStorico(page, "lug 2026")).toContainText("lug 2026 → in corso");
		await expect(rigaStorico(page, "gen 2026")).toContainText("gen 2026 → giu 2026");
		await expect(rigaStorico(page, "gen 2025")).toContainText("gen 2025 → dic 2025");
		await expect(rigaStorico(page, "gen 2025")).not.toContainText("in vigore");
		await expect(page.getByTestId("tariffa-attuale")).toContainText(/6\.?500,00\s*€\s*\/ mese/);
		await expect(page.getByTestId("tariffa-attuale")).toContainText("Fisso mensile · da lug 2026");

		// Un secondo inserimento sullo stesso mese è rifiutato sul campo del mese.
		const duplicato = await aggiungiTariffa(page, { mese: "2026-07", modalita: "Giornaliera", importo: "500" });
		await expect(
			duplicato.getByText("Esiste già una tariffa per questo mese: modifica quella"),
		).toBeVisible();
		await expect(duplicato.getByLabel("Valida dal mese")).toHaveValue("2026-07");
		await duplicato.getByRole("button", { name: "Annulla" }).click();
		await expect(storico(page).locator("tbody tr")).toHaveCount(3);

		// Modifica dell'importo di gennaio 2026.
		await page.getByRole("button", { name: "Modifica tariffa da gen 2026" }).click();
		const modifica = page.getByRole("form", { name: "Modifica tariffa" });
		await expect(modifica.getByLabel(/^Importo/)).toHaveValue("450,00");
		await modifica.getByLabel(/^Importo/).fill("470,00");
		await modifica.getByRole("button", { name: "Salva tariffa" }).click();
		await expect(modifica).toHaveCount(0);
		await expect(rigaStorico(page, "gen 2026")).toContainText(/470,00\s*€\s*\/ giorno/);

		// La voce più vecchia non è eliminabile; le altre sì.
		await expect(page.getByRole("button", { name: "Elimina tariffa da gen 2025" })).toHaveCount(0);
		await page.getByRole("button", { name: "Elimina tariffa da gen 2026" }).click();
		await expect(storico(page).locator("tbody tr")).toHaveCount(2);
		await expect(rigaStorico(page, "gen 2025")).toContainText("gen 2025 → giu 2026");

		// L'elenco collaboratori mostra la tariffa in vigore con la sua unità.
		await page.goto("/anagrafiche/collaboratori");
		const riga = page
			.locator("table[aria-label='Elenco collaboratori'] tbody tr")
			.filter({ hasText: nomeCompleto });
		await expect(riga).toContainText(/6\.?500,00\s*€\s*\/ mese/);
	});
});
