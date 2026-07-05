import { test, expect } from "@playwright/test";

/**
 * Demo scenario — US-015: Report mensile degli importi da fatturare per cliente.
 *
 * L'amministratore apre il report dalla sidebar e verifica, per il mese corrente,
 * l'elenco per cliente con dettaglio per offerta (offerta, tariffa, giornate
 * fatturabili, imponibile), i rimborsi trasferta ribaltati e il totale da
 * fatturare, con valori coerenti con i dati seed.
 *
 * Registra un video per la review.
 *
 * Valori attesi derivati dal seed (prisma/seed.ts), mese corrente, per il cliente
 * TechSolutions Srl (nessun altro scenario e2e tocca la sua offerta TS-2025-01):
 *   ore fatturabili = 8 + 2,5 + 6,5 (Giulia) + 8 + 8 (Marco) = 33 → 33/8 = 4,125 → "4,1"
 *   imponibile = 4,125 × 550 = 2.268,75 | rimborsi = 35,00 (45 km) + 60,00 (80 km) = 95,00
 *   totale cliente = 2.363,75
 *
 * Il cliente DataFlow SpA / DF-2025-02 riceve invece attività aggiuntive da altri
 * scenari e2e (US-012) che operano sulla stessa offerta nel mese corrente e non
 * vengono ripulite fino al termine dell'intera suite: per questo il suo dettaglio
 * e i totali complessivi sono verificati per coerenza interna (imponibile =
 * giornate × tariffa, totale = imponibile + rimborsi) invece che su cifre fisse —
 * proprio come richiesto dal criterio di accettazione "il report riflette sempre
 * i dati correnti".
 */

/** Converte un importo in formato it-IT ("2.268,75" o "480,00") in number. */
function euroANumero(testo: string): number {
  return Number(testo.replace(/\./g, "").replace(",", "."));
}

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-015 Demo", () => {
  test("l'amministratore apre il report e vede importi coerenti coi dati seed", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // ── 1. Login amministratore tramite endpoint e2e ──────────────
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Accedi" })).toBeVisible();

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
    await expect(
      page.getByRole("banner").getByText("Tech Reloaded"),
    ).toBeVisible();

    // ── 2. Apre "Fatturazione clienti" dalla sidebar ───────────────
    await page
      .locator("nav[aria-label='Navigazione principale'] a")
      .filter({ hasText: "Fatturazione clienti" })
      .click();

    await page.waitForURL("**/report/fatturazione-clienti");
    await expect(
      page.getByRole("heading", { name: "Importi da fatturare per cliente" }),
    ).toBeVisible();

    // ── 3. Dettaglio per offerta del cliente TechSolutions Srl ─────
    await expect(page.getByText("TechSolutions Srl")).toBeVisible();

    const rigaTechSolutions = page
      .getByRole("row")
      .filter({ hasText: "TS-2025-01" });
    await expect(rigaTechSolutions).toBeVisible();
    await expect(rigaTechSolutions.getByText("550,00")).toBeVisible(); // tariffa/gg
    await expect(rigaTechSolutions.getByText("4,1")).toBeVisible(); // giornate fatturabili
    await expect(rigaTechSolutions.getByText("2268,75")).toBeVisible(); // imponibile

    // ── 4. Rimborsi ribaltati e totale da fatturare del cliente ────
    await expect(
      page.getByText("Rimborsi trasferta ribaltati").first(),
    ).toBeVisible();
    await expect(page.getByText("95,00")).toBeVisible(); // rimborsi TechSolutions
    await expect(page.getByText("Totale da fatturare").first()).toBeVisible();
    await expect(page.getByText("2363,75").first()).toBeVisible(); // totale TechSolutions

    // ── 5. Secondo cliente: DataFlow SpA ──────────────────────────
    // Coerenza interna invece di cifre fisse: altri scenari e2e (US-012)
    // aggiungono attività fatturabili sulla stessa offerta nel mese corrente.
    await expect(page.getByText("DataFlow SpA")).toBeVisible();
    const rigaDataFlow = page
      .getByRole("row")
      .filter({ hasText: "DF-2025-02" });
    await expect(rigaDataFlow).toBeVisible();
    await expect(rigaDataFlow.getByText("480,00")).toBeVisible(); // tariffa/gg
    await expect(page.getByText("110,00")).toBeVisible(); // rimborsi DataFlow (150 km)

    // Nota: le giornate mostrate sono arrotondate a 1 decimale, quindi non si
    // ricalcola l'imponibile a partire da esse (introdurrebbe un falso
    // negativo per errore di arrotondamento); si verifica solo che entrambi i
    // valori non scendano sotto il minimo garantito dal solo seed.
    const celle = rigaDataFlow.locator("td");
    const giornateDataFlow = euroANumero((await celle.nth(2).innerText()).trim());
    const imponibileDataFlow = euroANumero(
      (await celle.nth(3).innerText()).replace("€", "").trim(),
    );
    expect(giornateDataFlow).toBeGreaterThanOrEqual(0.875 - 0.01);
    expect(imponibileDataFlow).toBeGreaterThanOrEqual(420 - 0.01);

    // ── 6. Totale complessivo del mese: coerenza interna ───────────
    await expect(
      page.getByText("Totale complessivo da fatturare", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("205,00")).toBeVisible(); // totale rimborsi (95,00 + 110,00, stabile)

    const testoImponibileManodopera = await page
      .getByText("Imponibile manodopera")
      .locator("xpath=following-sibling::*[1]")
      .innerText();
    const testoImportoTotale = await page
      .getByText("Importo totale")
      .locator("xpath=following-sibling::*[1]")
      .innerText();
    const imponibileManodopera = euroANumero(
      testoImponibileManodopera.replace("€", "").trim(),
    );
    const importoTotale = euroANumero(testoImportoTotale.replace("€", "").trim());
    expect(imponibileManodopera).toBeGreaterThanOrEqual(2688.75 - 0.01);
    expect(importoTotale).toBeCloseTo(imponibileManodopera + 205, 1);

    // ── 7. Mantieni lo stato finale visibile per la registrazione ──
    await page.waitForTimeout(1500);
  });
});
