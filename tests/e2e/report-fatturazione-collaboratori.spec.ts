import { accediComeAdmin } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Fatturazione collaboratori: per un mese l'amministratore vede la fattura
 * attesa da ogni collaboratore (stesso importo del suo riepilogo mensile),
 * i fogli vuoti evidenziati e il link al foglio attività di quel mese.
 *
 * Le asserzioni riguardano solo le righe dei collaboratori creati dal test:
 * i totali del mese includono anche gli altri collaboratori attivi.
 */

const CODICE_SPEC = "REPORT-FATTURAZIONE-COLLABORATORI";

test.describe("Fatturazione collaboratori", () => {
	test("mostra le fatture attese del mese e apre il foglio del collaboratore", async ({
		page,
		factory,
	}) => {
		const mese = meseRiservato(CODICE_SPEC);
		const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
		const conAttivita = await factory.createCollaboratore({ tariffaGiornaliera: "400.00" });
		const senzaAttivita = await factory.createCollaboratore({ tariffaGiornaliera: "420.00" });
		const { cliente, offerta } = await factory.createClienteConOfferta();
		await factory.createRigaAttivita({
			collaboratore: conAttivita,
			cliente,
			offerta,
			data: new Date(`${dataNelMese(mese, 10)}T00:00:00.000Z`),
			ore: "12.00",
			categoria: "FATTURABILE",
			rimborsoTrasfertaEtichetta: "Trasferta",
			rimborsoTrasfertaImporto: "35.00",
		});

		await accediComeAdmin(page, amministratore.email);
		await page.goto("/anagrafiche/clienti");
		await page.getByRole("link", { name: "Fatturazione collaboratori", exact: true }).click();
		await page.waitForURL("**/report/fatturazione-collaboratori**");
		await expect(page.getByRole("heading", { level: 1, name: "Fatture attese dai collaboratori" })).toBeVisible();

		await page.goto(`/report/fatturazione-collaboratori?mese=${mese}`);

		// 1,5 g × 400 = 600 di prestazioni, più 35 di rimborsi.
		const riga = page.getByTestId(`fattura-collaboratore-${conAttivita.collaboratore.id}`);
		await expect(riga).toContainText(/400,00.*\/ giorno/);
		await expect(riga).toContainText("1,5");
		await expect(riga).toContainText("600,00");
		await expect(riga).toContainText("35,00");
		await expect(riga).toContainText("635,00");
		await expect(riga).not.toContainText("Foglio vuoto");

		const rigaVuota = page.getByTestId(`fattura-collaboratore-${senzaAttivita.collaboratore.id}`);
		await expect(rigaVuota).toContainText("Foglio vuoto");
		await expect(rigaVuota).toContainText(/420,00.*\/ giorno/);

		// Il nome apre il foglio attività del collaboratore per quel mese.
		const nome = `${conAttivita.collaboratore.nome} ${conAttivita.collaboratore.cognome}`;
		await riga.getByRole("link", { name: nome, exact: true }).click();
		await page.waitForURL(`**/attivita?mese=${mese}&collaboratore=${conAttivita.collaboratore.id}`);
		await expect(page.getByTestId("banner-foglio-consultato")).toContainText(
			`Stai consultando il foglio di ${nome}`,
		);
	});
});
