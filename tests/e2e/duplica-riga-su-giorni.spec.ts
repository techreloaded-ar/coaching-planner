import type { Locator, Page } from "@playwright/test";

import { accediComeCollaboratore } from "./support/auth";
import {
  dataNelMeseRiservato,
  dataNelMesePassatoRiservato,
  mesePassatoRiservato,
  meseRiservato,
} from "./support/date";
import {
  test,
  expect,
  type ClienteConOffertaTestData,
  type CollaboratoreTestData,
  type E2eDataFactory,
} from "./support/fixtures";

/**
 * US-057: duplicazione di una riga attività su più giorni scelti.
 *
 * Tutti gli scenari partono da entità della factory — collaboratore, cliente,
 * offerta, abilitazione e riga sorgente — dentro due mesi riservati, così che
 * righe di altri worker nello stesso mese non possano comparire in nessuna
 * asserzione: ogni oracolo è ancorato alla ragione sociale, al codice offerta o
 * alla nota creati dal test.
 *
 * La chiave di riservazione è una sola per tutto il file: il mese di origine è
 * `meseRiservato(CODICE_SPEC)` e il "secondo mese" della storia è quello
 * immediatamente precedente, `mesePassatoRiservato(CODICE_SPEC)`. Nessuna
 * asserzione riguarda totali globali del mese o il fatto che un mese sia vuoto,
 * quindi la chiave **non** va registrata in `SLOT_MESI_RISERVATI_ESCLUSIVI`.
 */

const CODICE_SPEC = "US-057-DUPLICAZIONE-MULTIGIORNO";

/** Mese in cui vive la riga di origine. */
const MESE_ORIGINE = meseRiservato(CODICE_SPEC);
const GIORNO_ORIGINE = dataNelMeseRiservato(CODICE_SPEC, 11);
/** Due destinazioni non contigue nello stesso mese della riga di origine. */
const GIORNO_DESTINAZIONE_A = dataNelMeseRiservato(CODICE_SPEC, 17);
const GIORNO_DESTINAZIONE_B = dataNelMeseRiservato(CODICE_SPEC, 24);
/** Terza destinazione, in un mese diverso: è ciò che AC-5 mette alla prova. */
const MESE_ALTRO = mesePassatoRiservato(CODICE_SPEC);
const GIORNO_ALTRO_MESE = dataNelMesePassatoRiservato(CODICE_SPEC, 7);
/** Giorno scelto nello scenario di rifiuto: nessuna riga deve nascerci. */
const GIORNO_RIFIUTO = dataNelMeseRiservato(CODICE_SPEC, 4);

const RAGIONE_SOCIALE_ORIGINE = "E2E US057 Origine";
const RAGIONE_SOCIALE_NON_ABILITATA = "E2E US057 Non Abilitata";

/** Fotografia del rimborso già congelata sulla riga sorgente. */
const ETICHETTA_RIMBORSO = "Trasferta US-057";
const IMPORTO_RIMBORSO = "85.00";
const ORE_SORGENTE = "6.00";

/**
 * Il dettaglio giornata stampa l'importo con `toFixed(2)` accanto al simbolo
 * («€ 85.00»), non nello stile valuta italiano: la regex assorbe solo lo spazio.
 */
const IMPORTO_RIMBORSO_A_SCHERMO = new RegExp(
  `€\\s*${Number(IMPORTO_RIMBORSO).toFixed(2).replace(".", "\\.")}`,
);

/** Scrittura del giorno civile con la stessa convenzione UTC dell'applicazione. */
function dataDb(giorno: string): Date {
  return new Date(`${giorno}T12:00:00.000Z`);
}

type ScenarioSorgente = {
  clienteConOfferta: ClienteConOffertaTestData;
  nota: string;
};

/**
 * Scenario nominale: un cliente con offerta attiva abilitata al collaboratore e
 * una riga sorgente completa — ore, nota, fatturabilità e rimborso già
 * fotografato — sul giorno di origine.
 *
 * Il rimborso nasce direttamente sulla riga, senza passare dal catalogo delle
 * voci: la duplicazione deve propagare proprio quella fotografia.
 */
async function preparaRigaSorgente(
  factory: E2eDataFactory,
  collaboratore: CollaboratoreTestData,
  namespace: string,
): Promise<ScenarioSorgente> {
  const clienteConOfferta = await factory.createClienteConOfferta({
    ragioneSociale: RAGIONE_SOCIALE_ORIGINE,
  });
  await factory.createAbilitazioneOfferta({
    collaboratore,
    offerta: clienteConOfferta.offerta,
  });

  const nota = `US-057 riga sorgente ${namespace}`;
  await factory.createRigaAttivita({
    collaboratore,
    cliente: clienteConOfferta.cliente,
    offerta: clienteConOfferta.offerta,
    data: dataDb(GIORNO_ORIGINE),
    ore: ORE_SORGENTE,
    nota,
    // Categoria non predefinita: la copia deve conservarla, non riportarla a Fatturabile.
    categoria: "NON_FATTURABILE",
    rimborsoTrasfertaEtichetta: ETICHETTA_RIMBORSO,
    rimborsoTrasfertaImporto: IMPORTO_RIMBORSO,
  });

  return { clienteConOfferta, nota };
}

/**
 * Apre il giorno di origine e attende l'idratazione dell'isola: prima che React
 * abbia agganciato gli handler, il click su «Duplica…» sarebbe un no-op.
 */
async function apriGiornoOrigine(page: Page) {
  await page.goto(`/attivita/${GIORNO_ORIGINE}?mese=${MESE_ORIGINE}`);
  const contenuto = page.getByTestId("contenuto-giornata");
  await expect(contenuto).toBeVisible();
  await expect(contenuto).toHaveAttribute("data-idratata", "true");
  return contenuto;
}

function cardRigaDi(page: Page, ragioneSociale: string): Locator {
  return page.getByTestId("activity-row").filter({ hasText: ragioneSociale });
}

function selettore(page: Page): Locator {
  return page.getByTestId("selettore-duplicazione");
}

/** Aggiunge un giorno alla pista del selettore con i controlli del pannello. */
async function aggiungiGiornoDestinazione(page: Page, giorno: string) {
  await page.getByTestId("data-duplicazione").fill(giorno);
  await selettore(page).getByRole("button", { name: "Aggiungi data" }).click();
}

/** Cambio giorno con il selettore data del dettaglio: percorso client, mai `goto`. */
async function vaiAlGiorno(page: Page, giorno: string) {
  await page.getByTestId("selettore-giorno").fill(giorno);
  await expect(page).toHaveURL(`/attivita/${giorno}?mese=${giorno.slice(0, 7)}`);
}

/**
 * Cella di un giorno nella griglia del mese indicato.
 *
 * L'href di una cella porta il token del mese **a cui il giorno appartiene**,
 * non di quello visualizzato: le celle di sbordo di una griglia hanno quindi lo
 * stesso href della loro griglia nativa. Perché questo locator resti una
 * barriera sull'arrivo del mese di destinazione, i giorni usati dal file (4, 7,
 * 11, 17, 24) devono restare fuori dalle fasce di sbordo — cioè lontani dal
 * primo e dall'ultimo giorno del mese.
 */
function cellaDelGiorno(page: Page, giorno: string, mese: string): Locator {
  return page.locator(`a[href="/attivita/${giorno}?mese=${mese}"]`);
}

/** Etichetta lunga del mese, con la stessa convenzione locale dell'app. */
function etichettaMeseLunga(mese: string): string {
  const [anno, numeroMese] = mese.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(new Date(anno, numeroMese - 1, 1));
}

/**
 * Salto a un mese con il controllo dell'applicazione: il selettore compatto
 * aperto dall'etichetta del mese.
 *
 * L'attesa è sulla comparsa della cella richiesta: durante un miss la griglia
 * del mese precedente resta visibile, quindi la cella del mese di destinazione
 * esiste solo a dati arrivati. È così una barriera sul dato in cache, non un
 * hard wait.
 */
async function vaiAlMese(page: Page, mese: string, giornoAtteso: string) {
  await page.getByTestId("calendar-month-label").click();
  const pannello = page.getByTestId("selettore-mese-pannello");
  await expect(pannello).toBeVisible();

  // L'anno mostrato è letto una sola volta: il numero di clic è determinato
  // prima di iniziare, quindi non c'è alcun ciclo di polling.
  const annoMostrato = Number(
    await pannello.getByTestId("selettore-mese-anno").innerText()
  );
  const passi = Number(mese.slice(0, 4)) - annoMostrato;
  const freccia = passi < 0 ? "Anno precedente" : "Anno successivo";
  for (let i = 0; i < Math.abs(passi); i++) {
    await pannello.getByRole("button", { name: freccia }).click();
  }
  await expect(pannello.getByTestId("selettore-mese-anno")).toHaveText(
    mese.slice(0, 4)
  );

  // Il locator della cella è ancorato al pannello: il trigger ha lo stesso
  // nome accessibile della cella quando l'anno mostrato è quello in griglia.
  await pannello
    .getByRole("button", { name: etichettaMeseLunga(mese), exact: true })
    .click();

  await expect(page).toHaveURL(`/attivita?mese=${mese}`);
  await expect(cellaDelGiorno(page, giornoAtteso, mese)).toBeVisible();
}

test.describe("US-057 Duplicazione di una riga su più giorni scelti", () => {
  test("la riga viene replicata su tre giorni non contigui, uno in un altro mese, e il calendario di quel mese si valorizza senza reload", async ({
    page,
    factory,
    collaboratore,
    namespace,
  }) => {
    // Lo scenario attraversa tre giornate e due mesi: il budget di default non
    // basta su route fredde. Non è un'attesa, è un limite di tempo.
    test.setTimeout(120_000);

    const { clienteConOfferta, nota } = await preparaRigaSorgente(
      factory,
      collaboratore,
      namespace,
    );

    await accediComeCollaboratore(page, collaboratore.utente.email);

    // ── Le cache di scheda devono essere calde PRIMA della mutazione ──
    // Senza questo preambolo l'oracolo di AC-5 sarebbe vacuo: entrando con un
    // caricamento diretto della rotta giorno, l'isola del calendario non è mai
    // stata montata, nessun mese è in cache e `invalidate` non ha nulla da
    // invalidare — il mese di destinazione verrebbe letto a freddo dopo la
    // scrittura e la cella risulterebbe valorizzata anche senza l'estensione
    // multi-mese. Si entra quindi dal calendario, si visita il mese di
    // destinazione e uno dei giorni di destinazione, e solo allora si duplica:
    // da qui in poi entrambe le cache contengono una fotografia
    // **antecedente** alla duplicazione, che solo l'invalidazione può superare.
    await page.goto(`/attivita?mese=${MESE_ORIGINE}`);
    const calendario = page.getByLabel("Calendario mensile delle attività");
    await expect(calendario).toBeVisible();
    await expect(calendario).toHaveAttribute("data-idratata", "true");

    // Il mese diverso entra in cache com'è adesso: senza la riga duplicata.
    await vaiAlMese(page, MESE_ALTRO, GIORNO_ALTRO_MESE);
    await expect(
      cellaDelGiorno(page, GIORNO_ALTRO_MESE, MESE_ALTRO),
    ).toHaveAttribute("data-con-attivita", "false");

    // Rientro sul mese di origine e ingresso nel giorno dalla cella: è una
    // navigazione client, quindi il provider del layout — e con esso le cache
    // appena scaldate — non viene smontato.
    await vaiAlMese(page, MESE_ORIGINE, GIORNO_ORIGINE);
    await cellaDelGiorno(page, GIORNO_ORIGINE, MESE_ORIGINE).click();

    const contenuto = page.getByTestId("contenuto-giornata");
    await expect(contenuto).toBeVisible();
    await expect(contenuto).toHaveAttribute("data-idratata", "true");

    // Anche il giorno di destinazione in un altro mese entra in cache vuoto.
    await vaiAlGiorno(page, GIORNO_ALTRO_MESE);
    await expect(page.getByTestId("activity-row")).toHaveCount(0);
    await vaiAlGiorno(page, GIORNO_ORIGINE);

    // ── AC-1: tre destinazioni arbitrarie, di cui una in un mese diverso ──
    await cardRigaDi(page, RAGIONE_SOCIALE_ORIGINE)
      .getByTestId("duplica-riga")
      .click();
    await expect(selettore(page)).toBeVisible();

    for (const giorno of [
      GIORNO_DESTINAZIONE_A,
      GIORNO_DESTINAZIONE_B,
      GIORNO_ALTRO_MESE,
    ]) {
      await aggiungiGiornoDestinazione(page, giorno);
      // La tessera del giorno scelto porta il proprio giorno come attributo:
      // è il contratto osservabile della pista, non una classe di stile.
      await expect(
        page.locator(`[data-testid="giorno-scelto"][data-giorno="${giorno}"]`),
      ).toHaveCount(1);
    }
    await expect(page.getByTestId("conteggio-giorni-duplicazione")).toHaveText(
      "3 giorni",
    );

    await page.getByTestId("conferma-duplicazione").click();

    const esito = page.getByTestId("esito-duplicazione");
    await expect(esito).toBeVisible();
    await expect(esito).toContainText("3 giorni");
    await expect(selettore(page)).toHaveCount(0);

    // L'esito compare dallo stato client, mentre la rilettura della giornata
    // innescata dalla duplicazione è ancora in corso: finché dura, il pulsante
    // di salvataggio è in attesa e si chiama «Salvataggio…». Il suo ritorno ad
    // «Aggiungi riga» è lo stato osservabile che distingue «esito mostrato» da
    // «aggiornamento concluso»: senza questa barriera il cambio giorno
    // successivo cadrebbe dentro l'aggiornamento in corso e verrebbe annullato.
    // È un'asserzione web-first su stato osservabile, non un hard wait.
    await expect(
      page.getByRole("button", { name: "Aggiungi riga" }),
    ).toBeEnabled();

    // ── AC-2: su ogni giorno di destinazione la riga è la stessa fotografia ──
    // L'ordine lascia per ultimo un giorno del mese di origine, così il ritorno
    // al calendario atterra su quel mese e il salto verso l'altro mese resta un
    // vero cambio mese fatto con i controlli dell'applicazione.
    //
    // Il primo giorno del ciclo è quello già visitato prima della duplicazione:
    // la sua voce in cache descrive una giornata vuota, quindi la riga può
    // comparire solo perché l'invalidazione ha raggiunto anche i giorni di
    // destinazione, non solo il giorno visualizzato.
    for (const giorno of [
      GIORNO_ALTRO_MESE,
      GIORNO_DESTINAZIONE_A,
      GIORNO_DESTINAZIONE_B,
    ]) {
      await vaiAlGiorno(page, giorno);

      const rigaReplicata = page
        .getByTestId("activity-row")
        .filter({ has: page.getByText(nota, { exact: true }) });

      await expect(rigaReplicata).toHaveCount(1);
      await expect(rigaReplicata).toContainText(RAGIONE_SOCIALE_ORIGINE);
      await expect(rigaReplicata).toContainText(
        clienteConOfferta.offerta.codice,
      );
      await expect(rigaReplicata).toContainText("6.0 h");
      await expect(rigaReplicata.getByText("Non fatturabile", { exact: true })).toBeVisible();
      await expect(rigaReplicata).toContainText(ETICHETTA_RIMBORSO);
      await expect(rigaReplicata).toContainText(IMPORTO_RIMBORSO_A_SCHERMO);
    }

    // ── AC-5: il mese di destinazione si accende senza alcun reload ──
    // Il mese diverso è in cache da prima della duplicazione, con la cella del
    // giorno duplicata ancora spenta: se l'invalidazione riguardasse il solo
    // mese del giorno visualizzato, il salto qui sotto servirebbe quella
    // fotografia e la cella resterebbe `data-con-attivita="false"`.
    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await expect(page).toHaveURL(`/attivita?mese=${MESE_ORIGINE}`);
    await expect(calendario).toBeVisible();
    await expect(calendario).toHaveAttribute("data-idratata", "true");

    await vaiAlMese(page, MESE_ALTRO, GIORNO_ALTRO_MESE);

    const cellaAltroMese = cellaDelGiorno(page, GIORNO_ALTRO_MESE, MESE_ALTRO);
    await expect(cellaAltroMese).toHaveAttribute("data-con-attivita", "true");
    await expect(cellaAltroMese.getByTestId("etichetta-cliente")).toHaveText(
      `${RAGIONE_SOCIALE_ORIGINE} 6.0 h`,
    );
    await expect(page).toHaveURL(`/attivita?mese=${MESE_ALTRO}`);
  });

  test("la conferma resta non disponibile a pista vuota e il giorno di origine non entra fra le destinazioni", async ({
    page,
    factory,
    collaboratore,
    namespace,
  }) => {
    await preparaRigaSorgente(factory, collaboratore, namespace);

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await apriGiornoOrigine(page);

    await cardRigaDi(page, RAGIONE_SOCIALE_ORIGINE)
      .getByTestId("duplica-riga")
      .click();
    await expect(selettore(page)).toBeVisible();

    // ── AC-3: nessuna data scelta, nessuna duplicazione possibile ──
    await expect(page.getByTestId("pista-duplicazione-vuota")).toBeVisible();
    await expect(page.getByTestId("conferma-duplicazione")).toBeDisabled();

    // Il giorno di origine viene rifiutato con un avviso e non entra in pista.
    await aggiungiGiornoDestinazione(page, GIORNO_ORIGINE);

    const avviso = page.getByTestId("avviso-duplicazione");
    await expect(avviso).toBeVisible();
    await expect(avviso).toContainText(
      "Il giorno di origine non è fra le destinazioni selezionabili.",
    );
    await expect(page.getByTestId("giorno-scelto")).toHaveCount(0);
    await expect(page.getByTestId("pista-duplicazione-vuota")).toBeVisible();
    await expect(page.getByTestId("conferma-duplicazione")).toBeDisabled();

    // Una data valida sblocca la conferma.
    await aggiungiGiornoDestinazione(page, GIORNO_DESTINAZIONE_A);

    await expect(page.getByTestId("giorno-scelto")).toHaveCount(1);
    await expect(page.getByTestId("conteggio-giorni-duplicazione")).toHaveText(
      "1 giorno",
    );
    await expect(page.getByTestId("conferma-duplicazione")).toBeEnabled();
  });

  test("la duplicazione di una riga su offerta non abilitata è rifiutata e non crea righe sul giorno scelto", async ({
    page,
    factory,
    collaboratore,
    namespace,
  }) => {
    await preparaRigaSorgente(factory, collaboratore, namespace);

    // Seconda riga sullo stesso giorno, su un'offerta attiva ma **non**
    // abilitata al collaboratore: è la riga storica della storia utente.
    const offertaNonAbilitata = await factory.createClienteConOfferta({
      ragioneSociale: RAGIONE_SOCIALE_NON_ABILITATA,
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: offertaNonAbilitata.cliente,
      offerta: offertaNonAbilitata.offerta,
      data: dataDb(GIORNO_ORIGINE),
      ore: "2.00",
      nota: `US-057 riga non abilitata ${namespace}`,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await apriGiornoOrigine(page);

    await cardRigaDi(page, RAGIONE_SOCIALE_NON_ABILITATA)
      .getByTestId("duplica-riga")
      .click();
    await expect(selettore(page)).toBeVisible();

    await aggiungiGiornoDestinazione(page, GIORNO_RIFIUTO);
    await expect(page.getByTestId("conteggio-giorni-duplicazione")).toHaveText(
      "1 giorno",
    );
    await page.getByTestId("conferma-duplicazione").click();

    // ── AC-4: errore visibile e nessun esito di duplicazione ──
    const errore = page.getByTestId("errore-duplicazione");
    await expect(errore).toBeVisible();
    await expect(errore).toHaveAttribute("role", "alert");
    await expect(errore).toContainText(
      "Non sei abilitato a registrare attività su questa offerta",
    );
    await expect(page.getByTestId("esito-duplicazione")).toHaveCount(0);

    // Il giorno scelto resta senza righe: il rifiuto non ha scritto nulla.
    await selettore(page).getByRole("button", { name: "Annulla" }).click();
    await expect(selettore(page)).toHaveCount(0);

    // Il giorno di destinazione viene aperto dal server, non dalla cache di
    // scheda: l'assenza di righe è così una lettura fresca del database, che è
    // esattamente ciò che AC-4 promette.
    await page.goto(`/attivita/${GIORNO_RIFIUTO}?mese=${MESE_ORIGINE}`);
    await expect(page.getByTestId("contenuto-giornata")).toBeVisible();

    await expect(
      cardRigaDi(page, RAGIONE_SOCIALE_NON_ABILITATA),
    ).toHaveCount(0);
    await expect(page.getByTestId("activity-row")).toHaveCount(0);
  });
});
