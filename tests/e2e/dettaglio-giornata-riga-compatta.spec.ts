import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Incremento: dettaglio giornata più compatto.
 *
 * La categoria sta sotto le ore, il rimborso trasferta segue l'offerta (niente
 * riga dedicata a chip e rimborso) e il riepilogo della giornata sta sotto le
 * attività, a destra del form di inserimento, senza dover scorrere oltre il form.
 */

const MESE = meseRiservato("INC-RIGA-COMPATTA-11");

function dataDb(dataIso: string): Date {
	return new Date(`${dataIso}T00:00:00.000Z`);
}

test("la riga attività porta la categoria sotto le ore e il riepilogo sta accanto al form", async ({
	page,
	factory,
}) => {
	const data = dataNelMese(MESE, 9);
	const collaboratore = await factory.createCollaboratore();
	const { cliente, offerta } = await factory.createClienteConOfferta();
	await factory.createAbilitazioneOfferta({ collaboratore, offerta });
	const etichettaRimborso = `Trasferta ${offerta.codice}`;
	await factory.createRigaAttivita({
		collaboratore,
		cliente,
		offerta,
		data: dataDb(data),
		ore: "4.00",
		nota: `Sessione ${offerta.codice}`,
		categoria: "NON_FATTURABILE",
		rimborsoTrasfertaEtichetta: etichettaRimborso,
		rimborsoTrasfertaImporto: "35.00",
	});

	await accediComeCollaboratore(page, collaboratore.utente.email);
	await page.goto(`/attivita/${data}?mese=${MESE}`);

	const riga = page.getByTestId("activity-row").filter({ hasText: `Sessione ${offerta.codice}` });
	const ore = (await riga.getByText("4 h", { exact: true }).boundingBox())!;
	const categoria = (await riga.getByText("Non fatturabile", { exact: true }).boundingBox())!;
	const rimborso = (await riga.getByText(etichettaRimborso).boundingBox())!;
	const nota = (await riga.getByText(`Sessione ${offerta.codice}`).boundingBox())!;

	// Categoria sotto le ore, allineata a destra con esse.
	expect(categoria.y).toBeGreaterThanOrEqual(ore.y + ore.height);
	expect(Math.abs(categoria.x + categoria.width - (ore.x + ore.width))).toBeLessThanOrEqual(1);
	// Rimborso nell'intestazione della riga, prima della nota.
	expect(rimborso.y + rimborso.height).toBeLessThanOrEqual(nota.y);

	// Riepilogo sotto le attività, nella colonna a destra del form.
	const form = (await page.locator("#form-riga").boundingBox())!;
	const attivita = (await page.locator("#attivita-della-giornata").boundingBox())!;
	const riepilogo = page.getByRole("region", { name: "Riepilogo della giornata" });
	const posizioneRiepilogo = (await riepilogo.boundingBox())!;
	expect(posizioneRiepilogo.x).toBeGreaterThanOrEqual(form.x + form.width);
	expect(posizioneRiepilogo.y).toBeGreaterThanOrEqual(attivita.y + attivita.height);
	expect(posizioneRiepilogo.y).toBeLessThan(form.y + form.height);
	await expect(page.getByTestId("day-summary-rimborsi")).toHaveText("35,00 €");
});
