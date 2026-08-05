import { randomUUID } from "node:crypto";

import {
  attendiOfferteCaricate,
  labelOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import {
  test,
  expect,
  type ClienteConOffertaTestData,
  type CollaboratoreTestData,
  type E2eDataFactory,
} from "./support/fixtures";
import type { Page } from "@playwright/test";

/**
 * US-056: cambio giorno servito dalla cache client nel dettaglio attività
 *
 * Oracolo di rete: si contano **e** si abortiscono sia le navigazioni verso la
 * pagina di una giornata (`/attivita/YYYY-MM-DD`, documento o payload RSC) sia
 * le GET verso `/api/attivita/giornata` e `/api/attivita/contesto-inserimento`.
 * Abortire, e non solo contare, è ciò che rende l'assenza di richieste una
 * prova: se le righe comparissero grazie a una richiesta, quella richiesta
 * fallirebbe e l'asserzione sul contenuto cadrebbe invece di passare.
 *
 * `/api/attivita/offerte-cliente` resta deliberatamente **fuori** dal cancello:
 * è la lettura del cascade cliente → offerta del form di inserimento, cioè una
 * conseguenza dell'interazione con il form, non del cambio giorno. Includerla
 * confonderebbe due confini distinti e renderebbe il cancello inutilizzabile
 * negli scenari che compilano il form.
 *
 * Il tempo non viene mai atteso: le risposte trattenute sono sbloccate da
 * Promise risolte dal test dopo che le asserzioni sullo stato intermedio sono
 * passate.
 *
 * Disposizione delle righe nei giorni riservati: le righe vivono sempre su un
 * solo giorno e i giorni contigui restano vuoti, e nessuna asserzione riguarda
 * le righe di un giorno adiacente a uno popolato. La lettura della giornata
 * delimita il giorno con l'ora locale del server (`new Date(anno, mese, giorno)`
 * fino alle 23:59:59) mentre la colonna è di tipo `DATE`: con un fuso diverso da
 * UTC la finestra effettiva può includere anche un giorno contiguo. È un
 * comportamento precedente a questa spec — gli estremi sono quelli della vecchia
 * `righeDelGiorno` — che qui non viene né provato né aggirato: la disposizione
 * lo rende semplicemente irrilevante per queste asserzioni, su qualunque fuso.
 */

const CODICE_SPEC = "US-056";

function dataDb(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00.000Z`);
}

function etichettaGiornoAttesa(dataIso: string): string {
  const [anno, mese, giorno] = dataIso.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(anno, mese - 1, giorno));
}

/** Pathname di una pagina di giornata: `/attivita/YYYY-MM-DD`. */
const PATHNAME_GIORNATA = /^\/attivita\/\d{4}-\d{2}-\d{2}$/;

/** Le richieste dati del cambio giorno: pagina della giornata ed endpoint JSON. */
function eRichiestaDatiGiornata(url: URL): boolean {
  return (
    PATHNAME_GIORNATA.test(url.pathname) ||
    url.pathname === "/api/attivita/giornata" ||
    url.pathname === "/api/attivita/contesto-inserimento"
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
 * Attende che l'isola giornata sia idratata: prima dell'idratazione un click
 * sui controlli del giorno è un no-op, perché gli handler client non sono
 * ancora agganciati.
 */
async function attendiGiornataIdratata(page: Page) {
  const contenuto = page.getByTestId("contenuto-giornata");
  await expect(contenuto).toBeVisible();
  await expect(contenuto).toHaveAttribute("data-idratata", "true");
  return contenuto;
}

/** Risposta dell'endpoint della giornata per una data precisa. */
function rispostaGiornata(page: Page, data: string) {
  return page.waitForResponse((risposta) => {
    const url = new URL(risposta.url());
    return (
      url.pathname === "/api/attivita/giornata" &&
      url.searchParams.get("data") === data
    );
  });
}

function intestazioneGiornata(page: Page) {
  return page.locator("main").getByRole("heading", { level: 1 });
}

/** Cella giorno del calendario mensile, individuata dal proprio href. */
function cellaDelGiorno(page: Page, data: string, mese: string) {
  return page.locator(`a[href="/attivita/${data}?mese=${mese}"]`);
}

/** Attende l'idratazione del calendario mensile, come per l'isola giornata. */
async function attendiCalendarioIdratato(page: Page) {
  const calendario = page.getByLabel("Calendario mensile delle attività");
  await expect(calendario).toBeVisible();
  await expect(calendario).toHaveAttribute("data-idratata", "true");
  return calendario;
}

/**
 * Ore totali della giornata popolata da `creaGiornataConDueRighe`.
 *
 * Il valore non coincide con nessun badge di riga (1.0 h e 3.0 h) né con le ore
 * fatturabili (1.0 h): il testo compare quindi una sola volta nella pagina, ed è
 * esattamente il riquadro «Ore totali». È così che il totale viene asserito
 * senza appoggiarsi a classi di stile.
 */
const ORE_TOTALI_GIORNATA_POPOLATA = "4.0 h";

/** Due righe sullo stesso giorno: 1.0 h fatturabile e 3.0 h non fatturabile. */
async function creaGiornataConDueRighe(
  factory: E2eDataFactory,
  collaboratore: CollaboratoreTestData,
  clienteConOfferta: ClienteConOffertaTestData,
  giorno: string,
) {
  for (const [ore, fatturabile] of [
    ["1.00", true],
    ["3.00", false],
  ] as const) {
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(giorno),
      ore,
      fatturabile,
    });
  }
}

/** Asserisce che la vista mostri la giornata popolata: intestazione, righe, totale. */
async function attendiGiornataPopolata(
  page: Page,
  giorno: string,
  clienteConOfferta: ClienteConOffertaTestData,
) {
  await expect(intestazioneGiornata(page)).toHaveText(
    etichettaGiornoAttesa(giorno),
    { ignoreCase: true },
  );
  await expect(page.getByTestId("activity-row")).toHaveCount(2);
  await expect(page.getByTestId("activity-row").first()).toContainText(
    clienteConOfferta.cliente.ragioneSociale,
  );
  await expect(
    page.getByText(ORE_TOTALI_GIORNATA_POPOLATA, { exact: true }),
  ).toHaveCount(1);
}

test.describe("US-056 Cambio giorno servito dalla cache delle giornate", () => {
  test("il ritorno su un giorno già visitato non produce alcuna richiesta dati", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mese = meseRiservato(CODICE_SPEC);
    const giornoPrimaDelVuoto = dataNelMese(mese, 9);
    const giornoVuoto = dataNelMese(mese, 10);
    const giornoConRighe = dataNelMese(mese, 11);
    const giornoDopoLeRighe = dataNelMese(mese, 12);

    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US056 Ritorno",
    });

    await creaGiornataConDueRighe(
      factory,
      collaboratore,
      clienteConOfferta,
      giornoConRighe,
    );

    await accediComeCollaboratore(page, collaboratore.utente.email);

    // I prefetch dei giorni adiacenti sono attesi come eventi, non come ritardo.
    const prefetchGiornoVuoto = rispostaGiornata(page, giornoVuoto);
    const prefetchGiornoDopo = rispostaGiornata(page, giornoDopoLeRighe);

    await page.goto(`/attivita/${giornoConRighe}`);
    await attendiGiornataIdratata(page);
    await attendiGiornataPopolata(page, giornoConRighe, clienteConOfferta);

    await Promise.all([prefetchGiornoVuoto, prefetchGiornoDopo]);

    // Giorno con righe → giorno vuoto: già in cache, quindi commit immediato.
    // Il commit fa partire il prefetch del giorno ancora precedente, atteso qui
    // perché non resti in volo quando il cancello si chiude.
    const prefetchGiornoPrimaDelVuoto = rispostaGiornata(
      page,
      giornoPrimaDelVuoto,
    );
    await page.getByRole("button", { name: "Giorno precedente" }).click();
    await expect(page).toHaveURL(`/attivita/${giornoVuoto}`);
    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giornoVuoto),
      { ignoreCase: true },
    );
    await prefetchGiornoPrimaDelVuoto;

    // ── Cancello di rete: da qui nessuna richiesta dati è ammessa ──
    let richiesteDati = 0;
    await page.route(eRichiestaDatiGiornata, async (route) => {
      richiesteDati += 1;
      await route.abort();
    });

    // Ritorno sul giorno già visitato e ancora fresco.
    await page.getByRole("button", { name: "Giorno successivo" }).click();

    await expect(page).toHaveURL(`/attivita/${giornoConRighe}`);
    await attendiGiornataPopolata(page, giornoConRighe, clienteConOfferta);
    // Nessun indicatore: la giornata non è mai stata in caricamento.
    await expect(
      page.getByTestId("indicatore-caricamento-giornata"),
    ).toBeHidden();

    expect(richiesteDati).toBe(0);

    await page.unroute(eRichiestaDatiGiornata);
  });

  test("Indietro e Avanti del browser ripercorrono i giorni freschi senza richieste dati né voci di cronologia in più", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mese = meseRiservato(`${CODICE_SPEC}-cronologia`);
    const giornoPrimaDelVuoto = dataNelMese(mese, 9);
    const giornoVuoto = dataNelMese(mese, 10);
    const giornoConRighe = dataNelMese(mese, 11);
    const giornoDopoLeRighe = dataNelMese(mese, 12);

    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US056 Cronologia",
    });
    await creaGiornataConDueRighe(
      factory,
      collaboratore,
      clienteConOfferta,
      giornoConRighe,
    );

    await accediComeCollaboratore(page, collaboratore.utente.email);

    const prefetchGiornoVuoto = rispostaGiornata(page, giornoVuoto);
    const prefetchGiornoDopo = rispostaGiornata(page, giornoDopoLeRighe);

    await page.goto(`/attivita/${giornoConRighe}`);
    await attendiGiornataIdratata(page);
    await attendiGiornataPopolata(page, giornoConRighe, clienteConOfferta);
    await Promise.all([prefetchGiornoVuoto, prefetchGiornoDopo]);

    const prefetchGiornoPrimaDelVuoto = rispostaGiornata(
      page,
      giornoPrimaDelVuoto,
    );
    await page.getByRole("button", { name: "Giorno precedente" }).click();
    await expect(page).toHaveURL(`/attivita/${giornoVuoto}`);
    await prefetchGiornoPrimaDelVuoto;

    const vociCronologiaPrima = await page.evaluate(
      () => window.history.length,
    );

    let richiesteDati = 0;
    await page.route(eRichiestaDatiGiornata, async (route) => {
      richiesteDati += 1;
      await route.abort();
    });

    await page.goBack();
    await expect(page).toHaveURL(`/attivita/${giornoConRighe}`);
    await attendiGiornataPopolata(page, giornoConRighe, clienteConOfferta);

    await page.goForward();
    await expect(page).toHaveURL(`/attivita/${giornoVuoto}`);
    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giornoVuoto),
      { ignoreCase: true },
    );

    expect(richiesteDati).toBe(0);

    // Ripercorrere la cronologia non vi aggiunge voci: Back e Forward non
    // devono registrare un nuovo `pushState`.
    expect(await page.evaluate(() => window.history.length)).toBe(
      vociCronologiaPrima,
    );

    await page.unroute(eRichiestaDatiGiornata);
  });

  test("un click su Giorno precedente durante il miss verso il giorno successivo non duplica la cronologia", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mese = meseRiservato(`${CODICE_SPEC}-cronologia-corsa`);
    const giornoPartenza = dataNelMese(mese, 15);
    const giornoSuccessivo = dataNelMese(mese, 16);

    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US056 Corsa Cronologia",
    });
    await creaGiornataConDueRighe(
      factory,
      collaboratore,
      clienteConOfferta,
      giornoPartenza,
    );

    // Il cancello va registrato prima di accedere e navigare: l'isola
    // prefetcha automaticamente il giorno successivo dopo ogni commit, quindi
    // la richiesta da trattenere è quella del prefetch, non una richiesta
    // scatenata direttamente dal click su "Giorno successivo".
    const cancelloSuccessivo = cancelloRilasciabile();
    const richiestaGiornoSuccessivo = (url: URL) =>
      url.pathname === "/api/attivita/giornata" &&
      url.searchParams.get("data") === giornoSuccessivo;
    await page.route(richiestaGiornoSuccessivo, async (route) => {
      await cancelloSuccessivo.attesa;
      await route.continue();
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${giornoPartenza}`);
    await attendiGiornataIdratata(page);
    await attendiGiornataPopolata(page, giornoPartenza, clienteConOfferta);

    const vociCronologiaPrima = await page.evaluate(
      () => window.history.length,
    );

    // Click verso un giorno mai visitato: la richiesta è trattenuta dal
    // cancello (single-flight con il prefetch già in volo), quindi il miss è
    // ancora in corso quando arriva il click successivo.
    await page.getByRole("button", { name: "Giorno successivo" }).click();
    await expect(
      page.getByTestId("indicatore-caricamento-giornata"),
    ).toBeVisible();

    // Subito dopo, senza rilasciare il cancello: la corsa segnalata dal
    // reviewer. La destinazione ricalcolata coincide con il giorno già
    // mostrato, quindi il ritorno deve essere un hit sincrono di cache.
    await page.getByRole("button", { name: "Giorno precedente" }).click();

    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giornoPartenza),
      { ignoreCase: true },
    );
    await expect(page).toHaveURL(`/attivita/${giornoPartenza}`);
    // Con il fix di TASK-16 nessuna voce viene aggiunta, perché l'URL di
    // destinazione coincide già con quello corrente.
    expect(await page.evaluate(() => window.history.length)).toBe(
      vociCronologiaPrima,
    );

    cancelloSuccessivo.rilascia();

    // La risposta tardiva del giorno abbandonato non deve toccare né vista,
    // né URL, né cronologia.
    await expect(page).toHaveURL(`/attivita/${giornoPartenza}`);
    await attendiGiornataPopolata(page, giornoPartenza, clienteConOfferta);
    expect(await page.evaluate(() => window.history.length)).toBe(
      vociCronologiaPrima,
    );

    await page.unroute(richiestaGiornoSuccessivo);
  });

  test("sul giorno mai visitato resta visibile la giornata precedente con l'indicatore e l'URL cambia solo a dati pronti", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mese = meseRiservato(`${CODICE_SPEC}-attesa`);
    const giornoPartenza = dataNelMese(mese, 11);
    const giornoLontano = dataNelMese(mese, 21);

    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US056 Attesa",
    });
    await creaGiornataConDueRighe(
      factory,
      collaboratore,
      clienteConOfferta,
      giornoPartenza,
    );
    // Una sola riga sul giorno lontano: il suo totale «6.0 h» distingue la
    // giornata di arrivo da quella di partenza.
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(giornoLontano),
      ore: "6.00",
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    // Il giorno lontano non è adiacente, quindi non viene prefetchato: il
    // cancello lo trattiene alla prima e unica richiesta, che è il miss.
    const cancelloGiornoLontano = cancelloRilasciabile();
    const richiestaDelGiornoLontano = (url: URL) =>
      url.pathname === "/api/attivita/giornata" &&
      url.searchParams.get("data") === giornoLontano;

    await page.route(richiestaDelGiornoLontano, async (route) => {
      await cancelloGiornoLontano.attesa;
      await route.continue();
    });

    await page.goto(`/attivita/${giornoPartenza}`);
    const contenuto = await attendiGiornataIdratata(page);
    await attendiGiornataPopolata(page, giornoPartenza, clienteConOfferta);

    // Salto diretto a un giorno mai visitato: la risposta è trattenuta.
    await page.getByTestId("selettore-giorno").fill(giornoLontano);

    await expect(
      page.getByTestId("indicatore-caricamento-giornata"),
    ).toBeVisible();
    await expect(contenuto).toHaveAttribute("aria-busy", "true");
    // La giornata precedente resta visibile e l'URL non è ancora cambiato.
    await attendiGiornataPopolata(page, giornoPartenza, clienteConOfferta);
    await expect(page).toHaveURL(`/attivita/${giornoPartenza}`);

    cancelloGiornoLontano.rilascia();

    await expect(page).toHaveURL(`/attivita/${giornoLontano}`);
    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giornoLontano),
      { ignoreCase: true },
    );
    await expect(page.getByTestId("activity-row")).toHaveCount(1);
    await expect(
      page.getByTestId("indicatore-caricamento-giornata"),
    ).toBeHidden();
    await expect(contenuto).toHaveAttribute("aria-busy", "false");

    await page.unroute(richiestaDelGiornoLontano);
  });

  test("clienti e voci di rimborso non vengono richiesti ad ogni cambio giorno", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mese = meseRiservato(`${CODICE_SPEC}-contesto`);
    const giornoPartenza = dataNelMese(mese, 10);
    const primoArrivo = dataNelMese(mese, 11);
    const secondoArrivo = dataNelMese(mese, 12);
    const terzoArrivo = dataNelMese(mese, 13);
    const giornoOltreTerzoArrivo = dataNelMese(mese, 14);

    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US056 Contesto",
    });
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${giornoPartenza}`);
    await attendiGiornataIdratata(page);

    const selectCliente = page.locator("#cliente");
    await expect(selectCliente).toContainText(
      clienteConOfferta.cliente.ragioneSociale,
    );

    // Qui si conta soltanto: le richieste della giornata devono avvenire
    // davvero, mentre quelle del contesto non devono comparire affatto.
    let richiesteContesto = 0;
    let richiesteGiornata = 0;
    const richiesteDaContare = (url: URL) =>
      url.pathname === "/api/attivita/contesto-inserimento" ||
      url.pathname === "/api/attivita/giornata";

    await page.route(richiesteDaContare, async (route) => {
      if (
        new URL(route.request().url()).pathname ===
        "/api/attivita/contesto-inserimento"
      ) {
        richiesteContesto += 1;
      } else {
        richiesteGiornata += 1;
      }
      await route.continue();
    });

    const prefetchOltreTerzoArrivo = rispostaGiornata(
      page,
      giornoOltreTerzoArrivo,
    );

    for (const giorno of [primoArrivo, secondoArrivo, terzoArrivo]) {
      await page.getByRole("button", { name: "Giorno successivo" }).click();
      await expect(page).toHaveURL(`/attivita/${giorno}`);
      await expect(intestazioneGiornata(page)).toHaveText(
        etichettaGiornoAttesa(giorno),
        { ignoreCase: true },
      );
      // La select cliente resta popolata senza che il contesto sia riletto.
      await expect(selectCliente).toContainText(
        clienteConOfferta.cliente.ragioneSociale,
      );
    }

    // Almeno una richiesta di giornata è certamente avvenuta dopo il conteggio:
    // il prefetch del giorno adiacente all'ultimo arrivo.
    await prefetchOltreTerzoArrivo;

    expect(richiesteGiornata).toBeGreaterThan(0);
    expect(richiesteContesto).toBe(0);

    await page.unroute(richiesteDaContare);
  });

  test("ad ogni cambio giorno il form di inserimento riparte azzerato", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mese = meseRiservato(`${CODICE_SPEC}-form`);
    const giornoPartenza = dataNelMese(mese, 10);
    const giornoArrivo = dataNelMese(mese, 11);

    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US056 Form",
    });
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${giornoPartenza}`);
    await attendiGiornataIdratata(page);

    const selectCliente = page.locator("#cliente");
    const campoOre = page.locator("#ore");
    const campoNota = page.locator("#nota");
    const notaInCompilazione = `US-056 nota in compilazione ${randomUUID()}`;

    await expect(selectCliente).toContainText(
      clienteConOfferta.cliente.ragioneSociale,
    );
    await selectCliente.selectOption(clienteConOfferta.cliente.id);
    await expect(selectCliente).toHaveValue(clienteConOfferta.cliente.id);
    await campoOre.fill("3");
    await campoNota.fill(notaInCompilazione);

    await page.getByRole("button", { name: "Giorno successivo" }).click();
    await expect(page).toHaveURL(`/attivita/${giornoArrivo}`);

    await expect(campoOre).toHaveValue("");
    await expect(campoNota).toHaveValue("");
    await expect(selectCliente).toHaveValue("");
  });

  test("dopo il salvataggio la vista resta sul giorno salvato e il dato aggiornato sopravvive al cambio giorno e al calendario", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mese = meseRiservato(`${CODICE_SPEC}-mutazione`);
    const giornoPartenza = dataNelMese(mese, 10);
    const giornoSalvataggio = dataNelMese(mese, 11);

    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US056 Mutazione",
    });
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    // Si parte dal calendario, così il mese entra in cache **prima** della
    // mutazione: la sintesi mostrata al ritorno non può essere quella
    // precedente al salvataggio.
    await page.goto(`/attivita?mese=${mese}`);
    await attendiCalendarioIdratato(page);
    await expect(
      cellaDelGiorno(page, giornoSalvataggio, mese),
    ).toHaveAttribute("data-con-attivita", "false");

    await cellaDelGiorno(page, giornoPartenza, mese).click();
    await expect(page).toHaveURL(`/attivita/${giornoPartenza}?mese=${mese}`);
    await attendiGiornataIdratata(page);

    await page.getByRole("button", { name: "Giorno successivo" }).click();
    await expect(page).toHaveURL(`/attivita/${giornoSalvataggio}?mese=${mese}`);

    const notaSalvata = `US-056 riga salvata ${randomUUID()}`;
    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");
    await expect(selectCliente).toContainText(
      clienteConOfferta.cliente.ragioneSociale,
    );
    await selectCliente.selectOption(clienteConOfferta.cliente.id);
    await attendiOfferteCaricate(selectOfferta);
    await expect(selectOfferta).toContainText(
      labelOffertaTest(clienteConOfferta),
    );
    await selectOfferta.selectOption(clienteConOfferta.offerta.id);
    await page.locator("#ore").fill("6");
    await page.locator("#nota").fill(notaSalvata);
    await page.getByRole("button", { name: "Aggiungi riga" }).click();

    const rigaSalvata = page
      .getByTestId("activity-row")
      .filter({ has: page.getByText(notaSalvata, { exact: true }) });

    // La vista resta sul giorno salvato: il salvataggio non riporta l'utente
    // sul giorno da cui era partito.
    await expect(rigaSalvata).toBeVisible();
    await expect(page).toHaveURL(`/attivita/${giornoSalvataggio}?mese=${mese}`);
    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giornoSalvataggio),
      { ignoreCase: true },
    );

    // Cambio giorno e ritorno: la cache non può servire le righe precedenti
    // alla mutazione.
    await page.getByRole("button", { name: "Giorno precedente" }).click();
    await expect(page).toHaveURL(`/attivita/${giornoPartenza}?mese=${mese}`);
    await page.getByRole("button", { name: "Giorno successivo" }).click();
    await expect(page).toHaveURL(`/attivita/${giornoSalvataggio}?mese=${mese}`);
    await expect(rigaSalvata).toBeVisible();

    // Il calendario del mese corrispondente mostra le ore aggiornate.
    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await expect(page).toHaveURL(`/attivita?mese=${mese}`);
    await attendiCalendarioIdratato(page);

    const cellaSalvataggio = cellaDelGiorno(page, giornoSalvataggio, mese);
    await expect(cellaSalvataggio).toHaveAttribute("data-con-attivita", "true");
    await expect(cellaSalvataggio.getByTestId("etichetta-cliente")).toHaveText(
      `${clienteConOfferta.cliente.ragioneSociale} 6.0 h`,
    );
  });

  test("dopo un accesso con un altro account il dettaglio giorno non mostra i dati del collaboratore precedente", async ({
    page,
    factory,
  }) => {
    const mese = meseRiservato(`${CODICE_SPEC}-identita-account`);
    const giornoCondiviso = dataNelMese(mese, 11);
    const giornoLontano = dataNelMese(mese, 21);

    const primoCollaboratore = await factory.createCollaboratore();
    const secondoCollaboratore = await factory.createCollaboratore();

    const clienteDelPrimo = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US056 Identita Primo",
    });
    const clienteDelSecondo = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US056 Identita Secondo",
    });
    await factory.createRigaAttivita({
      collaboratore: primoCollaboratore,
      cliente: clienteDelPrimo.cliente,
      offerta: clienteDelPrimo.offerta,
      data: dataDb(giornoCondiviso),
      ore: "4.00",
    });
    await factory.createRigaAttivita({
      collaboratore: secondoCollaboratore,
      cliente: clienteDelSecondo.cliente,
      offerta: clienteDelSecondo.offerta,
      data: dataDb(giornoCondiviso),
      ore: "6.00",
    });

    await accediComeCollaboratore(page, primoCollaboratore.utente.email);
    await page.goto(`/attivita/${giornoCondiviso}`);
    await attendiGiornataIdratata(page);
    await expect(page.getByTestId("activity-row")).toContainText(
      clienteDelPrimo.cliente.ragioneSociale,
    );

    // Accesso con un altro account nella stessa finestra: cambia solo il
    // cookie, la scheda resta montata con le cache del collaboratore
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
        PATHNAME_GIORNATA.test(new URL(risposta.url()).pathname),
    );

    // Un salto a un giorno mai visitato è l'unico cambio giorno che produce
    // certamente una richiesta: la risposta, con il nuovo cookie, dichiara un
    // altro collaboratore.
    await page.getByTestId("selettore-giorno").fill(giornoLontano);

    await ricaricamento;
    await attendiGiornataIdratata(page);

    // La navigazione documentale è già la prova che l'isola client è stata
    // abbandonata; qui si osserva la conseguenza per l'utente. Non si asserisce
    // su quale giorno atterri la ricarica, perché dipende da quando la risposta
    // arriva rispetto al commit dell'URL.
    await expect(
      page.getByText(clienteDelPrimo.cliente.ragioneSociale),
    ).toHaveCount(0);

    // Il nuovo collaboratore vede le proprie righe sul giorno condiviso.
    await page.goto(`/attivita/${giornoCondiviso}`);
    await attendiGiornataIdratata(page);
    await expect(page.getByTestId("activity-row")).toContainText(
      clienteDelSecondo.cliente.ragioneSociale,
    );
    await expect(
      page.getByText(clienteDelPrimo.cliente.ragioneSociale),
    ).toHaveCount(0);
  });

  test("il selettore data svuotato torna a descrivere il giorno mostrato", async ({
    page,
    collaboratore,
  }) => {
    const mese = meseRiservato(`${CODICE_SPEC}-selettore`);
    const giorno = dataNelMese(mese, 11);

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${giorno}?mese=${mese}`);
    await attendiGiornataIdratata(page);

    const selettore = page.getByTestId("selettore-giorno");
    await expect(selettore).toHaveValue(giorno);

    // Un valore incompleto non è un giorno verso cui navigare: il campo non
    // deve restare a metà mentre la pagina mostra un altro giorno.
    await selettore.fill("");

    await expect(selettore).toHaveValue(giorno);
    await expect(page).toHaveURL(`/attivita/${giorno}?mese=${mese}`);
    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giorno),
      { ignoreCase: true },
    );
  });

  test("il rientro nell'isola da un'altra rotta mostra il giorno dell'URL, non quello dell'albero ripristinato", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mese = meseRiservato(`${CODICE_SPEC}-rientro`);
    const giornoConRighe = dataNelMese(mese, 11);
    const giornoLontano = dataNelMese(mese, 21);

    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US056 Rientro",
    });
    await creaGiornataConDueRighe(
      factory,
      collaboratore,
      clienteConOfferta,
      giornoConRighe,
    );

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${giornoConRighe}?mese=${mese}`);
    await attendiGiornataIdratata(page);
    await attendiGiornataPopolata(page, giornoConRighe, clienteConOfferta);

    // Cambio giorno client verso un giorno lontano: l'URL viene scritto con la
    // History API, e la voce di cronologia così creata eredita l'albero RSC del
    // giorno di partenza.
    await page.getByTestId("selettore-giorno").fill(giornoLontano);
    await expect(page).toHaveURL(`/attivita/${giornoLontano}?mese=${mese}`);
    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giornoLontano),
      { ignoreCase: true },
    );

    // Si esce dall'isola verso un'altra rotta: al rientro l'isola viene
    // rimontata con l'albero memorizzato nella voce di cronologia.
    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await expect(page).toHaveURL(`/attivita?mese=${mese}`);
    await attendiCalendarioIdratato(page);

    await page.goBack();

    // L'URL descrive il giorno lontano: la vista deve descrivere lo stesso
    // giorno, non quello dell'albero ripristinato.
    await expect(page).toHaveURL(`/attivita/${giornoLontano}?mese=${mese}`);
    await attendiGiornataIdratata(page);
    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giornoLontano),
      { ignoreCase: true },
    );
    await expect(page.getByTestId("selettore-giorno")).toHaveValue(
      giornoLontano,
    );
    // Il giorno lontano è vuoto: nessuna riga del giorno di partenza.
    await expect(page.getByTestId("activity-row")).toHaveCount(0);
    await expect(
      page.getByText(clienteConOfferta.cliente.ragioneSociale),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Torna al calendario" }),
    ).toHaveAttribute("href", `/attivita?mese=${mese}`);
  });

  test("una risposta tardiva arrivata dopo l'uscita dall'isola non riscrive URL e cronologia", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mese = meseRiservato(`${CODICE_SPEC}-tardiva`);
    const giornoPartenza = dataNelMese(mese, 11);
    const giornoLontano = dataNelMese(mese, 21);

    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US056 Tardiva",
    });
    await creaGiornataConDueRighe(
      factory,
      collaboratore,
      clienteConOfferta,
      giornoPartenza,
    );

    await accediComeCollaboratore(page, collaboratore.utente.email);

    // Il giorno lontano non è adiacente, quindi non viene prefetchato: la sua
    // unica richiesta è il miss del salto diretto, e resta trattenuta.
    const cancelloGiornoLontano = cancelloRilasciabile();
    const richiestaDelGiornoLontano = (url: URL) =>
      url.pathname === "/api/attivita/giornata" &&
      url.searchParams.get("data") === giornoLontano;

    await page.route(richiestaDelGiornoLontano, async (route) => {
      await cancelloGiornoLontano.attesa;
      await route.continue();
    });

    await page.goto(`/attivita/${giornoPartenza}?mese=${mese}`);
    await attendiGiornataIdratata(page);
    await attendiGiornataPopolata(page, giornoPartenza, clienteConOfferta);

    await page.getByTestId("selettore-giorno").fill(giornoLontano);
    await expect(
      page.getByTestId("indicatore-caricamento-giornata"),
    ).toBeVisible();
    await expect(page).toHaveURL(`/attivita/${giornoPartenza}?mese=${mese}`);

    // L'utente abbandona l'isola mentre la lettura è ancora in volo.
    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await expect(page).toHaveURL(`/attivita?mese=${mese}`);
    const calendario = await attendiCalendarioIdratato(page);

    // La risposta abbandonata arriva adesso: la si attende come evento, così le
    // asserzioni successive avvengono dopo che la scheda l'ha ricevuta.
    const rispostaTardiva = rispostaGiornata(page, giornoLontano);
    cancelloGiornoLontano.rilascia();
    await (await rispostaTardiva).finished();

    await expect(page).toHaveURL(`/attivita?mese=${mese}`);
    await expect(calendario).toBeVisible();

    // La cronologia non ha guadagnato la voce fantasma del giorno abbandonato:
    // si entra in un giorno dal calendario e Indietro riporta al calendario.
    await cellaDelGiorno(page, giornoPartenza, mese).click();
    await expect(page).toHaveURL(`/attivita/${giornoPartenza}?mese=${mese}`);
    await attendiGiornataIdratata(page);

    await page.goBack();
    await expect(page).toHaveURL(`/attivita?mese=${mese}`);
    await attendiCalendarioIdratato(page);

    await page.unroute(richiestaDelGiornoLontano);
  });

  test("reload e link profondo restano serviti dal server con il contratto URL invariato", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mese = meseRiservato(`${CODICE_SPEC}-server`);
    const giornoVuoto = dataNelMese(mese, 10);
    const giornoConRighe = dataNelMese(mese, 11);

    const clienteConOfferta = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US056 Server",
    });
    await creaGiornataConDueRighe(
      factory,
      collaboratore,
      clienteConOfferta,
      giornoConRighe,
    );

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${giornoVuoto}`);
    await attendiGiornataIdratata(page);

    await page.getByRole("button", { name: "Giorno successivo" }).click();
    await expect(page).toHaveURL(`/attivita/${giornoConRighe}`);

    // Il reload sull'URL raggiunto con la History API è una navigazione
    // documentale: la giornata torna dal server, non dalla cache di scheda.
    const rispostaDelReload = await page.reload();
    expect(rispostaDelReload?.request().resourceType()).toBe("document");
    expect(new URL(rispostaDelReload!.url()).pathname).toBe(
      `/attivita/${giornoConRighe}`,
    );
    await attendiGiornataIdratata(page);
    await attendiGiornataPopolata(page, giornoConRighe, clienteConOfferta);

    // Link profondo con il parametro `mese`: stesse righe e breadcrumb che
    // punta al mese atteso.
    await page.goto(`/attivita/${giornoConRighe}?mese=${mese}`);
    await attendiGiornataIdratata(page);
    await attendiGiornataPopolata(page, giornoConRighe, clienteConOfferta);
    await expect(
      page.getByRole("link", { name: "Torna al calendario" }),
    ).toHaveAttribute("href", `/attivita?mese=${mese}`);
  });
});
