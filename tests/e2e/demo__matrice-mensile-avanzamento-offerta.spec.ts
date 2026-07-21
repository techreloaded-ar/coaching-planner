import { randomUUID } from "node:crypto";

import { expect, test } from "./support/fixtures";
import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { dataNelMese, mesePassatoRiservato, meseRiservato } from "./support/date";
import { apriPaginaOfferte } from "./support/offerte";

const mesePrecedente = mesePassatoRiservato("US-036");
const meseRiferimento = meseRiservato("US-036");

function dataNelMeseUtc(meseToken: string, giorno: number): Date {
  return new Date(`${dataNelMese(meseToken, giorno)}T00:00:00.000Z`);
}

test.describe("Demo US-036 — matrice mensile per collaboratore nel dettaglio avanzamento offerta", () => {
  test("il revisore osserva la matrice mensile con i totali e, per un'offerta vuota, il messaggio di assenza attività", async ({
    page,
    factory,
  }) => {
    const codiceConAttivita = `DEMO-MATRICE-${randomUUID().slice(0, 8)}`.toUpperCase();
    const { cliente, offerta } = await factory.createClienteConOfferta(
      { ragioneSociale: `Demo matrice ${codiceConAttivita}` },
      { codice: codiceConAttivita, giorniPrevisti: 10 },
    );
    const ada = await factory.createCollaboratore({
      nome: "Ada",
      cognome: "Lovelace",
    });
    const alan = await factory.createCollaboratore({
      nome: "Alan",
      cognome: "Turing",
    });
    await factory.createRigaAttivita({
      cliente,
      offerta,
      collaboratore: ada,
      data: dataNelMeseUtc(mesePrecedente, 10),
      ore: "8.00",
      fatturabile: true,
    });
    await factory.createRigaAttivita({
      cliente,
      offerta,
      collaboratore: alan,
      data: dataNelMeseUtc(meseRiferimento, 12),
      ore: "16.00",
      fatturabile: true,
    });

    const codiceSenzaAttivita = `DEMO-MATRICE-VUOTA-${randomUUID().slice(0, 8)}`.toUpperCase();
    await factory.createClienteConOfferta(
      { ragioneSociale: `Demo matrice vuota ${codiceSenzaAttivita}` },
      { codice: codiceSenzaAttivita, giorniPrevisti: 5 },
    );

    // 1. L'amministratore apre l'elenco delle offerte.
    await accediAlBackOfficeComeAdmin(page);
    await expect(page.getByRole("banner")).toBeVisible();
    await apriPaginaOfferte(page);

    // 2. Espande l'offerta con attività di due collaboratori su due mesi.
    const rigaConAttivita = page.getByRole("row", { name: new RegExp(codiceConAttivita) });
    await expect(rigaConAttivita).toBeVisible();
    await rigaConAttivita.getByText(codiceConAttivita, { exact: true }).click();

    // 3. Legge la matrice: una riga per collaboratore, una colonna per mese,
    // colonna Totale e riga Totale mese coerenti con le giornate erogate.
    const dettaglioConAttivita = page.getByRole("region", {
      name: `Dettaglio avanzamento ${codiceConAttivita}`,
    });
    await expect(dettaglioConAttivita).toBeVisible();

    const matrice = dettaglioConAttivita.getByRole("table", {
      name: "Giornate erogate per collaboratore e mese",
    });
    await expect(matrice).toBeVisible();
    await expect(matrice.getByRole("row", { name: /Ada Lovelace/ })).toContainText("1");
    await expect(matrice.getByRole("row", { name: /Alan Turing/ })).toContainText("2");
    await expect(matrice.getByRole("row", { name: "Totale mese" })).toBeVisible();
    await expect(
      dettaglioConAttivita.getByText("Erogate", { exact: true }).locator(".."),
    ).toContainText(/3\s*gg/);

    // 4. Espande un'offerta senza attività e osserva il messaggio di assenza.
    const rigaSenzaAttivita = page.getByRole("row", { name: new RegExp(codiceSenzaAttivita) });
    await expect(rigaSenzaAttivita).toBeVisible();
    await rigaSenzaAttivita.getByText(codiceSenzaAttivita, { exact: true }).click();

    const dettaglioSenzaAttivita = page.getByRole("region", {
      name: `Dettaglio avanzamento ${codiceSenzaAttivita}`,
    });
    await expect(dettaglioSenzaAttivita).toBeVisible();
    await expect(
      dettaglioSenzaAttivita.getByText("Nessuna attività registrata", { exact: true }),
    ).toBeVisible();
  });
});
