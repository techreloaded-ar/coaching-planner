import { test, expect } from "@playwright/test";

import {
  dataOggiOffset,
  loginComeGiulia,
} from "./demo__inserimento-righe-attivita.helpers";

test.use({
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 100 },
});

test.describe("US-012 Validazione — ore non valide", () => {
  test("mostra errori per input ore non validi", async ({ page }) => {
    test.setTimeout(60_000);

    await loginComeGiulia(page);

    const dataGiorno2 = dataOggiOffset(2);
    await page.goto(`/attivita/${dataGiorno2}`);
    await page.waitForURL(`**/attivita/${dataGiorno2}`);

    await page.locator("#cliente").selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await page.locator("#offerta").selectOption({ index: 1 });

    const inputOre = page.locator("#ore");

    await inputOre.fill("");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await expect(page.getByText(/compila/i)).toBeVisible();

    await inputOre.fill("0");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await page.waitForTimeout(300);
    const errore = page.locator(".text-red-600, .text-red-700");
    await expect(errore.first()).toBeVisible();

    await inputOre.fill("-2");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await page.waitForTimeout(300);
    await expect(errore.first()).toBeVisible();

    await inputOre.fill("abc");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await page.waitForTimeout(300);
    await expect(errore.first()).toBeVisible();

    await page.waitForTimeout(1000);
  });
});
