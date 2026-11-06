import { randomUUID } from "node:crypto";

import { accediAlBackOfficeComeAdmin, accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect, type E2eDataFactory } from "./support/fixtures";
import { apriPaginaOfferte } from "./support/offerte";
import { cercaNellElenco } from "./support/elenchi";

/**
 * Righe su offerte a cui il collaboratore non è abilitato: gialle in Elenco,
 * giornata e calendario, per il collaboratore e per l'amministratore; solo
 * l'amministratore può abilitare il collaboratore, previa conferma in linea.
 * Collaboratore, cliente e offerte sono della factory.
 */

const MESE = meseRiservato("OFFERTE-NON-ABILITATE-FOGLIO");
const GIORNO = dataNelMese(MESE, 13);

function dataDb(giorno: string): Date {
	return new Date(`${giorno}T12:00:00.000Z`);
}

/** Una riga su un'offerta abilitata e una su un'offerta non abilitata, nello stesso giorno. */
async function preparaRighe(factory: E2eDataFactory) {
	const codice = `E2E-NOAB-${randomUUID().slice(0, 8)}`.toUpperCase();
	const { cliente, offerta: nonAbilitata } = await factory.createClienteConOfferta(
		{ ragioneSociale: `E2E Non abilitata ${codice}` },
		{ codice, attiva: true },
	);
	const abilitata = await factory.createOfferta({ cliente });
	const collaboratore = await factory.createCollaboratore({ nome: "Ada", cognome: codice });
	await factory.createAbilitazioneOfferta({ collaboratore, offerta: abilitata });
	await factory.createRigaAttivita({ collaboratore, cliente, offerta: abilitata, data: dataDb(GIORNO), ore: "2.00", nota: `Sessione consentita ${codice}` });
	await factory.createRigaAttivita({ collaboratore, cliente, offerta: nonAbilitata, data: dataDb(GIORNO), ore: "6.00", nota: `Sessione da abilitare ${codice}` });
	return { codice, collaboratore, nome: `Ada ${codice}` };
}

test.describe("Righe su offerte non abilitate", () => {
	test("il collaboratore vede il giallo senza poter abilitare", async ({ page, factory }) => {
		const { codice, collaboratore } = await preparaRighe(factory);
		await accediComeCollaboratore(page, collaboratore.utente.email);

		await page.goto(`/attivita?mese=${MESE}&vista=elenco`);
		const elenco = page.getByRole("region", { name: "Elenco delle attività del mese" });
		await expect(elenco).toHaveAttribute("data-idratata", "true");
		const avviso = elenco.getByTestId("avviso-offerta-non-abilitata");
		await expect(avviso).toHaveCount(1);
		await expect(avviso).toHaveText(`Non sei abilitato all'offerta ${codice}.`);
		await expect(elenco.getByRole("button", { name: "Abilita", exact: true })).toHaveCount(0);

		await page.goto(`/attivita?mese=${MESE}`);
		await expect(page.getByTestId("indicatore-offerte-non-abilitate")).toHaveText("1");

		await page.goto(`/attivita/${GIORNO}?mese=${MESE}`);
		await expect(
			page.getByTestId("activity-row").filter({ hasText: `Sessione da abilitare ${codice}` }).getByTestId("avviso-offerta-non-abilitata"),
		).toBeVisible();
		await expect(
			page.getByTestId("activity-row").filter({ hasText: `Sessione consentita ${codice}` }).getByTestId("avviso-offerta-non-abilitata"),
		).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Abilita", exact: true })).toHaveCount(0);
	});

	test("dalla scheda l'amministratore apre l'Elenco e abilita dalla giornata, previa conferma", async ({ page, factory }) => {
		const { codice, collaboratore, nome } = await preparaRighe(factory);
		const idCollaboratore = collaboratore.collaboratore.id;
		await accediAlBackOfficeComeAdmin(page);

		await page.goto(`/anagrafiche/collaboratori/${idCollaboratore}`);
		await page.getByRole("link", { name: "Apri foglio attività" }).click();
		await page.waitForURL(`**/attivita?vista=elenco&collaboratore=${idCollaboratore}`);
		await expect(page.getByRole("link", { name: "Elenco" })).toHaveAttribute("aria-current", "page");

		await page.goto(`/attivita?mese=${MESE}&vista=elenco&collaboratore=${idCollaboratore}`);
		const elenco = page.getByRole("region", { name: "Elenco delle attività del mese" });
		await expect(elenco).toHaveAttribute("data-idratata", "true");
		await expect(elenco.getByTestId("avviso-offerta-non-abilitata")).toContainText(
			`${nome} non è abilitato all'offerta ${codice}.`,
		);

		await page.goto(`/attivita?mese=${MESE}&collaboratore=${idCollaboratore}`);
		await expect(page.getByTestId("indicatore-offerte-non-abilitate")).toHaveText("1");

		await page.goto(`/attivita/${GIORNO}?mese=${MESE}&collaboratore=${idCollaboratore}`);
		const riga = page.getByTestId("activity-row").filter({ hasText: `Sessione da abilitare ${codice}` });
		await riga.getByRole("button", { name: "Abilita", exact: true }).click();
		await expect(riga).toContainText(`Abilitare ${nome} a questa offerta?`);
		await riga.getByRole("button", { name: "No", exact: true }).click();
		await expect(riga.getByTestId("avviso-offerta-non-abilitata")).toBeVisible();

		await riga.getByRole("button", { name: "Abilita", exact: true }).click();
		await riga.getByRole("button", { name: "Abilita", exact: true }).click();
		await expect(riga.getByTestId("avviso-offerta-non-abilitata")).toHaveCount(0);

		// Calendario ed Elenco non mostrano più il giallo.
		await page.goto(`/attivita?mese=${MESE}&collaboratore=${idCollaboratore}`);
		await expect(page.getByTestId("cella-giorno").filter({ hasText: "8.0 h" })).toBeVisible();
		await expect(page.getByTestId("indicatore-offerte-non-abilitate")).toHaveCount(0);
		await page.goto(`/attivita?mese=${MESE}&vista=elenco&collaboratore=${idCollaboratore}`);
		await expect(elenco).toHaveAttribute("data-idratata", "true");
		await expect(elenco.getByTestId("riga-elenco")).toHaveCount(2);
		await expect(elenco.getByTestId("avviso-offerta-non-abilitata")).toHaveCount(0);
	});

	test("nel dettaglio offerta l'amministratore abilita il collaboratore non abilitato", async ({ page, factory }) => {
		const { codice, nome } = await preparaRighe(factory);
		await accediAlBackOfficeComeAdmin(page);
		await apriPaginaOfferte(page);
		await cercaNellElenco(page, "/offerte", codice);
		await page.getByRole("row", { name: new RegExp(codice) }).getByText(codice, { exact: true }).click();

		const riga = page
			.getByRole("region", { name: `Dettaglio avanzamento ${codice}` })
			.getByRole("table", { name: "Giornate erogate per collaboratore", exact: true })
			.getByTestId("collaboratore-avanzamento")
			.filter({ hasText: nome });
		await expect(riga).toContainText("Non abilitato");

		await riga.getByRole("button", { name: "Abilita", exact: true }).click();
		await expect(riga).toContainText(`Abilitare ${nome} a questa offerta?`);
		await riga.getByRole("button", { name: "Abilita", exact: true }).click();
		await expect(riga).toContainText("✓ Abilitato");
		await expect(riga.getByRole("button", { name: "Abilita", exact: true })).toHaveCount(0);
	});
});
