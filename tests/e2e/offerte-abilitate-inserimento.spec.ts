import {
  attendiOfferteCaricate,
  labelOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { meseRiservato, dataNelMese } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * US-043: Inserimento ore consentito solo sulle offerte abilitate
 *
 * Verifica che la select delle offerte proponga solo le offerte abilitate
 * per il collaboratore (AC-1), che l'assenza di offerte abilitate blocchi
 * il salvataggio con un messaggio esplicito (AC-3), e che una riga
 * preesistente su un'offerta non abilitata resti modificabile ed
 * eliminabile dal suo proprietario (AC-4).
 *
 * Dopo US-049 il percorso "nuova riga su un cliente non abilitato" è precluso
 * a monte: la select clienti elenca solo i clienti con offerte abilitate.
 * Il banner AC-3 protegge quindi l'unico percorso ancora raggiungibile, cioè
 * il cambio cliente esplicito durante la modifica di una riga storica.
 */

test.describe("US-043 Inserimento ore consentito solo sulle offerte abilitate", () => {
  test("AC-1: la select offerte propone solo l'offerta abilitata del cliente", async ({
    page,
    factory,
  }) => {
    const collaboratore = await factory.createCollaboratore();
    const cliente = await factory.createCliente();
    const offertaAbilitata = await factory.createOfferta({
      cliente,
      attiva: true,
    });
    const offertaNonAbilitata = await factory.createOfferta({
      cliente,
      attiva: true,
    });
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: offertaAbilitata,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);

    const mese = meseRiservato("US-043");
    const data = dataNelMese(mese, 12);
    await page.goto(`/attivita/${data}?mese=${mese}`);

    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");

    await expect(selectCliente).toContainText(cliente.ragioneSociale);
    await selectCliente.selectOption(cliente.id);
    await expect(selectCliente).toHaveValue(cliente.id);

    await attendiOfferteCaricate(selectOfferta);

    const labelAbilitata = labelOffertaTest({
      cliente,
      offerta: offertaAbilitata,
    });
    const labelNonAbilitata = labelOffertaTest({
      cliente,
      offerta: offertaNonAbilitata,
    });

    await expect(selectOfferta).toContainText(labelAbilitata);
    await expect(selectOfferta).not.toContainText(labelNonAbilitata);
  });

  test("AC-3: tornando in modifica su un cliente senza offerte abilitate compare l'avviso e il salvataggio è bloccato", async ({
    page,
    factory,
  }) => {
    const collaboratore = await factory.createCollaboratore();

    // Cliente della riga storica: offerta attiva ma nessuna abilitazione
    const clienteNonAbilitato = await factory.createClienteConOfferta(
      {},
      { attiva: true },
    );

    // Cliente abilitato: unico presente nella select in modalità nuova riga
    const clienteAbilitato = await factory.createClienteConOfferta(
      {},
      { attiva: true },
    );
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: clienteAbilitato.offerta,
    });

    const mese = meseRiservato("US-043");
    const data = dataNelMese(mese, 13);
    const rigaEsistente = await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteNonAbilitato.cliente,
      offerta: clienteNonAbilitato.offerta,
      data: new Date(`${data}T00:00:00.000Z`),
      ore: "4.00",
      nota: `Riga AC-3 ${collaboratore.collaboratore.id}`,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${data}?mese=${mese}`);

    const rigaCard = page
      .getByTestId("activity-row")
      .filter({ hasText: rigaEsistente.nota ?? "" });
    await expect(rigaCard).toBeVisible();
    await rigaCard.getByRole("button", { name: "Modifica" }).click();

    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");

    await expect(selectOfferta).toHaveValue(clienteNonAbilitato.offerta.id);

    // Cambio cliente esplicito verso quello abilitato: le sue offerte si caricano
    await selectCliente.selectOption(clienteAbilitato.cliente.id);
    await attendiOfferteCaricate(selectOfferta);
    await expect(selectOfferta).toContainText(
      labelOffertaTest(clienteAbilitato),
    );

    // Il cliente della riga in modifica resta selezionabile (US-049 AC-3):
    // tornandoci esplicitamente, l'assenza di offerte abilitate è segnalata
    await selectCliente.selectOption(clienteNonAbilitato.cliente.id);
    await expect(selectCliente).toHaveValue(clienteNonAbilitato.cliente.id);

    await expect(page.getByTestId("nessuna-offerta-abilitata")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Salva modifiche" }),
    ).toBeDisabled();
  });

  test("AC-4: una riga su offerta non abilitata resta modificabile ed eliminabile", async ({
    page,
    factory,
  }) => {
    const collaboratore = await factory.createCollaboratore();
    const clienteConOfferta = await factory.createClienteConOfferta(
      {},
      { attiva: true },
    );
    const mese = meseRiservato("US-043");
    const data = dataNelMese(mese, 14);
    const rigaEsistente = await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteConOfferta.cliente,
      offerta: clienteConOfferta.offerta,
      data: new Date(`${data}T00:00:00.000Z`),
      ore: "4.00",
      nota: `Riga AC-4 ${collaboratore.collaboratore.id}`,
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita/${data}?mese=${mese}`);

    const rigaCard = page
      .getByTestId("activity-row")
      .filter({ hasText: rigaEsistente.nota ?? "" });
    await expect(rigaCard).toBeVisible();
    await expect(rigaCard).toContainText("4.0 h");

    // Modifica: cambia le ore e salva
    await rigaCard.getByRole("button", { name: "Modifica" }).click();

    const inputOre = page.locator("#ore");
    const selectOfferta = page.locator("#offerta");
    await expect(inputOre).toHaveValue("4");
    // Il form carica l'offerta corrente in modo asincrono: attendi che
    // offertaId sia effettivamente valorizzato prima di salvare, altrimenti
    // il submit parte con offertaId vuoto e viene bloccato lato client.
    await expect(selectOfferta).toHaveValue(clienteConOfferta.offerta.id);
    await inputOre.fill("6");
    await page.getByRole("button", { name: "Salva modifiche" }).click();

    const rigaCardAggiornata = page
      .getByTestId("activity-row")
      .filter({ hasText: rigaEsistente.nota ?? "" });
    await expect(rigaCardAggiornata).toContainText("6.0 h");

    // Elimina: gestisci il confirm nativo
    page.once("dialog", (dialog) => {
      void dialog.accept();
    });
    await rigaCardAggiornata.getByRole("button", { name: "Elimina" }).click();

    await expect(rigaCardAggiornata).toBeHidden();
    await expect(
      page.getByText("Nessuna attività registrata per questa giornata."),
    ).toBeVisible();
  });
});
