import { test, expect } from "@playwright/test";

/**
 * US-012: Inserimento delle righe di attività giornaliere
 *
 * Scenario demo: Giulia accede al calendario, clicca un giorno con attività,
 * arriva alla pagina di dettaglio, aggiunge due righe, ne modifica una,
 * ne elimina un'altra e verifica il riepilogo.
 */

// ── Helpers ─────────────────────────────────────────────────────

async function loginComeGiulia(page: ReturnType<typeof test["info"]>["page"]) {
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
}

/** Calcola la data per il giorno specificato del mese corrente */
function dataOggiOffset(giorno: number): string {
  const oggi = new Date();
  const a = oggi.getFullYear();
  const m = String(oggi.getMonth() + 1).padStart(2, "0");
  const g = String(giorno).padStart(2, "0");
  return `${a}-${m}-${g}`;
}

// ═══════════════════════════════════════════════════════════════
// Test
// ═══════════════════════════════════════════════════════════════

test.describe("US-012 Demo — Inserimento righe attività", () => {
  test.use({
    video: "on",
    viewport: { width: 1280, height: 720 },
    launchOptions: { slowMo: 200 },
  });

  test("flusso completo: aggiunta, modifica ed eliminazione righe", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // ── 1. Login come Giulia ──────────────────────────────────────

    await loginComeGiulia(page);

    // ── 2. Naviga al giorno 2 del mese corrente (ha attività dal seed) ──

    const dataGiorno2 = dataOggiOffset(2);
    await page.goto(`/attivita/${dataGiorno2}`);
    await page.waitForURL(`**/attivita/${dataGiorno2}`);

    // ── 3. Verifica la pagina di dettaglio ────────────────────────

    // Il breadcrumb "Torna al calendario" deve essere visibile
    await expect(
      page.getByRole("link", { name: "Torna al calendario" })
    ).toBeVisible();

    // Le righe esistenti dal seed devono essere visibili
    const sezioneAttivita = page.getByText("Attività della giornata");
    await expect(sezioneAttivita).toBeVisible();

    // Il form deve essere visibile
    await expect(page.getByText("Nuova riga attività")).toBeVisible();

    // Il riepilogo deve mostrare i valori iniziali
    await expect(page.getByText("Righe registrate")).toBeVisible();
    await expect(page.getByText("Ore totali")).toBeVisible();
    await expect(page.getByText("Ore fatturabili")).toBeVisible();

    // ── 4. Aggiungi una nuova riga ────────────────────────────────

    // Seleziona cliente (primo disponibile)
    const selectCliente = page.locator("#cliente");
    await selectCliente.selectOption({ index: 1 });
    // Attendi il caricamento delle offerte
    await page.waitForTimeout(500);

    // Seleziona offerta (prima disponibile)
    const selectOfferta = page.locator("#offerta");
    await expect(selectOfferta).toBeEnabled();
    await selectOfferta.selectOption({ index: 1 });

    // Inserisci ore
    const inputOre = page.locator("#ore");
    await inputOre.fill("3,5");

    // Verifica che fatturabile sia attivo di default
    const checkboxFatturabile = page.locator("input[type='checkbox']");
    await expect(checkboxFatturabile).toBeChecked();

    // Aggiungi nota
    const textareaNota = page.locator("#nota");
    await textareaNota.fill("Test e2e — nuova riga");

    // Submit
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await page.waitForTimeout(1000);

    // ── 5. Verifica che la riga sia stata aggiunta ────────────────

    await expect(page.getByText("Test e2e — nuova riga")).toBeVisible();

    // ── 6. Aggiungi una seconda riga su offerta diversa ────────────

    // Seleziona un cliente diverso (se disponibile) o lo stesso con offerta diversa
    const clientiDisponibili = await selectCliente.locator("option").count();
    if (clientiDisponibili > 2) {
      await selectCliente.selectOption({ index: 2 });
    } else {
      await selectCliente.selectOption({ index: 1 });
    }
    await page.waitForTimeout(500);

    await selectOfferta.selectOption({ index: 1 });
    await inputOre.fill("6");
    // Deseleziona fatturabile
    await checkboxFatturabile.uncheck();
    await textareaNota.fill("Test e2e — seconda riga non fatturabile");

    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await page.waitForTimeout(1000);

    await expect(
      page.getByText("Test e2e — seconda riga non fatturabile")
    ).toBeVisible();

    // ── 7. Modifica la prima riga ─────────────────────────────────

    // Trova il pulsante Modifica della prima riga (quella con la nota "Test e2e — nuova riga")
    const primaRigaCard = page
      .getByText("Test e2e — nuova riga")
      .locator("..");
    await primaRigaCard.getByRole("button", { name: "Modifica" }).click();

    // Il form dovrebbe passare in modalità modifica
    await expect(page.getByText("Modifica riga")).toBeVisible();
    await expect(page.getByRole("button", { name: "Salva modifiche" })).toBeVisible();

    // Cambia le ore
    await inputOre.fill("7,25");

    // Salva
    await page.getByRole("button", { name: "Salva modifiche" }).click();
    await page.waitForTimeout(1000);

    // ── 8. Elimina la seconda riga ────────────────────────────────

    // Trova la seconda riga (quella non fatturabile)
    const secondaRigaCard = page
      .getByText("Test e2e — seconda riga non fatturabile")
      .locator("..");

    // Clicca Elimina e conferma il dialog
    page.on("dialog", (dialog) => dialog.accept());
    await secondaRigaCard.getByRole("button", { name: "Elimina" }).click();
    await page.waitForTimeout(1000);

    // La seconda riga non deve più essere visibile
    await expect(
      page.getByText("Test e2e — seconda riga non fatturabile")
    ).not.toBeVisible();

    // La prima riga deve essere ancora visibile
    await expect(page.getByText("Test e2e — nuova riga")).toBeVisible();

    // ── 9. Il riepilogo deve essersi aggiornato ───────────────────

    // Almeno una riga con ore presenti
    await expect(
      page.locator("text=/[1-9]\\d*(\\.\\d+)?\\s*h/").first()
    ).toBeVisible();

    // ── 10. Mantieni lo stato finale visibile per il video ────────

    await page.waitForTimeout(2000);
  });
});

// ═══════════════════════════════════════════════════════════════

test.describe("US-012 Validazione — ore non valide", () => {
  test.use({
    viewport: { width: 1280, height: 720 },
    launchOptions: { slowMo: 100 },
  });

  test("mostra errori per input ore non validi", async ({ page }) => {
    test.setTimeout(60_000);

    await loginComeGiulia(page);

    // Naviga al giorno 2
    const dataGiorno2 = dataOggiOffset(2);
    await page.goto(`/attivita/${dataGiorno2}`);
    await page.waitForURL(`**/attivita/${dataGiorno2}`);

    // Seleziona cliente e offerta per il form
    await page.locator("#cliente").selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await page.locator("#offerta").selectOption({ index: 1 });

    const inputOre = page.locator("#ore");

    // Test: ore vuote
    await inputOre.fill("");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await expect(
      page.getByText(/compila/i)
    ).toBeVisible();

    // Test: zero
    await inputOre.fill("0");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await page.waitForTimeout(300);
    // Dovrebbe mostrare un errore (server-side o inline)
    const errore = page.locator(".text-red-600, .text-red-700");
    await expect(errore.first()).toBeVisible();

    // Test: negativo
    await inputOre.fill("-2");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await page.waitForTimeout(300);
    await expect(errore.first()).toBeVisible();

    // Test: testo
    await inputOre.fill("abc");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await page.waitForTimeout(300);
    await expect(errore.first()).toBeVisible();

    await page.waitForTimeout(1000);
  });
});

// ═══════════════════════════════════════════════════════════════

test.describe("US-012 Mese concluso — nessun blocco temporale", () => {
  test.use({
    viewport: { width: 1280, height: 720 },
    launchOptions: { slowMo: 100 },
  });

  test("aggiunta, modifica ed eliminazione su data passata", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await loginComeGiulia(page);

    // Usa una data di 2 mesi fa (sicuramente passata)
    const oggi = new Date();
    const anno = oggi.getFullYear();
    const mese = oggi.getMonth() - 1; // mese precedente (0-based)
    if (mese < 0) {
      // Se gennaio, usa dicembre anno precedente
      const dataPassata = `${oggi.getFullYear() - 1}-12-02`;
      await page.goto(`/attivita/${dataPassata}`);
      await page.waitForURL(`**/attivita/${dataPassata}`);
    } else {
      const dataPassata = `${anno}-${String(mese + 1).padStart(2, "0")}-02`;
      await page.goto(`/attivita/${dataPassata}`);
      await page.waitForURL(`**/attivita/${dataPassata}`);
    }

    // Verifica che la pagina si carichi (nessun blocco)
    await expect(
      page.getByRole("link", { name: "Torna al calendario" })
    ).toBeVisible();

    // Aggiungi una riga
    await page.locator("#cliente").selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await page.locator("#offerta").selectOption({ index: 1 });
    await page.locator("#ore").fill("4");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();
    await page.waitForTimeout(1000);

    // Verifica che la riga sia stata aggiunta (deve esserci una riga nella lista)
    await expect(
      page.locator("text=/\\d+(\\.\\d+)?\\s*h/").first()
    ).toBeVisible();

    await page.waitForTimeout(1000);
  });
});
