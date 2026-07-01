import { randomUUID } from "node:crypto";

import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  dataOggiOffset,
  loginComeGiulia,
} from "./demo__inserimento-righe-attivita.helpers";

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

async function attendiOfferteCaricate(selectOfferta: Locator) {
  await expect(selectOfferta).toBeEnabled();
  await expect
    .poll(async () => selectOfferta.locator("option").count())
    .toBeGreaterThan(1);
}

function cardAttivitaPerNota(page: Page, nota: string): Locator {
  return page
    .getByRole("heading", { name: "Attività della giornata" })
    .locator("xpath=following-sibling::div[1]/div")
    .filter({ has: page.getByText(nota, { exact: true }) });
}

test.describe("US-012 Demo — Inserimento righe attività", () => {
  test("flusso completo: aggiunta, modifica ed eliminazione righe", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const seed = randomUUID();
    const notaNuova = `Test e2e — nuova riga ${seed}`;
    const notaSeconda = `Test e2e — seconda riga non fatturabile ${seed}`;

    await loginComeGiulia(page);

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
    await expect(page.getByText("Ore fatturabili")).toBeVisible();

    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");
    const inputOre = page.locator("#ore");
    const checkboxFatturabile = page.locator("input[type='checkbox']");
    const textareaNota = page.locator("#nota");
    const bottoneAggiungiRiga = page.getByRole("button", {
      name: "Aggiungi riga",
    });
    const bottoneSalvaModifiche = page.getByRole("button", {
      name: "Salva modifiche",
    });
    const bottoneAnnulla = page.getByRole("button", { name: "Annulla" });

    await selectCliente.selectOption({ index: 1 });
    await attendiOfferteCaricate(selectOfferta);
    await selectOfferta.selectOption({ index: 1 });

    await inputOre.fill("3,5");
    await expect(checkboxFatturabile).toBeChecked();
    await textareaNota.fill(notaNuova);

    await bottoneAggiungiRiga.click();

    const primaRigaCard = cardAttivitaPerNota(page, notaNuova);
    await expect(primaRigaCard).toBeVisible();
    await expect(bottoneAggiungiRiga).toBeVisible();
    await expect(bottoneAggiungiRiga).toBeEnabled();
    await expect(selectCliente).toHaveValue("");
    await expect(selectOfferta).toBeDisabled();
    await expect(selectOfferta).toHaveValue("");
    await expect(inputOre).toHaveValue("");
    await expect(checkboxFatturabile).toBeChecked();
    await expect(textareaNota).toHaveValue("");

    const clientiDisponibili = await selectCliente.locator("option").count();
    const indiceSecondoCliente = clientiDisponibili > 2 ? 2 : 1;
    await selectCliente.selectOption({ index: indiceSecondoCliente });
    await attendiOfferteCaricate(selectOfferta);

    await selectOfferta.selectOption({ index: 1 });
    await inputOre.fill("6");
    await checkboxFatturabile.uncheck();
    await textareaNota.fill(notaSeconda);

    await bottoneAggiungiRiga.click();

    const secondaRigaCard = cardAttivitaPerNota(page, notaSeconda);
    await expect(secondaRigaCard).toBeVisible();
    await expect(bottoneAggiungiRiga).toBeVisible();
    await expect(bottoneAggiungiRiga).toBeEnabled();
    await expect(selectCliente).toHaveValue("");
    await expect(selectOfferta).toBeDisabled();
    await expect(selectOfferta).toHaveValue("");
    await expect(inputOre).toHaveValue("");
    await expect(checkboxFatturabile).toBeChecked();
    await expect(textareaNota).toHaveValue("");

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
});
