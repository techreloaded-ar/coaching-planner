import { accediComeCollaboratore } from "./support/auth";
import {
  dataNelMese,
  meseCorrenteToken,
  mesePassatoRiservato,
  meseRiservato,
} from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * US-055: Selezione diretta di un mese lontano nel calendario
 *
 * Copre il salto diretto mese/anno dalla barra di navigazione del calendario
 * mensile: la griglia raggiunge il mese scelto (AC-1), l'indirizzo conserva il
 * token `?mese=YYYY-MM` condivisibile e riapribile (AC-2), i controlli
 * preesistenti ripartono dal mese raggiunto e il selettore si risincronizza sul
 * mese effettivamente mostrato (AC-3), e il salto verso un mese non ancora
 * caricato riusa l'indicatore di attesa già presente (AC-4).
 *
 * La "rete rallentata" descritta nella dimostrazione della spec non viene
 * riprodotta con un throttling reale né con un hard wait: la lettura del mese
 * di arrivo è trattenuta da una `page.route` registrata **prima** del `goto` e
 * sbloccata da una promessa solo dopo le asserzioni sull'indicatore. Così la
 * finestra di attesa è deterministica e il test resta parallelizzabile.
 */

function dataDb(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00.000Z`);
}

/** Token `YYYY-MM` del mese successivo, con aritmetica locale al test. */
function meseSuccessivoToken(token: string): string {
  const [anno, mese] = token.split("-").map(Number);
  const annoSuccessivo = mese === 12 ? anno + 1 : anno;
  const meseSuccessivo = mese === 12 ? 1 : mese + 1;

  return `${annoSuccessivo}-${String(meseSuccessivo).padStart(2, "0")}`;
}

/** Etichetta mese/anno come la produce il calendario per il mese odierno. */
function etichettaMeseCorrente(): string {
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

test.describe("US-055 Salto diretto a un mese", () => {
  test("il salto diretto raggiunge un mese di un anno diverso e lascia coerenti i controlli esistenti", async ({
    page,
    collaboratore,
    factory,
  }) => {
    // `meseRiservato` è sempre almeno 12 mesi indietro: l'anno è diverso da
    // quello corrente, come richiesto dalla dimostrazione della spec.
    const meseArrivo = meseRiservato("US-055");
    const data = dataNelMese(meseArrivo, 14);

    const clienteConOfferta = await factory.createClienteConOfferta();
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(data),
      ore: "4.00",
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto("/attivita");

    const calendario = page.getByLabel("Calendario mensile delle attività");
    await expect(calendario).toBeVisible();
    // Prima dell'idratazione il submit del salto sarebbe un no-op.
    await expect(calendario).toHaveAttribute("data-idratata", "true");

    await page.getByLabel("Vai a un mese specifico").fill(meseArrivo);
    await page.getByRole("button", { name: "Vai al mese selezionato" }).click();

    // AC-1: la griglia mostra il mese scelto, con la cella del giorno valorizzata.
    const cella = page.locator(`a[href="/attivita/${data}?mese=${meseArrivo}"]`);
    await expect(cella).toHaveAttribute("data-con-attivita", "true");
    await expect(cella.getByTestId("etichetta-cliente")).toHaveText(
      `${clienteConOfferta.cliente.ragioneSociale} 4.0 h`,
    );

    // AC-2: il mese raggiunto è rappresentato dal token nell'indirizzo…
    await expect(page).toHaveURL(new RegExp(`mese=${meseArrivo}`));

    // …e quell'indirizzo è riapribile direttamente.
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`mese=${meseArrivo}`));
    await expect(cella).toHaveAttribute("data-con-attivita", "true");

    // AC-3: dal mese raggiunto i controlli esistenti restano coerenti.
    await expect(calendario).toHaveAttribute("data-idratata", "true");
    await page.getByLabel("Mese successivo").click();
    await expect(page).toHaveURL(
      new RegExp(`mese=${meseSuccessivoToken(meseArrivo)}`),
    );

    await page.getByRole("button", { name: "Mese corrente" }).click();
    // Il ritorno al mese odierno azzera la query: il contratto URL resta quello
    // dei controlli preesistenti, non una variante introdotta dal salto.
    await expect(page).toHaveURL(/\/attivita$/);
    await expect(page.getByTestId("calendar-month-label")).toHaveText(
      etichettaMeseCorrente(),
    );
    // Il selettore segue il mese effettivamente in griglia.
    await expect(page.getByLabel("Vai a un mese specifico")).toHaveValue(
      meseCorrenteToken(),
    );
  });

  test("il salto verso un mese non ancora in cache mostra il feedback di attesa esistente", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mesePartenza = meseRiservato("US-055");
    // 40 mesi prima della partenza: non è un mese adiacente, quindi non è
    // toccato dal prefetch e il salto non può essere un hit di cache.
    const meseArrivo = mesePassatoRiservato("US-055", 40);
    const data = dataNelMese(meseArrivo, 9);

    const clienteConOfferta = await factory.createClienteConOfferta();
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(data),
      ore: "2.00",
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    // Gate deterministico sulla lettura del mese di arrivo, registrato prima
    // del goto: sostituisce la rete rallentata senza hard wait.
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
    await expect(calendario).toHaveAttribute("data-idratata", "true");

    await page.getByLabel("Vai a un mese specifico").fill(meseArrivo);
    await page.getByRole("button", { name: "Vai al mese selezionato" }).click();

    // AC-4: con la lettura trattenuta il salto mostra il medesimo feedback di
    // attesa della navigazione mensile.
    await expect(page.getByTestId("indicatore-caricamento-mese")).toBeVisible();
    await expect(calendario).toHaveAttribute("aria-busy", "true");

    sblocca!();

    // AC-4: a dati pronti l'indicatore scompare e le celle sono valorizzate.
    const cella = page.locator(`a[href="/attivita/${data}?mese=${meseArrivo}"]`);
    await expect(cella).toHaveAttribute("data-con-attivita", "true");
    await expect(cella.getByTestId("etichetta-cliente")).toHaveText(
      `${clienteConOfferta.cliente.ragioneSociale} 2.0 h`,
    );
    await expect(page.getByTestId("indicatore-caricamento-mese")).toBeHidden();
    await expect(calendario).toHaveAttribute("aria-busy", "false");
    await expect(page).toHaveURL(new RegExp(`mese=${meseArrivo}`));

    await page.unroute(richiestaMeseArrivo);
  });
});
