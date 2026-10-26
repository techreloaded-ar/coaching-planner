import { test, expect } from "@playwright/test";

import { accediComeCollaboratore } from "./support/auth";
import { apriPannelloTema, attendiAspetto, pulsanteTema, scegliTema } from "./support/tema";

/**
 * Demo scenario — Temi Chiaro, Scuro e Browser
 *
 * Con il sistema in modalità chiara: la pagina di accesso non mostra il
 * selettore; dopo il login il pulsante-icona "Tema" nell'intestazione apre il
 * menu, si sceglie "Scuro", si ricarica e si naviga; si esce e la pagina di
 * accesso resta scura; rientrati si passa a "Chiaro" e infine a "Browser",
 * che segue il cambio del sistema.
 *
 * Registra un video per la review.
 */

test.use({
	video: "on",
	viewport: { width: 1280, height: 720 },
	launchOptions: { slowMo: 300 },
});

test.describe("Temi Demo", () => {
	test("selettore discreto dopo il login → Scuro persistente; Chiaro; Browser segue il sistema", async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme: "light" });
		await page.goto("/");
		await expect(pulsanteTema(page)).toHaveCount(0);
		await attendiAspetto(page, "chiaro");

		await accediComeCollaboratore(page);
		await apriPannelloTema(page);
		await page.keyboard.press("Escape");
		await scegliTema(page, "Scuro");
		await attendiAspetto(page, "scuro");
		await page.reload();
		await attendiAspetto(page, "scuro");
		await page.goto("/attivita/riepilogo");
		await attendiAspetto(page, "scuro");

		await page.locator("[data-esci]").click();
		await page.waitForURL("**/?logout=1");
		await attendiAspetto(page, "scuro");

		await accediComeCollaboratore(page);
		await scegliTema(page, "Chiaro");
		await attendiAspetto(page, "chiaro");

		await scegliTema(page, "Browser");
		await page.emulateMedia({ colorScheme: "dark" });
		await attendiAspetto(page, "scuro");

		// Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
		await page.waitForTimeout(1500);
	});
});
