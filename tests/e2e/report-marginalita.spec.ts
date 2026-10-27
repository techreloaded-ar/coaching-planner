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
      schedaCliente.getByText(formattaEuro(1000), { exact: true }).first(),
    ).toBeVisible();
    await expect(
      schedaCliente.getByText(formattaEuro(200), { exact: true }).first(),
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
    await expect(celle(rigaB).nth(4)).toHaveText(formattaEuro(400));
    await expect(celle(rigaB).nth(5)).toContainText(formattaEuro(-100));
    await expect(rigaB.getByText("Margine negativo")).toBeVisible();
    await expect(schedaCliente.getByText("Margine negativo")).toHaveCount(1);
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
