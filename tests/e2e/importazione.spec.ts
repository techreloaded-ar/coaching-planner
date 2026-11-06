import { test, expect } from "./support/fixtures";
import { accediAlBackOfficeComeAdmin, accediComeCollaboratore } from "./support/auth";

test("l'amministratore trova l'importazione e le righe sospese precedenti", async ({ page }) => {
  await accediAlBackOfficeComeAdmin(page);
  await page.getByRole("link", { name: "Importazione", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Importazione", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Origine importazione" })).toBeVisible();
  // Il setup CI non contiene credenziali: la pagina resta utilizzabile e spiega cosa manca.
  await expect(page.getByRole("button", { name: "Analizza foglio", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Righe sospese", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Righe sospese", exact: true })).toBeVisible();
});

test("il collaboratore non accede all'importer", async ({ page, collaboratore }) => {
  await accediComeCollaboratore(page, collaboratore.utente.email);
  await page.goto("/importazione");
  await expect(page).toHaveURL(/\/attivita(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Importazione", exact: true })).toHaveCount(0);
});
