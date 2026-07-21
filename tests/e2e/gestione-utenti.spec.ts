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

function tabellaCollaboratori(page: Page) {
	return page.getByRole("table", { name: "Elenco collaboratori" });
}

function rigaCollaboratore(page: Page, email: string) {
	return tabellaCollaboratori(page)
		.getByRole("row")
		.filter({ has: page.getByText(email, { exact: true }) });
}

async function apriElencoUtenti(page: Page): Promise<void> {
	await page.getByRole("link", { name: "Utenti", exact: true }).click();
	await expect(page).toHaveURL(/\/anagrafiche\/utenti$/);
	await expect(page.getByRole("heading", { name: "Utenti" })).toBeVisible();
}

async function filtraUtenti(page: Page, valore: string): Promise<void> {
	const ricerca = page.getByRole("searchbox", { name: "Cerca utente" });

	await expect
		.poll(async () => {
			await ricerca.fill("");
			await ricerca.fill(valore);
			return tabellaUtenti(page).getByRole("row").count();
		})
		.toBe(2);
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

	test("censisce un amministratore attivo e la sua email viene riconosciuta all'accesso", async ({
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
			.getByRole("radio", { name: /^Amministratore\b/ })
			.check({ force: true });
		await expect(
			page.getByRole("radio", { name: /^Amministratore\b/ }),
		).toBeChecked();
		await page
			.getByRole("button", { name: "Censisci utente", exact: true })
			.click();

		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=creato$/);
		await expect(page.getByRole("status")).toContainText(
			"Utente censito: può accedere all'applicazione con il suo account Google",
		);
		await filtraUtenti(page, email);
		const riga = rigaUtente(page, email);
		await expect(riga).toHaveCount(1);
		await expect(riga.getByText(nome, { exact: true })).toBeVisible();
		await expect(riga.getByText(email, { exact: true })).toBeVisible();
		await expect(
			riga.getByText("Amministratore", { exact: true }),
		).toBeVisible();
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
		await expect(
			page.getByRole("radio", { name: /^Collaboratore\b/ }),
		).toBeChecked();
		await page
			.getByRole("button", { name: "Censisci utente", exact: true })
			.click();

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
		await expect(
			page.getByRole("radio", { name: /^Collaboratore\b/ }),
		).toBeChecked();

		await page.getByLabel(/^Nome\b/).fill(nuovoNome);
		await page.getByLabel(/^Email di accesso\b/).fill(nuovaEmail);
		await page
			.getByRole("button", { name: "Salva modifiche", exact: true })
			.click();

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

	test("invalida un collaboratore: elenco, profilo operativo e sessione aperta", async ({
		page,
		browser,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore({
			utenteOptions: {
				nome: `${factory.namespace} Collaboratore da invalidare`,
				email: `${factory.namespace}-da-invalidare@e2e.invalid`,
				ruolo: "COLLABORATORE",
			},
		});
		const contestoUtente = await browser.newContext();

		try {
			const paginaUtente = await contestoUtente.newPage();
			await accediCome(paginaUtente, collaboratore.utente.email);
			await expect(paginaUtente).toHaveURL(/\/attivita/);

			await apriElencoUtenti(page);
			await filtraUtenti(page, collaboratore.utente.email);
			const riga = rigaUtente(page, collaboratore.utente.email);
			await riga.getByRole("button", { name: "Invalida", exact: true }).click();

			const modale = page.getByRole("dialog", {
				name: `Invalidare «${collaboratore.utente.nome}»?`,
			});
			await expect(modale).toBeVisible();
			await modale
				.getByRole("button", { name: "Invalida utente", exact: true })
				.click();

			await expect(page).toHaveURL(
				/\/anagrafiche\/utenti\?esito=invalidato$/,
			);
			await expect(page.getByRole("status")).toContainText(
				"Utente invalidato: l'accesso è revocato e il record resta in elenco",
			);
			await expect(riga).toHaveCount(1);
			await expect(riga.getByText("Invalidato", { exact: true })).toBeVisible();

			await page.getByRole("link", { name: "Collaboratori", exact: true }).click();
			await expect(page).toHaveURL(/\/anagrafiche\/collaboratori$/);
			await page
				.getByRole("searchbox", { name: "Cerca collaboratore" })
				.fill(collaboratore.utente.email);
			const rigaProfilo = rigaCollaboratore(page, collaboratore.utente.email);
			await expect(rigaProfilo).toHaveCount(1);
			await expect(
				rigaProfilo.getByText("Disattivato", { exact: true }),
			).toBeVisible();

			await paginaUtente.goto("/attivita");
			await expect(paginaUtente).toHaveURL(/\/$/);
			await expect(
				paginaUtente.getByRole("button", { name: "Accedi con Google" }),
			).toBeVisible();
		} finally {
			await contestoUtente.close();
		}
	});

	test("riattiva un utente invalidato: accesso e profilo ripristinati", async ({
		page,
		browser,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore({
			utenteOptions: {
				nome: `${factory.namespace} Collaboratore da riattivare`,
				email: `${factory.namespace}-da-riattivare@e2e.invalid`,
				ruolo: "COLLABORATORE",
			},
		});

		await apriElencoUtenti(page);
		await filtraUtenti(page, collaboratore.utente.email);
		const riga = rigaUtente(page, collaboratore.utente.email);
		await riga.getByRole("button", { name: "Invalida", exact: true }).click();
		const modale = page.getByRole("dialog", {
			name: `Invalidare «${collaboratore.utente.nome}»?`,
		});
		await expect(modale).toBeVisible();
		await modale
			.getByRole("button", { name: "Invalida utente", exact: true })
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=invalidato$/);

		await riga.getByRole("button", { name: "Riattiva", exact: true }).click();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=riattivato$/);
		await expect(page.getByRole("status")).toContainText(
			"Utente riattivato: può accedere di nuovo all'applicazione",
		);
		await expect(riga.getByText("Attivo", { exact: true })).toBeVisible();

		await page.getByRole("link", { name: "Collaboratori", exact: true }).click();
		await expect(page).toHaveURL(/\/anagrafiche\/collaboratori$/);
		await page
			.getByRole("searchbox", { name: "Cerca collaboratore" })
			.fill(collaboratore.utente.email);
		await expect(
			rigaCollaboratore(page, collaboratore.utente.email).getByText("Attivo", {
				exact: true,
			}),
		).toBeVisible();

		const contestoUtente = await browser.newContext();
		try {
			const paginaUtente = await contestoUtente.newPage();
			await accediCome(paginaUtente, collaboratore.utente.email);
			await expect(paginaUtente).toHaveURL(/\/attivita/);
		} finally {
			await contestoUtente.close();
		}
	});

	test("promuove un collaboratore: la sessione aperta raggiunge il back office", async ({
		page,
		browser,
		factory,
	}) => {
		const utente = await factory.createUtente({
			nome: `${factory.namespace} Collaboratore da promuovere`,
			email: `${factory.namespace}-da-promuovere@e2e.invalid`,
			ruolo: "COLLABORATORE",
		});
		const contestoUtente = await browser.newContext();

		try {
			const paginaUtente = await contestoUtente.newPage();
			await accediCome(paginaUtente, utente.email);
			await expect(paginaUtente).toHaveURL(/\/attivita/);

			await apriElencoUtenti(page);
			await filtraUtenti(page, utente.email);
			await rigaUtente(page, utente.email)
				.getByRole("link", { name: "Modifica", exact: true })
				.click();
			await expect(
				page.getByRole("heading", { name: "Modifica utente" }),
			).toBeVisible();
			await page
				.getByRole("radio", { name: /^Amministratore\b/ })
				.check({ force: true });
			await page
				.getByRole("button", { name: "Salva modifiche", exact: true })
				.click();
			await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=salvato$/);
			await filtraUtenti(page, utente.email);
			await expect(
				rigaUtente(page, utente.email).getByText("Amministratore", {
					exact: true,
				}),
			).toBeVisible();

			await paginaUtente.goto("/anagrafiche");
			await expect(paginaUtente).toHaveURL(/\/anagrafiche\/clienti$/);
			await expect(
				paginaUtente.getByRole("heading", { name: "Clienti", exact: true }),
			).toBeVisible();
		} finally {
			await contestoUtente.close();
		}
	});

	test("retrocede un amministratore: la sessione aperta perde il back office", async ({
		page,
		browser,
		factory,
	}) => {
		const utente = await factory.createUtente({
			nome: `${factory.namespace} Amministratore da retrocedere`,
			email: `${factory.namespace}-da-retrocedere@e2e.invalid`,
			ruolo: "AMMINISTRATORE",
		});
		const contestoUtente = await browser.newContext();

		try {
			const paginaUtente = await contestoUtente.newPage();
			await accediCome(paginaUtente, utente.email);
			await paginaUtente.goto("/anagrafiche");
			await expect(paginaUtente).toHaveURL(/\/anagrafiche\/clienti$/);

			await apriElencoUtenti(page);
			await filtraUtenti(page, utente.email);
			await rigaUtente(page, utente.email)
				.getByRole("link", { name: "Modifica", exact: true })
				.click();
			await expect(
				page.getByRole("heading", { name: "Modifica utente" }),
			).toBeVisible();
			await page
				.getByRole("radio", { name: /^Collaboratore\b/ })
				.check({ force: true });
			await page
				.getByRole("button", { name: "Salva modifiche", exact: true })
				.click();
			await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=salvato$/);

			await paginaUtente.goto("/anagrafiche");
			await expect(paginaUtente).toHaveURL(/\/attivita/);
		} finally {
			await contestoUtente.close();
		}
	});

	test("mostra l'errore di protezione dell'ultimo amministratore", async ({
		page,
	}) => {
		// Il rifiuto reale richiederebbe di mutare l'admin del seed, vietato in e2e;
		// la logica è coperta da tests/unit/cambia-stato-utente.test.ts e
		// tests/unit/utenti-actions.test.ts.
		await page.goto("/anagrafiche/utenti?errore=ultimo-amministratore");
		await expect(page).toHaveURL(
			/\/anagrafiche\/utenti\?errore=ultimo-amministratore$/,
		);
		await expect(
			page
				.getByRole("alert")
				.filter({
					hasText:
						"Operazione non consentita: è l'ultimo amministratore attivo del sistema",
				}),
		).toContainText(
			"Operazione non consentita: è l'ultimo amministratore attivo del sistema",
		);
	});
});
