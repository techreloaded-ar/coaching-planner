import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";
import { dataNelMeseRiservato, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

const CODICE_SPEC = "US-030-TASK-08-ATTIVITA-AMMINISTRATORE";

test.describe("US-030 Attività amministratore", () => {
	test("amministratore con profilo attivo registra attività e naviga tra front office e console", async ({
		page,
		factory,
	}) => {
		const utente = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
		await factory.createCollaboratore({ utente });
		const cliente = await factory.createCliente();
		const offerta = await factory.createOfferta({ cliente });
		const mese = meseRiservato(CODICE_SPEC);
		const data = dataNelMeseRiservato(CODICE_SPEC, 15);
		const nota = `Attività amministratore ${factory.namespace}`;

		await accediComeAdmin(page, utente.email);
		await page.waitForURL("**/attivita");
		await expect(
			page.getByRole("heading", { name: "Le mie attività", exact: true }),
		).toBeVisible();
		await expect(page.getByText(/^Amministratore · .+$/)).toBeVisible();
		await expect(
			page.getByRole("link", {
				name: "Console amministrativa",
				exact: true,
			}),
		).toBeVisible();

		await page.goto(`/attivita/${data}?mese=${mese}`);
		await page.waitForURL(`**/attivita/${data}?mese=${mese}`);
		await expect(page.getByText("Nuova riga attività")).toBeVisible();
		await page.locator("#cliente").selectOption(cliente.id);
		await expect(page.locator("#offerta")).toBeEnabled();
		await page.locator("#offerta").selectOption(offerta.id);
		await page.locator("#ore").fill("7,5");
		await page.locator("#nota").fill(nota);
		await page.getByRole("button", { name: "Aggiungi riga" }).click();
		const rigaCreata = page
			.getByTestId("activity-row")
			.filter({ has: page.getByText(nota, { exact: true }) });
		await expect(rigaCreata).toBeVisible();
		await expect(rigaCreata).toContainText(offerta.codice);
		await expect(rigaCreata).toContainText("7.5 h");

		await page.getByRole("link", { name: "Torna al calendario", exact: true }).click();
		await page.waitForURL(`**/attivita?mese=${mese}`);
		const giornoConAttivita = page.locator(
			`a[href="/attivita/${data}?mese=${mese}"]`,
		);
		// Dopo US-034 la cella mostra l'etichetta cliente con le ore cumulate,
		// non più il codice offerta.
		await expect(
			giornoConAttivita.getByTestId("etichetta-cliente"),
		).toHaveText(`${cliente.ragioneSociale} 7.5 h`);

		await giornoConAttivita.click();
		await page.waitForURL(`**/attivita/${data}?mese=${mese}`);
		await expect(rigaCreata).toBeVisible();
		await expect(rigaCreata).toContainText(nota);
		await expect(rigaCreata).toContainText(cliente.ragioneSociale);
		await expect(rigaCreata).toContainText(offerta.codice);

		await page.getByRole("link", { name: "Torna al calendario", exact: true }).click();
		await page.waitForURL(`**/attivita?mese=${mese}`);
		await page.getByRole("link", { name: "Riepilogo mese", exact: true }).click();
		await page.waitForURL(`**/attivita/riepilogo?mese=${mese}`);
		await expect(page.getByTestId("summary-ore-totali-value")).toHaveText("7,5");
		await expect(page.getByTestId("summary-ore-fatturabili-value")).toHaveText(
			"7,5",
		);
		await expect(page.getByTestId("summary-table")).toContainText(offerta.codice);

		await page
			.getByRole("link", { name: "Console amministrativa", exact: true })
			.click();
		await page.waitForURL("**/anagrafiche/clienti");
		await expect(page.getByRole("heading", { name: "Clienti" })).toBeVisible();

		await page.getByRole("link", { name: "Fatturazione clienti", exact: true }).click();
		await page.waitForURL("**/report/fatturazione-clienti");
		await page.goto(`/report/fatturazione-clienti?mese=${mese}`);
		const rigaReport = page
			.getByRole("row")
			.filter({ has: page.getByText(offerta.codice, { exact: true }) });
		await expect(rigaReport).toHaveCount(1);

		await page.getByRole("link", { name: "Le mie attività", exact: true }).click();
		await page.waitForURL("**/attivita");
		await expect(
			page.getByRole("heading", { name: "Le mie attività", exact: true }),
		).toBeVisible();
	});

	test("amministratore senza profilo può censirsi dalla console e mantenere il ruolo", async ({
		page,
		factory,
	}) => {
		const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });

		await accediComeAdmin(page, amministratore.email);
		await page.waitForURL("**/attivita");
		await expect(
			page.getByRole("heading", { name: "Attività non disponibili" }),
		).toBeVisible();
		await expect(
			page.getByText(
				"Il tuo account non è collegato a un profilo Collaboratore.",
				{ exact: false },
			),
		).toBeVisible();
		await page
			.getByRole("link", {
				name: "Apri Anagrafica collaboratori",
				exact: true,
			})
			.click();
		await page.waitForURL("**/anagrafiche/collaboratori");
		await page
			.getByRole("link", { name: "Nuovo collaboratore", exact: true })
			.click();
		await page.waitForURL("**/anagrafiche/collaboratori/nuovo");
		await page.getByRole("textbox", { name: "Nome *", exact: true }).fill("Admin");
		await page.getByRole("textbox", { name: "Cognome *", exact: true }).fill("E2E");
		await page
			.getByRole("textbox", { name: "Email di accesso *", exact: true })
			.fill(amministratore.email);
		await page.getByRole("textbox", { name: "Partita IVA *", exact: true }).fill("01234567890");
		await page
			.getByRole("textbox", { name: "Tariffa giornaliera *", exact: true })
			.fill("450,00");
		await page.getByRole("button", { name: "Crea collaboratore" }).click();
		await page.waitForURL("**/anagrafiche/collaboratori?esito=creato");

		await page.goto("/attivita");
		await page.waitForURL("**/attivita");
		await expect(
			page.getByRole("heading", { name: "Le mie attività", exact: true }),
		).toBeVisible();
		await expect(page.getByText(/^Amministratore · .+$/)).toBeVisible();
		await page
			.getByRole("link", { name: "Console amministrativa", exact: true })
			.click();
		await page.waitForURL("**/anagrafiche/clienti");
	});

	test("amministratore con profilo disattivato, collaboratore e anonimo mantengono gli accessi previsti", async ({
		page,
		factory,
	}) => {
		const utenteDisattivato = await factory.createUtente({
			ruolo: "AMMINISTRATORE",
		});
		await factory.createCollaboratore({ utente: utenteDisattivato, attivo: false });

		await accediComeAdmin(page, utenteDisattivato.email);
		await page.waitForURL("**/attivita");
		await expect(
			page.getByRole("heading", { name: "Attività non disponibili" }),
		).toBeVisible();
		await expect(
			page.getByText("Il tuo profilo Collaboratore è disattivato.", {
				exact: false,
			}),
		).toBeVisible();
		await expect(
			page.getByRole("link", {
				name: "Apri Anagrafica collaboratori",
				exact: true,
			}),
		).toBeVisible();

		const collaboratore = await factory.createCollaboratore();
		const browser = page.context().browser();
		if (!browser) throw new Error("Browser Playwright non disponibile");
		const contestoCollaboratore = await browser.newContext();
		const paginaCollaboratore = await contestoCollaboratore.newPage();
		await accediComeCollaboratore(paginaCollaboratore, collaboratore.utente.email);
		await expect(
			paginaCollaboratore.getByRole("link", {
				name: "Console amministrativa",
				exact: true,
			}),
		).toHaveCount(0);
		await paginaCollaboratore.goto("/anagrafiche");
		await paginaCollaboratore.waitForURL("**/attivita**");
		await expect(
			paginaCollaboratore.getByRole("heading", {
				name: "Le mie attività",
				exact: true,
			}),
		).toBeVisible();

		const contestoAnonimo = await browser.newContext();
		const paginaAnonima = await contestoAnonimo.newPage();
		await paginaAnonima.goto("/attivita");
		await paginaAnonima.waitForURL((url) => url.pathname === "/");
		await expect(
			paginaAnonima.getByRole("button", { name: "Accedi con Google" }),
		).toBeVisible();
		await paginaAnonima.goto("/anagrafiche");
		await paginaAnonima.waitForURL((url) => url.pathname === "/");

		await contestoCollaboratore.close();
		await contestoAnonimo.close();
	});
});
