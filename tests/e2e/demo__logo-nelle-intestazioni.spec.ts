import { test, expect, type Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import { pulsanteMenuAccount } from "./support/menu-account";

/**
 * Demo scenario — US-028: logo Coaching Planner nelle intestazioni delle aree interne.
 *
 * L'amministratore entra nel front office e vede il logo nell'intestazione,
 * apre la console amministrativa (back office) e ritrova il logo nella sidebar,
 * poi naviga tra le pagine della console e il logo resta visibile.
 * Scenario read-only: l'utente seed serve solo ad accedere.
 */

function logo(page: Page) {
	return page.getByRole("img", { name: "Coaching Planner", exact: true });
}

test.describe("US-028 Demo", () => {
	test("il logo resta visibile nel front office e nella sidebar del back office", async ({ page }) => {
		await accediComeAdmin(page);

		await expect(page.getByRole("heading", { name: "Le mie attività" })).toBeVisible();
		await expect(logo(page)).toBeVisible();

		await page.getByRole("link", { name: "Console amministrativa", exact: true }).click();
		await page.waitForURL("**/anagrafiche**");
		await expect(logo(page)).toBeVisible();

		await page.getByRole("link", { name: "Offerte", exact: true }).click();
		await page.waitForURL("**/offerte");
		await expect(logo(page)).toBeVisible();

		await page.getByRole("link", { name: "Clienti", exact: true }).click();
		await page.waitForURL("**/clienti");
		await expect(logo(page)).toBeVisible();
		await expect(pulsanteMenuAccount(page)).toBeVisible();
	});
});
