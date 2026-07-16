import { test, expect, type Locator, type Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";

/**
 * Demo scenario — US-025: Pagina offerte trasversale con stato e avanzamento.
 *
 * L'amministratore apre "Offerte" dalla sidebar (click sulla voce di
 * navigazione, non navigazione diretta via URL) e verifica l'elenco
 * trasversale di tutte le offerte di tutti i clienti, con cliente, codice,
 * giornate previste/erogate/residuo e stato, con valori coerenti con i dati
 * seed (prisma/seed.ts).
 *
 * Non registra video: la registrazione per la review è a cura della fase
 * successiva (archetipo-review via `archetipo e2e demo`), qui il test gira
 * headless.
 *
 * Valori attesi derivati dal seed (prisma/seed.ts):
 * - TS-2025-01 (TechSolutions Srl): 40 gg previste. Giulia Conti eroga 17h
 *   fatturabili (8+2,5+6,5) → 2,125 gg; Marco Bianchi eroga 16h fatturabili
 *   (8+8) → 2 gg. Totale erogato 33h → 4,1 gg (display), residuo 35,9 gg.
 *   Nessun altro scenario e2e tocca questa offerta (TechSolutions è un seed
 *   condiviso stabile: gli altri spec creano clienti/offerte via factory e
 *   non selezionano questa offerta), quindi i valori sono a cifra fissa.
 * - GE-2024-03 (GreenEnergy Srl, cliente e offerta inattivi): 10 gg previste,
 *   nessuna attività registrata → 0 gg erogate, 10 gg residuo, stato non
 *   attiva. Il cliente inattivo non è selezionabile dai form attività degli
 *   altri scenari e2e, quindi i valori restano a cifra fissa.
 * - DF-2025-02 (DataFlow SpA): 25 gg previste (valore fisso di seed); riceve
 *   però attività aggiuntive da altri scenari e2e (US-012) che restano
 *   registrate e non vengono ripulite fino al termine dell'intera suite. Per
 *   questo erogato/residuo sono verificati per COERENZA INTERNA
 *   (residuo = giorni previsti − erogate, letti entrambi dalla stessa riga
 *   della tabella) invece che su cifre fisse, come già fatto per lo stesso
 *   cliente in demo__report-fatturazione-clienti.spec.ts.
 */

/** Converte un testo tipo "35,9gg" o "0gg" in number (formato it-IT). */
function giornateANumero(testo: string): number {
  const corrispondenza = testo.match(/-?\d+(?:,\d+)?/);
  return corrispondenza ? Number(corrispondenza[0].replace(",", ".")) : NaN;
}

/**
 * Individua la riga della tabella "Elenco offerte" relativa a un'offerta,
 * filtrando per il suo codice (univoco, mostrato nel badge della prima cella).
 */
function rigaOfferta(page: Page, codiceOfferta: string): Locator {
  return page
    .getByRole("table", { name: "Elenco offerte" })
    .getByRole("row")
    .filter({ hasText: codiceOfferta });
}

/**
 * Legge le giornate previste/erogate/residuo dalle rispettive celle della
 * riga (indici di colonna: 3 = giorni previsti, 4 = erogate, 5 = residuo).
 */
async function giornateDellaRiga(riga: Locator): Promise<{
  previste: number;
  erogate: number;
  residuo: number;
}> {
  const celle = riga.getByRole("cell");
  const previste = giornateANumero(await celle.nth(3).innerText());
  const erogate = giornateANumero(await celle.nth(4).innerText());
  const residuo = giornateANumero(await celle.nth(5).innerText());
  return { previste, erogate, residuo };
}

test.use({
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 200 },
});

test.describe("US-025 Demo", () => {
  test("l'amministratore apre le offerte dalla sidebar e vede l'elenco trasversale coerente coi dati seed", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // ── 1. Login amministratore e apertura "Offerte" dalla sidebar ─
    await accediAlBackOfficeComeAdmin(page);
    await expect(
      page.getByRole("banner").getByText("Tech Reloaded"),
    ).toBeVisible();

    await page
      .getByRole("link", { name: "Offerte", exact: true })
      .click();

    await page.waitForURL("**/offerte");
    await expect(page.getByRole("heading", { name: "Offerte" })).toBeVisible();

    // ── 2. Presenza delle offerte seed nell'elenco (cliente/codice) ─
    const rigaTs = rigaOfferta(page, "TS-2025-01");
    await expect(rigaTs).toContainText("TechSolutions Srl");
    await expect(rigaTs).toContainText(
      "Consulenza architetturale cloud migration",
    );

    const rigaDf = rigaOfferta(page, "DF-2025-02");
    await expect(rigaDf).toContainText("DataFlow SpA");
    await expect(rigaDf).toContainText("Sviluppo dashboard analytics");

    const rigaGe = rigaOfferta(page, "GE-2024-03");
    await expect(rigaGe).toContainText("GreenEnergy Srl");
    await expect(rigaGe).toContainText("Audit energetico — concluso");

    // ── 3. TS-2025-01 (TechSolutions): valori a cifra fissa ────────
    // Offerta seed stabile, non toccata da altri scenari e2e.
    const giornateTs = await giornateDellaRiga(rigaTs);
    expect(giornateTs.previste).toBe(40);
    expect(giornateTs.erogate).toBeCloseTo(4.1, 1); // 33h → 4,125 gg, display 4,1
    expect(giornateTs.residuo).toBeCloseTo(35.9, 1); // 40 − 4,125 → 35,875, display 35,9
    await expect(rigaTs.getByRole("cell").nth(6)).toContainText("Attiva");

    // ── 4. GE-2024-03 (GreenEnergy, inattiva): valori a cifra fissa ─
    // Cliente/offerta inattivi, nessuna attività, non selezionabili altrove.
    const giornateGe = await giornateDellaRiga(rigaGe);
    expect(giornateGe.previste).toBe(10);
    expect(giornateGe.erogate).toBe(0);
    expect(giornateGe.residuo).toBe(10);
    await expect(rigaGe.getByRole("cell").nth(6)).toContainText("Non attiva");

    // ── 5. DF-2025-02 (DataFlow): coerenza interna ─────────────────
    // Altri scenari e2e (US-012) aggiungono attività fatturabili su questa
    // offerta nel corso dell'intera suite: si verifica quindi solo che le
    // giornate previste siano il valore fisso di seed e che
    // residuo = previste − erogate, invece di cifre assolute su erogato.
    const giornateDf = await giornateDellaRiga(rigaDf);
    expect(giornateDf.previste).toBe(25); // valore fisso di seed
    expect(giornateDf.erogate).toBeGreaterThanOrEqual(0.875 - 0.01); // baseline seed: 7h/8
    expect(giornateDf.residuo).toBeCloseTo(
      giornateDf.previste - giornateDf.erogate,
      1,
    );
    await expect(rigaDf.getByRole("cell").nth(6)).toContainText("Attiva");

    // ── 6. Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
