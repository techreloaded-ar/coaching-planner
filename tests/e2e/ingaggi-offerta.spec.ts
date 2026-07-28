import { accediComeAdmin } from "./support/auth";
import { attendiTabellaOfferteIdratata } from "./support/offerte";
import { test, expect } from "./support/fixtures";

/**
 * Test e2e — US-044: ingaggio dei collaboratori su un'offerta dalla pagina
 * dedicata raggiungibile dall'elenco offerte.
 *
 * Scenario unico che copre l'intero flusso:
 * - AC-1: da /offerte si raggiunge la pagina dell'offerta e la tabella
 *   "Collaboratori ingaggiati" mostra i soli collaboratori già ingaggiati;
 * - AC-2: il dialog "Ingaggia collaboratori" permette ricerca e selezione, e
 *   l'ingaggio persiste dopo il ricaricamento;
 * - AC-3: la revoca toglie il collaboratore lasciando invariati gli altri;
 * - AC-4: le due operazioni si riflettono sulle "Offerte abilitate" del
 *   dettaglio di ciascun collaboratore toccato.
 */

test.describe("Ingaggi collaboratori su offerta", () => {
	test("ingaggio, revoca e ricaduta sul dettaglio collaboratore (AC-1/AC-2/AC-3/AC-4)", async ({
		page,
		factory,
	}) => {
		// Marcatore condiviso e univoco per questo test: rende ricercabili offerta e
		// collaboratori senza intercettare le righe di altri worker o del seed.
		const marcatore = `U44${factory.namespace}`
			.replace(/[^a-z0-9]/gi, "")
			.toUpperCase();
		const codiceOfferta = `${marcatore}OFF`;
		const cognomeIngaggiato = `${marcatore}A`;
		const cognomeDaIngaggiare = `${marcatore}B`;

		const { offerta } = await factory.createClienteConOfferta(
			{ ragioneSociale: `Cliente ${marcatore}` },
			{ codice: codiceOfferta },
		);

		const collaboratoreIngaggiato = await factory.createCollaboratore({
			cognome: cognomeIngaggiato,
		});
		const collaboratoreDaIngaggiare = await factory.createCollaboratore({
			cognome: cognomeDaIngaggiare,
		});

		// Pre-popolamento: il primo collaboratore parte già ingaggiato sull'offerta.
		await factory.createAbilitazioneOfferta({
			collaboratore: collaboratoreIngaggiato,
			offerta,
		});

		await accediComeAdmin(page);
		await page.goto("/offerte");

		// Il filtro di ricerca è un handler client: attendiamo l'idratazione della
		// tabella prima di digitare, altrimenti il testo va perso.
		await attendiTabellaOfferteIdratata(page);
		await page
			.getByRole("searchbox", { name: "Cerca offerta" })
			.fill(codiceOfferta);

		const tabellaOfferte = page.getByRole("table", {
			name: "Elenco offerte",
			exact: true,
		});
		await tabellaOfferte
			.getByRole("row", { name: codiceOfferta })
			.getByRole("link", { name: "Collaboratori", exact: true })
			.click();
		await page.waitForURL(`**/offerte/${offerta.id}/collaboratori`);

		const tabellaIngaggiati = page.getByRole("table", {
			name: "Collaboratori ingaggiati",
			exact: true,
		});

		// AC-1 — la tabella elenca il solo collaboratore già ingaggiato.
		await expect(
			tabellaIngaggiati.getByRole("row", { name: cognomeIngaggiato }),
		).toBeVisible();
		await expect(
			tabellaIngaggiati.getByRole("row", { name: cognomeDaIngaggiare }),
		).toHaveCount(0);

		// AC-2 — apertura del dialog. Il primo click dopo la navigazione può cadere
		// prima dell'idratazione (handler client-side): il click imposta lo stato
		// "aperto" in modo idempotente, quindi ritentiamo finché il dialog non è
		// osservabile, senza oscillazioni.
		const dialog = page.getByRole("dialog");
		await expect(async () => {
			await page
				.getByRole("button", { name: "Ingaggia collaboratori", exact: true })
				.click();
			await expect(dialog).toBeVisible({ timeout: 1_000 });
		}).toPass({ timeout: 15_000 });

		await dialog
			.getByRole("searchbox", { name: "Cerca collaboratori" })
			.fill(cognomeDaIngaggiare);
		await dialog.getByRole("checkbox", { name: cognomeDaIngaggiare }).check();
		await dialog
			.getByRole("button", { name: "Ingaggia selezionati", exact: true })
			.click();

		// Attesa web-first: il collaboratore appena ingaggiato compare in tabella.
		await expect(
			tabellaIngaggiati.getByRole("row", { name: cognomeDaIngaggiare }),
		).toBeVisible();

		// AC-2 — l'ingaggio sopravvive al ricaricamento.
		await page.reload();
		await expect(
			tabellaIngaggiati.getByRole("row", { name: cognomeIngaggiato }),
		).toBeVisible();
		await expect(
			tabellaIngaggiati.getByRole("row", { name: cognomeDaIngaggiare }),
		).toBeVisible();

		// AC-3 — revoca del solo collaboratore di partenza. Prima interazione dopo
		// il reload: la submit del form con action client-side è un no-op finché non
		// è idratata, quindi ritentiamo (la revoca è idempotente).
		await expect(async () => {
			await tabellaIngaggiati
				.getByRole("row", { name: cognomeIngaggiato })
				.getByRole("button", { name: "Revoca l'ingaggio di" })
				.click();
			await expect(
				tabellaIngaggiati.getByRole("row", { name: cognomeIngaggiato }),
			).toHaveCount(0, { timeout: 1_000 });
		}).toPass({ timeout: 15_000 });

		// AC-3 — dopo il reload la revoca è persistita e l'altro ingaggio resta.
		await page.reload();
		await expect(
			tabellaIngaggiati.getByRole("row", { name: cognomeIngaggiato }),
		).toHaveCount(0);
		await expect(
			tabellaIngaggiati.getByRole("row", { name: cognomeDaIngaggiare }),
		).toBeVisible();

		// AC-4 — il dettaglio del collaboratore ingaggiato elenca ora l'offerta.
		const tabellaOfferteAbilitate = page.getByRole("table", {
			name: "Offerte abilitate",
			exact: true,
		});

		await page.goto(
			`/anagrafiche/collaboratori/${collaboratoreDaIngaggiare.collaboratore.id}`,
		);
		await expect(
			tabellaOfferteAbilitate.getByRole("row", { name: codiceOfferta }),
		).toBeVisible();

		// AC-4 — il dettaglio del collaboratore revocato non la elenca più. La
		// sezione resta comunque presente: asserire sul titolo evita che un
		// caricamento incompleto passi per assenza dell'offerta.
		await page.goto(
			`/anagrafiche/collaboratori/${collaboratoreIngaggiato.collaboratore.id}`,
		);
		await expect(
			page.getByRole("heading", { name: "Offerte abilitate", exact: true }),
		).toBeVisible();
		await expect(
			tabellaOfferteAbilitate.getByRole("row", { name: codiceOfferta }),
		).toHaveCount(0);
	});
});
