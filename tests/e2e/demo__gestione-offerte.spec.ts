import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { accediAlBackOfficeComeAdmin } from "./support/auth";
import { test, expect } from "./support/fixtures";
import { attendiTabellaOfferteIdratata } from "./support/offerte";

/**
 * Demo scenario — US-026: Gestione delle offerte dalla pagina Offerte.
 *
 * Ripercorre in un unico flusso narrativo la Dimostrazione della spec:
 * l'amministratore accede, apre "Offerte" dalla sidebar (click sulla voce di
 * navigazione, non navigazione diretta via URL) e quindi:
 *  1. crea una nuova offerta scegliendo il cliente dalla select e compilando
 *     codice, descrizione, tariffa giornaliera e giorni previsti;
 *  2. modifica quella stessa offerta (descrizione e giorni previsti) e vede le
 *     modifiche riflesse nell'elenco;
 *  3. la disattiva e poi la riattiva tramite il flag di stato in riga, con il
 *     cambiamento immediatamente visibile;
 *  4. elimina una seconda offerta priva di attività collegate;
 *  5. tenta di eliminare una terza offerta con una riga di attività registrata
 *     e riceve il messaggio di blocco che lo invita a disattivarla.
 *
 * A differenza dei demo spec di sola lettura, questo flusso MUTA dati: per il
 * contratto e2e (AGENTS.md) usa quindi esclusivamente entità create dalla
 * factory, mai i seed (TechSolutions, DataFlow, GreenEnergy, Giulia Conti…).
 *
 * Dati factory usati (namespaciati e con token univoco per run):
 * - clienteDemo: un cliente attivo, selezionabile nella select "Cliente" della
 *   pagina di creazione;
 * - offertaDaCreare: creata via UI scegliendo clienteDemo (codice OFF-NEW-…);
 * - offertaSenzaAttivita: offerta factory su clienteDemo, senza righe attività
 *   → eliminabile (codice OFF-DEL-…);
 * - offertaConAttivita: offerta factory su clienteDemo con una riga attività
 *   collegata → eliminazione bloccata (codice OFF-LOCK-…).
 *
 * Non registra video: la registrazione per la review è a cura della fase
 * successiva (archetipo-review via `archetipo e2e demo`), qui il test gira
 * headless. slowMo e la pausa finale servono solo al ritmo di registrazione.
 */

/**
 * Individua la riga della tabella "Elenco offerte" relativa a un'offerta,
 * filtrando per il suo codice (univoco, mostrato nel badge della prima cella).
 */
function rigaOfferta(page: Page, codiceOfferta: string): Locator {
  return page
    .getByRole("table", { name: "Elenco offerte" })
    .getByRole("row")
    .filter({ hasText: codiceOfferta });
}

test.use({
  viewport: { width: 1280, height: 720 },
  launchOptions: { slowMo: 200 },
});

test.describe("US-026 Demo", () => {
  test("l'amministratore gestisce l'intero ciclo di vita di un'offerta dalla pagina Offerte", async ({
    page,
    factory,
  }) => {
    test.setTimeout(90_000);

    const token = randomUUID().slice(0, 8).toUpperCase();

    // ── Dati factory (nessuna entità seed mutata) ──────────────────
    const clienteDemo = await factory.createCliente({
      ragioneSociale: `E2E Demo Gestione Cliente ${token}`,
    });
    const offertaSenzaAttivita = await factory.createOfferta({
      cliente: clienteDemo,
      codice: `OFF-DEL-${token}`,
      descrizione: "Offerta pilota senza attività",
    });
    const offertaConAttivita = await factory.createOfferta({
      cliente: clienteDemo,
      codice: `OFF-LOCK-${token}`,
      descrizione: "Offerta con attività consuntivate",
    });
    await factory.createRigaAttivita({
      cliente: clienteDemo,
      offerta: offertaConAttivita,
    });

    const codiceNuova = `OFF-NEW-${token}`;

    // ── 1. Login amministratore e apertura "Offerte" dalla sidebar ─
    await accediAlBackOfficeComeAdmin(page);
    await expect(
      page.getByRole("banner").getByText("Tech Reloaded"),
    ).toBeVisible();

    await page.getByRole("link", { name: "Offerte", exact: true }).click();
    await page.waitForURL("**/offerte");
    await expect(page.getByRole("heading", { name: "Offerte" })).toBeVisible();

    // ── 2. Creazione di una nuova offerta scegliendo il cliente ────
    await page.getByRole("link", { name: "Nuova offerta" }).click();
    await page.waitForURL(/\/offerte\/nuova$/);
    await expect(
      page.getByRole("heading", { name: "Nuova offerta" }),
    ).toBeVisible();

    await page
      .getByLabel("Cliente")
      .selectOption({ label: clienteDemo.ragioneSociale });
    await page.getByLabel("Codice").fill(codiceNuova);
    await page
      .getByLabel("Descrizione")
      .fill("Percorso di coaching executive");
    await page.getByLabel("Tariffa giornaliera").fill("680,00");
    await page.getByLabel("Giorni previsti").fill("12");

    await page.getByRole("button", { name: "Crea offerta" }).click();

    await expect(page).toHaveURL(/\/offerte\?esito=offerta-creata$/);
    await expect(
      page.getByText("Offerta creata correttamente"),
    ).toBeVisible();

    const rigaNuova = rigaOfferta(page, codiceNuova);
    await expect(rigaNuova).toContainText(clienteDemo.ragioneSociale);
    await expect(rigaNuova).toContainText("Percorso di coaching executive");
    await expect(rigaNuova).toContainText(/680,00\s*€/);
    // Appena creata è attiva: la riga espone l'azione "Disattiva".
    await expect(
      rigaNuova.getByRole("button", { name: "Disattiva", exact: true }),
    ).toBeVisible();

    // ── 3. Modifica dell'offerta appena creata ─────────────────────
    await rigaNuova.getByRole("link", { name: "Modifica" }).click();
    await page.waitForURL(/\/offerte\/[^/]+$/);
    await expect(
      page.getByRole("heading", { name: "Modifica offerta" }),
    ).toBeVisible();

    await page
      .getByLabel("Descrizione")
      .fill("Percorso di coaching executive — esteso");
    await page.getByLabel("Giorni previsti").fill("15");
    await page.getByRole("button", { name: "Salva offerta" }).click();

    await expect(page).toHaveURL(/\/offerte\?esito=offerta-salvata$/);
    await expect(
      page.getByText("Modifiche all'offerta salvate"),
    ).toBeVisible();
    await expect(rigaOfferta(page, codiceNuova)).toContainText(
      "Percorso di coaching executive — esteso",
    );

    // ── 4. Disattivazione e successiva riattivazione ───────────────
    await rigaOfferta(page, codiceNuova)
      .getByRole("button", { name: "Disattiva", exact: true })
      .click();
    await expect(page).toHaveURL(/\/offerte\?esito=stato-offerta-aggiornato$/);
    await expect(
      page.getByText("Stato dell'offerta aggiornato"),
    ).toBeVisible();

    const rigaDisattivata = rigaOfferta(page, codiceNuova);
    await expect(rigaDisattivata.getByText("Non attiva")).toBeVisible();
    await expect(
      rigaDisattivata.getByRole("button", { name: "Attiva", exact: true }),
    ).toBeVisible();

    await rigaDisattivata
      .getByRole("button", { name: "Attiva", exact: true })
      .click();
    await expect(page).toHaveURL(/\/offerte\?esito=stato-offerta-aggiornato$/);

    const rigaRiattivata = rigaOfferta(page, codiceNuova);
    await expect(
      rigaRiattivata.getByRole("button", { name: "Disattiva", exact: true }),
    ).toBeVisible();

    // ── 5. Eliminazione di un'offerta priva di attività collegate ──
    // Il redirect post-riattivazione ricarica la pagina: "Elimina" è un
    // handler client, quindi la tabella va ri-attesa idratata.
    await attendiTabellaOfferteIdratata(page);
    await rigaOfferta(page, offertaSenzaAttivita.codice)
      .getByRole("button", { name: "Elimina", exact: true })
      .click();

    const modale = page.getByRole("dialog");
    await expect(
      modale.getByRole("heading", { name: "Elimina questa offerta?" }),
    ).toBeVisible();
    await modale
      .getByRole("button", { name: "Elimina offerta", exact: true })
      .click();

    await expect(page).toHaveURL(/\/offerte\?esito=offerta-eliminata$/);
    await expect(page.getByText("Offerta eliminata")).toBeVisible();
    await expect(
      rigaOfferta(page, offertaSenzaAttivita.codice),
    ).toHaveCount(0);

    // ── 6. Eliminazione bloccata per offerta con attività collegate ─
    // Anche qui la pagina è appena stata ricaricata dal redirect post-eliminazione.
    await attendiTabellaOfferteIdratata(page);
    await rigaOfferta(page, offertaConAttivita.codice)
      .getByRole("button", { name: "Elimina", exact: true })
      .click();

    const modaleBloccata = page.getByRole("dialog");
    await expect(
      modaleBloccata.getByRole("heading", {
        name: "Non è possibile eliminare l'offerta",
      }),
    ).toBeVisible();
    await expect(
      modaleBloccata.getByText("riga di attività collegata"),
    ).toBeVisible();
    // La modale propone la disattivazione al posto dell'eliminazione.
    await expect(
      modaleBloccata.getByRole("button", {
        name: "Disattiva offerta",
        exact: true,
      }),
    ).toBeVisible();

    await modaleBloccata
      .getByRole("button", { name: "Chiudi", exact: true })
      .click();
    // L'offerta resta nell'elenco: l'eliminazione è stata bloccata.
    await expect(
      rigaOfferta(page, offertaConAttivita.codice),
    ).toHaveCount(1);

    // Pausa finale solo per ritmo video demo, non per sincronizzazione funzionale.
    await page.waitForTimeout(1500);
  });
});
