import type { Locator, Page, TestInfo } from "@playwright/test";
import { accediAlBackOfficeComeAdmin, accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";
import { apriMenuNavigazione, sidebar } from "./support/menu-account";
import { creaDatasetReportFatturazioneClienti } from "./support/report-data";

/**
 * Layout mobile di calendario, console amministrativa e Fatturazione clienti.
 *
 * A ogni larghezza la pagina resta entro il viewport (le tabelle scorrono nel
 * proprio contenitore), i comandi principali restano visibili e, su
 * smartphone, toccabili su almeno 44 × 44 px. Sotto 920 px la sidebar comune
 * diventa un menu a scomparsa che entra dal bordo sinistro.
 */

const LARGHEZZE = [375, 390, 768, 1280] as const;
const SMARTPHONE = 640;
const AREA_TOCCO_MINIMA = 44;

function dataDb(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00.000Z`);
}

async function attendiPaginaEntroViewport(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(0);
}

async function verificaComando(comando: Locator, larghezza: number) {
  await expect(comando).toBeVisible();
  const box = (await comando.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(larghezza);
  if (larghezza < SMARTPHONE) {
    expect(box.height).toBeGreaterThanOrEqual(AREA_TOCCO_MINIMA);
    expect(box.width).toBeGreaterThanOrEqual(AREA_TOCCO_MINIMA);
  }
}

/** Screenshot nei due temi, allegati al report per la revisione visiva. */
async function fotografaNeiTemi(page: Page, testInfo: TestInfo, nome: string, attendiPronta: () => Promise<void>) {
  for (const tema of ["chiaro", "scuro"] as const) {
    await page.context().addCookies([{ name: "tema", value: tema, url: page.url() }]);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-tema", tema);
    await attendiPronta();
    await attendiPaginaEntroViewport(page);
    const percorso = testInfo.outputPath(`${nome}-${tema}.png`);
    await page.screenshot({ path: percorso, fullPage: true });
    await testInfo.attach(`${nome}-${tema}`, { path: percorso, contentType: "image/png" });
  }
}

/**
 * Su smartphone la barra del mese è compatta: frecce e mese sulla prima riga,
 * poi comandi e vista a sola icona (il testo resta come nome accessibile).
 * «Riepilogo mese» non è più nella barra: si apre dalla sidebar.
 */
async function verificaBarraCompatta(page: Page, larghezza: number) {
  if (larghezza >= SMARTPHONE) return;
  const vista = page.getByRole("navigation", { name: "Vista delle attività" });
  const mese = (await page.getByTestId("calendar-month-label").boundingBox())!;
  const comandi = [
    page.getByRole("button", { name: "Mese corrente", exact: true }).or(page.getByRole("link", { name: "Mese corrente", exact: true })),
    vista.getByRole("link", { name: "Calendario", exact: true }),
    vista.getByRole("link", { name: "Elenco", exact: true }),
  ];
  const primo = (await comandi[0].boundingBox())!;
  for (const comando of comandi) {
    const box = (await comando.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(AREA_TOCCO_MINIMA + 1);
    expect(box.y).toBeGreaterThanOrEqual(mese.y + mese.height);
    expect(Math.abs(box.y + box.height / 2 - (primo.y + primo.height / 2))).toBeLessThanOrEqual(2);
  }
}

test.describe("Layout mobile", () => {
  for (const larghezza of LARGHEZZE) {
    test(`calendario a ${larghezza} px: toolbar utilizzabile e celle confinate`, async ({
      page,
      collaboratore,
      factory,
    }, testInfo) => {
      const mese = meseRiservato("LAYOUT-MOBILE-CAL");
      const data = dataNelMese(mese, 12);
      const cliente = await factory.createCliente({
        ragioneSociale: `Ragione sociale molto lunga per il layout mobile ${factory.namespace}`,
      });
      const offerta = await factory.createOfferta({ cliente });
      await factory.createAbilitazioneOfferta({ collaboratore, offerta });
      await factory.createRigaAttivita({ collaboratore, cliente, offerta, data: dataDb(data), ore: "8.00" });

      await page.setViewportSize({ width: larghezza, height: 900 });
      await accediComeCollaboratore(page, collaboratore.utente.email);
      await page.goto(`/attivita?mese=${mese}`);
      const calendario = page.getByLabel("Calendario mensile delle attività");
      await expect(calendario).toHaveAttribute("data-idratata", "true");
      await attendiPaginaEntroViewport(page);

      await verificaComando(page.getByRole("button", { name: "Mese precedente" }), larghezza);
      await verificaComando(page.getByTestId("calendar-month-label"), larghezza);
      await verificaComando(page.getByRole("button", { name: "Mese successivo" }), larghezza);
      await verificaComando(page.getByRole("button", { name: "Mese corrente", exact: true }), larghezza);
      await expect(page.getByRole("main").getByRole("link", { name: "Riepilogo mese" })).toHaveCount(0);
      const vista = page.getByRole("navigation", { name: "Vista delle attività" });
      await verificaComando(vista.getByRole("link", { name: "Calendario", exact: true }), larghezza);
      await verificaComando(vista.getByRole("link", { name: "Elenco", exact: true }), larghezza);
      await verificaBarraCompatta(page, larghezza);

      const cella = page.locator(`a[href="/attivita/${data}?mese=${mese}"]`);
      await expect(cella).toHaveAttribute("data-con-attivita", "true");
      await expect(cella.getByTestId("totali-giorno")).toHaveText("8 h");
      await expect(cella.getByTestId("totali-giorno")).toBeVisible();
      const boxCella = (await cella.boundingBox())!;

      if (larghezza < SMARTPHONE) {
        // Su smartphone: giorno e ore; clienti e righe restano nella giornata.
        await expect(cella.getByTestId("etichetta-cliente")).toBeHidden();
        await expect(cella.getByTestId("numero-righe")).toBeHidden();
      } else {
        await expect(cella.getByTestId("numero-righe")).toBeVisible();
        const etichetta = cella.getByTestId("etichetta-cliente");
        await expect(etichetta).toBeVisible();
        const boxEtichetta = (await etichetta.boundingBox())!;
        expect(boxEtichetta.x + boxEtichetta.width).toBeLessThanOrEqual(boxCella.x + boxCella.width);
      }

      // Nessun contenuto della cella esce dai suoi bordi.
      const sporgenza = await cella.evaluate((elemento) => elemento.scrollWidth - elemento.clientWidth);
      expect(sporgenza).toBeLessThanOrEqual(0);

      if (larghezza < SMARTPHONE) {
        await fotografaNeiTemi(page, testInfo, `calendario-${larghezza}`, () =>
          expect(calendario).toHaveAttribute("data-idratata", "true"),
        );
        await cella.click();
        await page.waitForURL(`**/attivita/${data}**`);
        // Il form precede l'elenco: il nome va cercato nella riga registrata,
        // non tra le opzioni (nascoste) del select Cliente.
        await expect(page.getByTestId("activity-row").getByText(cliente.ragioneSociale)).toBeVisible();
      }
    });

    test(`Fatturazione clienti a ${larghezza} px: pagina entro il viewport`, async ({ page, factory }, testInfo) => {
      const dataset = await creaDatasetReportFatturazioneClienti(factory, {
        codiceSpec: "LAYOUT-MOBILE-FATTURAZIONE",
      });

      await page.setViewportSize({ width: larghezza, height: 900 });
      await accediAlBackOfficeComeAdmin(page);
      await page.goto(`/report/fatturazione-clienti?mese=${dataset.mese}`);
      const schedaCliente = page.getByTestId(`report-client-${dataset.cliente.id}`);
      await expect(schedaCliente).toBeVisible();
      await attendiPaginaEntroViewport(page);

      await verificaComando(page.getByRole("button", { name: "Mese precedente" }), larghezza);
      await verificaComando(page.getByRole("button", { name: "Mese successivo" }), larghezza);
      await verificaComando(page.getByRole("button", { name: "Mese corrente", exact: true }), larghezza);
      await verificaComando(page.getByTestId("esporta-excel"), larghezza);

      const boxScheda = (await schedaCliente.boundingBox())!;
      expect(boxScheda.x + boxScheda.width).toBeLessThanOrEqual(larghezza);

      if (larghezza < SMARTPHONE) {
        await fotografaNeiTemi(page, testInfo, `fatturazione-clienti-${larghezza}`, () =>
          expect(schedaCliente).toBeVisible(),
        );
      }
    });
  }

  for (const larghezza of LARGHEZZE) {
    test(`barra del mese di Elenco attività a ${larghezza} px`, async ({ page, collaboratore }) => {
      const mese = meseRiservato("LAYOUT-MOBILE-CAL");

      await page.setViewportSize({ width: larghezza, height: 900 });
      await accediComeCollaboratore(page, collaboratore.utente.email);
      await page.goto(`/attivita?mese=${mese}&vista=elenco`);
      const vista = page.getByRole("navigation", { name: "Vista delle attività" });
      await expect(vista.getByRole("link", { name: "Elenco", exact: true })).toHaveAttribute("aria-current", "page");
      await attendiPaginaEntroViewport(page);
      await verificaComando(page.getByRole("link", { name: "Mese precedente" }), larghezza);
      await verificaComando(page.getByRole("link", { name: "Mese successivo" }), larghezza);
      await verificaComando(page.getByRole("link", { name: "Mese corrente", exact: true }), larghezza);
      await expect(page.getByRole("main").getByRole("link", { name: "Riepilogo mese" })).toHaveCount(0);
      await verificaComando(vista.getByRole("link", { name: "Calendario", exact: true }), larghezza);
      await verificaBarraCompatta(page, larghezza);
    });

    test(`barra del mese di Fatturazione collaboratori a ${larghezza} px`, async ({ page }, testInfo) => {
      const mese = meseRiservato("LAYOUT-MOBILE-CAL");

      await page.setViewportSize({ width: larghezza, height: 900 });
      await accediAlBackOfficeComeAdmin(page);
      await page.goto(`/report/fatturazione-collaboratori?mese=${mese}`);
      await expect(page.getByRole("heading", { level: 1, name: "Fatture attese dai collaboratori" })).toBeVisible();
      await attendiPaginaEntroViewport(page);
      await verificaComando(page.getByRole("button", { name: "Invia promemoria di fine mese" }), larghezza);
      await verificaComando(page.getByRole("link", { name: "Mese precedente" }), larghezza);
      await verificaComando(page.getByRole("link", { name: "Mese successivo" }), larghezza);
      await verificaComando(page.getByRole("link", { name: "Mese corrente", exact: true }), larghezza);

      if (larghezza < SMARTPHONE) {
        const percorso = testInfo.outputPath(`fatturazione-collaboratori-${larghezza}.png`);
        await page.screenshot({ path: percorso });
        await testInfo.attach(`fatturazione-collaboratori-${larghezza}`, { path: percorso, contentType: "image/png" });
      }
    });
  }

  for (const larghezza of [390, 768] as const) {
    test(`console a ${larghezza} px: la sidebar diventa un menu a scomparsa dal bordo sinistro`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: larghezza, height: 900 });
      await accediAlBackOfficeComeAdmin(page);
      await page.goto("/report/fatturazione-clienti");

      await expect(sidebar(page)).toBeHidden();
      const apriMenu = page.getByRole("button", { name: "Apri menu di navigazione" });
      await verificaComando(apriMenu, larghezza);
      await expect(apriMenu).toHaveAttribute("aria-expanded", "false");

      await expect(page.getByTestId("menu-account")).toHaveAttribute("data-idratata", "true");
      await apriMenu.focus();
      await page.keyboard.press("Enter");
      const menu = sidebar(page);
      await expect(menu).toBeVisible();
      const boxMenu = (await menu.boundingBox())!;
      expect(boxMenu.x).toBe(0);
      expect(boxMenu.width).toBeLessThan(larghezza);
      const navigazione = menu.getByRole("navigation", { name: "Navigazione principale" });
      await expect(navigazione.getByRole("link", { name: "Fatturazione clienti", exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      for (const voce of ["Le mie attività", "Riepilogo mese", "Clienti", "Offerte", "Persone", "Marginalità", "Importazione"]) {
        await expect(navigazione.getByRole("link", { name: voce, exact: true })).toBeVisible();
      }
      await expect(menu.getByRole("button", { name: "Menu dell'account", exact: true })).toBeVisible();
      await expect(menu.getByRole("button", { name: /barra laterale/ })).toBeHidden();
      // Il focus entra nel menu all'apertura.
      await expect(menu.getByRole("button", { name: "Chiudi menu di navigazione" })).toBeFocused();

      const percorso = testInfo.outputPath(`menu-console-${larghezza}.png`);
      await page.screenshot({ path: percorso });
      await testInfo.attach(`menu-console-${larghezza}`, { path: percorso, contentType: "image/png" });

      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(apriMenu).toBeFocused();
      await expect(apriMenu).toHaveAttribute("aria-expanded", "false");

      await apriMenu.click();
      await menu.getByRole("button", { name: "Chiudi menu di navigazione" }).click();
      await expect(menu).toBeHidden();
      await expect(apriMenu).toBeFocused();
    });
  }

  test("collaboratore a 390 px: il menu a scomparsa ha solo le voci delle attività e si chiude scegliendo una voce", async ({
    page,
    collaboratore,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await accediComeCollaboratore(page, collaboratore.utente.email);
    await apriMenuNavigazione(page);
    const navigazione = sidebar(page).getByRole("navigation", { name: "Navigazione principale" });
    await expect(navigazione.getByRole("link")).toHaveCount(2);
    await navigazione.getByRole("link", { name: "Riepilogo mese", exact: true }).click();
    await page.waitForURL("**/attivita/riepilogo**");
    await expect(sidebar(page)).toBeHidden();
  });

  test("console a 1280 px: sidebar fissa con etichette, senza pulsante menu", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await accediAlBackOfficeComeAdmin(page);

    const sidebar = page.getByRole("complementary");
    await expect(sidebar.getByRole("link", { name: "Fatturazione clienti", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Apri menu di navigazione" })).toBeHidden();
  });
});
