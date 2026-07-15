import { expect, type Page } from "@playwright/test";

export const EMAIL_ADMIN_E2E = "info@techreloaded.it";
export const EMAIL_COLLABORATORE_E2E = "giulia.conti@agilereloaded.it";

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

export async function accediComeAdmin(page: Page): Promise<void> {
	await accediCome(page, EMAIL_ADMIN_E2E);
}

export async function accediComeCollaboratore(
	page: Page,
	email = EMAIL_COLLABORATORE_E2E,
): Promise<void> {
	await accediCome(page, email);
}
