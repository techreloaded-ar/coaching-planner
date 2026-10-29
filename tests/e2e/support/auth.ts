import { expect, type Page } from "@playwright/test";
import { NOME_COOKIE_SESSIONE } from "../../../src/lib/session-config";

export const EMAIL_ADMIN_E2E = "info@techreloaded.it";
export const EMAIL_COLLABORATORE_E2E = "giulia.conti@agilereloaded.it";

/** Setup dei test di business: crea la stessa sessione del login simulato,
 * senza navigazioni alla landing non pertinenti allo scenario. Richiede un
 * BrowserContext nuovo: non va usato per cambiare identità su una pagina aperta.
 */
export async function preparaSessioneE2e(page: Page, email: string): Promise<void> {
	if ((await page.context().cookies()).some((cookie) => cookie.name === NOME_COOKIE_SESSIONE)) {
		throw new Error("preparaSessioneE2e richiede un BrowserContext nuovo");
	}
	// page.request condivide il cookie jar con il BrowserContext: Set-Cookie
	// viene applicato prima di aprire la destinazione protetta dello scenario.
	const risposta = await page.request.post("/api/e2e-test/sessione", {
		data: { email },
	});
	await expect(risposta).toBeOK();
}

export async function accediCome(page: Page, email: string): Promise<void> {
	await page.goto("/");
	await expect(page.getByRole("button", { name: "Accedi con Google" })).toBeVisible();

	const redirect = await page.evaluate(async (emailUtente) => {
		const res = await fetch("/api/e2e-test/sessione", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: emailUtente }),
		});
		const data = (await res.json()) as { redirect?: unknown; error?: unknown };

		if (!res.ok) {
			throw new Error(
				typeof data.error === "string"
					? data.error
					: `Login e2e fallito per ${emailUtente}`,
			);
		}

		if (typeof data.redirect !== "string") {
			throw new Error(`Redirect e2e mancante per ${emailUtente}`);
		}

		return data.redirect;
	}, email);

	await page.goto(redirect);
	await page.waitForURL(`**${redirect}**`);
}

export async function accediComeAdmin(
	page: Page,
	email = EMAIL_ADMIN_E2E,
): Promise<void> {
	await accediCome(page, email);
}

/**
 * Accede come amministratore e apre esplicitamente la console dalla landing
 * comune del front office. I test che verificano la landing usano
 * `accediComeAdmin` senza questo helper.
 */
export async function accediAlBackOfficeComeAdmin(
	page: Page,
	email = EMAIL_ADMIN_E2E,
): Promise<void> {
	await accediComeAdmin(page, email);
	await page
		.getByRole("link", { name: "Console amministrativa", exact: true })
		.click();
	await page.waitForURL("**/anagrafiche**");
}

export async function accediComeCollaboratore(
	page: Page,
	email = EMAIL_COLLABORATORE_E2E,
): Promise<void> {
	await accediCome(page, email);
}
