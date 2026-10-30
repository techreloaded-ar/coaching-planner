import type { Page } from "@playwright/test";

import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Foglio attività dei collaboratori per gli amministratori.
 *
 * L'amministratore apre il foglio di un collaboratore dalla scheda del back
 * office o dal selettore nel titolo del front office, lo consulta (calendario,
 * giornata, riepilogo) e lo modifica con le stesse regole del collaboratore.
 * Un collaboratore non vede mai i dati di un altro; il foglio di un
 * collaboratore disattivato resta in sola lettura.
 */

function titoloFoglio(page: Page, nome: string) {
	return page.getByRole("heading", { level: 1, name: nome, exact: true });
}

function rigaConNota(page: Page, nota: string) {
	return page.getByTestId("activity-row").filter({ hasText: nota });
}

async function apriSelettoreFoglio(page: Page) {
	const selettore = page.getByTestId("selettore-foglio-attivita");
	await expect(selettore).toHaveAttribute("data-idratata", "true");
	await selettore.getByRole("button").click();
	return page.getByRole("combobox", { name: "Cerca collaboratore" });
}

test.describe("Foglio attività dei collaboratori per gli amministratori", () => {
	test("l'amministratore consulta e modifica il foglio di un collaboratore aperto dalla scheda", async ({
		page,
		factory,
		browser,
	}) => {
		const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
		const mario = await factory.createCollaboratore();
		const nomeMario = `${mario.collaboratore.nome} ${mario.collaboratore.cognome}`;
		const { cliente, offerta } = await factory.createClienteConOfferta({}, { attiva: true });
		await factory.createAbilitazioneOfferta({ collaboratore: mario, offerta });

		const mese = meseRiservato("FOGLIO-ATTIVITA-AMMINISTRATORE");
		const giorno = dataNelMese(mese, 12);
		const notaEsistente = `Riga di ${factory.namespace}`;
		const notaNuova = `Inserita dall'amministratore ${factory.namespace}`;
		await factory.createRigaAttivita({
			collaboratore: mario,
			offerta,
			data: new Date(`${giorno}T00:00:00.000Z`),
			ore: "2.00",
			nota: notaEsistente,
		});

		await accediComeAdmin(page, amministratore.email);
		await page.goto(`/anagrafiche/collaboratori/${mario.collaboratore.id}`);
		await page.getByRole("link", { name: "Apri foglio attività" }).click();
		await page.waitForURL(`**/attivita?collaboratore=${mario.collaboratore.id}`);

		await expect(titoloFoglio(page, `Attività di ${nomeMario}`)).toBeVisible();
		const banner = page.getByTestId("banner-foglio-consultato");
		await expect(banner).toContainText(`Stai consultando il foglio di ${nomeMario}`);
		await expect(page.getByText("Google Calendar collegato")).toHaveCount(0);
		await expect(page.getByText("Google Calendar non collegato")).toHaveCount(0);

		// Calendario del mese e dettaglio del giorno restano sul foglio di Mario.
		await page.goto(`/attivita?mese=${mese}&collaboratore=${mario.collaboratore.id}`);
		await page
			.getByTestId("cella-giorno")
			.filter({ hasText: cliente.ragioneSociale })
			.click();
		await page.waitForURL(`**/attivita/${giorno}?mese=${mese}&collaboratore=${mario.collaboratore.id}`);
		await expect(rigaConNota(page, notaEsistente)).toBeVisible();

		// Inserimento con le abilitazioni di Mario.
		await page.locator("#cliente").selectOption(cliente.id);
		await expect(page.locator("#offerta")).toContainText(offerta.codice);
		await page.locator("#offerta").selectOption(offerta.id);
		await page.locator("#ore").fill("3");
		await page.locator("#nota").fill(notaNuova);
		await page.getByRole("button", { name: "Aggiungi riga" }).click();
		await expect(rigaConNota(page, notaNuova)).toBeVisible();

		// Eliminazione di una riga di Mario.
		page.once("dialog", (dialog) => dialog.accept());
		await rigaConNota(page, notaEsistente).getByRole("button", { name: "Elimina" }).click();
		await expect(rigaConNota(page, notaEsistente)).toHaveCount(0);

		// Il riepilogo del mese è quello di Mario.
		await page.goto(`/attivita/riepilogo?mese=${mese}&collaboratore=${mario.collaboratore.id}`);
		await expect(page.getByRole("row").filter({ hasText: offerta.codice })).toBeVisible();

		await page.getByRole("link", { name: "Torna alla scheda" }).click();
		await page.waitForURL(`**/anagrafiche/collaboratori/${mario.collaboratore.id}`);

		// Mario ritrova nel proprio foglio le modifiche dell'amministratore.
		const contestoMario = await browser.newContext();
		const paginaMario = await contestoMario.newPage();
		await accediComeCollaboratore(paginaMario, mario.utente.email);
		await paginaMario.goto(`/attivita/${giorno}?mese=${mese}`);
		await expect(rigaConNota(paginaMario, notaNuova)).toBeVisible();
		await expect(rigaConNota(paginaMario, notaEsistente)).toHaveCount(0);
		await contestoMario.close();
	});

	test("un collaboratore non ottiene il foglio di un altro collaboratore", async ({
		page,
		factory,
	}) => {
		const giulia = await factory.createCollaboratore();
		const mario = await factory.createCollaboratore();
		const offerta = await factory.createOfferta({ attiva: true });
		const giorno = dataNelMese(meseRiservato("FOGLIO-ATTIVITA-AMMINISTRATORE"), 8);
		const notaMario = `Riservata a Mario ${factory.namespace}`;
		await factory.createRigaAttivita({
			collaboratore: mario,
			offerta,
			data: new Date(`${giorno}T00:00:00.000Z`),
			nota: notaMario,
		});

		await accediComeCollaboratore(page, giulia.utente.email);
		await page.goto(`/attivita/${giorno}?collaboratore=${mario.collaboratore.id}`);
		await page.waitForURL("**/attivita");
		await expect(titoloFoglio(page, "Le mie attività")).toBeVisible();
		await expect(page.getByRole("button", { name: "Le mie attività" })).toHaveCount(0);
		await expect(page.getByTestId("banner-foglio-consultato")).toHaveCount(0);

		const risposta = await page.request.get(
			`/api/attivita/giornata?data=${giorno}&collaboratore=${mario.collaboratore.id}`,
		);
		expect(risposta.status()).toBe(403);
		expect(await risposta.text()).not.toContain(notaMario);
	});

	test("il foglio di un collaboratore disattivato è consultabile in sola lettura", async ({
		page,
		factory,
	}) => {
		const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
		const disattivato = await factory.createCollaboratore({ attivo: false });
		const offerta = await factory.createOfferta({ attiva: true });
		const mese = meseRiservato("FOGLIO-ATTIVITA-AMMINISTRATORE");
		const giorno = dataNelMese(mese, 15);
		const nota = `Storico ${factory.namespace}`;
		await factory.createRigaAttivita({
			collaboratore: disattivato,
			offerta,
			data: new Date(`${giorno}T00:00:00.000Z`),
			nota,
		});

		await accediComeAdmin(page, amministratore.email);
		await page.goto(`/attivita/${giorno}?mese=${mese}&collaboratore=${disattivato.collaboratore.id}`);

		await expect(page.getByTestId("banner-foglio-consultato")).toContainText(
			"il foglio è in sola lettura",
		);
		const riga = rigaConNota(page, nota);
		await expect(riga).toBeVisible();
		await expect(riga.getByRole("button", { name: "Elimina" })).toHaveCount(0);
		await expect(riga.getByRole("button", { name: "Modifica" })).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Aggiungi riga" })).toHaveCount(0);
	});

	test("l'amministratore cambia collaboratore dal titolo restando sulla stessa vista", async ({
		page,
		factory,
	}) => {
		const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
		await factory.createCollaboratore({ utente: amministratore });
		const anna = await factory.createCollaboratore();
		const bruno = await factory.createCollaboratore();
		const nomeAnna = `${anna.collaboratore.nome} ${anna.collaboratore.cognome}`;
		const nomeBruno = `${bruno.collaboratore.nome} ${bruno.collaboratore.cognome}`;
		const { cliente, offerta } = await factory.createClienteConOfferta({}, { attiva: true });

		const mese = meseRiservato("FOGLIO-ATTIVITA-AMMINISTRATORE");
		const giorno = dataNelMese(mese, 20);
		for (const collaboratore of [anna, bruno]) {
			await factory.createRigaAttivita({
				collaboratore,
				offerta,
				data: new Date(`${giorno}T00:00:00.000Z`),
				nota: `Giornata di ${collaboratore.collaboratore.cognome}`,
			});
		}

		await accediComeAdmin(page, amministratore.email);
		await page.goto(`/attivita?mese=${mese}`);
		await expect(titoloFoglio(page, "Le mie attività")).toBeVisible();

		// Tastiera: ricerca, frecce e Invio sul calendario del mese.
		const ricerca = await apriSelettoreFoglio(page);
		await ricerca.fill(anna.collaboratore.cognome);
		await expect(page.getByRole("option")).toHaveCount(1);
		await ricerca.press("Enter");
		await page.waitForURL(`**/attivita?mese=${mese}&collaboratore=${anna.collaboratore.id}`);
		await expect(titoloFoglio(page, `Attività di ${nomeAnna}`)).toBeVisible();

		await page
			.getByTestId("cella-giorno")
			.filter({ hasText: cliente.ragioneSociale })
			.click();
		await expect(rigaConNota(page, `Giornata di ${anna.collaboratore.cognome}`)).toBeVisible();

		// Mouse: stesso giorno, altro collaboratore.
		await apriSelettoreFoglio(page);
		await page.getByRole("option").filter({ hasText: nomeBruno }).click();
		await page.waitForURL(
			`**/attivita/${giorno}?mese=${mese}&collaboratore=${bruno.collaboratore.id}`,
		);
		await expect(titoloFoglio(page, `Attività di ${nomeBruno}`)).toBeVisible();
		await expect(rigaConNota(page, `Giornata di ${bruno.collaboratore.cognome}`)).toBeVisible();

		// Esc chiude l'elenco senza cambiare foglio.
		const ricercaAperta = await apriSelettoreFoglio(page);
		await ricercaAperta.press("Escape");
		await expect(page.getByRole("listbox")).toHaveCount(0);

		// Ritorno al proprio foglio.
		await apriSelettoreFoglio(page);
		await page.getByRole("option").filter({ hasText: "Le mie attività" }).click();
		await page.waitForURL(`**/attivita/${giorno}?mese=${mese}`);
		await expect(titoloFoglio(page, "Le mie attività")).toBeVisible();
		await expect(page.getByTestId("banner-foglio-consultato")).toHaveCount(0);
		await expect(page.getByTestId("activity-row")).toHaveCount(0);
	});
});
