import { test, expect, type Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";

/**
 * Demo scenario — US-016: Avanzamento offerte (previste, erogate, residuo).
 *
 * L'amministratore apre "Avanzamento offerte" dalla sidebar (click sulla
 * voce di navigazione, non navigazione diretta via URL) e verifica, per
 * ogni offerta del portafoglio, le giornate previste/erogate/residuo, il
 * dettaglio per collaboratore e il badge di stato, con valori coerenti con
 * i dati seed (prisma/seed.ts).
 *
 * Non registra video: la registrazione per la review è a cura della fase
 * successiva (archetipo-review).
 *
 * Valori attesi derivati dal seed (prisma/seed.ts):
 * - TS-2025-01 (TechSolutions Srl): 40 gg previste. Giulia Conti eroga 17h
 *   fatturabili (8+2,5+6,5) → 2,1 gg; Marco Bianchi eroga 16h fatturabili
 *   (8+8) → 2 gg. Totale erogato 33h → 4,1 gg, residuo 35,9 gg. Nessun
 *   altro scenario e2e tocca questa offerta (vedi
 *   demo__report-fatturazione-clienti.spec.ts), quindi i valori sono stabili.
 * - GE-2024-03 (GreenEnergy Srl, cliente inattivo): 10 gg previste, nessuna
 *   attività registrata → 0 gg erogate, 10 gg residuo. Il cliente inattivo
 *   non è selezionabile dagli altri scenari e2e, quindi i valori restano
 *   stabili.
 * - DF-2025-02 (DataFlow SpA): 25 gg previste (valore fisso); riceve però
 *   attività aggiuntive da altri scenari e2e (US-012) che restano registrate
 *   e non vengono ripulite fino al termine dell'intera suite. Per questo
 *   erogato/residuo sono verificati per coerenza interna (residuo = previste
 *   - erogate) invece che su cifre fisse, come già fatto per lo stesso
 *   cliente in demo__report-fatturazione-clienti.spec.ts.
 */

/** Converte un testo tipo "35,9gg" o "4,1 gg" in number (formato it-IT). */
function giornateANumero(testo: string): number {
  const corrispondenza = testo.match(/-?\d+(?:,\d+)?/);
  return corrispondenza ? Number(corrispondenza[0].replace(",", ".")) : NaN;
}

/**
 * Individua la scheda dell'offerta cercando il div che contiene sia il
 * codice offerta (nella testata) sia la sezione di dettaglio collaboratori
 * (nel piede della scheda): l'ultimo elemento che soddisfa entrambi i
 * filtri è il contenitore più interno, cioè la scheda stessa.
 */
function schedaOfferta(page: Page, codiceOfferta: string) {
  return page
    .locator("div")
    .filter({ hasText: codiceOfferta })
    .filter({ hasText: "Giornate erogate per collaboratore" })
    .last();
}

test.use({
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 200 },
});

test.describe("US-016 Demo", () => {
  test("l'amministratore apre l'avanzamento offerte dalla sidebar e vede previste/erogate/residuo coerenti coi dati seed", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // ── 1. Login amministratore tramite endpoint e2e ──────────────
    await accediAlBackOfficeComeAdmin(page);
    await expect(
      page.getByRole("banner").getByText("Tech Reloaded"),
    ).toBeVisible();

    // ── 2. Apre "Avanzamento offerte" dalla sidebar ────────────────
    await page
      .getByRole("link", { name: "Avanzamento offerte", exact: true })
      .click();

    await page.waitForURL("**/report/avanzamento-offerte");
    await expect(
      page.getByRole("heading", { name: "Avanzamento offerte" }),
    ).toBeVisible();

    // Riepilogo del portafoglio: la pill mostra il numero di offerte
    // monitorate. Non si assume un conteggio esatto: altri scenari e2e
    // (es. anagrafica-offerte.spec.ts) creano nuove offerte via UI nello
    // stesso database condiviso, quindi il totale può crescere oltre le 3
    // di seed nel corso dell'intera suite.
    await expect(page.getByText(/\d+ offert[ae]/)).toBeVisible();

    // ── 3. Offerta TS-2025-01 (TechSolutions Srl): valori fissi ────
    const schedaTs = schedaOfferta(page, "TS-2025-01");
    await expect(
      schedaTs.getByText("Consulenza architetturale cloud migration"),
    ).toBeVisible();
    await expect(schedaTs.getByText("TechSolutions Srl")).toBeVisible();

    await expect(schedaTs).toContainText("40gg"); // giornate previste
    await expect(schedaTs).toContainText("4,1gg"); // giornate erogate
    await expect(schedaTs).toContainText("35,9gg"); // residuo

    await expect(
      schedaTs.locator("span").filter({
        hasText: /^(In corso|In allerta|Esaurita|Oltre budget)$/,
      }),
    ).toBeVisible();

    // Dettaglio per collaboratore, ordinato per giornate erogate decrescenti:
    // Giulia Conti (17h → 2,1 gg) prima di Marco Bianchi (16h → 2 gg).
    const rigaGiulia = schedaTs
      .locator("tr")
      .filter({ hasText: "Giulia Conti" });
    await expect(rigaGiulia).toContainText("17 h");
    await expect(rigaGiulia).toContainText("2,1 gg");

    const rigaMarco = schedaTs
      .locator("tr")
      .filter({ hasText: "Marco Bianchi" });
    await expect(rigaMarco).toContainText("16 h");
    await expect(rigaMarco).toContainText("2 gg");

    // ── 4. Offerta GE-2024-03 (cliente inattivo): nessuna attività ─
    const schedaGe = schedaOfferta(page, "GE-2024-03");
    await expect(schedaGe.getByText("GreenEnergy Srl")).toBeVisible();
    await expect(schedaGe).toContainText("10gg"); // previste (e residuo)
    await expect(schedaGe).toContainText("0gg"); // erogate
    await expect(
      schedaGe.getByText("Nessuna attività registrata per questa offerta"),
    ).toBeVisible();

    // ── 5. Offerta DF-2025-02 (DataFlow SpA): coerenza interna ─────
    // Altri scenari e2e (US-012) aggiungono attività fatturabili su questa
    // offerta nel corso dell'intera suite: si verifica quindi solo che
    // previste sia il valore fisso di seed e che residuo = previste -
    // erogate, invece di cifre assolute su erogato/residuo.
    const schedaDf = schedaOfferta(page, "DF-2025-02");
    await expect(
      schedaDf.getByText("Sviluppo dashboard analytics"),
    ).toBeVisible();
    await expect(schedaDf.getByText("DataFlow SpA")).toBeVisible();

    await expect(
      schedaDf.locator("span").filter({
        hasText: /^(In corso|In allerta|Esaurita|Oltre budget)$/,
      }),
    ).toBeVisible();

    const testoPrevisteDf = await schedaDf
      .getByText("Previste", { exact: true })
      .locator("xpath=following-sibling::*[1]")
      .innerText();
    const testoErogateDf = await schedaDf
      .getByText("Erogate", { exact: true })
      .locator("xpath=following-sibling::*[1]")
      .innerText();
    const testoResiduoDf = await schedaDf
      .getByText("Residuo", { exact: true })
      .locator("xpath=following-sibling::*[1]")
      .innerText();

    const previsteDf = giornateANumero(testoPrevisteDf);
    const erogateDf = giornateANumero(testoErogateDf);
    const residuoDf = giornateANumero(testoResiduoDf);

    expect(previsteDf).toBe(25); // valore fisso di seed
    expect(erogateDf).toBeGreaterThanOrEqual(0.875 - 0.01); // baseline seed: 7h/8
    expect(residuoDf).toBeCloseTo(previsteDf - erogateDf, 1);

    // ── 6. Riepilogo cumulativo del portafoglio ────────────────────
    // Le giornate previste totali di seed sono 40+25+10=75, ma altri
    // scenari e2e (es. demo__anagrafica-offerte.spec.ts) creano nuove
    // offerte via UI nello stesso database condiviso: il totale può quindi
    // essere maggiore di 75. Erogate/residuo sono verificati per coerenza
    // interna per lo stesso motivo del punto 5.
    // Il testo "Giornate erogate" compare anche come intestazione di colonna
    // nelle tabelle di dettaglio delle schede offerta: per evitare ambiguità
    // si delimita la ricerca al pannello di riepilogo del portafoglio.
    const pannelloRiepilogo = page
      .locator("div")
      .filter({ hasText: "Riepilogo del portafoglio offerte" })
      .filter({ hasText: "Giornate previste" })
      .last();

    const testoPrevisteTotali = await pannelloRiepilogo
      .getByText("Giornate previste", { exact: true })
      .locator("xpath=following-sibling::*[1]")
      .innerText();
    const testoErogateTotali = await pannelloRiepilogo
      .getByText("Giornate erogate", { exact: true })
      .locator("xpath=following-sibling::*[1]")
      .innerText();
    const testoResiduoTotale = await pannelloRiepilogo
      .getByText("Residuo complessivo", { exact: true })
      .locator("xpath=following-sibling::*[1]")
      .innerText();

    const previsteTotali = giornateANumero(testoPrevisteTotali);
    const erogateTotali = giornateANumero(testoErogateTotali);
    const residuoTotale = giornateANumero(testoResiduoTotale);

    expect(previsteTotali).toBeGreaterThanOrEqual(75 - 0.01); // >= 40 + 25 + 10 di seed
    expect(erogateTotali).toBeGreaterThanOrEqual(5 - 0.01); // 4,125 + 0,875 + 0
    expect(residuoTotale).toBeCloseTo(previsteTotali - erogateTotali, 1);

    // ── 7. Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
