import type { Locator, Page } from "@playwright/test";

import { accediComeCollaboratore } from "./support/auth";
import {
  dataNelMese,
  meseCorrenteToken,
  mesePassatoRiservato,
  meseRiservato,
} from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * US-058: Selettore di mese compatto sull'etichetta con navigazione immediata
 *
 * Copre tutti e sei i criteri della spec dal browser: l'etichetta del mese è
 * il controllo che apre il selettore, con anno navigabile e mese in griglia
 * evidenziato (AC-1); la scelta di un mese chiude il pannello e valorizza
 * subito la griglia, senza conferme (AC-2); il vecchio campo mese con «Vai»
 * non esiste più nella barra (AC-3); il mese raggiunto vive nel token
 * `?mese=YYYY-MM` dell'indirizzo, condivisibile e riapribile (AC-4); la
 * chiusura senza scelta — con `Esc` o con un clic fuori — lascia invariato il
 * mese mostrato (AC-5); l'intero giro apertura/spostamento/scelta/chiusura è
 * percorribile da tastiera, anche attraverso il confine d'anno (AC-6).
 *
 * L'ultimo scenario conserva la copertura di regressione sul feedback di
 * attesa già presente sul percorso di salto. La "rete rallentata" non viene
 * riprodotta con un throttling reale né con un hard wait: la lettura del mese
 * di arrivo è trattenuta da una `page.route` registrata **prima** del `goto` e
 * sbloccata da una promessa solo dopo le asserzioni sull'indicatore. Così la
 * finestra di attesa è deterministica e i test restano parallelizzabili.
 */

/**
 * Chiave dei mesi riservati di questo file. Non è il codice nudo della spec:
 * `US-058` cade sullo stesso offset (-87) di `US-052-cache-identita` e
 * `US-056-cronologia`, e il guardrail dei mesi riservati lo rifiuta. La
 * variante qualificata è libera sia sul mese base (-125) sia sul mese di
 * arrivo dello scenario di attesa (-167).
 */
const CHIAVE_MESE_RISERVATO = "US-058-SELETTORE";

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

/** Etichetta lunga di un token `YYYY-MM`, con la convenzione locale dell'app. */
function etichettaMeseLunga(token: string): string {
  const [anno, mese] = token.split("-").map(Number);

  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(new Date(anno, mese - 1, 1));
}

/** Apre il selettore dall'etichetta del mese e restituisce il pannello. */
async function apriSelettore(page: Page): Promise<Locator> {
  await page.getByTestId("calendar-month-label").click();

  const pannello = page.getByTestId("selettore-mese-pannello");
  await expect(pannello).toBeVisible();

  return pannello;
}

/**
 * Porta il pannello sull'anno richiesto. L'anno mostrato è letto una sola
 * volta: il numero di clic è determinato prima di iniziare, quindi non c'è
 * alcun ciclo di polling.
 */
async function portaAnno(pannello: Locator, annoTarget: number): Promise<void> {
  const annoMostrato = Number(
    await pannello.getByTestId("selettore-mese-anno").innerText(),
  );
  const passi = annoTarget - annoMostrato;
  const freccia = passi < 0 ? "Anno precedente" : "Anno successivo";

  for (let i = 0; i < Math.abs(passi); i++) {
    await pannello.getByRole("button", { name: freccia }).click();
  }

  await expect(pannello.getByTestId("selettore-mese-anno")).toHaveText(
    String(annoTarget),
  );
}

test.describe("US-058 Selettore di mese compatto sull'etichetta", () => {
  test("il selettore sull'etichetta raggiunge un mese di un anno diverso", async ({
    page,
    collaboratore,
    factory,
  }) => {
    // `meseRiservato` è sempre almeno 12 mesi indietro: l'anno di arrivo è
    // diverso da quello corrente, quindi la navigazione dell'anno è reale.
    const meseArrivo = meseRiservato(CHIAVE_MESE_RISERVATO);
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
    // Prima dell'idratazione il selettore sarebbe un controllo inerte.
    await expect(calendario).toHaveAttribute("data-idratata", "true");

    // ── AC-3: il vecchio controllo di salto separato non esiste più ──
    await expect(page.getByLabel("Vai a un mese specifico")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Vai al mese selezionato" }),
    ).toHaveCount(0);

    // ── AC-1: l'etichetta è il controllo che apre il selettore ──
    const trigger = page.getByTestId("calendar-month-label");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    const pannello = await apriSelettore(page);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(pannello.getByTestId("selettore-mese-anno")).toHaveText(
      meseCorrenteToken().slice(0, 4),
    );
    await expect(
      pannello.locator(`[data-token="${meseCorrenteToken()}"]`),
    ).toHaveAttribute("aria-current", "true");

    await portaAnno(pannello, Number(meseArrivo.slice(0, 4)));
    // Su un anno diverso da quello in griglia nessun mese è evidenziato:
    // l'evidenziazione segue il mese mostrato, non la posizione nel pannello.
    await expect(pannello.locator('[aria-current="true"]')).toHaveCount(0);

    // ── AC-2: la scelta chiude il pannello e la griglia cambia subito ──
    // Il locator della cella è ancorato al pannello: il trigger ha lo stesso
    // nome accessibile della cella quando l'anno mostrato è quello in griglia.
    await pannello
      .getByRole("button", { name: etichettaMeseLunga(meseArrivo), exact: true })
      .click();
    await expect(pannello).toBeHidden();

    const cella = page.locator(`a[href="/attivita/${data}?mese=${meseArrivo}"]`);
    await expect(cella).toHaveAttribute("data-con-attivita", "true");
    await expect(cella.getByTestId("etichetta-cliente")).toHaveText(
      `${clienteConOfferta.cliente.ragioneSociale} 4.0 h`,
    );

    // ── AC-4: il mese raggiunto vive nel token dell'indirizzo… ──
    await expect(page).toHaveURL(new RegExp(`mese=${meseArrivo}`));

    // …e quell'indirizzo è riapribile direttamente.
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`mese=${meseArrivo}`));
    await expect(cella).toHaveAttribute("data-con-attivita", "true");
  });

  test("la chiusura senza scelta lascia invariato il mese in griglia", async ({
    page,
    collaboratore,
  }) => {
    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto("/attivita");

    const calendario = page.getByLabel("Calendario mensile delle attività");
    await expect(calendario).toBeVisible();
    await expect(calendario).toHaveAttribute("data-idratata", "true");

    const trigger = page.getByTestId("calendar-month-label");

    // ── AC-5: chiusura con Esc dopo aver navigato l'anno ──
    const pannelloEsc = await apriSelettore(page);
    await pannelloEsc.getByRole("button", { name: "Anno precedente" }).click();
    await page.keyboard.press("Escape");

    await expect(pannelloEsc).toBeHidden();
    await expect(trigger).toHaveText(etichettaMeseCorrente());
    await expect(page).toHaveURL(/\/attivita$/);

    // ── AC-5: chiusura con un clic fuori, su un elemento non navigante ──
    const pannelloClic = await apriSelettore(page);
    await pannelloClic.getByRole("button", { name: "Anno successivo" }).click();
    await page.getByText("Giorno con attività registrate").click();

    await expect(pannelloClic).toBeHidden();
    await expect(trigger).toHaveText(etichettaMeseCorrente());
    await expect(page).toHaveURL(/\/attivita$/);
  });

  test("il selettore è utilizzabile da tastiera", async ({
    page,
    collaboratore,
  }) => {
    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto("/attivita");

    const calendario = page.getByLabel("Calendario mensile delle attività");
    await expect(calendario).toBeVisible();
    await expect(calendario).toHaveAttribute("data-idratata", "true");

    const [annoCorrente, meseCorrente] = meseCorrenteToken()
      .split("-")
      .map(Number);
    const trigger = page.getByTestId("calendar-month-label");

    // ── AC-6: apertura dall'etichetta senza mouse ──
    await trigger.focus();
    await page.keyboard.press("Enter");

    const pannello = page.getByTestId("selettore-mese-pannello");
    await expect(pannello).toBeVisible();
    await expect(
      pannello.locator(`[data-token="${meseCorrenteToken()}"]`),
    ).toBeFocused();

    // ── AC-6: lo spostamento attraversa il confine d'anno ──
    // Da un mese qualsiasi, `meseCorrente` passi indietro arrivano a dicembre
    // dell'anno precedente: gennaio non è un fondo corsa.
    for (let i = 0; i < meseCorrente; i++) {
      await page.keyboard.press("ArrowLeft");
    }
    const tokenDicembrePrecedente = `${annoCorrente - 1}-12`;
    await expect(pannello.getByTestId("selettore-mese-anno")).toHaveText(
      String(annoCorrente - 1),
    );
    await expect(
      pannello.locator(`[data-token="${tokenDicembrePrecedente}"]`),
    ).toBeFocused();

    // ── AC-6: scelta con Invio, senza alcun passaggio di conferma ──
    await page.keyboard.press("Enter");
    await expect(pannello).toBeHidden();
    await expect(page).toHaveURL(
      new RegExp(`mese=${tokenDicembrePrecedente}`),
    );
    await expect(trigger).toHaveText(
      etichettaMeseLunga(tokenDicembrePrecedente),
    );

    // ── AC-6: chiusura con Esc, con il focus che torna all'etichetta ──
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(pannello).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(pannello).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("il salto verso un mese non ancora in cache mostra il feedback di attesa esistente", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mesePartenza = meseRiservato(CHIAVE_MESE_RISERVATO);
    // 42 mesi prima della partenza: non è un mese adiacente, quindi non è
    // toccato dal prefetch e il salto non può essere un hit di cache.
    const meseArrivo = mesePassatoRiservato(CHIAVE_MESE_RISERVATO, 42);
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

    const pannello = await apriSelettore(page);
    await portaAnno(pannello, Number(meseArrivo.slice(0, 4)));
    await pannello
      .getByRole("button", { name: etichettaMeseLunga(meseArrivo), exact: true })
      .click();

    // Con la lettura trattenuta il salto mostra il medesimo feedback di
    // attesa della navigazione mensile.
    await expect(page.getByTestId("indicatore-caricamento-mese")).toBeVisible();
    await expect(calendario).toHaveAttribute("aria-busy", "true");

    sblocca!();

    // A dati pronti l'indicatore scompare e le celle sono valorizzate.
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
