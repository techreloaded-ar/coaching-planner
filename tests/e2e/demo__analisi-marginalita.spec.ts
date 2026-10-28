import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import { creaDatasetMarginalita } from "./support/marginalita-data";

/**
 * Demo scenario — US-017: Analisi della marginalità per cliente e offerta.
 *
 * L'amministratore apre "Marginalità" dalla sidebar, seleziona un periodo di
 * due mesi e vede ricavi, costi e margine del cliente e delle sue offerte, con
 * il margine negativo evidenziato.
 *
 * Registra un video per la review.
 */

const formattatoreEuro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

function formattaEuro(valore: number): string {
  return formattatoreEuro.format(valore);
}

test.use({
  video: "on",
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 300 },
});

test.describe("US-017 Demo", () => {
  test("l'amministratore confronta ricavi e costi per periodo e vede il margine negativo", async ({
    page,
    factory,
  }) => {
    test.setTimeout(60_000);

    const { cliente, offertaA, offertaB, meseUno, meseDue } =
      await creaDatasetMarginalita(factory);

    // ── 1. Accede alla console e apre "Marginalità" dalla sidebar ──
    await accediAlBackOfficeComeAdmin(page);
    await page.getByRole("link", { name: "Marginalità", exact: true }).click();
    await page.waitForURL("**/report/marginalita");
    await expect(
      page.getByRole("heading", { name: "Marginalità per cliente e offerta" }),
    ).toBeVisible();

    // ── 2. Seleziona il periodo di due mesi e applica ──────────────
    await page.getByLabel("Dal mese", { exact: true }).fill(meseUno);
    await page.getByLabel("Al mese", { exact: true }).fill(meseDue);
    await page.getByRole("button", { name: "Applica", exact: true }).click();
    await page.waitForURL(`**/report/marginalita?da=${meseUno}&a=${meseDue}`);

    // ── 3. Ricavi, costi e margine del cliente ─────────────────────
    const schedaCliente = page.getByTestId(`marginalita-cliente-${cliente.id}`);
    await expect(schedaCliente).toBeVisible();
    await expect(
      schedaCliente.getByText(formattaEuro(1200), { exact: true }).first(),
    ).toBeVisible();

    // ── 4. Dettaglio per offerta: A in utile, B in perdita ─────────
    const rigaA = page.getByTestId(`marginalita-offerta-${offertaA.id}`);
    await expect(rigaA.getByRole("cell").nth(5)).toHaveText(formattaEuro(300));
    const rigaB = page.getByTestId(`marginalita-offerta-${offertaB.id}`);
    await expect(rigaB.getByRole("cell").nth(5)).toContainText(
      formattaEuro(-200),
    );
    await expect(rigaB.getByText("Margine negativo")).toBeVisible();

    // ── 5. Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
