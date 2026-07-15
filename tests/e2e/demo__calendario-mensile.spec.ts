import { test, expect } from "@playwright/test";

/**
 * Demo scenario — US-011: Calendario mensile delle proprie attività
 *
 * Dimostra il flusso completo: Giulia (collaboratrice) accede al front office,
 * vede il mese corrente con i giorni e le attività registrate, naviga tra i
 * mesi e torna al mese corrente tramite il pulsante "Mese corrente".
 *
 * Registra un video per la review.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-011 Demo", () => {
  test("navigazione calendario mensile e riconoscimento attività", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // ── 1. Login come Giulia tramite endpoint e2e ──────────────────

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

    // ── 2. Verifica atterraggio nel front office ───────────────────

    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();
    await expect(page.getByText("Giulia Conti")).toBeVisible();

    // ── 3. Verifica che la barra di navigazione mostri il mese corrente ──

    // La label del mese (es. "Giugno 2026") deve essere visibile e non vuota.
    const meseLabel = page.getByTestId("calendar-month-label");
    await expect(meseLabel).toBeVisible();
    const meseTesto = await meseLabel.textContent();
    expect(meseTesto).toBeTruthy();

    // ── 4. Verifica che i pulsanti di navigazione siano presenti ───

    const btnPrev = page.getByLabel("Mese precedente");
    const btnNext = page.getByLabel("Mese successivo");
    await expect(btnPrev).toBeVisible();
    await expect(btnNext).toBeVisible();

    // Pulsante "Mese corrente"
    const btnOggi = page.getByRole("link", { name: "Mese corrente" });
    await expect(btnOggi).toBeVisible();

    // ── 5. Verifica che la griglia del calendario sia visibile ─────

    const calendario = page.getByLabel("Calendario mensile delle attività");
    await expect(calendario).toBeVisible();

    // Verifica i giorni della settimana
    await expect(calendario.getByText("lun")).toBeVisible();
    await expect(calendario.getByText("dom")).toBeVisible();

    // ── 6. Verifica che ci siano giorni con attività (seed) ────────

    // Nel calendario i giorni con attività sono renderizzati come link verso
    // il dettaglio giornata; il seed corrente copre 3 giorni distinti del mese.
    const giorniConAttivita = calendario.locator('a[href^="/attivita/"]');

    const count = await giorniConAttivita.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // ── 7. Verifica sintesi visibile in una cella con attività ─────

    const primaCella = giorniConAttivita.first();
    // Deve mostrare il numero di righe e le ore
    await expect(primaCella.locator("text=/\\d+(\\.\\d+)?\\s*h/")).toBeVisible();

    // ── 8. Clicca su un giorno con attività → pagina dettaglio ─────

    await primaCella.click();
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

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita*");
    await expect(calendario).toBeVisible();

    // ── 9. Naviga al mese precedente ───────────────────────────────

    await btnPrev.click();
    await page.waitForURL(/\?mese=/);

    // La label del mese dovrebbe essere cambiata
    const nuovoMeseLabel = await meseLabel.textContent();
    expect(nuovoMeseLabel).not.toBe(meseTesto);

    // ── 10. Naviga al mese successivo (torna al corrente) ─────────

    await btnNext.click();
    await page.waitForURL(/\?mese=/);

    // Dovremmo essere tornati al mese di partenza
    const meseRitorno = await meseLabel.textContent();
    expect(meseRitorno).toBe(meseTesto);

    // ── 11. Clicca "Mese corrente" ─────────────────────────────────

    // Prima vai a un mese diverso
    await btnPrev.click();
    await page.waitForURL(/\?mese=/);
    await expect(meseLabel).not.toHaveText(meseTesto!);

    // Poi torna con "Mese corrente"
    await btnOggi.click();
    await page.waitForURL("**/attivita"); // senza query string
    await expect(meseLabel).toHaveText(meseTesto!);

    // ── 12. Verifica la legenda ────────────────────────────────────

    await expect(
      page.getByText("Giorno con attività registrate")
    ).toBeVisible();
    await expect(page.getByText("Oggi")).toBeVisible();
    await expect(page.getByText("Nessuna attività")).toBeVisible();

    // ── 13. Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.

    await page.waitForTimeout(1500);
  });
});
