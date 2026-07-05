import { randomUUID } from "node:crypto";

import {
  dataOggiOffset,
  selezionaClienteEOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { test, expect } from "./support/fixtures";

/**
 * US-013: Validazione km trasferta
 *
 * Verifica che valori non validi e oltre soglia mostrino errori chiari.
 */

test.describe("US-013 Validazione — Trasferta km", () => {
  test.beforeEach(async ({ page, collaboratore, clienteConOfferta }) => {
    await accediComeCollaboratore(page, collaboratore.utente.email);

    const dataGiorno7 = dataOggiOffset(7);
    await page.goto(`/attivita/${dataGiorno7}`);
    await page.waitForURL(`**/attivita/${dataGiorno7}`);

    await expect(
      page.getByRole("link", { name: "Torna al calendario" })
    ).toBeVisible();

    await selezionaClienteEOffertaTest(page, clienteConOfferta);
    await page.locator("#ore").fill("4");
    await page.locator("#nota").fill(`US-023 trasferta valida ${randomUUID()}`);
  });

  test("mostra errore per km oltre soglia massima", async ({ page }) => {
    const inputKm = page.locator("#trasfertaKm");
    await inputKm.fill("999999999");

    await expect(page.getByText(/soglia massima/i).first()).toBeVisible();

    await expect(page.getByText("Rimborso stimato")).not.toBeVisible();

    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await expect(page.getByText(/soglia|massim/i).first()).toBeVisible();
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
