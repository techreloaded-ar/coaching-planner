import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { attendiSchedaPersona, salvaPersona } from "./support/persone";
import { test, expect } from "./support/fixtures";

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test("demo__anagrafica unificata delle persone", async ({
  page,
  collaboratore,
}) => {
  await accediAlBackOfficeComeAdmin(page);
  await page.getByRole("link", { name: "Persone", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Filtra per stato" }),
  ).toHaveValue("attivi");
  const nome = `${collaboratore.utente.nome} ${collaboratore.utente.cognome}`;
  await page.getByRole("link", { name: nome, exact: true }).click();
  await attendiSchedaPersona(page);
  await expect(page.getByLabel(/^Email di accesso\b/)).toBeEditable();
  await page.getByLabel(/^Partita IVA\b/).fill("61061061061");
  await salvaPersona(page);
  await expect(page.getByLabel(/^Partita IVA\b/)).toHaveValue("61061061061");
  await page
    .getByRole("tab", { name: "Attività e compensi", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "Storico tariffe" }),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "Accesso e permessi", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Collaboratore/ }),
  ).toHaveAttribute("aria-pressed", "true");
});
