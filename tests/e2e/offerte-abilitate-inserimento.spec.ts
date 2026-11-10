import {
  attendiOfferteCaricate,
  labelOffertaTest,
} from "./demo__inserimento-righe-attivita.helpers";
import { accediComeCollaboratore } from "./support/auth";
import { meseRiservato, dataNelMese } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Offerte abilitate e non abilitate nel form riga attività.
 *
 * La select delle offerte propone tutte le offerte attive del cliente in due
 * gruppi, «Offerte abilitate» e «Offerte non abilitate», e mai quelle
 * disattivate. Scegliendo un'offerta non abilitata compare un avviso giallo
 * che non blocca il salvataggio. Una riga preesistente su un'offerta non
 * abilitata resta modificabile ed eliminabile dal suo proprietario (US-043 AC-4).
 */

test.describe("Offerte abilitate e non abilitate nel form riga attività", () => {
  test("la select offerte raggruppa abilitate e non abilitate ed esclude le disattivate", async ({
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
    const offertaDisattivata = await factory.createOfferta({
      cliente,
      attiva: false,
    });
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: offertaAbilitata,
    });
    await factory.createAbilitazioneOfferta({
      collaboratore,
      offerta: offertaDisattivata,
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

    await expect(
      selectOfferta.locator('optgroup[label="Offerte abilitate"]'),
    ).toContainText(labelOffertaTest({ cliente, offerta: offertaAbilitata }));
    await expect(
      selectOfferta.locator('optgroup[label="Offerte non abilitate"]'),
    ).toContainText(labelOffertaTest({ cliente, offerta: offertaNonAbilitata }));
    await expect(selectOfferta).not.toContainText(
      labelOffertaTest({ cliente, offerta: offertaDisattivata }),
    );
    await expect(page.getByTestId("offerta-non-abilitata")).toHaveCount(0);
  });

  test("su un'offerta non abilitata compare l'avviso e il salvataggio è comunque consentito", async ({
    page,
    factory,
  }) => {
    const collaboratore = await factory.createCollaboratore();
    const clienteConOfferta = await factory.createClienteConOfferta(
      {},
      { attiva: true },
    );
    const nota = `Riga su offerta non abilitata ${collaboratore.collaboratore.id}`;

    await accediComeCollaboratore(page, collaboratore.utente.email);

    const mese = meseRiservato("US-043");
    const data = dataNelMese(mese, 13);
    await page.goto(`/attivita/${data}?mese=${mese}`);

    const selectCliente = page.locator("#cliente");
    const selectOfferta = page.locator("#offerta");

    await expect(
      selectCliente.locator('optgroup[label="Altri clienti"]'),
    ).toContainText(clienteConOfferta.cliente.ragioneSociale);
    await selectCliente.selectOption(clienteConOfferta.cliente.id);
    await attendiOfferteCaricate(selectOfferta);
    await selectOfferta.selectOption(clienteConOfferta.offerta.id);

    await expect(page.getByTestId("offerta-non-abilitata")).toHaveText(
      "Stai aggiungendo ore su un'offerta a cui non sei abilitato. Richiedi l'abilitazione.",
    );

    await page.locator("#ore").fill("3");
    await page.locator("#nota").fill(nota);
    await page.getByRole("button", { name: "Aggiungi riga" }).click();

    const rigaCard = page.getByTestId("activity-row").filter({ hasText: nota });
    await expect(rigaCard).toContainText(clienteConOfferta.offerta.codice);
    await expect(rigaCard).toContainText("3 h");
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
    await expect(rigaCard).toContainText("4 h");

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
    await expect(rigaCardAggiornata).toContainText("6 h");

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
