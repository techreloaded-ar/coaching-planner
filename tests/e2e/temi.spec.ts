import { test, expect, type Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin, accediComeCollaboratore } from "./support/auth";
import { apriImpostazioni, esci, modaleImpostazioni, pannelloAccount, pulsanteMenuAccount } from "./support/menu-account";
import { attendiAspetto, opzioneTema, scegliTema, selettoreTema } from "./support/tema";

/**
 * Test e2e — Temi Chiaro, Scuro, Browser e Natalizio, scelti dalla modale Impostazioni.
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
		for (const etichetta of ["Chiaro", "Scuro", "Browser", "Natalizio"] as const) {
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
		["natalizio", "light", "natalizio"],
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

/** Stile calcolato dello strato di neve (pseudo-elemento del body). */
function stileNeve(page: Page) {
	return page.evaluate(() => {
		const stile = getComputedStyle(document.body, "::before");
		return {
			contenuto: stile.content,
			animazione: stile.animationName,
			zIndex: stile.zIndex,
			pointerEvents: stile.pointerEvents,
		};
	});
}

test.describe("Tema Natalizio", () => {
	test("scelto dalle Impostazioni: blu notte e oro, decorazioni subito visibili e persistenti al reload", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
		await accediComeCollaboratore(page);
		const intestazioneSidebar = page.getByTestId("intestazione-sidebar");
		await expect(intestazioneSidebar.getByTestId("decorazione-agrifoglio")).toBeHidden();
		await expect(intestazioneSidebar.getByTestId("decorazione-ghirlanda")).toBeHidden();
		expect((await stileNeve(page)).contenuto).toBe("none");

		await apriImpostazioni(page);
		await scegliTema(page, "Natalizio");
		await attendiAspetto(page, "natalizio");
		// L'oro prende il posto dell'indaco come colore principale.
		await expect
			.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-indigo-500").trim()))
			.toBe("#d6a83c");
		await page.keyboard.press("Escape");

		await expect(intestazioneSidebar.getByTestId("decorazione-agrifoglio")).toBeVisible();
		await expect(intestazioneSidebar.getByTestId("decorazione-ghirlanda")).toBeVisible();
		await expect.poll(() => stileNeve(page)).toEqual({
			contenuto: "\"\"",
			animazione: "nevicata-natalizia",
			zIndex: "-1",
			pointerEvents: "none",
		});

		await page.reload();
		await expect(page.locator("html")).toHaveAttribute("data-tema", "natalizio");
		await attendiAspetto(page, "natalizio");
		await expect(intestazioneSidebar.getByTestId("decorazione-agrifoglio")).toBeVisible();
		await apriImpostazioni(page);
		await expect(opzioneTema(page, "Natalizio")).toBeChecked();

		// Tornando a un altro tema le decorazioni spariscono subito.
		await scegliTema(page, "Scuro");
		await attendiAspetto(page, "scuro");
		await page.keyboard.press("Escape");
		await expect(intestazioneSidebar.getByTestId("decorazione-agrifoglio")).toBeHidden();
		expect((await stileNeve(page)).contenuto).toBe("none");
	});

	test("con «riduci movimento» la neve resta ferma; le decorazioni restano ornamentali", async ({ page, context, baseURL }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await context.addCookies([{ name: "tema", value: "natalizio", url: baseURL! }]);
		await accediAlBackOfficeComeAdmin(page);
		await attendiAspetto(page, "natalizio");

		const neve = await stileNeve(page);
		expect(neve.contenuto).toBe("\"\"");
		expect(neve.animazione).toBe("none");

		const agrifoglio = page.getByTestId("intestazione-sidebar").getByTestId("decorazione-agrifoglio");
		await expect(agrifoglio).toBeVisible();
		await expect(agrifoglio).toHaveAttribute("aria-hidden", "true");
		await expect(agrifoglio).toHaveCSS("pointer-events", "none");
	});
});
