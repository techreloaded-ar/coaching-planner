import { accediComeCollaboratore } from "./support/auth";
import { dataNelMese, meseRiservato } from "./support/date";
import { test, expect } from "./support/fixtures";

/**
 * Test di segregazione — US-011: Calendario mensile delle proprie attività
 *
 * Verifica che la collaboratrice Giulia veda esclusivamente le proprie
 * attività nel calendario mensile.
 *
 * US-052 aggiunge la prova osservabile sull'endpoint dati introdotto per la
 * cache client: con due collaboratori distinti creati dalla factory, la
 * risposta di `GET /api/attivita/calendario` contiene solo le righe del
 * collaboratore autenticato. Gli unit test della route mockano il read model,
 * quindi l'assenza dei dati altrui è dimostrabile soltanto qui.
 */

function dataDb(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00.000Z`);
}

test.describe("US-011 Segregazione dati", () => {
  test("Giulia vede solo le proprie attività nel calendario mensile", async ({
    page,
  }) => {
    // ── 1. Login come Giulia ──────────────────────────────────────

    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Accedi con Google" })
    ).toBeVisible();

    await page.evaluate(async () => {
      const res = await fetch("/api/e2e-test/sessione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "giulia.conti@agilereloaded.it" }),
      });
      const data = await res.json();
      if (data.redirect) {
        window.location.href = data.redirect;
      }
    });

    await page.waitForURL("**/attivita**");

    // ── 2. Verifica che la pagina carichi senza errori ────────────

    await expect(
      page.getByRole("heading", { name: "Le mie attività", exact: true })
    ).toBeVisible();

    // ── 3. Verifica che il calendario sia visibile ─────────────────

    const calendario = page.getByLabel("Calendario mensile delle attività");
    await expect(calendario).toBeVisible();

    // ── 4. Conta i giorni con attività ────────────────────────────
    // Dopo US-031 tutte le celle sono link; i giorni con attività
    // si distinguono per l'attributo data-con-attivita="true".

    const giorniConAttivita = calendario.locator('a[data-con-attivita="true"]');
    const count = await giorniConAttivita.count();

    // Il seed crea 6 righe per Giulia distribuite su 3 giorni distinti del
    // mese corrente; la vista di default atterra proprio su quel mese.
    expect(count).toBeGreaterThanOrEqual(3);

    // ── 5. Apri un giorno con attività e verifica la pagina dettaglio ──

    await giorniConAttivita.first().click();
    await page.waitForURL("**/attivita/*");

    await expect(
      page.getByRole("link", { name: "Torna al calendario" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: /\d{1,2} .* \d{4}/ })
    ).toBeVisible();
    await expect(page.getByText("Righe registrate")).toBeVisible();
    await expect(page.getByText("Ore totali")).toBeVisible();
    await expect(page.getByText("Ore fatturabili")).toBeVisible();
    await expect(page.getByText("Attività della giornata")).toBeVisible();

    // Tutti i clienti e le offerte nel dettaglio dovrebbero essere
    // coerenti con il seed (TechSolutions, DataFlow, TS-*, DF-*)
    // Non possiamo verificare l'assenza di dati altrui perché il seed
    // ha solo Giulia — ma l'unit test di attivita.test.ts copre già
    // il filtro sul collaboratoreId.

    await page.getByRole("link", { name: "Torna al calendario" }).click();
    await page.waitForURL("**/attivita*");
    await expect(calendario).toBeVisible();

    // ── 6. Verifica navigazione senza limiti ───────────────────────

    const btnPrev = page.getByLabel("Mese precedente");
    const btnNext = page.getByLabel("Mese successivo");

    // Naviga avanti e indietro più volte per verificare assenza di limiti
    for (let i = 0; i < 3; i++) {
      await btnPrev.click();
      await page.waitForURL(/\?mese=/);
    }

    for (let i = 0; i < 3; i++) {
      await btnNext.click();
      await page.waitForURL(/\?mese=/);
    }

    // Dovremmo essere tornati al punto di partenza dopo 3 prev + 3 next
    // (non verifichiamo l'esatto mese perché il seed cambia ogni giorno)
    await expect(calendario).toBeVisible();

    // L'accesso dell'amministratore al front office è coperto in modo isolato
    // dalla suite US-030, senza riutilizzare il suo account seed.
  });
});

test.describe("US-052 Segregazione sull'endpoint del calendario", () => {
  test("l'endpoint del mese restituisce solo le righe del collaboratore autenticato", async ({
    page,
    factory,
  }) => {
    const mese = meseRiservato("US-052-segregazione");
    const giorno = dataNelMese(mese, 9);

    const proprietario = await factory.createCollaboratore();
    const estraneo = await factory.createCollaboratore();

    const clienteProprio = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US052 Cliente Proprio",
    });
    const clienteAltrui = await factory.createClienteConOfferta({
      ragioneSociale: "E2E US052 Cliente Altrui",
    });

    await factory.createRigaAttivita({
      collaboratore: proprietario,
      cliente: clienteProprio.cliente,
      offerta: clienteProprio.offerta,
      data: dataDb(giorno),
      ore: "5.00",
    });
    await factory.createRigaAttivita({
      collaboratore: estraneo,
      cliente: clienteAltrui.cliente,
      offerta: clienteAltrui.offerta,
      data: dataDb(giorno),
      ore: "7.00",
    });

    await accediComeCollaboratore(page, proprietario.utente.email);

    const risposta = await page.request.get(
      `/api/attivita/calendario?mese=${mese}`,
    );
    expect(risposta.status()).toBe(200);
    expect(risposta.headers()["cache-control"]).toBe("private, no-store");

    const dati = (await risposta.json()) as {
      token: string;
      sintesiPerGiorno: Record<
        string,
        {
          righe: number;
          oreTotali: number;
          clienti: { clienteId: string; ragioneSociale: string; ore: number }[];
        }
      >;
    };

    expect(dati.token).toBe(mese);

    const sintesiGiorno = dati.sintesiPerGiorno[giorno];
    expect(sintesiGiorno).toBeDefined();
    expect(sintesiGiorno.righe).toBe(1);
    expect(sintesiGiorno.oreTotali).toBe(5);
    expect(sintesiGiorno.clienti).toEqual([
      {
        clienteId: clienteProprio.cliente.id,
        ragioneSociale: clienteProprio.cliente.ragioneSociale,
        ore: 5,
      },
    ]);

    // La riga dell'altro collaboratore esiste nello stesso giorno, ma non
    // compare in nessun punto della risposta.
    const rispostaTestuale = JSON.stringify(dati);
    expect(rispostaTestuale).not.toContain(clienteAltrui.cliente.id);
    expect(rispostaTestuale).not.toContain(clienteAltrui.cliente.ragioneSociale);
  });

  test("l'endpoint rifiuta un token mese malformato", async ({
    page,
    collaboratore,
  }) => {
    await accediComeCollaboratore(page, collaboratore.utente.email);

    const malformato = await page.request.get(
      "/api/attivita/calendario?mese=2026-13",
    );

    expect(malformato.status()).toBe(400);
    await expect(malformato.json()).resolves.toEqual({
      errore: "Parametro 'mese' richiesto nel formato YYYY-MM",
    });
  });

  test("l'endpoint non restituisce dati senza sessione", async ({ request }) => {
    // Il fixture `request` ha un proprio contenitore di cookie, senza sessione:
    // il proxy globale reindirizza la rotta protetta alla radice pubblica.
    const risposta = await request.get(
      `/api/attivita/calendario?mese=${meseRiservato("US-052-segregazione")}`,
      { maxRedirects: 0 },
    );

    expect(risposta.status()).toBe(307);
    expect(
      new URL(risposta.headers()["location"], "http://localhost:3000").pathname,
    ).toBe("/");
  });
});
