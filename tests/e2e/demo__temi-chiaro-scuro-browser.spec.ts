import { test, expect } from "@playwright/test";

import { accediComeCollaboratore } from "./support/auth";
import { attendiAspetto, scegliTema } from "./support/tema";

/**
 * Demo scenario — Temi Chiaro, Scuro e Browser
 *
 * Con il sistema in modalità chiara: dalla pagina di accesso si sceglie
 * "Scuro", si ricarica, si entra come collaboratore e si naviga; poi si passa
 * a "Chiaro" e infine a "Browser", che segue il cambio del sistema.
 *
 * Registra un video per la review.
 */

test.use({
	video: "on",
	viewport: { width: 1280, height: 720 },
	launchOptions: { slowMo: 300 },
});

test.describe("Temi Demo", () => {
	test("Scuro dalla pagina di accesso → persistente dopo login; Chiaro; Browser segue il sistema", async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme: "light" });
		await page.goto("/");
		await attendiAspetto(page, "chiaro");

		await scegliTema(page, "Scuro");
		await attendiAspetto(page, "scuro");
		await page.reload();
		await attendiAspetto(page, "scuro");

		await accediComeCollaboratore(page);
		await attendiAspetto(page, "scuro");
		await page.goto("/attivita/riepilogo");
		await attendiAspetto(page, "scuro");

		await scegliTema(page, "Chiaro");
		await attendiAspetto(page, "chiaro");

		await scegliTema(page, "Browser");
		await page.emulateMedia({ colorScheme: "dark" });
		await attendiAspetto(page, "scuro");
		await expect(page.locator("html")).toHaveAttribute("data-tema", "browser");

		// Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
		await page.waitForTimeout(1500);
	});
});
