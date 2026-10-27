import { readFile } from "node:fs/promises";

import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";
import { mesiIndietroPerTentativo } from "./support/date";
import { test, expect } from "./support/fixtures";
import { creaDatasetReportFatturazioneClienti } from "./support/report-data";
import { leggiXlsx } from "./support/xlsx-lettura";

/**
 * Test e2e — US-018: esportazione Excel del report mensile per cliente.
 *
 * Il mese è riservato in modo esclusivo (slot in `support/date.ts`): il test
 * confronta i "Totale mese" del file con i totali globali mostrati a schermo.
 */

const CODICE_SPEC_ESPORTAZIONE = "US-018-ESPORTAZIONE-FATTURAZIONE";
const TIPO_XLSX = "spreadsheetml";

/** "1.234,56 €" → 1234.56 */
function euroComeNumero(testo: string): number {
  return Number(testo.replace(/[^\d,-]/g, "").replace(",", "."));
}

test.describe("Esportazione report fatturazione clienti", () => {
  test("il file scaricato contiene gli stessi dati e totali dello schermo", async ({
    page,
    factory,
  }) => {
    const dataset = await creaDatasetReportFatturazioneClienti(factory, {
      codiceSpec: CODICE_SPEC_ESPORTAZIONE,
      mesiIndietro: mesiIndietroPerTentativo(test.info()),
    });
    const clienteAtteso = dataset.atteso.perCliente[0];
    const offertaAttesa = clienteAtteso.perOfferta[0];

    await accediComeAdmin(page);
    await page.goto(`/report/fatturazione-clienti?mese=${dataset.mese}`);

    // Valori mostrati a schermo
    const testo = async (testId: string) =>
      euroComeNumero(await page.getByTestId(testId).innerText());
    const schermo = {
      clienteRimborsi: await testo(`report-client-${dataset.cliente.id}-rimborsi`),
      clienteTotale: await testo(`report-client-${dataset.cliente.id}-totale`),
      meseImponibile: await testo("report-total-imponibile"),
      meseRimborsi: await testo("report-total-rimborsi"),
      meseTotale: await testo("report-total-importo"),
    };

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("esporta-excel").click(),
    ]);
    expect(download.suggestedFilename()).toBe(
      `fatturazione-clienti-${dataset.mese}.xlsx`,
    );

    const xlsx = leggiXlsx(await readFile(await download.path()));
    expect(xlsx.fogli.map((f) => f.nome)).toEqual([
      "Fatturazione clienti",
      "Dettaglio collaboratori",
    ]);
    const [riepilogo, dettaglio] = xlsx.fogli;

    // Colonne: 0 cliente, 1 codice, 4 giornate, 5 imponibile, 6 rimborsi, 7 totale
    const rigaOfferta = riepilogo.righe.find(
      (r) => r[1] === dataset.offerta.codice,
    );
    expect(rigaOfferta?.[0]).toBe(dataset.cliente.ragioneSociale);
    expect(rigaOfferta?.[5]).toBe(Number(offertaAttesa.totali.imponibile));

    const totaleCliente = riepilogo.righe.find(
      (r) => r[0] === `Totale ${dataset.cliente.ragioneSociale}`,
    );
    expect(totaleCliente?.[6]).toBe(schermo.clienteRimborsi);
    expect(totaleCliente?.[7]).toBe(schermo.clienteTotale);

    const totaleMese = riepilogo.righe.find((r) => r[0] === "Totale mese");
    expect(totaleMese?.[5]).toBe(schermo.meseImponibile);
    expect(totaleMese?.[6]).toBe(schermo.meseRimborsi);
    expect(totaleMese?.[7]).toBe(schermo.meseTotale);

    for (const { collaboratore } of dataset.collaboratori) {
      expect(
        dettaglio.righe.some(
          (r) =>
            r[0] === dataset.cliente.ragioneSociale &&
            typeof r[2] === "string" &&
            r[2].includes(collaboratore.cognome),
        ),
      ).toBe(true);
    }
  });

  test("il collaboratore non può scaricare il file", async ({
    page,
    collaboratore,
  }) => {
    await accediComeCollaboratore(page, collaboratore.utente.email);

    const risposta = await page.request.get(
      "/report/fatturazione-clienti/esporta?mese=2026-01",
    );

    expect(risposta.status()).toBe(403);
    expect(risposta.headers()["content-type"]).not.toContain(TIPO_XLSX);
  });

  test("senza sessione la richiesta viene reindirizzata alla radice", async ({
    request,
  }) => {
    const risposta = await request.get(
      "/report/fatturazione-clienti/esporta?mese=2026-01",
      { maxRedirects: 0 },
    );

    expect(risposta.status()).toBeGreaterThanOrEqual(300);
    expect(risposta.status()).toBeLessThan(400);
    expect(new URL(risposta.headers()["location"], "http://localhost").pathname).toBe("/");
    expect(risposta.headers()["content-type"] ?? "").not.toContain(TIPO_XLSX);
  });
});
