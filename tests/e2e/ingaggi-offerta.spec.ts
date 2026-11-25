import { accediComeAdmin } from "./support/auth";
import { apriPaginaOfferte } from "./support/offerte";
import { selezionaRighe } from "./support/elenchi";
import { test, expect } from "./support/fixtures";
import {
	attendiConfermaMutazioni,
	avvisoMutazioneNonRiuscita,
	faiFallireAzioniServer,
	trattieniAzioniServer,
} from "./support/mutazioni-ottimistiche";

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
 *
 * Ingaggi e revoche sono immediati: la squadra cambia subito e la sezione resta
 * `aria-busy` finché il server non conferma. Prima di ogni reload il test
 * attende la conferma, altrimenti il reload interromperebbe la POST in corso.
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
		// La ricerca è lato server: l'elenco filtrato per codice contiene la riga
		// anche quando le offerte create in parallelo superano la prima pagina.
		await apriPaginaOfferte(page, codiceOfferta);

		const barra = await selezionaRighe(page, [codiceOfferta]);
		await barra
			.getByRole("link", { name: "Collaboratori abilitati", exact: true })
			.click();
		await page.waitForURL((url) =>
			url.pathname === `/offerte/${offerta.id}/collaboratori` &&
			url.searchParams.get("q") === codiceOfferta,
		);

		const tabellaIngaggiati = page.getByRole("table", {
			name: "Collaboratori ingaggiati",
			exact: true,
		});
		const sezioneIngaggiati = page.getByRole("region", {
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

		// Il dialog si chiude subito e il collaboratore compare in tabella; il
		// reload aspetta la conferma del server.
		await expect(dialog).toHaveCount(0);
		await expect(
			tabellaIngaggiati.getByRole("row", { name: cognomeDaIngaggiare }),
		).toBeVisible();
		await attendiConfermaMutazioni(sezioneIngaggiati);
		await expect(
			tabellaIngaggiati
				.getByRole("row", { name: cognomeDaIngaggiare })
				.getByRole("button", { name: "Revoca l'ingaggio di" }),
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
		await attendiConfermaMutazioni(sezioneIngaggiati);

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

	test("ingaggio immediato in attesa di conferma e ritorno allo stato precedente se il server non risponde", async ({
		page,
		factory,
	}) => {
		const marcatore = `U44R${factory.namespace}`
			.replace(/[^a-z0-9]/gi, "")
			.toUpperCase();
		const { offerta } = await factory.createClienteConOfferta(
			{ ragioneSociale: `Cliente ${marcatore}` },
			{ codice: `${marcatore}OFF` },
		);
		// Cognomi scelti per l'ordine: A (nuovo) precede B (già in squadra).
		const { collaboratore: daIngaggiare } = await factory.createCollaboratore({
			cognome: `${marcatore}A`,
		});
		const giaIngaggiato = await factory.createCollaboratore({
			cognome: `${marcatore}B`,
		});
		const { collaboratore: nonIngaggiabile } = await factory.createCollaboratore({
			cognome: `${marcatore}C`,
		});
		await factory.createAbilitazioneOfferta({ collaboratore: giaIngaggiato, offerta });

		const percorso = `/offerte/${offerta.id}/collaboratori`;
		await accediComeAdmin(page);
		await page.goto(percorso);

		const sezione = page.getByRole("region", {
			name: "Collaboratori ingaggiati",
			exact: true,
		});
		const tabella = page.getByRole("table", {
			name: "Collaboratori ingaggiati",
			exact: true,
		});
		const squadraAttiva = page.getByTestId("squadra-attiva");
		const rigaNuova = tabella.getByRole("row", { name: daIngaggiare.cognome });
		await expect(tabella.getByRole("row", { name: giaIngaggiato.collaboratore.cognome })).toBeVisible();
		await expect(squadraAttiva).toContainText("1");

		const dialog = page.getByRole("dialog");
		const apriDialog = async () => {
			await expect(async () => {
				await page
					.getByRole("button", { name: "Ingaggia collaboratori", exact: true })
					.click();
				await expect(dialog).toBeVisible({ timeout: 1_000 });
			}).toPass({ timeout: 15_000 });
		};

		// Con la POST trattenuta il dialog si chiude e la squadra cambia subito:
		// la riga nuova è al suo posto in ordine di cognome, attenuata con
		// «Salvataggio…» e senza azioni; il contatore conta già il nuovo arrivo.
		const trattenute = await trattieniAzioniServer(page, percorso);
		await apriDialog();
		await dialog.getByRole("searchbox", { name: "Cerca collaboratori" }).fill(daIngaggiare.cognome);
		await dialog.getByRole("checkbox", { name: daIngaggiare.cognome }).check();
		await dialog.getByRole("button", { name: "Ingaggia selezionati", exact: true }).click();

		await expect(dialog).toHaveCount(0);
		await expect(rigaNuova).toBeVisible();
		await expect(rigaNuova.getByText("Salvataggio…")).toBeVisible();
		await expect(rigaNuova.getByRole("button")).toHaveCount(0);
		await expect(tabella.getByRole("row").nth(1)).toContainText(daIngaggiare.cognome);
		await expect(squadraAttiva).toContainText("2");
		await expect(sezione).toHaveAttribute("aria-busy", "true");
		await expect.poll(() => trattenute.conteggio()).toBe(1);

		// Rilasciata la POST, la conferma rende la riga interattiva.
		trattenute.rilascia();
		await attendiConfermaMutazioni(sezione);
		await expect(rigaNuova.getByText("Salvataggio…")).toHaveCount(0);
		await expect(
			rigaNuova.getByRole("button", { name: "Revoca l'ingaggio di" }),
		).toBeVisible();
		await trattenute.smetti();

		// Server irraggiungibile: l'ingaggio provvisorio sparisce e l'avviso dice
		// cosa non è riuscito.
		const fallite = await faiFallireAzioniServer(page, percorso);
		await apriDialog();
		await dialog.getByRole("searchbox", { name: "Cerca collaboratori" }).fill(nonIngaggiabile.cognome);
		await dialog.getByRole("checkbox", { name: nonIngaggiabile.cognome }).check();
		await dialog.getByRole("button", { name: "Ingaggia selezionati", exact: true }).click();

		await attendiConfermaMutazioni(sezione);
		await expect(avvisoMutazioneNonRiuscita(sezione)).toContainText(
			`L'ingaggio di ${nonIngaggiabile.nome} ${nonIngaggiabile.cognome} sull'offerta ${offerta.codice} non è riuscito`,
		);
		await expect(tabella.getByRole("row", { name: nonIngaggiabile.cognome })).toHaveCount(0);
		await expect(squadraAttiva).toContainText("2");

		// Revoca rifiutata: la riga torna al suo posto con il messaggio.
		await rigaNuova.getByRole("button", { name: "Revoca l'ingaggio di" }).click();
		await attendiConfermaMutazioni(sezione);
		await expect(avvisoMutazioneNonRiuscita(sezione)).toContainText(
			`La revoca di ${daIngaggiare.nome} ${daIngaggiare.cognome} non è riuscita`,
		);
		await expect(rigaNuova).toBeVisible();
		await expect(squadraAttiva).toContainText("2");
		expect(fallite.conteggio()).toBe(2);
		await fallite.smetti();

		// Sul server restano solo l'ingaggio confermato e quello di partenza.
		await page.reload();
		await expect(rigaNuova).toBeVisible();
		await expect(tabella.getByRole("row", { name: giaIngaggiato.collaboratore.cognome })).toBeVisible();
		await expect(tabella.getByRole("row", { name: nonIngaggiabile.cognome })).toHaveCount(0);
	});
});
