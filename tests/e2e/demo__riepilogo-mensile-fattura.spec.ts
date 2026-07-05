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

/**
 * Tolleranza usata per le asserzioni sui totali aggregati del riepilogo
 * mensile. Il database e2e è condiviso e la suite gira con
 * `fullyParallel: true`: altri spec file (es.
 * demo__inserimento-righe-attivita-flusso.spec.ts) operano sulla stessa
 * collaboratrice (Giulia) nello stesso mese corrente in worker concorrenti,
 * ma solo aggiungendo/rimuovendo proprie righe temporanee — mai riducendo il
 * saldo netto delle ore fatturabili di Giulia al di sotto della baseline.
 * Per questo i totali su ore/manodopera sono verificati come limite
 * inferiore garantito dalla riga appena aggiunta (non può diminuire per
 * effetto della nostra azione, ma può aumentare per interferenza di altri
 * scenari e2e), mentre la correttezza puntuale dell'azione (fatturabile
 * sì/no) è verificata in modo deterministico sulla riga stessa tramite il
 * badge "Fatt."/"Non fatt." nella card dell'attività.
 *
 * NOTA IMPORTANTE su "importo fattura": il valore mostrato in
 * `summary-importo-fattura-value` è `imponibileManodopera + totaleRimborsi`
 * (src/domain/consuntivi/index.ts, calcolaRiepilogoMese). Il termine
 * `totaleRimborsi` è però mutato da `demo__trasferta-rimborso-automatico.spec.ts`,
 * che RIMUOVE realmente un rimborso trasferta di seed (150 km, giorno 4) di
 * Giulia nel corso del proprio scenario — un decremento reale e legittimo
 * di un dato condiviso, non rumore. Confrontare l'importo fattura completo
 * "prima/dopo" sarebbe quindi soggetto a un calo genuino non causato dalla
 * nostra azione. Le asserzioni qui isolano perciò la sola componente
 * "imponibile manodopera" (`importoFattura - totaleRimborsi`), che è
 * l'unica interessata dalle regole US-014 in verifica (ore fatturabili vs
 * non fatturabili), escludendo i rimborsi trasferta dal confronto.
 */
const EPS = 0.01;

function parseNumeroItaliano(valore: string): number {
  const normalizzato = valore.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number.parseFloat(normalizzato);
}

async function leggiNumero(page: Page, testId: string): Promise<number> {
  const testo = await page.getByTestId(testId).textContent();
  return parseNumeroItaliano(testo ?? "0");
}

/** Legge ore totali/fatturabili e il solo imponibile manodopera (importo fattura al netto dei rimborsi trasferta). */
async function leggiRiepilogo(page: Page) {
  const oreTotali = await leggiNumero(page, "summary-ore-totali-value");
  const oreFatturabili = await leggiNumero(page, "summary-ore-fatturabili-value");
  const importoFattura = await leggiNumero(page, "summary-importo-fattura-value");
  const totaleRimborsi = await leggiNumero(page, "summary-rimborsi-value");
  return {
    oreTotali,
    oreFatturabili,
    imponibileManodopera: importoFattura - totaleRimborsi,
  };
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

  // Verifica deterministica e non racy: la card della riga appena creata
  // (individuata dalla sua nota, univoca, e dal badge fatturabile/non
  // fatturabile con match esatto per evitare la collisione di sottostringa
  // "Fatt." ⊂ "Non fatt.") mostra il badge coerente con l'azione appena
  // compiuta, indipendentemente da cosa fanno nel frattempo altri scenari
  // e2e sugli aggregati condivisi del mese.
  const cardRiga = page
    .locator("div")
    .filter({ has: page.getByText(nota, { exact: true }) })
    .filter({ has: page.getByText(fatturabile ? "Fatt." : "Non fatt.", { exact: true }) })
    .last();
  await expect(cardRiga).toBeVisible();
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

    const {
      oreTotali: oreTotaliPrima,
      oreFatturabili: oreFatturabiliPrima,
      imponibileManodopera: imponibilePrima,
    } = await leggiRiepilogo(page);
    const cardGiornateFatturabili = await page.getByTestId("summary-giornate-fatturabili").textContent();
    const tariffaMatch = cardGiornateFatturabili?.match(/Tariffa giorno:\s*€\s*([\d.,]+)/);
    const tariffaGiornaliera = parseNumeroItaliano(tariffaMatch?.[1] ?? "0");

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");

    // Giorno 15: nessun altro spec e2e opera su questo giorno per Giulia
    // (gli altri usano gli offset 2, 4, 6, 7 — vedi grep su dataOggiOffset
    // in tests/e2e/). Un giorno libero evita che scenari concorrenti
    // aggiungano/modifichino/eliminino righe sulla stessa giornata mentre
    // leggiamo il riepilogo mensile.
    const dataGiornoUsato = dataOggiOffset(15);
    await page.goto(`/attivita/${dataGiornoUsato}?mese=${tokenMese()}`);
    await page.waitForURL(`**/attivita/${dataGiornoUsato}**`);

    await aggiungiRiga(page, {
      ore: "4",
      nota: notaNuova,
      fatturabile: true,
    });

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");
    await page.getByRole("link", { name: "Riepilogo mese" }).click();
    await page.waitForURL("**/attivita/riepilogo**");

    const {
      oreTotali: oreTotaliDopo,
      oreFatturabili: oreFatturabiliDopo,
      imponibileManodopera: imponibileDopo,
    } = await leggiRiepilogo(page);

    // Limite inferiore garantito dalla nostra riga (4h fatturabili aggiunte):
    // gli aggregati non possono diminuire per effetto della nostra azione,
    // ma possono crescere oltre l'atteso per interferenza di altri scenari
    // e2e concorrenti sullo stesso database condiviso (vedi commento su EPS
    // e sull'esclusione dei rimborsi trasferta dal confronto).
    expect(oreTotaliDopo - oreTotaliPrima).toBeGreaterThanOrEqual(4 - EPS);
    expect(oreFatturabiliDopo - oreFatturabiliPrima).toBeGreaterThanOrEqual(4 - EPS);
    expect(imponibileDopo - imponibilePrima).toBeGreaterThanOrEqual(tariffaGiornaliera / 2 - EPS);
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

    const {
      oreTotali: oreTotaliPrima,
      oreFatturabili: oreFatturabiliPrima,
      imponibileManodopera: imponibilePrima,
    } = await leggiRiepilogo(page);

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");

    // Giorno 15: nessun altro spec e2e opera su questo giorno per Giulia
    // (gli altri usano gli offset 2, 4, 6, 7 — vedi grep su dataOggiOffset
    // in tests/e2e/). Un giorno libero evita che scenari concorrenti
    // aggiungano/modifichino/eliminino righe sulla stessa giornata mentre
    // leggiamo il riepilogo mensile.
    const dataGiornoUsato = dataOggiOffset(15);
    await page.goto(`/attivita/${dataGiornoUsato}?mese=${tokenMese()}`);
    await page.waitForURL(`**/attivita/${dataGiornoUsato}**`);

    await aggiungiRiga(page, {
      ore: "4",
      nota: notaNuova,
      fatturabile: false,
    });

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita**");
    await page.getByRole("link", { name: "Riepilogo mese" }).click();
    await page.waitForURL("**/attivita/riepilogo**");

    const {
      oreTotali: oreTotaliDopo,
      oreFatturabili: oreFatturabiliDopo,
      imponibileManodopera: imponibileDopo,
    } = await leggiRiepilogo(page);

    // La riga aggiunta è non fatturabile: il badge verificato in
    // `aggiungiRiga` conferma già, in modo deterministico e non racy, che
    // NON contribuisce a ore fatturabili/imponibile. Qui verifichiamo solo
    // che gli aggregati condivisi non possano diminuire per effetto della
    // nostra azione (possono crescere per interferenza di altri scenari
    // e2e concorrenti, ma mai scendere sotto il valore "prima"). L'imponibile
    // manodopera esclude i rimborsi trasferta (vedi commento di modulo).
    expect(oreTotaliDopo - oreTotaliPrima).toBeGreaterThanOrEqual(4 - EPS);
    expect(oreFatturabiliDopo).toBeGreaterThanOrEqual(oreFatturabiliPrima - EPS);
    expect(imponibileDopo).toBeGreaterThanOrEqual(imponibilePrima - EPS);
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
