import { accediComeCollaboratore } from "./support/auth";
import { test, expect } from "./support/fixtures";
import {
	apriCategoriaImpostazioni,
	apriImpostazioni,
	apriMenuAccount,
	esci,
	modaleImpostazioni,
	pannelloAccount,
	voceCategoriaImpostazioni,
} from "./support/menu-account";
import { attendiAspetto, scegliTema } from "./support/tema";

/**
 * Demo scenario — Menu dell'account, Impostazioni e connettore Google Calendar
 *
 * Un collaboratore creato dalla factory trova l'avatar in fondo alla sidebar;
 * apre il menu con nome, email e ruolo, apre la modale Impostazioni, sceglie
 * il tema scuro, collega Google Calendar dalla sezione Connettori (consenso
 * simulato) e torna alle attività con la modale riaperta sull'esito. Nella
 * pagina lo stato è solo un'indicazione discreta che riapre le Impostazioni.
 * Infine esce dal menu dell'avatar.
 *
 * Registra un video per la review.
 */

test.use({
	video: "on",
	viewport: { width: 1280, height: 720 },
	launchOptions: { slowMo: 300 },
});

test.describe("Impostazioni utente Demo", () => {
	test("avatar → menu → Impostazioni: tema, Google Calendar e indicatore nelle attività", async ({
		page,
		factory,
	}) => {
		await page.emulateMedia({ colorScheme: "light" });
		const collaboratore = await factory.createCollaboratore();
		await accediComeCollaboratore(page, collaboratore.utente.email);

		await apriMenuAccount(page);
		await expect(pannelloAccount(page)).toContainText(collaboratore.utente.email);
		await expect(pannelloAccount(page).getByText("Collaboratore", { exact: true })).toBeVisible();
		await page.keyboard.press("Escape");

		await apriImpostazioni(page);
		await scegliTema(page, "Scuro");
		await attendiAspetto(page, "scuro");

		await apriCategoriaImpostazioni(page, "Connettori");
		await page.getByRole("link", { name: "Collega Google Calendar" }).click();
		await page.waitForURL("**/e2e-test/consenso-calendario**");
		await page.getByRole("button", { name: "Autorizza" }).click();
		await page.waitForURL("**/attivita");
		await expect(voceCategoriaImpostazioni(page, "Connettori")).toHaveAttribute("aria-current", "true");
		await expect(page.getByText("Calendario Google collegato", { exact: true })).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(modaleImpostazioni(page)).toHaveCount(0);

		const indicatore = page.getByRole("link", { name: "Google Calendar collegato", exact: true });
		await expect(indicatore).toBeVisible();
		await expect(page.getByRole("button", { name: "Scollega" })).toHaveCount(0);
		await indicatore.click();
		await expect(voceCategoriaImpostazioni(page, "Connettori")).toHaveAttribute("aria-current", "true");
		await page.keyboard.press("Escape");

		await esci(page);
		await attendiAspetto(page, "scuro");

		// Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
		await page.waitForTimeout(1500);
	});
});
