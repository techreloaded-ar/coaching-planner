import { accediComeCollaboratore } from "./support/auth";
import {
  dataNelMese,
  meseCorrenteToken,
  mesePassatoRiservato,
  meseRiservato,
} from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Demo e2e — US-055: Selezione diretta di un mese lontano nel calendario.
 *
 * Riproduce lo script della sezione "Dimostrazione" della spec: dal calendario
 * mensile sul mese corrente il revisore usa il controllo di selezione diretta
 * per raggiungere un mese di un anno diverso e osserva griglia e URL, poi torna
 * al mese odierno con «Mese corrente», infine — con la lettura del mese di
 * arrivo trattenuta al posto della rete rallentata degli strumenti del browser —
 * salta a un altro mese lontano e osserva l'indicatore di caricamento esistente
 * finché le celle non sono valorizzate.
 */

const CODICE_SPEC = "US-055-DEMO-SALTO-MESE";

function dataDb(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00.000Z`);
}

/** Etichetta mese/anno come la produce il calendario per il mese odierno. */
function etichettaMeseCorrente(): string {
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-055 Demo — Salto diretto a un mese lontano", () => {
  test("il collaboratore raggiunge in un passo un mese di un anno diverso, torna al mese corrente e vede il feedback di attesa sul mese non ancora caricato", async ({
    page,
    collaboratore,
    factory,
  }) => {
    test.setTimeout(120_000);

    // `meseRiservato` è sempre almeno 12 mesi indietro: l'anno è diverso da
    // quello corrente, come chiede la dimostrazione della spec.
    const primoMese = meseRiservato(CODICE_SPEC);
    const primaData = dataNelMese(primoMese, 12);

    // Secondo salto: 40 mesi prima del primo, quindi non adiacente ad alcun
    // mese già visitato e mai un hit del prefetch.
    const secondoMese = mesePassatoRiservato(CODICE_SPEC, 40);
    const secondaData = dataNelMese(secondoMese, 7);

    const clienteConOfferta = await factory.createClienteConOfferta();
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(primaData),
      ore: "4.00",
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(secondaData),
      ore: "6.00",
    });

    // Passo 1 — il collaboratore parte dal calendario sul mese corrente.
    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto("/attivita");

    const calendario = page.getByLabel("Calendario mensile delle attività");
    await expect(calendario).toBeVisible();
    await expect(page.getByTestId("calendar-month-label")).toHaveText(
      etichettaMeseCorrente(),
    );
    // Prima dell'idratazione il submit del salto sarebbe un no-op.
    await expect(calendario).toHaveAttribute("data-idratata", "true");

    // Passo 2 — con il controllo di selezione diretta sceglie mese e anno.
    const selettore = page.getByLabel("Vai a un mese specifico");
    await expect(selettore).toHaveValue(meseCorrenteToken());
    await selettore.fill(primoMese);
    await page.getByRole("button", { name: "Vai al mese selezionato" }).click();

    // Passo 3 — la griglia mostra il mese scelto, senza scorrere i mesi
    // intermedi, e l'indirizzo porta il token `YYYY-MM` corrispondente.
    const primaCella = page.locator(
      `a[href="/attivita/${primaData}?mese=${primoMese}"]`,
    );
    await expect(primaCella).toHaveAttribute("data-con-attivita", "true");
    await expect(primaCella.getByTestId("etichetta-cliente")).toHaveText(
      `${clienteConOfferta.cliente.ragioneSociale} 4.0 h`,
    );
    await expect(page).toHaveURL(new RegExp(`mese=${primoMese}`));

    // Passo 4 — «Mese corrente» riporta al mese odierno, senza query.
    await page.getByRole("button", { name: "Mese corrente" }).click();
    await expect(page).toHaveURL(/\/attivita$/);
    await expect(page.getByTestId("calendar-month-label")).toHaveText(
      etichettaMeseCorrente(),
    );
    await expect(selettore).toHaveValue(meseCorrenteToken());

    // Passo 5 — la "rete rallentata" della dimostrazione è resa deterministica
    // trattenendo la sola lettura del mese di arrivo con una promessa, invece
    // di un throttling reale o di un'attesa a tempo.
    let sblocca: (() => void) | undefined;
    const attesa = new Promise<void>((resolve) => {
      sblocca = resolve;
    });
    const richiestaSecondoMese = (url: URL) =>
      (url.pathname === "/attivita" ||
        url.pathname === "/api/attivita/calendario") &&
      url.searchParams.get("mese") === secondoMese;

    await page.route(richiestaSecondoMese, async (route) => {
      await attesa;
      await route.continue();
    });

    await selettore.fill(secondoMese);
    await page.getByRole("button", { name: "Vai al mese selezionato" }).click();

    // Passo 6 — il salto verso un mese non ancora caricato mostra il medesimo
    // indicatore di attesa già presente per la navigazione mensile.
    await expect(page.getByTestId("indicatore-caricamento-mese")).toBeVisible();
    await expect(calendario).toHaveAttribute("aria-busy", "true");

    sblocca!();

    // Passo 7 — a dati pronti l'indicatore scompare e le celle del mese
    // raggiunto sono valorizzate.
    const secondaCella = page.locator(
      `a[href="/attivita/${secondaData}?mese=${secondoMese}"]`,
    );
    await expect(secondaCella).toHaveAttribute("data-con-attivita", "true");
    await expect(secondaCella.getByTestId("etichetta-cliente")).toHaveText(
      `${clienteConOfferta.cliente.ragioneSociale} 6.0 h`,
    );
    await expect(page.getByTestId("indicatore-caricamento-mese")).toBeHidden();
    await expect(calendario).toHaveAttribute("aria-busy", "false");
    await expect(page).toHaveURL(new RegExp(`mese=${secondoMese}`));

    await page.unroute(richiestaSecondoMese);

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
