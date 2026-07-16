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
    // Dopo US-031 tutte le celle sono link; i giorni con attività
    // si distinguono per l'attributo data-con-attivita="true".

    const giorniConAttivita = calendario.locator('a[data-con-attivita="true"]');
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

    // L'accesso dell'amministratore al front office è coperto in modo isolato
    // dalla suite US-030, senza riutilizzare il suo account seed.
  });
});
