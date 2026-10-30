import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Ore registrate su un cliente con offerta da definire.
 *
 * Il collaboratore sceglie un cliente senza offerte (gruppo «Altri clienti»),
 * salva le ore lasciando vuota l'offerta, le ritrova come «Offerta da
 * definire» nel giorno e nel riepilogo e, quando l'offerta arriva, la assegna
 * modificando la riga. L'amministratore vede le stesse ore nei report come
 * voce «Senza offerta» a importo zero.
 */

test.describe("Ore con offerta da definire", () => {
	test("il collaboratore registra ore senza offerta e assegna l'offerta in seguito", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();
		const clienteSenzaOfferte = await factory.createCliente();
		const nota = `Ore senza offerta ${collaboratore.collaboratore.id}`;

		const mese = meseRiservato("OFFERTA-DA-DEFINIRE");
		const data = dataNelMese(mese, 9);

		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto(`/attivita/${data}?mese=${mese}`);

		const selectCliente = page.locator("#cliente");
		const selectOfferta = page.locator("#offerta");

		await expect(
			selectCliente.locator('optgroup[label="Altri clienti"]'),
		).toContainText(clienteSenzaOfferte.ragioneSociale);

		await selectCliente.selectOption(clienteSenzaOfferte.id);
		await expect(page.getByTestId("nessuna-offerta-abilitata")).toBeVisible();
		await expect(selectOfferta).toHaveValue("");

		await page.locator("#ore").fill("4");
		await page.locator("#nota").fill(nota);
		await page.getByRole("button", { name: "Aggiungi riga" }).click();

		const rigaCard = page.getByTestId("activity-row").filter({ hasText: nota });
		await expect(rigaCard).toContainText(clienteSenzaOfferte.ragioneSociale);
		await expect(rigaCard.getByTestId("offerta-da-definire")).toHaveText(
			"Offerta da definire",
		);

		await page.goto(`/attivita/riepilogo?mese=${mese}`);
		const voceDaDefinire = page
			.getByRole("row")
			.filter({ hasText: clienteSenzaOfferte.ragioneSociale });
		await expect(
			voceDaDefinire.getByTestId("riepilogo-offerta-da-definire"),
		).toBeVisible();

		// L'offerta arriva dopo: il collaboratore la assegna alla riga.
		const offerta = await factory.createOfferta({
			cliente: clienteSenzaOfferte,
			attiva: true,
		});
		await factory.createAbilitazioneOfferta({ collaboratore, offerta });

		await page.goto(`/attivita/${data}?mese=${mese}`);
		await rigaCard.getByRole("button", { name: "Modifica" }).click();
		await expect(selectCliente).toHaveValue(clienteSenzaOfferte.id);
		await expect(selectOfferta).toContainText(offerta.codice);
		await selectOfferta.selectOption(offerta.id);
		await page.getByRole("button", { name: "Salva modifiche" }).click();

		await expect(rigaCard.getByTestId("offerta-da-definire")).toHaveCount(0);
		await expect(rigaCard).toContainText(offerta.codice);
	});

	test("l'amministratore vede le ore senza offerta nei report a importo zero", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();
		const { cliente } = await factory.createClienteConOfferta(
			{},
			{ attiva: true, tariffaGiornaliera: "500.00" },
		);
		const offertaDelCliente = await factory.createOfferta({
			cliente,
			attiva: true,
			tariffaGiornaliera: "500.00",
		});

		const mese = meseRiservato("ORE-SENZA-OFFERTA-REPORT");
		await factory.createRigaAttivita({
			collaboratore,
			cliente,
			offerta: offertaDelCliente,
			data: new Date(`${dataNelMese(mese, 5)}T00:00:00.000Z`),
			ore: "8.00",
		});
		await factory.createRigaAttivita({
			collaboratore,
			cliente,
			offerta: null,
			data: new Date(`${dataNelMese(mese, 6)}T00:00:00.000Z`),
			ore: "4.00",
		});

		await accediComeAdmin(page);

		await page.goto(`/report/fatturazione-clienti?mese=${mese}`);
		const schedaFatturazione = page.getByTestId(`report-client-${cliente.id}`);
		const rigaSenzaOfferta = schedaFatturazione.getByRole("row").filter({
			has: page.getByText("Senza offerta", { exact: true }),
		});
		await expect(rigaSenzaOfferta).toContainText("da assegnare a un'offerta");
		await expect(rigaSenzaOfferta).toContainText("0,00");
		await expect(
			page.getByTestId(`report-client-${cliente.id}-totale`),
		).toContainText("500,00");

		await page.goto(`/report/marginalita?da=${mese}&a=${mese}`);
		const voceMarginalita = page
			.getByTestId(`marginalita-cliente-${cliente.id}`)
			.getByTestId("marginalita-offerta-senza-offerta");
		await expect(
			voceMarginalita.getByText("Senza offerta", { exact: true }),
		).toBeVisible();
		// Ricavi zero, costo di mezza giornata a 350 €/g.
		await expect(voceMarginalita).toContainText("0,00");
		await expect(voceMarginalita).toContainText("175,00");
	});
});
