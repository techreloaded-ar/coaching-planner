import type { Locator, Page } from "@playwright/test";

import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";
import { meseCorrenteToken, mesiIndietroPerTentativo } from "./support/date";
import { test, expect } from "./support/fixtures";
import { creaDatasetReportFatturazioneClienti } from "./support/report-data";

/**
 * Navigazione dei mesi nel report Fatturazione Clienti, allineata al
 * calendario attività: salto diretto a mese e anno dal selettore sull'etichetta
 * e cambio mese servito dalla cache client con indicatore di attesa.
 *
 * Le asserzioni riguardano solo il cliente creato dalla factory, mai i totali
 * globali del mese: i mesi riservati per hash sono quindi sufficienti. La
 * lettura lenta è simulata trattenendo la richiesta con `page.route`, senza
 * hard wait.
 */

const CHIAVE_SALTO_MESE = "INC-800BF-FATTURAZIONE-SALTO-MESE";
const CHIAVE_NAVIGAZIONE_REATTIVA = "INC-800BF-FATTURAZIONE-REATTIVA";

/** Etichetta lunga di un token `YYYY-MM`, con la convenzione locale dell'app. */
function etichettaMeseLunga(token: string): string {
  const [anno, mese] = token.split("-").map(Number);

  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(new Date(anno, mese - 1, 1));
}

/** Token `YYYY-MM` spostato di `delta` mesi. */
function spostaMese(token: string, delta: number): string {
  const [anno, mese] = token.split("-").map(Number);
  const data = new Date(anno, mese - 1 + delta, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

async function attendiReportIdratato(page: Page): Promise<Locator> {
  const report = page.locator("section[data-idratata]");
  await expect(report).toHaveAttribute("data-idratata", "true");
  return report;
}

/** Sceglie un mese dal selettore sull'etichetta, portando prima l'anno. */
async function scegliMeseDalSelettore(page: Page, token: string): Promise<void> {
  await page.getByTestId("calendar-month-label").click();
  const pannello = page.getByTestId("selettore-mese-pannello");
  await expect(pannello).toBeVisible();

  const annoTarget = Number(token.slice(0, 4));
  const annoMostrato = Number(
    await pannello.getByTestId("selettore-mese-anno").innerText(),
  );
  const passi = annoTarget - annoMostrato;
  const freccia = passi < 0 ? "Anno precedente" : "Anno successivo";
  for (let i = 0; i < Math.abs(passi); i++) {
    await pannello.getByRole("button", { name: freccia }).click();
  }
  await expect(pannello.getByTestId("selettore-mese-anno")).toHaveText(
    String(annoTarget),
  );

  await pannello
    .getByRole("button", { name: etichettaMeseLunga(token), exact: true })
    .click();
  await expect(pannello).toBeHidden();
}

test.describe("Fatturazione Clienti — navigazione dei mesi", () => {
  test("il selettore sull'etichetta salta a un mese di un altro anno", async ({
    page,
    factory,
  }) => {
    const dataset = await creaDatasetReportFatturazioneClienti(factory, {
      codiceSpec: CHIAVE_SALTO_MESE,
      mesiIndietro: mesiIndietroPerTentativo(test.info()),
    });
    const ragioneSociale = dataset.cliente.ragioneSociale;

    await accediComeAdmin(page);
    await page.goto("/report/fatturazione-clienti");
    await attendiReportIdratato(page);

    const trigger = page.getByTestId("calendar-month-label");
    await expect(trigger).toHaveText(etichettaMeseLunga(meseCorrenteToken()));
    await expect(
      page.getByRole("button", { name: "Mese precedente", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mese successivo", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mese corrente", exact: true }),
    ).toBeVisible();

    await scegliMeseDalSelettore(page, dataset.mese);

    await expect(page).toHaveURL(new RegExp(`\\?mese=${dataset.mese}$`));
    await expect(trigger).toHaveText(etichettaMeseLunga(dataset.mese));
    await expect(page.getByText(ragioneSociale, { exact: true })).toBeVisible();
    await expect(page.getByTestId("esporta-excel")).toHaveAttribute(
      "href",
      `/report/fatturazione-clienti/esporta?mese=${dataset.mese}`,
    );

    // Indietro riporta al mese mostrato prima del salto.
    await page.goBack();
    await expect(page).toHaveURL(/\/report\/fatturazione-clienti$/);
    await expect(trigger).toHaveText(etichettaMeseLunga(meseCorrenteToken()));
    await expect(page.getByText(ragioneSociale, { exact: true })).toHaveCount(0);

    // «Mese corrente» torna all'URL senza parametro.
    await page.goForward();
    await expect(trigger).toHaveText(etichettaMeseLunga(dataset.mese));
    await page.getByRole("button", { name: "Mese corrente", exact: true }).click();
    await expect(page).toHaveURL(/\/report\/fatturazione-clienti$/);
    await expect(trigger).toHaveText(etichettaMeseLunga(meseCorrenteToken()));
  });

  test("il cambio mese è immediato, con attesa sui mesi non in cache", async ({
    page,
    factory,
  }) => {
    const dataset = await creaDatasetReportFatturazioneClienti(factory, {
      codiceSpec: CHIAVE_NAVIGAZIONE_REATTIVA,
      mesiIndietro: mesiIndietroPerTentativo(test.info()),
    });
    const ragioneSociale = dataset.cliente.ragioneSociale;
    // Mese lontano: né adiacente né già visitato, quindi mai in cache.
    const meseArrivo = spostaMese(dataset.mese, -5);

    const percorsoDati = "/report/fatturazione-clienti/dati";
    let lettureMesePartenza = 0;
    page.on("request", (richiesta) => {
      const url = new URL(richiesta.url());
      if (url.pathname === percorsoDati && url.searchParams.get("mese") === dataset.mese) {
        lettureMesePartenza++;
      }
    });

    let sblocca: (() => void) | undefined;
    const attesa = new Promise<void>((resolve) => {
      sblocca = resolve;
    });
    const letturaMeseArrivo = (url: URL) =>
      url.pathname === percorsoDati && url.searchParams.get("mese") === meseArrivo;
    await page.route(letturaMeseArrivo, async (route) => {
      await attesa;
      await route.continue();
    });

    await accediComeAdmin(page);
    await page.goto(`/report/fatturazione-clienti?mese=${dataset.mese}`);
    const report = await attendiReportIdratato(page);
    await expect(page.getByText(ragioneSociale, { exact: true })).toBeVisible();

    await scegliMeseDalSelettore(page, meseArrivo);

    // Etichetta e URL cambiano subito; i dati del mese precedente spariscono
    // e al loro posto c'è l'indicatore di attesa.
    const trigger = page.getByTestId("calendar-month-label");
    await expect(trigger).toHaveText(etichettaMeseLunga(meseArrivo));
    await expect(page).toHaveURL(new RegExp(`\\?mese=${meseArrivo}$`));
    await expect(page.getByTestId("indicatore-caricamento-mese")).toBeVisible();
    await expect(report).toHaveAttribute("aria-busy", "true");
    await expect(page.getByText(ragioneSociale, { exact: true })).toHaveCount(0);

    sblocca!();

    await expect(page.getByTestId("indicatore-caricamento-mese")).toBeHidden();
    await expect(report).toHaveAttribute("aria-busy", "false");

    // Il ritorno al mese di partenza è servito dalla cache, senza richieste.
    await page.goBack();
    await expect(trigger).toHaveText(etichettaMeseLunga(dataset.mese));
    await expect(page.getByText(ragioneSociale, { exact: true })).toBeVisible();
    await expect(report).toHaveAttribute("aria-busy", "false");
    expect(lettureMesePartenza).toBe(0);

    await page.unroute(letturaMeseArrivo);
  });

  test("i dati del mese sono riservati all'amministratore", async ({
    page,
    collaboratore,
    request,
  }) => {
    const senzaSessione = await request.get(
      "/report/fatturazione-clienti/dati?mese=2026-01",
      { maxRedirects: 0 },
    );
    expect(senzaSessione.status()).toBeGreaterThanOrEqual(300);
    expect(senzaSessione.status()).toBeLessThan(400);

    await accediComeCollaboratore(page, collaboratore.utente.email);
    const risposta = await page.request.get(
      "/report/fatturazione-clienti/dati?mese=2026-01",
    );
    expect(risposta.status()).toBe(403);
  });
});
