import { test, expect } from "@playwright/test";

/**
 * Test e2e — US-009: Anagrafica collaboratori con tariffa e credenziali di accesso
 *
 * Scenari:
 * - Validazione campi obbligatori senza creazione
 * - Email duplicata respinta in creazione
 * - Creazione e modifica persistita dopo reload
 * - Disattivazione revoca l'accesso e riattivazione
 */

test.describe("Anagrafica collaboratori", () => {
  test.beforeEach(async ({ page }) => {
    // Accedi come amministratore tramite endpoint e2e
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
  });

  test("validazione campi obbligatori senza creazione", async ({ page }) => {
    // Naviga al form nuovo collaboratore
    await page.goto("/anagrafiche/collaboratori/nuovo");
    await expect(
      page.getByRole("heading", { name: "Nuovo collaboratore" })
    ).toBeVisible();

    // Invia il form vuoto
    await page.getByRole("button", { name: "Crea collaboratore" }).click();

    // Verifica il banner di errore generale
    await expect(
      page.getByText(/Controlla i campi evidenziati/)
    ).toBeVisible();

    // Verifica i messaggi di errore per i campi obbligatori
    await expect(page.getByText("Il nome è obbligatorio")).toBeVisible();
    await expect(page.getByText("Il cognome è obbligatorio")).toBeVisible();
    await expect(
      page.getByText("L'email di accesso è obbligatoria")
    ).toBeVisible();
    await expect(
      page.getByText("La partita IVA è obbligatoria")
    ).toBeVisible();
    await expect(
      page.getByText("La tariffa giornaliera è obbligatoria")
    ).toBeVisible();

    // Verifica che non ci sia redirect — siamo ancora su /nuovo
    await expect(page).toHaveURL(/\/anagrafiche\/collaboratori\/nuovo/);
  });

  test("email duplicata respinta in creazione", async ({ page }) => {
    // Naviga al form nuovo collaboratore
    await page.goto("/anagrafiche/collaboratori/nuovo");
    await expect(
      page.getByRole("heading", { name: "Nuovo collaboratore" })
    ).toBeVisible();

    // Compila il form con dati validi ma email già esistente (seed)
    await page.getByLabel(/^Nome\b/).fill("Mario");
    await page.getByLabel("Cognome").fill("Rossi");
    await page.getByLabel("Email di accesso").fill("giulia.conti@agilereloaded.it");
    await page.getByLabel("Partita IVA").fill("98765432109");
    await page.getByLabel("Tariffa giornaliera").fill("300,00");

    // Invia il form
    await page.getByRole("button", { name: "Crea collaboratore" }).click();

    // Verifica il messaggio di errore per email duplicata
    await expect(
      page.getByText("Esiste già un utente con questa email")
    ).toBeVisible();

    // Verifica che non ci sia redirect — siamo ancora su /nuovo
    await expect(page).toHaveURL(/\/anagrafiche\/collaboratori\/nuovo/);
  });

  test("creazione e modifica persistita dopo reload", async ({ page }) => {
    const ts = Date.now();
    const nome = "Test";
    const cognome = `Collaboratore${ts}`;
    const email = `test.collaboratore.${ts}@example.com`;

    // Naviga al form nuovo collaboratore
    await page.goto("/anagrafiche/collaboratori/nuovo");
    await expect(
      page.getByRole("heading", { name: "Nuovo collaboratore" })
    ).toBeVisible();

    // Compila tutti i campi con dati univoci
    await page.getByLabel(/^Nome\b/).fill(nome);
    await page.getByLabel("Cognome").fill(cognome);
    await page.getByLabel("Email di accesso").fill(email);
    await page.getByLabel("Partita IVA").fill("11122233344");
    await page.getByLabel("Tariffa giornaliera").fill("400,00");

    // Invia il form
    await page.getByRole("button", { name: "Crea collaboratore" }).click();

    // Verifica il redirect con esito creato
    await page.waitForURL("**/anagrafiche/collaboratori?esito=creato");
    await expect(
      page.getByRole("heading", { name: "Collaboratori" })
    ).toBeVisible();

    // Verifica che il collaboratore appena creato sia nell'elenco
    const nomeCompleto = `${nome} ${cognome}`;
    const riga = page
      .locator("table[aria-label='Elenco collaboratori'] tbody tr")
      .filter({ hasText: nomeCompleto })
      .first();
    await expect(riga.getByText(nomeCompleto)).toBeVisible();

    // Clicca "Modifica" sul collaboratore
    await riga.getByRole("link", { name: "Modifica" }).click();

    // Attendi la pagina di modifica
    await page.waitForURL(/\/anagrafiche\/collaboratori\/[^/]+\/modifica$/);
    await expect(
      page.getByRole("heading", { name: "Modifica collaboratore" })
    ).toBeVisible();

    // Cambia la tariffa giornaliera con un valore univoco
    const nuovaTariffa = "777,50";
    const campoTariffa = page.getByLabel("Tariffa giornaliera");
    await campoTariffa.clear();
    await campoTariffa.fill(nuovaTariffa);

    // Invia il form
    await page.getByRole("button", { name: "Salva modifiche" }).click();

    // Attendi il redirect con esito salvato
    await page.waitForURL("**/anagrafiche/collaboratori?esito=salvato");

    // Verifica che la nuova tariffa appaia nell'elenco
    const rigaModificata = page
      .locator("table[aria-label='Elenco collaboratori'] tbody tr")
      .filter({ hasText: nomeCompleto })
      .first();
    await expect(rigaModificata.getByText("777,50")).toBeVisible();

    // Ricarica la pagina e verifica la persistenza
    await page.reload();
    await page.waitForURL("**/anagrafiche/collaboratori**");
    const rigaRicaricata = page
      .locator("table[aria-label='Elenco collaboratori'] tbody tr")
      .filter({ hasText: nomeCompleto })
      .first();
    await expect(rigaRicaricata.getByText("777,50")).toBeVisible();
  });

  test("disattivazione revoca l'accesso e riattivazione", async ({ page }) => {
    const ts = Date.now();
    const nome = "Revoca";
    const cognome = `Test${ts}`;
    const email = `revoca.test.${ts}@example.com`;

    // Crea un nuovo collaboratore dedicato a questo scenario,
    // per non interferire con il collaboratore Giulia Conti del seed
    // (usato da altre suite per l'accesso al front office)
    await page.goto("/anagrafiche/collaboratori/nuovo");
    await page.getByLabel(/^Nome\b/).fill(nome);
    await page.getByLabel("Cognome").fill(cognome);
    await page.getByLabel("Email di accesso").fill(email);
    await page.getByLabel("Partita IVA").fill("55566677788");
    await page.getByLabel("Tariffa giornaliera").fill("250,00");
    await page.getByRole("button", { name: "Crea collaboratore" }).click();
    await page.waitForURL("**/anagrafiche/collaboratori?esito=creato");

    const nomeCompleto = `${nome} ${cognome}`;

    // Verifica che il collaboratore sia "Attivo" appena creato
    const rigaAttiva = page
      .locator("table[aria-label='Elenco collaboratori'] tbody tr")
      .filter({ hasText: nomeCompleto })
      .first();
    await expect(rigaAttiva.getByText("Attivo", { exact: true })).toBeVisible();

    // Apri la modale di disattivazione e confermala
    await rigaAttiva.getByRole("button", { name: "Disattiva" }).click();
    await expect(
      page.getByRole("dialog", { name: new RegExp(`Disattivare «${nome} ${cognome}»\\?`) })
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Disattiva collaboratore" })
      .click();

    // Attendi il redirect all'elenco
    await page.waitForURL("**/anagrafiche/collaboratori");

    // Verifica che la riga del collaboratore mostri il badge "Disattivato"
    const rigaDisattivata = page
      .locator("table[aria-label='Elenco collaboratori'] tbody tr")
      .filter({ hasText: nomeCompleto })
      .first();
    await expect(rigaDisattivata.getByText("Disattivato")).toBeVisible();
    await expect(rigaDisattivata.getByText("Accesso revocato")).toBeVisible();

    // Verifica che il login per questo collaboratore non porti più
    // a una sessione valida: l'endpoint e2e crea la sessione direttamente
    // (senza replicare i controlli del callback Google), ma _risolviSessione
    // in src/lib/dal.ts invalida la sessione di un collaboratore disattivato
    // a ogni richiesta successiva (richiediRuolo → redirect a /login).
    // Verifichiamo quindi il comportamento reale: la sessione viene creata,
    // ma una navigazione successiva a /attivita reindirizza al login.
    const contestoCollaboratore = await page.context().browser()!.newContext();
    const paginaCollaboratore = await contestoCollaboratore.newPage();

    await paginaCollaboratore.goto("/");
    await paginaCollaboratore.evaluate(async (emailCollaboratore) => {
      await fetch("/api/e2e-test/sessione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailCollaboratore }),
      });
    }, email);

    // La sessione creata per un collaboratore disattivato non è valida:
    // navigando su /attivita viene reindirizzato a /login
    await paginaCollaboratore.goto("/attivita");
    await paginaCollaboratore.waitForURL("**/login**");
    await expect(
      paginaCollaboratore.getByRole("heading", { name: "Accedi" })
    ).toBeVisible();

    await contestoCollaboratore.close();

    // Riattiva il collaboratore
    await rigaDisattivata.getByRole("button", { name: "Riattiva" }).click();
    await page.waitForURL("**/anagrafiche/collaboratori");

    // Verifica che ora mostri il badge "Attivo"
    const rigaRiattivata = page
      .locator("table[aria-label='Elenco collaboratori'] tbody tr")
      .filter({ hasText: nomeCompleto })
      .first();
    await expect(rigaRiattivata.getByText("Attivo", { exact: true })).toBeVisible();
  });
});
