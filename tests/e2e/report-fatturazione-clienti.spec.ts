import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import { dataNelMesePassatoRiservato, mesePassatoRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";
import {
  creaDatasetReportFatturazioneClienti,
  meseVuotoReportFatturazioneClienti,
  type DatasetReportFatturazioneClienti,
} from "./support/report-data";
import {
  intervalloNuoviScaglioniKm,
  sogliaStabileInIntervallo,
} from "./support/reserved-resources";

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

// ── Helper US-037: dettaglio collaboratori per offerta ──────────────

function regionDettaglio(page: Page, ragioneSociale: string) {
  return page.getByRole("region", {
    name: `Dettaglio collaboratori ${ragioneSociale}`,
  });
}

function bottoneDettaglio(page: Page, ragioneSociale: string) {
  return page.getByRole("button", {
    name: `Dettaglio collaboratori ${ragioneSociale}`,
  });
}

/**
 * La pagina report è un client component: il primo click dopo una navigazione
 * documentale può cadere prima dell'idratazione di React ed essere un no-op.
 * Ritentiamo il click con expect.toPass finché aria-expanded conferma
 * l'espansione. Un click no-op non muta lo stato, quindi non c'è oscillazione.
 */
async function espandiDettaglio(
  page: Page,
  ragioneSociale: string,
): Promise<void> {
  const bottone = bottoneDettaglio(page, ragioneSociale);
  await expect(async () => {
    await bottone.click();
    await expect(bottone).toHaveAttribute("aria-expanded", "true");
  }).toPass();
}

/** Localizza il gruppo-offerta nella region tramite il suo data-testid stabile. */
function gruppoOffertaNelDettaglio(
  page: Page,
  ragioneSociale: string,
  codiceOfferta: string,
) {
  return regionDettaglio(page, ragioneSociale).getByTestId(
    `dettaglio-offerta-${codiceOfferta}`,
  );
}

function dataRiservataReport(codiceSpec: string, giorno: number): Date {
  return new Date(
    `${dataNelMesePassatoRiservato(codiceSpec, giorno)}T00:00:00.000Z`,
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

  test("espande il dettaglio collaboratori per offerta con imponibili che quadrano", async ({
    page,
    factory,
  }) => {
    const codiceSpec = "US-037-DETTAGLIO-COLLABORATORI";
    const mese = mesePassatoRiservato(codiceSpec);
    const suffisso = randomUUID().slice(0, 8);

    const cliente = await factory.createCliente({
      ragioneSociale: `E2E US-037 Dettaglio ${suffisso}`,
    });
    const offerta1 = await factory.createOfferta({
      cliente,
      codice: `US037-A-${suffisso}`,
      descrizione: `Offerta A dettaglio ${suffisso}`,
      tariffaGiornaliera: "640.00",
    });
    const offerta2 = await factory.createOfferta({
      cliente,
      codice: `US037-B-${suffisso}`,
      descrizione: `Offerta B dettaglio ${suffisso}`,
      tariffaGiornaliera: "400.00",
    });
    const ada = await factory.createCollaboratore({
      nome: "Ada",
      cognome: "Lovelace",
    });
    const grace = await factory.createCollaboratore({
      nome: "Grace",
      cognome: "Hopper",
    });

    await factory.createRigaAttivita({
      collaboratore: ada,
      cliente,
      offerta: offerta1,
      data: dataRiservataReport(codiceSpec, 5),
      ore: "8.00",
      fatturabile: true,
    });
    await factory.createRigaAttivita({
      collaboratore: grace,
      cliente,
      offerta: offerta1,
      data: dataRiservataReport(codiceSpec, 6),
      ore: "4.00",
      fatturabile: true,
    });
    await factory.createRigaAttivita({
      collaboratore: grace,
      cliente,
      offerta: offerta2,
      data: dataRiservataReport(codiceSpec, 12),
      ore: "8.00",
      fatturabile: true,
    });

    await page.goto(`/report/fatturazione-clienti?mese=${mese}`);
    await page.waitForURL(`**/report/fatturazione-clienti?mese=${mese}`);

    await espandiDettaglio(page, cliente.ragioneSociale);
    await expect(regionDettaglio(page, cliente.ragioneSociale)).toBeVisible();

    // AC-1 — gruppo offerta1: Ada 8h/1gg/640, Grace 4h/0,5gg/320, in ore decrescenti.
    const gruppoOfferta1 = gruppoOffertaNelDettaglio(
      page,
      cliente.ragioneSociale,
      offerta1.codice,
    );
    const righeOfferta1 = gruppoOfferta1.getByRole("row");
    await expect(righeOfferta1).toHaveCount(3);
    await expect(righeOfferta1.nth(1)).toContainText("Ada Lovelace");
    await expect(righeOfferta1.nth(2)).toContainText("Grace Hopper");

    const celleAda = gruppoOfferta1
      .getByRole("row")
      .filter({ hasText: "Ada Lovelace" })
      .getByRole("cell");
    await expect(celleAda.nth(1)).toHaveText("8 h");
    await expect(celleAda.nth(2)).toHaveText("1 gg");
    await expect(celleAda.nth(3)).toHaveText(formattaEuro("640.00"));

    const celleGrace1 = gruppoOfferta1
      .getByRole("row")
      .filter({ hasText: "Grace Hopper" })
      .getByRole("cell");
    await expect(celleGrace1.nth(1)).toHaveText("4 h");
    await expect(celleGrace1.nth(2)).toHaveText("0,5 gg");
    await expect(celleGrace1.nth(3)).toHaveText(formattaEuro("320.00"));

    // AC-1 — gruppo offerta2: Grace 8h/1gg/400.
    const gruppoOfferta2 = gruppoOffertaNelDettaglio(
      page,
      cliente.ragioneSociale,
      offerta2.codice,
    );
    await expect(gruppoOfferta2.getByRole("row")).toHaveCount(2);
    const celleGrace2 = gruppoOfferta2
      .getByRole("row")
      .filter({ hasText: "Grace Hopper" })
      .getByRole("cell");
    await expect(celleGrace2.nth(1)).toHaveText("8 h");
    await expect(celleGrace2.nth(2)).toHaveText("1 gg");
    await expect(celleGrace2.nth(3)).toHaveText(formattaEuro("400.00"));

    // AC-2 — senza rimborsi il totale da fatturare coincide con la somma degli
    // imponibili mostrati nel dettaglio: 640 + 320 + 400 = 1360.
    await expect(
      page.getByTestId(`report-client-${cliente.id}-totale`),
    ).toHaveText(formattaEuro("1360.00"));
  });

  test("una sola scheda cliente espansa alla volta", async ({
    page,
    factory,
  }) => {
    const codiceSpec = "US-037-ESPANSIONE-SINGOLA";
    const mese = mesePassatoRiservato(codiceSpec);
    const suffisso = randomUUID().slice(0, 8);

    const clienteA = await factory.createCliente({
      ragioneSociale: `E2E US-037 Espansione A ${suffisso}`,
    });
    const offertaA = await factory.createOfferta({
      cliente: clienteA,
      codice: `US037-EA-${suffisso}`,
    });
    const collaboratoreA = await factory.createCollaboratore({
      nome: "Alan",
      cognome: "Turing",
    });
    await factory.createRigaAttivita({
      collaboratore: collaboratoreA,
      cliente: clienteA,
      offerta: offertaA,
      data: dataRiservataReport(codiceSpec, 5),
      ore: "8.00",
      fatturabile: true,
    });

    const clienteB = await factory.createCliente({
      ragioneSociale: `E2E US-037 Espansione B ${suffisso}`,
    });
    const offertaB = await factory.createOfferta({
      cliente: clienteB,
      codice: `US037-EB-${suffisso}`,
    });
    const collaboratoreB = await factory.createCollaboratore({
      nome: "Edsger",
      cognome: "Dijkstra",
    });
    await factory.createRigaAttivita({
      collaboratore: collaboratoreB,
      cliente: clienteB,
      offerta: offertaB,
      data: dataRiservataReport(codiceSpec, 6),
      ore: "8.00",
      fatturabile: true,
    });

    await page.goto(`/report/fatturazione-clienti?mese=${mese}`);
    await page.waitForURL(`**/report/fatturazione-clienti?mese=${mese}`);

    await espandiDettaglio(page, clienteA.ragioneSociale);
    await expect(regionDettaglio(page, clienteA.ragioneSociale)).toBeVisible();

    // Espandendo B, A si richiude: una sola scheda espansa alla volta.
    await bottoneDettaglio(page, clienteB.ragioneSociale).click();
    await expect(regionDettaglio(page, clienteB.ragioneSociale)).toBeVisible();
    await expect(regionDettaglio(page, clienteA.ragioneSociale)).toHaveCount(0);
    await expect(
      bottoneDettaglio(page, clienteA.ragioneSociale),
    ).toHaveAttribute("aria-expanded", "false");

    // Riselezionando B la scheda si richiude.
    await bottoneDettaglio(page, clienteB.ragioneSociale).click();
    await expect(regionDettaglio(page, clienteB.ragioneSociale)).toHaveCount(0);
    await expect(
      bottoneDettaglio(page, clienteB.ragioneSociale),
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("cliente presente solo per rimborsi mostra il messaggio", async ({
    page,
    factory,
  }) => {
    const codiceSpec = "US-037-SOLO-RIMBORSI";
    const mese = mesePassatoRiservato(codiceSpec);
    const suffisso = randomUUID().slice(0, 8);

    const intervalloKm = intervalloNuoviScaglioniKm(
      1_037_000,
      1_037_999,
      "tests/e2e/report-fatturazione-clienti.spec.ts — US-037 solo rimborsi",
    );
    const kmRiservato = sogliaStabileInIntervallo(intervalloKm, factory.namespace);
    await factory.createScaglioneKm({ finoAKm: kmRiservato, importo: "27.50" });

    const cliente = await factory.createCliente({
      ragioneSociale: `E2E US-037 Solo rimborsi ${suffisso}`,
    });
    const offerta = await factory.createOfferta({
      cliente,
      codice: `US037-SR-${suffisso}`,
    });
    const collaboratore = await factory.createCollaboratore({
      nome: "Radia",
      cognome: "Perlman",
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente,
      offerta,
      data: dataRiservataReport(codiceSpec, 7),
      ore: "4.00",
      fatturabile: false,
      trasfertaKm: kmRiservato,
    });

    await page.goto(`/report/fatturazione-clienti?mese=${mese}`);
    await page.waitForURL(`**/report/fatturazione-clienti?mese=${mese}`);

    await espandiDettaglio(page, cliente.ragioneSociale);

    const region = regionDettaglio(page, cliente.ragioneSociale);
    await expect(
      region.getByText(
        "Nessuna ora fatturabile nel mese: il cliente compare solo per rimborsi trasferta",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(region.getByRole("table")).toHaveCount(0);
  });
});
