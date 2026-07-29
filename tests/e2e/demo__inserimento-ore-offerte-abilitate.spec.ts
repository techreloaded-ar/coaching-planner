import { attendiOfferteCaricate, labelOffertaTest } from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Demo — US-043: Inserimento ore consentito solo sulle offerte abilitate
 *
 * Riproduce la Dimostrazione della spec: il collaboratore, abilitato su una
 * sola delle due offerte attive di un cliente, vede la select offerte
 * filtrata su quella abilitata; su un cliente privo di offerte abilitate
 * osserva il messaggio di assenza con salvataggio bloccato; una riga
 * preesistente su un'offerta non abilitata resta modificabile ed
 * eliminabile dal proprietario.
 *
 * Dopo US-049 la select clienti elenca solo i clienti abilitati, quindi il
 * cliente privo di offerte abilitate si raggiunge tramite il cambio cliente
 * esplicito durante la modifica di una riga storica.
 */
test("il collaboratore inserisce ore solo sulle offerte su cui è abilitato", async ({
	page,
	factory,
}) => {
	const mese = meseRiservato("US-043-DEMO");

	const collaboratore = await factory.createCollaboratore();

	const clienteDueOfferte = await factory.createCliente();
	const offertaAbilitata = await factory.createOfferta({
		cliente: clienteDueOfferte,
		attiva: true,
	});
	const offertaNonAbilitata = await factory.createOfferta({
		cliente: clienteDueOfferte,
		attiva: true,
	});
	await factory.createAbilitazioneOfferta({
		collaboratore,
		offerta: offertaAbilitata,
	});

	const clienteConRigaStorica = await factory.createClienteConOfferta(
		{},
		{ attiva: true },
	);
	const dataRigaStorica = dataNelMese(mese, 22);
	const rigaStorica = await factory.createRigaAttivita({
		collaboratore,
		cliente: clienteConRigaStorica.cliente,
		offerta: clienteConRigaStorica.offerta,
		data: new Date(`${dataRigaStorica}T00:00:00.000Z`),
		ore: "3.00",
		nota: `Riga storica demo US-043 ${collaboratore.collaboratore.id}`,
	});

	await accediComeCollaboratore(page, collaboratore.utente.email);

	// 1) La select offerte propone solo l'offerta abilitata del cliente.
	const dataNuovaRiga = dataNelMese(mese, 20);
	await page.goto(`/attivita/${dataNuovaRiga}?mese=${mese}`);

	const selectCliente = page.locator("#cliente");
	const selectOfferta = page.locator("#offerta");

	await selectCliente.selectOption(clienteDueOfferte.id);
	await attendiOfferteCaricate(selectOfferta);

	await expect(selectOfferta).toContainText(
		labelOffertaTest({ cliente: clienteDueOfferte, offerta: offertaAbilitata }),
	);
	await expect(selectOfferta).not.toContainText(
		labelOffertaTest({
			cliente: clienteDueOfferte,
			offerta: offertaNonAbilitata,
		}),
	);

	// 2) Un cliente senza offerte abilitate mostra l'avviso e blocca il salvataggio.
	// Vi si arriva dalla riga storica: il suo cliente resta selezionabile in
	// modifica anche se non più abilitato (US-049).
	await page.goto(`/attivita/${dataRigaStorica}?mese=${mese}`);

	const rigaCard = page
		.getByTestId("activity-row")
		.filter({ hasText: rigaStorica.nota ?? "" });
	await expect(rigaCard).toBeVisible();
	await expect(rigaCard).toContainText("3.0 h");

	await rigaCard.getByRole("button", { name: "Modifica" }).click();
	await expect(selectOfferta).toHaveValue(clienteConRigaStorica.offerta.id);

	await selectCliente.selectOption(clienteDueOfferte.id);
	await attendiOfferteCaricate(selectOfferta);
	await selectCliente.selectOption(clienteConRigaStorica.cliente.id);

	await expect(page.getByTestId("nessuna-offerta-abilitata")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Salva modifiche" }),
	).toBeDisabled();

	// 3) Una riga storica su un'offerta non abilitata resta modificabile ed eliminabile.
	await page.getByRole("button", { name: "Annulla" }).click();
	await rigaCard.getByRole("button", { name: "Modifica" }).click();

	const inputOre = page.locator("#ore");
	await expect(inputOre).toHaveValue("3");
	await expect(selectOfferta).toHaveValue(clienteConRigaStorica.offerta.id);
	await inputOre.fill("5");
	await page.getByRole("button", { name: "Salva modifiche" }).click();

	const rigaAggiornata = page
		.getByTestId("activity-row")
		.filter({ hasText: rigaStorica.nota ?? "" });
	await expect(rigaAggiornata).toContainText("5.0 h");

	page.once("dialog", (dialog) => {
		void dialog.accept();
	});
	await rigaAggiornata.getByRole("button", { name: "Elimina" }).click();

	await expect(rigaAggiornata).toBeHidden();
	await expect(
		page.getByText("Nessuna attività registrata per questa giornata."),
	).toBeVisible();
});
