import type { Page } from "@playwright/test";

import type { RigaAttivitaSospesa } from "../../src/generated/prisma/client";
import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";

/**
 * Righe sospese dell'import Excel: l'amministratore le filtra, le segna come
 * risolte e, se serve, di nuovo da risolvere. Ogni scenario agisce solo sulle
 * righe create dalla factory (collaboratore grezzo univoco).
 */

function etichettaRiga(riga: RigaAttivitaSospesa): string {
	return `Seleziona riga di ${riga.collaboratore} del ${riga.data} su ${riga.cliente}`;
}

function rigaTabella(page: Page, riga: RigaAttivitaSospesa) {
	return page
		.getByRole("table", { name: "Elenco righe sospese" })
		.getByRole("row")
		.filter({ hasText: riga.collaboratore ?? "" });
}

test.describe("Righe sospese dell'import", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("filtra per motivo, segna come risolte e riporta da risolvere", async ({
		page,
		factory,
	}) => {
		const prima = await factory.createRigaAttivitaSospesa();
		const seconda = await factory.createRigaAttivitaSospesa({ data: "2026-03-03", ore: "2,5" });
		const datiNonValidi = await factory.createRigaAttivitaSospesa({
			motivo: "DATI_NON_VALIDI",
			ore: "abc",
		});

		await page.goto("/anagrafiche/clienti");
		await page.getByRole("link", { name: "Importazione", exact: true }).click();
		await page.getByRole("link", { name: "Righe sospese", exact: true }).click();
		await expect(page.getByRole("heading", { level: 1, name: "Righe sospese" })).toBeVisible();
		await expect(page.getByRole("status", { name: "Righe aperte" })).toBeVisible();

		// Predefinito: righe aperte di tutti i motivi.
		await expect(page.getByRole("button", { name: "Aperte", exact: true })).toHaveAttribute("aria-pressed", "true");
		await expect(rigaTabella(page, datiNonValidi)).toContainText("Dati non validi");

		await page.getByLabel("Motivo").selectOption("CLIENTE_SCONOSCIUTO");
		await expect(page).toHaveURL(/motivo=CLIENTE_SCONOSCIUTO/);
		await expect(rigaTabella(page, datiNonValidi)).toHaveCount(0);
		await expect(rigaTabella(page, prima)).toContainText("Cliente sconosciuto");
		await expect(rigaTabella(page, seconda)).toContainText("2,5");

		await page.getByRole("checkbox", { name: etichettaRiga(prima) }).check();
		await page.getByRole("checkbox", { name: etichettaRiga(seconda) }).check();
		const azioni = page.getByRole("group", { name: "Azioni sulla selezione" });
		await expect(azioni).toContainText("2 righe selezionate");
		await azioni.getByRole("button", { name: "Segna come risolte (2)" }).click();

		await expect(rigaTabella(page, prima)).toHaveCount(0);
		await expect(rigaTabella(page, seconda)).toHaveCount(0);

		await page.getByRole("button", { name: "Risolte", exact: true }).click();
		await expect(page).toHaveURL(/stato=risolte/);
		await expect(rigaTabella(page, prima)).toContainText("Risolta il");
		await expect(rigaTabella(page, seconda)).toContainText("Risolta il");

		await page.getByRole("checkbox", { name: etichettaRiga(seconda) }).check();
		await azioni.getByRole("button", { name: "Segna come da risolvere" }).click();
		await expect(rigaTabella(page, seconda)).toHaveCount(0);
		await expect(rigaTabella(page, prima)).toBeVisible();

		await page.getByRole("button", { name: "Aperte", exact: true }).click();
		await expect(rigaTabella(page, seconda)).toBeVisible();
		await expect(rigaTabella(page, seconda)).not.toContainText("Risolta il");
		await expect(rigaTabella(page, prima)).toHaveCount(0);
	});
});
