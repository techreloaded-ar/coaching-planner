import { test, expect } from "@playwright/test";

import {
  dataOggiOffset,
  loginComeGiulia,
} from "./demo__inserimento-righe-attivita.helpers";

/**
 * US-013: Validazione km trasferta
 *
 * Verifica che valori non validi e oltre soglia mostrino errori chiari.
 */

test.describe("US-013 Validazione — Trasferta km", () => {
  test.beforeEach(async ({ page }) => {
    await loginComeGiulia(page);

    // Usa un giorno pulito (giorno 7)
    const dataGiorno7 = dataOggiOffset(7);
    await page.goto(`/attivita/${dataGiorno7}`);
    await page.waitForURL(`**/attivita/${dataGiorno7}`);

    await expect(
      page.getByRole("link", { name: "Torna al calendario" })
    ).toBeVisible();

    // Seleziona cliente e offerta così che il form sia pronto
    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");

    await selectCliente.selectOption({ index: 1 });
    await expect(selectOfferta).toBeEnabled();
    await expect
      .poll(async () => selectOfferta.locator("option").count())
      .toBeGreaterThan(1);
    await selectOfferta.selectOption({ index: 1 });

    // Inserisci ore valide
    await page.locator("#ore").fill("4");
  });

  test("mostra errore per km oltre soglia massima", async ({ page }) => {
    const inputKm = page.locator("#trasfertaKm");
    await inputKm.fill("999");

    // Verifica messaggio di errore visibile
    // Il messaggio è un <p> fratello del flex-container (che contiene input+span), non dell'input
    await expect(page.getByText(/soglia massima/i)).toBeVisible();

    // Verifica che la preview non mostri un importo (nessun OK)
    await expect(page.getByText("Rimborso stimato")).not.toBeVisible();

    // Il submit dovrebbe fallire: clicchiamo e verifichiamo errore
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await expect(
      page.getByText(/soglia|massim/i).first()
    ).toBeVisible();
  });

  test("mostra errore per km zero", async ({ page }) => {
    const inputKm = page.locator("#trasfertaKm");
    await inputKm.fill("0");

    await expect(
      page.getByText(/maggiore di zero/i).first()
    ).toBeVisible();
  });

  test("mostra errore per km negativi", async ({ page }) => {
    const inputKm = page.locator("#trasfertaKm");
    await inputKm.fill("-5");

    await expect(
      page.getByText(/intero|chilometri/i).first()
    ).toBeVisible();
  });

  test("mostra errore per km decimali", async ({ page }) => {
    const inputKm = page.locator("#trasfertaKm");
    await inputKm.fill("12,5");

    await expect(
      page.getByText(/intero|chilometri/i).first()
    ).toBeVisible();
  });

  test("mostra errore per km testuali", async ({ page }) => {
    const inputKm = page.locator("#trasfertaKm");
    await inputKm.fill("abc");

    await expect(
      page.getByText(/intero|chilometri/i).first()
    ).toBeVisible();
  });
});
