import { randomUUID } from "node:crypto";

import {
  dataOggiOffset,
  selezionaClienteEOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { test, expect } from "./support/fixtures";

test.use({
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 100 },
});

test.describe("US-012 Validazione — ore non valide", () => {
  test("mostra errori per input ore non validi", async ({
    page,
    collaboratore,
    clienteConOfferta,
  }) => {
    test.setTimeout(60_000);

    await accediComeCollaboratore(page, collaboratore.utente.email);

    const dataGiorno2 = dataOggiOffset(2);
    await page.goto(`/attivita/${dataGiorno2}`);
    await page.waitForURL(`**/attivita/${dataGiorno2}`);

    await selezionaClienteEOffertaTest(page, clienteConOfferta);
    await page.locator("#nota").fill(`US-023 validazione ore ${randomUUID()}`);

    const inputOre = page.locator("#ore");

    await inputOre.fill("");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await expect(page.getByText(/compila/i)).toBeVisible();

    await inputOre.fill("0");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await expect(page.getByText("Inserisci un numero maggiore di zero")).toBeVisible();

    await inputOre.fill("-2");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await expect(page.getByText("Inserisci un numero maggiore di zero")).toBeVisible();

    await inputOre.fill("abc");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await expect(page.getByText("Valore non valido")).toBeVisible();
  });
});
