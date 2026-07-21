import type { Page } from "@playwright/test";

import {
	accediAlBackOfficeComeAdmin,
	accediCome,
} from "./support/auth";
import { test, expect } from "./support/fixtures";

function tabellaUtenti(page: Page) {
	return page.getByRole("table", { name: "Elenco utenti" });
}

function rigaUtente(page: Page, email: string) {
	return tabellaUtenti(page)
		.getByRole("row")
		.filter({ has: page.getByText(email, { exact: true }) });
}

async function apriElencoUtenti(page: Page): Promise<void> {
	await page.getByRole("link", { name: "Utenti", exact: true }).click();
	await expect(page).toHaveURL(/\/anagrafiche\/utenti$/);
	await expect(page.getByRole("heading", { name: "Utenti" })).toBeVisible();
}

async function filtraUtenti(page: Page, valore: string): Promise<void> {
	await page.getByRole("searchbox", { name: "Cerca utente" }).fill(valore);
}

test.describe("Gestione utenti", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("elenca gli utenti censiti con ruolo, stato e profilo collaboratore", async ({
		page,
		factory,
	}) => {
		const utente = await factory.createUtente({
			nome: `${factory.namespace} Utente elenco`,
			email: `${factory.namespace}-elenco@e2e.invalid`,
			ruolo: "COLLABORATORE",
		});
		const collaboratoreDisattivato = await factory.createCollaboratore({
			attivo: false,
			utenteOptions: {
				nome: `${factory.namespace} Profilo disattivato`,
				email: `${factory.namespace}-profilo-disattivato@e2e.invalid`,
				ruolo: "COLLABORATORE",
			},
		});

		await apriElencoUtenti(page);

		await filtraUtenti(page, utente.nome);
		const riga = rigaUtente(page, utente.email);
		await expect(riga).toHaveCount(1);
		await expect(riga.getByText(utente.nome, { exact: true })).toBeVisible();
		await expect(riga.getByText(utente.email, { exact: true })).toBeVisible();
		await expect(
			riga.getByText("Collaboratore", { exact: true }),
		).toBeVisible();
		await expect(riga.getByText("Attivo", { exact: true })).toBeVisible();

		await filtraUtenti(page, collaboratoreDisattivato.utente.email);
		const rigaProfiloDisattivato = rigaUtente(
			page,
			collaboratoreDisattivato.utente.email,
		);
		await expect(rigaProfiloDisattivato).toHaveCount(1);
		await expect(
			rigaProfiloDisattivato.getByText(
				"Profilo collaboratore disattivato",
				{ exact: true },
			),
		).toBeVisible();
	});

	test("censisce un utente attivo e la sua email viene riconosciuta all'accesso", async ({
		page,
		browser,
		factory,
	}) => {
		const nome = `${factory.namespace} Nuovo utente`;
		const email = `${factory.namespace}-censito@e2e.invalid`;

		await apriElencoUtenti(page);
		await page
			.getByRole("link", { name: "Nuovo utente", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Nuovo utente" }),
		).toBeVisible();

		await page.getByLabel(/^Nome\b/).fill(nome);
		await page.getByLabel(/^Email di accesso\b/).fill(email);
		await page
			.getByLabel(/^Ruolo\b/)
			.selectOption({ label: "Collaboratore" });
		await page.getByRole("button", { name: "Salva", exact: true }).click();

		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=creato$/);
		await expect(page.getByRole("status")).toContainText(
			"Utente censito: può accedere all'applicazione con il suo account Google",
		);
		await filtraUtenti(page, email);
		const riga = rigaUtente(page, email);
		await expect(riga).toHaveCount(1);
		await expect(riga.getByText(nome, { exact: true })).toBeVisible();
		await expect(riga.getByText(email, { exact: true })).toBeVisible();
		await expect(riga.getByText("Attivo", { exact: true })).toBeVisible();

		const contestoAccesso = await browser.newContext();
		try {
			const paginaAccesso = await contestoAccesso.newPage();
			await accediCome(paginaAccesso, email);
			await expect(paginaAccesso).toHaveURL(/\/attivita/);
		} finally {
			await contestoAccesso.close();
		}
	});

	test("rifiuta un'email duplicata e lascia una sola riga in elenco", async ({
		page,
		factory,
	}) => {
		const utenteEsistente = await factory.createUtente({
			nome: `${factory.namespace} Utente esistente`,
			email: `${factory.namespace}-duplicato@e2e.invalid`,
			ruolo: "COLLABORATORE",
		});

		await apriElencoUtenti(page);
		await page
			.getByRole("link", { name: "Nuovo utente", exact: true })
			.click();
		await page
			.getByLabel(/^Nome\b/)
			.fill(`${factory.namespace} Tentativo duplicato`);
		await page
			.getByLabel(/^Email di accesso\b/)
			.fill(utenteEsistente.email);
		await page
			.getByLabel(/^Ruolo\b/)
			.selectOption({ label: "Collaboratore" });
		await page.getByRole("button", { name: "Salva", exact: true }).click();

		await expect(
			page.getByText("Esiste già un utente con questa email", { exact: true }),
		).toBeVisible();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\/nuovo$/);

		await page
			.getByRole("link", {
				name: "Torna all'elenco utenti",
				exact: true,
			})
			.click();
		await filtraUtenti(page, utenteEsistente.email);
		await expect(rigaUtente(page, utenteEsistente.email)).toHaveCount(1);
	});

	test("salva nome ed email modificati e li mostra nell'elenco", async ({
		page,
		factory,
	}) => {
		const utente = await factory.createUtente({
			nome: `${factory.namespace} Utente da modificare`,
			email: `${factory.namespace}-da-modificare@e2e.invalid`,
			ruolo: "COLLABORATORE",
		});
		const nuovoNome = `${factory.namespace} Utente modificato`;
		const nuovaEmail = `${factory.namespace}-modificato@e2e.invalid`;

		await apriElencoUtenti(page);
		await filtraUtenti(page, utente.email);
		await rigaUtente(page, utente.email)
			.getByRole("link", { name: "Modifica", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Modifica utente" }),
		).toBeVisible();

		await page.getByLabel(/^Nome\b/).fill(nuovoNome);
		await page.getByLabel(/^Email di accesso\b/).fill(nuovaEmail);
		await page.getByRole("button", { name: "Salva", exact: true }).click();

		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=salvato$/);
		await expect(page.getByRole("status")).toContainText(
			"Modifiche all'utente salvate",
		);
		await filtraUtenti(page, nuovaEmail);
		const rigaModificata = rigaUtente(page, nuovaEmail);
		await expect(rigaModificata).toHaveCount(1);
		await expect(
			rigaModificata.getByText(nuovoNome, { exact: true }),
		).toBeVisible();
		await expect(
			rigaModificata.getByText(nuovaEmail, { exact: true }),
		).toBeVisible();
	});
});
