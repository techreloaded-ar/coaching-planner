import { EMAIL_ADMIN_E2E, preparaSessioneE2e } from "./support/auth";
import { barraSelezione, selezionaRighe } from "./support/elenchi";
import {
  apriPersone,
  apriPersona,
  attendiSchedaPersona,
  rigaPersona,
  salvaPersona,
} from "./support/persone";
import { test, expect } from "./support/fixtures";

// Ogni scenario crea persone proprie; gli utenti del seed restano in sola lettura.
test.describe("Persone: gestione unificata", () => {
  test.beforeEach(async ({ page }) => {
    await preparaSessioneE2e(page, EMAIL_ADMIN_E2E);
  });

  test("parte dagli attivi e combina ricerca, stato e ruolo; un nuovo ingresso riparte dagli attivi", async ({
    page,
    factory,
  }) => {
    const attivo = await factory.createUtente({
      ruolo: "AMMINISTRATORE",
      nome: factory.namespace,
    });
    const disattivato = await factory.createUtente({
      ruolo: "AMMINISTRATORE",
      nome: factory.namespace,
    });
    await apriPersona(page, disattivato.id, "accesso");
    await page
      .getByRole("checkbox", { name: "Accesso attivo", exact: true })
      .uncheck();
    await salvaPersona(page);
    await apriPersone(page);
    const ricerca = page.getByRole("searchbox", { name: "Cerca persona" });
    const stato = page.getByRole("combobox", { name: "Filtra per stato" });
    await expect(stato).toHaveValue("attivi");
    await ricerca.fill(factory.namespace);
    await expect(rigaPersona(page, attivo.email)).toBeVisible();
    await expect(rigaPersona(page, disattivato.email)).toHaveCount(0);
    await stato.selectOption("tutti");
    await expect(rigaPersona(page, attivo.email)).toBeVisible();
    await expect(rigaPersona(page, disattivato.email)).toBeVisible();
    await stato.selectOption("disattivati");
    await expect(rigaPersona(page, attivo.email)).toHaveCount(0);
    await expect(rigaPersona(page, disattivato.email)).toBeVisible();
    await page
      .getByRole("combobox", { name: "Filtra per ruolo" })
      .selectOption("COLLABORATORE");
    await expect(rigaPersona(page, disattivato.email)).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "Filtra per ruolo" })
      .selectOption("AMMINISTRATORE");
    await expect(rigaPersona(page, disattivato.email)).toBeVisible();
    await apriPersone(page);
    await expect(stato).toHaveValue("attivi");
  });

  test("crea un collaboratore, valida i dati e conserva i valori dopo un errore", async ({
    page,
    factory,
  }) => {
    await apriPersone(page);
    await page
      .getByRole("link", { name: "Nuova persona", exact: true })
      .click();
    await attendiSchedaPersona(page);
    const nome = `${factory.namespace} Nuova`;
    const email = `${factory.namespace}-nuova@e2e.invalid`;
    await page.getByLabel(/^Nome\b/).fill(nome);
    await page.getByLabel(/^Cognome\b/).fill("Persona");
    await page.getByLabel(/^Email di accesso\b/).fill(email);
    await page.getByLabel(/^Partita IVA\b/).fill("123");
    await page
      .getByRole("button", { name: "Crea persona", exact: true })
      .click();
    await expect(
      page.getByText("La partita IVA deve essere di 11 cifre", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(/^Nome\b/)).toHaveValue(nome);
    await expect(page.getByLabel(/^Email di accesso\b/)).toHaveValue(email);
    await page.getByLabel(/^Partita IVA\b/).fill("01234567890");
    await page
      .getByRole("tab", { name: "Attività e compensi", exact: true })
      .click();
    await page.getByLabel(/^Importo tariffa\b/).fill("420");
    await page
      .getByRole("button", { name: "Crea persona", exact: true })
      .click();
    await page.waitForURL("**/anagrafiche/persone?esito=creato");
    await expect(rigaPersona(page, email)).toBeVisible();
    await rigaPersona(page, email)
      .getByRole("link", { name: `${nome} Persona`, exact: true })
      .click();
    await attendiSchedaPersona(page);
    await expect(page.getByLabel(/^Partita IVA\b/)).toHaveValue("01234567890");
    await page
      .getByRole("tab", { name: "Attività e compensi", exact: true })
      .click();
    await expect(page.getByTestId("tariffa-attuale")).toContainText(/420,00/);
    await expect(
      page.getByRole("table", { name: "Storico tariffe" }),
    ).toBeVisible();
  });

  test("i due pulsanti di ruolo gestiscono l'amministratore e la collaborazione facoltativa", async ({
    page,
    factory,
  }) => {
    const persona = await factory.createUtente({
      ruolo: "AMMINISTRATORE",
      nome: factory.namespace,
    });
    await apriPersona(page, persona.id, "accesso");
    await expect(
      page.getByRole("button", { name: /^Amministratore/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("checkbox", {
        name: "Registra anche attività come collaboratore",
        exact: true,
      })
      .check();
    await page.getByRole("tab", { name: "Anagrafica", exact: true }).click();
    await page.getByLabel(/^Partita IVA\b/).fill("12345678901");
    await page
      .getByRole("tab", { name: "Attività e compensi", exact: true })
      .click();
    await page.getByLabel(/^Importo tariffa\b/).fill("470");
    await salvaPersona(page);
    await expect(page.getByTestId("tariffa-attuale")).toContainText(/470,00/);
    await page
      .getByRole("tab", { name: "Accesso e permessi", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", {
        name: "Registra anche attività come collaboratore",
        exact: true,
      }),
    ).toBeChecked();
    await page
      .getByRole("checkbox", {
        name: "Registra anche attività come collaboratore",
        exact: true,
      })
      .uncheck();
    await salvaPersona(page);
    await page
      .getByRole("tab", { name: "Attività e compensi", exact: true })
      .click();
    await expect(page.getByTestId("tariffa-attuale")).toContainText(/470,00/);
    await page
      .getByRole("tab", { name: "Accesso e permessi", exact: true })
      .click();
    await page
      .getByRole("checkbox", {
        name: "Registra anche attività come collaboratore",
        exact: true,
      })
      .check();
    await salvaPersona(page);
    await page.getByRole("button", { name: /^Collaboratore/ }).click();
    await expect(
      page.getByRole("button", { name: /^Collaboratore/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("checkbox", {
        name: "Registra anche attività come collaboratore",
        exact: true,
      }),
    ).toHaveCount(0);
    await salvaPersona(page);
    await page
      .getByRole("tab", { name: "Attività e compensi", exact: true })
      .click();
    await expect(page.getByTestId("tariffa-attuale")).toContainText(/470,00/);
  });

  test("crea un amministratore senza dati professionali", async ({
    page,
    factory,
  }) => {
    await page.goto("/anagrafiche/persone/nuovo");
    await attendiSchedaPersona(page);
    await page
      .getByRole("tab", { name: "Accesso e permessi", exact: true })
      .click();
    await page.getByRole("button", { name: /^Amministratore/ }).click();
    await expect(
      page.getByRole("checkbox", {
        name: "Registra anche attività come collaboratore",
        exact: true,
      }),
    ).not.toBeChecked();
    await page.getByRole("tab", { name: "Anagrafica", exact: true }).click();
    await expect(page.getByLabel(/^Partita IVA\b/)).toHaveCount(0);
    await page.getByLabel(/^Nome\b/).fill(factory.namespace);
    await page.getByLabel(/^Cognome\b/).fill("Amministratore");
    const email = `${factory.namespace}-admin@e2e.invalid`;
    await page.getByLabel(/^Email di accesso\b/).fill(email);
    await page
      .getByRole("button", { name: "Crea persona", exact: true })
      .click();
    await page.waitForURL("**/anagrafiche/persone?esito=creato");
    await expect(
      rigaPersona(page, email).getByText("Amministratore", { exact: true }),
    ).toBeVisible();
    await expect(
      rigaPersona(page, email).getByText("Collaboratore", { exact: true }),
    ).toHaveCount(0);
  });

  test("disattiva e riattiva dalla scheda preservando partita IVA e tariffe", async ({
    page,
    collaboratore,
  }) => {
    const { utente } = collaboratore;
    await apriPersona(page, utente.id, "accesso");
    await page
      .getByRole("checkbox", { name: "Accesso attivo", exact: true })
      .uncheck();
    await salvaPersona(page);
    await apriPersone(page);
    await page
      .getByRole("searchbox", { name: "Cerca persona" })
      .fill(utente.email);
    await expect(rigaPersona(page, utente.email)).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "Filtra per stato" })
      .selectOption("disattivati");
    await expect(rigaPersona(page, utente.email)).toBeVisible();
    await rigaPersona(page, utente.email)
      .getByRole("link", {
        name: `${utente.nome} ${utente.cognome}`,
        exact: true,
      })
      .click();
    await attendiSchedaPersona(page);
    await expect(page.getByLabel(/^Partita IVA\b/)).toHaveValue(
      collaboratore.collaboratore.partitaIva!,
    );
    await page
      .getByRole("tab", { name: "Accesso e permessi", exact: true })
      .click();
    await page
      .getByRole("checkbox", { name: "Accesso attivo", exact: true })
      .check();
    await salvaPersona(page);
    await page
      .getByRole("tab", { name: "Attività e compensi", exact: true })
      .click();
    await expect(
      page.getByRole("table", { name: "Storico tariffe" }).getByRole("row"),
    ).toHaveCount(2);
    await apriPersone(page);
    await expect(rigaPersona(page, utente.email)).toBeVisible();
  });

  test("le azioni multiple operano sulle righe filtrate e mostrano i disattivati dopo la conferma", async ({
    page,
    factory,
  }) => {
    const a = await factory.createUtente({
      ruolo: "AMMINISTRATORE",
      nome: factory.namespace,
    });
    const b = await factory.createUtente({
      ruolo: "AMMINISTRATORE",
      nome: factory.namespace,
    });
    await apriPersone(page);
    await page
      .getByRole("searchbox", { name: "Cerca persona" })
      .fill(factory.namespace);
    await selezionaRighe(page, [
      rigaPersona(page, a.email).getByRole("checkbox"),
      rigaPersona(page, b.email).getByRole("checkbox"),
    ]);
    await barraSelezione(page)
      .getByRole("button", { name: /^Disattiva/ })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Disattiva", exact: true })
      .click();
    await page.waitForURL(
      (url) => url.searchParams.get("esito") === "disattivato",
    );
    await expect(
      page.getByRole("combobox", { name: "Filtra per stato" }),
    ).toHaveValue("disattivati");
    await expect(rigaPersona(page, a.email)).toBeVisible();
    await expect(rigaPersona(page, b.email)).toBeVisible();
  });

  test("espone il rifiuto di disattivazione dell'ultimo amministratore", async ({
    page,
  }) => {
    await page.goto("/anagrafiche/persone?errore=ultimo-amministratore");
    await expect(
      page.getByRole("alert").filter({ hasText: "Operazione non consentita" }),
    ).toContainText(
      "Operazione non consentita: è l'ultimo amministratore attivo del sistema",
    );
  });
});
