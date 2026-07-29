import { accediComeCollaboratore } from "./support/auth";
import { meseRiservato, dataNelMese } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * US-049: Selezione cliente limitata alle offerte abilitate
 *
 * Verifica che la select dei clienti proponga solo i clienti su cui il
 * collaboratore ha almeno un'offerta attiva abilitata (AC-1), che l'assenza
 * totale di abilitazioni sostituisca la selezione con un messaggio esplicito
 * e blocchi il salvataggio (AC-2), e che una riga storica su un cliente non
 * più abilitato resti visibile, selezionata e salvabile a parità di offerta
 * (AC-3).
 */

test.describe("US-049 Selezione cliente limitata alle offerte abilitate", () => {
	test("AC-1: la select clienti propone solo il cliente con offerta abilitata", async ({
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

		await expect(selectCliente).toContainText(clienteAbilitato.ragioneSociale);
		await expect(selectCliente).not.toContainText(
			clienteNonAbilitato.ragioneSociale,
		);
	});

	test("AC-2: senza alcuna offerta abilitata compare il messaggio al posto della select e il salvataggio è bloccato", async ({
		page,
		factory,
	}) => {
		const collaboratore = await factory.createCollaboratore();
		await factory.createClienteConOfferta({}, { attiva: true });

		await accediComeCollaboratore(page, collaboratore.utente.email);

		const mese = meseRiservato("US-049");
		await page.goto(`/attivita/${dataNelMese(mese, 13)}?mese=${mese}`);

		await expect(page.getByTestId("nessun-cliente-abilitato")).toBeVisible();
		await expect(page.locator("#cliente")).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Aggiungi riga" }),
		).toBeDisabled();
	});

	test("AC-3: in modifica il cliente della riga storica resta visibile e il salvataggio a parità di offerta è consentito", async ({
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
