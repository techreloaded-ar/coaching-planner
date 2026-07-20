import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import {
  apriPaginaOfferte,
  attendiTabellaOfferteIdratata,
} from "./support/offerte";

/**
 * Demo scenario — US-035: Riga compatta nell'elenco offerte con giorni
 * erogati aggregati e stato a indicatore.
 *
 * Ripercorre la Dimostrazione della spec: l'amministratore apre "Offerte"
 * dalla sidebar a una larghezza desktop di 1366px e osserva che tutte le
 * colonne, inclusi i pulsanti Modifica ed Elimina, sono visibili senza
 * scorrimento orizzontale, con la colonna unica "Giorni erogati" nel formato
 * "erogate/previste". Espande poi un'offerta attiva e clicca il suo
 * indicatore circolare di stato: l'offerta diventa non attiva (indicatore
 * grigio) e la riga resta espansa.
 *
 * Il flusso MUTA dati (cambia lo stato di un'offerta): per il contratto e2e
 * (AGENTS.md) usa quindi esclusivamente entità create dalla factory, mai i
 * seed (TechSolutions, DataFlow, GreenEnergy…).
 *
 * Non registra video: la registrazione per la review è a cura della fase
 * successiva (archetipo-review via `archetipo e2e demo`), qui il test gira
 * headless. slowMo e la pausa finale servono solo al ritmo di registrazione.
 */

function normalizzaSpazi(valore: string): RegExp {
  return new RegExp(valore.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

/**
 * Individua la riga della tabella "Elenco offerte" relativa a un'offerta,
 * filtrando per il suo codice (univoco, mostrato nel badge della prima cella).
 */
function rigaOfferta(page: Page, codice: string): Locator {
  return page.getByRole("row", { name: normalizzaSpazi(codice) });
}

function pulsanteDettaglio(riga: Locator, codice: string): Locator {
  return riga.getByRole("button", {
    name: `Dettaglio avanzamento ${codice}`,
  });
}

function dettaglioOfferta(page: Page, codice: string): Locator {
  return page.getByRole("region", {
    name: `Dettaglio avanzamento ${codice}`,
  });
}

test.use({
  viewport: { width: 1366, height: 768 },
  launchOptions: { slowMo: 200 },
});

test.describe("US-035 Demo", () => {
  test("l'amministratore vede la riga compatta a 1366px e disattiva un'offerta espansa senza perdere l'espansione", async ({
    page,
    factory,
  }) => {
    test.setTimeout(60_000);

    const token = randomUUID().slice(0, 8).toUpperCase();

    // ── Dati factory (nessuna entità seed mutata) ──────────────────
    const clienteDemo = await factory.createCliente({
      ragioneSociale: `E2E Demo Riga Compatta ${token}`,
    });
    const offertaAttiva = await factory.createOfferta({
      cliente: clienteDemo,
      codice: `OFF-COMP-${token}`,
      descrizione: "Percorso di coaching executive con follow-up mensile",
      giorniPrevisti: 23,
    });
    await factory.createRigaAttivita({
      cliente: clienteDemo,
      offerta: offertaAttiva,
      ore: "16.00",
    });
    const offertaInattiva = await factory.createOfferta({
      cliente: clienteDemo,
      codice: `OFF-COMP-CHIUSA-${token}`,
      descrizione: "Percorso concluso",
      giorniPrevisti: 5,
      attiva: false,
    });

    // ── 1. Login amministratore e apertura "Offerte" dalla sidebar ─
    await accediAlBackOfficeComeAdmin(page);
    await expect(
      page.getByRole("banner").getByText("Tech Reloaded"),
    ).toBeVisible();
    await apriPaginaOfferte(page);

    // ── 2. Layout compatto a 1366px: nessuno scorrimento orizzontale ─
    const contenitore = page.getByTestId("contenitore-tabella-offerte");
    await expect
      .poll(() =>
        contenitore.evaluate((el) => el.scrollWidth - el.clientWidth),
      )
      .toBeLessThanOrEqual(0);

    const rigaAttiva = rigaOfferta(page, offertaAttiva.codice);
    await expect(
      rigaAttiva.getByRole("link", { name: "Modifica" }),
    ).toBeVisible();
    await expect(
      rigaAttiva.getByRole("button", { name: "Elimina", exact: true }),
    ).toBeVisible();

    // ── 3. Colonna unica "Giorni erogati" nel formato erogate/previste ─
    await expect(rigaAttiva.getByRole("cell").nth(3)).toHaveText(
      /^2\/23\s*gg$/,
    );

    const indicatoreAttiva = rigaAttiva.getByRole("button", {
      name: "Disattiva",
    });
    await expect(indicatoreAttiva).toHaveAttribute("title", "Offerta attiva");

    const rigaInattiva = rigaOfferta(page, offertaInattiva.codice);
    await expect(
      rigaInattiva.getByRole("button", { name: "Attiva", exact: true }),
    ).toHaveAttribute("title", "Offerta non attiva");

    // ── 4. Espansione della riga attiva (click sul codice) ──────────
    await rigaAttiva.getByText(offertaAttiva.codice, { exact: true }).click();
    await expect(dettaglioOfferta(page, offertaAttiva.codice)).toBeVisible();
    await expect(
      pulsanteDettaglio(rigaAttiva, offertaAttiva.codice),
    ).toHaveAttribute("aria-expanded", "true");

    // ── 5. Click sull'indicatore: disattiva senza chiudere la riga ──
    await rigaAttiva.getByRole("button", { name: "Disattiva" }).click();
    await page.waitForURL(
      (url) =>
        url.pathname === "/offerte" &&
        url.searchParams.get("esito") === "stato-offerta-aggiornato" &&
        url.searchParams.get("offertaEspansaId") === offertaAttiva.id,
    );
    // Il redirect della server action ricarica la pagina: riattendere
    // l'idratazione prima di asserire sugli handler client.
    await attendiTabellaOfferteIdratata(page);

    const rigaDisattivata = rigaOfferta(page, offertaAttiva.codice);
    await expect(
      pulsanteDettaglio(rigaDisattivata, offertaAttiva.codice),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      dettaglioOfferta(page, offertaAttiva.codice),
    ).toBeVisible();
    await expect(
      rigaDisattivata.getByRole("button", { name: "Attiva", exact: true }),
    ).toHaveAttribute("title", "Offerta non attiva");

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
