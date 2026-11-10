import { EMAIL_ADMIN_E2E, preparaSessioneE2e } from "./support/auth";
import { apriPersona, salvaPersona } from "./support/persone";
import { test, expect } from "./support/fixtures";

test.describe("Anagrafica nella scheda persona", () => {
  test.beforeEach(async ({ page }) => {
    await preparaSessioneE2e(page, EMAIL_ADMIN_E2E);
  });

  test("salva nome, cognome, email e partita IVA insieme mantenendo tariffe e offerte", async ({
    page,
    collaboratore,
    clienteConOfferta,
    factory,
  }) => {
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });
    await apriPersona(page, collaboratore.utente.id);
    const nome = `${factory.namespace} Aggiornata`;
    const email = `${factory.namespace}-aggiornata@e2e.invalid`;
    await page.getByLabel(/^Nome\b/).fill(nome);
    await page.getByLabel(/^Cognome\b/).fill("Verdi");
    await page.getByLabel(/^Email di accesso\b/).fill(email);
    await page.getByLabel(/^Partita IVA\b/).fill("12345");
    await page
      .getByRole("button", { name: "Salva modifiche", exact: true })
      .click();
    await expect(
      page.getByText("La partita IVA deve essere di 11 cifre", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(/^Nome\b/)).toHaveValue(nome);
    await expect(page.getByLabel(/^Email di accesso\b/)).toHaveValue(email);
    await page.getByLabel(/^Partita IVA\b/).fill("01234567890");
    await salvaPersona(page);
    await expect(
      page.getByRole("heading", { name: `${nome} Verdi`, exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(/^Partita IVA\b/)).toHaveValue("01234567890");
    await page
      .getByRole("tab", { name: "Attività e compensi", exact: true })
      .click();
    await expect(page.getByTestId("tariffa-attuale")).toContainText(/350,00/);
    await expect(
      page.getByRole("heading", { name: "Offerte abilitate", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Apri foglio attività", exact: true })
      .click();
    await expect(page.getByTestId("banner-foglio-consultato")).toContainText(
      `${nome} Verdi`,
    );
  });

  test("i vecchi indirizzi confluiscono nell'elenco e nella scheda unificata", async ({
    page,
    collaboratore,
  }) => {
    await page.goto("/anagrafiche/utenti");
    await expect(page).toHaveURL(/\/anagrafiche\/persone$/);
    await page.goto("/anagrafiche/collaboratori");
    await expect(page).toHaveURL(
      /\/anagrafiche\/persone\?ruolo=COLLABORATORE$/,
    );
    await page.goto(
      `/anagrafiche/collaboratori/${collaboratore.collaboratore.id}/modifica`,
    );
    await expect(page).toHaveURL(
      new RegExp(
        `/anagrafiche/persone/${collaboratore.utente.id}\\?sezione=anagrafica$`,
      ),
    );
    await page.goto(`/anagrafiche/utenti/${collaboratore.utente.id}/modifica`);
    await expect(page).toHaveURL(
      new RegExp(`/anagrafiche/persone/${collaboratore.utente.id}$`),
    );
    await page.goto("/anagrafiche/collaboratori/nuovo");
    await expect(page).toHaveURL(/\/anagrafiche\/persone\/nuovo$/);
  });
});
