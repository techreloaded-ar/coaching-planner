import { test, expect, type Page } from "@playwright/test";

import {
  accediAlBackOfficeComeAdmin,
  accediComeAdmin,
  accediComeCollaboratore,
} from "./support/auth";
import { SFONDO_SCURO } from "./support/tema";
import { apriMenuNavigazione, pulsanteMenuAccount, sidebar } from "./support/menu-account";
import { voceNavigazione } from "./support/navigazione";

// Scenari read-only: gli utenti seed servono solo ad accedere.
// Il marchio sta in cima alla sidebar comune, l'account in fondo. Sotto 920 px
// la sidebar è un menu a scomparsa: l'intestazione resta compatta, con il
// pulsante del menu e il titolo (o il logo nella console).
function logo(page: Page) {
  return page.getByRole("img", { name: "Coaching Planner", exact: true });
}

async function verificaSimbolo(page: Page) {
  const visibile = logo(page).filter({ visible: true });
  await expect(visibile).toHaveCount(1);
  await expect(visibile).toHaveAttribute("src", "/coaching-planner-logo.svg");
  await expect.poll(() => visibile.evaluate(
    (immagine) => (immagine as HTMLImageElement).complete && (immagine as HTMLImageElement).naturalWidth > 0,
  )).toBe(true);
  const simbolo = (await visibile.boundingBox())!;
  expect(simbolo.width).toBe(36);
  expect(simbolo.height).toBe(36);
}

/** Da 920 px: marchio in cima alla sidebar, account in fondo, nessun logo nell'intestazione. */
async function verificaSidebar(page: Page) {
  await verificaSimbolo(page);
  await expect(sidebar(page).getByRole("img", { name: "Coaching Planner", exact: true })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("img", { name: "Coaching Planner", exact: true })).toHaveCount(0);
  const marchio = (await sidebar(page).getByTestId("logo-coaching-planner").boundingBox())!;
  const account = (await pulsanteMenuAccount(page).boundingBox())!;
  expect(account.y).toBeGreaterThan(marchio.y + marchio.height);
}

/** Sotto 920 px: intestazione compatta, senza sporgenze, con il pulsante del menu. */
async function verificaIntestazioneMobile(page: Page, altezzaMassima: number) {
  const intestazione = page.getByRole("banner");
  await expect(intestazione.getByRole("button", { name: "Apri menu di navigazione" })).toBeVisible();
  await expect.poll(() => intestazione.evaluate((header) => header.scrollWidth - header.clientWidth)).toBe(0);
  const box = (await intestazione.boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(altezzaMassima);
}

test.describe("Logo Coaching Planner nella sidebar", () => {
  test("le attività mostrano il marchio nella sidebar e il titolo nell'intestazione", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await accediComeCollaboratore(page);
    await expect(sidebar(page).getByText("Coaching Planner", { exact: true })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("heading", { name: "Le mie attività", exact: true })).toBeVisible();
    await expect(page.getByText("Front office", { exact: true })).toHaveCount(0);
    await verificaSidebar(page);
  });

  test("la console mostra un solo logo nella sidebar anche dopo la navigazione", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await accediAlBackOfficeComeAdmin(page);
    await verificaSidebar(page);
    await voceNavigazione(page, "Offerte").click();
    await page.waitForURL("**/offerte");
    await verificaSidebar(page);
  });

  for (const tema of ["scuro", "chiaro"] as const) {
    test(`tema ${tema}: simbolo intero e fondo leggibile`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "tema", value: tema, url: baseURL! }]);
      await accediComeCollaboratore(page);
      await expect(page.locator("html")).toHaveAttribute("data-tema", tema);
      if (tema === "scuro") {
        await expect(page.locator("body")).toHaveCSS("background-color", SFONDO_SCURO);
      }
      await expect(sidebar(page).getByTestId("simbolo-coaching-planner")).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await verificaSidebar(page);
    });
  }

  for (const area of ["collaboratore", "amministratore", "console"] as const) {
    test(`mobile, ${area}: intestazione compatta e marchio nel menu a scomparsa`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      if (area === "console") {
        await accediAlBackOfficeComeAdmin(page);
      } else if (area === "amministratore") {
        await accediComeAdmin(page);
      } else {
        await accediComeCollaboratore(page);
      }
      await verificaIntestazioneMobile(page, area === "amministratore" ? 116 : 70);
      if (area === "console") {
        // Senza titolo, l'intestazione della console porta il logo.
        await expect(page.getByRole("banner").getByRole("img", { name: "Coaching Planner", exact: true })).toBeVisible();
      } else {
        await expect(page.getByRole("banner").getByRole("heading", { name: "Le mie attività", exact: true })).toBeVisible();
      }

      await apriMenuNavigazione(page);
      await expect(sidebar(page).getByRole("img", { name: "Coaching Planner", exact: true })).toBeVisible();
      await expect(pulsanteMenuAccount(page)).toBeVisible();
      if (area !== "collaboratore") {
        await expect(voceNavigazione(page, "Clienti")).toBeVisible();
      }

      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 320, height: 800 });
      await verificaIntestazioneMobile(page, area === "amministratore" ? 116 : 70);
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
