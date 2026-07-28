import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatiCalendarioMese } from "@/lib/attivita-contract";
import {
  CacheCalendarioMesi,
  DURATA_FRESH_MS,
  MASSIMO_MESI_IN_CACHE,
} from "@/app/(front-office)/attivita/calendario-cache";

/**
 * US-052 — Semantiche della cache dei mesi del calendario.
 *
 * Il tempo è iniettato, non atteso: nessun timer reale e nessun hard wait.
 * Ogni asserzione osserva il dato restituito, non soltanto le chiamate al
 * caricatore, così il test non può passare con una cache che risponde bene ai
 * mock e male all'utente.
 */

// ── Strumenti di test ───────────────────────────────────────────

function orologioControllabile(inizio = 1_000_000) {
  let adesso = inizio;
  return {
    ora: () => adesso,
    avanza(millisecondi: number) {
      adesso += millisecondi;
    },
    imposta(valore: number) {
      adesso = valore;
    },
  };
}

const COLLABORATORE = "collab-proprietario";

function meseFittizio(
  token: string,
  ore: number,
  collaboratoreId = COLLABORATORE,
): DatiCalendarioMese {
  return {
    token,
    collaboratoreId,
    sintesiPerGiorno: {
      [`${token}-05`]: {
        data: `${token}-05`,
        righe: 1,
        oreTotali: ore,
        clienti: [
          { clienteId: "cliente-1", ragioneSociale: "TechSolutions Srl", ore },
        ],
      },
    },
  };
}

/** Promise il cui esito è deciso dal test, per provare la concorrenza. */
function promessaTrattenuta<T>() {
  let risolvi!: (valore: T) => void;
  let rifiuta!: (errore: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    risolvi = res;
    rifiuta = rej;
  });
  return { promessa, risolvi, rifiuta };
}

// ═══════════════════════════════════════════════════════════════

describe("CacheCalendarioMesi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Finestra fresh ──────────────────────────────────────────

  it("legge una entry seminata senza invocare il caricatore fino a TTL-1", async () => {
    const orologio = orologioControllabile();
    const caricatore = vi.fn();
    const cache = new CacheCalendarioMesi({
      caricatore,
      orologio: orologio.ora,
    });

    const seminato = meseFittizio("2026-06", 8);
    cache.seed(seminato);

    orologio.avanza(DURATA_FRESH_MS - 1);

    const lettura = cache.read("2026-06");
    expect(lettura).not.toBeNull();
    expect(lettura!.stato).toBe("fresco");
    expect(lettura!.eta).toBe(DURATA_FRESH_MS - 1);
    expect(lettura!.cachedAt).toBe(1_000_000);
    expect(lettura!.expiresAt).toBe(1_000_000 + DURATA_FRESH_MS);
    expect(lettura!.dati).toEqual(seminato);

    await expect(cache.load("2026-06")).resolves.toEqual(seminato);
    expect(caricatore).not.toHaveBeenCalled();
  });

  it("al bordo esatto dei 300000 ms la entry è scaduta e provoca una sola rivalidazione", async () => {
    const orologio = orologioControllabile();
    const aggiornato = meseFittizio("2026-06", 12);
    const caricatore = vi.fn().mockResolvedValue(aggiornato);
    const cache = new CacheCalendarioMesi({
      caricatore,
      orologio: orologio.ora,
    });

    const seminato = meseFittizio("2026-06", 8);
    cache.seed(seminato);

    orologio.imposta(1_000_000 + DURATA_FRESH_MS);

    const lettura = cache.read("2026-06");
    expect(lettura!.stato).toBe("scaduto");
    expect(lettura!.eta).toBe(DURATA_FRESH_MS);
    expect(lettura!.expiresAt).toBe(1_000_000 + DURATA_FRESH_MS);

    // Il dato vecchio è restituito subito: la griglia non si svuota.
    await expect(cache.load("2026-06")).resolves.toEqual(seminato);

    // Tre letture consecutive di una entry scaduta non moltiplicano le richieste.
    await cache.load("2026-06");
    await cache.load("2026-06");
    await Promise.resolve();

    expect(caricatore).toHaveBeenCalledTimes(1);
    expect(caricatore).toHaveBeenCalledWith("2026-06");

    // Terminata la rivalidazione il dato aggiornato è fresco.
    await vi.waitFor(() => {
      expect(cache.read("2026-06")!.dati).toEqual(aggiornato);
    });
    expect(cache.read("2026-06")!.stato).toBe("fresco");
    expect(cache.read("2026-06")!.eta).toBe(0);
  });

  it("un mese mai visto attende il caricatore e diventa leggibile", async () => {
    const orologio = orologioControllabile();
    const dati = meseFittizio("2026-05", 4);
    const caricatore = vi.fn().mockResolvedValue(dati);
    const cache = new CacheCalendarioMesi({
      caricatore,
      orologio: orologio.ora,
    });

    expect(cache.read("2026-05")).toBeNull();
    await expect(cache.load("2026-05")).resolves.toEqual(dati);
    expect(caricatore).toHaveBeenCalledTimes(1);
    expect(cache.read("2026-05")!.stato).toBe("fresco");
  });

  // ── Deduplica (single-flight) ───────────────────────────────

  it("due caricamenti concorrenti dello stesso mese condividono una sola Promise", async () => {
    const dati = meseFittizio("2026-04", 6);
    const trattenuta = promessaTrattenuta<DatiCalendarioMese>();
    const caricatore = vi.fn().mockReturnValue(trattenuta.promessa);
    const cache = new CacheCalendarioMesi({ caricatore });

    const primo = cache.load("2026-04");
    const secondo = cache.load("2026-04");

    expect(caricatore).toHaveBeenCalledTimes(1);
    expect(cache.caricamentiInVolo()).toBe(1);

    trattenuta.risolvi(dati);

    await expect(primo).resolves.toEqual(dati);
    await expect(secondo).resolves.toEqual(dati);
    expect(caricatore).toHaveBeenCalledTimes(1);
    expect(cache.caricamentiInVolo()).toBe(0);
  });

  it("mesi diversi non si deduplicano tra loro", async () => {
    const caricatore = vi
      .fn()
      .mockImplementation((token: string) =>
        Promise.resolve(meseFittizio(token, 3)),
      );
    const cache = new CacheCalendarioMesi({ caricatore });

    const [maggio, giugno] = await Promise.all([
      cache.load("2026-05"),
      cache.load("2026-06"),
    ]);

    expect(maggio.token).toBe("2026-05");
    expect(giugno.token).toBe("2026-06");
    expect(caricatore).toHaveBeenCalledTimes(2);
  });

  // ── LRU ────────────────────────────────────────────────────

  it("conserva al massimo 12 mesi ed espelle il meno recentemente usato", async () => {
    const caricatore = vi
      .fn()
      .mockImplementation((token: string) =>
        Promise.resolve(meseFittizio(token, 1)),
      );
    const cache = new CacheCalendarioMesi({ caricatore });

    // 12 mesi consecutivi: 2026-01 … 2026-12
    for (let mese = 1; mese <= MASSIMO_MESI_IN_CACHE; mese += 1) {
      await cache.load(`2026-${String(mese).padStart(2, "0")}`);
    }
    expect(cache.tokenInCache()).toHaveLength(MASSIMO_MESI_IN_CACHE);

    // Rileggo il primo: diventa il più recentemente usato.
    expect(cache.read("2026-01")).not.toBeNull();

    // Il tredicesimo mese espelle il meno recente, cioè 2026-02, non 2026-01.
    await cache.load("2027-01");

    expect(cache.tokenInCache()).toHaveLength(MASSIMO_MESI_IN_CACHE);
    expect(cache.read("2026-02")).toBeNull();
    expect(cache.read("2026-01")).not.toBeNull();
    expect(cache.read("2027-01")).not.toBeNull();
  });

  it("non espelle la entry appena scritta", async () => {
    const caricatore = vi
      .fn()
      .mockImplementation((token: string) =>
        Promise.resolve(meseFittizio(token, 1)),
      );
    const cache = new CacheCalendarioMesi({ caricatore });

    // 17 mesi distinti: l'espulsione scatta cinque volte.
    for (let indice = 0; indice < MASSIMO_MESI_IN_CACHE + 5; indice += 1) {
      const anno = 2030 + Math.floor(indice / 12);
      const token = `${anno}-${String((indice % 12) + 1).padStart(2, "0")}`;
      await cache.load(token);
      expect(cache.read(token)).not.toBeNull();
    }

    expect(cache.tokenInCache()).toHaveLength(MASSIMO_MESI_IN_CACHE);
    // I cinque mesi più vecchi sono usciti, gli ultimi dodici sono in cache.
    expect(cache.read("2030-01")).toBeNull();
    expect(cache.read("2030-05")).toBeNull();
    expect(cache.read("2030-06")).not.toBeNull();
    expect(cache.read("2031-05")).not.toBeNull();
  });

  // ── Invalidazione ──────────────────────────────────────────

  it("un mese invalidato torna a rete al caricamento successivo", async () => {
    const orologio = orologioControllabile();
    const caricatore = vi
      .fn()
      .mockImplementation((token: string) =>
        Promise.resolve(meseFittizio(token, 9)),
      );
    const cache = new CacheCalendarioMesi({
      caricatore,
      orologio: orologio.ora,
    });

    cache.seed(meseFittizio("2026-06", 8));
    expect(cache.read("2026-06")!.stato).toBe("fresco");

    cache.invalidate("2026-06");

    expect(cache.read("2026-06")).toBeNull();
    await expect(cache.load("2026-06")).resolves.toEqual(
      meseFittizio("2026-06", 9),
    );
    expect(caricatore).toHaveBeenCalledTimes(1);
  });

  it("invalida più mesi in una sola chiamata lasciando intatti gli altri", () => {
    const cache = new CacheCalendarioMesi({ caricatore: vi.fn() });

    cache.seed(meseFittizio("2026-05", 1));
    cache.seed(meseFittizio("2026-06", 2));
    cache.seed(meseFittizio("2026-07", 3));

    cache.invalidate("2026-05", "2026-07");

    expect(cache.read("2026-05")).toBeNull();
    expect(cache.read("2026-07")).toBeNull();
    expect(cache.read("2026-06")!.dati.sintesiPerGiorno["2026-06-05"].oreTotali).toBe(2);
  });

  it("una risposta in volo al momento dell'invalidazione non ripopola il mese", async () => {
    const trattenuta = promessaTrattenuta<DatiCalendarioMese>();
    const caricatore = vi.fn().mockReturnValue(trattenuta.promessa);
    const cache = new CacheCalendarioMesi({ caricatore });

    const caricamento = cache.load("2026-06");

    // La mutazione avviene mentre la lettura è ancora in volo.
    cache.invalidate("2026-06");

    trattenuta.risolvi(meseFittizio("2026-06", 8));
    await expect(caricamento).resolves.toEqual(meseFittizio("2026-06", 8));

    // Il dato antecedente alla mutazione non è entrato in cache.
    expect(cache.read("2026-06")).toBeNull();
  });

  // ── Errori ─────────────────────────────────────────────────

  it("un errore di prefetch non cancella un dato valido e resta silenzioso", async () => {
    const orologio = orologioControllabile();
    const caricatore = vi.fn().mockRejectedValue(new Error("rete assente"));
    const cache = new CacheCalendarioMesi({
      caricatore,
      orologio: orologio.ora,
    });

    const seminato = meseFittizio("2026-06", 8);
    cache.seed(seminato);
    orologio.imposta(1_000_000 + DURATA_FRESH_MS);

    // Nessuna eccezione esce dal prefetch.
    expect(() => cache.prefetch("2026-06")).not.toThrow();
    await vi.waitFor(() => {
      expect(caricatore).toHaveBeenCalledTimes(1);
    });

    // Il dato vecchio resta leggibile e utilizzabile.
    expect(cache.read("2026-06")!.dati).toEqual(seminato);
    await expect(cache.load("2026-06")).resolves.toEqual(seminato);
  });

  it("il prefetch di una entry fresca non tocca la rete", () => {
    const orologio = orologioControllabile();
    const caricatore = vi.fn();
    const cache = new CacheCalendarioMesi({
      caricatore,
      orologio: orologio.ora,
    });

    cache.seed(meseFittizio("2026-06", 8));
    orologio.avanza(DURATA_FRESH_MS - 1);

    cache.prefetch("2026-06");

    expect(caricatore).not.toHaveBeenCalled();
  });

  it("un errore su un mese mai visto è propagato al chiamante, che può ritentare", async () => {
    const dati = meseFittizio("2026-06", 8);
    const caricatore = vi
      .fn()
      .mockRejectedValueOnce(new Error("rete assente"))
      .mockResolvedValueOnce(dati);
    const cache = new CacheCalendarioMesi({ caricatore });

    await expect(cache.load("2026-06")).rejects.toThrow("rete assente");
    expect(cache.read("2026-06")).toBeNull();

    // Il retry esplicito riparte davvero: la Promise fallita non resta appesa.
    await expect(cache.load("2026-06")).resolves.toEqual(dati);
    expect(caricatore).toHaveBeenCalledTimes(2);
  });

  // ── Risposte fuori ordine ──────────────────────────────────

  it("risposte fuori ordine popolano ciascuna la propria chiave e la cache non elegge un mese attivo", async () => {
    const trattenutaB = promessaTrattenuta<DatiCalendarioMese>();
    const trattenutaC = promessaTrattenuta<DatiCalendarioMese>();
    const caricatore = vi.fn().mockImplementation((token: string) => {
      if (token === "2026-05") return trattenutaB.promessa;
      if (token === "2026-04") return trattenutaC.promessa;
      throw new Error(`token inatteso: ${token}`);
    });
    const cache = new CacheCalendarioMesi({ caricatore });

    const caricamentoB = cache.load("2026-05");
    const caricamentoC = cache.load("2026-04");

    // C risponde prima di B: l'ordine di arrivo è invertito rispetto alla richiesta.
    trattenutaC.risolvi(meseFittizio("2026-04", 4));
    await expect(caricamentoC).resolves.toEqual(meseFittizio("2026-04", 4));

    trattenutaB.risolvi(meseFittizio("2026-05", 5));
    await expect(caricamentoB).resolves.toEqual(meseFittizio("2026-05", 5));

    // Entrambe le entry sono cachate sulla propria chiave, senza sovrascritture.
    expect(cache.read("2026-04")!.dati).toEqual(meseFittizio("2026-04", 4));
    expect(cache.read("2026-05")!.dati).toEqual(meseFittizio("2026-05", 5));
  });

  // ── Svuotamento ────────────────────────────────────────────

  it("clear rende illeggibile ogni mese e neutralizza le risposte in volo", async () => {
    const trattenuta = promessaTrattenuta<DatiCalendarioMese>();
    const caricatore = vi.fn().mockReturnValue(trattenuta.promessa);
    const cache = new CacheCalendarioMesi({ caricatore });

    cache.seed(meseFittizio("2026-06", 8));
    const caricamento = cache.load("2026-05");

    cache.clear();

    expect(cache.read("2026-06")).toBeNull();
    expect(cache.tokenInCache()).toEqual([]);

    trattenuta.risolvi(meseFittizio("2026-05", 5));
    await caricamento;

    // Nessun dato della sessione precedente rientra in cache dopo lo svuotamento.
    expect(cache.read("2026-05")).toBeNull();
    expect(cache.tokenInCache()).toEqual([]);
  });

  // ── Guardia d'identità (cambio di account nella stessa scheda) ─

  it("una risposta di un altro collaboratore svuota la cache e non diventa leggibile", async () => {
    const orologio = orologioControllabile();
    const meseDiAltri = meseFittizio("2026-05", 9, "collab-di-un-altro");
    const caricatore = vi.fn().mockResolvedValue(meseDiAltri);
    const identitaCambiata = vi.fn();
    const cache = new CacheCalendarioMesi({
      caricatore,
      orologio: orologio.ora,
      onIdentitaCambiata: identitaCambiata,
    });

    // La scheda è partita con i mesi del collaboratore proprietario.
    cache.seed(meseFittizio("2026-06", 8));
    cache.seed(meseFittizio("2026-07", 4));
    expect(cache.identitaInCache()).toBe(COLLABORATORE);

    // Nel frattempo, in un'altra scheda, si accede con un altro account.
    await cache.load("2026-05");

    // Nessun mese resta leggibile: né quello nuovo né quelli precedenti.
    expect(cache.tokenInCache()).toEqual([]);
    expect(cache.read("2026-05")).toBeNull();
    expect(cache.read("2026-06")).toBeNull();
    expect(cache.read("2026-07")).toBeNull();
    expect(cache.identitaInCache()).toBeNull();

    // Il consumer viene avvisato: serve una navigazione completa.
    expect(identitaCambiata).toHaveBeenCalledTimes(1);
    expect(identitaCambiata).toHaveBeenCalledWith("collab-di-un-altro");
  });

  it("una risposta dello stesso collaboratore non svuota nulla", async () => {
    const identitaCambiata = vi.fn();
    const caricatore = vi
      .fn()
      .mockResolvedValue(meseFittizio("2026-05", 5));
    const cache = new CacheCalendarioMesi({
      caricatore,
      onIdentitaCambiata: identitaCambiata,
    });

    cache.seed(meseFittizio("2026-06", 8));
    await cache.load("2026-05");

    expect(cache.read("2026-06")).not.toBeNull();
    expect(cache.read("2026-05")).not.toBeNull();
    expect(cache.identitaInCache()).toBe(COLLABORATORE);
    expect(identitaCambiata).not.toHaveBeenCalled();
  });

  it("dopo un clear la cache accetta l'identità del nuovo collaboratore", async () => {
    const identitaCambiata = vi.fn();
    const caricatore = vi
      .fn()
      .mockResolvedValue(meseFittizio("2026-05", 5, "collab-nuovo"));
    const cache = new CacheCalendarioMesi({
      caricatore,
      onIdentitaCambiata: identitaCambiata,
    });

    cache.seed(meseFittizio("2026-06", 8));
    cache.clear();
    expect(cache.identitaInCache()).toBeNull();

    await cache.load("2026-05");

    expect(cache.identitaInCache()).toBe("collab-nuovo");
    expect(cache.read("2026-05")).not.toBeNull();
    expect(identitaCambiata).not.toHaveBeenCalled();
  });

  it("revalida forza la lettura anche su una entry ancora fresca", async () => {
    const orologio = orologioControllabile();
    const aggiornato = meseFittizio("2026-06", 12);
    const caricatore = vi.fn().mockResolvedValue(aggiornato);
    const cache = new CacheCalendarioMesi({
      caricatore,
      orologio: orologio.ora,
    });

    cache.seed(meseFittizio("2026-06", 8));
    orologio.avanza(1_000);

    // `prefetch` esce subito su una entry fresca: è il comportamento voluto
    // per i mesi adiacenti, ma non basta al ritorno sulla scheda.
    cache.prefetch("2026-06");
    expect(caricatore).not.toHaveBeenCalled();

    // `revalida` interroga comunque il server: è ciò che delimita davvero la
    // staleness su focus/visibilità e rivela un cambio di sessione.
    await expect(cache.revalida("2026-06")).resolves.toEqual(aggiornato);
    expect(caricatore).toHaveBeenCalledTimes(1);
    expect(cache.read("2026-06")!.dati).toEqual(aggiornato);
  });

  // ── Notifiche ──────────────────────────────────────────────

  it("notifica gli ascoltatori quando un mese cambia, anche in background", async () => {
    const orologio = orologioControllabile();
    const aggiornato = meseFittizio("2026-06", 12);
    const caricatore = vi.fn().mockResolvedValue(aggiornato);
    const cache = new CacheCalendarioMesi({
      caricatore,
      orologio: orologio.ora,
    });

    const notificati: string[] = [];
    const disiscrivi = cache.subscribe((token) => notificati.push(token));

    cache.seed(meseFittizio("2026-06", 8));
    expect(notificati).toEqual(["2026-06"]);

    orologio.imposta(1_000_000 + DURATA_FRESH_MS);
    await cache.load("2026-06");
    await vi.waitFor(() => {
      expect(notificati).toEqual(["2026-06", "2026-06"]);
    });

    disiscrivi();
    cache.invalidate("2026-06");
    expect(notificati).toEqual(["2026-06", "2026-06"]);
  });
});
