import { test, expect } from "@playwright/test";

import {
	accediAlBackOfficeComeAdmin,
	accediComeAdmin,
	accediComeCollaboratore,
	EMAIL_ADMIN_E2E,
	EMAIL_COLLABORATORE_E2E,
} from "./support/auth";
import {
	apriImpostazioni,
	apriMenuAccount,
	esci,
	pannelloAccount,
	pulsanteMenuAccount,
} from "./support/menu-account";

/**
 * Test e2e — Menu dell'account sull'avatar e accesso alle Impostazioni.
 *
 * Scenari read-only sugli utenti del seed: aprono menu e pagine senza
 * scrivere dati applicativi.
 */

test.describe("Menu dell'account sull'avatar", () => {
	test("front office: nella barra solo l'avatar, i dati dell'account nel menu", async ({ page }) => {
		await accediComeCollaboratore(page);
		const banner = page.getByRole("banner");

		await expect(pulsanteMenuAccount(page)).toHaveText("GC");
		await expect(banner.getByText("Giulia Conti")).toHaveCount(0);
		await expect(banner.getByText(EMAIL_COLLABORATORE_E2E)).toHaveCount(0);
		await expect(banner.getByText("Collaboratore", { exact: true })).toHaveCount(0);
		await expect(banner.getByRole("button", { name: "Esci", exact: true })).toHaveCount(0);
		await expect(pannelloAccount(page)).toHaveCount(0);

		await apriMenuAccount(page);
		await expect(pulsanteMenuAccount(page)).toHaveAttribute("aria-expanded", "true");
		await expect(pannelloAccount(page)).toContainText("Giulia Conti");
		await expect(pannelloAccount(page)).toContainText(EMAIL_COLLABORATORE_E2E);
		await expect(pannelloAccount(page).getByText("Collaboratore", { exact: true })).toBeVisible();
		await expect(pannelloAccount(page).getByRole("link", { name: "Impostazioni", exact: true })).toBeVisible();
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

	test("front office amministratore: Console amministrativa resta nella barra", async ({ page }) => {
		await accediComeAdmin(page);
		await expect(
			page.getByRole("banner").getByRole("link", { name: "Console amministrativa", exact: true }),
		).toBeVisible();
		await apriMenuAccount(page);
		await expect(pannelloAccount(page).getByText("Amministratore", { exact: true })).toBeVisible();
	});

	test("console amministrativa: avatar da tastiera e barra laterale senza riquadro utente", async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
		const sidebar = page.getByRole("complementary");

		await expect(sidebar.getByRole("navigation", { name: "Navigazione principale" })).toBeVisible();
		await expect(sidebar.getByRole("link", { name: "Clienti", exact: true })).toBeVisible();
		await expect(sidebar.getByText("Tech Reloaded")).toHaveCount(0);
		await expect(sidebar.getByText("Amministratore", { exact: true })).toHaveCount(0);
		await expect(sidebar.getByRole("button", { name: "Esci" })).toHaveCount(0);
		await expect(page.getByRole("banner").getByText("Tech Reloaded")).toHaveCount(0);

		await expect(page.getByTestId("menu-account")).toHaveAttribute("data-idratata", "true");
		await pulsanteMenuAccount(page).focus();
		await page.keyboard.press("Enter");
		await expect(pannelloAccount(page)).toBeVisible();
		await expect(pannelloAccount(page)).toContainText("Tech Reloaded");
		await expect(pannelloAccount(page)).toContainText(EMAIL_ADMIN_E2E);
		await expect(pannelloAccount(page).getByText("Amministratore", { exact: true })).toBeVisible();

		await pannelloAccount(page).getByRole("button", { name: "Esci", exact: true }).focus();
		await page.keyboard.press("Enter");
		await page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("logout") === "1");
	});
});

test.describe("Accesso alle Impostazioni", () => {
	test("dal menu dell'account del front office e della console amministrativa", async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
		await apriImpostazioni(page);
		await expect(page.getByRole("heading", { name: "Tema", level: 2 })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Connettori", level: 2 })).toBeVisible();

		await page.goto("/attivita");
		await apriImpostazioni(page);
		await expect(page.getByRole("heading", { name: "Tema", level: 2 })).toBeVisible();
	});

	test("un visitatore non autenticato viene mandato alla pagina di accesso", async ({ page }) => {
		await page.goto("/impostazioni");
		await page.waitForURL((url) => url.pathname === "/");
		await expect(page.getByRole("button", { name: "Accedi con Google" })).toBeVisible();
	});
});
