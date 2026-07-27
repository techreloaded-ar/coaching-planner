import { randomUUID } from "node:crypto";

import { type Locator, type Page } from "@playwright/test";

import { selezionaClienteEOffertaTest } from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import {
  dataNelMesePassatoRiservato,
  mesePassatoRiservato,
} from "./support/date";
import { test, expect } from "./support/fixtures";

test.use({
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 100 },
});

function cardAttivitaPerNota(page: Page, nota: string): Locator {
  return page
    .getByTestId("activity-row")
    .filter({ has: page.getByText(nota, { exact: true }) });
}

test.describe("US-012 Mese concluso — nessun blocco temporale", () => {
  test("aggiunta, modifica ed eliminazione su data passata", async ({
    page,
    factory,
    collaboratore,
    clienteConOfferta,
  }) => {
    test.setTimeout(60_000);

    const codiceSpec = "US-023-TASK-05-MESE-CONCLUSO";
    const dataPassata = dataNelMesePassatoRiservato(codiceSpec, 2);
    const mesePassato = mesePassatoRiservato(codiceSpec);
    const notaUnivoca = `US-023 mese concluso ${randomUUID()}`;

    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    await page.goto(`/attivita/${dataPassata}?mese=${mesePassato}`);
    await page.waitForURL(`**/attivita/${dataPassata}**`);

    await expect(
      page.getByRole("link", { name: "Torna al calendario" })
    ).toBeVisible();

    await selezionaClienteEOffertaTest(page, clienteConOfferta);
    await page.locator("#ore").fill("4");
    await page.locator("#nota").fill(notaUnivoca);
    await page.getByRole("button", { name: "Aggiungi riga" }).click();

    const rigaCreata = cardAttivitaPerNota(page, notaUnivoca);
    await expect(rigaCreata).toBeVisible();
    await expect(rigaCreata).toContainText(clienteConOfferta.cliente.ragioneSociale);
    await expect(rigaCreata).toContainText(clienteConOfferta.offerta.codice);
    await expect(rigaCreata).toContainText("4.0 h");
  });
});
