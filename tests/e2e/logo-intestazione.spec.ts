import { test, expect, type Page } from "@playwright/test";

import {
  accediAlBackOfficeComeAdmin,
  accediComeAdmin,
  accediComeCollaboratore,
} from "./support/auth";
import { SFONDO_SCURO } from "./support/tema";
import { pulsanteMenuAccount } from "./support/menu-account";

// Scenari read-only: gli utenti seed servono solo ad accedere.
// Il simbolo resta intero a ogni viewport; il titolo va sotto il brand su mobile.
function logo(page: Page) {
  return page.getByRole("img", { name: "Coaching Planner", exact: true });
}

async function verificaIntestazione(page: Page, altezzaMassima: number) {
  await expect(logo(page)).toHaveCount(1);
  await expect(logo(page)).toBeVisible();
  await expect(logo(page)).toHaveAttribute("src", "/coaching-planner-logo.svg");
  await expect.poll(() => logo(page).evaluate(
    (immagine) => (immagine as HTMLImageElement).complete && (immagine as HTMLImageElement).naturalWidth > 0,
  )).toBe(true);
  await expect(pulsanteMenuAccount(page)).toBeVisible();
  await expect.poll(() => page.getByRole("banner").evaluate((header) => header.scrollWidth - header.clientWidth)).toBe(0);

  const intestazione = await page.getByRole("banner").boundingBox();
  expect(intestazione).not.toBeNull();
  expect(intestazione!.height).toBeLessThanOrEqual(altezzaMassima);
  const simbolo = await logo(page).boundingBox();
  expect(simbolo).not.toBeNull();
  expect(simbolo!.width).toBe(36);
  expect(simbolo!.height).toBe(36);
  const marchio = await page.getByTestId("logo-coaching-planner").boundingBox();
  const account = await pulsanteMenuAccount(page).boundingBox();
  expect(marchio).not.toBeNull();
  expect(account).not.toBeNull();
  expect(marchio!.x + marchio!.width).toBeLessThanOrEqual(account!.x);
}

test.describe("Logo Coaching Planner nelle intestazioni", () => {
  test("le attività mostrano logo, nome del prodotto e titolo senza Front office", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await accediComeCollaboratore(page);
    const intestazione = page.getByRole("banner");
    await expect(intestazione.getByText("Coaching Planner", { exact: true })).toBeVisible();
    await expect(intestazione.getByRole("heading", { name: "Le mie attività", exact: true })).toBeVisible();
    await expect(intestazione.getByText("Front office", { exact: true })).toHaveCount(0);
    await verificaIntestazione(page, 84);

    await page.setViewportSize({ width: 768, height: 800 });
    await verificaIntestazione(page, 84);
  });

  test("la console mostra un solo logo nella sidebar anche dopo la navigazione", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await accediAlBackOfficeComeAdmin(page);
    await verificaIntestazione(page, 58);
    await expect(page.getByRole("banner").getByRole("img", { name: "Coaching Planner", exact: true })).toHaveCount(0);
    await expect(page.getByRole("complementary").getByRole("img", { name: "Coaching Planner", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Offerte", exact: true }).click();
    await page.waitForURL("**/offerte");
    await verificaIntestazione(page, 58);

    await page.setViewportSize({ width: 768, height: 800 });
    await verificaIntestazione(page, 58);
  });

  for (const tema of ["scuro", "chiaro"] as const) {
    test(`tema ${tema}: simbolo intero e fondo leggibile`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "tema", value: tema, url: baseURL! }]);
      await accediComeCollaboratore(page);
      await expect(page.locator("html")).toHaveAttribute("data-tema", tema);
      if (tema === "scuro") {
        await expect(page.locator("body")).toHaveCSS("background-color", SFONDO_SCURO);
      }
      await expect(page.getByRole("banner").getByTestId("simbolo-coaching-planner")).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await verificaIntestazione(page, 84);
    });
  }

  for (const area of ["collaboratore", "amministratore", "console", "impostazioni"] as const) {
    test(`mobile, ${area}: brand e account non si sovrappongono`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      if (area === "console") {
        await accediAlBackOfficeComeAdmin(page);
      } else if (area === "amministratore") {
        await accediComeAdmin(page);
      } else {
        await accediComeCollaboratore(page);
        if (area === "impostazioni") await page.goto("/impostazioni/tema");
      }
      await verificaIntestazione(page, area === "console" ? 58 : 116);
      if (area !== "console") {
        const intestazione = page.getByRole("banner");
        await expect(intestazione.getByText("Coaching Planner", { exact: true })).toBeVisible();
        const titolo = intestazione.getByRole("heading", { name: area === "impostazioni" ? "Impostazioni" : "Le mie attività", exact: true });
        await expect(titolo).toBeVisible();
        const boxTitolo = await titolo.boundingBox();
        const boxSimbolo = await logo(page).boundingBox();
        expect(boxTitolo!.y).toBeGreaterThanOrEqual(boxSimbolo!.y + boxSimbolo!.height);
      }
      if (area === "amministratore") {
        await expect(page.getByRole("link", { name: "Console amministrativa", exact: true })).toBeVisible();
      }
      await page.setViewportSize({ width: 320, height: 800 });
      await verificaIntestazione(page, area === "console" ? 58 : 116);
    });
  }

  test("logo e icona del browser sono serviti localmente", async ({ page }) => {
    await accediComeCollaboratore(page);
    await expect(logo(page)).toHaveAttribute("src", "/coaching-planner-logo.svg");
    const rispostaLogo = await page.request.get("/coaching-planner-logo.svg");
    expect(rispostaLogo.status()).toBe(200);
    expect(rispostaLogo.headers()["content-type"]).toContain("image/svg+xml");
    const icona = page.locator('link[rel="icon"][type="image/svg+xml"]');
    await expect(icona).toHaveAttribute("href", /^\/icon\.svg/);
    const rispostaIcona = await page.request.get((await icona.getAttribute("href"))!);
    expect(rispostaIcona.status()).toBe(200);
  });
});
