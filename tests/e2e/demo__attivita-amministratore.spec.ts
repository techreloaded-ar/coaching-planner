import { accediComeAdmin } from "./support/auth";
import { dataNelMeseRiservato, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

const CODICE_SPEC_DEMO = "US-030-TASK-08-ATTIVITA-AMMINISTRATORE-DEMO";

/**
 * Demo scenario — US-030: un amministratore con profilo Collaboratore usa
 * l'area attività e torna alla console. Il video resta disabilitato per questo
 * scenario, come richiesto dalla consegna.
 */
test.describe("US-030 Demo", () => {
	test("amministratore con profilo attivo: inserisce attività, calendario, riepilogo e console", async ({
		page,
		factory,
	}) => {
		const utente = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
		const collaboratore = await factory.createCollaboratore({ utente });
		const cliente = await factory.createCliente();
		const offerta = await factory.createOfferta({ cliente });
		await factory.createAbilitazioneOfferta({ collaboratore, offerta });
		const mese = meseRiservato(CODICE_SPEC_DEMO);
		const data = dataNelMeseRiservato(CODICE_SPEC_DEMO, 17);
		const nota = `Demo attività amministratore ${factory.namespace}`;

		await accediComeAdmin(page, utente.email);
		await page.waitForURL("**/attivita");
		await expect(
			page.getByRole("heading", { name: "Le mie attività", exact: true }),
		).toBeVisible();
		await expect(
			page.getByRole("link", {
				name: "Console amministrativa",
				exact: true,
			}),
		).toBeVisible();

		await page.goto(`/attivita/${data}?mese=${mese}`);
		await page.waitForURL(`**/attivita/${data}?mese=${mese}`);
		await page.locator("#cliente").selectOption(cliente.id);
		await expect(page.locator("#offerta")).toBeEnabled();
		await page.locator("#offerta").selectOption(offerta.id);
		await page.locator("#ore").fill("6");
		await page.locator("#nota").fill(nota);
		await page.getByRole("button", { name: "Aggiungi riga" }).click();
		await expect(page.getByText(nota, { exact: true })).toBeVisible();

		await page.getByRole("link", { name: "Torna al calendario", exact: true }).click();
		await page.waitForURL(`**/attivita?mese=${mese}`);
		const giornoConAttivita = page.locator(
			`a[href="/attivita/${data}?mese=${mese}"]`,
		);
		// Dopo US-034 la cella mostra l'etichetta cliente con le ore cumulate,
		// non più il codice offerta.
		await expect(
			giornoConAttivita.getByTestId("etichetta-cliente"),
		).toHaveText(`${cliente.ragioneSociale} 6.0 h`);
		await giornoConAttivita.click();
		await expect(page.getByText(nota, { exact: true })).toBeVisible();

		await page.getByRole("link", { name: "Torna al calendario", exact: true }).click();
		await page.getByRole("link", { name: "Riepilogo mese", exact: true }).click();
		await expect(page.getByTestId("summary-ore-totali-value")).toHaveText("6");
		await expect(page.getByTestId("summary-table")).toContainText(
			cliente.ragioneSociale,
		);

		await page
			.getByRole("link", { name: "Console amministrativa", exact: true })
			.click();
		await page.waitForURL("**/anagrafiche/clienti");
		await page.getByRole("link", { name: "Le mie attività", exact: true }).click();
		await page.waitForURL("**/attivita");
	});
});
