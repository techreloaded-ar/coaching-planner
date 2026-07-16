import { randomUUID } from "node:crypto";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import { attendiTabellaOfferteClienteIdratata } from "./support/offerte";

function codiceUnivoco(): string {
	return `E2E-DEMO-DET-CLIENTE-${randomUUID().slice(0, 8)}`.toUpperCase();
}

test.describe("US-033 Demo", () => {
	test("l'amministratore espande l'avanzamento di un'offerta del cliente e ne apre la modifica", async ({
		page,
		factory,
	}) => {
		const codice = codiceUnivoco();
		const { cliente, offerta } = await factory.createClienteConOfferta(
			{ ragioneSociale: `E2E Demo Dettaglio Cliente ${codice}` },
			{ codice, giorniPrevisti: 10 },
		);
		const collaboratore = await factory.createCollaboratore({
			nome: "Ada",
			cognome: codice,
		});
		await factory.createRigaAttivita({
			cliente,
			offerta,
			collaboratore,
			ore: "16.00",
			fatturabile: true,
		});

		await accediAlBackOfficeComeAdmin(page);
		await page.goto(`/anagrafiche/clienti/${cliente.id}`);

		const tabella = page.getByRole("table", { name: "Offerte del cliente" });
		// L'espansione della riga è un handler client: attendere l'idratazione.
		await attendiTabellaOfferteClienteIdratata(page);

		const riga = tabella.getByRole("row", { name: new RegExp(codice) });
		await expect(riga).toBeVisible();

		await riga.getByText(codice, { exact: true }).click();

		const dettaglio = page.getByRole("region", {
			name: `Dettaglio avanzamento ${codice}`,
		});
		await expect(dettaglio).toBeVisible();
		await expect(dettaglio.getByText("In corso", { exact: true })).toBeVisible();
		await expect(dettaglio.getByText("20%", { exact: true })).toBeVisible();
		await expect(
			dettaglio.getByRole("row", { name: new RegExp(`Ada ${codice}`) }),
		).toBeVisible();

		await riga.getByText(codice, { exact: true }).click();
		await expect(dettaglio).toHaveCount(0);

		await riga.getByRole("link", { name: "Modifica" }).click();
		await page.waitForURL(
			`**/anagrafiche/clienti/${cliente.id}/offerte/${offerta.id}`,
		);
		await expect(page.getByLabel("Codice")).toHaveValue(codice);
	});
});
