import { EMAIL_ADMIN_E2E, preparaSessioneE2e } from "./support/auth";
import {
  apriPersona,
  apriPersone,
  attendiSchedaPersona,
  rigaPersona,
  salvaPersona,
} from "./support/persone";
import { test, expect } from "./support/fixtures";

test.describe("Persone: validazione e sessioni", () => {
  test.beforeEach(async ({ page }) => {
    await preparaSessioneE2e(page, EMAIL_ADMIN_E2E);
  });

  test("richiede il cognome e rifiuta l'email già registrata senza creare duplicati", async ({
    page,
    factory,
  }) => {
    const esistente = await factory.createUtente();
    await page.goto("/anagrafiche/persone/nuovo");
    await attendiSchedaPersona(page);
    await page.getByLabel(/^Nome\b/).fill(factory.namespace);
    await page.getByLabel(/^Email di accesso\b/).fill(esistente.email);
    await page
      .getByRole("button", { name: "Crea persona", exact: true })
      .click();
    await expect(
      page.getByText("Il cognome è obbligatorio", { exact: true }),
    ).toBeVisible();
    await page.getByLabel(/^Cognome\b/).fill("Duplicato");
    await page
      .getByRole("button", { name: "Crea persona", exact: true })
      .click();
    await expect(
      page.getByText("Esiste già un utente con questa email", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(/^Nome\b/)).toHaveValue(factory.namespace);
    await apriPersone(page);
    await page
      .getByRole("searchbox", { name: "Cerca persona" })
      .fill(esistente.email);
    await expect(rigaPersona(page, esistente.email)).toHaveCount(1);
  });

  test("disattivare l'accesso blocca una sessione aperta; riattivare consente un nuovo accesso", async ({
    page,
    browser,
    collaboratore,
  }) => {
    const contesto = await browser.newContext();
    try {
      const sessione = await contesto.newPage();
      await preparaSessioneE2e(sessione, collaboratore.utente.email);
      await sessione.goto("/attivita");
      await expect(
        sessione.getByRole("heading", { name: "Le mie attività", exact: true }),
      ).toBeVisible();
      await apriPersona(page, collaboratore.utente.id, "accesso");
      await page
        .getByRole("checkbox", { name: "Accesso attivo", exact: true })
        .uncheck();
      await salvaPersona(page);
      await sessione.goto("/attivita");
      await expect(sessione).toHaveURL(/\/$/);
      await expect(
        sessione.getByRole("button", {
          name: "Accedi con Google",
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("checkbox", { name: "Accesso attivo", exact: true })
        .check();
      await salvaPersona(page);
      const nuovoContesto = await browser.newContext();
      try {
        const nuovaSessione = await nuovoContesto.newPage();
        await preparaSessioneE2e(nuovaSessione, collaboratore.utente.email);
        await nuovaSessione.goto("/attivita");
        await expect(
          nuovaSessione.getByRole("heading", {
            name: "Le mie attività",
            exact: true,
          }),
        ).toBeVisible();
      } finally {
        await nuovoContesto.close();
      }
    } finally {
      await contesto.close();
    }
  });

  test("promozione e retrocessione aggiornano i permessi della sessione già aperta", async ({
    page,
    browser,
    collaboratore,
  }) => {
    const contesto = await browser.newContext();
    try {
      const sessione = await contesto.newPage();
      await preparaSessioneE2e(sessione, collaboratore.utente.email);
      await sessione.goto("/anagrafiche/persone");
      await expect(sessione).toHaveURL(/\/attivita$/);
      await apriPersona(page, collaboratore.utente.id, "accesso");
      await page.getByRole("button", { name: /^Amministratore/ }).click();
      await page
        .getByRole("checkbox", {
          name: "Registra anche attività come collaboratore",
          exact: true,
        })
        .check();
      await salvaPersona(page);
      await sessione.goto("/anagrafiche/persone");
      await expect(
        sessione.getByRole("heading", { name: "Persone", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: /^Collaboratore/ }).click();
      await salvaPersona(page);
      await sessione.goto("/anagrafiche/persone");
      await expect(sessione).toHaveURL(/\/attivita$/);
    } finally {
      await contesto.close();
    }
  });

  test("un anonimo non può aprire elenco, scheda o creazione", async ({
    browser,
    collaboratore,
  }) => {
    const contesto = await browser.newContext();
    try {
      const pagina = await contesto.newPage();
      for (const percorso of [
        "/anagrafiche/persone",
        "/anagrafiche/persone/nuovo",
        `/anagrafiche/persone/${collaboratore.utente.id}`,
      ]) {
        await pagina.goto(percorso);
        await expect(pagina).toHaveURL(/\/$/);
        await expect(
          pagina.getByRole("button", {
            name: "Accedi con Google",
            exact: true,
          }),
        ).toBeVisible();
      }
    } finally {
      await contesto.close();
    }
  });
});
