import { test, expect, type Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin, accediComeCollaboratore } from "./support/auth";
import { apriImpostazioni, esci, modaleImpostazioni, pannelloAccount, pulsanteMenuAccount } from "./support/menu-account";
import { attendiAspetto, opzioneTema, scegliTema, selettoreTema } from "./support/tema";

/**
 * Test e2e — Temi Chiaro, Scuro, Browser e Natale, scelti dalla modale Impostazioni.
 *
 * Scenari read-only: la preferenza vive solo nel cookie del contesto browser
 * di ciascun test, nessun dato applicativo viene scritto.
 */

test.describe("Tema nelle Impostazioni", () => {
	test("pagina di accesso: nessun selettore, ma usa il tema già scelto", async ({ page, context, baseURL }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await page.goto("/");
		await expect(page.getByRole("heading", { name: "Coaching Planner" })).toBeVisible();
		await expect(page.getByTestId("selettore-tema")).toHaveCount(0);
		await attendiAspetto(page, "chiaro");

		await context.addCookies([{ name: "tema", value: "scuro", url: baseURL! }]);
		await page.reload();
		await attendiAspetto(page, "scuro");
	});

	test("l'HTML iniziale contiene già il tema del cookie (nessun flash)", async ({ page, context, baseURL }) => {
		await context.addCookies([{ name: "tema", value: "scuro", url: baseURL! }]);
		const risposta = await page.request.get("/");
		expect(await risposta.text()).toMatch(/<html[^>]*data-tema="scuro"/);
	});

	test("front office: niente pulsante tema nell'intestazione, scelta dalle Impostazioni persistente tra reload e logout", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await accediComeCollaboratore(page);

		// US-001 AC-2: il pulsante-icona del tema non è più nell'intestazione.
		await expect(page.getByRole("banner").getByRole("button", { name: "Tema", exact: true })).toHaveCount(0);
		await expect(page.getByTestId("selettore-tema")).toHaveCount(0);

		await apriImpostazioni(page);
		for (const etichetta of ["Chiaro", "Scuro", "Browser", "Natale"] as const) {
			await expect(opzioneTema(page, etichetta)).toBeAttached();
		}
		await expect(opzioneTema(page, "Browser")).toBeChecked();

		const urlPrimaDellaScelta = page.url();
		await scegliTema(page, "Scuro");
		await attendiAspetto(page, "scuro");
		// Applicato subito, senza navigazione.
		expect(page.url()).toBe(urlPrimaDellaScelta);

		await page.reload();
		await expect(page.locator("html")).toHaveAttribute("data-tema", "scuro");
		await attendiAspetto(page, "scuro");
		await apriImpostazioni(page);
		await expect(opzioneTema(page, "Scuro")).toBeChecked();
		await page.keyboard.press("Escape");

		await page.goto("/attivita");
		await attendiAspetto(page, "scuro");

		await esci(page);
		await attendiAspetto(page, "scuro");
	});

	test("Chiaro e Scuro ignorano il sistema, Browser lo segue in tempo reale", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await accediComeCollaboratore(page);
		await attendiAspetto(page, "scuro");
		await apriImpostazioni(page);

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

	test("console amministrativa: Impostazioni dal menu dell'account, tutto da tastiera", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await accediAlBackOfficeComeAdmin(page);
		await expect(page.getByRole("banner").getByRole("button", { name: "Tema", exact: true })).toHaveCount(0);

		await expect(page.getByTestId("menu-account")).toHaveAttribute("data-idratata", "true");
		await pulsanteMenuAccount(page).focus();
		await page.keyboard.press("Enter");
		await expect(pannelloAccount(page)).toBeVisible();
		await pannelloAccount(page).getByRole("button", { name: "Impostazioni", exact: true }).focus();
		await page.keyboard.press("Enter");
		await expect(modaleImpostazioni(page).getByRole("heading", { name: "Impostazioni", level: 2 })).toBeVisible();

		await expect(page.getByTestId("selettore-tema")).toHaveAttribute("data-idratata", "true");
		await opzioneTema(page, "Browser").focus();
		// Nel gruppo radio le frecce spostano la scelta: Browser → Scuro.
		await page.keyboard.press("ArrowLeft");
		await expect(opzioneTema(page, "Scuro")).toBeChecked();
		await expect(selettoreTema(page)).toBeVisible();
		await attendiAspetto(page, "scuro");
	});
});

test.describe("Tema Natale", () => {
	/** Fiocchi di neve: decorazione dietro i contenuti, presente solo con il tema Natale. */
	const neve = (page: Page) => page.getByTestId("neve-natale");
	const stellaNelLogo = (page: Page) => page.getByTestId("stella-natale").first();

	test("scelto dalle Impostazioni: blu notte, stella sul logo e neve che cade; resta dopo il reload e si toglie tornando a Browser", async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
		await accediComeCollaboratore(page);
		await expect(neve(page)).toBeHidden();
		await expect(stellaNelLogo(page)).toBeHidden();

		await apriImpostazioni(page);
		await scegliTema(page, "Natale");
		await attendiAspetto(page, "natale");
		await expect(stellaNelLogo(page)).toBeVisible();
		await expect(neve(page)).toBeVisible();
		await expect(neve(page)).toHaveCSS("pointer-events", "none");
		await expect(neve(page).locator("span").first()).toHaveCSS("animation-name", "caduta-neve");
		// Accento del tema: il radio scelto è in oro, non più in indaco.
		await expect(selettoreTema(page).locator("label").filter({ hasText: "Natale" })).toHaveCSS(
			"color",
			"rgb(245, 214, 132)",
		);

		await page.reload();
		await expect(page.locator("html")).toHaveAttribute("data-tema", "natale");
		await attendiAspetto(page, "natale");
		await expect(neve(page)).toBeVisible();
		await apriImpostazioni(page);
		await expect(opzioneTema(page, "Natale")).toBeChecked();

		await scegliTema(page, "Browser");
		await attendiAspetto(page, "chiaro");
		await expect(neve(page)).toBeHidden();
		await expect(stellaNelLogo(page)).toBeHidden();
	});

	test("con «riduci movimento» la neve resta ferma", async ({ page, context, baseURL }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await context.addCookies([{ name: "tema", value: "natale", url: baseURL! }]);
		await page.goto("/");
		await attendiAspetto(page, "natale");
		await expect(neve(page)).toBeVisible();
		await expect(neve(page).locator("span").first()).toHaveCSS("animation-name", "none");
	});

	test("l'HTML iniziale contiene già il tema Natale (nessun flash)", async ({ page, context, baseURL }) => {
		await context.addCookies([{ name: "tema", value: "natale", url: baseURL! }]);
		const risposta = await page.request.get("/");
		expect(await risposta.text()).toMatch(/<html[^>]*data-tema="natale"/);
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
		"/impostazioni",
		"/pagina-che-non-esiste",
	];

	for (const [tema, sistema, aspetto] of [
		["scuro", "light", "scuro"],
		["chiaro", "dark", "chiaro"],
		["natale", "light", "natale"],
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
