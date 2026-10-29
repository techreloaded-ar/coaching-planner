import { randomUUID } from "node:crypto";

import { type Locator, type Page } from "@playwright/test";

import {
  dataOggiOffset,
  selezionaClienteEOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { dataNelMeseRiservato, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * US-012: Inserimento delle righe di attività giornaliere
 *
 * Scenario demo: Giulia accede al calendario, clicca un giorno con attività,
 * arriva alla pagina di dettaglio, aggiunge due righe, ne modifica una,
 * ne elimina un'altra e verifica il riepilogo.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 200 },
});

function cardAttivitaPerNota(page: Page, nota: string): Locator {
  return page
    .getByTestId("activity-row")
    .filter({ has: page.getByText(nota, { exact: true }) });
}

test.describe("US-012 Demo — Inserimento righe attività", () => {
  test("pilota fixture: collaboratore dedicato inserisce una riga per cliente e offerta creati", async ({
    page,
    factory,
    collaboratore,
    clienteConOfferta,
  }) => {
    test.setTimeout(60_000);

    const seed = randomUUID();
    const dataControllata = dataNelMeseRiservato("US-023-TASK-05", 12);
    const meseControllato = meseRiservato("US-023-TASK-05");
    const notaUnivoca = `US-023 fixture pilota ${seed}`;
    const clienteLabel = clienteConOfferta.cliente.ragioneSociale;

    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    await page.goto(`/attivita/${dataControllata}?mese=${meseControllato}`);
    await page.waitForURL(`**/attivita/${dataControllata}**`);
    await expect(page.getByText("Nuova riga attività")).toBeVisible();

    await selezionaClienteEOffertaTest(page, clienteConOfferta);

    await page.locator("#ore").fill("2,5");
    await page.locator("#nota").fill(notaUnivoca);
    await page.getByRole("button", { name: "Aggiungi riga" }).click();

    const rigaCreata = cardAttivitaPerNota(page, notaUnivoca);
    await expect(rigaCreata).toBeVisible();
    await expect(rigaCreata).toContainText(clienteLabel);
    await expect(rigaCreata).toContainText(clienteConOfferta.offerta.codice);
    await expect(rigaCreata).toContainText("2.5 h");
  });

  test("flusso completo: aggiunta, modifica ed eliminazione righe", async ({
    page,
    collaboratore,
    clienteConOfferta,
    factory,
  }) => {
    test.setTimeout(90_000);

    const seed = randomUUID();
    const secondaClienteConOfferta = await factory.createClienteConOfferta(
      { ragioneSociale: `US-023 Cliente seconda ${seed}` },
      {
        codice: `US023-${seed.slice(0, 8)}-B`,
        descrizione: `Offerta US-023 seconda ${seed}`,
      }
    );
    const notaNuova = `Test e2e — nuova riga ${seed}`;
    const notaSeconda = `Test e2e — seconda riga di investimento ${seed}`;

    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: secondaClienteConOfferta.offerta,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    const dataGiorno2 = dataOggiOffset(2);
    await page.goto(`/attivita/${dataGiorno2}`);
    await page.waitForURL(`**/attivita/${dataGiorno2}`);

    await expect(
      page.getByRole("link", { name: "Torna al calendario" })
    ).toBeVisible();

    const sezioneAttivita = page.getByText("Attività della giornata");
    await expect(sezioneAttivita).toBeVisible();

    await expect(page.getByText("Nuova riga attività")).toBeVisible();

    await expect(page.getByText("Righe registrate")).toBeVisible();
    await expect(page.getByText("Ore totali")).toBeVisible();
    await expect(page.getByText("Ore da fatturare ad Agile Reloaded")).toBeVisible();

    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");
    const inputOre = page.locator("#ore");
    const selectCategoria = page.getByRole("combobox", {
      name: "Categoria",
      exact: true,
    });
    const textareaNota = page.locator("#nota");
    const bottoneAggiungiRiga = page.getByRole("button", {
      name: "Aggiungi riga",
    });
    const bottoneSalvaModifiche = page.getByRole("button", {
      name: "Salva modifiche",
    });
    const bottoneAnnulla = page.getByRole("button", { name: "Annulla" });

    await selezionaClienteEOffertaTest(page, clienteConOfferta);

    // La categoria parte da Fatturabile; la didascalia spiega solo la voce scelta
    await expect(selectCategoria).toHaveValue("FATTURABILE");
    await expect(selectCategoria).toHaveAccessibleDescription(
      "La fatturi ad Agile Reloaded e Agile Reloaded la fattura al cliente."
    );
    await selectCategoria.selectOption({ label: "Non fatturabile" });
    await expect(selectCategoria).toHaveAccessibleDescription(
      "La fatturi ad Agile Reloaded, ma Agile Reloaded non la fattura al cliente."
    );
    await selectCategoria.selectOption({ label: "Fatturabile" });

    await inputOre.fill("3,5");
    await textareaNota.fill(notaNuova);

    await bottoneAggiungiRiga.click();

    const primaRigaCard = cardAttivitaPerNota(page, notaNuova);
    await expect(primaRigaCard).toBeVisible();
    await expect(primaRigaCard).toContainText(clienteConOfferta.offerta.codice);
    await expect(bottoneAggiungiRiga).toBeVisible();
    await expect(bottoneAggiungiRiga).toBeEnabled();
    await expect(selectCliente).toHaveValue("");
    await expect(selectOfferta).toBeDisabled();
    await expect(selectOfferta).toHaveValue("");
    await expect(inputOre).toHaveValue("");
    await expect(selectCategoria).toHaveValue("FATTURABILE");
    await expect(textareaNota).toHaveValue("");

    await selezionaClienteEOffertaTest(page, secondaClienteConOfferta);
    await inputOre.fill("6");
    await selectCategoria.selectOption({ label: "Investimento" });
    await expect(selectCategoria).toHaveAccessibleDescription(
      "Non la fatturi ad Agile Reloaded e Agile Reloaded non la fattura al cliente."
    );
    await textareaNota.fill(notaSeconda);

    await bottoneAggiungiRiga.click();

    const secondaRigaCard = cardAttivitaPerNota(page, notaSeconda);
    await expect(secondaRigaCard).toBeVisible();
    await expect(secondaRigaCard).toContainText(
      secondaClienteConOfferta.offerta.codice
    );
    await expect(secondaRigaCard).toContainText(
      secondaClienteConOfferta.offerta.descrizione
    );
    await expect(
      secondaRigaCard.getByText("Investimento", { exact: true })
    ).toBeVisible();
    await expect(
      primaRigaCard.getByText("Fatturabile", { exact: true })
    ).toBeVisible();
    await expect(bottoneAggiungiRiga).toBeVisible();
    await expect(bottoneAggiungiRiga).toBeEnabled();
    await expect(selectCliente).toHaveValue("");
    await expect(selectOfferta).toBeDisabled();
    await expect(selectOfferta).toHaveValue("");
    await expect(inputOre).toHaveValue("");
    await expect(selectCategoria).toHaveValue("FATTURABILE");
    await expect(textareaNota).toHaveValue("");

    // In modifica la categoria salvata è quella selezionata
    await secondaRigaCard.getByRole("button", { name: "Modifica" }).click();
    await expect(selectCategoria).toHaveValue("INVESTIMENTO");
    await bottoneAnnulla.click();
    await expect(selectCategoria).toHaveValue("FATTURABILE");

    await primaRigaCard.getByRole("button", { name: "Modifica" }).click();

    await expect(bottoneSalvaModifiche).toBeVisible();
    await expect(bottoneSalvaModifiche).toBeEnabled();
    await expect(bottoneAnnulla).toBeVisible();
    await expect(inputOre).toHaveValue("3,5");
    await expect(textareaNota).toHaveValue(notaNuova);

    await inputOre.fill("7,25");

    await bottoneSalvaModifiche.click();
    await expect(primaRigaCard).toContainText("7.3 h");

    page.once("dialog", (dialog) => dialog.accept());
    await secondaRigaCard.getByRole("button", { name: "Elimina" }).click();

    await expect(page.getByText(notaSeconda, { exact: true })).toHaveCount(0);
    await expect(primaRigaCard).toBeVisible();

    await expect(
      page.locator("text=/[1-9]\\d*(\\.\\d+)?\\s*h/").first()
    ).toBeVisible();
  });
  test("attende le offerte prima di consentire il salvataggio di una modifica", async ({
    page,
    factory,
    collaboratore,
    clienteConOfferta,
  }) => {
    const dataControllata = dataNelMeseRiservato("US-023-TASK-05", 14);
    const nota = `${factory.namespace} modifica con lettura offerte in corso`;
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });
    await factory.createRigaAttivita({
      collaboratore,
      offerta: clienteConOfferta.offerta,
      data: new Date(`${dataControllata}T00:00:00.000Z`),
      ore: "3.50",
      nota,
    });
    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${dataControllata}`);
    await expect(page.getByTestId("contenuto-giornata")).toHaveAttribute(
      "data-idratata",
      "true",
    );

    let consegnaOfferte!: () => void;
    let segnalaRispostaPronta!: () => void;
    const rispostaDaConsegnare = new Promise<void>((resolve) => { consegnaOfferte = resolve; });
    const rispostaPronta = new Promise<void>((resolve) => { segnalaRispostaPronta = resolve; });
    // Una barriera sulla risposta reale riproduce una lettura lenta anche su
    // produzione, senza hard wait e senza dipendere da HMR o carico della CPU.
    await page.route("**/api/attivita/offerte-cliente?**", async (route) => {
      const risposta = await route.fetch();
      segnalaRispostaPronta();
      await rispostaDaConsegnare;
      await route.fulfill({ response: risposta });
    });
    try {
      const riga = cardAttivitaPerNota(page, nota);
      await riga.getByRole("button", { name: "Modifica", exact: true }).click();
      await rispostaPronta;
      const salva = page.getByRole("button", { name: "Salva modifiche", exact: true });
      await expect(page.locator("#offerta")).toBeDisabled();
      await expect(salva).toBeDisabled();
      await page.locator("#ore").fill("7,25");

      consegnaOfferte();
      await expect(page.locator("#offerta")).toHaveValue(clienteConOfferta.offerta.id);
      await expect(salva).toBeEnabled();
      await expect(page.locator("#ore")).toHaveValue("7,25");
      await salva.click();
      await expect(riga).toContainText("7.3 h");
    } finally {
      consegnaOfferte();
      await page.unrouteAll({ behavior: "wait" });
    }
  });

  test("una lettura annullata non cambia l'offerta della modifica successiva", async ({
    page,
    factory,
    collaboratore,
    clienteConOfferta,
  }) => {
    const dataControllata = dataNelMeseRiservato("US-023-TASK-05", 16);
    const secondaClienteConOfferta = await factory.createClienteConOfferta();
    const notaPrima = `${factory.namespace} lettura annullata`;
    const notaSeconda = `${factory.namespace} modifica corrente`;
    for (const [dataset, nota] of [
      [clienteConOfferta, notaPrima],
      [secondaClienteConOfferta, notaSeconda],
    ] as const) {
      await factory.createAbilitazioneOfferta({ collaboratore, offerta: dataset.offerta });
      await factory.createRigaAttivita({
        collaboratore,
        offerta: dataset.offerta,
        data: new Date(`${dataControllata}T00:00:00.000Z`),
        ore: "3.50",
        nota,
      });
    }
    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${dataControllata}`);
    await expect(page.getByTestId("contenuto-giornata")).toHaveAttribute("data-idratata", "true");

    let consegnaOfferte!: () => void;
    let segnalaRispostaPronta!: () => void;
    const rispostaDaConsegnare = new Promise<void>((resolve) => { consegnaOfferte = resolve; });
    const rispostaPronta = new Promise<void>((resolve) => { segnalaRispostaPronta = resolve; });
    await page.route("**/api/attivita/offerte-cliente?**", async (route) => {
      if (new URL(route.request().url()).searchParams.get("cliente") !== clienteConOfferta.cliente.id) {
        return route.continue();
      }
      const risposta = await route.fetch();
      segnalaRispostaPronta();
      await rispostaDaConsegnare;
      await route.fulfill({ response: risposta });
    });
    try {
      const primaRiga = cardAttivitaPerNota(page, notaPrima);
      const secondaRiga = cardAttivitaPerNota(page, notaSeconda);
      await primaRiga.getByRole("button", { name: "Modifica", exact: true }).click();
      await rispostaPronta;
      await page.getByRole("button", { name: "Annulla", exact: true }).click();
      await secondaRiga.getByRole("button", { name: "Modifica", exact: true }).click();
      await expect(page.locator("#offerta")).toHaveValue(secondaClienteConOfferta.offerta.id);

      const rispostaConsegnata = page.waitForResponse((risposta) =>
        new URL(risposta.url()).searchParams.get("cliente") === clienteConOfferta.cliente.id,
      );
      consegnaOfferte();
      await (await rispostaConsegnata).finished();
      await page.locator("#ore").fill("7,25");
      await page.getByRole("button", { name: "Salva modifiche", exact: true }).click();
      await expect(secondaRiga).toContainText("7.3 h");
      await expect(secondaRiga).toContainText(secondaClienteConOfferta.offerta.codice);
      await expect(primaRiga).toContainText("3.5 h");
    } finally {
      consegnaOfferte();
      await page.unrouteAll({ behavior: "wait" });
    }
  });

});
