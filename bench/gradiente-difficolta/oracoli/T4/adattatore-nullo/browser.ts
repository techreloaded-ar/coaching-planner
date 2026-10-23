// Adattatore della baseline T4: pagine e locator reali della baseline (riferimento di mappatura).
import type { AdattatoreBrowser } from "../contratto";

export const adattatoreBrowser: AdattatoreBrowser = {
	percorsoRiepilogo: (token) => `/attivita/riepilogo?mese=${token}`,
	importoFatturaRiepilogo: (page) => page.getByTestId("summary-importo-fattura-value"),
	giornateFatturabiliRiepilogo: (page) => page.getByTestId("summary-giornate-fatturabili"),
	async apriAvanzamentoOfferta(page, offerta) {
		await page.goto("/offerte");
		return page.getByTestId("contenitore-tabella-offerte").getByRole("row").filter({ hasText: offerta.codice }).first();
	},
	percorsoAvanzamento: () => "/offerte",
	percorsoReportFatturazione: (token) => `/report/fatturazione-clienti?mese=${token}`,
	schedaClienteReport: (page, clienteId) => page.getByTestId(`report-client-${clienteId}`),
};
