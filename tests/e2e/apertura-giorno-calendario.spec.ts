import {
  selezionaClienteEOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * US-031: Apertura di qualsiasi giorno dal calendario per registrare attività
 *
 * Verifica che ogni cella della griglia del calendario mensile sia un link
 * alla pagina di dettaglio del proprio giorno, con o senza attività,
 * dentro o fuori mese.
 */

test.describe("US-031 Apertura di qualsiasi giorno dal calendario", () => {
  test("un giorno senza attività si apre e consente l'inserimento", async ({
    page,
    factory,
    collaboratore,
    clienteConOfferta,
  }) => {
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    const mese = meseRiservato("US-031");
    await page.goto(`/attivita?mese=${mese}`);
    await expect(
      page.getByLabel("Calendario mensile delle attività"),
    ).toBeVisible();

    const dataVuota = dataNelMese(mese, 10);
    const cella = page.locator(
      `a[href="/attivita/${dataVuota}?mese=${mese}"]`,
    );

    // AC-4: la cella è un link con attributi corretti e cursor pointer
    await expect(cella).toHaveAttribute("data-con-attivita", "false");
    await expect(cella).toHaveCSS("cursor", "pointer");

    // AC-1: click su giorno vuoto → pagina del giorno con form visibile
    await cella.click();
    await page.waitForURL(`**/attivita/${dataVuota}**`);

    await expect(
      page.getByText("Nessuna attività registrata per questa giornata."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Aggiungi riga" }),
    ).toBeVisible();

    // AC-2: inserisci una riga con cliente/offerta factory
    await selezionaClienteEOffertaTest(page, clienteConOfferta);
    await page.locator("#ore").fill("3");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();

    // Attendi la card della riga con il codice dell'offerta factory
    await expect(
      page.getByText(clienteConOfferta.offerta.codice, { exact: true }),
    ).toBeVisible();

    // Torna al calendario: la cella ora ha data-con-attivita="true" e mostra la sintesi
    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL(`**/attivita?mese=${mese}**`);

    await expect(cella).toHaveAttribute("data-con-attivita", "true");
    await expect(cella).toContainText("3.0 h");

    // AC-2 (continuazione): ri-click sulla cella → dettaglio con la card della riga
    await cella.click();
    await page.waitForURL(`**/attivita/${dataVuota}**`);

    await expect(
      page.getByText(clienteConOfferta.offerta.codice, { exact: true }),
    ).toBeVisible();
  });

  test("un giorno fuori mese apre il giorno del mese adiacente", async ({
    page,
    collaboratore,
  }) => {
    await accediComeCollaboratore(page, collaboratore.utente.email);

    const mese = meseRiservato("US-031");
    await page.goto(`/attivita?mese=${mese}`);
    await expect(
      page.getByLabel("Calendario mensile delle attività"),
    ).toBeVisible();

    // AC-3: individua la prima cella fuori mese
    let celleFuori = page.locator('a[data-fuori-mese="true"]');

    // Guardia per febbraio di 28 giorni che inizia di lunedì
    if ((await celleFuori.count()) === 0) {
      await page.getByLabel("Mese successivo").click();
      await page.waitForURL(/\?mese=/);
      celleFuori = page.locator('a[data-fuori-mese="true"]');
    }

    const href = await celleFuori.first().getAttribute("href");
    expect(href).toBeTruthy();
    const match = href!.match(
      /^\/attivita\/(\d{4}-\d{2}-\d{2})\?mese=(\d{4}-\d{2})$/,
    );
    expect(match).toBeTruthy();

    const [, dataCella, tokenCellaUrl] = match!;

    // Il token nell'URL corrisponde al mese della data della cella
    expect(tokenCellaUrl).toBe(dataCella.slice(0, 7));
    // E differisce dal mese visualizzato
    expect(tokenCellaUrl).not.toBe(mese);

    // Click sulla cella fuori mese → pagina dettaglio del mese adiacente
    await celleFuori.first().click();
    await page.waitForURL(`**/attivita/${dataCella}**`);

    await expect(
      page.getByRole("heading", { level: 1, name: /\d{1,2} .* \d{4}/ }),
    ).toBeVisible();

    // Torna al calendario → atterra sul mese adiacente
    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL(`**/attivita?mese=${tokenCellaUrl}**`);
  });

  test("la legenda indica che ogni giorno è apribile", async ({
    page,
    collaboratore,
  }) => {
    await accediComeCollaboratore(page, collaboratore.utente.email);

    const mese = meseRiservato("US-031");
    await page.goto(`/attivita?mese=${mese}`);
    await expect(
      page.getByLabel("Calendario mensile delle attività"),
    ).toBeVisible();

    // AC-5: la legenda indica che ogni giorno è cliccabile
    await expect(
      page.getByText(
        "Clicca un giorno qualsiasi per inserire o modificare le righe",
      ),
    ).toBeVisible();
  });
});
