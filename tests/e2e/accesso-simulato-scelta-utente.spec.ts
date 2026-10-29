import type { Page } from "@playwright/test";

import { test, expect } from "./support/fixtures";
import { esci } from "./support/menu-account";

/**
 * Login simulato delle anteprime (E2E_TEST_MODE=true): «Accedi con Google»
 * porta alla pagina locale «Scegli l'utente» invece che a Google.
 */

function utenteNellElenco(page: Page, email: string) {
	return page.getByRole("listitem").filter({ hasText: email });
}

async function apriSceltaUtente(page: Page): Promise<void> {
	await page.goto("/");
	await page.getByRole("button", { name: "Accedi con Google" }).click();
	await page.waitForURL("**/e2e-test/scegli-utente");
	await expect(page.getByRole("heading", { name: "Scegli l'utente" })).toBeVisible();
}

test.describe("Login simulato con scelta dell'utente", () => {
	test("si entra come collaboratore, si esce e si rientra come amministratore", async ({
		page,
		factory,
	}) => {
		const { utente: collaboratrice } = await factory.createCollaboratore();
		const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });

		await apriSceltaUtente(page);
		await expect(utenteNellElenco(page, collaboratrice.email)).toContainText(
			`${collaboratrice.nome} ${collaboratrice.cognome}`,
		);
		await expect(utenteNellElenco(page, collaboratrice.email)).toContainText("Collaboratore");
		await utenteNellElenco(page, collaboratrice.email).getByRole("button").click();

		await page.waitForURL("**/attivita");
		await expect(
			page.getByRole("link", { name: "Console amministrativa", exact: true }),
		).toHaveCount(0);

		await esci(page);
		await page.waitForURL("**/?logout=1**");

		await apriSceltaUtente(page);
		await expect(utenteNellElenco(page, amministratore.email)).toContainText("Amministratore");
		await utenteNellElenco(page, amministratore.email).getByRole("button").click();

		await page.waitForURL("**/attivita");
		await page.getByRole("link", { name: "Console amministrativa", exact: true }).click();
		await page.waitForURL("**/anagrafiche**");
	});

	test("non elenca i collaboratori con profilo disattivato", async ({ page, factory }) => {
		const { utente: attivo } = await factory.createCollaboratore();
		const { utente: disattivato } = await factory.createCollaboratore({ attivo: false });

		await apriSceltaUtente(page);

		await expect(utenteNellElenco(page, attivo.email)).toBeVisible();
		await expect(utenteNellElenco(page, disattivato.email)).toHaveCount(0);
	});
});
