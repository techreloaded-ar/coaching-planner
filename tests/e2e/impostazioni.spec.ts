import { accediAlBackOfficeComeAdmin, accediComeAdmin, accediComeCollaboratore } from "./support/auth";
import { test, expect } from "./support/fixtures";
import {
	apriCategoriaImpostazioni,
	apriImpostazioni,
	modaleImpostazioni,
	voceCategoriaImpostazioni,
} from "./support/menu-account";

/**
 * Test e2e — Impostazioni in una modale sopra la pagina corrente: categorie
 * Tema e Connettori, contenuto della sola categoria aperta, chiusura che
 * lascia l'utente dove si trovava. Gli indirizzi `/impostazioni/...` aprono
 * la modale sulla pagina di partenza dell'utente.
 */

test.describe("Impostazioni in modale", () => {
	test("categorie Tema e Connettori, contenuto della sola categoria aperta", async ({ page }) => {
		await accediComeCollaboratore(page);
		await apriImpostazioni(page);
		const modale = modaleImpostazioni(page);

		await expect(voceCategoriaImpostazioni(page, "Connettori")).not.toHaveAttribute("aria-current", "true");
		await expect(modale.getByRole("heading", { name: "Tema", level: 3 })).toBeVisible();
		await expect(modale.getByRole("heading", { name: "Connettori", level: 3 })).toHaveCount(0);

		await apriCategoriaImpostazioni(page, "Connettori");
		await expect(voceCategoriaImpostazioni(page, "Tema")).not.toHaveAttribute("aria-current", "true");
		await expect(modale.getByRole("heading", { name: "Tema", level: 3 })).toHaveCount(0);
		await expect(page.getByTestId("selettore-tema")).toHaveCount(0);

		await apriCategoriaImpostazioni(page, "Tema");
		await expect(modale.getByRole("heading", { name: "Connettori", level: 3 })).toHaveCount(0);
	});

	test("si chiude con ×, Esc e click sullo sfondo restando sulla pagina", async ({ page }) => {
		await accediComeCollaboratore(page);
		const urlAttivita = page.url();

		await apriImpostazioni(page);
		await modaleImpostazioni(page).getByRole("button", { name: "Chiudi impostazioni", exact: true }).click();
		await expect(modaleImpostazioni(page)).toHaveCount(0);

		await apriImpostazioni(page);
		await page.keyboard.press("Escape");
		await expect(modaleImpostazioni(page)).toHaveCount(0);

		await apriImpostazioni(page);
		// Lo sfondo del dialog modale: un punto fuori dal riquadro della finestra.
		await page.mouse.click(5, 5);
		await expect(modaleImpostazioni(page)).toHaveCount(0);

		expect(page.url()).toBe(urlAttivita);
		await expect(page.getByRole("heading", { name: "Le mie attività", exact: true })).toBeVisible();
	});

	test("dalla console la modale si apre sopra la pagina della console", async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
		await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();
		await apriImpostazioni(page);
		await page.keyboard.press("Escape");
		await expect(page).toHaveURL(/\/anagrafiche\/clienti$/);
	});

	test("l'indirizzo generico delle Impostazioni apre la modale su Tema sopra le attività", async ({ page }) => {
		await accediComeCollaboratore(page);
		await page.goto("/impostazioni");
		await page.waitForURL("**/attivita");
		await expect(voceCategoriaImpostazioni(page, "Tema")).toHaveAttribute("aria-current", "true");
	});

	test("l'amministratore senza profilo collaboratore trova la modale sopra la console", async ({ page, factory }) => {
		const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
		await accediComeAdmin(page, amministratore.email);
		await page.goto("/impostazioni/connettori");
		await page.waitForURL("**/anagrafiche/clienti");
		await expect(voceCategoriaImpostazioni(page, "Connettori")).toHaveAttribute("aria-current", "true");
	});

	test("un visitatore non autenticato viene mandato alla pagina di accesso", async ({ page }) => {
		await page.goto("/impostazioni/connettori");
		await page.waitForURL((url) => url.pathname === "/");
		await expect(page.getByRole("button", { name: "Accedi con Google" })).toBeVisible();
	});
});
