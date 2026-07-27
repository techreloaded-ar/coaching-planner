import type { Page } from "@playwright/test";

import {
	accediAlBackOfficeComeAdmin,
	accediCome,
} from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
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

/**
 * Commuta un checkbox di ruolo con un click reale sulla card (l'etichetta
 * visibile), perché il checkbox è `sr-only`. Il checkbox è non controllato:
 * un click nativo ne aggiorna subito lo stato DOM anche prima che React abbia
 * idratato il form, ma il suo `onChange` (che per Collaboratore pilota la
 * comparsa/scomparsa della sezione profilo) è attivo solo dopo l'idratazione.
 * Un click "perso" prima dell'idratazione lascia quindi checkbox e sezione
 * profilo disallineati fra loro: finché non sono di nuovo coerenti l'uno con
 * l'altra continuiamo a cliccare, con `expect.poll` (nessun hard wait), invece
 * di ispezionare un dettaglio interno di React come `__reactFiber$`. Una volta
 * idratato, ogni click sincronizza subito i due, quindi il ciclo converge.
 */
async function impostaRuolo(
	page: Page,
	etichetta: "Amministratore" | "Collaboratore",
	selezionato: boolean,
): Promise<void> {
	const gruppoRuolo = page.getByRole("group", { name: /^Ruolo/ });
	const card = gruppoRuolo.getByText(etichetta, { exact: true });
	const checkbox = gruppoRuolo.getByRole("checkbox", {
		name: new RegExp(`^${etichetta}\\b`),
	});
	const sezioneProfilo = page.getByLabel(/^Cognome\b/);

	async function ruoloImpostatoCorrettamente(): Promise<boolean> {
		const checkboxOk = (await checkbox.isChecked()) === selezionato;
		if (etichetta !== "Collaboratore") {
			return checkboxOk;
		}
		return checkboxOk && (await sezioneProfilo.isVisible()) === selezionato;
	}

	await expect
		.poll(async () => {
			if (await ruoloImpostatoCorrettamente()) {
				return true;
			}
			await card.click();
			return ruoloImpostatoCorrettamente();
		})
		.toBe(true);
}

/**
 * Commuta un checkbox di ruolo guardando solo lo stato del checkbox, non la
 * sezione "Profilo collaboratore": serve sugli utenti che hanno già un profilo
 * collaboratore (attivo o disattivato), dove la sezione non compare mai e quindi
 * `impostaRuolo` — che l'attende — non converge. Come `impostaRuolo`, clicca la
 * card visibile (il checkbox è `sr-only`) con `expect.poll` per assorbire i
 * click "persi" prima dell'idratazione, senza hard wait.
 */
async function commutaRuolo(
	page: Page,
	etichetta: "Amministratore" | "Collaboratore",
	selezionato: boolean,
): Promise<void> {
	const gruppoRuolo = page.getByRole("group", { name: /^Ruolo/ });
	const card = gruppoRuolo.getByText(etichetta, { exact: true });
	const checkbox = gruppoRuolo.getByRole("checkbox", {
		name: new RegExp(`^${etichetta}\\b`),
	});

	await expect
		.poll(async () => {
			if ((await checkbox.isChecked()) === selezionato) {
				return true;
			}
			await card.click();
			return (await checkbox.isChecked()) === selezionato;
		})
		.toBe(true);
}

async function apriElencoCollaboratori(
	page: Page,
	email: string,
): Promise<void> {
	await page.goto("/anagrafiche/collaboratori");
	await expect(
		page.getByRole("heading", { name: "Collaboratori", exact: true }),
	).toBeVisible();
	await page
		.getByRole("searchbox", { name: "Cerca collaboratore" })
		.fill(email);
	await expect(rigaCollaboratore(page, email)).toHaveCount(1);
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
		await impostaRuolo(page, "Amministratore", true);
		await impostaRuolo(page, "Collaboratore", false);
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
			page.getByRole("checkbox", { name: /^Collaboratore\b/ }),
		).toBeChecked();
		await page.getByLabel(/^Cognome\b/).fill("Duplicato");
		await page.getByLabel(/^Partita IVA\b/).fill("01234567890");
		await page.getByLabel(/^Tariffa giornaliera\b/).fill("400");
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

	test("censisce un utente con entrambi i ruoli e profilo collaboratore immediato", async ({
		page,
		browser,
		factory,
	}) => {
		const nome = `${factory.namespace} Combinato`;
		const cognome = "Rossi";
		const email = `${factory.namespace}-combinato@e2e.invalid`;

		await apriElencoUtenti(page);
		await page
			.getByRole("link", { name: "Nuovo utente", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Nuovo utente" }),
		).toBeVisible();

		// AC-3: i campi del profilo compaiono e scompaiono col checkbox Collaboratore.
		await impostaRuolo(page, "Collaboratore", false);
		await expect(page.getByLabel(/^Cognome\b/)).toHaveCount(0);
		await expect(page.getByLabel(/^Partita IVA\b/)).toHaveCount(0);
		await expect(page.getByLabel(/^Tariffa giornaliera\b/)).toHaveCount(0);
		await impostaRuolo(page, "Collaboratore", true);
		await expect(page.getByLabel(/^Cognome\b/)).toBeVisible();
		await expect(page.getByLabel(/^Partita IVA\b/)).toBeVisible();
		await expect(page.getByLabel(/^Tariffa giornaliera\b/)).toBeVisible();

		// AC-7: entrambi i ruoli selezionati contemporaneamente.
		await impostaRuolo(page, "Amministratore", true);
		await page.getByLabel(/^Nome\b/).fill(nome);
		await page.getByLabel(/^Email di accesso\b/).fill(email);
		await page.getByLabel(/^Cognome\b/).fill(cognome);
		await page.getByLabel(/^Partita IVA\b/).fill("01234567890");
		await page.getByLabel(/^Tariffa giornaliera\b/).fill("450");
		await page
			.getByRole("button", { name: "Censisci utente", exact: true })
			.click();

		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=creato$/);

		// AC-1, AC-7: la riga utente mostra entrambi i badge di ruolo.
		await filtraUtenti(page, email);
		const riga = rigaUtente(page, email);
		await expect(riga).toHaveCount(1);
		await expect(
			riga.getByText("Amministratore", { exact: true }),
		).toBeVisible();
		await expect(
			riga.getByText("Collaboratore", { exact: true }),
		).toBeVisible();

		// AC-4: il profilo collaboratore è disponibile subito nell'anagrafica dedicata.
		await page
			.getByRole("link", { name: "Collaboratori", exact: true })
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/collaboratori$/);
		await page
			.getByRole("searchbox", { name: "Cerca collaboratore" })
			.fill(email);
		const rigaProfilo = rigaCollaboratore(page, email);
		await expect(rigaProfilo).toHaveCount(1);
		await expect(
			rigaProfilo.getByText(`${nome} ${cognome}`, { exact: true }),
		).toBeVisible();
		await expect(
			rigaProfilo.getByText("01234567890", { exact: true }),
		).toBeVisible();

		// AC-5: al primo accesso il nuovo utente raggiunge il calendario attività.
		const contestoAccesso = await browser.newContext();
		try {
			const paginaAccesso = await contestoAccesso.newPage();
			await accediCome(paginaAccesso, email);
			await expect(
				paginaAccesso.getByRole("heading", { name: "Attività" }),
			).toBeVisible();
			await expect(
				paginaAccesso.getByText("Attività non disponibili"),
			).toHaveCount(0);
		} finally {
			await contestoAccesso.close();
		}
	});

	test("censisce un utente solo amministratore senza profilo collaboratore", async ({
		page,
		factory,
	}) => {
		const nome = `${factory.namespace} Solo admin`;
		const email = `${factory.namespace}-solo-admin@e2e.invalid`;

		await apriElencoUtenti(page);
		await page
			.getByRole("link", { name: "Nuovo utente", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Nuovo utente" }),
		).toBeVisible();

		await impostaRuolo(page, "Collaboratore", false);
		await impostaRuolo(page, "Amministratore", true);
		await expect(page.getByLabel(/^Cognome\b/)).toHaveCount(0);
		await expect(page.getByLabel(/^Partita IVA\b/)).toHaveCount(0);
		await expect(page.getByLabel(/^Tariffa giornaliera\b/)).toHaveCount(0);

		await page.getByLabel(/^Nome\b/).fill(nome);
		await page.getByLabel(/^Email di accesso\b/).fill(email);
		await page
			.getByRole("button", { name: "Censisci utente", exact: true })
			.click();

		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=creato$/);

		// AC-1: solo il badge Amministratore, nessun badge Collaboratore.
		await filtraUtenti(page, email);
		const riga = rigaUtente(page, email);
		await expect(riga).toHaveCount(1);
		await expect(
			riga.getByText("Amministratore", { exact: true }),
		).toBeVisible();
		await expect(riga.getByText("Collaboratore", { exact: true })).toHaveCount(
			0,
		);

		// AC-4 negativo: nessun profilo collaboratore per questa email.
		await page
			.getByRole("link", { name: "Collaboratori", exact: true })
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/collaboratori$/);
		await page
			.getByRole("searchbox", { name: "Cerca collaboratore" })
			.fill(email);
		await expect(rigaCollaboratore(page, email)).toHaveCount(0);
	});

	test("rifiuta il salvataggio senza alcun ruolo selezionato", async ({
		page,
		factory,
	}) => {
		const email = `${factory.namespace}-senza-ruolo@e2e.invalid`;

		await apriElencoUtenti(page);
		await page
			.getByRole("link", { name: "Nuovo utente", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Nuovo utente" }),
		).toBeVisible();

		await page.getByLabel(/^Nome\b/).fill(`${factory.namespace} Senza ruolo`);
		await page.getByLabel(/^Email di accesso\b/).fill(email);
		await impostaRuolo(page, "Collaboratore", false);
		await impostaRuolo(page, "Amministratore", false);
		await page
			.getByRole("button", { name: "Censisci utente", exact: true })
			.click();

		// AC-2: errore esplicito e permanenza sulla pagina di censimento.
		await expect(
			page.getByText("Seleziona almeno un ruolo", { exact: true }),
		).toBeVisible();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\/nuovo$/);
	});

	test("rifiuta una partita IVA non valida senza creare l'utente", async ({
		page,
		factory,
	}) => {
		const email = `${factory.namespace}-piva-invalida@e2e.invalid`;

		await apriElencoUtenti(page);
		await page
			.getByRole("link", { name: "Nuovo utente", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Nuovo utente" }),
		).toBeVisible();

		await expect(
			page.getByRole("checkbox", { name: /^Collaboratore\b/ }),
		).toBeChecked();
		await page.getByLabel(/^Nome\b/).fill(`${factory.namespace} PIVA corta`);
		await page.getByLabel(/^Email di accesso\b/).fill(email);
		await page.getByLabel(/^Cognome\b/).fill("Verdi");
		await page.getByLabel(/^Partita IVA\b/).fill("123");
		await page.getByLabel(/^Tariffa giornaliera\b/).fill("300");
		await page
			.getByRole("button", { name: "Censisci utente", exact: true })
			.click();

		// AC-6: la validazione blocca il salvataggio con messaggio esplicito.
		await expect(
			page.getByText("La partita IVA deve essere di 11 cifre", {
				exact: true,
			}),
		).toBeVisible();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\/nuovo$/);

		// AC-6: nessun utente creato con quella email.
		await page
			.getByRole("link", {
				name: "Torna all'elenco utenti",
				exact: true,
			})
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti$/);
		await page.getByRole("searchbox", { name: "Cerca utente" }).fill(email);
		await expect(rigaUtente(page, email)).toHaveCount(0);
	});

	test("salva nome ed email modificati e li mostra nell'elenco", async ({
		page,
		factory,
	}) => {
		const { utente } = await factory.createCollaboratore({
			utenteOptions: {
				nome: `${factory.namespace} Utente da modificare`,
				email: `${factory.namespace}-da-modificare@e2e.invalid`,
				ruolo: "COLLABORATORE",
			},
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
			page.getByRole("checkbox", { name: /^Collaboratore\b/ }),
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
		const { utente } = await factory.createCollaboratore({
			utenteOptions: {
				nome: `${factory.namespace} Collaboratore da promuovere`,
				email: `${factory.namespace}-da-promuovere@e2e.invalid`,
				ruolo: "COLLABORATORE",
			},
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
			// Promozione: aggiunge Amministratore lasciando Collaboratore invariato.
			await impostaRuolo(page, "Amministratore", true);
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
		const { utente } = await factory.createCollaboratore({
			utenteOptions: {
				nome: `${factory.namespace} Amministratore da retrocedere`,
				email: `${factory.namespace}-da-retrocedere@e2e.invalid`,
				ruolo: "AMMINISTRATORE",
			},
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
			// Retrocessione: l'utente ha già il profilo, quindi Collaboratore è
			// selezionato e basta deselezionare Amministratore.
			await expect(
				page.getByRole("checkbox", { name: /^Collaboratore\b/ }),
			).toBeChecked();
			await impostaRuolo(page, "Amministratore", false);
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

	test("demo__invalida-riattiva-e-promuove-un-collaboratore", async ({
		page,
		browser,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore({
			utenteOptions: {
				nome: `${factory.namespace} Collaboratore demo`,
				email: `${factory.namespace}-demo@e2e.invalid`,
				ruolo: "COLLABORATORE",
			},
		});
		const contestoUtente = await browser.newContext();

		try {
			const paginaUtente = await contestoUtente.newPage();
			await accediCome(paginaUtente, collaboratore.utente.email);
			await expect(paginaUtente.getByRole("heading", { name: "Attività" })).toBeVisible();

			await apriElencoUtenti(page);
			await filtraUtenti(page, collaboratore.utente.email);
			const riga = rigaUtente(page, collaboratore.utente.email);
			await expect(riga).toBeVisible();
			await riga.getByRole("button", { name: "Invalida", exact: true }).click();
			const modale = page.getByRole("dialog", {
				name: `Invalidare «${collaboratore.utente.nome}»?`,
			});
			await expect(modale).toBeVisible();
			await modale
				.getByRole("button", { name: "Invalida utente", exact: true })
				.click();
			await expect(page.getByRole("status")).toContainText(
				"Utente invalidato: l'accesso è revocato e il record resta in elenco",
			);
			await expect(riga.getByText("Invalidato", { exact: true })).toBeVisible();

			await page.getByRole("link", { name: "Collaboratori", exact: true }).click();
			await expect(page.getByRole("heading", { name: "Collaboratori" })).toBeVisible();
			await page
				.getByRole("searchbox", { name: "Cerca collaboratore" })
				.fill(collaboratore.utente.email);
			await expect(
				rigaCollaboratore(page, collaboratore.utente.email).getByText(
					"Disattivato",
					{ exact: true },
				),
			).toBeVisible();

			await paginaUtente.goto("/attivita");
			await expect(
				paginaUtente.getByRole("button", { name: "Accedi con Google" }),
			).toBeVisible();

			await apriElencoUtenti(page);
			await filtraUtenti(page, collaboratore.utente.email);
			await riga
				.getByRole("button", { name: "Riattiva", exact: true })
				.click();
			await expect(page.getByRole("status")).toContainText(
				"Utente riattivato: può accedere di nuovo all'applicazione",
			);
			await expect(riga.getByText("Attivo", { exact: true })).toBeVisible();

			await riga.getByRole("link", { name: "Modifica", exact: true }).click();
			await expect(
				page.getByRole("heading", { name: "Modifica utente" }),
			).toBeVisible();
			await impostaRuolo(page, "Amministratore", true);
			await expect(
				page.getByRole("checkbox", { name: /^Amministratore\b/ }),
			).toBeChecked();
			await page
				.getByRole("button", { name: "Salva modifiche", exact: true })
				.click();
			await expect(page.getByRole("status")).toContainText(
				"Modifiche all'utente salvate",
			);

			const contestoPromosso = await browser.newContext();
			try {
				const paginaPromosso = await contestoPromosso.newPage();
				await accediCome(paginaPromosso, collaboratore.utente.email);
				await paginaPromosso.goto("/anagrafiche");
				await expect(
					paginaPromosso.getByRole("heading", { name: "Clienti", exact: true }),
				).toBeVisible();
			} finally {
				await contestoPromosso.close();
			}
		} finally {
			await contestoUtente.close();
		}
	});

	test("demo__censimento-ruoli-combinati", async ({
		page,
		browser,
		factory,
	}) => {
		const nome = `${factory.namespace} Demo combinato`;
		const cognome = "Bianchi";
		const email = `${factory.namespace}-demo-combinato@e2e.invalid`;

		// 1. Censimento con entrambi i ruoli e comparsa dei campi profilo.
		await apriElencoUtenti(page);
		await page
			.getByRole("link", { name: "Nuovo utente", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Nuovo utente" }),
		).toBeVisible();

		await impostaRuolo(page, "Collaboratore", false);
		await expect(page.getByLabel(/^Cognome\b/)).toHaveCount(0);
		await impostaRuolo(page, "Collaboratore", true);
		await expect(page.getByLabel(/^Cognome\b/)).toBeVisible();

		await impostaRuolo(page, "Amministratore", true);
		await page.getByLabel(/^Nome\b/).fill(nome);
		await page.getByLabel(/^Email di accesso\b/).fill(email);
		await page.getByLabel(/^Cognome\b/).fill(cognome);
		await page.getByLabel(/^Partita IVA\b/).fill("01234567890");
		await page.getByLabel(/^Tariffa giornaliera\b/).fill("500");
		await page
			.getByRole("button", { name: "Censisci utente", exact: true })
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=creato$/);

		// 2. Verifica nei due elenchi.
		await filtraUtenti(page, email);
		const riga = rigaUtente(page, email);
		await expect(
			riga.getByText("Amministratore", { exact: true }),
		).toBeVisible();
		await expect(
			riga.getByText("Collaboratore", { exact: true }),
		).toBeVisible();

		await page
			.getByRole("link", { name: "Collaboratori", exact: true })
			.click();
		await page
			.getByRole("searchbox", { name: "Cerca collaboratore" })
			.fill(email);
		await expect(
			rigaCollaboratore(page, email).getByText(`${nome} ${cognome}`, {
				exact: true,
			}),
		).toBeVisible();

		// 3. Primo accesso del nuovo utente al calendario.
		const contestoAccesso = await browser.newContext();
		try {
			const paginaAccesso = await contestoAccesso.newPage();
			await accediCome(paginaAccesso, email);
			await expect(
				paginaAccesso.getByRole("heading", { name: "Attività" }),
			).toBeVisible();
		} finally {
			await contestoAccesso.close();
		}

		// 4. Censimento solo amministratore, senza campi profilo.
		const emailSoloAdmin = `${factory.namespace}-demo-solo-admin@e2e.invalid`;
		await apriElencoUtenti(page);
		await page
			.getByRole("link", { name: "Nuovo utente", exact: true })
			.click();
		await impostaRuolo(page, "Collaboratore", false);
		await impostaRuolo(page, "Amministratore", true);
		await expect(page.getByLabel(/^Cognome\b/)).toHaveCount(0);
		await page
			.getByLabel(/^Nome\b/)
			.fill(`${factory.namespace} Demo solo admin`);
		await page.getByLabel(/^Email di accesso\b/).fill(emailSoloAdmin);
		await page
			.getByRole("button", { name: "Censisci utente", exact: true })
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=creato$/);
		await filtraUtenti(page, emailSoloAdmin);
		await expect(
			rigaUtente(page, emailSoloAdmin).getByText("Collaboratore", {
				exact: true,
			}),
		).toHaveCount(0);

		// 5. Tentativo con partita IVA vuota rifiutato sul campo.
		const emailPivaVuota = `${factory.namespace}-demo-piva-vuota@e2e.invalid`;
		await page
			.getByRole("link", { name: "Nuovo utente", exact: true })
			.click();
		await page.getByLabel(/^Nome\b/).fill(`${factory.namespace} Demo PIVA vuota`);
		await page.getByLabel(/^Email di accesso\b/).fill(emailPivaVuota);
		await page.getByLabel(/^Cognome\b/).fill("Neri");
		await page.getByLabel(/^Tariffa giornaliera\b/).fill("400");
		await page
			.getByRole("button", { name: "Censisci utente", exact: true })
			.click();
		await expect(
			page.getByText("La partita IVA è obbligatoria", { exact: true }),
		).toBeVisible();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\/nuovo$/);
	});

	test("aggiunge il ruolo Collaboratore a un amministratore: campi obbligatori e profilo attivo", async ({
		page,
		factory,
	}) => {
		const nome = `${factory.namespace} Da promuovere a collaboratore`;
		const cognome = "Ferrari";
		const partitaIva = "02233445566";
		const utente = await factory.createUtente({
			nome,
			email: `${factory.namespace}-aggiunge-collaboratore@e2e.invalid`,
			ruolo: "AMMINISTRATORE",
		});

		await apriElencoUtenti(page);
		await filtraUtenti(page, utente.email);
		await rigaUtente(page, utente.email)
			.getByRole("link", { name: "Modifica", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Modifica utente" }),
		).toBeVisible();

		// AC-1: l'aggiunta del ruolo Collaboratore fa comparire la sezione profilo.
		await impostaRuolo(page, "Collaboratore", true);
		await expect(page.getByLabel(/^Cognome\b/)).toBeVisible();

		// AC-1: senza dati profilo il salvataggio è rifiutato con i tre obblighi.
		await page
			.getByRole("button", { name: "Salva modifiche", exact: true })
			.click();
		await expect(
			page.getByText("Il cognome è obbligatorio", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("La partita IVA è obbligatoria", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("La tariffa giornaliera è obbligatoria", {
				exact: true,
			}),
		).toBeVisible();

		// AC-1: compilati i campi, il salvataggio crea il profilo collaboratore.
		// Il submit fallito resetta i campi non controllati del form (React 19),
		// deselezionando il checkbox Collaboratore: va riportato a selezionato.
		await impostaRuolo(page, "Collaboratore", true);
		await page.getByLabel(/^Cognome\b/).fill(cognome);
		await page.getByLabel(/^Partita IVA\b/).fill(partitaIva);
		await page.getByLabel(/^Tariffa giornaliera\b/).fill("420");
		await page
			.getByRole("button", { name: "Salva modifiche", exact: true })
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=salvato$/);

		// AC-1: il nuovo profilo è presente e attivo in anagrafica collaboratori.
		await apriElencoCollaboratori(page, utente.email);
		const rigaProfilo = rigaCollaboratore(page, utente.email);
		await expect(
			rigaProfilo.getByText(partitaIva, { exact: true }),
		).toBeVisible();
		await expect(
			rigaProfilo.getByText("Attivo", { exact: true }),
		).toBeVisible();
	});

	test("rimuove e ri-aggiunge il ruolo Collaboratore: disattivazione, storico e riattivazione senza nuovi dati", async ({
		page,
		browser,
		factory,
	}) => {
		const partitaIva = "03344556677";
		const { cliente, offerta } = await factory.createClienteConOfferta();
		const collaboratore = await factory.createCollaboratore({
			partitaIva,
			tariffaGiornaliera: "480.00",
			utenteOptions: {
				nome: `${factory.namespace} Collaboratore con attività`,
				email: `${factory.namespace}-rimuove-collaboratore@e2e.invalid`,
				ruolo: "COLLABORATORE",
			},
		});
		const email = collaboratore.utente.email;
		const nomeCompleto = `${collaboratore.collaboratore.nome} ${collaboratore.collaboratore.cognome}`;
		const nota = `Attività storica ${factory.namespace}`;
		await factory.createRigaAttivita({
			collaboratore,
			cliente,
			offerta,
			data: new Date(`${dataNelMese(meseRiservato("US-046"), 12)}T00:00:00.000Z`),
			ore: "8",
			nota,
			fatturabile: true,
		});

		// AC-3: rimozione del ruolo Collaboratore lasciando l'accesso Amministratore.
		await apriElencoUtenti(page);
		await filtraUtenti(page, email);
		await rigaUtente(page, email)
			.getByRole("link", { name: "Modifica", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Modifica utente" }),
		).toBeVisible();
		await expect(
			page.getByRole("checkbox", { name: /^Collaboratore\b/ }),
		).toBeChecked();
		// Profilo già presente: si agisce sul checkbox, la sezione non compare mai.
		await commutaRuolo(page, "Collaboratore", false);
		await commutaRuolo(page, "Amministratore", true);
		await page
			.getByRole("button", { name: "Salva modifiche", exact: true })
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=salvato$/);

		// AC-3: il profilo risulta disattivato nell'anagrafica collaboratori.
		await apriElencoCollaboratori(page, email);
		await expect(
			rigaCollaboratore(page, email).getByText("Disattivato", {
				exact: true,
			}),
		).toBeVisible();

		// AC-3: lo storico attività resta consultabile dal dettaglio collaboratore.
		await page.goto(
			`/anagrafiche/collaboratori/${collaboratore.collaboratore.id}`,
		);
		await expect(
			page.getByRole("heading", { name: nomeCompleto }),
		).toBeVisible();
		await expect(
			page.getByRole("table", { name: /^Attività di / }),
		).toHaveCount(1);
		await expect(page.getByText(nota)).toBeVisible();

		// AC-4: al login il collaboratore vede il profilo disattivato e nessuna
		// interfaccia di registrazione ore.
		const contestoUtente = await browser.newContext();
		try {
			const paginaUtente = await contestoUtente.newPage();
			await accediCome(paginaUtente, email);
			await paginaUtente.goto("/attivita");
			await expect(
				paginaUtente.getByRole("heading", {
					name: "Attività non disponibili",
				}),
			).toBeVisible();
			await expect(
				paginaUtente.getByText(
					"Il tuo profilo Collaboratore è disattivato. Non puoi registrare o consultare attività finché non viene riattivato.",
					{ exact: true },
				),
			).toBeVisible();
			await expect(
				paginaUtente.getByRole("table", { name: /^Attività di / }),
			).toHaveCount(0);
		} finally {
			await contestoUtente.close();
		}

		// AC-2: ri-aggiunta del ruolo senza che partita IVA e tariffa siano richieste.
		await apriElencoUtenti(page);
		await filtraUtenti(page, email);
		await rigaUtente(page, email)
			.getByRole("link", { name: "Modifica", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Modifica utente" }),
		).toBeVisible();
		await expect(
			page.getByRole("checkbox", { name: /^Collaboratore\b/ }),
		).not.toBeChecked();
		await commutaRuolo(page, "Collaboratore", true);
		// La sezione profilo NON deve comparire: il profilo esiste già.
		await expect(page.getByLabel(/^Cognome\b/)).toHaveCount(0);
		await expect(page.getByLabel(/^Partita IVA\b/)).toHaveCount(0);
		await expect(page.getByLabel(/^Tariffa giornaliera\b/)).toHaveCount(0);
		await page
			.getByRole("button", { name: "Salva modifiche", exact: true })
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=salvato$/);

		// AC-2: il profilo torna attivo con partita IVA e tariffa originarie.
		await apriElencoCollaboratori(page, email);
		const rigaRiattivata = rigaCollaboratore(page, email);
		await expect(
			rigaRiattivata.getByText("Attivo", { exact: true }),
		).toBeVisible();
		await expect(
			rigaRiattivata.getByText(partitaIva, { exact: true }),
		).toBeVisible();
		await expect(rigaRiattivata.getByText(/480,00/)).toBeVisible();
	});

	test("la modifica di un collaboratore attivo nasconde i campi profilo e rimanda all'anagrafica", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore({
			utenteOptions: {
				nome: `${factory.namespace} Collaboratore attivo`,
				email: `${factory.namespace}-collaboratore-attivo@e2e.invalid`,
				ruolo: "COLLABORATORE",
			},
		});
		const email = collaboratore.utente.email;

		await apriElencoUtenti(page);
		await filtraUtenti(page, email);
		await rigaUtente(page, email)
			.getByRole("link", { name: "Modifica", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Modifica utente" }),
		).toBeVisible();
		await expect(
			page.getByRole("checkbox", { name: /^Collaboratore\b/ }),
		).toBeChecked();

		// AC-5: nessun campo profilo nel form di modifica.
		await expect(page.getByLabel(/^Cognome\b/)).toHaveCount(0);
		await expect(page.getByLabel(/^Partita IVA\b/)).toHaveCount(0);
		await expect(page.getByLabel(/^Tariffa giornaliera\b/)).toHaveCount(0);

		// AC-5: box informativo che rimanda all'anagrafica collaboratori.
		await expect(
			page.getByText(
				"Questo utente ha un profilo collaboratore. Il profilo operativo (nome anagrafico, tariffa e attivazione) si gestisce dall'anagrafica collaboratori.",
				{ exact: true },
			),
		).toBeVisible();
	});

	test("demo__aggiunta-rimozione-ruolo-collaboratore", async ({
		page,
		browser,
		factory,
	}) => {
		// Utente solo Amministratore senza profilo: sarà promosso a collaboratore.
		const nomeDaPromuovere = `${factory.namespace} Demo da promuovere`;
		const cognomeDaPromuovere = "Colombo";
		const partitaIvaNuova = "04455667788";
		const utenteDaPromuovere = await factory.createUtente({
			nome: nomeDaPromuovere,
			email: `${factory.namespace}-demo-da-promuovere@e2e.invalid`,
			ruolo: "AMMINISTRATORE",
		});

		// Collaboratore con attività registrate: sarà disattivato e riattivato.
		const partitaIvaEsistente = "05566778899";
		const { cliente, offerta } = await factory.createClienteConOfferta();
		const collaboratore = await factory.createCollaboratore({
			partitaIva: partitaIvaEsistente,
			tariffaGiornaliera: "510.00",
			utenteOptions: {
				nome: `${factory.namespace} Demo collaboratore`,
				email: `${factory.namespace}-demo-collaboratore@e2e.invalid`,
				ruolo: "COLLABORATORE",
			},
		});
		const emailCollaboratore = collaboratore.utente.email;
		const nomeCompletoCollaboratore = `${collaboratore.collaboratore.nome} ${collaboratore.collaboratore.cognome}`;
		const notaStorica = `Attività demo ${factory.namespace}`;
		await factory.createRigaAttivita({
			collaboratore,
			cliente,
			offerta,
			data: new Date(`${dataNelMese(meseRiservato("US-046"), 14)}T00:00:00.000Z`),
			ore: "8",
			nota: notaStorica,
			fatturabile: true,
		});

		// 1. Aggiunta del ruolo Collaboratore con i dati obbligatori richiesti.
		await apriElencoUtenti(page);
		await filtraUtenti(page, utenteDaPromuovere.email);
		await rigaUtente(page, utenteDaPromuovere.email)
			.getByRole("link", { name: "Modifica", exact: true })
			.click();
		await impostaRuolo(page, "Collaboratore", true);
		await page
			.getByRole("button", { name: "Salva modifiche", exact: true })
			.click();
		await expect(
			page.getByText("Il cognome è obbligatorio", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("La partita IVA è obbligatoria", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("La tariffa giornaliera è obbligatoria", {
				exact: true,
			}),
		).toBeVisible();
		// Il submit fallito resetta i campi non controllati del form (React 19),
		// deselezionando il checkbox Collaboratore: va riportato a selezionato.
		await impostaRuolo(page, "Collaboratore", true);
		await page.getByLabel(/^Cognome\b/).fill(cognomeDaPromuovere);
		await page.getByLabel(/^Partita IVA\b/).fill(partitaIvaNuova);
		await page.getByLabel(/^Tariffa giornaliera\b/).fill("470");
		await page
			.getByRole("button", { name: "Salva modifiche", exact: true })
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=salvato$/);

		// Verifica del nuovo profilo attivo nell'anagrafica collaboratori.
		await apriElencoCollaboratori(page, utenteDaPromuovere.email);
		await expect(
			rigaCollaboratore(page, utenteDaPromuovere.email).getByText("Attivo", {
				exact: true,
			}),
		).toBeVisible();

		// 2. Rimozione del ruolo Collaboratore dall'utente con attività.
		await apriElencoUtenti(page);
		await filtraUtenti(page, emailCollaboratore);
		await rigaUtente(page, emailCollaboratore)
			.getByRole("link", { name: "Modifica", exact: true })
			.click();
		await commutaRuolo(page, "Collaboratore", false);
		await commutaRuolo(page, "Amministratore", true);
		await page
			.getByRole("button", { name: "Salva modifiche", exact: true })
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=salvato$/);

		// Il profilo risulta disattivato in anagrafica, con storico ancora leggibile.
		await apriElencoCollaboratori(page, emailCollaboratore);
		await expect(
			rigaCollaboratore(page, emailCollaboratore).getByText("Disattivato", {
				exact: true,
			}),
		).toBeVisible();
		await page.goto(
			`/anagrafiche/collaboratori/${collaboratore.collaboratore.id}`,
		);
		await expect(
			page.getByRole("heading", { name: nomeCompletoCollaboratore }),
		).toBeVisible();
		await expect(page.getByText(notaStorica)).toBeVisible();

		// 3. Al login il collaboratore vede il messaggio di profilo disattivato.
		const contestoUtente = await browser.newContext();
		try {
			const paginaUtente = await contestoUtente.newPage();
			await accediCome(paginaUtente, emailCollaboratore);
			await paginaUtente.goto("/attivita");
			await expect(
				paginaUtente.getByText(
					"Il tuo profilo Collaboratore è disattivato. Non puoi registrare o consultare attività finché non viene riattivato.",
					{ exact: true },
				),
			).toBeVisible();
			await expect(
				paginaUtente.getByRole("table", { name: /^Attività di / }),
			).toHaveCount(0);
		} finally {
			await contestoUtente.close();
		}

		// 4. Ri-aggiunta del ruolo: nessun dato richiesto, profilo riattivato.
		await apriElencoUtenti(page);
		await filtraUtenti(page, emailCollaboratore);
		await rigaUtente(page, emailCollaboratore)
			.getByRole("link", { name: "Modifica", exact: true })
			.click();
		await commutaRuolo(page, "Collaboratore", true);
		await expect(page.getByLabel(/^Cognome\b/)).toHaveCount(0);
		await expect(page.getByLabel(/^Partita IVA\b/)).toHaveCount(0);
		await page
			.getByRole("button", { name: "Salva modifiche", exact: true })
			.click();
		await expect(page).toHaveURL(/\/anagrafiche\/utenti\?esito=salvato$/);

		await apriElencoCollaboratori(page, emailCollaboratore);
		const rigaRiattivata = rigaCollaboratore(page, emailCollaboratore);
		await expect(
			rigaRiattivata.getByText("Attivo", { exact: true }),
		).toBeVisible();
		await expect(
			rigaRiattivata.getByText(partitaIvaEsistente, { exact: true }),
		).toBeVisible();
		await expect(rigaRiattivata.getByText(/510,00/)).toBeVisible();
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
