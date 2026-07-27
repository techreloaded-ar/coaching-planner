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

  test("AC-3: senza offerte abilitate compare l'avviso e il salvataggio è bloccato", async ({
    page,
    factory,
  }) => {
    const collaboratore = await factory.createCollaboratore();
    const clienteConOfferta = await factory.createClienteConOfferta(
      {},
      { attiva: true },
    );

    await accediComeCollaboratore(page, collaboratore.utente.email);

    const mese = meseRiservato("US-043");
    const data = dataNelMese(mese, 13);
    await page.goto(`/attivita/${data}?mese=${mese}`);

    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");

    await expect(selectCliente).toContainText(
      clienteConOfferta.cliente.ragioneSociale,
    );
    await selectCliente.selectOption(clienteConOfferta.cliente.id);
    await expect(selectCliente).toHaveValue(clienteConOfferta.cliente.id);

    await expect(selectOfferta).toBeEnabled();
    await expect
      .poll(async () => selectOfferta.locator("option").count())
      .toBe(1);

    await expect(
      page.getByTestId("nessuna-offerta-abilitata"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Aggiungi riga" }),
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
