import { randomUUID } from "node:crypto";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { cercaNellElenco, selezionaRighe } from "./support/elenchi";
import { test, expect } from "./support/fixtures";
import { apriMenuAccount, avatarUtente, pannelloAccount } from "./support/menu-account";

/**
 * Demo scenario — US-007: Anagrafica clienti — ciclo di vita del cliente
 *
 * Il demo crea un cliente proprio (stato «Nuovo»), lo modifica aggiungendo
 * le note e gli apre la prima offerta: il cliente diventa attivo. Non muta i
 * seed condivisi.
 */

test.use({
	video: "on",
	viewport: { width: 1280, height: 720 },
	launchOptions: { slowMo: 300 },
});

test.describe("US-007 Demo", () => {
	test("ciclo di vita cliente: crea → modifica con note → prima offerta", async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);

		await expect(avatarUtente(page, "Tech Reloaded")).toBeVisible();
		await apriMenuAccount(page);
		await expect(pannelloAccount(page)).toContainText("Amministratore");
		await page.keyboard.press("Escape");

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
		// L'elenco è paginato: il nuovo cliente si ritrova con la ricerca.
		await cercaNellElenco(page, "/anagrafiche/clienti", ragioneSociale);

		const rigaCliente = page
			.locator("table[aria-label='Elenco clienti'] tbody tr")
			.filter({ hasText: ragioneSociale })
			.first();
		await expect(rigaCliente.getByText(ragioneSociale)).toBeVisible();
		// Senza offerte il cliente è «Nuovo».
		await expect(rigaCliente.getByRole("cell").nth(4)).toHaveText("Nuovo");

		const barra = await selezionaRighe(page, [ragioneSociale]);
		await barra.getByRole("link", { name: "Modifica", exact: true }).click();
		await page.waitForURL(/\/anagrafiche\/clienti\/[^/]+\/modifica$/);
		await expect(
			page.getByRole("heading", { name: "Modifica cliente" }),
		).toBeVisible();

		const nuovaCitta = "Bologna";
		const campoCitta = page.getByLabel("Città");
		await campoCitta.clear();
		await campoCitta.fill(nuovaCitta);
		await page
			.getByRole("textbox", { name: /^Note\b/ })
			.fill("Referente: Laura Bassi\nFatture entro il 5 del mese");

		await page.getByRole("button", { name: "Salva modifiche" }).click();
		await page.waitForURL("**/anagrafiche/clienti?esito=salvato");
		await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();
		await cercaNellElenco(page, "/anagrafiche/clienti", ragioneSociale);

		const rigaModificata = page
			.locator("table[aria-label='Elenco clienti'] tbody tr")
			.filter({ hasText: ragioneSociale })
			.first();
		await expect(rigaModificata.getByText(nuovaCitta)).toBeVisible();

		// Scheda cliente: note su più righe e prima offerta.
		await rigaModificata.getByRole("link", { name: ragioneSociale }).click();
		await page.waitForURL(/\/anagrafiche\/clienti\/[^/?]+$/);
		const titolo = page.getByRole("heading", { level: 1, name: ragioneSociale });
		await expect(titolo).toContainText("Nuovo");
		await expect(page.getByTestId("note-anagrafica")).toContainText(
			"Fatture entro il 5 del mese",
		);

		await page.getByRole("link", { name: "Nuova offerta" }).click();
		await page.waitForURL(/\/offerte\/nuova$/);
		await page.getByLabel("Codice").fill(`DEMO-${token}`.toUpperCase());
		await page.getByLabel("Descrizione").fill("Percorso di coaching");
		await page.getByLabel("Tariffa giornaliera").fill("600,00");
		await page.getByLabel("Giorni previsti").fill("5");
		await page.getByRole("button", { name: "Crea offerta" }).click();
		await page.waitForURL(/\?esito=offerta-creata$/);
		// Con un'offerta attiva il cliente diventa attivo.
		await expect(titolo).toContainText("1 attiva");

		// Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
		await page.waitForTimeout(1500);
	});
});
