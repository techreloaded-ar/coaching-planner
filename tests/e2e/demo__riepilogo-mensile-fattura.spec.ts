import { randomUUID } from "node:crypto";

import { type Locator, type Page } from "@playwright/test";

import { ORE_PER_GIORNATA } from "../../src/domain/types";
import {
  selezionaClienteEOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseCorrenteToken } from "./support/date";
import {
  test,
  expect,
  type ClienteConOffertaTestData,
  type CollaboratoreTestData,
  type E2eDataFactory,
} from "./support/fixtures";

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 100 },
});

const EPS = 0.01;
const TARIFFA_COLLABORATORE = 400;
const TARIFFA_OFFERTA = 640;

type RiepilogoLetto = {
  oreTotali: number;
  oreFatturabili: number;
  totaleRimborsi: number;
  imponibileManodopera: number;
};

type ScenarioRiepilogo = {
  mese: string;
  collaboratore: CollaboratoreTestData;
  clienteConOfferta: ClienteConOffertaTestData;
};

function parseNumero(valore: string): number {
  const normalizzato = valore.replace(/[^\d,.-]/g, "");
  const ultimoPunto = normalizzato.lastIndexOf(".");
  const ultimaVirgola = normalizzato.lastIndexOf(",");

  if (ultimoPunto >= 0 && ultimaVirgola >= 0) {
    const separatoreDecimale = ultimoPunto > ultimaVirgola ? "." : ",";
    return Number.parseFloat(
      separatoreDecimale === ","
        ? normalizzato.replace(/\./g, "").replace(",", ".")
        : normalizzato.replace(/,/g, ""),
    );
  }

  if (ultimaVirgola >= 0) {
    return Number.parseFloat(normalizzato.replace(/\./g, "").replace(",", "."));
  }

  return Number.parseFloat(normalizzato);
}

async function leggiNumero(page: Page, testId: string): Promise<number> {
  const testo = await page.getByTestId(testId).textContent();
  return parseNumero(testo ?? "0");
}

async function leggiRiepilogo(page: Page): Promise<RiepilogoLetto> {
  const oreTotali = await leggiNumero(page, "summary-ore-totali-value");
  const oreFatturabili = await leggiNumero(page, "summary-ore-fatturabili-value");
  const importoFattura = await leggiNumero(page, "summary-importo-fattura-value");
  const totaleRimborsi = await leggiNumero(page, "summary-rimborsi-value");

  return {
    oreTotali,
    oreFatturabili,
    totaleRimborsi,
    imponibileManodopera: importoFattura - totaleRimborsi,
  };
}

function dataDelMese(mese: string, giorno: number): string {
  return dataNelMese(mese, giorno);
}

function dataDb(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00.000Z`);
}

function expectDeltaEsatto(
  valoreDopo: number,
  valorePrima: number,
  deltaAtteso: number,
  label: string,
) {
  expect(
    Math.abs((valoreDopo - valorePrima) - deltaAtteso),
    `${label}: delta atteso ${deltaAtteso}, prima ${valorePrima}, dopo ${valoreDopo}`,
  ).toBeLessThanOrEqual(EPS);
}

async function creaScenarioRiepilogo(
  factory: E2eDataFactory,
  { baselineTrasfertaKm }: { baselineTrasfertaKm?: number | null } = {},
): Promise<ScenarioRiepilogo> {
  const seed = randomUUID().slice(0, 8);
  const mese = meseCorrenteToken();
  const collaboratore = await factory.createCollaboratore({
    nome: "E2E Riepilogo",
    cognome: seed,
    tariffaGiornaliera: TARIFFA_COLLABORATORE.toFixed(2),
  });
  const clienteConOfferta = await factory.createClienteConOfferta(
    { ragioneSociale: `E2E Riepilogo ${seed}` },
    {
      codice: `RIEP-${seed}`,
      descrizione: `Offerta riepilogo ${seed}`,
      tariffaGiornaliera: TARIFFA_OFFERTA.toFixed(2),
    },
  );

  await factory.createRigaAttivita({
    collaboratore,
    cliente: clienteConOfferta.cliente,
    offerta: clienteConOfferta.offerta,
    data: dataDb(dataDelMese(mese, 8)),
    ore: "2.00",
    nota: `Baseline riepilogo ${seed}`,
    fatturabile: true,
    trasfertaKm: baselineTrasfertaKm ?? null,
  });

  // Gli scenari che usano questa fixture aggiungono righe anche dal form
  // (`aggiungiRiga`), quindi il collaboratore deve essere abilitato
  // sull'offerta factory anche se la riga baseline è scritta direttamente a DB.
  await factory.createAbilitazioneOfferta({
    collaboratore,
    offerta: clienteConOfferta.offerta,
  });

  return { mese, collaboratore, clienteConOfferta };
}

async function apriRiepilogoDaCalendario(page: Page, mese: string) {
  await page.goto(`/attivita?mese=${mese}`);
  await expect(page.getByRole("link", { name: "Riepilogo mese" })).toBeVisible();
  await page.getByRole("link", { name: "Riepilogo mese" }).click();
  await page.waitForURL("**/attivita/riepilogo**");
  await expect(page.getByTestId("summary-importo-fattura")).toBeVisible();
}

async function apriGiornata(page: Page, data: string, mese: string) {
  await page.goto(`/attivita/${data}?mese=${mese}`);
  await page.waitForURL(`**/attivita/${data}**`);
  await expect(page.getByRole("link", { name: "Torna al calendario" })).toBeVisible();
}

function cardRiga(page: Page, nota: string, fatturabile: boolean): Locator {
  return page
    .locator("div")
    .filter({ has: page.getByText(nota, { exact: true }) })
    .filter({ has: page.getByText(fatturabile ? "Fatt." : "Non fatt.", { exact: true }) })
    .last();
}

async function aggiungiRiga(
  page: Page,
  clienteConOfferta: ClienteConOffertaTestData,
  {
    ore,
    nota,
    fatturabile,
  }: {
    ore: string;
    nota: string;
    fatturabile: boolean;
  },
) {
  await selezionaClienteEOffertaTest(page, clienteConOfferta);
  await page.locator("#ore").fill(ore);
  await page.locator("#nota").fill(nota);

  const checkboxFatturabile = page.locator("input[type='checkbox']");
  if (fatturabile) {
    await checkboxFatturabile.check();
  } else {
    await checkboxFatturabile.uncheck();
  }

  await page.getByRole("button", { name: "Aggiungi riga" }).click();
  await expect(cardRiga(page, nota, fatturabile)).toBeVisible();
}

test.describe("US-014 Demo — Riepilogo mensile con importo fattura", () => {
  test("apre il riepilogo, mostra i dati del mese e si aggiorna dopo un nuovo inserimento", async ({
    page,
    factory,
  }) => {
    test.setTimeout(90_000);

    const scenario = await creaScenarioRiepilogo(factory, { baselineTrasfertaKm: 50 });
    const notaNuova = `US-014 demo fatturabile ${randomUUID()}`;

    await accediComeCollaboratore(page, scenario.collaboratore.utente.email);
    await apriRiepilogoDaCalendario(page, scenario.mese);

    await expect(page.getByTestId("summary-ore-totali")).toBeVisible();
    await expect(page.getByTestId("summary-giornate-fatturabili")).toBeVisible();
    await expect(page.getByTestId("summary-rimborsi")).toBeVisible();
    await expect(page.getByTestId("summary-table")).toBeVisible();
    await expect(page.getByTestId("summary-table")).toContainText(
      scenario.clienteConOfferta.cliente.ragioneSociale,
    );
    await expect(page.getByTestId("summary-table")).toContainText(
      scenario.clienteConOfferta.offerta.codice,
    );
    await expect(page.getByTestId("summary-table")).not.toContainText("TechSolutions Srl");
    await expect(page.getByTestId("summary-table")).not.toContainText("DataFlow SpA");

    const riepilogoPrima = await leggiRiepilogo(page);

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");

    await apriGiornata(page, dataDelMese(scenario.mese, 12), scenario.mese);
    await aggiungiRiga(page, scenario.clienteConOfferta, {
      ore: "4",
      nota: notaNuova,
      fatturabile: true,
    });

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");
    await page.getByRole("link", { name: "Riepilogo mese" }).click();
    await page.waitForURL("**/attivita/riepilogo**");

    const riepilogoDopo = await leggiRiepilogo(page);
    const oreAggiunte = 4;
    const imponibileAggiunto = (oreAggiunte / ORE_PER_GIORNATA) * TARIFFA_COLLABORATORE;

    expectDeltaEsatto(riepilogoDopo.oreTotali, riepilogoPrima.oreTotali, oreAggiunte, "ore totali");
    expectDeltaEsatto(
      riepilogoDopo.oreFatturabili,
      riepilogoPrima.oreFatturabili,
      oreAggiunte,
      "ore fatturabili",
    );
    expectDeltaEsatto(
      riepilogoDopo.imponibileManodopera,
      riepilogoPrima.imponibileManodopera,
      imponibileAggiunto,
      "imponibile manodopera",
    );
    expectDeltaEsatto(
      riepilogoDopo.totaleRimborsi,
      riepilogoPrima.totaleRimborsi,
      0,
      "rimborsi trasferta",
    );
  });
});

test.describe("US-014 — scenari complementari", () => {
  test("una nuova riga non fatturabile aumenta le ore totali ma non l'importo fattura", async ({
    page,
    factory,
  }) => {
    test.setTimeout(60_000);

    const scenario = await creaScenarioRiepilogo(factory, { baselineTrasfertaKm: 50 });
    const notaNuova = `US-014 non fatturabile ${randomUUID()}`;

    await accediComeCollaboratore(page, scenario.collaboratore.utente.email);
    await apriRiepilogoDaCalendario(page, scenario.mese);

    const riepilogoPrima = await leggiRiepilogo(page);

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");

    await apriGiornata(page, dataDelMese(scenario.mese, 13), scenario.mese);
    await aggiungiRiga(page, scenario.clienteConOfferta, {
      ore: "4",
      nota: notaNuova,
      fatturabile: false,
    });

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");
    await page.getByRole("link", { name: "Riepilogo mese" }).click();
    await page.waitForURL("**/attivita/riepilogo**");

    const riepilogoDopo = await leggiRiepilogo(page);

    expectDeltaEsatto(riepilogoDopo.oreTotali, riepilogoPrima.oreTotali, 4, "ore totali");
    expectDeltaEsatto(
      riepilogoDopo.oreFatturabili,
      riepilogoPrima.oreFatturabili,
      0,
      "ore fatturabili",
    );
    expectDeltaEsatto(
      riepilogoDopo.imponibileManodopera,
      riepilogoPrima.imponibileManodopera,
      0,
      "imponibile manodopera",
    );
    expectDeltaEsatto(
      riepilogoDopo.totaleRimborsi,
      riepilogoPrima.totaleRimborsi,
      0,
      "rimborsi trasferta",
    );
  });

  test("mostra lo stato vuoto per un mese senza attività", async ({ page, factory }) => {
    test.setTimeout(60_000);

    const collaboratore = await factory.createCollaboratore({
      tariffaGiornaliera: TARIFFA_COLLABORATORE.toFixed(2),
    });
    const meseSenzaAttivita = meseCorrenteToken(1);

    await accediComeCollaboratore(page, collaboratore.utente.email);

    await page.goto(`/attivita/riepilogo?mese=${meseSenzaAttivita}`);
    await page.waitForURL("**/attivita/riepilogo**");

    await expect(page.getByText("Nessuna attività registrata per questo mese.")).toBeVisible();
    await expect(page.getByTestId("summary-ore-totali-value")).toHaveText("0");
    await expect(page.getByTestId("summary-ore-fatturabili-value")).toHaveText("0");
    await expect(page.getByTestId("summary-rimborsi-value")).toHaveText(/€\s*0,00/);
    await expect(page.getByTestId("summary-importo-fattura-value")).toHaveText(/€\s*0,00/);
  });
});
