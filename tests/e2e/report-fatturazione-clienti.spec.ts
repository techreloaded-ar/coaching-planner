import type { Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import {
  creaDatasetReportFatturazioneClienti,
  meseVuotoReportFatturazioneClienti,
  type DatasetReportFatturazioneClienti,
} from "./support/report-data";

/**
 * Test e2e — US-015/US-023: Report mensile degli importi da fatturare per cliente.
 *
 * Gli scenari usano mesi riservati e righe create dal test, così i totali
 * verificati non dipendono dal seed globale né da altri scenari e2e.
 */

const CODICE_SPEC_REPORT = "US-023-TASK-08-REPORT-FATTURAZIONE-CLIENTI-SPEC";

const formattatoreEuro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const formattatoreGiornate = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function formattaEuro(valore: string | number): string {
  return formattatoreEuro.format(Number(valore));
}

function formattaGiornate(valore: number): string {
  return formattatoreGiornate.format(valore);
}

async function verificaDatasetReport(
  page: Page,
  dataset: DatasetReportFatturazioneClienti,
): Promise<void> {
  const clienteAtteso = dataset.atteso.perCliente[0];
  const offertaAttesa = clienteAtteso.perOfferta[0];

  await expect(
    page.getByRole("heading", { name: "Importi da fatturare per cliente" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Mese precedente", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Mese successivo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Mese corrente", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByText(clienteAtteso.clienteRagioneSociale, { exact: true }),
  ).toBeVisible();

  const rigaOfferta = page.getByRole("row").filter({
    has: page.getByText(offertaAttesa.offertaCodice, { exact: true }),
  });
  await expect(rigaOfferta).toHaveCount(1);
  await expect(
    rigaOfferta.getByText(offertaAttesa.offertaCodice, { exact: true }),
  ).toBeVisible();
  await expect(
    rigaOfferta.getByText(offertaAttesa.offertaDescrizione, { exact: true }),
  ).toBeVisible();

  const celle = rigaOfferta.locator("td");
  await expect(celle.nth(1)).toHaveText(
    formattaEuro(dataset.offerta.tariffaGiornaliera.toString()),
  );
  await expect(celle.nth(2)).toHaveText(
    formattaGiornate(offertaAttesa.totali.giornate),
  );
  await expect(celle.nth(3)).toHaveText(
    formattaEuro(offertaAttesa.totali.imponibile),
  );

  const schedaCliente = page.getByTestId(`report-client-${clienteAtteso.clienteId}`);
  await expect(schedaCliente).toContainText(clienteAtteso.clienteRagioneSociale);
  await expect(
    schedaCliente.getByText(
      `${formattaGiornate(clienteAtteso.totali.giornate)} giornate fatturabili`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByTestId(`report-client-${clienteAtteso.clienteId}-rimborsi`),
  ).toHaveText(formattaEuro(clienteAtteso.totali.rimborsi));
  await expect(
    page.getByTestId(`report-client-${clienteAtteso.clienteId}-totale`),
  ).toHaveText(formattaEuro(clienteAtteso.totali.totale));

  await expect(page.getByTestId("report-total-imponibile")).toHaveText(
    formattaEuro(dataset.atteso.totali.imponibile),
  );
  await expect(page.getByTestId("report-total-rimborsi")).toHaveText(
    formattaEuro(dataset.atteso.totali.rimborsi),
  );
  await expect(page.getByTestId("report-total-importo")).toHaveText(
    formattaEuro(dataset.atteso.totali.totale),
  );
}

test.describe("Report fatturazione clienti", () => {
  test.beforeEach(async ({ page }) => {
    await accediComeAdmin(page);
  });

  test("mostra cliente, offerta e totali esatti del mese riservato", async ({
    page,
    factory,
  }) => {
    const dataset = await creaDatasetReportFatturazioneClienti(factory, {
      codiceSpec: CODICE_SPEC_REPORT,
      tariffaGiornaliera: "640.00",
    });

    await page.goto(`/report/fatturazione-clienti?mese=${dataset.mese}`);
    await page.waitForURL(`**/report/fatturazione-clienti?mese=${dataset.mese}`);

    await verificaDatasetReport(page, dataset);
    await expect(page.getByText("TechSolutions Srl")).toHaveCount(0);
  });

  test("un mese riservato senza righe del test mostra lo stato vuoto", async ({
    page,
  }) => {
    const meseVuoto = meseVuotoReportFatturazioneClienti();

    await page.goto(`/report/fatturazione-clienti?mese=${meseVuoto}`);
    await page.waitForURL(`**/report/fatturazione-clienti?mese=${meseVuoto}`);

    await expect(
      page.getByRole("heading", {
        name: "Nessuna attività da fatturare per questo mese",
      }),
    ).toBeVisible();
    await expect(page.getByText("TechSolutions Srl")).toHaveCount(0);
    await expect(page.getByText("E2E Report fatturazione")).toHaveCount(0);
  });
});
