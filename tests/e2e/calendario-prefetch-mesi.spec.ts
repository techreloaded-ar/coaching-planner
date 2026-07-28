import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, mesePassatoRiservato, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * US-050: Prefetch dei mesi adiacenti nel calendario attività
 *
 * L'oracolo è di rete, non di tempo: si attende l'evento reale della risposta
 * di prefetch, si clicca "Mese precedente" e si verifica che il mese compaia
 * valorizzato senza che sia partita alcuna nuova richiesta per quel mese —
 * il payload proviene dalla cache client. Nessuna asserzione sui millisecondi,
 * che sarebbe flaky per costruzione.
 *
 * Il prefetching di Next è attivo solo con il server di produzione, quindi lo
 * spec si auto-esclude con motivazione quando il web server e2e è `next dev`.
 * In CI (`PLAYWRIGHT_WEB_SERVER_COMMAND="npm run start"`) gira sempre.
 */

function dataDb(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00.000Z`);
}

test.describe("US-050 Prefetch mesi adiacenti", () => {
  test("il cambio mese è servito dalla cache prefetchata senza nuove richieste di rete", async ({
    page,
    collaboratore,
    factory,
  }) => {
    test.skip(
      !(process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? "").includes("start"),
      "Il prefetching di Next è attivo solo con il server di produzione",
    );

    const mesePartenza = meseRiservato("US-050");
    const meseArrivo = mesePassatoRiservato("US-050", 1);
    const data = dataNelMese(meseArrivo, 15);

    const clienteConOfferta = await factory.createClienteConOfferta();
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(data),
      ore: "2.00",
    });

    // Contatore registrato prima del goto: intercetta anche il prefetch al mount.
    const richiesteMeseArrivo: string[] = [];
    page.on("request", (richiesta) => {
      if (richiesta.url().includes(`mese=${meseArrivo}`)) {
        richiesteMeseArrivo.push(richiesta.url());
      }
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita?mese=${mesePartenza}`);
    await expect(
      page.getByLabel("Calendario mensile delle attività"),
    ).toBeVisible();

    // Attesa event-driven del prefetch reale: nessun hard wait.
    await page.waitForResponse(
      (risposta) =>
        risposta.url().includes(`mese=${meseArrivo}`) && risposta.ok(),
    );
    const richiesteDopoPrefetch = richiesteMeseArrivo.length;
    expect(richiesteDopoPrefetch).toBeGreaterThan(0);

    await page.getByLabel("Mese precedente").click();

    const cella = page.locator(`a[href="/attivita/${data}?mese=${meseArrivo}"]`);
    await expect(cella).toHaveAttribute("data-con-attivita", "true");
    await expect(cella.getByText("2.0 h", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`mese=${meseArrivo}`));

    // AC-1: il mese è arrivato dalla cache client, non da un nuovo round-trip.
    expect(richiesteMeseArrivo.length).toBe(richiesteDopoPrefetch);
  });
});
