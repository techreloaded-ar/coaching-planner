import { randomUUID } from "node:crypto";

import { accediComeCollaboratore } from "./support/auth";
import { dataNelMeseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Demo scenario — US-053: Cambio rapido del giorno dal dettaglio attività
 *
 * Il revisore parte dal dettaglio di un giorno con una riga già registrata,
 * usa il selettore data per saltare a un giorno di un mese diverso (URL e
 * righe si aggiornano), preme «Giorno precedente» e «Giorno successivo»
 * osservando lo spostamento di un giorno alla volta, e infine aggiunge una
 * riga dopo il cambio data verificando che venga registrata sul giorno
 * visualizzato — anche nella cella corrispondente del calendario mensile.
 */

function etichettaGiornoAttesa(dataIso: string): string {
  const [anno, mese, giorno] = dataIso.split("-").map(Number);
  const data = new Date(anno, mese - 1, giorno);
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(data);
}

test.describe("US-053 Demo", () => {
  test("demo cambio rapido del giorno dal dettaglio attività", async ({
    page,
    factory,
    collaboratore,
    clienteConOfferta,
  }) => {
    test.setTimeout(60_000);

    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    const dataPartenza = dataNelMeseRiservato("US-053-demo", 5);
    const dataArrivo = dataNelMeseRiservato("US-053-demo-arrivo", 12);

    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: new Date(`${dataPartenza}T00:00:00.000Z`),
      nota: "Riga di partenza demo US-053",
    });

    // ── 1. Il revisore apre il dettaglio del giorno di partenza ──────
    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${dataPartenza}`);
    await page.waitForURL(`**/attivita/${dataPartenza}`);
    await expect(
      page.locator("main").getByRole("heading", { level: 1 }),
    ).toHaveText(etichettaGiornoAttesa(dataPartenza), { ignoreCase: true });
    await expect(
      page.getByText("Riga di partenza demo US-053", { exact: true }),
    ).toBeVisible();

    // ── 2. Il selettore data porta a un giorno di un mese diverso ────
    await page.getByTestId("selettore-giorno").fill(dataArrivo);
    await page.waitForURL(`**/attivita/${dataArrivo}**`);
    await expect(
      page.locator("main").getByRole("heading", { level: 1 }),
    ).toHaveText(etichettaGiornoAttesa(dataArrivo), { ignoreCase: true });
    await expect(
      page.getByText("Nessuna attività registrata per questa giornata."),
    ).toBeVisible();

    // ── 3. «Giorno precedente» e «Giorno successivo» spostano di un giorno ──
    await page.getByRole("button", { name: "Giorno precedente" }).click();
    const dataPrecedenteArrivo = new Date(`${dataArrivo}T00:00:00.000Z`);
    dataPrecedenteArrivo.setUTCDate(dataPrecedenteArrivo.getUTCDate() - 1);
    const dataPrecedenteArrivoIso = dataPrecedenteArrivo
      .toISOString()
      .slice(0, 10);
    await page.waitForURL(`**/attivita/${dataPrecedenteArrivoIso}`);
    await expect(
      page.locator("main").getByRole("heading", { level: 1 }),
    ).toHaveText(etichettaGiornoAttesa(dataPrecedenteArrivoIso), {
      ignoreCase: true,
    });

    await page.getByRole("button", { name: "Giorno successivo" }).click();
    await page.waitForURL(`**/attivita/${dataArrivo}`);
    await expect(
      page.locator("main").getByRole("heading", { level: 1 }),
    ).toHaveText(etichettaGiornoAttesa(dataArrivo), { ignoreCase: true });

    // ── 4. Una riga aggiunta dopo il cambio si registra sul giorno mostrato ──
    const notaUnivoca = `Demo US-053 riga arrivo ${randomUUID().slice(0, 8)}`;
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

    // ── 5. La riga si vede anche nella cella calendario del giorno arrivo ──
    const tokenArrivo = dataArrivo.slice(0, 7);
    await page.goto(`/attivita?mese=${tokenArrivo}`);
    const cella = page.locator(
      `a[href="/attivita/${dataArrivo}?mese=${tokenArrivo}"]`,
    );
    await expect(cella).toHaveAttribute("data-con-attivita", "true");
    await expect(cella.getByTestId("etichetta-cliente")).toContainText(
      clienteConOfferta.cliente.ragioneSociale,
    );
  });
});
