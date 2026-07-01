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

    // ── 2. Verifica atterraggio nel front office ───────────────────

    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();
    await expect(page.getByText("Giulia Conti")).toBeVisible();

    // ── 3. Verifica che la barra di navigazione mostri il mese corrente ──

    // La label del mese (es. "Giugno 2026") — classe capitalize, verifichiamo
    // che sia visibile una stringa non vuota nella navigazione
    const meseLabel = page.locator(".min-w-\\[188px\\].text-center");
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

    // I giorni con attività hanno sfondo rose-50 e sono cliccabili (button)
    const giorniConAttivita = calendario.locator("button").filter({
      has: calendario.locator(".bg-rose-600, .border-rose-200"),
    });

    // Dovrebbero esserci almeno 4 giorni nel seed (giorni 2-5 del mese corrente)
    const count = await giorniConAttivita.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // ── 7. Verifica sintesi visibile in una cella con attività ─────

    const primaCella = giorniConAttivita.first();
    // Deve mostrare il numero di righe e le ore
    await expect(primaCella.locator("text=/\\d+(\\.\\d+)?\\s*h/")).toBeVisible();

    // ── 8. Clicca su un giorno con attività → apre il drawer ───────

    await primaCella.click();

    // Il drawer deve aprirsi (diventa visibile)
    const drawer = page.getByLabel("Dettaglio attività della giornata");
    await expect(drawer).toBeVisible();

    // Verifica contenuto drawer
    await expect(drawer.getByText("Righe registrate")).toBeVisible();
    await expect(drawer.getByText("Ore totali")).toBeVisible();
    await expect(drawer.getByText("Attività della giornata")).toBeVisible();

    // Chiudi il drawer
    await drawer.getByLabel("Chiudi").click();
    await expect(drawer).not.toBeVisible();

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

    // ── 13. Mantieni lo stato finale visibile per almeno 1.5 secondi

    await page.waitForTimeout(1500);
  });
});
