import { randomUUID } from "node:crypto";

import { type Locator, type Page } from "@playwright/test";

import {
  selezionaClienteEOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseCorrenteToken } from "./support/date";
import {
  test,
  expect,
  type ClienteConOffertaTestData,
  type CollaboratoreTestData,
  type E2eDataFactory,
} from "./support/fixtures";

/**
 * US-013: Registrazione della trasferta con rimborso automatico.
 *
 * Lo scenario usa un collaboratore e una cliente/offerta creati dal test, mentre
 * gli importi attesi derivano dagli scaglioni km di seed stabili (50→35,00 € e
 * 250→110,00 €).
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 200 },
});

const EPS = 0.01;
const TARIFFA_COLLABORATORE = "410.00";
const TARIFFA_OFFERTA = "620.00";

type ScenarioTrasferta = {
  mese: string;
  data: string;
  collaboratore: CollaboratoreTestData;
  clienteConOfferta: ClienteConOffertaTestData;
};

function parseNumero(valore: string): number {
  const normalizzato = valore.replace(/[^\d,.-]/g, "");
  const ultimoPunto = normalizzato.lastIndexOf(".");
  const ultimaVirgola = normalizzato.lastIndexOf(",");

  if (ultimoPunto >= 0 && ultimaVirgola >= 0) {
    const separatoreDecimale = ultimoPunto > ultimaVirgola ? "." : ",";
    return Number.parseFloat(
      separatoreDecimale === ","
        ? normalizzato.replace(/\./g, "").replace(",", ".")
        : normalizzato.replace(/,/g, ""),
    );
  }

  if (ultimaVirgola >= 0) {
    return Number.parseFloat(normalizzato.replace(/\./g, "").replace(",", "."));
  }

  return Number.parseFloat(normalizzato);
}

function expectImportoEsatto(valore: number, atteso: number, label: string) {
  expect(Math.abs(valore - atteso), `${label}: atteso ${atteso}, letto ${valore}`).toBeLessThanOrEqual(EPS);
}

async function creaScenarioTrasferta(factory: E2eDataFactory): Promise<ScenarioTrasferta> {
  const seed = randomUUID().slice(0, 8);
  const mese = meseCorrenteToken();
  const collaboratore = await factory.createCollaboratore({
    nome: "E2E Trasferta",
    cognome: seed,
    tariffaGiornaliera: TARIFFA_COLLABORATORE,
  });
  const clienteConOfferta = await factory.createClienteConOfferta(
    { ragioneSociale: `E2E Trasferta ${seed}` },
    {
      codice: `TRASF-${seed}`,
      descrizione: `Offerta trasferta ${seed}`,
      tariffaGiornaliera: TARIFFA_OFFERTA,
    },
  );

  return {
    mese,
    data: dataNelMese(mese, 12),
    collaboratore,
    clienteConOfferta,
  };
}

function previewRimborso(page: Page): Locator {
  return page.locator("div").filter({ has: page.getByText(/Rimborso stimato/) }).last();
}

function cardAttivita(page: Page, nota: string): Locator {
  return page
    .getByTestId("activity-row")
    .filter({ has: page.getByText(nota, { exact: true }) });
}

async function leggiTotaleRimborsiGiorno(page: Page): Promise<number> {
  const testo = await page.getByTestId("day-summary-rimborsi").textContent();

  return parseNumero(testo ?? "0");
}

async function apriGiornataTrasferta(page: Page, scenario: ScenarioTrasferta) {
  await accediComeCollaboratore(page, scenario.collaboratore.utente.email);
  await page.goto(`/attivita/${scenario.data}?mese=${scenario.mese}`);
  await page.waitForURL(`**/attivita/${scenario.data}**`);

  await expect(page.getByRole("link", { name: "Torna al calendario" })).toBeVisible();
  await expect(page.getByText("Totale rimborsi", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Distanza trasferta")).toBeVisible();
}

test.describe("US-013 Demo — Trasferta con rimborso automatico", () => {
  test("flusso completo: inserimento km, preview, salvataggio, modifica e rimozione", async ({
    page,
    factory,
  }) => {
    test.setTimeout(90_000);

    const scenario = await creaScenarioTrasferta(factory);
    const notaRiga = `Test e2e trasferta — ${randomUUID()}`;

    await apriGiornataTrasferta(page, scenario);
    expectImportoEsatto(await leggiTotaleRimborsiGiorno(page), 0, "totale rimborsi iniziale");

    const inputOre = page.locator("#ore");
    const inputKm = page.locator("#trasfertaKm");
    const textareaNota = page.locator("#nota");
    const bottoneAggiungiRiga = page.getByRole("button", { name: "Aggiungi riga" });

    await selezionaClienteEOffertaTest(page, scenario.clienteConOfferta);
    await inputOre.fill("3,5");
    await textareaNota.fill(notaRiga);

    await inputKm.fill("150");
    await expect(previewRimborso(page)).toContainText(/fino a 250 km/);
    await expect(previewRimborso(page)).toContainText(/€\s*110[,.]00/);

    await bottoneAggiungiRiga.click();

    const card = cardAttivita(page, notaRiga);
    await expect(card).toBeVisible();
    await expect(page.getByText("150 km", { exact: true })).toBeVisible();
    await expect(page.getByText(/fino a 250 km/)).toBeVisible();
    await expect(page.getByText(/€\s*110[,.]00/).last()).toBeVisible();
    expectImportoEsatto(await leggiTotaleRimborsiGiorno(page), 110, "totale rimborsi dopo salvataggio");

    await card.getByRole("button", { name: "Modifica" }).click();
    await expect(page.getByText("Modifica riga")).toBeVisible();
    await expect(inputKm).toHaveValue("150");

    await inputKm.fill("50");
    await expect(previewRimborso(page)).toContainText(/fino a 50 km/);
    await expect(previewRimborso(page)).toContainText(/€\s*35[,.]00/);

    await page.getByRole("button", { name: "Salva modifiche" }).click();

    await expect(page.getByText("50 km", { exact: true })).toBeVisible();
    await expect(page.getByText(/fino a 50 km/)).toBeVisible();
    await expect(page.getByText(/€\s*35[,.]00/).last()).toBeVisible();
    expectImportoEsatto(await leggiTotaleRimborsiGiorno(page), 35, "totale rimborsi dopo modifica");

    page.once("dialog", (dialog) => dialog.accept());
    await card.getByRole("button", { name: "Rimuovi trasferta" }).click();

    await expect(page.getByText("50 km", { exact: true })).not.toBeVisible();
    await expect(card.getByRole("button", { name: "Rimuovi trasferta" })).not.toBeVisible();
    expectImportoEsatto(await leggiTotaleRimborsiGiorno(page), 0, "totale rimborsi dopo rimozione");
  });
});
