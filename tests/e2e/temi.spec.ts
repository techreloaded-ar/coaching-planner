import { test, expect } from "@playwright/test";

import { accediAlBackOfficeComeAdmin, accediComeCollaboratore } from "./support/auth";
import { attendiAspetto, scegliTema, selettoreTema } from "./support/tema";

/**
 * Test e2e — Temi Chiaro, Scuro e Browser (US-001, US-002 dell'incremento).
 *
 * Scenari read-only: la preferenza vive solo nel cookie del contesto browser
 * di ciascun test, nessun dato applicativo viene scritto.
 */

test.describe("Selettore del tema", () => {
	test("pagina di accesso: Scuro si applica subito e resta dopo il reload", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await page.goto("/");

		const selettore = selettoreTema(page);
		await expect(selettore.getByRole("button", { name: "Browser", exact: true })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await attendiAspetto(page, "chiaro");

		await scegliTema(page, "Scuro");
		await attendiAspetto(page, "scuro");

		await page.reload();
		// Già al primo rendering server il documento porta il tema scelto.
		await expect(page.locator("html")).toHaveAttribute("data-tema", "scuro");
		await attendiAspetto(page, "scuro");
		await expect(selettore.getByRole("button", { name: "Scuro", exact: true })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	test("l'HTML iniziale contiene già il tema del cookie (nessun flash)", async ({ page, context, baseURL }) => {
		await context.addCookies([{ name: "tema", value: "scuro", url: baseURL! }]);
		const risposta = await page.request.get("/");
		expect(await risposta.text()).toMatch(/<html[^>]*data-tema="scuro"/);
	});

	test("Chiaro e Scuro ignorano il sistema, Browser lo segue in tempo reale", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto("/");
		await attendiAspetto(page, "scuro");

		await scegliTema(page, "Chiaro");
		await attendiAspetto(page, "chiaro");

		await page.emulateMedia({ colorScheme: "light" });
		await scegliTema(page, "Scuro");
		await attendiAspetto(page, "scuro");

		await scegliTema(page, "Browser");
		await attendiAspetto(page, "chiaro");
		await page.emulateMedia({ colorScheme: "dark" });
		await attendiAspetto(page, "scuro");
	});

	test("la scelta sopravvive a login e logout: selettore nell'intestazione del front office", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await page.goto("/");
		await scegliTema(page, "Scuro");

		await accediComeCollaboratore(page);
		const selettore = page.getByRole("banner").getByRole("group", { name: "Tema" });
		await expect(selettore).toBeVisible();
		await expect(selettore.getByRole("button", { name: "Scuro", exact: true })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await attendiAspetto(page, "scuro");

		await scegliTema(page, "Chiaro");
		await attendiAspetto(page, "chiaro");

		await page.emulateMedia({ colorScheme: "dark" });
		await page.locator("[data-esci]").click();
		await page.waitForURL("**/?logout=1");
		await expect(
			selettoreTema(page).getByRole("button", { name: "Chiaro", exact: true }),
		).toHaveAttribute("aria-pressed", "true");
		await attendiAspetto(page, "chiaro");
	});

	test("selettore nell'intestazione della console amministrativa, utilizzabile da tastiera", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await accediAlBackOfficeComeAdmin(page);

		const selettore = page.getByRole("banner").getByRole("group", { name: "Tema" });
		await expect(selettore).toHaveAttribute("data-idratata", "true");
		const scuro = selettore.getByRole("button", { name: "Scuro", exact: true });
		await scuro.focus();
		await page.keyboard.press("Enter");
		await expect(scuro).toHaveAttribute("aria-pressed", "true");
		await attendiAspetto(page, "scuro");
	});
});

test.describe("Tutta l'interfaccia rispetta il tema scelto", () => {
	const PAGINE_BACK_OFFICE = [
		"/anagrafiche/clienti",
		"/anagrafiche/collaboratori",
		"/anagrafiche/utenti",
		"/anagrafiche/voci-rimborso",
		"/offerte",
		"/report/fatturazione-clienti",
		"/report/avanzamento-offerte",
		"/attivita",
		"/attivita/riepilogo",
		"/pagina-che-non-esiste",
	];

	for (const [tema, sistema, aspetto] of [
		["scuro", "light", "scuro"],
		["chiaro", "dark", "chiaro"],
	] as const) {
		test(`tema ${tema} con sistema ${sistema}: ogni pagina è ${aspetto}`, async ({ page, context, baseURL }) => {
			await page.emulateMedia({ colorScheme: sistema });
			await context.addCookies([{ name: "tema", value: tema, url: baseURL! }]);

			await page.goto("/");
			await attendiAspetto(page, aspetto);

			await accediAlBackOfficeComeAdmin(page);
			for (const percorso of PAGINE_BACK_OFFICE) {
				await page.goto(percorso);
				await attendiAspetto(page, aspetto);
			}
		});
	}
});
