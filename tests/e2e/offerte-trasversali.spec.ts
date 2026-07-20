import { randomUUID } from "node:crypto";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import { apriPaginaOfferte } from "./support/offerte";

/** Escape per usare un valore come frammento letterale in una RegExp. */
function comeRegExp(valore: string): RegExp {
	return new RegExp(valore.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

test.describe("Pagina offerte trasversale", () => {
	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("elenca l'offerta con avanzamento nel formato erogate/previste", async ({
		page,
		factory,
	}) => {
		const token = randomUUID().slice(0, 8);
		const codice = `OFF-XREF-${token.toUpperCase()}`;
		const ragioneSociale = `E2E XRef Cliente ${token}`;
		const descrizione = `Offerta trasversale ${token}`;

		const { offerta } = await factory.createClienteConOfferta(
			{ ragioneSociale },
			{
				codice,
				descrizione,
				tariffaGiornaliera: "750.00",
				giorniPrevisti: 10,
			},
		);
		// 16 ore fatturabili = 2 giornate erogate (ORE_PER_GIORNATA = 8).
		await factory.createRigaAttivita({
			offerta,
			ore: "16.00",
			fatturabile: true,
		});

		await apriPaginaOfferte(page);

		const riga = page.getByRole("row", { name: comeRegExp(codice) });
		await expect(riga).toBeVisible();
		await expect(riga).toContainText(ragioneSociale);
		await expect(riga).toContainText(descrizione);
		await expect(riga).toContainText("750,00");

		const celle = riga.getByRole("cell");
		await expect(celle.nth(3)).toHaveText(/^2\/10\s*gg$/); // erogate/previste

		const indicatore = riga.getByRole("button", { name: "Disattiva" });
		await expect(indicatore).toBeVisible();
		await expect(indicatore).toHaveAttribute("title", "Offerta attiva");
	});

	test("evidenzia offerte non attive, esaurite e oltre budget nella riga compatta", async ({
		page,
		factory,
	}) => {
		const token = randomUUID().slice(0, 8);

		const codiceNonAttiva = `OFF-OFF-${token.toUpperCase()}`;
		await factory.createOfferta({
			codice: codiceNonAttiva,
			descrizione: `Offerta disattivata ${token}`,
			attiva: false,
		});

		const codiceEsaurita = `OFF-END-${token.toUpperCase()}`;
		const offertaEsaurita = await factory.createOfferta({
			codice: codiceEsaurita,
			descrizione: `Offerta esaurita ${token}`,
			giorniPrevisti: 2,
			attiva: true,
		});
		// 16 ore fatturabili su 2 giornate previste = residuo 0 → Esaurita.
		await factory.createRigaAttivita({
			offerta: offertaEsaurita,
			ore: "16.00",
			fatturabile: true,
		});

		const codiceOltreBudget = `OFF-OVR-${token.toUpperCase()}`;
		const offertaOltreBudget = await factory.createOfferta({
			codice: codiceOltreBudget,
			descrizione: `Offerta oltre budget ${token}`,
			giorniPrevisti: 2,
			attiva: true,
		});
		// 24 ore fatturabili su 2 giornate previste = 3 erogate, residuo −1 → Oltre budget.
		await factory.createRigaAttivita({
			offerta: offertaOltreBudget,
			ore: "24.00",
			fatturabile: true,
		});

		await apriPaginaOfferte(page);

		const rigaNonAttiva = page.getByRole("row", {
			name: comeRegExp(codiceNonAttiva),
		});
		await expect(rigaNonAttiva).toBeVisible();
		const indicatoreNonAttiva = rigaNonAttiva.getByRole("button", {
			name: "Attiva",
			exact: true,
		});
		await expect(indicatoreNonAttiva).toBeVisible();
		await expect(indicatoreNonAttiva).toHaveAttribute(
			"title",
			"Offerta non attiva",
		);

		const rigaEsaurita = page.getByRole("row", {
			name: comeRegExp(codiceEsaurita),
		});
		await expect(rigaEsaurita).toBeVisible();
		await expect(
			rigaEsaurita.getByText("Esaurita", { exact: true }),
		).toBeVisible();
		const indicatoreEsaurita = rigaEsaurita.getByRole("button", {
			name: "Disattiva",
		});
		await expect(indicatoreEsaurita).toBeVisible();
		await expect(indicatoreEsaurita).toHaveAttribute("title", "Offerta attiva");
		await expect(
			rigaEsaurita.getByRole("img", { name: "Erogato 100% del previsto" }),
		).toBeVisible();

		const rigaOltreBudget = page.getByRole("row", {
			name: comeRegExp(codiceOltreBudget),
		});
		await expect(rigaOltreBudget).toBeVisible();
		await expect(
			rigaOltreBudget.getByText("Oltre budget", { exact: true }),
		).toBeVisible();
	});
});

test.describe("Layout compatto a 1366px", () => {
	test.use({ viewport: { width: 1366, height: 768 } });

	test.beforeEach(async ({ page }) => {
		await accediAlBackOfficeComeAdmin(page);
	});

	test("mostra tutte le colonne senza scorrimento orizzontale", async ({
		page,
		factory,
	}) => {
		const token = randomUUID().slice(0, 8);
		const codice = `OFF-WIDE-${token.toUpperCase()}`;
		const ragioneSociale = `E2E Società Consortile per l'Erogazione di Servizi di Ingegneria Integrata e Consulenza Direzionale ${token} S.p.A.`;
		const descrizione = `Offerta quadro pluriennale per attività di analisi, sviluppo, manutenzione evolutiva e supporto operativo continuativo ${token}`;

		await factory.createClienteConOfferta(
			{ ragioneSociale },
			{
				codice,
				descrizione,
				tariffaGiornaliera: "750.00",
				giorniPrevisti: 10,
			},
		);

		await apriPaginaOfferte(page);

		await expect(
			page.getByRole("columnheader", { name: "Giorni erogati" }),
		).toBeVisible();

		const riga = page.getByRole("row", { name: comeRegExp(codice) });
		await expect(riga).toBeVisible();
		await expect(riga.getByRole("link", { name: "Modifica" })).toBeVisible();
		await expect(riga.getByRole("button", { name: "Elimina" })).toBeVisible();

		const contenitore = page.getByTestId("contenitore-tabella-offerte");
		await expect
			.poll(() => contenitore.evaluate((el) => el.scrollWidth - el.clientWidth))
			.toBeLessThanOrEqual(0);
	});
});
