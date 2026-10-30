import { accediComeCollaboratore } from "./support/auth";
import { meseRiservato, dataNelMese } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Selezione cliente nel form riga attività.
 *
 * La select propone tutti i clienti attivi: in cima il gruppo «Consigliati»
 * con i clienti su cui il collaboratore ha almeno un'offerta attiva
 * abilitata, sotto «Altri clienti». Una riga storica su un cliente non più
 * abilitato resta visibile, selezionata e salvabile a parità di offerta.
 */

test.describe("Selezione cliente con gruppo Consigliati", () => {
	test("la select clienti mette il cliente con offerta abilitata tra i Consigliati e gli altri sotto", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();

		const clienteAbilitato = await factory.createCliente();
		const offertaAbilitata = await factory.createOfferta({
			cliente: clienteAbilitato,
			attiva: true,
		});
		await factory.createAbilitazioneOfferta({
			collaboratore,
			offerta: offertaAbilitata,
		});

		const clienteNonAbilitato = await factory.createCliente();
		await factory.createOfferta({
			cliente: clienteNonAbilitato,
			attiva: true,
		});

		await accediComeCollaboratore(page, collaboratore.utente.email);

		const mese = meseRiservato("US-049");
		await page.goto(`/attivita/${dataNelMese(mese, 12)}?mese=${mese}`);

		const selectCliente = page.locator("#cliente");
		const consigliati = selectCliente.locator('optgroup[label="Consigliati"]');
		const altriClienti = selectCliente.locator('optgroup[label="Altri clienti"]');

		await expect(consigliati).toContainText(clienteAbilitato.ragioneSociale);
		await expect(consigliati).not.toContainText(
			clienteNonAbilitato.ragioneSociale,
		);
		await expect(altriClienti).toContainText(
			clienteNonAbilitato.ragioneSociale,
		);
	});

	test("in modifica il cliente della riga storica resta visibile e il salvataggio a parità di offerta è consentito", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();
		const clienteConOfferta = await factory.createClienteConOfferta(
			{},
			{ attiva: true },
		);

		const mese = meseRiservato("US-049");
		const data = dataNelMese(mese, 14);
		const rigaEsistente = await factory.createRigaAttivita({
			collaboratore,
			cliente: clienteConOfferta.cliente,
			offerta: clienteConOfferta.offerta,
			data: new Date(`${data}T00:00:00.000Z`),
			ore: "4.00",
			nota: `Riga US-049 AC-3 ${collaboratore.collaboratore.id}`,
		});

		await accediComeCollaboratore(page, collaboratore.utente.email);
		await page.goto(`/attivita/${data}?mese=${mese}`);

		const rigaCard = page
			.getByTestId("activity-row")
			.filter({ hasText: rigaEsistente.nota ?? "" });
		await expect(rigaCard).toBeVisible();
		await expect(rigaCard).toContainText("4.0 h");

		await rigaCard.getByRole("button", { name: "Modifica" }).click();

		const selectCliente = page.locator("#cliente");
		const selectOfferta = page.locator("#offerta");

		await expect(selectCliente).toHaveValue(clienteConOfferta.cliente.id);
		await expect(selectCliente).toContainText(
			clienteConOfferta.cliente.ragioneSociale,
		);

		// Il form carica l'offerta della riga in modo asincrono: attendi che
		// offertaId sia valorizzato prima di salvare.
		await expect(selectOfferta).toHaveValue(clienteConOfferta.offerta.id);

		await page.locator("#ore").fill("6");
		await page.getByRole("button", { name: "Salva modifiche" }).click();

		const rigaCardAggiornata = page
			.getByTestId("activity-row")
			.filter({ hasText: rigaEsistente.nota ?? "" });
		await expect(rigaCardAggiornata).toContainText("6.0 h");
	});
});
