import type { Locator, Page } from "@playwright/test";

import { accediComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import { creaDatasetMarginalita } from "./support/marginalita-data";

/**
 * Test e2e — US-017: analisi della marginalità per cliente e offerta.
 *
 * Ogni test crea cliente, offerte, collaboratore e righe con la factory in mesi
 * riservati, e asserisce solo sulle proprie entità: nessun totale globale.
 */

const formattatoreEuro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

function formattaEuro(valore: number): string {
  return formattatoreEuro.format(valore);
}

/** Celle della riga offerta: 0 codice, 1 descrizione, 2 giornate, 3 ricavi, 4 costi, 5 margine, 6 margine %. */
function celle(riga: Locator): Locator {
  return riga.getByRole("cell");
}

async function apriMarginalitaDaSidebar(page: Page): Promise<void> {
  await page.goto("/report/fatturazione-clienti");
  await page.getByRole("link", { name: "Marginalità", exact: true }).click();
  await page.waitForURL("**/report/marginalita");
  await expect(
    page.getByRole("heading", { name: "Marginalità per cliente e offerta" }),
  ).toBeVisible();
}

test.describe("Report marginalità", () => {
  test.beforeEach(async ({ page }) => {
    await accediComeAdmin(page);
  });

  test("mostra ricavi, costi e margine per cliente e offerta sul periodo scelto", async ({
    page,
    factory,
  }) => {
    const { cliente, offertaA, offertaB, meseUno, meseDue } =
      await creaDatasetMarginalita(factory);

    await apriMarginalitaDaSidebar(page);
    await page.getByLabel("Dal mese", { exact: true }).fill(meseUno);
    await page.getByLabel("Al mese", { exact: true }).fill(meseDue);
    await page.getByRole("button", { name: "Applica", exact: true }).click();
    await page.waitForURL(`**/report/marginalita?da=${meseUno}&a=${meseDue}`);

    // AC-1: cliente
    const schedaCliente = page.getByTestId(`marginalita-cliente-${cliente.id}`);
    await expect(schedaCliente).toBeVisible();
    await expect(
      schedaCliente.getByText(formattaEuro(1200), { exact: true }).first(),
    ).toBeVisible();
    await expect(
      schedaCliente.getByText(formattaEuro(1100), { exact: true }).first(),
    ).toBeVisible();
    await expect(
      schedaCliente.getByText(formattaEuro(100), { exact: true }).first(),
    ).toBeVisible();

    // AC-2: offerta A in utile, nessun badge
    const rigaA = page.getByTestId(`marginalita-offerta-${offertaA.id}`);
    await expect(celle(rigaA).nth(3)).toHaveText(formattaEuro(900));
    await expect(celle(rigaA).nth(4)).toHaveText(formattaEuro(600));
    await expect(celle(rigaA).nth(5)).toHaveText(formattaEuro(300));
    // AC-4: nessun badge sull'offerta in utile
    await expect(rigaA.getByText("Margine negativo")).toHaveCount(0);

    // AC-2 + AC-4: offerta B in perdita, badge visibile e unico nella scheda
    const rigaB = page.getByTestId(`marginalita-offerta-${offertaB.id}`);
    await expect(celle(rigaB).nth(3)).toHaveText(formattaEuro(300));
    // 8h Fatturabile (400 €) + 2h Non fatturabile: costo senza ricavo (100 €)
    await expect(celle(rigaB).nth(4)).toHaveText(formattaEuro(500));
    await expect(celle(rigaB).nth(5)).toContainText(formattaEuro(-200));
    await expect(rigaB.getByText("Margine negativo")).toBeVisible();
    await expect(schedaCliente.getByText("Margine negativo")).toHaveCount(1);

    // Gerarchia: la sintesi del periodo precede il dettaglio per cliente.
    const sintesi = page.getByTestId("marginalita-totali");
    await expect(sintesi).toContainText("Ricavi totali");
    await expect(sintesi).toContainText("Costi totali");
    await expect(sintesi).toContainText("Margine totale");
    const boxSintesi = (await sintesi.boundingBox())!;
    const boxScheda = (await schedaCliente.boundingBox())!;
    expect(boxSintesi.y + boxSintesi.height).toBeLessThan(boxScheda.y);

    // La spiegazione estesa è chiusa in fondo e si apre da tastiera.
    const criterio = page.getByText("Le ore di Investimento e i rimborsi trasferta sono esclusi.");
    await expect(criterio).toBeHidden();
    await page.getByText("Come viene calcolato", { exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(criterio).toBeVisible();
  });

  test("i ricavi coincidono con l'importo del report fatturazione clienti", async ({
    page,
    factory,
  }) => {
    const { cliente, meseDue } = await creaDatasetMarginalita(factory);

    await page.goto(`/report/marginalita?da=${meseDue}&a=${meseDue}`);
    const schedaMarginalita = page.getByTestId(
      `marginalita-cliente-${cliente.id}`,
    );
    await expect(
      schedaMarginalita.getByText(formattaEuro(600), { exact: true }).first(),
    ).toBeVisible();

    await page.goto(`/report/fatturazione-clienti?mese=${meseDue}`);
    await expect(
      page.getByTestId(`report-client-${cliente.id}`),
    ).toContainText(formattaEuro(600));
  });
});

test.describe("Dettaglio marginalità del cliente", () => {
  test.beforeEach(async ({ page }) => {
    await accediComeAdmin(page);
  });

  test("dal pulsante Dettaglio calcolo mostra ricavi e costi per collaboratore e mese con le formule", async ({
    page,
    factory,
  }) => {
    const { cliente, offertaA, offertaB, collaboratore, meseUno, meseDue } =
      await creaDatasetMarginalita(factory);

    await page.goto(`/report/marginalita?da=${meseUno}&a=${meseDue}`);
    await page
      .getByTestId(`marginalita-cliente-${cliente.id}`)
      .getByRole("link", { name: "Dettaglio calcolo →", exact: true })
      .click();
    await page.waitForURL(`**/report/marginalita/${cliente.id}?da=${meseUno}&a=${meseDue}`);
    await expect(
      page.getByRole("heading", { name: cliente.ragioneSociale, exact: true }),
    ).toBeVisible();

    // Riepilogo identico al report: ricavi 1.200, costi 1.100, margine 100
    const totali = page.getByTestId("dettaglio-marginalita-totali");
    await expect(totali).toContainText(formattaEuro(1200));
    await expect(totali).toContainText(formattaEuro(1100));
    await expect(totali).toContainText(formattaEuro(100));

    // Offerta A: una riga per mese
    const offertaASezione = page.getByTestId(`dettaglio-marginalita-offerta-${offertaA.id}`);
    const rigaAMeseUno = offertaASezione.getByTestId(
      `dettaglio-marginalita-voce-${collaboratore.collaboratore.id}-${meseUno}`,
    );
    await expect(rigaAMeseUno).toContainText(`${formattaEuro(600)}1 gg × ${formattaEuro(600)}`);
    await expect(rigaAMeseUno).toContainText("Giornaliera");
    await expect(rigaAMeseUno).toContainText(`${formattaEuro(400)}1 gg × ${formattaEuro(400)}`);
    await expect(
      page.getByTestId(`dettaglio-marginalita-totale-${offertaA.id}`),
    ).toContainText(formattaEuro(900));

    // Offerta B: 1 gg Fatturabile + 0,25 gg Non fatturabile a 400 €/gg
    const rigaB = page
      .getByTestId(`dettaglio-marginalita-offerta-${offertaB.id}`)
      .getByTestId(`dettaglio-marginalita-voce-${collaboratore.collaboratore.id}-${meseDue}`);
    await expect(rigaB).toContainText(`(1 + 0,25 gg) × ${formattaEuro(400)}`);
    await expect(rigaB).toContainText(formattaEuro(500));
    await expect(rigaB.getByText("Margine negativo")).toBeVisible();

    // Ritorno al report con lo stesso periodo
    await page.getByRole("link", { name: "Marginalità per cliente e offerta", exact: true }).click();
    await page.waitForURL(`**/report/marginalita?da=${meseUno}&a=${meseDue}`);
  });

  test("nome del cliente e codice dell'offerta aprono l'anagrafica del cliente", async ({
    page,
    factory,
  }) => {
    const { cliente, offertaA, meseUno, meseDue } = await creaDatasetMarginalita(factory);
    const scheda = page.getByTestId(`marginalita-cliente-${cliente.id}`);

    await page.goto(`/report/marginalita?da=${meseUno}&a=${meseDue}`);
    await scheda.getByRole("link", { name: cliente.ragioneSociale, exact: true }).click();
    await page.waitForURL(`**/anagrafiche/clienti/${cliente.id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: cliente.ragioneSociale }),
    ).toBeVisible();

    await page.goto(`/report/marginalita?da=${meseUno}&a=${meseDue}`);
    await scheda.getByRole("link", { name: offertaA.codice, exact: true }).click();
    await page.waitForURL(`**/anagrafiche/clienti/${cliente.id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: cliente.ragioneSociale }),
    ).toBeVisible();
  });

  test("il nome del collaboratore apre le sue attività filtrate per mese, cliente e offerta", async ({
    page,
    factory,
  }) => {
    const { cliente, offertaA, offertaB, collaboratore, meseDue } =
      await creaDatasetMarginalita(factory);
    const { nome, cognome, id } = collaboratore.collaboratore;

    await page.goto(`/report/marginalita/${cliente.id}?da=${meseDue}&a=${meseDue}`);
    await page
      .getByTestId(`dettaglio-marginalita-offerta-${offertaB.id}`)
      .getByRole("link", { name: `${nome} ${cognome}`, exact: true })
      .click();
    await page.waitForURL(
      `**/attivita?vista=elenco&collaboratore=${id}&mese=${meseDue}&cliente=${cliente.id}&offerta=${offertaB.id}`,
    );

    const righe = page.getByTestId("riga-elenco");
    // Offerta B nel mese: 8h Fatturabile e 2h Non fatturabile; le righe di A sono filtrate
    await expect(righe.filter({ hasText: offertaB.codice })).toHaveCount(2);
    await expect(righe.filter({ hasText: offertaA.codice })).toHaveCount(0);
  });
});
