import {
  attendiOfferteCaricate,
  labelOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, mesePassatoRiservato, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";
import type { Page } from "@playwright/test";

/**
 * US-052: cambio mese senza round-trip sul mese già disponibile
 *
 * Oracolo di rete: si contano **e** si abortiscono sia le navigazioni RSC verso
 * la pagina `/attivita` sia le GET verso `/api/attivita/calendario`. Spostare i
 * dati su un endpoint nuovo non può quindi produrre un falso positivo: se il
 * mese comparisse grazie a una richiesta, quella richiesta verrebbe abortita e
 * l'asserzione fallirebbe.
 *
 * Il tempo non viene mai atteso: i mesi trattenuti sono sbloccati da Promise
 * risolte dal test dopo che le asserzioni sullo stato intermedio sono passate.
 */

const CODICE_SPEC = "US-052-cache";

function dataDb(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00.000Z`);
}

/** Le richieste dati del calendario: pagina RSC del mese ed endpoint JSON. */
function eRichiestaDatiCalendario(url: URL): boolean {
  return (
    url.pathname === "/attivita" || url.pathname === "/api/attivita/calendario"
  );
}

/** Promise il cui esito è deciso dal test, non dal tempo. */
function cancelloRilasciabile() {
  let rilascia!: () => void;
  const attesa = new Promise<void>((resolve) => {
    rilascia = resolve;
  });
  return { attesa, rilascia };
}

/**
 * Attende che il calendario sia idratato: prima dell'idratazione un click sui
 * controlli mese è un no-op, perché gli handler client non sono agganciati.
 */
async function attendiCalendarioIdratato(page: Page) {
  const calendario = page.getByLabel("Calendario mensile delle attività");
  await expect(calendario).toBeVisible();
  await expect(calendario).toHaveAttribute("data-idratata", "true");
  return calendario;
}

/** Cella giorno del calendario, individuata dal proprio href. */
function cellaDelGiorno(page: Page, data: string, mese: string) {
  return page.locator(`a[href="/attivita/${data}?mese=${mese}"]`);
}

test.describe("US-052 Cambio mese servito dalla cache dei mesi", () => {
  test("il ritorno su un mese già visitato non produce alcuna richiesta dati", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const meseA = meseRiservato(CODICE_SPEC);
    const meseB = mesePassatoRiservato(CODICE_SPEC, 1);
    const giornoA = dataNelMese(meseA, 7);
    const giornoB = dataNelMese(meseB, 11);

    const clienteA = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US052 Warm A",
    });
    const clienteB = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US052 Warm B",
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteA.cliente,
      offerta: clienteA.offerta,
      data: dataDb(giornoA),
      ore: "4.00",
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteB.cliente,
      offerta: clienteB.offerta,
      data: dataDb(giornoB),
      ore: "6.00",
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    // Il prefetch del mese adiacente è atteso come evento, non come ritardo.
    const prefetchDiB = page.waitForResponse(
      (risposta) =>
        new URL(risposta.url()).pathname === "/api/attivita/calendario" &&
        new URL(risposta.url()).searchParams.get("mese") === meseB,
    );

    await page.goto(`/attivita?mese=${meseA}`);
    await attendiCalendarioIdratato(page);
    await expect(cellaDelGiorno(page, giornoA, meseA)).toHaveAttribute(
      "data-con-attivita",
      "true",
    );
    const etichettaA = await page
      .getByTestId("calendar-month-label")
      .textContent();

    await prefetchDiB;

    // A → B: il mese è già in cache, quindi il commit è immediato.
    await page.getByLabel("Mese precedente").click();
    await expect(page).toHaveURL(new RegExp(`mese=${meseB}$`));
    await expect(cellaDelGiorno(page, giornoB, meseB)).toHaveAttribute(
      "data-con-attivita",
      "true",
    );

    // ── Gate di rete: da qui nessuna richiesta dati è ammessa ──
    let richiesteDati = 0;
    await page.route(eRichiestaDatiCalendario, async (route) => {
      richiesteDati += 1;
      await route.abort();
    });

    // B → A: mese già visitato e ancora fresco.
    await page.getByLabel("Mese successivo").click();

    await expect(page).toHaveURL(new RegExp(`mese=${meseA}$`));
    await expect(page.getByTestId("calendar-month-label")).toHaveText(
      etichettaA!,
    );
    const cellaA = cellaDelGiorno(page, giornoA, meseA);
    await expect(cellaA).toHaveAttribute("data-con-attivita", "true");
    await expect(cellaA.getByTestId("etichetta-cliente")).toHaveText(
      `${clienteA.cliente.ragioneSociale} 4.0 h`,
    );
    // Nessun indicatore: il mese non è mai stato in caricamento.
    await expect(page.getByTestId("indicatore-caricamento-mese")).toBeHidden();

    expect(richiesteDati).toBe(0);

    await page.unroute(eRichiestaDatiCalendario);
  });

  test("Back e Forward ripercorrono i mesi freschi senza richieste dati", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const meseA = meseRiservato(CODICE_SPEC);
    const meseB = mesePassatoRiservato(CODICE_SPEC, 1);
    const giornoA = dataNelMese(meseA, 8);
    const giornoB = dataNelMese(meseB, 14);

    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US052 History",
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(giornoA),
      ore: "3.00",
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(giornoB),
      ore: "5.00",
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    const prefetchDiB = page.waitForResponse(
      (risposta) =>
        new URL(risposta.url()).pathname === "/api/attivita/calendario" &&
        new URL(risposta.url()).searchParams.get("mese") === meseB,
    );

    await page.goto(`/attivita?mese=${meseA}`);
    await attendiCalendarioIdratato(page);
    const etichettaA = await page
      .getByTestId("calendar-month-label")
      .textContent();
    await prefetchDiB;

    await page.getByLabel("Mese precedente").click();
    await expect(page).toHaveURL(new RegExp(`mese=${meseB}$`));
    const etichettaB = await page
      .getByTestId("calendar-month-label")
      .textContent();
    expect(etichettaB).not.toBe(etichettaA);

    let richiesteDati = 0;
    await page.route(eRichiestaDatiCalendario, async (route) => {
      richiesteDati += 1;
      await route.abort();
    });

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`mese=${meseA}$`));
    await expect(page.getByTestId("calendar-month-label")).toHaveText(
      etichettaA!,
    );
    await expect(cellaDelGiorno(page, giornoA, meseA)).toHaveAttribute(
      "data-con-attivita",
      "true",
    );

    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`mese=${meseB}$`));
    await expect(page.getByTestId("calendar-month-label")).toHaveText(
      etichettaB!,
    );
    await expect(cellaDelGiorno(page, giornoB, meseB)).toHaveAttribute(
      "data-con-attivita",
      "true",
    );

    expect(richiesteDati).toBe(0);

    await page.unroute(eRichiestaDatiCalendario);

    // Un reload resta una lettura fresca dal server: la cache non sopravvive.
    await page.reload();
    await attendiCalendarioIdratato(page);
    await expect(page.getByTestId("calendar-month-label")).toHaveText(
      etichettaB!,
    );
    await expect(cellaDelGiorno(page, giornoB, meseB)).toHaveAttribute(
      "data-con-attivita",
      "true",
    );
  });

  test("sul mese non ancora disponibile la griglia precedente resta visibile con l'indicatore", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const meseA = meseRiservato(CODICE_SPEC);
    const meseB = mesePassatoRiservato(CODICE_SPEC, 1);
    const meseC = mesePassatoRiservato(CODICE_SPEC, 2);
    const giornoB = dataNelMese(meseB, 10);
    const giornoC = dataNelMese(meseC, 17);

    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US052 Miss",
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(giornoB),
      ore: "2.00",
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(giornoC),
      ore: "7.50",
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    // Il mese C viene trattenuto già dal prefetch, così il click lo trova
    // ancora in volo: è la condizione di miss esplicito.
    const cancelloC = cancelloRilasciabile();
    const richiestaDiC = (url: URL) =>
      url.pathname === "/api/attivita/calendario" &&
      url.searchParams.get("mese") === meseC;

    await page.route(richiestaDiC, async (route) => {
      await cancelloC.attesa;
      await route.continue();
    });

    const prefetchDiB = page.waitForResponse(
      (risposta) =>
        new URL(risposta.url()).pathname === "/api/attivita/calendario" &&
        new URL(risposta.url()).searchParams.get("mese") === meseB,
    );

    await page.goto(`/attivita?mese=${meseA}`);
    const calendario = await attendiCalendarioIdratato(page);
    await prefetchDiB;

    await page.getByLabel("Mese precedente").click();
    await expect(page).toHaveURL(new RegExp(`mese=${meseB}$`));
    const cellaB = cellaDelGiorno(page, giornoB, meseB);
    await expect(cellaB).toHaveAttribute("data-con-attivita", "true");

    // A → B → C: C è trattenuto, quindi il miss è osservabile.
    await page.getByLabel("Mese precedente").click();

    await expect(page.getByTestId("indicatore-caricamento-mese")).toBeVisible();
    await expect(calendario).toHaveAttribute("aria-busy", "true");
    // La griglia precedente resta visibile e l'URL non è ancora cambiato.
    await expect(cellaB).toHaveAttribute("data-con-attivita", "true");
    await expect(page).toHaveURL(new RegExp(`mese=${meseB}$`));

    cancelloC.rilascia();

    await expect(page).toHaveURL(new RegExp(`mese=${meseC}$`));
    const cellaC = cellaDelGiorno(page, giornoC, meseC);
    await expect(cellaC).toHaveAttribute("data-con-attivita", "true");
    await expect(cellaC.getByTestId("etichetta-cliente")).toHaveText(
      `${clienteConOfferta.cliente.ragioneSociale} 7.5 h`,
    );
    await expect(page.getByTestId("indicatore-caricamento-mese")).toBeHidden();
    await expect(calendario).toHaveAttribute("aria-busy", "false");

    await page.unroute(richiestaDiC);
  });

  test("con risposte invertite resta mostrata l'ultima destinazione richiesta", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const meseA = meseRiservato(CODICE_SPEC);
    const meseB = mesePassatoRiservato(CODICE_SPEC, 1);
    const meseC = mesePassatoRiservato(CODICE_SPEC, 2);
    const meseD = mesePassatoRiservato(CODICE_SPEC, 3);
    const giornoC = dataNelMese(meseC, 15);
    const giornoD = dataNelMese(meseD, 16);

    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US052 Race",
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(giornoC),
      ore: "1.00",
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(giornoD),
      ore: "8.00",
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    const cancelloC = cancelloRilasciabile();
    const cancelloD = cancelloRilasciabile();
    const richiesteTrattenute = (url: URL) =>
      url.pathname === "/api/attivita/calendario" &&
      (url.searchParams.get("mese") === meseC ||
        url.searchParams.get("mese") === meseD);

    await page.route(richiesteTrattenute, async (route) => {
      const mese = new URL(route.request().url()).searchParams.get("mese");
      await (mese === meseC ? cancelloC.attesa : cancelloD.attesa);
      await route.continue();
    });

    const prefetchDiB = page.waitForResponse(
      (risposta) =>
        new URL(risposta.url()).pathname === "/api/attivita/calendario" &&
        new URL(risposta.url()).searchParams.get("mese") === meseB,
    );

    await page.goto(`/attivita?mese=${meseA}`);
    await attendiCalendarioIdratato(page);
    await prefetchDiB;

    await page.getByLabel("Mese precedente").click();
    await expect(page).toHaveURL(new RegExp(`mese=${meseB}$`));

    // Due click rapidi: la catena riparte dall'ultima intenzione, non dal mese
    // ancora mostrato, quindi le destinazioni sono C e poi D.
    await page.getByLabel("Mese precedente").click();
    await page.getByLabel("Mese precedente").click();
    await expect(page.getByTestId("indicatore-caricamento-mese")).toBeVisible();

    // D (l'ultima destinazione) risponde prima di C: ordine invertito.
    cancelloD.rilascia();
    await expect(page).toHaveURL(new RegExp(`mese=${meseD}$`));
    const etichettaD = await page
      .getByTestId("calendar-month-label")
      .textContent();
    await expect(cellaDelGiorno(page, giornoD, meseD)).toHaveAttribute(
      "data-con-attivita",
      "true",
    );

    // C arriva in ritardo: non deve rubare la scena a D.
    cancelloC.rilascia();
    await page.waitForResponse(
      (risposta) =>
        new URL(risposta.url()).pathname === "/api/attivita/calendario" &&
        new URL(risposta.url()).searchParams.get("mese") === meseC,
    );

    await expect(page).toHaveURL(new RegExp(`mese=${meseD}$`));
    await expect(page.getByTestId("calendar-month-label")).toHaveText(
      etichettaD!,
    );
    await expect(cellaDelGiorno(page, giornoD, meseD)).toHaveAttribute(
      "data-con-attivita",
      "true",
    );
    await expect(cellaDelGiorno(page, giornoC, meseC)).toHaveCount(0);

    await page.unroute(richiesteTrattenute);
  });

  test("dopo un accesso con un altro account la cache non mostra i mesi del collaboratore precedente", async ({
    page,
    factory,
  }) => {
    const mese = meseRiservato(`${CODICE_SPEC}-identita`);
    const giornoDiA = dataNelMese(mese, 7);
    const giornoDiB = dataNelMese(mese, 18);

    const primoCollaboratore = await factory.createCollaboratore();
    const secondoCollaboratore = await factory.createCollaboratore();

    const clienteDiA = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US052 Identita A",
    });
    const clienteDiB = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US052 Identita B",
    });
    await factory.createRigaAttivita({
      collaboratore: primoCollaboratore,
      cliente: clienteDiA.cliente,
      offerta: clienteDiA.offerta,
      data: dataDb(giornoDiA),
      ore: "4.00",
    });
    await factory.createRigaAttivita({
      collaboratore: secondoCollaboratore,
      cliente: clienteDiB.cliente,
      offerta: clienteDiB.offerta,
      data: dataDb(giornoDiB),
      ore: "6.00",
    });

    await accediComeCollaboratore(page, primoCollaboratore.utente.email);
    await page.goto(`/attivita?mese=${mese}`);
    await attendiCalendarioIdratato(page);

    // Il mese del primo collaboratore è in cache e visibile.
    await expect(
      cellaDelGiorno(page, giornoDiA, mese).getByTestId("etichetta-cliente"),
    ).toHaveText(`${clienteDiA.cliente.ragioneSociale} 4.0 h`);

    // Accesso con un altro account nella stessa finestra: cambia solo il
    // cookie, la scheda resta montata con la cache del collaboratore
    // precedente.
    await page.evaluate(async (email) => {
      const risposta = await fetch("/api/e2e-test/sessione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!risposta.ok) throw new Error("cambio sessione e2e non riuscito");
    }, secondoCollaboratore.utente.email);

    // Oracolo: l'isola client deve essere abbandonata con una navigazione
    // documentale, non proseguire sui dati del collaboratore precedente.
    const ricaricamento = page.waitForResponse(
      (risposta) =>
        risposta.request().resourceType() === "document" &&
        new URL(risposta.url()).pathname === "/attivita",
    );

    // Il commit del mese adiacente fa partire il prefetch del mese successivo,
    // che con il nuovo cookie risponde dichiarando un altro collaboratore.
    await page.getByLabel("Mese precedente").click();

    await ricaricamento;
    await attendiCalendarioIdratato(page);

    // La navigazione documentale è già la prova che l'isola client è stata
    // abbandonata; qui si osserva la conseguenza per l'utente: il cliente del
    // collaboratore precedente non compare più.
    //
    // Non si asserisce su quale mese atterri la ricarica: dipende da quando la
    // risposta del prefetch arriva rispetto al commit dell'URL, e legarvi
    // un'asserzione renderebbe il test dipendente dal carico della macchina.
    // Che lo svuotamento riguardi *tutti* i mesi conservati è provato dai casi
    // sulla guardia d'identità in `tests/unit/calendario-cache-provider.test.ts`.
    await expect(
      page.getByText(clienteDiA.cliente.ragioneSociale),
    ).toHaveCount(0);

    // Il nuovo collaboratore vede i propri dati sul mese condiviso.
    await page.goto(`/attivita?mese=${mese}`);
    await attendiCalendarioIdratato(page);
    await expect(
      cellaDelGiorno(page, giornoDiB, mese).getByTestId("etichetta-cliente"),
    ).toHaveText(`${clienteDiB.cliente.ragioneSociale} 6.0 h`);
    await expect(
      page.getByText(clienteDiA.cliente.ragioneSociale),
    ).toHaveCount(0);
  });

  test("dopo una modifica il ritorno al calendario mostra la sintesi aggiornata", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mese = meseRiservato(`${CODICE_SPEC}-mutazione`);
    const giorno = dataNelMese(mese, 12);

    const cliente = await factory.createCliente({
      ragioneSociale: "E2E US052 Mutazione",
    });
    const offerta = await factory.createOfferta({ cliente, attiva: true });
    await factory.createAbilitazioneOfferta({ collaboratore, offerta });
    await factory.createRigaAttivita({
      collaboratore,
      cliente,
      offerta,
      data: dataDb(giorno),
      ore: "3.00",
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    await page.goto(`/attivita?mese=${mese}`);
    await attendiCalendarioIdratato(page);

    const cella = cellaDelGiorno(page, giorno, mese);
    await expect(cella.getByTestId("etichetta-cliente")).toHaveText(
      `${cliente.ragioneSociale} 3.0 h`,
    );

    // Il mese è ora in cache: la mutazione deve invalidarlo.
    await cella.click();
    await expect(page).toHaveURL(new RegExp(`/attivita/${giorno}`));

    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");
    await expect(selectCliente).toContainText(cliente.ragioneSociale);
    await selectCliente.selectOption(cliente.id);
    await attendiOfferteCaricate(selectOfferta);
    await expect(selectOfferta).toContainText(
      labelOffertaTest({ cliente, offerta }),
    );
    await selectOfferta.selectOption(offerta.id);
    await page.locator("#ore").fill("2");
    await page.getByRole("button", { name: "Aggiungi riga" }).click();

    // La nuova riga è registrata nella giornata.
    await expect(page.getByText("Righe registrate")).toBeVisible();
    await expect
      .poll(async () =>
        page.getByRole("button", { name: "Modifica" }).count(),
      )
      .toBe(2);

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await attendiCalendarioIdratato(page);

    // La entry precedente alla modifica non può mascherare il nuovo totale.
    await expect(
      cellaDelGiorno(page, giorno, mese).getByTestId("etichetta-cliente"),
    ).toHaveText(`${cliente.ragioneSociale} 5.0 h`);
  });
});
