import { test, expect, type Page } from "@playwright/test";

import {
	accediAlBackOfficeComeAdmin,
	accediComeCollaboratore,
} from "./support/auth";
import { SFONDO_SCURO } from "./support/tema";

/**
 * Test e2e — US-028: logo Agile Reloaded nelle intestazioni delle aree interne.
 *
 * Scenari read-only: gli utenti seed servono solo ad accedere, nessun dato
 * applicativo viene scritto. Il logo completo (≥ 1024 px) è alto 24 px; sotto
 * 1024 px si mostra solo la mascotte (≈ 23 px di larghezza).
 */

const ALTEZZA_MASSIMA_INTESTAZIONE_FRONT_OFFICE = 84; // baseline 83 px
const ALTEZZA_MASSIMA_INTESTAZIONE_BACK_OFFICE = 58; // baseline 57 px

function logo(page: Page) {
	return page.getByRole("banner").getByRole("img", { name: "Agile Reloaded" });
}

function targa(page: Page) {
	return page.getByRole("banner").getByTestId("logo-agile-reloaded");
}

async function misuraIntestazione(page: Page) {
	return page.locator("header").first().evaluate((header) => ({
		overflow: header.scrollWidth - header.clientWidth,
		altezza: Math.round(header.getBoundingClientRect().height),
	}));
}

async function immagineCaricata(page: Page) {
	return logo(page).evaluate(
		(img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
	);
}

async function boxLogo(page: Page) {
	const box = await logo(page).boundingBox();
	expect(box).not.toBeNull();
	return box!;
}

/** Riquadro visibile del logo: nella versione compatta l'immagine è ritagliata dalla targa. */
async function boxTarga(page: Page) {
	const box = await targa(page).boundingBox();
	expect(box).not.toBeNull();
	return box!;
}

test.describe("Logo Agile Reloaded nelle intestazioni", () => {
	test("front office: logo accanto al titolo, elementi esistenti invariati", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await accediComeCollaboratore(page);

		await expect(logo(page)).toBeVisible();
		const box = await boxLogo(page);
		expect(box.height).toBeGreaterThanOrEqual(23);
		expect(box.height).toBeLessThanOrEqual(25);
		expect(box.width).toBeGreaterThan(70);
		expect(await immagineCaricata(page)).toBe(true);

		await expect(page.getByRole("heading", { name: "Le mie attività" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Tema", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Esci", exact: true })).toBeVisible();

		let misura = await misuraIntestazione(page);
		expect(misura.overflow).toBe(0);
		expect(misura.altezza).toBeLessThanOrEqual(ALTEZZA_MASSIMA_INTESTAZIONE_FRONT_OFFICE);

		await page.setViewportSize({ width: 768, height: 800 });
		await expect(logo(page)).toBeVisible();
		expect((await boxTarga(page)).width).toBeLessThanOrEqual(45);
		misura = await misuraIntestazione(page);
		expect(misura.overflow).toBe(0);
		expect(misura.altezza).toBeLessThanOrEqual(ALTEZZA_MASSIMA_INTESTAZIONE_FRONT_OFFICE);
	});

	test("back office: stesso logo, persistente dopo la navigazione", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await accediAlBackOfficeComeAdmin(page);

		await expect(logo(page)).toBeVisible();
		const box = await boxLogo(page);
		expect(box.height).toBeGreaterThanOrEqual(23);
		expect(box.height).toBeLessThanOrEqual(25);
		expect(await immagineCaricata(page)).toBe(true);
		const src = await logo(page).getAttribute("src");

		let misura = await misuraIntestazione(page);
		expect(misura.overflow).toBe(0);
		expect(misura.altezza).toBeLessThanOrEqual(ALTEZZA_MASSIMA_INTESTAZIONE_BACK_OFFICE);

		await page.getByRole("link", { name: "Offerte", exact: true }).click();
		await page.waitForURL("**/offerte");
		await expect(logo(page)).toBeVisible();
		expect(await logo(page).getAttribute("src")).toBe(src);
		expect((await boxLogo(page)).height).toBeGreaterThanOrEqual(23);

		await page.setViewportSize({ width: 768, height: 800 });
		await expect(logo(page)).toBeVisible();
		misura = await misuraIntestazione(page);
		expect(misura.overflow).toBe(0);
		expect(misura.altezza).toBeLessThanOrEqual(ALTEZZA_MASSIMA_INTESTAZIONE_BACK_OFFICE);
	});

	for (const tema of ["scuro", "chiaro"] as const) {
		test(`tema ${tema}: la targa resta bianca e il logo leggibile`, async ({ page, context, baseURL }) => {
			await context.addCookies([{ name: "tema", value: tema, url: baseURL! }]);
			await page.setViewportSize({ width: 1280, height: 800 });
			await accediComeCollaboratore(page);

			await expect(page.locator("html")).toHaveAttribute("data-tema", tema);
			if (tema === "scuro") {
				await expect(page.locator("body")).toHaveCSS("background-color", SFONDO_SCURO);
			}
			await expect(logo(page)).toBeVisible();
			await expect(targa(page)).toHaveCSS("background-color", "rgb(255, 255, 255)");
			expect(await immagineCaricata(page)).toBe(true);
		});
	}

	test("schermi piccoli: logo compatto visibile e non sovrapposto a Esci", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 800 });

		await accediComeCollaboratore(page);
		await expect(logo(page)).toBeVisible();
		expect((await boxTarga(page)).width).toBeLessThanOrEqual(32);
		expect(await immagineCaricata(page)).toBe(true);
		// Il front office a 375 px ha già un overflow orizzontale dell'intestazione
		// (≈ 110 px) indipendente dal logo: nessuna asserzione sull'overflow qui.

		await page.context().clearCookies();
		await accediAlBackOfficeComeAdmin(page);
		await expect(logo(page)).toBeVisible();
		const box = await boxTarga(page);
		expect(box.width).toBeLessThanOrEqual(32);
		expect(await immagineCaricata(page)).toBe(true);
		expect((await misuraIntestazione(page)).overflow).toBe(0);

		const esci = await page.getByRole("button", { name: "Esci", exact: true }).boundingBox();
		expect(esci).not.toBeNull();
		const sovrapposto =
			box.x < esci!.x + esci!.width && box.x + box.width > esci!.x &&
			box.y < esci!.y + esci!.height && box.y + box.height > esci!.y;
		expect(sovrapposto).toBe(false);
	});

	test("il logo è servito dall'applicazione, senza host esterni", async ({ page }) => {
		const urlImmagini: string[] = [];
		page.on("request", (richiesta) => {
			if (richiesta.resourceType() === "image") urlImmagini.push(richiesta.url());
		});

		await accediComeCollaboratore(page);
		await expect(logo(page)).toBeVisible();
		expect(await immagineCaricata(page)).toBe(true);

		const src = await logo(page).getAttribute("src");
		expect(src).not.toBeNull();
		expect(src!).not.toContain("http");
		expect(src!).not.toContain("agilereloaded");

		const risposta = await page.request.get(new URL(src!, page.url()).href);
		expect(risposta.status()).toBe(200);

		expect(urlImmagini.length).toBeGreaterThan(0);
		const host = new URL(page.url()).host;
		for (const url of urlImmagini) {
			expect(new URL(url).host).toBe(host);
		}
	});
});
