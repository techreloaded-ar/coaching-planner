import { test, expect } from "@playwright/test";

/**
 * Demo scenario — US-009: Anagrafica collaboratori con tariffa e credenziali di accesso
 *
 * Dimostra il flusso completo: l'amministratore entra nella console, crea un nuovo
 * collaboratore con tariffa giornaliera e credenziali di accesso; il collaboratore
 * appena creato si autentica (tramite endpoint di test) e atterra nel front office
 * su /attivita.
 *
 * Registra un video per la review.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-009 Demo", () => {
  test("crea collaboratore con tariffa e credenziali → il collaboratore accede al front office", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // ── 1. Login amministratore tramite endpoint e2e ───────────────

    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Accedi" })
    ).toBeVisible();

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

    // ── 2. Naviga a Collaboratori dalla sidebar ────────────────────

    await expect(page.getByRole("banner").getByText("Tech Reloaded")).toBeVisible();

    await page
      .getByRole("link", { name: "Collaboratori", exact: true })
      .click();

    await page.waitForURL("**/anagrafiche/collaboratori");
    await expect(
      page.getByRole("heading", { name: "Collaboratori" })
    ).toBeVisible();

    // ── 3. Clicca "Nuovo collaboratore" ─────────────────────────────

    await page.getByRole("link", { name: "Nuovo collaboratore" }).click();
    await page.waitForURL("**/anagrafiche/collaboratori/nuovo");
    await expect(
      page.getByRole("heading", { name: "Nuovo collaboratore" })
    ).toBeVisible();

    // ── 4. Compila tutti i campi del form ──────────────────────────

    const ts = Date.now();
    const nome = "Luca";
    const cognome = `Bianchi${ts}`;
    const email = `luca.bianchi.${ts}@example.com`;
    const nomeCompleto = `${nome} ${cognome}`;

    await page.getByLabel(/^Nome\b/).fill(nome);
    await expect(page.getByLabel(/^Nome\b/)).toHaveValue(nome);

    await page.getByLabel("Cognome").fill(cognome);
    await expect(page.getByLabel("Cognome")).toHaveValue(cognome);

    await page.getByLabel("Email di accesso").fill(email);
    await expect(page.getByLabel("Email di accesso")).toHaveValue(email);

    await page.getByLabel("Partita IVA").fill("04127730961");
    await expect(page.getByLabel("Partita IVA")).toHaveValue("04127730961");

    await page.getByLabel("Tariffa giornaliera").fill("520,00");
    await expect(page.getByLabel("Tariffa giornaliera")).toHaveValue("520,00");

    // ── 5. Invia il form ────────────────────────────────────────────

    await page.getByRole("button", { name: "Crea collaboratore" }).click();

    // ── 6. Verifica redirect alla lista con successo ────────────────

    await page.waitForURL("**/anagrafiche/collaboratori?esito=creato");
    await expect(
      page.getByRole("heading", { name: "Collaboratori" })
    ).toBeVisible();

    // ── 7. Trova il collaboratore appena creato nella lista ─────────

    const rigaCollaboratore = page
      .locator("table[aria-label='Elenco collaboratori'] tbody tr")
      .filter({ hasText: nomeCompleto })
      .first();
    await expect(rigaCollaboratore.getByText(nomeCompleto)).toBeVisible();
    await expect(rigaCollaboratore.getByText("Attivo", { exact: true })).toBeVisible();

    // ── 8. Il collaboratore appena creato accede tramite endpoint di test ──

    const contestoCollaboratore = await page.context().browser()!.newContext();
    const paginaCollaboratore = await contestoCollaboratore.newPage();

    await paginaCollaboratore.goto("/login");
    await expect(
      paginaCollaboratore.getByRole("heading", { name: "Accedi" })
    ).toBeVisible();

    const destinazione = await paginaCollaboratore.evaluate(async (emailCollaboratore) => {
      const res = await fetch("/api/e2e-test/sessione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailCollaboratore }),
      });
      return res.json();
    }, email);

    expect(destinazione.redirect).toBe("/attivita");

    // ── 9. Naviga a /attivita e verifica l'atterraggio nel front office ──

    await paginaCollaboratore.goto("/attivita");
    await paginaCollaboratore.waitForURL("**/attivita**");
    await expect(
      paginaCollaboratore.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();

    await contestoCollaboratore.close();

    // ── 10. Mantieni lo stato finale visibile per almeno 1.5 secondi ─

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
