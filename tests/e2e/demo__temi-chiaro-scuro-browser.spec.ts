import { test, expect } from "@playwright/test";

import { accediComeCollaboratore } from "./support/auth";
import { apriImpostazioni, esci } from "./support/menu-account";
import { attendiAspetto, scegliTema } from "./support/tema";

/**
 * Demo scenario — Temi Chiaro, Scuro e Browser dalle Impostazioni
 *
 * Con il sistema in modalità chiara: la pagina di accesso non mostra il
 * selettore; dopo il login l'intestazione non ha più il pulsante tema, che si
 * sceglie dalle Impostazioni aperte dal menu dell'avatar. Si sceglie "Scuro",
 * si ricarica e si naviga; si esce e la pagina di accesso resta scura;
 * rientrati si passa a "Chiaro" e infine a "Browser", che segue il cambio del
 * sistema.
 *
 * Registra un video per la review.
 */

test.use({
	video: "on",
	viewport: { width: 1280, height: 720 },
	launchOptions: { slowMo: 300 },
});

test.describe("Temi Demo", () => {
	test("Impostazioni dal menu dell'avatar → Scuro persistente; Chiaro; Browser segue il sistema", async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme: "light" });
		await page.goto("/");
		await expect(page.getByTestId("selettore-tema")).toHaveCount(0);
		await attendiAspetto(page, "chiaro");

		await accediComeCollaboratore(page);
		await expect(page.getByRole("banner").getByRole("button", { name: "Tema", exact: true })).toHaveCount(0);
		await apriImpostazioni(page);
		await scegliTema(page, "Scuro");
		await attendiAspetto(page, "scuro");
		await page.reload();
		await attendiAspetto(page, "scuro");
		await page.goto("/attivita/riepilogo");
		await attendiAspetto(page, "scuro");

		await esci(page);
		await attendiAspetto(page, "scuro");

		await accediComeCollaboratore(page);
		await apriImpostazioni(page);
		await scegliTema(page, "Chiaro");
		await attendiAspetto(page, "chiaro");

		await scegliTema(page, "Browser");
		await attendiAspetto(page, "chiaro");
		await page.emulateMedia({ colorScheme: "dark" });
		await attendiAspetto(page, "scuro");

		// Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
		await page.waitForTimeout(1500);
	});
});
