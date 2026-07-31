import { randomUUID } from "node:crypto";

import { accediComeCollaboratore } from "./support/auth";
import { dataNelMeseRiservato, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * US-053: Cambio rapido del giorno dal dettaglio attività
 *
 * Verifica che il selettore data porti a un giorno di un mese diverso
 * aggiornando URL e contenuto (AC-1), che i pulsanti "Giorno precedente"/
 * "Giorno successivo" spostino la vista di un giorno alla volta attraversando
 * i confini di mese (AC-2), che una riga aggiunta dopo il cambio giorno si
 * registri sul giorno visualizzato ed è verificabile anche nel calendario
 * mensile (AC-3), e che l'URL del giorno sopravviva a un reload (AC-4).
 */

function dataDb(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00.000Z`);
}

function etichettaGiornoAttesa(dataIso: string): string {
  const [anno, mese, giorno] = dataIso.split("-").map(Number);
  const data = new Date(anno, mese - 1, giorno);
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(data);
}

/** Ultimo giorno del mese precedente a `tokenMese` (YYYY-MM), formato YYYY-MM-DD */
function ultimoGiornoMesePrecedente(tokenMese: string): string {
  const [anno, mese] = tokenMese.split("-").map(Number);
  const ultimo = new Date(anno, mese - 1, 0); // giorno 0 = ultimo del mese precedente
  const a = ultimo.getFullYear();
  const m = String(ultimo.getMonth() + 1).padStart(2, "0");
  const g = String(ultimo.getDate()).padStart(2, "0");
  return `${a}-${m}-${g}`;
}

test.describe("US-053 Cambio rapido del giorno dal dettaglio attività", () => {
  test("il selettore data cambia giorno anche su un mese diverso e la nuova riga si registra sul giorno visualizzato, visibile anche nel calendario", async ({
    page,
    factory,
    collaboratore,
    clienteConOfferta,
  }) => {
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    const dataPartenza = dataNelMeseRiservato("US-053", 5);
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(dataPartenza),
      nota: "Riga di partenza US-053",
    });

    const dataArrivo = dataNelMeseRiservato("US-053-arrivo", 12);

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${dataPartenza}`);
    await page.waitForURL(`**/attivita/${dataPartenza}`);

    // AC-1: il selettore data porta a un giorno di un mese diverso.
    await page.getByTestId("selettore-giorno").fill(dataArrivo);
    await page.waitForURL(`**/attivita/${dataArrivo}**`);
    await expect(
      page.locator("main").getByRole("heading", { level: 1 }),
    ).toHaveText(etichettaGiornoAttesa(dataArrivo), { ignoreCase: true });
    await expect(
      page.getByText("Nessuna attività registrata per questa giornata."),
    ).toBeVisible();

    // AC-3 (prima parte): una riga aggiunta dopo il cambio giorno si registra
    // sul giorno attualmente visualizzato.
    const notaUnivoca = `US-053 riga arrivo ${randomUUID()}`;
    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");
    await selectCliente.selectOption(clienteConOfferta.cliente.id);
    await expect(selectOfferta).toBeEnabled();
    await expect
      .poll(async () => selectOfferta.locator("option").count())
      .toBeGreaterThan(1);
    await selectOfferta.selectOption(clienteConOfferta.offerta.id);
    await page.locator("#ore").fill("4");
    await page.locator("#nota").fill(notaUnivoca);
    await page.getByRole("button", { name: "Aggiungi riga" }).click();

    const rigaCreata = page
      .getByTestId("activity-row")
      .filter({ has: page.getByText(notaUnivoca, { exact: true }) });
    await expect(rigaCreata).toBeVisible();

    // AC-3 (seconda parte): la riga è visibile nella cella del calendario
    // corrispondente al giorno di arrivo, non a quello di partenza.
    const tokenArrivo = dataArrivo.slice(0, 7);
    await page.goto(`/attivita?mese=${tokenArrivo}`);
    const cella = page.locator(`a[href="/attivita/${dataArrivo}?mese=${tokenArrivo}"]`);
    await expect(cella).toHaveAttribute("data-con-attivita", "true");
    await expect(cella.getByTestId("etichetta-cliente")).toContainText(
      clienteConOfferta.cliente.ragioneSociale,
    );

    // AC-4: un reload dopo il cambio giorno riapre lo stesso giorno.
    await page.goto(`/attivita/${dataArrivo}`);
    await page.waitForURL(`**/attivita/${dataArrivo}`);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/attivita/${dataArrivo}$`));
    await expect(
      page.locator("main").getByRole("heading", { level: 1 }),
    ).toHaveText(
      etichettaGiornoAttesa(dataArrivo),
      { ignoreCase: true },
    );
    await expect(rigaCreata).toBeVisible();
  });

  test("i pulsanti giorno precedente e successivo spostano di un giorno alla volta attraversando i confini di mese", async ({
    page,
    collaboratore,
  }) => {
    const tokenRiservato = meseRiservato("US-053-confine");
    const primoGiorno = `${tokenRiservato}-01`;
    const ultimoGiornoPrecedente = ultimoGiornoMesePrecedente(tokenRiservato);

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${primoGiorno}`);
    await page.waitForURL(`**/attivita/${primoGiorno}`);

    await page.getByRole("button", { name: "Giorno precedente" }).click();
    await page.waitForURL(`**/attivita/${ultimoGiornoPrecedente}`);
    await expect(
      page.locator("main").getByRole("heading", { level: 1 }),
    ).toHaveText(
      etichettaGiornoAttesa(ultimoGiornoPrecedente),
      { ignoreCase: true },
    );

    await page.getByRole("button", { name: "Giorno successivo" }).click();
    await page.waitForURL(`**/attivita/${primoGiorno}`);
    await expect(
      page.locator("main").getByRole("heading", { level: 1 }),
    ).toHaveText(
      etichettaGiornoAttesa(primoGiorno),
      { ignoreCase: true },
    );
  });
});
