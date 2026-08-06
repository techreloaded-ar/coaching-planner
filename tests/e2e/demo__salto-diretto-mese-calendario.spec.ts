import type { Locator, Page } from "@playwright/test";

import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseCorrenteToken, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Demo e2e — US-058: Selettore di mese compatto sull'etichetta con
 * navigazione immediata.
 *
 * Riproduce passo per passo lo script della sezione «Dimostrazione» della
 * spec: dal calendario mensile sul mese corrente il revisore constata che il
 * vecchio campo mese con «Vai» non esiste più, clicca l'etichetta del mese —
 * ora unico ingresso al salto diretto — sposta l'anno, sceglie un mese di un
 * anno diverso e osserva che il pannello si chiude e la griglia mostra subito
 * il mese scelto con il token `YYYY-MM` nell'URL; poi riapre il selettore, lo
 * chiude con `Esc` verificando che il mese in griglia resta invariato, e con
 * «Mese corrente» torna al mese odierno.
 */

/**
 * Chiave dei mesi riservati di questa demo. Verificata libera da collisioni
 * con il guardrail di `npm run lint`: occupa l'offset -128, distinto dagli
 * offset -125 e -167 usati da `calendario-salto-mese.spec.ts`.
 */
const CODICE_SPEC = "US-058-DEMO-SELETTORE-MESE";

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

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-058 Demo — Selettore di mese compatto sull'etichetta", () => {
  test("il collaboratore apre il selettore dall'etichetta, raggiunge in un gesto un mese di un anno diverso, chiude con Esc senza cambiare mese e torna al mese corrente", async ({
    page,
    collaboratore,
    factory,
  }) => {
    test.setTimeout(120_000);

    // `meseRiservato` è sempre almeno 12 mesi indietro: l'anno di arrivo è
    // diverso da quello corrente, quindi lo spostamento d'anno è reale.
    const meseArrivo = meseRiservato(CODICE_SPEC);
    const data = dataNelMese(meseArrivo, 12);

    const clienteConOfferta = await factory.createClienteConOfferta();
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(data),
      ore: "4.00",
    });

    // Passo 1 — il collaboratore parte dal calendario sul mese corrente.
    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto("/attivita");

    const calendario = page.getByLabel("Calendario mensile delle attività");
    await expect(calendario).toBeVisible();

    const trigger = page.getByTestId("calendar-month-label");
    await expect(trigger).toHaveText(etichettaMeseCorrente());
    // Prima dell'idratazione il selettore sarebbe un controllo inerte.
    await expect(calendario).toHaveAttribute("data-idratata", "true");

    // Passo 2 — il vecchio controllo di salto separato non è più nella barra.
    await expect(page.getByLabel("Vai a un mese specifico")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Vai al mese selezionato" }),
    ).toHaveCount(0);

    // Passo 3 — l'etichetta è visibilmente interattiva e apre il selettore,
    // con l'anno corrente e il mese in griglia evidenziato.
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    const pannello = await apriSelettore(page);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(pannello.getByTestId("selettore-mese-anno")).toHaveText(
      meseCorrenteToken().slice(0, 4),
    );
    await expect(
      pannello.locator(`[data-token="${meseCorrenteToken()}"]`),
    ).toHaveAttribute("aria-current", "true");

    // Passo 4 — il revisore sposta l'anno e sceglie il mese, senza conferme.
    // Il locator della cella è ancorato al pannello: il trigger ha lo stesso
    // nome accessibile della cella quando l'anno mostrato è quello in griglia.
    await portaAnno(pannello, Number(meseArrivo.slice(0, 4)));
    await pannello
      .getByRole("button", { name: etichettaMeseLunga(meseArrivo), exact: true })
      .click();

    // Passo 5 — il pannello si chiude, la griglia mostra subito il mese scelto
    // e l'indirizzo porta il token `YYYY-MM` corrispondente.
    await expect(pannello).toBeHidden();

    const cella = page.locator(`a[href="/attivita/${data}?mese=${meseArrivo}"]`);
    await expect(cella).toHaveAttribute("data-con-attivita", "true");
    await expect(cella.getByTestId("etichetta-cliente")).toHaveText(
      `${clienteConOfferta.cliente.ragioneSociale} 4.0 h`,
    );
    await expect(page).toHaveURL(new RegExp(`mese=${meseArrivo}`));

    // Passo 6 — riaprendo il selettore e chiudendolo con `Esc`, il mese in
    // griglia e l'indirizzo restano quelli raggiunti.
    const pannelloRiaperto = await apriSelettore(page);
    await page.keyboard.press("Escape");

    await expect(pannelloRiaperto).toBeHidden();
    await expect(trigger).toHaveText(etichettaMeseLunga(meseArrivo));
    await expect(page).toHaveURL(new RegExp(`mese=${meseArrivo}`));

    // Passo 7 — «Mese corrente» riporta al mese odierno, senza query.
    await page.getByRole("button", { name: "Mese corrente" }).click();
    await expect(page).toHaveURL(/\/attivita$/);
    await expect(trigger).toHaveText(etichettaMeseCorrente());

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
