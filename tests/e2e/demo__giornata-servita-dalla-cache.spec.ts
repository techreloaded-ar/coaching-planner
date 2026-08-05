import { randomUUID } from "node:crypto";

import { accediComeCollaboratore } from "./support/auth";
import { attendiOfferteCaricate, labelOffertaTest } from "./demo__inserimento-righe-attivita.helpers";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";
import type { Page } from "@playwright/test";

/**
 * Demo scenario — US-056: Cambio giorno servito dalla cache client nel
 * dettaglio attività
 *
 * Riproduce lo script della sezione "Dimostrazione" della spec: il revisore
 * apre il dettaglio del primo giorno di tre consecutivi, passa al successivo
 * con la freccia e torna indietro osservando l'immediatezza del ritorno su un
 * giorno già visitato, ripete lo stesso spostamento con Indietro/Avanti del
 * browser, salva una nuova riga, cambia giorno e torna verificando che la
 * riga sia presente, e infine ricarica la pagina sul giorno corrente
 * osservando le stesse righe servite dal server.
 */

function etichettaGiornoAttesa(dataIso: string): string {
  const [anno, mese, giorno] = dataIso.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(anno, mese - 1, giorno));
}

function intestazioneGiornata(page: Page) {
  return page.locator("main").getByRole("heading", { level: 1 });
}

/**
 * Predicato del cancello di rete per il ritorno su un giorno già visitato.
 * Deve restare la stessa reference di funzione fra `route` e `unroute`:
 * Playwright confronta i predicati per identità, non per comportamento.
 */
function eRichiestaDatiGiornata(url: URL): boolean {
  return (
    /^\/attivita\/\d{4}-\d{2}-\d{2}$/.test(url.pathname) ||
    url.pathname === "/api/attivita/giornata" ||
    url.pathname === "/api/attivita/contesto-inserimento"
  );
}

async function attendiGiornataIdratata(page: Page) {
  const contenuto = page.getByTestId("contenuto-giornata");
  await expect(contenuto).toBeVisible();
  await expect(contenuto).toHaveAttribute("data-idratata", "true");
  return contenuto;
}

test.describe("US-056 Demo", () => {
  test("demo cambio giorno servito dalla cache nel dettaglio attività", async ({
    page,
    factory,
    collaboratore,
    clienteConOfferta,
  }) => {
    test.setTimeout(90_000);

    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteConOfferta.offerta,
    });

    const mese = meseRiservato("US-056-DEMO");
    const giorno1 = dataNelMese(mese, 10);
    const giorno2 = dataNelMese(mese, 11);
    const giorno3 = dataNelMese(mese, 12);

    const notaGiorno1 = `Demo US-056 riga giorno 1 ${randomUUID().slice(0, 8)}`;
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: new Date(`${giorno1}T00:00:00.000Z`),
      nota: notaGiorno1,
    });

    // ── 1. Il revisore apre il dettaglio del primo dei tre giorni ──────
    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${giorno1}`);
    await attendiGiornataIdratata(page);
    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giorno1),
      { ignoreCase: true },
    );
    await expect(page.getByText(notaGiorno1, { exact: true })).toBeVisible();

    // ── 2. Passa al giorno successivo con la freccia ────────────────────
    await page.getByRole("button", { name: "Giorno successivo" }).click();
    await expect(page).toHaveURL(`/attivita/${giorno2}`);
    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giorno2),
      { ignoreCase: true },
    );

    // ── 3. Torna indietro: il giorno già visitato riappare subito, senza
    // alcuna richiesta dati (cancello di rete che conta e aborta) ───────
    let richiesteDati = 0;
    await page.route(eRichiestaDatiGiornata, async (route) => {
      richiesteDati += 1;
      await route.abort();
    });

    await page.getByRole("button", { name: "Giorno precedente" }).click();
    await expect(page).toHaveURL(`/attivita/${giorno1}`);
    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giorno1),
      { ignoreCase: true },
    );
    await expect(page.getByText(notaGiorno1, { exact: true })).toBeVisible();
    expect(richiesteDati).toBe(0);

    // ── 4. Indietro e Avanti del browser fra i giorni visitati mostrano lo
    // stesso comportamento immediato, senza generare richieste dati ────
    await page.goBack();
    await expect(page).toHaveURL(`/attivita/${giorno2}`);
    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giorno2),
      { ignoreCase: true },
    );

    await page.goForward();
    await expect(page).toHaveURL(`/attivita/${giorno1}`);
    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giorno1),
      { ignoreCase: true },
    );
    expect(richiesteDati).toBe(0);

    await page.unroute(eRichiestaDatiGiornata);

    // ── 5. Salva una nuova riga su un terzo giorno, cambia giorno e torna:
    // la riga appena salvata è ancora presente ─────────────────────────
    await page.getByRole("button", { name: "Giorno successivo" }).click();
    await expect(page).toHaveURL(`/attivita/${giorno2}`);
    await attendiGiornataIdratata(page);

    await page.getByRole("button", { name: "Giorno successivo" }).click();
    await expect(page).toHaveURL(`/attivita/${giorno3}`);
    await attendiGiornataIdratata(page);

    const notaSalvata = `Demo US-056 riga salvata ${randomUUID().slice(0, 8)}`;
    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");
    await selectCliente.selectOption(clienteConOfferta.cliente.id);
    await attendiOfferteCaricate(selectOfferta);
    await expect(selectOfferta).toContainText(
      labelOffertaTest(clienteConOfferta),
    );
    await selectOfferta.selectOption(clienteConOfferta.offerta.id);
    await page.locator("#ore").fill("5");
    await page.locator("#nota").fill(notaSalvata);
    await page.getByRole("button", { name: "Aggiungi riga" }).click();

    const rigaSalvata = page
      .getByTestId("activity-row")
      .filter({ has: page.getByText(notaSalvata, { exact: true }) });
    await expect(rigaSalvata).toBeVisible();

    await page.getByRole("button", { name: "Giorno precedente" }).click();
    await expect(page).toHaveURL(`/attivita/${giorno2}`);
    await page.getByRole("button", { name: "Giorno successivo" }).click();
    await expect(page).toHaveURL(`/attivita/${giorno3}`);
    await expect(rigaSalvata).toBeVisible();

    // ── 6. Ricarica sull'URL del giorno corrente: le stesse righe sono
    // servite dal server ────────────────────────────────────────────────
    await page.reload();
    await attendiGiornataIdratata(page);
    await expect(intestazioneGiornata(page)).toHaveText(
      etichettaGiornoAttesa(giorno3),
      { ignoreCase: true },
    );
    await expect(page.getByText(notaSalvata, { exact: true })).toBeVisible();
  });
});
