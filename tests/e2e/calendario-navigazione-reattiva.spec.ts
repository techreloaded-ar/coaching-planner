import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, mesePassatoRiservato, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * US-050: Cambio mese reattivo nel calendario con indicatore di caricamento
 *
 * Verifica che il click sui controlli di navigazione mese produca riscontro
 * visivo immediato (indicatore di caricamento sull'area calendario) mentre la
 * risposta del server è ancora in volo, che l'indicatore scompaia quando le
 * celle del nuovo mese sono valorizzate, che il contratto URL `?mese=YYYY-MM`
 * resti condivisibile e che contenuto delle celle e apertura del giorno siano
 * invariati.
 *
 * La "rete lenta" non è un hard wait: la risposta del mese di destinazione è
 * trattenuta da una route registrata prima del `goto` e sbloccata da una
 * promessa dopo che le asserzioni sull'indicatore sono passate.
 *
 * Da US-052 il mese di destinazione non arriva più da una navigazione RSC verso
 * `/attivita`, ma dalla GET `/api/attivita/calendario` letta dalla cache client:
 * il gate trattiene quella richiesta. Il prefetch del mese adiacente parte al
 * mount, quindi al click la lettura è già in volo e viene deduplicata: in
 * entrambi i casi il click trova un caricamento pendente.
 */

function dataDb(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00.000Z`);
}

test.describe("US-050 Navigazione mese reattiva", () => {
  test("l'indicatore è visibile durante il caricamento e le celle del nuovo mese sono valorizzate al termine", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mesePartenza = meseRiservato("US-050");
    const meseArrivo = mesePassatoRiservato("US-050", 1);
    const data = dataNelMese(meseArrivo, 12);

    const clienteConOfferta = await factory.createClienteConOfferta();
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(data),
      ore: "3.00",
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    // Gate deterministico: trattiene ogni lettura dati del mese di arrivo.
    // Va registrato PRIMA del goto perché la richiesta parte già al mount come
    // prefetch del mese adiacente; il click sul controllo mese riusa la stessa
    // lettura in volo. Il caricamento di `mesePartenza` non è toccato.
    let sblocca: (() => void) | undefined;
    const attesa = new Promise<void>((resolve) => {
      sblocca = resolve;
    });
    const richiestaMeseArrivo = (url: URL) =>
      (url.pathname === "/attivita" ||
        url.pathname === "/api/attivita/calendario") &&
      url.searchParams.get("mese") === meseArrivo;

    await page.route(richiestaMeseArrivo, async (route) => {
      await attesa;
      await route.continue();
    });

    await page.goto(`/attivita?mese=${mesePartenza}`);
    const calendario = page.getByLabel("Calendario mensile delle attività");
    await expect(calendario).toBeVisible();
    // Prima dell'idratazione il click sui controlli mese sarebbe un no-op.
    await expect(calendario).toHaveAttribute("data-idratata", "true");

    await page.getByLabel("Mese precedente").click();

    // AC-1 / AC-2: con la risposta ancora trattenuta il click ha già prodotto
    // riscontro visivo sull'area calendario.
    await expect(page.getByTestId("indicatore-caricamento-mese")).toBeVisible();
    await expect(calendario).toHaveAttribute("aria-busy", "true");

    sblocca!();

    // AC-2 / AC-4: celle del nuovo mese valorizzate, indicatore scomparso.
    const cella = page.locator(`a[href="/attivita/${data}?mese=${meseArrivo}"]`);
    await expect(cella).toHaveAttribute("data-con-attivita", "true");
    await expect(cella.getByTestId("etichetta-cliente")).toHaveText(
      `${clienteConOfferta.cliente.ragioneSociale} 3.0 h`,
    );
    await expect(page.getByTestId("indicatore-caricamento-mese")).toBeHidden();
    await expect(calendario).toHaveAttribute("aria-busy", "false");

    // AC-3: il mese visualizzato resta nel contratto URL.
    await expect(page).toHaveURL(new RegExp(`mese=${meseArrivo}`));

    await page.unroute(richiestaMeseArrivo);

    // AC-4: l'apertura del giorno dalla cella è invariata.
    await cella.click();
    await expect(page).toHaveURL(new RegExp(`/attivita/${data}`));
  });

  test("l'apertura diretta dell'URL con token mese mostra il mese richiesto", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const meseArrivo = mesePassatoRiservato("US-050", 1);
    const data = dataNelMese(meseArrivo, 20);

    const clienteConOfferta = await factory.createClienteConOfferta();
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(data),
      ore: "3.00",
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita?mese=${meseArrivo}`);

    await expect(
      page.getByLabel("Calendario mensile delle attività"),
    ).toBeVisible();

    // AC-3: l'indirizzo condiviso apre direttamente il mese richiesto, valorizzato.
    const cella = page.locator(`a[href="/attivita/${data}?mese=${meseArrivo}"]`);
    await expect(cella).toHaveAttribute("data-con-attivita", "true");
    await expect(cella.getByTestId("etichetta-cliente")).toHaveText(
      `${clienteConOfferta.cliente.ragioneSociale} 3.0 h`,
    );
  });
});
