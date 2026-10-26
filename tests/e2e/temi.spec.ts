import { test, expect } from "@playwright/test";

import { accediAlBackOfficeComeAdmin, accediComeCollaboratore } from "./support/auth";
import {
	apriPannelloTema,
	attendiAspetto,
	attendiIconaTema,
	attendiSelettoreAccantoAEsci,
	opzioneTema,
	pannelloTema,
	pulsanteTema,
	scegliTema,
} from "./support/tema";

/**
 * Test e2e — Temi Chiaro, Scuro e Browser (US-001, US-002 dell'incremento).
 *
 * Scenari read-only: la preferenza vive solo nel cookie del contesto browser
 * di ciascun test, nessun dato applicativo viene scritto.
 */

test.describe("Selettore del tema", () => {
	test("pagina di accesso: nessun selettore, ma usa il tema già scelto", async ({ page, context, baseURL }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await page.goto("/");
		await expect(page.getByRole("heading", { name: "Coaching Planner" })).toBeVisible();
		await expect(pulsanteTema(page)).toHaveCount(0);
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

	test("front office: pulsante-icona, menu, scelta persistente tra reload e logout", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await accediComeCollaboratore(page);

		const pulsante = page.getByRole("banner").getByRole("button", { name: "Tema", exact: true });
		await expect(pulsante).toBeVisible();
		// Compatto: solo icona, nessuna etichetta testuale visibile.
		await expect(pulsante).toHaveText("");
		await expect(pannelloTema(page)).toBeHidden();
		await attendiSelettoreAccantoAEsci(page);
		await attendiIconaTema(page, "sole");

		await apriPannelloTema(page);
		await expect(pulsante).toHaveAttribute("aria-expanded", "true");
		for (const etichetta of ["Chiaro", "Scuro", "Browser"] as const) {
			await expect(opzioneTema(page, etichetta)).toBeVisible();
		}
		await expect(opzioneTema(page, "Browser")).toHaveAttribute("aria-pressed", "true");
		await opzioneTema(page, "Scuro").click();
		await expect(pannelloTema(page)).toBeHidden();
		await attendiAspetto(page, "scuro");
		await attendiIconaTema(page, "luna");

		await page.reload();
		await expect(page.locator("html")).toHaveAttribute("data-tema", "scuro");
		await attendiAspetto(page, "scuro");
		await attendiIconaTema(page, "luna");
		await apriPannelloTema(page);
		await expect(opzioneTema(page, "Scuro")).toHaveAttribute("aria-pressed", "true");

		// Esc e click fuori chiudono il pannello senza cambiare tema.
		await page.keyboard.press("Escape");
		await expect(pannelloTema(page)).toBeHidden();
		await apriPannelloTema(page);
		await page.getByRole("heading", { level: 1 }).first().click();
		await expect(pannelloTema(page)).toBeHidden();
		await expect(page.locator("html")).toHaveAttribute("data-tema", "scuro");

		await page.locator("[data-esci]").click();
		await page.waitForURL("**/?logout=1");
		await attendiAspetto(page, "scuro");
	});

	test("Chiaro e Scuro ignorano il sistema, Browser lo segue in tempo reale", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await accediComeCollaboratore(page);
		await attendiAspetto(page, "scuro");

		await attendiIconaTema(page, "luna");

		await scegliTema(page, "Chiaro");
		await attendiAspetto(page, "chiaro");
		await attendiIconaTema(page, "sole");

		await page.emulateMedia({ colorScheme: "light" });
		await scegliTema(page, "Scuro");
		await attendiAspetto(page, "scuro");
		await attendiIconaTema(page, "luna");

		// Con Browser l'icona segue il sistema: sole se chiaro, luna se scuro.
		await scegliTema(page, "Browser");
		await attendiAspetto(page, "chiaro");
		await attendiIconaTema(page, "sole");
		await page.emulateMedia({ colorScheme: "dark" });
		await attendiAspetto(page, "scuro");
		await attendiIconaTema(page, "luna");
	});

	test("console amministrativa: pulsante accanto a Esci, utilizzabile da tastiera", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await accediAlBackOfficeComeAdmin(page);
		await attendiSelettoreAccantoAEsci(page);
		await attendiIconaTema(page, "sole");

		const pulsante = page.getByRole("banner").getByRole("button", { name: "Tema", exact: true });
		await expect(page.getByTestId("selettore-tema")).toHaveAttribute("data-idratata", "true");
		await pulsante.focus();
		await page.keyboard.press("Enter");
		await expect(pannelloTema(page)).toBeVisible();
		// All'apertura il fuoco va sull'opzione attiva.
		await expect(opzioneTema(page, "Browser")).toBeFocused();

		await opzioneTema(page, "Scuro").focus();
		await page.keyboard.press("Enter");
		await expect(pannelloTema(page)).toBeHidden();
		await expect(pulsante).toBeFocused();
		await attendiAspetto(page, "scuro");
		await attendiIconaTema(page, "luna");
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
