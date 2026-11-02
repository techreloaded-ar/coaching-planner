import { randomUUID } from "node:crypto";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import { attendiTabellaOfferteClienteIdratata } from "./support/offerte";

/**
 * Persona di riferimento del cliente, numero d'ordine e account Agile Reloaded
 * dell'offerta: testi liberi facoltativi. Ogni scenario modifica solo entità
 * create dalla factory.
 */

test.describe("Riferimenti di cliente e offerta", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("persona di riferimento: salvata, mostrata nella scheda e svuotabile", async ({
		page,
		factory,
	}) => {
		const cliente = await factory.createCliente();
		const campo = page.getByLabel("Persona di riferimento");

		await page.goto(`/anagrafiche/clienti/${cliente.id}/modifica`);
		await campo.fill("  Mario Rossi (HR)  ");
		await page.getByRole("button", { name: "Salva modifiche" }).click();
		await page.waitForURL("**/anagrafiche/clienti?esito=salvato");

		await page.goto(`/anagrafiche/clienti/${cliente.id}`);
		await expect(page.getByTitle("Mario Rossi (HR)", { exact: true })).toBeVisible();

		await page.goto(`/anagrafiche/clienti/${cliente.id}/modifica`);
		await expect(campo).toHaveValue("Mario Rossi (HR)");
		await campo.fill("   ");
		await page.getByRole("button", { name: "Salva modifiche" }).click();
		await page.waitForURL("**/anagrafiche/clienti?esito=salvato");

		await page.goto(`/anagrafiche/clienti/${cliente.id}/modifica`);
		await expect(campo).toHaveValue("");
	});

	test("numero d'ordine e account Agile Reloaded: salvati e mostrati nel dettaglio offerta", async ({
		page,
		factory,
	}) => {
		const codice = `E2E-RIF-${randomUUID().slice(0, 8)}`.toUpperCase();
		const { cliente, offerta } = await factory.createClienteConOfferta({}, { codice });
		const dettaglio = page.getByRole("region", { name: `Dettaglio avanzamento ${codice}` });

		await page.goto(`/anagrafiche/clienti/${cliente.id}/offerte/${offerta.id}`);
		await expect(page.getByLabel("Codice")).toHaveValue(codice);
		await page.getByLabel("Numero d'ordine").fill("PO-2026/0042");
		await page.getByLabel("Account Agile Reloaded").fill("Stefano Marello");
		await page.getByRole("button", { name: "Salva offerta" }).click();
		await page.waitForURL(/\?esito=offerta-salvata$/);

		await attendiTabellaOfferteClienteIdratata(page);
		await page
			.getByRole("table", { name: "Offerte del cliente" })
			.getByText(codice, { exact: true })
			.click();
		await expect(dettaglio.getByRole("definition")).toHaveText(["PO-2026/0042", "Stefano Marello"]);

		await page.goto(`/anagrafiche/clienti/${cliente.id}/offerte/${offerta.id}`);
		await expect(page.getByLabel("Numero d'ordine")).toHaveValue("PO-2026/0042");
		await expect(page.getByLabel("Account Agile Reloaded")).toHaveValue("Stefano Marello");
	});
});
