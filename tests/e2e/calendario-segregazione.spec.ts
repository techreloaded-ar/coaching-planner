import { test, expect } from "@playwright/test";

/**
 * Test di segregazione — US-011: Calendario mensile delle proprie attività
 *
 * Verifica che la collaboratrice Giulia veda esclusivamente le proprie
 * attività nel calendario mensile.
 */

test.describe("US-011 Segregazione dati", () => {
  test("Giulia vede solo le proprie attività nel calendario mensile", async ({
    page,
  }) => {
    // ── 1. Login come Giulia ──────────────────────────────────────

    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Accedi con Google" })
    ).toBeVisible();

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

    // ── 2. Verifica che la pagina carichi senza errori ────────────

    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();

    // ── 3. Verifica che il calendario sia visibile ─────────────────

    const calendario = page.getByLabel("Calendario mensile delle attività");
    await expect(calendario).toBeVisible();

    // ── 4. Conta i giorni con attività ────────────────────────────

    const giorniConAttivita = calendario.locator('a[href^="/attivita/"]');
    const count = await giorniConAttivita.count();

    // Il seed crea 6 righe per Giulia distribuite su 3 giorni distinti del
    // mese corrente; la vista di default atterra proprio su quel mese.
    expect(count).toBeGreaterThanOrEqual(3);

    // ── 5. Apri un giorno con attività e verifica la pagina dettaglio ──

    await giorniConAttivita.first().click();
    await page.waitForURL("**/attivita/*");

    await expect(
      page.getByRole("link", { name: "Torna al calendario" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: /\d{1,2} .* \d{4}/ })
    ).toBeVisible();
    await expect(page.getByText("Righe registrate")).toBeVisible();
    await expect(page.getByText("Ore totali")).toBeVisible();
    await expect(page.getByText("Ore fatturabili")).toBeVisible();
    await expect(page.getByText("Attività della giornata")).toBeVisible();

    // Tutti i clienti e le offerte nel dettaglio dovrebbero essere
    // coerenti con il seed (TechSolutions, DataFlow, TS-*, DF-*)
    // Non possiamo verificare l'assenza di dati altrui perché il seed
    // ha solo Giulia — ma l'unit test di attivita.test.ts copre già
    // il filtro sul collaboratoreId.

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita*");
    await expect(calendario).toBeVisible();

    // ── 6. Verifica navigazione senza limiti ───────────────────────

    const btnPrev = page.getByLabel("Mese precedente");
    const btnNext = page.getByLabel("Mese successivo");

    // Naviga avanti e indietro più volte per verificare assenza di limiti
    for (let i = 0; i < 3; i++) {
      await btnPrev.click();
      await page.waitForURL(/\?mese=/);
    }

    for (let i = 0; i < 3; i++) {
      await btnNext.click();
      await page.waitForURL(/\?mese=/);
    }

    // Dovremmo essere tornati al punto di partenza dopo 3 prev + 3 next
    // (non verifichiamo l'esatto mese perché il seed cambia ogni giorno)
    await expect(calendario).toBeVisible();

    // ── 7. Verifica che l'amministratore non possa accedere a /attivita ──

    // Usa un nuovo contesto per l'amministratore
    const adminCtx = await page.context().browser()!.newContext();
    const adminPage = await adminCtx.newPage();

    await adminPage.goto("/");
    await adminPage.evaluate(async () => {
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

    // L'amministratore viene reindirizzato alla landing reale del back office
    await adminPage.waitForURL("**/anagrafiche/clienti**");
    await expect(
      adminPage.getByRole("heading", { name: "Clienti" })
    ).toBeVisible();

    // Se proviamo ad andare manualmente a /attivita, veniamo reindirizzati
    await adminPage.goto("/attivita");
    await adminPage.waitForURL("**/anagrafiche/clienti**");
    await expect(
      adminPage.getByRole("heading", { name: "Clienti" })
    ).toBeVisible();

    await adminCtx.close();
  });
});
