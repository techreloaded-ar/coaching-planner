import { test, expect, type Page } from "@playwright/test";

/**
 * Test e2e — US-016: Vista di avanzamento delle offerte (rotta
 * `/report/avanzamento-offerte`), con giornate previste/erogate/residuo e
 * dettaglio per collaboratore.
 *
 * Scenari (senza video):
 * - Vista avanzamento: l'amministratore apre la vista (anche dal link in
 *   sidebar) e vede almeno una scheda offerta con le etichette/valori di
 *   giornate previste, erogate e residuo e il dettaglio per collaboratore,
 *   coerenti con i dati seed.
 * - Evidenza di stato: badge di stato e barra di avanzamento sono presenti
 *   per le schede offerta (senza forzare uno stato specifico: il seed
 *   corrente non produce offerte oltre budget).
 * - Segregazione ruoli: un collaboratore che tenta di aprire la rotta viene
 *   reindirizzato fuori dall'area Back Office.
 *
 * Riferimento dati seed (prisma/seed.ts):
 * - Offerta TS-2025-01 (TechSolutions Srl, cliente1): 40 gg previste.
 *   Giulia Conti eroga 17h fatturabili (8+2,5+6,5) → 2,1 gg; Marco Bianchi
 *   eroga 16h fatturabili (8+8) → 2 gg. Totale erogato 33h → 4,1 gg,
 *   residuo 35,9 gg.
 * - Offerta DF-2025-02 (DataFlow SpA, cliente2): 25 gg previste (valore
 *   fisso di seed); riceve però attività aggiuntive da altri scenari e2e
 *   (US-012) che restano registrate e non vengono ripulite fino al termine
 *   dell'intera suite. Per questo erogato/residuo sono verificati per
 *   coerenza interna (residuo = previste - erogate) invece che su cifre
 *   fisse, come già fatto per lo stesso cliente in
 *   demo__report-fatturazione-clienti.spec.ts e demo__avanzamento-offerte.spec.ts.
 * - Offerta GE-2024-03 (cliente inattivo): 10 gg previste, nessuna
 *   attività registrata.
 * - Totali portafoglio: 75 gg previste (valore fisso, somma dei
 *   giorniPrevisti di seed); erogate/residuo totali dipendono dall'erogato
 *   mutabile di DF-2025-02 e sono quindi verificati per coerenza interna.
 */

/** Converte un testo tipo "35,9gg" o "4,1 gg" in number (formato it-IT). */
function giornateANumero(testo: string): number {
  const corrispondenza = testo.match(/-?\d+(?:,\d+)?/);
  return corrispondenza ? Number(corrispondenza[0].replace(",", ".")) : NaN;
}

async function accediComeAmministratore(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    const res = await fetch("/api/e2e-test/sessione", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "info@techreloaded.it" }),
    });
    const data = await res.json();
    if (data.redirect) {
      window.location.href = data.redirect;
    }
  });
  await page.waitForURL("**/anagrafiche**");
}

async function accediComeCollaboratrice(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    const res = await fetch("/api/e2e-test/sessione", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "giulia.conti@agilereloaded.it" }),
    });
    const data = await res.json();
    if (data.redirect) {
      window.location.href = data.redirect;
    }
  });
  await page.waitForURL("**/attivita**");
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

test.describe("Avanzamento offerte", () => {
  test("l'amministratore vede l'avanzamento delle offerte con previste, erogate, residuo e dettaglio per collaboratore", async ({
    page,
  }) => {
    await accediComeAmministratore(page);

    // Naviga dal link in sidebar (copre anche la voce di menu)
    await page.getByRole("link", { name: "Avanzamento offerte" }).click();
    await page.waitForURL("**/report/avanzamento-offerte");

    await expect(
      page.getByRole("heading", { name: "Avanzamento offerte" }),
    ).toBeVisible();

    // ── Offerta TS-2025-01 (TechSolutions Srl) ──
    const schedaTs = schedaOfferta(page, "TS-2025-01");
    await expect(
      schedaTs.getByText("Consulenza architetturale cloud migration"),
    ).toBeVisible();
    await expect(schedaTs.getByText("TechSolutions Srl")).toBeVisible();
    await expect(schedaTs.getByText("Previste", { exact: true })).toBeVisible();
    await expect(schedaTs.getByText("Erogate", { exact: true })).toBeVisible();
    await expect(schedaTs.getByText("Residuo", { exact: true })).toBeVisible();

    // Valori: 40 gg previste, 4,1 gg erogate, 35,9 gg residuo
    await expect(schedaTs).toContainText("40gg");
    await expect(schedaTs).toContainText("4,1gg");
    await expect(schedaTs).toContainText("35,9gg");

    // Dettaglio per collaboratore: Giulia Conti (17h → 2,1 gg, quota 52%)
    // e Marco Bianchi (16h → 2 gg, quota 48%)
    const rigaGiulia = schedaTs.locator("tr").filter({ hasText: "Giulia Conti" });
    await expect(rigaGiulia).toContainText("17 h");
    await expect(rigaGiulia).toContainText("2,1 gg");
    await expect(rigaGiulia).toContainText("52%");

    const rigaMarco = schedaTs.locator("tr").filter({ hasText: "Marco Bianchi" });
    await expect(rigaMarco).toContainText("16 h");
    await expect(rigaMarco).toContainText("2 gg");
    await expect(rigaMarco).toContainText("48%");

    // ── Offerta DF-2025-02 (DataFlow SpA) ──
    // Altri scenari e2e (US-012) aggiungono attività fatturabili su questa
    // offerta nel corso dell'intera suite: si verifica quindi solo che
    // previste sia il valore fisso di seed e che residuo = previste -
    // erogate, invece di cifre assolute su erogato/residuo (vedi commento
    // di modulo).
    const schedaDf = schedaOfferta(page, "DF-2025-02");
    await expect(
      schedaDf.getByText("Sviluppo dashboard analytics"),
    ).toBeVisible();
    await expect(schedaDf.getByText("DataFlow SpA")).toBeVisible();
    await expect(schedaDf).toContainText("25gg");

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

    const rigaGiuliaDf = schedaDf.locator("tr").filter({ hasText: "Giulia Conti" });
    await expect(rigaGiuliaDf).toContainText("gg"); // presenza del dettaglio, senza cifra fissa

    // ── Riepilogo cumulativo del portafoglio ──
    // Le giornate previste totali di seed sono 40+25+10=75, ma altri
    // scenari e2e (es. anagrafica-offerte.spec.ts) creano nuove offerte via
    // UI nello stesso database condiviso: il totale può quindi essere
    // maggiore di 75. Erogate/residuo totali dipendono inoltre dall'erogato
    // mutabile di DF-2025-02. Si verifica perciò solo il minimo garantito
    // dal seed e la coerenza interna, delimitando la ricerca al pannello di
    // riepilogo per evitare ambiguità con le intestazioni di colonna nelle
    // tabelle di dettaglio.
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
  });

  test("le schede offerta mostrano l'evidenza di stato (badge) e la barra di avanzamento", async ({
    page,
  }) => {
    await accediComeAmministratore(page);
    await page.goto("/report/avanzamento-offerte");

    // Badge di stato: non forziamo uno stato specifico (il seed corrente
    // produce offerte "In corso"), verifichiamo solo che l'etichetta di
    // stato sia presente e riconoscibile per la scheda.
    const schedaTs = schedaOfferta(page, "TS-2025-01");
    const badgeStato = schedaTs.locator("span").filter({
      hasText: /^(In corso|In allerta|Esaurita|Oltre budget)$/,
    });
    await expect(badgeStato).toBeVisible();

    // Barra di avanzamento: etichetta e contenitore visibili
    await expect(
      schedaTs.getByText("Avanzamento erogato sul previsto"),
    ).toBeVisible();
    await expect(
      schedaTs.locator("div.relative.h-3.overflow-hidden.rounded-full"),
    ).toBeVisible();

    // Stessa evidenza anche per una seconda offerta
    const schedaDf = schedaOfferta(page, "DF-2025-02");
    const badgeStatoDf = schedaDf.locator("span").filter({
      hasText: /^(In corso|In allerta|Esaurita|Oltre budget)$/,
    });
    await expect(badgeStatoDf).toBeVisible();
    await expect(
      schedaDf.locator("div.relative.h-3.overflow-hidden.rounded-full"),
    ).toBeVisible();
  });

  test("un collaboratore che tenta di aprire la vista viene reindirizzato fuori dal back office", async ({
    page,
  }) => {
    await accediComeCollaboratrice(page);

    // Prova ad aprire la vista di avanzamento offerte del back office
    await page.goto("/report/avanzamento-offerte");

    // Dovrebbe essere reindirizzato al front office
    await page.waitForURL("**/attivita**");
    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true }),
    ).toBeVisible();
  });
});
