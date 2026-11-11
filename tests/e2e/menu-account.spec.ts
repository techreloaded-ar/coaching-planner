import { test, expect } from "@playwright/test";

import {
	accediAlBackOfficeComeAdmin,
	accediComeAdmin,
	accediComeCollaboratore,
	EMAIL_ADMIN_E2E,
	EMAIL_COLLABORATORE_E2E,
} from "./support/auth";
import {
	apriMenuAccount,
	esci,
	pannelloAccount,
	pulsanteMenuAccount,
	sidebar,
} from "./support/menu-account";

/**
 * Test e2e — Account dell'utente collegato in fondo alla sidebar e accesso
 * alle Impostazioni.
 *
 * Scenari read-only sugli utenti del seed: aprono menu e pagine senza
 * scrivere dati applicativi.
 */

test.describe("Account in fondo alla sidebar", () => {
	test("collaboratore: avatar, nome e ruolo in fondo, i dati completi nel menu", async ({ page }) => {
		await accediComeCollaboratore(page);

		await expect(pulsanteMenuAccount(page)).toContainText("GC");
		await expect(pulsanteMenuAccount(page)).toContainText("Giulia Conti");
		await expect(pulsanteMenuAccount(page)).toContainText("Collaboratore");
		await expect(page.getByRole("banner").getByRole("button", { name: "Menu dell'account" })).toHaveCount(0);
		await expect(pannelloAccount(page)).toHaveCount(0);

		// L'account è l'ultimo elemento della sidebar, sotto la navigazione.
		const navigazione = (await sidebar(page).getByRole("navigation", { name: "Navigazione principale" }).boundingBox())!;
		const account = (await pulsanteMenuAccount(page).boundingBox())!;
		expect(account.y).toBeGreaterThanOrEqual(navigazione.y + navigazione.height);

		await apriMenuAccount(page);
		await expect(pulsanteMenuAccount(page)).toHaveAttribute("aria-expanded", "true");
		await expect(pannelloAccount(page)).toContainText("Giulia Conti");
		await expect(pannelloAccount(page)).toContainText(EMAIL_COLLABORATORE_E2E);
		await expect(pannelloAccount(page).getByText("Collaboratore", { exact: true })).toBeVisible();
		await expect(pannelloAccount(page).getByRole("button", { name: "Impostazioni", exact: true })).toBeVisible();
		await expect(pannelloAccount(page).getByRole("button", { name: "Esci", exact: true })).toBeVisible();

		// Esc, click fuori e nuovo click sull'avatar chiudono il menu senza cambiare pagina.
		const urlAttivita = page.url();
		await page.keyboard.press("Escape");
		await expect(pannelloAccount(page)).toHaveCount(0);
		await expect(pulsanteMenuAccount(page)).toBeFocused();

		await apriMenuAccount(page);
		await page.getByRole("heading", { level: 1 }).first().click();
		await expect(pannelloAccount(page)).toHaveCount(0);

		await apriMenuAccount(page);
		await pulsanteMenuAccount(page).click();
		await expect(pannelloAccount(page)).toHaveCount(0);
		expect(page.url()).toBe(urlAttivita);

		await esci(page);
		await expect(page.getByText("Ti sei disconnesso. A presto!")).toBeVisible();
	});

	test("amministratore nelle attività: niente Console amministrativa, ruolo nel menu", async ({ page }) => {
		await accediComeAdmin(page);
		await expect(page.getByRole("link", { name: "Console amministrativa" })).toHaveCount(0);
		await apriMenuAccount(page);
		await expect(pannelloAccount(page).getByText("Amministratore", { exact: true })).toBeVisible();
	});

	test("console: avatar da tastiera, dati dell'account solo nel menu", async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);

		await expect(sidebar(page).getByRole("link", { name: "Clienti", exact: true })).toBeVisible();
		await expect(sidebar(page).getByText(EMAIL_ADMIN_E2E)).toHaveCount(0);

		await expect(page.getByTestId("menu-account")).toHaveAttribute("data-idratata", "true");
		await pulsanteMenuAccount(page).focus();
		await page.keyboard.press("Enter");
		await expect(pannelloAccount(page)).toBeVisible();
		await expect(pannelloAccount(page)).toContainText("Stefano Leli");
		await expect(pannelloAccount(page)).toContainText(EMAIL_ADMIN_E2E);
		await expect(pannelloAccount(page).getByText("Amministratore", { exact: true })).toBeVisible();

		await pannelloAccount(page).getByRole("button", { name: "Esci", exact: true }).focus();
		await page.keyboard.press("Enter");
		await page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("logout") === "1");
	});
});
