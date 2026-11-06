import { attendiOfferteCaricate, labelOffertaTest } from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Demo — Inserimento ore su offerte abilitate e non abilitate
 *
 * Il collaboratore, abilitato su una sola delle due offerte attive di un
 * cliente, vede la select offerte divisa nei gruppi «Offerte abilitate» e
 * «Offerte non abilitate»; scegliendo quella non abilitata osserva l'avviso
 * giallo, con il salvataggio comunque disponibile; una riga preesistente su
 * un'offerta non abilitata resta modificabile ed eliminabile dal proprietario.
 */
test("il collaboratore vede le offerte abilitate e non abilitate e l'avviso non blocca", async ({
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

	// 1) La select offerte divide le offerte attive in abilitate e non abilitate.
	const dataNuovaRiga = dataNelMese(mese, 20);
	await page.goto(`/attivita/${dataNuovaRiga}?mese=${mese}`);

	const selectCliente = page.locator("#cliente");
	const selectOfferta = page.locator("#offerta");

	await selectCliente.selectOption(clienteDueOfferte.id);
	await attendiOfferteCaricate(selectOfferta);

	await expect(
		selectOfferta.locator('optgroup[label="Offerte abilitate"]'),
	).toContainText(
		labelOffertaTest({ cliente: clienteDueOfferte, offerta: offertaAbilitata }),
	);
	await expect(
		selectOfferta.locator('optgroup[label="Offerte non abilitate"]'),
	).toContainText(
		labelOffertaTest({
			cliente: clienteDueOfferte,
			offerta: offertaNonAbilitata,
		}),
	);

	// 2) Scegliendo l'offerta non abilitata compare l'avviso, che non blocca.
	await selectOfferta.selectOption(offertaNonAbilitata.id);
	await expect(page.getByTestId("offerta-non-abilitata")).toBeVisible();
	await selectOfferta.selectOption(offertaAbilitata.id);
	await expect(page.getByTestId("offerta-non-abilitata")).toHaveCount(0);
	await selectOfferta.selectOption(offertaNonAbilitata.id);
	await expect(
		page.getByRole("button", { name: "Aggiungi riga" }),
	).toBeEnabled();

	await page.goto(`/attivita/${dataRigaStorica}?mese=${mese}`);

	const rigaCard = page
		.getByTestId("activity-row")
		.filter({ hasText: rigaStorica.nota ?? "" });
	await expect(rigaCard).toBeVisible();
	await expect(rigaCard).toContainText("3.0 h");

	// 3) Una riga storica su un'offerta non abilitata resta modificabile ed eliminabile.
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
