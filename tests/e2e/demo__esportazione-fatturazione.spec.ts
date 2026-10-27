import { readFile } from "node:fs/promises";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import { creaDatasetReportFatturazioneClienti } from "./support/report-data";
import { leggiXlsx } from "./support/xlsx-lettura";

/**
 * Demo scenario — US-018: esportazione Excel del report mensile per cliente.
 *
 * L'amministratore apre "Fatturazione clienti" dalla sidebar, clicca
 * "Esporta Excel" e scarica un file con gli stessi dati visualizzati a schermo.
 *
 * Registra un video per la review.
 */

const CODICE_SPEC_DEMO = "US-018-DEMO-ESPORTAZIONE";

const formattatoreEuro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-018 Demo", () => {
  test("l'amministratore esporta il report mensile e il file contiene gli stessi dati dello schermo", async ({
    page,
    factory,
  }) => {
    test.setTimeout(60_000);

    const dataset = await creaDatasetReportFatturazioneClienti(factory, {
      codiceSpec: CODICE_SPEC_DEMO,
    });
    const clienteAtteso = dataset.atteso.perCliente[0];

    // ── 1. Accede alla console e apre "Fatturazione clienti" ───────
    await accediAlBackOfficeComeAdmin(page);
    await page
      .getByRole("link", { name: "Fatturazione clienti", exact: true })
      .click();
    await page.waitForURL("**/report/fatturazione-clienti");

    // ── 2. Seleziona il mese del dataset e legge i dati a schermo ──
    await page.goto(`/report/fatturazione-clienti?mese=${dataset.mese}`);
    const totaleSchermo = page.getByTestId(
      `report-client-${dataset.cliente.id}-totale`,
    );
    await expect(totaleSchermo).toHaveText(
      formattatoreEuro.format(Number(clienteAtteso.totali.totale)),
    );

    // ── 3. Clicca "Esporta Excel" e scarica il file ────────────────
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("esporta-excel").click(),
    ]);
    expect(download.suggestedFilename()).toBe(
      `fatturazione-clienti-${dataset.mese}.xlsx`,
    );

    // ── 4. Il file contiene gli stessi dati e totali dello schermo ─
    const [riepilogo] = leggiXlsx(await readFile(await download.path())).fogli;
    const totaleCliente = riepilogo.righe.find(
      (r) => r[0] === `Totale ${dataset.cliente.ragioneSociale}`,
    );
    expect(totaleCliente?.[7]).toBe(Number(clienteAtteso.totali.totale));
    await expect(page.getByTestId("esporta-excel")).toBeVisible();

    // ── 5. Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
