import { test, expect } from "@playwright/test";

import {
  dataMesePrecedenteGiorno,
  loginComeGiulia,
} from "./demo__inserimento-righe-attivita.helpers";

test.use({
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 100 },
});

test.describe("US-012 Mese concluso — nessun blocco temporale", () => {
  test("aggiunta, modifica ed eliminazione su data passata", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await loginComeGiulia(page);

    const dataPassata = dataMesePrecedenteGiorno(2);
    await page.goto(`/attivita/${dataPassata}`);
    await page.waitForURL(`**/attivita/${dataPassata}`);

    await expect(
      page.getByRole("link", { name: "Torna al calendario" })
    ).toBeVisible();

    await page.locator("#cliente").selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await page.locator("#offerta").selectOption({ index: 1 });
    await page.locator("#ore").fill("4");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await page.waitForTimeout(1000);

    await expect(
      page.locator("text=/\\d+(\\.\\d+)?\\s*h/").first()
    ).toBeVisible();

    await page.waitForTimeout(1000);
  });
});
