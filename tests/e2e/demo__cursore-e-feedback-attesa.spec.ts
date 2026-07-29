import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin, accediComeCollaboratore } from "./support/auth";
import { dataNelMeseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";
import {
  intervalloNuoviScaglioniKm,
  sogliaStabileInIntervallo,
} from "./support/reserved-resources";

/**
 * Demo scenario — US-051: Cursore e feedback di attesa uniformi su pulsanti e azioni
 *
 * Il revisore osserva: il cursore a manina sui controlli abilitati in back e
 * front office; l'attesa visibile (pulsante disabilitato, `aria-busy`) durante
 * il salvataggio di un form; lo stesso comportamento su un'azione distruttiva
 * con il dialog che resta aperto fino all'esito; infine un errore di
 * validazione che chiude l'attesa e lascia il messaggio visibile.
 *
 * Registra un video per la review. La "rete lenta" non è mai un hard wait: la
 * POST della server action è trattenuta da una route registrata sulla pagina
 * di destinazione e sbloccata esplicitamente dal test.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

// Intervallo km riservato a questa demo: ScaglioneKm è globale con soglia unica.
const INTERVALLO_KM_DEMO = intervalloNuoviScaglioniKm(
  1_052_000,
  1_052_999,
  "tests/e2e/demo__cursore-e-feedback-attesa.spec.ts — US-051 demo attesa su eliminazione",
);

type TrattenutaPost = {
  rilascia: () => void;
  smetti: () => Promise<void>;
};

/**
 * Trattiene la POST della server action diretta a `percorso` finché il test
 * non chiama `rilascia()`, simulando la rete lenta osservata dal revisore.
 */
async function trattieniPostDellaPagina(
  page: Page,
  percorso: string,
): Promise<TrattenutaPost> {
  let rilascia!: () => void;
  const trattenuta = new Promise<void>((risolvi) => {
    rilascia = risolvi;
  });

  const rotta = (url: URL) => url.pathname === percorso;

  await page.route(rotta, async (route) => {
    if (route.request().method() === "POST") {
      await trattenuta;
    }

    await route.continue();
  });

  return {
    rilascia,
    smetti: async () => {
      rilascia();
      await page.unroute(rotta);
    },
  };
}

/** Attende che React abbia idratato il nodo, prima di interagire con esso. */
async function attendiIdratazione(locator: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        locator.evaluate((elemento) =>
          Object.keys(elemento).some((chiave) => chiave.startsWith("__reactFiber$")),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
}

/** Cursore effettivamente calcolato dal browser sull'elemento. */
function cursoreCalcolato(locator: Locator): Promise<string> {
  return locator.evaluate((elemento) => getComputedStyle(elemento).cursor);
}

/** Chiude la sessione corrente, condizione necessaria prima di accedere con un altro utente. */
async function disconnetti(page: Page): Promise<void> {
  await page.getByRole("banner").getByRole("button", { name: "Esci" }).click();
  await page.waitForURL(
    (url) => url.pathname === "/" && url.searchParams.get("logout") === "1",
  );
}

test.describe("US-051 Demo", () => {
  test("cursore a manina ovunque e attesa visibile su submit, eliminazione ed errore", async ({
    page,
    factory,
    collaboratore,
    clienteConOfferta,
  }, testInfo) => {
    test.setTimeout(90_000);

    // ── 0. Dati di scena ────────────────────────────────────────────
    const cliente = await factory.createCliente({
      ragioneSociale: `E2E US-051 Demo attesa ${randomUUID().slice(0, 8)}`,
      citta: "Torino",
    });
    const km = sogliaStabileInIntervallo(INTERVALLO_KM_DEMO, testInfo.workerIndex);
    await factory.createScaglioneKm({ finoAKm: km, importo: "38.00" });
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    // ── 1. Back office: il submit abilitato mostra la manina ────────
    await accediAlBackOfficeComeAdmin(page);

    const percorsoModifica = `/anagrafiche/clienti/${cliente.id}/modifica`;
    await page.goto(percorsoModifica);
    await expect(
      page.getByRole("heading", { name: "Modifica cliente" }),
    ).toBeVisible();

    const pulsanteSalva = page.getByRole("button", {
      name: /^(?:Salva modifiche|Salvataggio…)$/,
    });
    await attendiIdratazione(pulsanteSalva);
    await expect.poll(() => cursoreCalcolato(pulsanteSalva)).toBe("pointer");

    // ── 2. Rete rallentata: il salvataggio mostra attesa fino all'esito ──
    const gateSalvataggio = await trattieniPostDellaPagina(page, percorsoModifica);
    const nuovaCitta = `Milano-${randomUUID().slice(0, 6)}`;
    await page.getByLabel(/Città/).fill(nuovaCitta);
    await pulsanteSalva.click();

    await expect(pulsanteSalva).toBeDisabled();
    await expect(pulsanteSalva).toHaveAttribute("aria-busy", "true");
    await expect(page.getByText("Salvataggio…")).toBeVisible();

    gateSalvataggio.rilascia();
    await page.waitForURL("**/anagrafiche/clienti?esito=salvato");
    await expect(
      page
        .locator("table[aria-label='Elenco clienti'] tbody tr")
        .filter({ hasText: cliente.ragioneSociale })
        .first()
        .getByText(nuovaCitta),
    ).toBeVisible();
    await gateSalvataggio.smetti();

    // ── 3. Azione distruttiva: il dialog resta aperto fino all'esito ──
    await page.goto("/anagrafiche/scaglioni");
    const tabellaScaglioni = page.locator(
      "table[aria-label='Elenco scaglioni chilometrici']",
    );
    const rigaScaglione = tabellaScaglioni
      .locator("tbody tr")
      .filter({ hasText: `fino a ${km} km` })
      .first();
    await expect(rigaScaglione).toBeVisible();

    const pulsanteEliminaRiga = rigaScaglione.getByRole("button", { name: "Elimina" });
    await attendiIdratazione(pulsanteEliminaRiga);
    await expect.poll(() => cursoreCalcolato(pulsanteEliminaRiga)).toBe("pointer");

    await pulsanteEliminaRiga.click();
    const dialogEliminazione = page.getByRole("dialog", {
      name: new RegExp(`Eliminare lo scaglione «fino a ${km} km»\\?`),
    });
    await expect(dialogEliminazione).toBeVisible();

    const gateEliminazione = await trattieniPostDellaPagina(page, "/anagrafiche/scaglioni");
    const confermaEliminazione = dialogEliminazione.getByRole("button", {
      name: /^(?:Elimina scaglione|Eliminazione…)$/,
    });
    await confermaEliminazione.click();

    await expect(confermaEliminazione).toBeDisabled();
    await expect(confermaEliminazione).toHaveAttribute("aria-busy", "true");
    await expect(dialogEliminazione).toBeVisible();

    gateEliminazione.rilascia();
    await page.waitForURL("**/anagrafiche/scaglioni?esito=eliminato");
    await expect(dialogEliminazione).toHaveCount(0);
    await gateEliminazione.smetti();

    // ── 4. Front office: la manina compare anche lì ─────────────────
    await disconnetti(page);
    await accediComeCollaboratore(page, collaboratore.utente.email);
    const dataAttivita = dataNelMeseRiservato("US-051-DEMO-cursore-e-feedback-attesa", 12);
    await page.goto(`/attivita/${dataAttivita}`);

    const pulsanteAggiungiRiga = page.getByRole("button", {
      name: "Aggiungi riga",
      exact: true,
    });
    await expect(pulsanteAggiungiRiga).toBeEnabled();
    await expect.poll(() => cursoreCalcolato(pulsanteAggiungiRiga)).toBe("pointer");

    // ── 5. Errore di validazione: l'attesa termina e il messaggio resta ──
    await disconnetti(page);
    await accediAlBackOfficeComeAdmin(page);
    await page.goto("/anagrafiche/clienti/nuovo");
    await expect(page.getByRole("heading", { name: "Nuovo cliente" })).toBeVisible();

    const pulsanteCrea = page.getByRole("button", {
      name: /^(?:Crea cliente|Creazione…)$/,
    });
    await attendiIdratazione(pulsanteCrea);

    const ragioneSociale = `E2E US-051 Demo errore ${randomUUID().slice(0, 8)}`;
    await page.getByLabel(/Ragione sociale/).fill(ragioneSociale);
    await page.getByLabel(/Partita IVA/).fill("12345");
    await page.getByLabel(/Città/).fill("Roma");
    await pulsanteCrea.click();

    await expect(page.getByText("La partita IVA deve essere di 11 cifre")).toBeVisible();
    await expect(pulsanteCrea).toBeEnabled();
    await expect(pulsanteCrea).toHaveAttribute("aria-busy", "false");
    await expect.poll(() => cursoreCalcolato(pulsanteCrea)).toBe("pointer");
    await expect(page.getByLabel(/Ragione sociale/)).toHaveValue(ragioneSociale);

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
