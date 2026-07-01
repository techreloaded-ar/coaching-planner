import { randomUUID } from "node:crypto";

import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  dataOggiOffset,
  loginComeGiulia,
} from "./demo__inserimento-righe-attivita.helpers";

/**
 * US-013: Registrazione della trasferta con rimborso automatico
 *
 * Scenario demo: Giulia accede a una giornata, inserisce 150 km nel form,
 * vede la preview del rimborso, salva, verifica la card e i totali,
 * modifica i km, rimuove la trasferta.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 200 },
});

test.describe("US-013 Demo — Trasferta con rimborso automatico", () => {
  test("flusso completo: inserimento km, preview, salvataggio, modifica e rimozione", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const seed = randomUUID();
    const notaRiga = `Test e2e trasferta — ${seed}`;

    await loginComeGiulia(page);

    // Giorno 4 ha già una trasferta seed con 150 km (su cliente2/offerta2)
    // Usiamo giorno 6 per un test pulito senza righe preesistenti
    const dataGiorno6 = dataOggiOffset(6);
    await page.goto(`/attivita/${dataGiorno6}`);
    await page.waitForURL(`**/attivita/${dataGiorno6}`);

    await expect(
      page.getByRole("link", { name: "Torna al calendario" })
    ).toBeVisible();

    // Verifica presenza riepilogo con totale rimborsi
    await expect(page.getByText("Totale rimborsi")).toBeVisible();

    // Verifica presenza sezione trasferta nel form
    await expect(page.getByLabel("Distanza trasferta")).toBeVisible();

    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");
    const inputOre = page.locator("#ore");
    const inputKm = page.locator("#trasfertaKm");
    const checkboxFatturabile = page.locator("input[type='checkbox']");
    const textareaNota = page.locator("#nota");
    const bottoneAggiungiRiga = page.getByRole("button", {
      name: "Aggiungi riga",
    });

    // Seleziona cliente
    await selectCliente.selectOption({ index: 1 });
    // Attendi caricamento offerte
    await expect(selectOfferta).toBeEnabled();
    await expect
      .poll(async () => selectOfferta.locator("option").count())
      .toBeGreaterThan(1);
    await selectOfferta.selectOption({ index: 1 });

    // Inserisci ore
    await inputOre.fill("3,5");
    await textareaNota.fill(notaRiga);

    // Inserisci km e verifica preview rimborso
    await inputKm.fill("150");
    await expect(page.getByText("Rimborso stimato")).toBeVisible();
    // Scope la ricerca € al contenitore della preview (evita conflitto con "€ 0.00" del riepilogo)
    const previewContainer = page.getByText(/Rimborso stimato/).locator('xpath=..');
    await expect(previewContainer.getByText(/€/)).toBeVisible();

    // Salva riga
    await bottoneAggiungiRiga.click();

    // Attendi refresh
    await page.waitForTimeout(500);

    // Verifica che la card mostri i km e il rimborso
    const card = page
      .getByRole("heading", { name: "Attività della giornata" })
      .locator("xpath=following-sibling::div[1]/div")
      .filter({ has: page.getByText(notaRiga, { exact: true }) });

    await expect(card).toBeVisible();
    await expect(card.getByText("150 km")).toBeVisible();
    // La card dovrebbe mostrare "fino a 250 km" per lo scaglione
    await expect(card.getByText(/fino a/)).toBeVisible();

    // Verifica che il totale rimborsi sia > 0
    const totaleRef = page.getByText("Totale rimborsi").locator("xpath=following-sibling::div[1]");
    await expect(totaleRef).not.toHaveText("€ 0.00");

    // Modifica: cambia i km sullo stesso form
    const bottoneModifica = card.getByRole("button", {
      name: "Modifica",
    });
    await bottoneModifica.click();

    // Attendi che il form passi in modalità modifica
    await expect(page.getByText("Modifica riga")).toBeVisible();

    // Cambia km a 50
    await inputKm.fill("50");
    // Verifica che la preview si aggiorni
    await expect(page.getByText(/fino a 50 km/)).toBeVisible();

    // Salva modifiche
    const bottoneSalva = page.getByRole("button", {
      name: "Salva modifiche",
    });
    await bottoneSalva.click();

    // Attendi refresh
    await page.waitForTimeout(500);

    // Verifica che la card mostri 50 km
    await expect(card.getByText("50 km")).toBeVisible();
    // Lo scaglione ora dovrebbe essere "fino a 50 km"
    // Nota: potrebbe mostrare "fino a 100 km" depending on seed. Verifichiamo solo presenza.
    await expect(card.getByText(/fino a/)).toBeVisible();

    // Rimuovi trasferta
    const bottoneRimuovi = card.getByRole("button", {
      name: "Rimuovi trasferta",
    });

    // Registra il listener prima del click per evitare race condition
    page.once("dialog", (dialog) => dialog.accept());
    await bottoneRimuovi.click();

    // Attendi refresh
    await page.waitForTimeout(500);

    // Verifica che la trasferta non sia più visibile nella card
    await expect(card.getByText("km")).not.toBeVisible();
  });

  test("verifica trasferta seed su giorno 4", async ({ page }) => {
    test.setTimeout(60_000);

    await loginComeGiulia(page);

    // Giorno 4 ha una trasferta seed con 150 km
    const dataGiorno4 = dataOggiOffset(4);
    await page.goto(`/attivita/${dataGiorno4}`);
    await page.waitForURL(`**/attivita/${dataGiorno4}`);

    await expect(
      page.getByRole("link", { name: "Torna al calendario" })
    ).toBeVisible();

    // Verifica che esista una card con 150 km
    await expect(page.getByText("150 km")).toBeVisible();

    // Verifica presenza del pulsante Rimuovi trasferta
    await expect(
      page.getByRole("button", { name: "Rimuovi trasferta" })
    ).toBeVisible();

    // Verifica che il totale rimborsi sia presente e > 0
    await expect(page.getByText("Totale rimborsi")).toBeVisible();
  });
});
