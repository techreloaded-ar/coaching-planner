import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { dataNelMese, mesePassatoRiservato, meseRiservato } from "./support/date";
import { cercaNellElenco } from "./support/elenchi";
import { test, expect, type E2eDataFactory } from "./support/fixtures";
import {
  apriPaginaOfferte,
  attendiTabellaOfferteClienteIdratata,
} from "./support/offerte";

/**
 * Dal Dettaglio avanzamento di un'offerta il nome del collaboratore apre il suo
 * foglio attività in vista Elenco, filtrato sull'offerta e posizionato
 * sull'ultimo mese in cui vi ha segnato ore. Collaboratore, clienti e offerte
 * sono della factory: le righe del mese riservato non sono condivise.
 */

const MESE_RECENTE = meseRiservato("AVANZAMENTO-FOGLIO-COLLABORATORE");
const MESE_PRECEDENTE = mesePassatoRiservato("AVANZAMENTO-FOGLIO-COLLABORATORE");

function dataDb(giorno: string): Date {
  return new Date(`${giorno}T12:00:00.000Z`);
}

/** Ore sull'offerta in due mesi e, nel mese recente, su un'altra offerta. */
async function preparaOreSuDueMesi(factory: E2eDataFactory) {
  const codice = `E2E-FOGLIO-${randomUUID().slice(0, 8)}`.toUpperCase();
  const { cliente, offerta } = await factory.createClienteConOfferta(
    { ragioneSociale: `E2E Foglio ${codice}` },
    { codice, giorniPrevisti: 10 },
  );
  const altra = await factory.createClienteConOfferta();
  const collaboratore = await factory.createCollaboratore({ nome: "Grace", cognome: codice });

  await factory.createRigaAttivita({ collaboratore, cliente, offerta, data: dataDb(dataNelMese(MESE_PRECEDENTE, 9)), ore: "8.00", categoria: "FATTURABILE" });
  await factory.createRigaAttivita({ collaboratore, cliente, offerta, data: dataDb(dataNelMese(MESE_RECENTE, 14)), ore: "4.00", categoria: "FATTURABILE", nota: `Sessione ${codice}` });
  await factory.createRigaAttivita({ collaboratore, cliente: altra.cliente, offerta: altra.offerta, data: dataDb(dataNelMese(MESE_RECENTE, 15)), ore: "2.00", categoria: "FATTURABILE" });

  return { codice, offerta, collaboratore, nome: `Grace ${codice}` };
}

async function verificaElencoFiltrato(
  page: Page,
  { codice, offerta, collaboratore }: Awaited<ReturnType<typeof preparaOreSuDueMesi>>,
) {
  await page.waitForURL(/\/attivita\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get("vista")).toBe("elenco");
  expect(url.searchParams.get("mese")).toBe(MESE_RECENTE);
  expect(url.searchParams.get("offerta")).toBe(offerta.id);
  expect(url.searchParams.get("collaboratore")).toBe(collaboratore.collaboratore.id);

  await expect(page.getByTestId("banner-foglio-consultato")).toContainText(`Grace ${codice}`);
  const elenco = page.getByRole("region", { name: "Elenco delle attività del mese" });
  await expect(elenco).toHaveAttribute("data-idratata", "true");
  await expect(page.getByLabel("Offerta")).toHaveValue(offerta.id);
  const righe = elenco.getByTestId("riga-elenco");
  await expect(righe).toHaveCount(1);
  await expect(righe.first()).toContainText(`Sessione ${codice}`);
}

test.describe("Dettaglio avanzamento: foglio attività del collaboratore", () => {
  test("dalla matrice mensile in /offerte apre l'Elenco sull'ultimo mese, filtrato sull'offerta", async ({
    page,
    factory,
  }) => {
    const dati = await preparaOreSuDueMesi(factory);

    await accediAlBackOfficeComeAdmin(page);
    await apriPaginaOfferte(page);
    await cercaNellElenco(page, "/offerte", dati.codice);
    const riga = page.getByRole("row", { name: new RegExp(dati.codice) });
    await riga.getByText(dati.codice, { exact: true }).click();

    const dettaglio = page.getByRole("region", { name: `Dettaglio avanzamento ${dati.codice}` });
    await dettaglio
      .getByRole("table", { name: "Giornate erogate per collaboratore e mese" })
      .getByRole("link", { name: dati.nome, exact: true })
      .click();

    await verificaElencoFiltrato(page, dati);
  });

  test("dal dettaglio cliente apre l'Elenco sull'ultimo mese, filtrato sull'offerta", async ({
    page,
    factory,
  }) => {
    const dati = await preparaOreSuDueMesi(factory);

    await accediAlBackOfficeComeAdmin(page);
    await page.goto(`/anagrafiche/clienti/${dati.offerta.clienteId}`);
    await attendiTabellaOfferteClienteIdratata(page);
    const riga = page
      .getByRole("table", { name: "Offerte del cliente" })
      .getByRole("row", { name: new RegExp(dati.codice) });
    await riga.getByText(dati.codice, { exact: true }).click();

    const dettaglio = page.getByRole("region", { name: `Dettaglio avanzamento ${dati.codice}` });
    await dettaglio
      .getByRole("table", { name: "Giornate erogate per collaboratore", exact: true })
      .getByRole("link", { name: dati.nome, exact: true })
      .click();

    await verificaElencoFiltrato(page, dati);
  });
});
