import { accediComeAdmin } from "./support/auth";
import {
	dataNelMese,
	mesePassatoRiservato,
	meseRiservato,
} from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Test e2e — Dettaglio collaboratore
 *
 * Scenari:
 * - Navigazione dalla riga dell'elenco al dettaglio con anagrafica e link
 *   "Modifica" sulla riga che resta intatto
 * - Offerte abilitate: solo le attive, raggruppate per cliente con gruppi
 *   collassabili, giorni fatturati dal collaboratore e riga che apre il foglio
 *   attività in vista Elenco filtrato sull'offerta, sull'ultimo mese con ore;
 *   nessun riepilogo mensile delle attività
 */

// Mesi riservati alla spec: mesePrecedente < meseRecente in ordine cronologico,
// così l'ultimo mese con ore atteso è stabile.
const meseRecente = meseRiservato("US-038");
const mesePrecedente = mesePassatoRiservato("US-038", 1);

function dataNelMeseUtc(meseToken: string, giorno: number): Date {
	return new Date(`${dataNelMese(meseToken, giorno)}T00:00:00.000Z`);
}

function testoLetterale(valore: string): RegExp {
	return new RegExp(valore.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

test.describe("Dettaglio collaboratore", () => {
	test.beforeEach(async ({ page }) => {
		await accediComeAdmin(page);
	});

	test("dall’elenco persone alla scheda e alle attività", async ({ page, factory }) => {
    const persona = await factory.createCollaboratore({ tariffaGiornaliera: "432.50" });
    await page.goto("/anagrafiche/persone");
    const nome = `${persona.utente.nome} ${persona.utente.cognome}`;
    await page.getByRole("link", { name: nome, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/anagrafiche/persone/${persona.utente.id}$`));
    await expect(page.getByRole("heading", { name: nome, exact: true })).toBeVisible();
    await expect(page.getByLabel("Scheda persona", { exact: true }).filter({ has: page.getByRole("heading", { level: 1 }) })).toHaveAttribute("data-idratata", "true");
    await page.getByRole("tab", { name: "Attività e compensi", exact: true }).click();
    await expect(page.getByTestId("tariffa-attuale")).toContainText(/432,50\s*€\s*\/ giorno/);
    await page.getByRole("link", { name: "Tutte le persone", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Persone", exact: true })).toBeVisible();
  });

	test("offerte abilitate attive per cliente, giorni fatturati e apertura del foglio sull'offerta", async ({
		page,
		factory,
	}) => {
		const marcatore = factory.namespace.replace(/[^a-z0-9]/gi, "").toUpperCase();
		const cliente = await factory.createCliente({
			ragioneSociale: `Cliente dettaglio ${marcatore}`,
		});
		const offertaConOre = await factory.createOfferta({
			cliente,
			codice: `${marcatore}-ORE`,
		});
		const offertaSenzaOre = await factory.createOfferta({
			cliente,
			codice: `${marcatore}-ZERO`,
		});
		const offertaNonAttiva = await factory.createOfferta({
			cliente,
			codice: `${marcatore}-OFF`,
			attiva: false,
		});
		const collaboratore = await factory.createCollaboratore();
		const id = collaboratore.collaboratore.id;
		for (const offerta of [offertaConOre, offertaSenzaOre, offertaNonAttiva]) {
			await factory.createAbilitazioneOfferta({ collaboratore, offerta });
		}

		// 8 + 4 ore fatturate (fatturabile e non fatturabile) = 1,5 giorni;
		// l'investimento non si fattura ma rende meseRecente l'ultimo mese con ore.
		await factory.createRigaAttivita({
			collaboratore,
			offerta: offertaConOre,
			data: dataNelMeseUtc(mesePrecedente, 10),
			ore: "8",
			categoria: "FATTURABILE",
		});
		await factory.createRigaAttivita({
			collaboratore,
			offerta: offertaConOre,
			data: dataNelMeseUtc(mesePrecedente, 12),
			ore: "4",
			categoria: "NON_FATTURABILE",
		});
		await factory.createRigaAttivita({
			collaboratore,
			offerta: offertaConOre,
			data: dataNelMeseUtc(meseRecente, 15),
			ore: "4",
			categoria: "INVESTIMENTO",
		});

		await page.goto(`/anagrafiche/collaboratori/${id}`);

		const tabella = page.getByRole("table", {
			name: "Offerte abilitate",
			exact: true,
		});
		const gruppoCliente = tabella.getByRole("button", {
			name: testoLetterale(cliente.ragioneSociale),
		});
		const rigaConOre = tabella.getByRole("row", { name: offertaConOre.codice });
		const rigaSenzaOre = tabella.getByRole("row", { name: offertaSenzaOre.codice });

		// Solo le offerte attive, sotto l'intestazione del cliente.
		await expect(gruppoCliente).toContainText("2 offerte");
		await expect(rigaConOre.getByRole("cell", { name: "1,5", exact: true })).toBeVisible();
		await expect(rigaSenzaOre.getByRole("cell", { name: "0", exact: true })).toBeVisible();
		await expect(tabella).not.toContainText(offertaNonAttiva.codice);

		// Nessun riepilogo mensile delle attività.
		await expect(page.getByRole("table", { name: /^Attività di / })).toHaveCount(0);

		// Il gruppo cliente si comprime e si riespande. Il primo clic può cadere
		// prima dell'idratazione: il ritentativo non oscilla perché si attende lo
		// stato compresso.
		await expect(async () => {
			await gruppoCliente.click();
			await expect(gruppoCliente).toHaveAttribute("aria-expanded", "false", { timeout: 1_000 });
		}).toPass({ timeout: 15_000 });
		await expect(rigaConOre).toHaveCount(0);
		await gruppoCliente.click();
		await expect(gruppoCliente).toHaveAttribute("aria-expanded", "true");

		// Clic su una cella neutra della riga: foglio in vista Elenco filtrato
		// sull'offerta, aperto sull'ultimo mese con ore.
		await rigaConOre.getByRole("cell", { name: "1,5", exact: true }).click();
		await page.waitForURL(
			`**/attivita?offerta=${offertaConOre.id}&mese=${meseRecente}&vista=elenco&collaboratore=${id}`,
		);
		await expect(
			page.getByRole("region", { name: "Elenco delle attività del mese" }),
		).toBeVisible();

		// Senza ore il foglio si apre filtrato sull'offerta, sul mese corrente.
		await page.goto(`/anagrafiche/collaboratori/${id}`);
		await expect(tabella.getByRole("link", { name: offertaSenzaOre.codice, exact: true })).toHaveAttribute(
			"href",
			`/attivita?offerta=${offertaSenzaOre.id}&vista=elenco&collaboratore=${id}`,
		);
	});
});
