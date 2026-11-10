import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Giornata e mese leggono esattamente i propri giorni di calendario.
 *
 * Le date delle righe sono colonne `@db.Date`: con estremi costruiti in ora
 * locale e il server in CET, la giornata includeva anche il giorno precedente
 * e il mese perdeva il proprio ultimo giorno (prendendo l'ultimo del mese
 * precedente). Le righe stanno su giorni adiacenti e ai confini del mese, così
 * lo sfasamento di un giorno si vede in ogni vista.
 */

const MESE = meseRiservato("INC-DATE-GIORNO-FUSO");

function dataDb(dataIso: string): Date {
	return new Date(`${dataIso}T00:00:00.000Z`);
}

/** Ultimo giorno del mese indicato (YYYY-MM), come YYYY-MM-DD. */
function ultimoGiornoDel(mese: string): string {
	const [anno, numero] = mese.split("-").map(Number);
	return new Date(Date.UTC(anno, numero, 0)).toISOString().slice(0, 10);
}

/** Ultimo giorno del mese precedente a quello indicato (YYYY-MM), come YYYY-MM-DD. */
function ultimoGiornoDelMesePrecedente(mese: string): string {
	const [anno, numero] = mese.split("-").map(Number);
	return new Date(Date.UTC(anno, numero - 1, 0)).toISOString().slice(0, 10);
}

test("giornata, calendario e riepilogo mostrano solo le righe dei propri giorni", async ({
	page,
	factory,
}) => {
	const collaboratore = await factory.createCollaboratore();
	const { cliente, offerta } = await factory.createClienteConOfferta();
	await factory.createAbilitazioneOfferta({ collaboratore, offerta });

	const giorno4 = dataNelMese(MESE, 4);
	const giorno5 = dataNelMese(MESE, 5);
	const giorno6 = dataNelMese(MESE, 6);
	const ultimoGiorno = ultimoGiornoDel(MESE);
	const notaGiorno4 = `Riga del giorno 4 ${factory.namespace}`;
	const notaGiorno6 = `Riga del giorno 6 ${factory.namespace}`;

	for (const [data, nota] of [
		[giorno4, notaGiorno4],
		[giorno6, notaGiorno6],
		[ultimoGiorno, `Riga dell'ultimo giorno ${factory.namespace}`],
		[ultimoGiornoDelMesePrecedente(MESE), `Riga del mese precedente ${factory.namespace}`],
	]) {
		await factory.createRigaAttivita({ collaboratore, cliente, offerta, data: dataDb(data), ore: "8.00", nota });
	}

	await accediComeCollaboratore(page, collaboratore.utente.email);
	const righe = page.getByTestId("activity-row");

	// Il giorno 5 non ha righe: né quella del 4 né quella del 6.
	await page.goto(`/attivita/${giorno5}?mese=${MESE}`);
	await expect(page.getByText("Nessuna attività registrata per questa giornata.")).toBeVisible();
	await expect(righe).toHaveCount(0);

	// Ogni giorno mostra soltanto la propria riga.
	await page.goto(`/attivita/${giorno4}?mese=${MESE}`);
	await expect(righe).toHaveCount(1);
	await expect(righe).toContainText(notaGiorno4);
	await page.goto(`/attivita/${giorno6}?mese=${MESE}`);
	await expect(righe).toHaveCount(1);
	await expect(righe).toContainText(notaGiorno6);

	// Il calendario segna l'ultimo giorno del mese e lascia vuoto il giorno 5.
	await page.goto(`/attivita?mese=${MESE}`);
	await expect(page.getByLabel("Calendario mensile delle attività")).toHaveAttribute("data-idratata", "true");
	const cellaUltimoGiorno = page.locator(`a[href="/attivita/${ultimoGiorno}?mese=${MESE}"]`);
	await expect(cellaUltimoGiorno).toHaveAttribute("data-con-attivita", "true");
	await expect(cellaUltimoGiorno.getByTestId("totali-giorno")).toHaveText("8 h");
	await expect(page.locator(`a[href="/attivita/${giorno5}?mese=${MESE}"]`)).not.toHaveAttribute(
		"data-con-attivita",
		"true",
	);

	// Il riepilogo conta i tre giorni del mese (8 h ciascuno), non quello del mese precedente.
	await page.goto(`/attivita/riepilogo?mese=${MESE}`);
	await expect(page.getByTestId("summary-giornate-totali-value")).toHaveText("3");
});
