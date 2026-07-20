import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * US-034: Etichette cliente nel calendario mensile con ore cumulate
 *
 * Verifica che le celle del calendario mostrino, per ogni cliente con
 * attività nel giorno, un'etichetta con ragione sociale e ore cumulate
 * (sommate su più offerte dello stesso cliente) al posto dei vecchi codici
 * offerta; che il riepilogo giorno (numero righe, ore totali) resti
 * invariato; e che oltre due clienti compaia l'indicatore "+N".
 */

function dataDb(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00.000Z`);
}

test.describe("US-034 Etichette cliente nel calendario mensile", () => {
  test("mostra ragione sociale e ore cumulate al posto dei codici offerta, con indicatore +N oltre due clienti", async ({
    page,
    collaboratore,
    factory,
  }) => {
    const mese = meseRiservato("US-034");
    const data = dataNelMese(mese, 10);

    // Cliente A con due offerte: righe di 4h e 2h → 6h cumulate
    const clienteAConOffertaUno = await factory.createClienteConOfferta();
    const offertaADue = await factory.createOfferta({
      cliente: clienteAConOffertaUno.cliente,
    });

    // Cliente B con una sola offerta: riga di 3h
    const clienteBConOfferta = await factory.createClienteConOfferta();

    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteAConOffertaUno.cliente,
      offerta: clienteAConOffertaUno.offerta,
      data: dataDb(data),
      ore: "4.00",
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteAConOffertaUno.cliente,
      offerta: offertaADue,
      data: dataDb(data),
      ore: "2.00",
    });
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteBConOfferta.cliente,
      offerta: clienteBConOfferta.offerta,
      data: dataDb(data),
      ore: "3.00",
    });

    await accediComeCollaboratore(page, collaboratore.utente.email);
    await page.goto(`/attivita?mese=${mese}`);
    await expect(
      page.getByLabel("Calendario mensile delle attività"),
    ).toBeVisible();

    const cella = page.locator(`a[href="/attivita/${data}?mese=${mese}"]`);
    await expect(cella).toHaveAttribute("data-con-attivita", "true");

    // AC-1/AC-2: due etichette cliente con ragione sociale + ore cumulate;
    // il codice dell'offerta A1 non compare più nel testo della cella.
    const etichetteCliente = cella.getByTestId("etichetta-cliente");
    await expect(etichetteCliente).toHaveCount(2);
    await expect(etichetteCliente.nth(0)).toHaveText(
      `${clienteAConOffertaUno.cliente.ragioneSociale} 6.0 h`,
    );
    await expect(etichetteCliente.nth(1)).toHaveText(
      `${clienteBConOfferta.cliente.ragioneSociale} 3.0 h`,
    );
    await expect(cella).not.toContainText(
      clienteAConOffertaUno.offerta.codice,
    );

    // AC-4: il riepilogo giorno (numero righe, ore totali) resta invariato.
    await expect(cella.getByText("3", { exact: true })).toBeVisible();
    await expect(cella.getByText("9.0 h", { exact: true })).toBeVisible();

    // AC-3: un terzo cliente nello stesso giorno introduce l'indicatore "+1"
    // dopo le prime due etichette, che restano quelle di A e B.
    const clienteCConOfferta = await factory.createClienteConOfferta();
    await factory.createRigaAttivita({
      collaboratore,
      cliente: clienteCConOfferta.cliente,
      offerta: clienteCConOfferta.offerta,
      data: dataDb(data),
      ore: "1.00",
    });

    await page.reload();
    await expect(
      page.getByLabel("Calendario mensile delle attività"),
    ).toBeVisible();

    await expect(etichetteCliente).toHaveCount(2);
    await expect(etichetteCliente.nth(0)).toHaveText(
      `${clienteAConOffertaUno.cliente.ragioneSociale} 6.0 h`,
    );
    await expect(etichetteCliente.nth(1)).toHaveText(
      `${clienteBConOfferta.cliente.ragioneSociale} 3.0 h`,
    );
    await expect(cella.getByTestId("indicatore-altri-clienti")).toHaveText(
      "+1",
    );
  });
});
