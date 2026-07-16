import type { Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import {
  creaDatasetReportFatturazioneClienti,
  type DatasetReportFatturazioneClienti,
} from "./support/report-data";

/**
 * Demo scenario — US-015/US-023: Report mensile degli importi da fatturare per cliente.
 *
 * L'amministratore apre il report dalla sidebar e verifica, per un mese
 * riservato, il cliente e l'offerta creati dallo scenario con tariffa,
 * giornate, imponibile, rimborsi e totale esatti. Il gate resta indipendente
 * dal seed globale e dagli altri scenari e2e.
 *
 * Registra un video per la review.
 */

const CODICE_SPEC_DEMO = "US-023-TASK-08-REPORT-FATTURAZIONE-CLIENTI-DEMO";

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

async function verificaDatasetReportDemo(
  page: Page,
  dataset: DatasetReportFatturazioneClienti,
): Promise<void> {
  const clienteAtteso = dataset.atteso.perCliente[0];
  const offertaAttesa = clienteAtteso.perOfferta[0];

  await expect(
    page.getByRole("heading", { name: "Importi da fatturare per cliente" }),
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

  await expect(
    page.getByTestId(`report-client-${clienteAtteso.clienteId}`),
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

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-015 Demo", () => {
  test("l'amministratore apre il report e vede importi esatti del dataset e2e", async ({
    page,
    factory,
  }) => {
    test.setTimeout(60_000);

    const dataset = await creaDatasetReportFatturazioneClienti(factory, {
      codiceSpec: CODICE_SPEC_DEMO,
      tariffaGiornaliera: "640.00",
    });

    // ── 1. Login amministratore tramite endpoint e2e ──────────────
    await accediAlBackOfficeComeAdmin(page);
    await expect(
      page.getByRole("banner").getByText("Tech Reloaded"),
    ).toBeVisible();

    // ── 2. Apre "Fatturazione clienti" dalla sidebar ───────────────
    await page
      .getByRole("link", { name: "Fatturazione clienti", exact: true })
      .click();
    await page.waitForURL("**/report/fatturazione-clienti");

    // ── 3. Seleziona direttamente il mese riservato del dataset ────
    await page.goto(`/report/fatturazione-clienti?mese=${dataset.mese}`);
    await page.waitForURL(`**/report/fatturazione-clienti?mese=${dataset.mese}`);

    // ── 4. Verifica dettaglio e riepilogo con valori esatti ─────────
    await verificaDatasetReportDemo(page, dataset);
    await expect(page.getByText("TechSolutions Srl")).toHaveCount(0);

    // ── 5. Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
