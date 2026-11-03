import {
	attendiOfferteCaricate,
	labelOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Il collaboratore vede l'avanzamento in giornate dell'offerta su cui carica
 * le ore — nel form della giornata e nel riepilogo del mese — con la stessa
 * cella «Giorni erogati» dell'anagrafica offerte. È solo un'indicazione:
 * l'inserimento su un'offerta oltre budget resta possibile.
 */

function dataDb(data: string): Date {
	return new Date(`${data}T00:00:00.000Z`);
}

test.describe("Avanzamento in giornate dell'offerta per il collaboratore", () => {
	test("il form mostra le giornate erogate da tutti i collaboratori e segnala l'offerta oltre budget senza bloccarla", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();
		const cliente = await factory.createCliente();
		const offertaInCorso = await factory.createOfferta({ cliente, giorniPrevisti: 10 });
		const offertaOltreBudget = await factory.createOfferta({ cliente, giorniPrevisti: 2 });
		for (const offerta of [offertaInCorso, offertaOltreBudget]) {
			await factory.createAbilitazioneOfferta({ collaboratore, offerta });
		}
		// Le ore di un altro collaboratore consumano lo stesso budget: 20 h = 2,5 gg su 2.
		await factory.createRigaAttivita({
			offerta: offertaOltreBudget,
			ore: "20.00",
			categoria: "FATTURABILE",
		});
		await factory.createRigaAttivita({
			offerta: offertaInCorso,
			ore: "16.00",
			categoria: "FATTURABILE",
		});

		await accediComeCollaboratore(page, collaboratore.utente.email);
		const mese = meseRiservato("AVANZAMENTO-GIORNATE-FORM");
		const data = dataNelMese(mese, 11);
		await page.goto(`/attivita/${data}?mese=${mese}`);

		const selectOfferta = page.locator("#offerta");
		const indicatore = page.locator("#form-riga").getByTestId("indicatore-giorni-erogati");

		await page.locator("#cliente").selectOption(cliente.id);
		await attendiOfferteCaricate(selectOfferta);
		// Offerta da definire: nessuna indicazione.
		await expect(indicatore).toHaveCount(0);

		await selectOfferta.selectOption({
			label: labelOffertaTest({ cliente, offerta: offertaInCorso }),
		});
		await expect(indicatore).toHaveText(/^2\/10\s*gg$/);
		await expect(indicatore.getByRole("img", { name: "Erogato 20% del previsto" })).toBeVisible();

		await selectOfferta.selectOption({
			label: labelOffertaTest({ cliente, offerta: offertaOltreBudget }),
		});
		await expect(indicatore).toContainText(/2,5\/2\s*gg/);
		await expect(indicatore.getByText("Oltre budget", { exact: true })).toBeVisible();

		// Nessuna conferma: la riga si salva come su qualunque altra offerta.
		await page.locator("#ore").fill("4");
		await page.getByRole("button", { name: "Aggiungi riga", exact: true }).click();
		await expect(
			page.getByTestId("activity-row").filter({ hasText: offertaOltreBudget.codice }),
		).toBeVisible();
	});

	test("il riepilogo del mese mostra su ogni riga le giornate erogate dell'offerta", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();
		const cliente = await factory.createCliente();
		const offertaInCorso = await factory.createOfferta({ cliente, giorniPrevisti: 10 });
		const offertaEsaurita = await factory.createOfferta({ cliente, giorniPrevisti: 1 });
		const mese = meseRiservato("AVANZAMENTO-OFFERTA-RIEPILOGO-MESE");
		const data = dataDb(dataNelMese(mese, 12));

		await factory.createRigaAttivita({
			collaboratore,
			offerta: offertaInCorso,
			data,
			ore: "8.00",
			categoria: "FATTURABILE",
		});
		// Un'altra giornata su un altro mese: il riepilogo mostra l'avanzamento a oggi.
		await factory.createRigaAttivita({
			offerta: offertaInCorso,
			ore: "8.00",
			categoria: "FATTURABILE",
		});
		await factory.createRigaAttivita({
			collaboratore,
			offerta: offertaEsaurita,
			data,
			ore: "8.00",
			categoria: "FATTURABILE",
		});
		await factory.createRigaAttivita({
			collaboratore,
			offerta: null,
			cliente,
			data,
			ore: "2.00",
			categoria: "FATTURABILE",
		});

		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto(`/attivita/riepilogo?mese=${mese}`);

		const tabella = page.getByTestId("summary-table");
		await expect(tabella.getByRole("columnheader", { name: "Giorni erogati" })).toBeVisible();

		const rigaInCorso = tabella.getByRole("row").filter({ hasText: offertaInCorso.codice });
		await expect(rigaInCorso.getByTestId("indicatore-giorni-erogati")).toHaveText(/^2\/10\s*gg$/);

		const rigaEsaurita = tabella.getByRole("row").filter({ hasText: offertaEsaurita.codice });
		await expect(
			rigaEsaurita.getByTestId("indicatore-giorni-erogati").getByText("Esaurita", { exact: true }),
		).toBeVisible();

		const rigaDaDefinire = tabella
			.getByRole("row")
			.filter({ has: page.getByTestId("riepilogo-offerta-da-definire") });
		await expect(rigaDaDefinire.getByTestId("indicatore-giorni-erogati")).toHaveCount(0);
		await expect(rigaDaDefinire.getByRole("cell").last()).toHaveText("—");
	});
});
