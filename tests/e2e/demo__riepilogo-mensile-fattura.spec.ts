import { randomUUID } from "node:crypto";

import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  dataOggiOffset,
  loginComeGiulia,
} from "./demo__inserimento-righe-attivita.helpers";

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 100 },
});

test.describe.configure({ mode: "serial" });

function parseNumeroItaliano(valore: string): number {
  const normalizzato = valore.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number.parseFloat(normalizzato);
}

async function leggiNumero(page: Page, testId: string): Promise<number> {
  const testo = await page.getByTestId(testId).textContent();
  return parseNumeroItaliano(testo ?? "0");
}

async function attendiOfferteCaricate(selectOfferta: Locator) {
  await expect(selectOfferta).toBeEnabled();
  await expect.poll(async () => selectOfferta.locator("option").count()).toBeGreaterThan(1);
}

function tokenMese(offsetMesi = 0): string {
  const data = new Date();
  data.setMonth(data.getMonth() + offsetMesi, 1);
  const anno = data.getFullYear();
  const mese = String(data.getMonth() + 1).padStart(2, "0");
  return `${anno}-${mese}`;
}

async function apriRiepilogoDaCalendario(page: Page) {
  await page.goto("/attivita");
  await expect(page.getByRole("link", { name: "Riepilogo mese" })).toBeVisible();
  await page.getByRole("link", { name: "Riepilogo mese" }).click();
  await page.waitForURL("**/attivita/riepilogo**");
  await expect(page.getByTestId("summary-importo-fattura")).toBeVisible();
}

async function aggiungiRiga(
  page: Page,
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
  const selectCliente = page.locator("#cliente");
  const selectOfferta = page.locator("#offerta");
  const inputOre = page.locator("#ore");
  const checkboxFatturabile = page.locator("input[type='checkbox']");
  const textareaNota = page.locator("#nota");

  await selectCliente.selectOption({ index: 1 });
  await attendiOfferteCaricate(selectOfferta);
  await selectOfferta.selectOption({ index: 1 });
  await inputOre.fill(ore);
  await textareaNota.fill(nota);

  if (fatturabile) {
    await checkboxFatturabile.check();
  } else {
    await checkboxFatturabile.uncheck();
  }

  await page.getByRole("button", { name: "Aggiungi riga" }).click();
  await expect(page.getByText(nota, { exact: true })).toBeVisible();
}

test.describe("US-014 Demo — Riepilogo mensile con importo fattura", () => {
  test("apre il riepilogo, mostra i dati del mese e si aggiorna dopo un nuovo inserimento", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const seed = randomUUID();
    const notaNuova = `US-014 demo fatturabile ${seed}`;

    await loginComeGiulia(page);
    await apriRiepilogoDaCalendario(page);

    await expect(page.getByTestId("summary-ore-totali")).toBeVisible();
    await expect(page.getByTestId("summary-giornate-fatturabili")).toBeVisible();
    await expect(page.getByTestId("summary-rimborsi")).toBeVisible();
    await expect(page.getByTestId("summary-table")).toBeVisible();
    await expect(page.getByTestId("summary-table")).toContainText("TechSolutions Srl");
    await expect(page.getByTestId("summary-table")).toContainText("DataFlow SpA");

    const oreTotaliPrima = await leggiNumero(page, "summary-ore-totali-value");
    const oreFatturabiliPrima = await leggiNumero(page, "summary-ore-fatturabili-value");
    const importoPrima = await leggiNumero(page, "summary-importo-fattura-value");
    const cardGiornateFatturabili = await page.getByTestId("summary-giornate-fatturabili").textContent();
    const tariffaMatch = cardGiornateFatturabili?.match(/Tariffa giorno:\s*€\s*([\d.,]+)/);
    const tariffaGiornaliera = parseNumeroItaliano(tariffaMatch?.[1] ?? "0");

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");

    const dataGiorno2 = dataOggiOffset(2);
    await page.goto(`/attivita/${dataGiorno2}?mese=${tokenMese()}`);
    await page.waitForURL(`**/attivita/${dataGiorno2}**`);

    await aggiungiRiga(page, {
      ore: "4",
      nota: notaNuova,
      fatturabile: true,
    });

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");
    await page.getByRole("link", { name: "Riepilogo mese" }).click();
    await page.waitForURL("**/attivita/riepilogo**");

    const oreTotaliDopo = await leggiNumero(page, "summary-ore-totali-value");
    const oreFatturabiliDopo = await leggiNumero(page, "summary-ore-fatturabili-value");
    const importoDopo = await leggiNumero(page, "summary-importo-fattura-value");

    expect(oreTotaliDopo - oreTotaliPrima).toBeCloseTo(4, 4);
    expect(oreFatturabiliDopo - oreFatturabiliPrima).toBeCloseTo(4, 4);
    expect(importoDopo - importoPrima).toBeCloseTo(tariffaGiornaliera / 2, 2);
  });
});

test.describe("US-014 — scenari complementari", () => {
  test("una nuova riga non fatturabile aumenta le ore totali ma non l'importo fattura", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const seed = randomUUID();
    const notaNuova = `US-014 non fatturabile ${seed}`;

    await loginComeGiulia(page);
    await apriRiepilogoDaCalendario(page);

    const oreTotaliPrima = await leggiNumero(page, "summary-ore-totali-value");
    const oreFatturabiliPrima = await leggiNumero(page, "summary-ore-fatturabili-value");
    const importoPrima = await leggiNumero(page, "summary-importo-fattura-value");

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");

    const dataGiorno2 = dataOggiOffset(2);
    await page.goto(`/attivita/${dataGiorno2}?mese=${tokenMese()}`);
    await page.waitForURL(`**/attivita/${dataGiorno2}**`);

    await aggiungiRiga(page, {
      ore: "4",
      nota: notaNuova,
      fatturabile: false,
    });

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");
    await page.getByRole("link", { name: "Riepilogo mese" }).click();
    await page.waitForURL("**/attivita/riepilogo**");

    const oreTotaliDopo = await leggiNumero(page, "summary-ore-totali-value");
    const oreFatturabiliDopo = await leggiNumero(page, "summary-ore-fatturabili-value");
    const importoDopo = await leggiNumero(page, "summary-importo-fattura-value");

    expect(oreTotaliDopo - oreTotaliPrima).toBeCloseTo(4, 4);
    expect(oreFatturabiliDopo).toBeCloseTo(oreFatturabiliPrima, 4);
    expect(importoDopo).toBeCloseTo(importoPrima, 2);
  });

  test("mostra lo stato vuoto per un mese senza attività", async ({ page }) => {
    test.setTimeout(60_000);

    await loginComeGiulia(page);

    await page.goto(`/attivita/riepilogo?mese=${tokenMese(1)}`);
    await page.waitForURL("**/attivita/riepilogo**");

    await expect(page.getByText("Nessuna attività registrata per questo mese.")).toBeVisible();
    await expect(page.getByTestId("summary-importo-fattura-value")).toHaveText(/€\s*0,00/);
  });
});
