import type { Page } from "@playwright/test";

import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Elenco attività: vista tabellare del mese alternativa al calendario,
 * filtrabile per cliente, offerta e testo della nota. «Modifica» e «Aggiungi»
 * passano dalla giornata, che riporta all'Elenco con i filtri; «Elimina»
 * agisce in tabella dopo una conferma. Ogni scenario usa un collaboratore
 * creato dalla factory, quindi il mese riservato non è condiviso.
 */

const MESE = meseRiservato("ELENCO-ATTIVITA-MESE");

/** Scrittura del giorno civile con la stessa convenzione UTC dell'applicazione. */
function dataDb(giorno: string): Date {
  return new Date(`${giorno}T12:00:00.000Z`);
}

async function apriElenco(page: Page) {
  await page.goto(`/attivita?mese=${MESE}`);
  await page.getByRole("navigation", { name: "Vista delle attività" }).getByRole("link", { name: "Elenco", exact: true }).click();
  await page.waitForURL(/vista=elenco/);
  const elenco = page.getByRole("region", { name: "Elenco delle attività del mese" });
  await expect(elenco).toHaveAttribute("data-idratata", "true");
  return elenco;
}

test.describe("Elenco attività del mese", () => {
  test("filtra per cliente e nota, modifica dalla giornata e torna all'elenco filtrato", async ({
    page,
    factory,
  }) => {
    const collaboratore = await factory.createCollaboratore();
    const alfa = await factory.createClienteConOfferta();
    const beta = await factory.createClienteConOfferta();
    const marcatore = `retro-${collaboratore.collaboratore.id.slice(0, 8)}`;

    await factory.createRigaAttivita({ collaboratore, cliente: alfa.cliente, offerta: alfa.offerta, data: dataDb(dataNelMese(MESE, 4)), ore: "2.00", nota: `Sprint ${marcatore}` });
    await factory.createRigaAttivita({ collaboratore, cliente: alfa.cliente, offerta: alfa.offerta, data: dataDb(dataNelMese(MESE, 11)), ore: "6.00", nota: "Planning", rimborsoTrasfertaEtichetta: "Trasferta", rimborsoTrasfertaImporto: "45.00" });
    await factory.createRigaAttivita({ collaboratore, cliente: beta.cliente, offerta: beta.offerta, data: dataDb(dataNelMese(MESE, 18)), ore: "3.00", nota: `Kickoff ${marcatore}` });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    const elenco = await apriElenco(page);
    const righe = elenco.getByTestId("riga-elenco");

    await expect(righe).toHaveCount(3);
    await expect(elenco.getByTestId("totale-ore-elenco")).toHaveText("11 h");

    await page.getByLabel("Cliente").selectOption({ label: alfa.cliente.ragioneSociale });
    await expect(righe).toHaveCount(2);
    await expect(elenco.getByTestId("totale-elenco")).toHaveText("2 righe su 3 · totale filtrato");
    await expect(elenco.getByTestId("totale-rimborsi-elenco")).toHaveText("€ 45,00");

    await page.getByLabel("Cerca nella nota").fill(marcatore.toUpperCase());
    await expect(righe).toHaveCount(1);
    await expect(righe.first()).toContainText(`Sprint ${marcatore}`);
    await expect(page).toHaveURL(new RegExp(`cliente=${alfa.cliente.id}.*nota=`, "i"));

    await righe.first().getByRole("link", { name: /^Modifica riga/ }).click();
    await page.waitForURL(new RegExp(`/attivita/${dataNelMese(MESE, 4)}\\?`));
    await expect(page.getByRole("button", { name: "Salva modifiche" })).toBeVisible();
    await expect(page.locator("#ore")).toHaveValue("2");
    await page.locator("#ore").fill("2,5");
    await page.getByRole("button", { name: "Salva modifiche" }).click();
    await expect(page.getByTestId("activity-row").filter({ hasText: marcatore })).toContainText("2.5 h");

    await page.getByRole("link", { name: "Torna all'elenco" }).click();
    await page.waitForURL(/vista=elenco/);
    await expect(elenco).toHaveAttribute("data-idratata", "true");
    await expect(page.getByLabel("Cliente")).toHaveValue(alfa.cliente.id);
    await expect(page.getByLabel("Cerca nella nota")).toHaveValue(marcatore.toUpperCase());
    await expect(righe).toHaveCount(1);
    await expect(elenco.getByTestId("totale-ore-elenco")).toHaveText("2,5 h");
  });

  test("elimina una riga dopo la conferma e apre la giornata per aggiungerne una", async ({
    page,
    factory,
  }) => {
    const collaboratore = await factory.createCollaboratore();
    const { cliente, offerta } = await factory.createClienteConOfferta();
    await factory.createRigaAttivita({ collaboratore, cliente, offerta, data: dataDb(dataNelMese(MESE, 5)), ore: "1.00", nota: "Da tenere" });
    await factory.createRigaAttivita({ collaboratore, cliente, offerta, data: dataDb(dataNelMese(MESE, 6)), ore: "4.00", nota: "Da eliminare" });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    const elenco = await apriElenco(page);
    const righe = elenco.getByTestId("riga-elenco");
    const daEliminare = righe.filter({ hasText: "Da eliminare" });

    await daEliminare.getByRole("button", { name: /^Elimina riga/ }).click();
    await daEliminare.getByRole("button", { name: "No", exact: true }).click();
    await expect(righe).toHaveCount(2);

    await daEliminare.getByRole("button", { name: /^Elimina riga/ }).click();
    await daEliminare.getByRole("button", { name: "Elimina", exact: true }).click();
    await expect(righe).toHaveCount(1);
    await expect(righe.first()).toContainText("Da tenere");
    await expect(elenco.getByTestId("totale-ore-elenco")).toHaveText("1 h");

    // Il calendario non mostra più le ore eliminate.
    await page.getByRole("navigation", { name: "Vista delle attività" }).getByRole("link", { name: "Calendario", exact: true }).click();
    await expect(page.getByRole("region", { name: "Calendario mensile delle attività" })).toBeVisible();
    await expect(page.getByText("1 righe", { exact: true })).toBeVisible();

    await page.getByRole("navigation", { name: "Vista delle attività" }).getByRole("link", { name: "Elenco", exact: true }).click();
    await expect(elenco).toHaveAttribute("data-idratata", "true");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    const giorno = page.getByRole("form", { name: "Giorno della nuova riga" });
    await giorno.getByLabel("Giorno della nuova riga").fill(dataNelMese(MESE, 20));
    await giorno.getByRole("button", { name: "Apri giornata" }).click();
    await page.waitForURL(new RegExp(`/attivita/${dataNelMese(MESE, 20)}\\?`));
    await expect(page.getByRole("link", { name: "Torna all'elenco" })).toBeVisible();
    await expect(page.locator("#form-riga")).toBeVisible();
  });
});
