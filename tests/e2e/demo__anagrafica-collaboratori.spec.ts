import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";

/**
 * Demo scenario — US-047: Anagrafica collaboratori sola-modifica
 *
 * Dimostra il nuovo perimetro della schermata Collaboratori dopo US-047:
 * censimento e stato (attivazione/disattivazione) si governano esclusivamente
 * dalla schermata Utenti, mentre qui restano modificabili solo i dati
 * anagrafici, la partita IVA e la tariffa giornaliera; l'email di accesso è
 * in sola lettura. Il pulsante "Nuovo collaboratore" non esiste più e la
 * vecchia rotta di censimento reindirizza a /anagrafiche/utenti.
 *
 * Registra un video per la review.
 */

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-047 Demo", () => {
  test("collaboratori è sola-modifica: niente censimento, stato in sola lettura, tariffa aggiornabile", async ({
    page,
    collaboratore,
  }) => {
    test.setTimeout(60_000);

    const nomeCompleto = `${collaboratore.collaboratore.nome} ${collaboratore.collaboratore.cognome}`;

    // ── 1. Login amministratore tramite endpoint e2e ───────────────

    await accediAlBackOfficeComeAdmin(page);

    // ── 2. Naviga a Collaboratori dalla sidebar ────────────────────

    await expect(page.getByRole("banner").getByText("Tech Reloaded")).toBeVisible();

    await page
      .getByRole("link", { name: "Collaboratori", exact: true })
      .click();

    await page.waitForURL("**/anagrafiche/collaboratori");
    await expect(
      page.getByRole("heading", { name: "Collaboratori" })
    ).toBeVisible();

    // ── 3. Il censimento non esiste più: nessun "Nuovo collaboratore" ──

    await expect(
      page.getByRole("link", { name: "Nuovo collaboratore" })
    ).toHaveCount(0);

    // ── 4. La riga del collaboratore mostra lo stato in sola lettura ──

    const rigaCollaboratore = page
      .locator("table[aria-label='Elenco collaboratori'] tbody tr")
      .filter({ hasText: nomeCompleto })
      .first();
    await expect(rigaCollaboratore.getByText(nomeCompleto)).toBeVisible();
    await expect(rigaCollaboratore.getByText("Attivo", { exact: true })).toBeVisible();
    await expect(
      rigaCollaboratore.getByRole("button", { name: "Disattiva" })
    ).toHaveCount(0);
    await expect(
      rigaCollaboratore.getByRole("button", { name: "Riattiva" })
    ).toHaveCount(0);

    // ── 5. La vecchia rotta di censimento reindirizza a Utenti ─────

    await page.goto("/anagrafiche/collaboratori/nuovo");
    await page.waitForURL("**/anagrafiche/utenti");
    await expect(page.getByRole("heading", { name: "Utenti" })).toBeVisible();

    // ── 6. Torna all'elenco collaboratori ───────────────────────────

    await page
      .getByRole("link", { name: "Collaboratori", exact: true })
      .click();
    await page.waitForURL("**/anagrafiche/collaboratori");

    // ── 7. Apre la modifica del collaboratore ───────────────────────

    const rigaDaModificare = page
      .locator("table[aria-label='Elenco collaboratori'] tbody tr")
      .filter({ hasText: nomeCompleto })
      .first();
    await rigaDaModificare.getByRole("link", { name: "Modifica" }).click();

    await page.waitForURL(/\/anagrafiche\/collaboratori\/[^/]+\/modifica$/);
    await expect(
      page.getByRole("heading", { name: "Modifica collaboratore" })
    ).toBeVisible();

    // ── 8. L'email di accesso è in sola lettura ─────────────────────

    const campoEmail = page.getByLabel("Email di accesso");
    await expect(campoEmail).toHaveJSProperty("readOnly", true);
    await expect(campoEmail).toHaveValue(collaboratore.utente.email);

    // ── 9. Modifica la tariffa giornaliera ──────────────────────────

    const nuovaTariffa = "610,00";
    const campoTariffa = page.getByLabel("Tariffa giornaliera");
    await campoTariffa.clear();
    await campoTariffa.fill(nuovaTariffa);

    // ── 10. Salva le modifiche ───────────────────────────────────────

    await page.getByRole("button", { name: "Salva modifiche" }).click();

    // ── 11. Verifica il redirect con esito salvato ──────────────────

    await page.waitForURL("**/anagrafiche/collaboratori?esito=salvato");
    await expect(
      page.getByRole("heading", { name: "Collaboratori" })
    ).toBeVisible();

    // ── 12. La nuova tariffa è visibile nell'elenco ─────────────────

    const rigaAggiornata = page
      .locator("table[aria-label='Elenco collaboratori'] tbody tr")
      .filter({ hasText: nomeCompleto })
      .first();
    await expect(rigaAggiornata.getByText(nuovaTariffa)).toBeVisible();

    // ── 13. Mantieni lo stato finale visibile per almeno 1.5 secondi ─

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
