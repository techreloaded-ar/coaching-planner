import { randomUUID } from "node:crypto";

import { expect, test } from "./support/fixtures";
import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { attendiTabellaOfferteIdratata } from "./support/offerte";

test.describe("Demo US-032 — dettaglio avanzamento nelle Offerte", () => {
  test("l'amministratore espande un'offerta e monitora avanzamento e collaboratori", async ({
    page,
    factory,
  }) => {
    const codice = `DEMO-DET-${randomUUID().slice(0, 8)}`.toUpperCase();
    const { cliente, offerta } = await factory.createClienteConOfferta(
      { ragioneSociale: `Demo dettaglio ${codice}` },
      { codice, giorniPrevisti: 10 },
    );
    const collaboratore = await factory.createCollaboratore({
      nome: "Ada",
      cognome: "Lovelace",
    });
    await factory.createRigaAttivita({
      cliente,
      offerta,
      collaboratore,
      ore: "16.00",
      fatturabile: true,
    });

    // 1. L'amministratore apre l'elenco delle offerte.
    await accediAlBackOfficeComeAdmin(page);
    await expect(page.getByRole("banner")).toBeVisible();
    await page
      .getByRole("navigation", { name: "Navigazione principale" })
      .getByRole("link", { name: "Offerte", exact: true })
      .click();
    await attendiTabellaOfferteIdratata(page);

    // 2. Apre il dettaglio dell'offerta appena creata.
    const riga = page.getByRole("row", { name: new RegExp(codice) });
    await expect(riga).toBeVisible();
    await riga.getByText(codice, { exact: true }).click();

    // 3. Legge il monitoraggio e la ripartizione per collaboratore.
    const dettaglio = page.getByRole("region", {
      name: `Dettaglio avanzamento ${codice}`,
    });
    await expect(dettaglio).toBeVisible();
    await expect(dettaglio.getByText("In corso", { exact: true })).toBeVisible();
    await expect(dettaglio.getByText("20%", { exact: true })).toBeVisible();
    await expect(dettaglio.getByText("Previste", { exact: true }).locator("..")).toContainText(/10\s*gg/);
    await expect(dettaglio.getByText("Erogate", { exact: true }).locator("..")).toContainText(/2\s*gg/);
    await expect(dettaglio.getByRole("row", { name: /Ada Lovelace/ })).toContainText("16 h");

    // 4. Richiude il pannello e ritrova la tabella compatta.
    await riga.getByText(codice, { exact: true }).click();
    await expect(dettaglio).toHaveCount(0);
  });
});
