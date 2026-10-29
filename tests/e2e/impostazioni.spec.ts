import type { Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin, accediComeAdmin, accediComeCollaboratore } from "./support/auth";
import { test, expect } from "./support/fixtures";
import { apriCategoriaImpostazioni, apriImpostazioni, categorieImpostazioni } from "./support/menu-account";

/**
 * Test e2e — Pagina Impostazioni: barra laterale con le categorie, contenuto
 * della sola categoria aperta e uscita verso l'area di partenza dell'utente.
 */

function voceCategoria(page: Page, categoria: "Tema" | "Connettori") {
	return categorieImpostazioni(page).getByRole("link", { name: categoria, exact: true });
}

function uscita(page: Page, etichetta: "Torna alle attività" | "Torna alla console") {
	return page.getByRole("complementary").getByRole("link", { name: etichetta, exact: true });
}

test.describe("Impostazioni per categorie", () => {
	test("barra laterale con Tema e Connettori, contenuto della sola categoria aperta", async ({ page }) => {
		await accediComeCollaboratore(page);
		await apriImpostazioni(page);

		await expect(voceCategoria(page, "Tema")).toHaveAttribute("aria-current", "page");
		await expect(voceCategoria(page, "Connettori")).not.toHaveAttribute("aria-current", "page");
		await expect(page.getByRole("heading", { name: "Tema", level: 2 })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Connettori", level: 2 })).toHaveCount(0);

		await apriCategoriaImpostazioni(page, "Connettori");
		await expect(voceCategoria(page, "Tema")).not.toHaveAttribute("aria-current", "page");
		await expect(page.getByRole("heading", { name: "Tema", level: 2 })).toHaveCount(0);
		await expect(page.getByTestId("selettore-tema")).toHaveCount(0);

		await apriCategoriaImpostazioni(page, "Tema");
		await expect(page.getByRole("heading", { name: "Connettori", level: 2 })).toHaveCount(0);
	});

	test("su schermo largo la barra laterale è ancorata al bordo sinistro, il contenuto le sta a fianco", async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 900 });
		await accediComeCollaboratore(page);
		await apriImpostazioni(page);

		const barraLaterale = (await page.getByRole("complementary").boundingBox())!;
		const contenuto = (await page.getByRole("main").boundingBox())!;
		expect(barraLaterale.x).toBe(0);
		expect(contenuto.x).toBeGreaterThanOrEqual(barraLaterale.x + barraLaterale.width);
		const larghezzaVista = await page.evaluate(() => document.documentElement.clientWidth);
		expect(contenuto.x + contenuto.width).toBeCloseTo(larghezzaVista, 0);
	});

	test("l'indirizzo generico delle Impostazioni apre la categoria Tema", async ({ page }) => {
		await accediComeCollaboratore(page);
		await page.goto("/impostazioni");
		await page.waitForURL("**/impostazioni/tema");
		await expect(voceCategoria(page, "Tema")).toHaveAttribute("aria-current", "page");
	});

	test("un visitatore non autenticato viene mandato alla pagina di accesso", async ({ page }) => {
		await page.goto("/impostazioni/connettori");
		await page.waitForURL((url) => url.pathname === "/");
		await expect(page.getByRole("button", { name: "Accedi con Google" })).toBeVisible();
	});
});

test.describe("Uscita dalle Impostazioni", () => {
	test("il collaboratore torna alle attività", async ({ page }) => {
		await accediComeCollaboratore(page);
		await apriImpostazioni(page);

		await expect(uscita(page, "Torna alla console")).toHaveCount(0);
		await uscita(page, "Torna alle attività").click();
		await page.waitForURL("**/attivita");
		await expect(page.getByRole("heading", { name: "Le mie attività", exact: true })).toBeVisible();
	});

	test("l'amministratore senza profilo collaboratore torna alla console", async ({ page, factory }) => {
		const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
		await accediComeAdmin(page, amministratore.email);
		await page.getByRole("link", { name: "Console amministrativa", exact: true }).click();
		await page.waitForURL("**/anagrafiche**");
		await apriImpostazioni(page);

		await expect(uscita(page, "Torna alle attività")).toHaveCount(0);
		await uscita(page, "Torna alla console").click();
		await page.waitForURL("**/anagrafiche**");
		await expect(page.getByRole("navigation", { name: "Navigazione principale" })).toBeVisible();
	});

	test("l'amministratore che è anche collaboratore torna alle attività, anche partendo dalla console", async ({
		page,
		factory,
	}) => {
		const { utente } = await factory.createCollaboratore({ utenteOptions: { ruolo: "AMMINISTRATORE" } });
		await accediAlBackOfficeComeAdmin(page, utente.email);
		await apriImpostazioni(page);

		await expect(uscita(page, "Torna alla console")).toHaveCount(0);
		await uscita(page, "Torna alle attività").click();
		await page.waitForURL("**/attivita");
		await expect(page.getByRole("heading", { name: "Le mie attività", exact: true })).toBeVisible();
	});
});
