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
  oreDaFatturare: number;
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
  const oreDaFatturare = await leggiNumero(page, "summary-ore-da-fatturare-value");
  const importoFattura = await leggiNumero(page, "summary-importo-fattura-value");
  const totaleRimborsi = await leggiNumero(page, "summary-rimborsi-value");

  return {
    oreTotali,
    oreDaFatturare,
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
  {
    baselineRimborso,
  }: { baselineRimborso?: { etichetta: string; importo: string } | null } = {},
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
    categoria: "FATTURABILE",
    rimborsoTrasfertaEtichetta: baselineRimborso?.etichetta ?? null,
    rimborsoTrasfertaImporto: baselineRimborso?.importo ?? null,
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

type Categoria = "FATTURABILE" | "NON_FATTURABILE" | "INVESTIMENTO";

const ETICHETTA_CATEGORIA: Record<Categoria, string> = {
  FATTURABILE: "Fatturabile",
  NON_FATTURABILE: "Non fatturabile",
  INVESTIMENTO: "Investimento",
};

function cardRiga(page: Page, nota: string, categoria: Categoria): Locator {
  return page
    .getByTestId("activity-row")
    .filter({ has: page.getByText(nota, { exact: true }) })
    .filter({ has: page.getByText(ETICHETTA_CATEGORIA[categoria], { exact: true }) });
}

async function aggiungiRiga(
  page: Page,
  clienteConOfferta: ClienteConOffertaTestData,
  {
    ore,
    nota,
    categoria,
  }: {
    ore: string;
    nota: string;
    categoria: Categoria;
  },
) {
  await selezionaClienteEOffertaTest(page, clienteConOfferta);
  await page.locator("#ore").fill(ore);
  await page.locator("#nota").fill(nota);

  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption({ label: ETICHETTA_CATEGORIA[categoria] });

  await page.getByRole("button", { name: "Aggiungi riga" }).click();
  await expect(cardRiga(page, nota, categoria)).toBeVisible();
}

test.describe("US-014 Demo — Riepilogo mensile con importo fattura", () => {
  test("apre il riepilogo, mostra i dati del mese e si aggiorna dopo un nuovo inserimento", async ({
    page,
    factory,
  }) => {
    test.setTimeout(90_000);

    const scenario = await creaScenarioRiepilogo(factory, {
      baselineRimborso: { etichetta: "Baseline riepilogo mensile", importo: "50.00" },
    });
    const notaNuova = `US-014 demo fatturabile ${randomUUID()}`;

    await accediComeCollaboratore(page, scenario.collaboratore.utente.email);
    await apriRiepilogoDaCalendario(page, scenario.mese);

    await expect(page.getByTestId("summary-ore-totali")).toBeVisible();
    await expect(page.getByTestId("summary-giornate-da-fatturare")).toBeVisible();
    await expect(page.getByTestId("summary-ore-per-categoria")).toBeVisible();
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
      categoria: "FATTURABILE",
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
      riepilogoDopo.oreDaFatturare,
      riepilogoPrima.oreDaFatturare,
      oreAggiunte,
      "ore da fatturare",
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
  test("una nuova riga Non fatturabile entra nell'importo fattura del collaboratore", async ({
    page,
    factory,
  }) => {
    test.setTimeout(60_000);

    const scenario = await creaScenarioRiepilogo(factory, {
      baselineRimborso: { etichetta: "Baseline riepilogo mensile", importo: "50.00" },
    });
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
      categoria: "NON_FATTURABILE",
    });

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");
    await page.getByRole("link", { name: "Riepilogo mese" }).click();
    await page.waitForURL("**/attivita/riepilogo**");

    const riepilogoDopo = await leggiRiepilogo(page);

    expectDeltaEsatto(riepilogoDopo.oreTotali, riepilogoPrima.oreTotali, 4, "ore totali");
    expectDeltaEsatto(
      riepilogoDopo.oreDaFatturare,
      riepilogoPrima.oreDaFatturare,
      4,
      "ore da fatturare",
    );
    expectDeltaEsatto(
      riepilogoDopo.imponibileManodopera,
      riepilogoPrima.imponibileManodopera,
      (4 / ORE_PER_GIORNATA) * TARIFFA_COLLABORATORE,
      "imponibile manodopera",
    );
    expectDeltaEsatto(
      riepilogoDopo.totaleRimborsi,
      riepilogoPrima.totaleRimborsi,
      0,
      "rimborsi trasferta",
    );
  });

  test("una nuova riga di Investimento aumenta le ore totali ma non l'importo fattura", async ({
    page,
    factory,
  }) => {
    test.setTimeout(60_000);

    const scenario = await creaScenarioRiepilogo(factory, {
      baselineRimborso: { etichetta: "Baseline riepilogo mensile", importo: "50.00" },
    });
    const notaNuova = `US-014 investimento ${randomUUID()}`;

    await accediComeCollaboratore(page, scenario.collaboratore.utente.email);
    await apriRiepilogoDaCalendario(page, scenario.mese);

    const riepilogoPrima = await leggiRiepilogo(page);

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");

    await apriGiornata(page, dataDelMese(scenario.mese, 14), scenario.mese);
    await aggiungiRiga(page, scenario.clienteConOfferta, {
      ore: "4",
      nota: notaNuova,
      categoria: "INVESTIMENTO",
    });

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");
    await page.getByRole("link", { name: "Riepilogo mese" }).click();
    await page.waitForURL("**/attivita/riepilogo**");

    const riepilogoDopo = await leggiRiepilogo(page);

    expectDeltaEsatto(riepilogoDopo.oreTotali, riepilogoPrima.oreTotali, 4, "ore totali");
    expectDeltaEsatto(
      riepilogoDopo.oreDaFatturare,
      riepilogoPrima.oreDaFatturare,
      0,
      "ore da fatturare",
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
    await expect(page.getByTestId("summary-ore-da-fatturare-value")).toHaveText("0");
    await expect(page.getByTestId("summary-rimborsi-value")).toHaveText(/€\s*0,00/);
    await expect(page.getByTestId("summary-importo-fattura-value")).toHaveText(/€\s*0,00/);
  });
});
