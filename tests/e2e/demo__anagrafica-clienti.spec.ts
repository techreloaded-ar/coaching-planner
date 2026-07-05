import { randomUUID } from "node:crypto";

import { accediComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";

/**
 * Demo scenario — US-007: Anagrafica clienti — ciclo di vita del cliente
 *
 * Il demo crea e disattiva un cliente proprio, quindi non muta i seed condivisi.
 */

test.use({
	video: "on",
	viewport: { width: 1280, height: 720 },
	launchOptions: { slowMo: 300 },
});

test.describe("US-007 Demo", () => {
	test("ciclo di vita cliente: crea → modifica → disattiva", async ({ page }) => {
		await accediComeAdmin(page);

		await expect(page.getByRole("banner").getByText("Tech Reloaded")).toBeVisible();
		await expect(page.getByRole("banner").getByText("Amministratore")).toBeVisible();

		await page.getByRole("link", { name: "Clienti", exact: true }).click();
		await page.waitForURL("**/anagrafiche/clienti");
		await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();

		await page.getByRole("link", { name: "Nuovo cliente" }).click();
		await page.waitForURL("**/anagrafiche/clienti/nuovo");
		await expect(
			page.getByRole("heading", { name: "Nuovo cliente" }),
		).toBeVisible();

		const token = randomUUID().slice(0, 8);
		const codice = token.replace(/[^0-9]/g, "").padEnd(6, "7").slice(0, 6);
		const ragioneSociale = `E2E Demo Cliente ${token} S.p.A.`;

		await page.getByLabel("Ragione sociale").fill(ragioneSociale);
		await page.getByLabel("Partita IVA").fill(`04127${codice}`.slice(0, 11));
		await page.getByLabel("Codice fiscale").fill(`DMO${codice}A01H501X`.slice(0, 16));
		await page.getByLabel("Indirizzo").fill("Via Roma 42");
		await page.getByLabel("Città").fill("Milano");
		await page.getByLabel("CAP").fill("20121");
		await page.getByLabel("Provincia").fill("MI");
		await page.getByLabel("PEC").fill(`demo-${token}@pec.e2e.invalid`);
		await page.getByLabel("Codice destinatario SDI").fill(`M${codice}`.slice(0, 7));

		await page.getByRole("button", { name: "Crea cliente" }).click();

		await page.waitForURL("**/anagrafiche/clienti?esito=creato");
		await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();

		const rigaCliente = page
			.locator("table[aria-label='Elenco clienti'] tbody tr")
			.filter({ hasText: ragioneSociale })
			.first();
		await expect(rigaCliente.getByText(ragioneSociale)).toBeVisible();
		await expect(rigaCliente.getByText("Attivo")).toBeVisible();

		await rigaCliente.getByRole("link", { name: "Modifica" }).click();
		await page.waitForURL(/\/anagrafiche\/clienti\/[^/]+\/modifica$/);
		await expect(
			page.getByRole("heading", { name: "Modifica cliente" }),
		).toBeVisible();

		const nuovaCitta = "Bologna";
		const campoCitta = page.getByLabel("Città");
		await campoCitta.clear();
		await campoCitta.fill(nuovaCitta);

		await page.getByRole("button", { name: "Salva modifiche" }).click();
		await page.waitForURL("**/anagrafiche/clienti?esito=salvato");
		await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();

		const rigaModificata = page
			.locator("table[aria-label='Elenco clienti'] tbody tr")
			.filter({ hasText: ragioneSociale })
			.first();
		await expect(rigaModificata.getByText(nuovaCitta)).toBeVisible();

		await rigaModificata.getByRole("button", { name: "Disattiva" }).click();
		await page.waitForURL("**/anagrafiche/clienti");

		const rigaDisattivata = page
			.locator("table[aria-label='Elenco clienti'] tbody tr")
			.filter({ hasText: ragioneSociale })
			.first();
		await expect(rigaDisattivata.getByText("Disattivato")).toBeVisible();

		// Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
		await page.waitForTimeout(1500);
	});
});
