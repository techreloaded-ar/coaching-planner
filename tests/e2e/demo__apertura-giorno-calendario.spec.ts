import {
  selezionaClienteEOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Demo scenario — US-031: ogni giorno del calendario è apribile.
 *
 * Dalla griglia di un mese riservato, mostra l'apertura di un giorno vuoto,
 * l'inserimento di una riga, il suo riepilogo al ritorno e la navigazione
 * verso un giorno del mese adiacente.
 */
test.describe("US-031 Demo", () => {
  test("demo apertura di un giorno vuoto e del mese adiacente", async ({
    page,
    factory,
    collaboratore,
    clienteConOfferta,
  }) => {
    const mese = meseRiservato("US-031-demo");
    const dataVuota = dataNelMese(mese, 10);

    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita?mese=${mese}`);

    const calendario = page.getByLabel("Calendario mensile delle attività");
    await expect(calendario).toBeVisible();

    const cellaVuota = calendario.locator(
      `a[href="/attivita/${dataVuota}?mese=${mese}"]`,
    );
    await expect(cellaVuota).toHaveAttribute("data-con-attivita", "false");
    await expect(cellaVuota).toBeVisible();

    await cellaVuota.click();
    await expect(
      page.getByText("Nessuna attività registrata per questa giornata."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Aggiungi riga" }),
    ).toBeVisible();

    await selezionaClienteEOffertaTest(page, clienteConOfferta);
    await page.locator("#ore").fill("3");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await expect(
      page.getByText(clienteConOfferta.offerta.codice, { exact: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await expect(calendario).toBeVisible();
    await expect(cellaVuota).toHaveAttribute("data-con-attivita", "true");
    await expect(cellaVuota).toContainText("3.0 h");

    const celleFuoriMese = calendario.locator('a[data-fuori-mese="true"]');
    await expect(celleFuoriMese.first()).toBeVisible();
    const href = await celleFuoriMese.first().getAttribute("href");
    expect(href).toMatch(/^\/attivita\/\d{4}-\d{2}-\d{2}\?mese=\d{4}-\d{2}$/);

    await celleFuoriMese.first().click();
    await expect(
      page.getByRole("link", { name: "Torna al calendario" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: /\d{1,2} .* \d{4}/ }),
    ).toBeVisible();
  });
});
