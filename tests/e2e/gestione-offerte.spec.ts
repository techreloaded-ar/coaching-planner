import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";

/** Codice offerta univoco per il test, così da localizzare una singola riga. */
function codiceUnivoco(prefisso: string): string {
	return `E2E-${prefisso}-${randomUUID().slice(0, 8)}`.toUpperCase();
}

/** Va alla pagina Offerte tramite il link della sidebar principale. */
async function vaiAOfferteDallaSidebar(page: Page): Promise<void> {
	await page.getByRole("link", { name: "Offerte", exact: true }).click();
	await page.waitForURL(/\/offerte(?:\?.*)?$/);
	await expect(
		page.getByRole("heading", { name: "Offerte", level: 1 }),
	).toBeVisible();
}

/** Riga della tabella offerte che contiene il codice indicato. */
function rigaConCodice(page: Page, codice: string): Locator {
	return page
		.locator("table[aria-label='Elenco offerte'] tbody tr")
		.filter({ hasText: codice });
}

test.describe("Gestione offerte", () => {
	test.beforeEach(async ({ page }) => {
		await accediComeAdmin(page);
	});

	test("creazione di una nuova offerta selezionando il cliente per label", async ({
		page,
		factory,
	}) => {
		const cliente = await factory.createCliente({
			ragioneSociale: `E2E Gestione Cliente ${randomUUID().slice(0, 8)}`,
		});
		const codice = codiceUnivoco("CREA");

		await page.goto("/");
		await vaiAOfferteDallaSidebar(page);

		await page.getByRole("link", { name: "Nuova offerta" }).click();
		await page.waitForURL(/\/offerte\/nuova$/);

		await page
			.getByLabel("Cliente")
			.selectOption({ label: cliente.ragioneSociale });
		await page.getByLabel("Codice").fill(codice);
		await page.getByLabel("Descrizione").fill("Percorso coaching creazione");
		await page.getByLabel("Tariffa giornaliera").fill("640,00");
		await page.getByLabel("Giorni previsti").fill("12");
		await page.getByRole("button", { name: "Crea offerta" }).click();

		await page.waitForURL(/\/offerte\?esito=offerta-creata$/);
		await expect(
			page.getByText("Offerta creata correttamente"),
		).toBeVisible();

		const riga = rigaConCodice(page, codice);
		await expect(riga).toHaveCount(1);
		await expect(
			riga.getByText("Percorso coaching creazione"),
		).toBeVisible();
		await expect(riga.getByText(cliente.ragioneSociale)).toBeVisible();
	});

	test("la creazione con tariffa mancante mostra un errore inline", async ({
		page,
		factory,
	}) => {
		const cliente = await factory.createCliente({
			ragioneSociale: `E2E Gestione Cliente ${randomUUID().slice(0, 8)}`,
		});

		await page.goto("/offerte/nuova");
		await page
			.getByLabel("Cliente")
			.selectOption({ label: cliente.ragioneSociale });
		await page.getByLabel("Codice").fill(codiceUnivoco("VAL"));
		await page.getByLabel("Descrizione").fill("Offerta senza tariffa");
		await page.getByLabel("Giorni previsti").fill("8");
		await page.getByRole("button", { name: "Crea offerta" }).click();

		await expect(
			page.getByText("La tariffa giornaliera è obbligatoria"),
		).toBeVisible();
		await expect(page).toHaveURL(/\/offerte\/nuova$/);
	});

	test("modifica di descrizione e tariffa persistita nell'elenco", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("MOD");
		const offerta = await factory.createOfferta({
			codice,
			descrizione: "Descrizione iniziale",
			tariffaGiornaliera: "500.00",
		});

		await page.goto("/offerte");
		const riga = rigaConCodice(page, offerta.codice);
		await riga.getByRole("link", { name: "Modifica" }).click();
		await page.waitForURL(/\/offerte\/[^/]+$/);

		await page.getByLabel("Descrizione").fill("Descrizione aggiornata");
		await page.getByLabel("Tariffa giornaliera").fill("725,50");
		await page.getByRole("button", { name: "Salva offerta" }).click();

		await page.waitForURL(/\/offerte\?esito=offerta-salvata$/);
		await expect(page.getByText("Modifiche all'offerta salvate")).toBeVisible();

		const rigaAggiornata = rigaConCodice(page, offerta.codice);
		await expect(
			rigaAggiornata.getByText("Descrizione aggiornata"),
		).toBeVisible();
		await expect(rigaAggiornata.getByText(/725,50\s*€/)).toBeVisible();

		await page.reload();
		const rigaDopoReload = rigaConCodice(page, offerta.codice);
		await expect(
			rigaDopoReload.getByText("Descrizione aggiornata"),
		).toBeVisible();
		await expect(rigaDopoReload.getByText(/725,50\s*€/)).toBeVisible();
	});

	test("toggle stato: disattivazione e riattivazione dal pulsante di riga", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("TOGGLE");
		const offerta = await factory.createOfferta({ codice, attiva: true });

		await page.goto("/offerte");
		const riga = rigaConCodice(page, offerta.codice);
		await expect(riga.getByText("Attiva", { exact: true })).toBeVisible();

		await riga.getByRole("button", { name: "Disattiva" }).click();
		await page.waitForURL(/\/offerte\?esito=stato-offerta-aggiornato$/);

		const rigaDisattivata = rigaConCodice(page, offerta.codice);
		await expect(
			rigaDisattivata.getByText("Non attiva", { exact: true }),
		).toBeVisible();

		await rigaDisattivata.getByRole("button", { name: "Attiva" }).click();
		await page.waitForURL(/\/offerte\?esito=stato-offerta-aggiornato$/);

		const rigaRiattivata = rigaConCodice(page, offerta.codice);
		await expect(
			rigaRiattivata.getByText("Attiva", { exact: true }),
		).toBeVisible();
		await expect(
			rigaRiattivata.getByText("Non attiva", { exact: true }),
		).toHaveCount(0);
	});

	test("eliminazione riuscita di un'offerta senza attività collegate", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("DEL");
		const offerta = await factory.createOfferta({ codice });

		await page.goto("/offerte");
		const riga = rigaConCodice(page, offerta.codice);
		await expect(riga).toHaveCount(1);
		await riga.getByRole("button", { name: "Elimina", exact: true }).click();

		const modale = page.getByTestId("modale-elimina-offerta");
		await expect(
			modale.getByRole("heading", { name: "Elimina questa offerta?" }),
		).toBeVisible();
		await modale.getByRole("button", { name: "Elimina offerta" }).click();

		await page.waitForURL(/\/offerte\?esito=offerta-eliminata$/);
		await expect(page.getByText("Offerta eliminata")).toBeVisible();
		await expect(rigaConCodice(page, offerta.codice)).toHaveCount(0);
	});

	test("eliminazione bloccata quando l'offerta ha attività collegate", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco("BLOCK");
		const offerta = await factory.createOfferta({ codice });
		await factory.createRigaAttivita({ offerta });

		await page.goto("/offerte");
		const riga = rigaConCodice(page, offerta.codice);
		await expect(riga).toHaveCount(1);
		await riga.getByRole("button", { name: "Elimina", exact: true }).click();

		const modale = page.getByTestId("modale-elimina-offerta");
		await expect(
			modale.getByRole("heading", {
				name: "Non è possibile eliminare l'offerta",
			}),
		).toBeVisible();
		await expect(
			modale.getByRole("button", { name: "Disattiva offerta" }),
		).toBeVisible();
		await expect(modale.getByText(/disattivala/)).toBeVisible();

		await modale.getByRole("button", { name: "Chiudi" }).click();
		await expect(rigaConCodice(page, offerta.codice)).toHaveCount(1);
	});
});
