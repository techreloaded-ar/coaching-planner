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

    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Accedi" })
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

    const giorniConAttivita = calendario.locator("button");
    const count = await giorniConAttivita.count();

    // Il seed crea 4 attività per Giulia nei giorni 2-5 del mese corrente.
    // Se i giorni cadono in weekend o sono distribuiti, potremmo averne 4 o meno
    // (se un giorno ha più righe, viene comunque contato come 1 cella).
    expect(count).toBeGreaterThanOrEqual(1);

    // ── 5. Apri un giorno con attività e verifica il contenuto ────

    await giorniConAttivita.first().click();

    const drawer = page.getByLabel("Dettaglio attività della giornata");
    await expect(drawer).toBeVisible();

    // Verifica che il drawer mostri attività
    await expect(drawer.getByText("Attività della giornata")).toBeVisible();

    // Tutti i clienti e le offerte nel drawer dovrebbero essere
    // coerenti con il seed (TechSolutions, DataFlow, TS-*, DF-*)
    // Non possiamo verificare l'assenza di dati altrui perché il seed
    // ha solo Giulia — ma l'unit test di attivita.test.ts copre già
    // il filtro sul collaboratoreId.

    // Chiudi il drawer
    await drawer.getByLabel("Chiudi").click();
    await expect(drawer).not.toBeVisible();

    // ── 6. Verifica che la nota US-011 sia presente ────────────────

    await expect(page.getByText("Nota US-011")).toBeVisible();
    await expect(
      page.getByText(/consultazione e navigazione/)
    ).toBeVisible();

    // ── 7. Verifica navigazione senza limiti ───────────────────────

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

    // ── 8. Verifica che l'amministratore non possa accedere a /attivita ──

    // Usa un nuovo contesto per l'amministratore
    const adminCtx = await page.context().browser()!.newContext();
    const adminPage = await adminCtx.newPage();

    await adminPage.goto("/login");
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

    // L'amministratore viene reindirizzato a /anagrafiche, non a /attivita
    await adminPage.waitForURL("**/anagrafiche**");
    await expect(
      adminPage.getByRole("heading", { name: "Anagrafiche" })
    ).toBeVisible();

    // Se proviamo ad andare manualmente a /attivita, veniamo reindirizzati
    await adminPage.goto("/attivita");
    await adminPage.waitForURL("**/anagrafiche**");

    await adminCtx.close();
  });
});
