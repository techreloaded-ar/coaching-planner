import { accediComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";

/**
 * Demo — US-042: Abilitazione dei collaboratori sulle offerte dal dettaglio
 * collaboratore.
 *
 * Riproduce la Dimostrazione della spec: un'offerta pre-popolata risulta già
 * abilitata, l'amministratore ne abilita una nuova dal dialog di ricerca e la
 * vede persistita dopo il reload, poi la revoca e osserva che l'abilitazione
 * pre-popolata resta invariata.
 */
test("l'amministratore abilita e revoca un'offerta dal dettaglio del collaboratore", async ({
	page,
	factory,
}) => {
	const marcatore = `DEMO${factory.namespace}`
		.replace(/[^a-z0-9]/gi, "")
		.toUpperCase();
	const codiceOffertaPrePopolata = `${marcatore}P`;
	const codiceOffertaNuova = `${marcatore}N`;

	const { cliente: clientePrePopolato, offerta: offertaPrePopolata } =
		await factory.createClienteConOfferta(
			{ ragioneSociale: `Cliente pre-popolato ${marcatore}` },
			{ codice: codiceOffertaPrePopolata },
		);
	await factory.createClienteConOfferta(
		{ ragioneSociale: `Cliente nuovo ${marcatore}` },
		{ codice: codiceOffertaNuova },
	);

	const collaboratore = await factory.createCollaboratore();

	// Simula lo stato al primo rilascio: il collaboratore ha già una riga di
	// attività registrata sull'offerta ed è quindi già abilitato dal backfill.
	await factory.createAbilitazioneOfferta({
		collaboratore,
		offerta: offertaPrePopolata,
	});

	await accediComeAdmin(page);
	await page.goto(
		`/anagrafiche/collaboratori/${collaboratore.collaboratore.id}`,
	);

	const tabellaAbilitate = page.getByRole("table", {
		name: "Offerte abilitate",
		exact: true,
	});

	// L'offerta pre-popolata è già presente fra le abilitate.
	const rigaPrePopolata = tabellaAbilitate.getByRole("row", {
		name: codiceOffertaPrePopolata,
	});
	await expect(rigaPrePopolata).toBeVisible();
	await expect(rigaPrePopolata).toContainText(
		clientePrePopolato.ragioneSociale,
	);

	// L'amministratore abilita una nuova offerta dal dialog di ricerca.
	const dialog = page.getByRole("dialog");
	await expect(async () => {
		await page
			.getByRole("button", { name: "Abilita offerte", exact: true })
			.click();
		await expect(dialog).toBeVisible({ timeout: 1_000 });
	}).toPass({ timeout: 15_000 });

	await dialog
		.getByRole("searchbox", { name: "Cerca offerta" })
		.fill(codiceOffertaNuova);
	await dialog.getByRole("checkbox", { name: codiceOffertaNuova }).check();
	await dialog
		.getByRole("button", { name: "Abilita selezionate", exact: true })
		.click();

	const rigaNuova = tabellaAbilitate.getByRole("row", {
		name: codiceOffertaNuova,
	});
	await expect(rigaNuova).toBeVisible();

	// La nuova abilitazione risulta persistita dopo il ricaricamento.
	await page.reload();
	await expect(rigaNuova).toBeVisible();
	await expect(rigaPrePopolata).toBeVisible();

	// La revoca dell'offerta appena abilitata lascia invariata quella
	// pre-popolata.
	await expect(async () => {
		await rigaNuova
			.getByRole("button", { name: "Revoca", exact: true })
			.click();
		await expect(rigaNuova).toHaveCount(0, { timeout: 1_000 });
	}).toPass({ timeout: 15_000 });

	await page.reload();
	await expect(rigaNuova).toHaveCount(0);
	await expect(rigaPrePopolata).toBeVisible();
});
