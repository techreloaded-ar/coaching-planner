import type { Locator, Page } from "@playwright/test";

import { accediComeAdmin, accediComeCollaboratore } from "./support/auth";
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
import { e2ePrisma } from "./support/prisma";

/**
 * Copia e incolla di una riga attività sul calendario mensile: «Copia su altri
 * giorni» dal dettaglio giornata, «Copia» dalla cella del calendario e dalla
 * vista Elenco, modalità incolla con il vassoio degli appunti.
 *
 * Ogni scenario crea il proprio collaboratore, cliente, offerta e righe con la
 * factory: i giorni riservati sono gli stessi per tutti i test del file, ma le
 * righe di un collaboratore non compaiono mai sul calendario di un altro. Le
 * asserzioni restano ancorate a ragione sociale, codice offerta e nota creati
 * dal test, mai a totali globali del mese.
 *
 * Il "secondo mese" è quello immediatamente precedente al mese riservato:
 * lo si raggiunge con la freccia «Mese precedente» durante la modalità incolla.
 */

// Il suffisso sceglie una chiave il cui mese, e il precedente, non collidono
// con i mesi riservati di altre spec (guardrail `lint:e2e-guardrails`).
const CODICE_SPEC = "COPIA-INCOLLA-RIGA-7";

const MESE = meseRiservato(CODICE_SPEC);
const MESE_PRECEDENTE = mesePassatoRiservato(CODICE_SPEC);
const GIORNO_ORIGINE = dataNelMeseRiservato(CODICE_SPEC, 11);
const GIORNO_A = dataNelMeseRiservato(CODICE_SPEC, 17);
const GIORNO_B = dataNelMeseRiservato(CODICE_SPEC, 24);
const GIORNO_TOLTO = dataNelMeseRiservato(CODICE_SPEC, 4);
const GIORNO_MESE_PRECEDENTE = dataNelMesePassatoRiservato(CODICE_SPEC, 9);
/** Giorno con una riga su offerta non abilitata, per il menu della cella. */
const GIORNO_NON_ABILITATA = dataNelMeseRiservato(CODICE_SPEC, 13);

const ETICHETTA_RIMBORSO = "Trasferta copia e incolla";
const IMPORTO_RIMBORSO = "85.00";
const IMPORTO_RIMBORSO_A_SCHERMO = /85,00\s*€/;

/** Scrittura del giorno civile con la stessa convenzione UTC dell'applicazione. */
function dataDb(giorno: string): Date {
  return new Date(`${giorno}T12:00:00.000Z`);
}

type Sorgente = {
  clienteConOfferta: ClienteConOffertaTestData;
  abilitazioneId: string;
  nota: string;
};

/**
 * Riga sorgente completa — ore, nota, categoria non predefinita e rimborso già
 * fotografato — su un'offerta attiva abilitata al collaboratore.
 */
async function preparaRigaSorgente(
  factory: E2eDataFactory,
  collaboratore: CollaboratoreTestData,
  namespace: string,
  giorno = GIORNO_ORIGINE,
): Promise<Sorgente> {
  const clienteConOfferta = await factory.createClienteConOfferta({
    ragioneSociale: `E2E Copia ${namespace}`.slice(0, 60),
  });
  const abilitazione = await factory.createAbilitazioneOfferta({
    collaboratore,
    offerta: clienteConOfferta.offerta,
  });
  const nota = `Copia e incolla ${namespace}`;
  await factory.createRigaAttivita({
    collaboratore,
    cliente: clienteConOfferta.cliente,
    offerta: clienteConOfferta.offerta,
    data: dataDb(giorno),
    ore: "6.00",
    nota,
    categoria: "NON_FATTURABILE",
    rimborsoTrasfertaEtichetta: ETICHETTA_RIMBORSO,
    rimborsoTrasfertaImporto: IMPORTO_RIMBORSO,
  });
  return { clienteConOfferta, abilitazioneId: abilitazione.id, nota };
}

function vassoio(page: Page): Locator {
  return page.getByTestId("vassoio-appunti");
}

/** Cella di un giorno: link fuori dalla modalità incolla, pulsante dentro. */
function cella(page: Page, giorno: string): Locator {
  return page.locator(`[data-testid="cella-giorno"][data-giorno="${giorno}"]`);
}

async function attendiCalendarioIdratato(page: Page) {
  const calendario = page.getByLabel("Calendario mensile delle attività");
  await expect(calendario).toBeVisible();
  await expect(calendario).toHaveAttribute("data-idratata", "true");
}

async function apriGiorno(page: Page, giorno: string, query = "") {
  await page.goto(`/attivita/${giorno}?mese=${giorno.slice(0, 7)}${query}`);
  const contenuto = page.getByTestId("contenuto-giornata");
  await expect(contenuto).toBeVisible();
  await expect(contenuto).toHaveAttribute("data-idratata", "true");
}

function rigaConNota(page: Page, nota: string): Locator {
  return page
    .getByTestId("activity-row")
    .filter({ has: page.getByText(nota, { exact: true }) });
}

test.describe("Copia e incolla di una riga sul calendario", () => {
  test("dal dettaglio giornata la riga si incolla su giorni scelti in due mesi, con anteprima, origine bloccata ed esito senza reload", async ({
    page,
    factory,
    collaboratore,
    namespace,
  }) => {
    // Lo scenario attraversa due mesi e tre giornate: il budget di default non
    // basta su route fredde. Non è un'attesa, è un limite di tempo.
    test.setTimeout(120_000);
    const { clienteConOfferta, nota } = await preparaRigaSorgente(
      factory,
      collaboratore,
      namespace,
    );
    const ragioneSociale = clienteConOfferta.cliente.ragioneSociale;

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await apriGiorno(page, GIORNO_ORIGINE);

    // «Duplica…» non esiste più: al suo posto «Copia su altri giorni».
    const card = rigaConNota(page, nota);
    await expect(card.getByRole("button", { name: "Duplica…" })).toHaveCount(0);
    await card.getByRole("button", { name: "Copia su altri giorni" }).click();

    // ── Calendario del mese in modalità incolla ──
    await expect(page).toHaveURL(`/attivita?mese=${MESE}`);
    await attendiCalendarioIdratato(page);
    await expect(vassoio(page)).toBeVisible();
    await expect(vassoio(page).getByTestId("riga-appunti")).toContainText(ragioneSociale);
    await expect(vassoio(page).getByTestId("riga-appunti")).toContainText(
      clienteConOfferta.offerta.codice,
    );
    await expect(vassoio(page).getByTestId("riga-appunti")).toContainText("non fatturabile");
    await expect(vassoio(page).getByTestId("rimborso-appunti")).toContainText(ETICHETTA_RIMBORSO);
    await expect(cella(page, GIORNO_ORIGINE).getByTestId("etichetta-origine")).toBeVisible();
    await expect(page.getByTestId("conferma-incolla")).toBeDisabled();

    // Il giorno di origine non entra fra le destinazioni. È un pulsante con
    // `aria-disabled`: lo si attiva da tastiera, come farebbe una persona.
    await cella(page, GIORNO_ORIGINE).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("avviso-incolla")).toHaveText(
      "Il giorno di origine non è una destinazione.",
    );
    await expect(page.getByTestId("nessuna-destinazione")).toBeVisible();

    // Un clic aggiunge, un secondo toglie.
    for (const giorno of [GIORNO_A, GIORNO_TOLTO, GIORNO_B]) {
      await cella(page, giorno).click();
      await expect(cella(page, giorno)).toHaveAttribute("aria-pressed", "true");
    }
    await cella(page, GIORNO_TOLTO).click();
    await expect(cella(page, GIORNO_TOLTO)).toHaveAttribute("aria-pressed", "false");

    // Il giorno scelto mostra la riga in anteprima e il totale risultante.
    await expect(cella(page, GIORNO_A).getByTestId("anteprima-incolla")).toContainText(
      ragioneSociale,
    );
    await expect(cella(page, GIORNO_A).getByTestId("totali-giorno")).toHaveText("6 h");

    // ── La selezione resta cambiando mese ──
    await page.getByRole("button", { name: "Mese precedente" }).click();
    await expect(page).toHaveURL(`/attivita?mese=${MESE_PRECEDENTE}`);
    await cella(page, GIORNO_MESE_PRECEDENTE).click();
    await expect(cella(page, GIORNO_MESE_PRECEDENTE)).toHaveAttribute("aria-pressed", "true");

    const gruppi = vassoio(page).getByTestId("gruppo-destinazioni");
    await expect(gruppi).toHaveCount(2);
    await expect(vassoio(page).locator(`[data-mese="${MESE}"]`)).toContainText("17 · 24");
    await expect(page.getByTestId("conferma-incolla")).toHaveText(/Incolla su 3 giorni/);

    // ── Conferma unica ──
    await page.getByTestId("conferma-incolla").click();
    const esito = page.getByTestId("esito-incolla");
    await expect(esito).toBeVisible();
    await expect(esito).toContainText("Riga incollata su 3 giorni");
    await expect(vassoio(page)).toHaveCount(0);

    // La cella del mese mostrato si valorizza senza ricaricare la pagina.
    const cellaIncollata = cella(page, GIORNO_MESE_PRECEDENTE);
    await expect(cellaIncollata).toHaveAttribute("data-con-attivita", "true");
    await expect(cellaIncollata.getByTestId("etichetta-cliente")).toContainText(ragioneSociale);

    // Anche il mese di origine, già in cache prima dell'incolla, è aggiornato.
    await page.getByRole("button", { name: "Mese successivo" }).click();
    await expect(page).toHaveURL(`/attivita?mese=${MESE}`);
    await expect(cella(page, GIORNO_A)).toHaveAttribute("data-con-attivita", "true");
    await expect(cella(page, GIORNO_B)).toHaveAttribute("data-con-attivita", "true");
    await expect(cella(page, GIORNO_TOLTO)).toHaveAttribute("data-con-attivita", "false");

    // ── La riga incollata è identica all'originale, rimborso compreso ──
    await cella(page, GIORNO_B).click();
    await expect(page).toHaveURL(`/attivita/${GIORNO_B}?mese=${MESE}`);
    const copia = rigaConNota(page, nota);
    await expect(copia).toHaveCount(1);
    await expect(copia).toContainText(ragioneSociale);
    await expect(copia).toContainText(clienteConOfferta.offerta.codice);
    await expect(copia).toContainText("6 h");
    await expect(copia.getByText("Non fatturabile", { exact: true })).toBeVisible();
    await expect(copia).toContainText(ETICHETTA_RIMBORSO);
    await expect(copia).toContainText(IMPORTO_RIMBORSO_A_SCHERMO);
  });

  test("Esc e «Annulla» escono dalla modalità incolla senza creare righe; la cella con una sola riga avvia subito la copia", async ({
    page,
    factory,
    collaboratore,
    namespace,
  }) => {
    const { nota } = await preparaRigaSorgente(factory, collaboratore, namespace);

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita?mese=${MESE}`);
    await attendiCalendarioIdratato(page);

    // Il clic sulla cella apre ancora il giorno: «Copia» è un'azione distinta.
    await expect(vassoio(page)).toHaveCount(0);
    await page.getByRole("button", { name: /^Copia una riga del 11 / }).click();
    await expect(vassoio(page)).toBeVisible();
    await expect(cella(page, GIORNO_ORIGINE).getByTestId("etichetta-origine")).toBeVisible();

    // Esc esce senza scrivere nulla.
    await cella(page, GIORNO_A).click();
    await expect(cella(page, GIORNO_A)).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(vassoio(page)).toHaveCount(0);
    await expect(cella(page, GIORNO_A)).toHaveAttribute("data-con-attivita", "false");

    // «Annulla» esce senza scrivere nulla.
    await page.getByRole("button", { name: /^Copia una riga del 11 / }).click();
    await expect(vassoio(page)).toBeVisible();
    // Da tastiera: il giorno è raggiungibile e si sceglie con Invio.
    await cella(page, GIORNO_B).focus();
    await page.keyboard.press("Enter");
    await expect(cella(page, GIORNO_B)).toHaveAttribute("aria-pressed", "true");
    await vassoio(page).getByRole("button", { name: "Annulla" }).click();
    await expect(vassoio(page)).toHaveCount(0);

    // Lettura dal server: nessuno dei giorni toccati ha ricevuto la riga.
    for (const giorno of [GIORNO_A, GIORNO_B]) {
      await apriGiorno(page, giorno);
      await expect(rigaConNota(page, nota)).toHaveCount(0);
    }
  });

  test("su un giorno con più righe la cella apre il menu di scelta; una riga su offerta non abilitata non è copiabile, con il motivo", async ({
    page,
    factory,
    collaboratore,
    namespace,
  }) => {
    const { clienteConOfferta } = await preparaRigaSorgente(factory, collaboratore, namespace);
    // Seconda riga copiabile sullo stesso giorno, con ore diverse.
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: dataDb(GIORNO_ORIGINE),
      ore: "2.50",
      nota: `Seconda riga ${namespace}`,
    });
    // Riga storica su un'offerta mai abilitata al collaboratore.
    const nonAbilitata = await factory.createClienteConOfferta({
      ragioneSociale: `E2E Non abilitata ${namespace}`.slice(0, 60),
    });
    const notaNonAbilitata = `Riga non abilitata ${namespace}`;
    await factory.createRigaAttivita({
      collaboratore,
      cliente: nonAbilitata.cliente,
      offerta: nonAbilitata.offerta,
      data: dataDb(GIORNO_NON_ABILITATA),
      ore: "8.00",
      nota: notaNonAbilitata,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita?mese=${MESE}`);
    await attendiCalendarioIdratato(page);

    // ── Due righe copiabili: il menu le elenca e si sceglie la seconda ──
    await page.getByRole("button", { name: /^Copia una riga del 11 / }).click();
    const menu = page.getByTestId("menu-copia-giorno");
    await expect(menu).toBeVisible();
    await expect(menu.getByTestId("voce-menu-copia")).toHaveCount(2);
    await expect(menu).toContainText(ETICHETTA_RIMBORSO);

    // Esc chiude il menu senza effetti.
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(vassoio(page)).toHaveCount(0);

    await page.getByRole("button", { name: /^Copia una riga del 11 / }).click();
    await menu.getByRole("button", { name: /2,5 h$/ }).click();
    await expect(menu).toHaveCount(0);
    await expect(vassoio(page).getByTestId("riga-appunti")).toContainText("2,5 h");
    await expect(cella(page, GIORNO_ORIGINE).getByTestId("etichetta-origine")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(vassoio(page)).toHaveCount(0);

    // ── Unica riga non copiabile: il menu la mostra spenta, con il motivo ──
    await page.getByRole("button", { name: /^Copia una riga del 13 / }).click();
    await expect(menu).toBeVisible();
    const voce = menu.getByTestId("voce-menu-copia");
    await expect(voce).toHaveAttribute("data-copiabile", "false");
    await expect(voce.getByTestId("motivo-non-copiabile")).toHaveText("Offerta non più abilitata");
    await expect(voce.getByRole("button", { name: /^Copia la riga/ })).toBeDisabled();

    // Un clic fuori chiude il menu senza effetti.
    await page.getByRole("group", { name: "Legenda del calendario" }).click();
    await expect(menu).toHaveCount(0);
    await expect(vassoio(page)).toHaveCount(0);

    // ── Nel dettaglio giornata «Copia su altri giorni» è spento, con il motivo ──
    await apriGiorno(page, GIORNO_NON_ABILITATA);
    const card = rigaConNota(page, notaNonAbilitata);
    await expect(card.getByRole("button", { name: "Copia su altri giorni" })).toBeDisabled();
    await expect(card.getByTestId("motivo-non-copiabile")).toHaveText("Offerta non più abilitata");
  });

  test("dalla vista Elenco «Copia» porta al calendario in modalità incolla e le righe nuove compaiono nell'elenco del mese", async ({
    page,
    factory,
    collaboratore,
    namespace,
  }) => {
    const { nota } = await preparaRigaSorgente(factory, collaboratore, namespace);

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita?vista=elenco&mese=${MESE}`);
    const elenco = page.getByLabel("Elenco delle attività del mese");
    await expect(elenco).toHaveAttribute("data-idratata", "true");

    const riga = page.getByTestId("riga-elenco").filter({ hasText: nota });
    await riga.getByRole("button", { name: /^Copia la riga del / }).click();

    await expect(page).toHaveURL(`/attivita?mese=${MESE}`);
    await attendiCalendarioIdratato(page);
    await expect(vassoio(page)).toBeVisible();
    await cella(page, GIORNO_A).click();
    await cella(page, GIORNO_B).click();
    await page.getByTestId("conferma-incolla").click();
    await expect(page.getByTestId("esito-incolla")).toContainText("Riga incollata su 2 giorni");

    await page.getByRole("link", { name: "Elenco" }).click();
    await expect(page).toHaveURL(`/attivita?mese=${MESE}&vista=elenco`);
    await expect(page.getByTestId("riga-elenco").filter({ hasText: nota })).toHaveCount(3);
  });

  test("se l'abilitazione viene meno dopo la copia la conferma è rifiutata nel vassoio, la selezione resta e nessuna riga è creata", async ({
    page,
    factory,
    collaboratore,
    namespace,
  }) => {
    const { abilitazioneId, nota } = await preparaRigaSorgente(
      factory,
      collaboratore,
      namespace,
    );

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await apriGiorno(page, GIORNO_ORIGINE);
    await rigaConNota(page, nota).getByRole("button", { name: "Copia su altri giorni" }).click();
    await attendiCalendarioIdratato(page);
    await cella(page, GIORNO_A).click();
    await expect(cella(page, GIORNO_A)).toHaveAttribute("aria-pressed", "true");

    // L'abilitazione del test viene revocata mentre la riga è negli appunti.
    await e2ePrisma.query(`DELETE FROM "AbilitazioneOfferta" WHERE id = $1`, [abilitazioneId]);

    await page.getByTestId("conferma-incolla").click();
    const errore = page.getByTestId("errore-incolla");
    await expect(errore).toBeVisible();
    await expect(errore).toContainText("nessuna riga è stata creata");
    await expect(errore).toContainText("non è più abilitata");
    await expect(vassoio(page)).toBeVisible();
    await expect(cella(page, GIORNO_A)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("esito-incolla")).toHaveCount(0);

    await apriGiorno(page, GIORNO_A);
    await expect(rigaConNota(page, nota)).toHaveCount(0);
  });

  test("sul foglio consultato da un amministratore la riga incollata è intestata al collaboratore", async ({
    page,
    factory,
    collaboratore,
    namespace,
  }) => {
    const { nota } = await preparaRigaSorgente(factory, collaboratore, namespace);
    const amministratore = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
    const foglio = `&collaboratore=${collaboratore.collaboratore.id}`;

    await accediComeAdmin(page, amministratore.email);
    await page.goto(`/attivita?mese=${MESE}${foglio}`);
    await attendiCalendarioIdratato(page);

    await page.getByRole("button", { name: /^Copia una riga del 11 / }).click();
    await expect(vassoio(page)).toBeVisible();
    await cella(page, GIORNO_A).click();
    await page.getByTestId("conferma-incolla").click();
    await expect(page.getByTestId("esito-incolla")).toContainText("Riga incollata su 1 giorno");

    await apriGiorno(page, GIORNO_A, foglio);
    await expect(rigaConNota(page, nota)).toHaveCount(1);
  });
});
