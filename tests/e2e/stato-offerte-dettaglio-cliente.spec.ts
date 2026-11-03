import { randomUUID } from "node:crypto";

import { accediComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import { attendiTabellaOfferteClienteIdratata } from "./support/offerte";

test.describe("Stato offerte nel dettaglio cliente", () => {
	test.beforeEach(async ({ page }) => {
		await accediComeAdmin(page);
	});

	test("attive prima delle disattivate, disattivazione con conferma e riattivazione immediata", async ({
		page,
		factory,
	}) => {
		const token = randomUUID().slice(0, 8).toUpperCase();
		const cliente = await factory.createCliente({
			ragioneSociale: `E2E Stato Offerte ${token}`,
		});
		const codiceA = `ST-${token}-A`;
		const codiceB = `ST-${token}-B`;
		const codiceD = `ST-${token}-D`;
		await factory.createOfferta({ cliente, codice: codiceA, attiva: false });
		await factory.createOfferta({ cliente, codice: codiceB });
		await factory.createOfferta({ cliente, codice: codiceD });

		await page.goto(`/anagrafiche/clienti/${cliente.id}`);
		await attendiTabellaOfferteClienteIdratata(page);

		const tabella = page.getByRole("table", { name: "Offerte del cliente" });
		const righe = tabella.locator("tbody tr");
		const titolo = page.getByRole("heading", { level: 1 });

		await expect(tabella.getByRole("columnheader", { name: "Stato" })).toBeVisible();
		await expect(righe).toHaveText([
			/Attive\s*2/,
			new RegExp(`${codiceB}.*Attiva`),
			new RegExp(`${codiceD}.*Attiva`),
			/Disattivate\s*1/,
			new RegExp(`${codiceA}.*Disattivata`),
		]);
		await expect(page.getByText("3 offerte · 2 attive · 1 disattivata")).toBeVisible();

		// Tooltip rapido al passaggio del mouse (non il title nativo).
		const pulsanteDisattivaB = tabella.getByRole("button", {
			name: `Disattiva offerta ${codiceB}`,
		});
		await pulsanteDisattivaB.hover();
		await expect(
			pulsanteDisattivaB.locator("..").getByText("Disattiva offerta", { exact: true }),
		).toHaveCSS("opacity", "1");

		// Annulla: nessun cambio e la riga non si espande.
		await pulsanteDisattivaB.click();
		const dialog = page.getByRole("dialog", { name: `Disattivare «${codiceB}»?` });
		await expect(dialog).toContainText("restano nello storico");
		await dialog.getByRole("button", { name: "Annulla" }).click();
		await expect(dialog).toBeHidden();
		await expect(
			tabella.getByRole("button", { name: `Dettaglio avanzamento ${codiceB}` }),
		).toHaveAttribute("aria-expanded", "false");

		// Disattivazione confermata: D scende tra le disattivate.
		await tabella.getByRole("button", { name: `Disattiva offerta ${codiceD}` }).click();
		await page
			.getByRole("dialog", { name: `Disattivare «${codiceD}»?` })
			.getByRole("button", { name: "Disattiva", exact: true })
			.click();
		await expect(page.getByText("Offerta disattivata", { exact: true })).toBeVisible();
		await expect(righe).toHaveText([
			/Attive\s*1/,
			new RegExp(codiceB),
			/Disattivate\s*2/,
			new RegExp(codiceA),
			new RegExp(`${codiceD}.*Disattivata`),
		]);
		await expect(page.getByText("3 offerte · 1 attiva · 2 disattivate")).toBeVisible();
		await expect(titolo).toContainText("1 attiva");

		// Riattivazione senza conferma: A torna tra le attive.
		await attendiTabellaOfferteClienteIdratata(page);
		await tabella.getByRole("button", { name: `Riattiva offerta ${codiceA}` }).click();
		await expect(page.getByText("Offerta riattivata", { exact: true })).toBeVisible();
		await expect(righe).toHaveText([
			/Attive\s*2/,
			new RegExp(`${codiceA}.*Attiva`),
			new RegExp(codiceB),
			/Disattivate\s*1/,
			new RegExp(codiceD),
		]);
		await expect(titolo).toContainText("2 attive");
	});
});
