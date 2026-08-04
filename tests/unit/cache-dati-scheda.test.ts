import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ContestoInserimentoGiornata,
  DatiCalendarioMese,
  DatiGiornataAttivita,
} from "@/lib/attivita-contract";
import {
  DURATA_FRESH_MS,
  GuardiaIdentitaScheda,
} from "@/app/(front-office)/attivita/cache-dati-scheda";
import { CacheCalendarioMesi } from "@/app/(front-office)/attivita/calendario-cache";
import { creaContenitoreCacheAttivita } from "@/app/(front-office)/attivita/attivita-cache-provider";
import {
  CHIAVE_CONTESTO_INSERIMENTO,
  CacheContestoInserimento,
  CacheGiornateAttivita,
  MASSIMO_GIORNATE_IN_CACHE,
} from "@/app/(front-office)/attivita/giornata-cache";

/**
 * US-056 — Semantiche proprie delle cache della scheda giornata.
 *
 * Qui si prova ciò che la cache dei mesi (US-052) non copre: la guardia
 * d'identità **condivisa** fra più cache della stessa scheda, la chiave di
 * giornata e la cache a voce singola del contesto di inserimento.
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
const ALTRO_COLLABORATORE = "collab-di-un-altro";

function giornataFittizia(
  data: string,
  ore: number,
  collaboratoreId = COLLABORATORE,
): DatiGiornataAttivita {
  return {
    data,
    collaboratoreId,
    righe: [
      {
        id: `riga-${data}`,
        data,
        ore,
        nota: null,
        fatturabile: true,
        rimborsoTrasfertaEtichetta: null,
        rimborsoTrasfertaImporto: null,
        offerta: {
          id: "offerta-1",
          codice: "OFF-001",
          descrizione: "Consulenza continuativa",
        },
        cliente: {
          id: "cliente-1",
          ragioneSociale: "TechSolutions Srl",
        },
      },
    ],
  };
}

function contestoFittizio(
  ragioneSociale: string,
  collaboratoreId = COLLABORATORE,
): ContestoInserimentoGiornata {
  return {
    collaboratoreId,
    clienti: [{ id: "cliente-1", ragioneSociale }],
    vociRimborso: [
      { id: "voce-1", etichetta: "Trasferta Milano", importo: "42.00" },
    ],
  };
}

function meseFittizio(
  token: string,
  collaboratoreId = COLLABORATORE,
): DatiCalendarioMese {
  return {
    token,
    collaboratoreId,
    sintesiPerGiorno: {
      [`${token}-10`]: {
        data: `${token}-10`,
        righe: 1,
        oreTotali: 8,
        clienti: [
          { clienteId: "cliente-1", ragioneSociale: "TechSolutions Srl", ore: 8 },
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

/**
 * Costruisce le tre cache della scheda sulla stessa guardia d'identità, come fa
 * il provider React: è la configurazione in cui il cambio di account deve
 * svuotare tutto, qualunque sia la cache che se ne accorge.
 */
function schedaConCacheCondivise(opzioni: {
  caricatoreGiornata: (data: string) => Promise<DatiGiornataAttivita>;
  caricatoreContesto?: () => Promise<ContestoInserimentoGiornata>;
  caricatoreMese?: (token: string) => Promise<DatiCalendarioMese>;
  orologio?: () => number;
}) {
  const identitaCambiata = vi.fn();
  const guardia = new GuardiaIdentitaScheda(identitaCambiata);

  const cacheGiornate = new CacheGiornateAttivita({
    caricatore: opzioni.caricatoreGiornata,
    orologio: opzioni.orologio,
    guardia,
  });
  const cacheContesto = new CacheContestoInserimento({
    caricatore:
      opzioni.caricatoreContesto ??
      vi.fn(() => Promise.reject(new Error("caricatore contesto non atteso"))),
    orologio: opzioni.orologio,
    guardia,
  });
  const cacheMesi = new CacheCalendarioMesi({
    caricatore:
      opzioni.caricatoreMese ??
      vi.fn(() => Promise.reject(new Error("caricatore mese non atteso"))),
    orologio: opzioni.orologio,
    guardia,
  });

  return {
    guardia,
    cacheMesi,
    cacheGiornate,
    cacheContesto,
    identitaCambiata,
  };
}

/** Risposta JSON minima per i caricatori del contenitore reale. */
function rispostaJson(corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// ═══════════════════════════════════════════════════════════════

describe("GuardiaIdentitaScheda condivisa fra le cache della scheda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("una risposta di un altro collaboratore rende illeggibili giornate e contesto insieme", async () => {
    const giornataDiAltri = giornataFittizia(
      "2026-06-11",
      9,
      ALTRO_COLLABORATORE,
    );
    const caricatoreGiornata = vi.fn().mockResolvedValue(giornataDiAltri);
    const { cacheGiornate, cacheContesto, guardia, identitaCambiata } =
      schedaConCacheCondivise({ caricatoreGiornata });

    // La scheda è partita con i dati del collaboratore proprietario.
    cacheGiornate.seed(giornataFittizia("2026-06-10", 8));
    cacheContesto.seed(contestoFittizio("TechSolutions Srl"));
    expect(cacheGiornate.read("2026-06-10")!.dati.righe[0].ore).toBe(8);
    expect(cacheContesto.read()!.dati.clienti[0].ragioneSociale).toBe(
      "TechSolutions Srl",
    );
    expect(guardia.identitaRegistrata()).toBe(COLLABORATORE);

    // Nel frattempo, in un'altra scheda, si accede con un altro account: se ne
    // accorge la sola cache delle giornate.
    await expect(cacheGiornate.load("2026-06-11")).resolves.toEqual(
      giornataDiAltri,
    );

    // Anche il contesto, che non ha ricevuto nulla, smette di essere leggibile.
    expect(cacheContesto.read()).toBeNull();
    expect(cacheContesto.haContesto()).toBe(false);

    // Nessuna giornata resta leggibile: né quella nuova né quella precedente.
    expect(cacheGiornate.read("2026-06-10")).toBeNull();
    expect(cacheGiornate.read("2026-06-11")).toBeNull();
    expect(cacheGiornate.giorniInCache()).toEqual([]);

    // Il dato del secondo collaboratore non è mai diventato leggibile.
    expect(guardia.identitaRegistrata()).toBeNull();
    expect(cacheGiornate.identitaInCache()).toBeNull();
    expect(cacheContesto.identitaInCache()).toBeNull();

    // Il consumer viene avvisato una sola volta per l'intera scheda.
    expect(identitaCambiata).toHaveBeenCalledTimes(1);
    expect(identitaCambiata).toHaveBeenCalledWith(ALTRO_COLLABORATORE);
  });

  it("un mese di un altro collaboratore rende illeggibili anche giornate e contesto", async () => {
    // È la ragione dichiarata dell'ADR per condividere la guardia: senza
    // condivisione, un cambio account rilevato dal **calendario** lascerebbe
    // leggibili le giornate del collaboratore precedente, e un fresh hit non
    // emette per costruzione alcuna richiesta che possa accorgersene.
    const meseDiAltri = meseFittizio("2026-07", ALTRO_COLLABORATORE);
    const caricatoreMese = vi.fn().mockResolvedValue(meseDiAltri);
    const caricatoreGiornata = vi.fn(() =>
      Promise.reject(new Error("caricatore giornata non atteso")),
    );
    const {
      cacheMesi,
      cacheGiornate,
      cacheContesto,
      guardia,
      identitaCambiata,
    } = schedaConCacheCondivise({ caricatoreGiornata, caricatoreMese });

    // La scheda è partita con i dati del collaboratore proprietario.
    cacheMesi.seed(meseFittizio("2026-06"));
    cacheGiornate.seed(giornataFittizia("2026-06-10", 8));
    cacheContesto.seed(contestoFittizio("TechSolutions Srl"));
    expect(cacheGiornate.read("2026-06-10")!.dati.righe[0].ore).toBe(8);
    expect(guardia.identitaRegistrata()).toBe(COLLABORATORE);

    // Se ne accorge la sola cache dei mesi: è l'unica che riceve una risposta.
    await expect(cacheMesi.load("2026-07")).resolves.toEqual(meseDiAltri);

    // Nessun dato del collaboratore precedente resta leggibile, in nessuna
    // delle tre cache.
    expect(cacheMesi.read("2026-06")).toBeNull();
    expect(cacheMesi.read("2026-07")).toBeNull();
    expect(cacheMesi.tokenInCache()).toEqual([]);
    expect(cacheGiornate.read("2026-06-10")).toBeNull();
    expect(cacheGiornate.giorniInCache()).toEqual([]);
    expect(cacheContesto.read()).toBeNull();
    expect(cacheContesto.haContesto()).toBe(false);

    expect(guardia.identitaRegistrata()).toBeNull();
    expect(caricatoreGiornata).not.toHaveBeenCalled();

    // Il consumer viene avvisato una sola volta per l'intera scheda.
    expect(identitaCambiata).toHaveBeenCalledTimes(1);
    expect(identitaCambiata).toHaveBeenCalledWith(ALTRO_COLLABORATORE);
  });

  it("una risposta dello stesso collaboratore lascia leggibili entrambe le cache", async () => {
    const giornataAttesa = giornataFittizia("2026-06-11", 5);
    const caricatoreGiornata = vi.fn().mockResolvedValue(giornataAttesa);
    const { cacheGiornate, cacheContesto, guardia, identitaCambiata } =
      schedaConCacheCondivise({ caricatoreGiornata });

    cacheGiornate.seed(giornataFittizia("2026-06-10", 8));
    cacheContesto.seed(contestoFittizio("TechSolutions Srl"));

    await expect(cacheGiornate.load("2026-06-11")).resolves.toEqual(
      giornataAttesa,
    );

    expect(cacheGiornate.read("2026-06-10")!.dati.righe[0].ore).toBe(8);
    expect(cacheGiornate.read("2026-06-11")!.dati).toEqual(giornataAttesa);
    expect(cacheContesto.read()!.dati.clienti[0].ragioneSociale).toBe(
      "TechSolutions Srl",
    );
    expect(guardia.identitaRegistrata()).toBe(COLLABORATORE);
    expect(identitaCambiata).not.toHaveBeenCalled();
  });

  it("dopo lo svuotamento entrambe le cache accettano la nuova identità e tornano leggibili", async () => {
    const caricatoreGiornata = vi
      .fn()
      .mockResolvedValue(giornataFittizia("2026-06-11", 9, ALTRO_COLLABORATORE));
    const { cacheGiornate, cacheContesto, guardia, identitaCambiata } =
      schedaConCacheCondivise({ caricatoreGiornata });

    cacheGiornate.seed(giornataFittizia("2026-06-10", 8));
    cacheContesto.seed(contestoFittizio("TechSolutions Srl"));

    // Cambio di account: entrambe le cache si svuotano.
    await cacheGiornate.load("2026-06-11");
    expect(cacheGiornate.read("2026-06-10")).toBeNull();
    expect(cacheContesto.read()).toBeNull();

    // La scheda ricarica i dati del nuovo collaboratore.
    const giornataNuova = giornataFittizia("2026-06-11", 9, ALTRO_COLLABORATORE);
    cacheGiornate.seed(giornataNuova);
    cacheContesto.seed(contestoFittizio("DataFlow Spa", ALTRO_COLLABORATORE));

    expect(cacheGiornate.read("2026-06-11")!.dati).toEqual(giornataNuova);
    expect(cacheContesto.read()!.dati.clienti[0].ragioneSociale).toBe(
      "DataFlow Spa",
    );
    expect(guardia.identitaRegistrata()).toBe(ALTRO_COLLABORATORE);

    // La notifica resta una sola: il ritorno alla leggibilità non ne emette altre.
    expect(identitaCambiata).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════

describe("Contenitore delle cache dell'area attività", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("il calendario del contenitore reale condivide la guardia con giornate e contesto", async () => {
    // Qui non si ricostruisce la configurazione del provider: si usa la sua,
    // così la garanzia resta provata anche se qualcuno smettesse di passare la
    // guardia condivisa a una delle tre cache.
    const meseDiAltri = meseFittizio("2026-07", ALTRO_COLLABORATORE);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => rispostaJson(meseDiAltri)),
    );

    const contenitore = creaContenitoreCacheAttivita("sessione-di-prova");
    const sessioneNonPiuValida = vi.fn();
    contenitore.ascoltatoriSessione.add(sessioneNonPiuValida);

    contenitore.cacheGiornate.seed(giornataFittizia("2026-06-10", 8));
    contenitore.cacheContesto.seed(contestoFittizio("TechSolutions Srl"));
    expect(contenitore.cacheGiornate.read("2026-06-10")).not.toBeNull();

    await expect(contenitore.cacheMesi.load("2026-07")).resolves.toEqual(
      meseDiAltri,
    );

    expect(contenitore.cacheGiornate.read("2026-06-10")).toBeNull();
    expect(contenitore.cacheContesto.read()).toBeNull();
    expect(contenitore.cacheMesi.read("2026-07")).toBeNull();
    expect(contenitore.guardia.identitaRegistrata()).toBeNull();
    expect(sessioneNonPiuValida).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════

describe("CacheGiornateAttivita", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seed indicizza la giornata per data e la restituisce fresca senza invocare il caricatore", async () => {
    const orologio = orologioControllabile();
    const caricatore = vi.fn();
    const cache = new CacheGiornateAttivita({
      caricatore,
      orologio: orologio.ora,
    });

    const seminata = giornataFittizia("2026-06-10", 8);
    cache.seed(seminata);

    expect(cache.giorniInCache()).toEqual(["2026-06-10"]);

    orologio.avanza(DURATA_FRESH_MS - 1);

    const lettura = cache.read("2026-06-10");
    expect(lettura).not.toBeNull();
    expect(lettura!.stato).toBe("fresco");
    expect(lettura!.eta).toBe(DURATA_FRESH_MS - 1);
    expect(lettura!.cachedAt).toBe(1_000_000);
    expect(lettura!.expiresAt).toBe(1_000_000 + DURATA_FRESH_MS);
    expect(lettura!.dati).toEqual(seminata);

    await expect(cache.load("2026-06-10")).resolves.toEqual(seminata);
    expect(caricatore).not.toHaveBeenCalled();
  });

  it("al bordo esatto della finestra fresca la giornata è scaduta e tre letture producono una sola rivalidazione", async () => {
    const orologio = orologioControllabile();
    const aggiornata = giornataFittizia("2026-06-10", 12);
    const caricatore = vi.fn().mockResolvedValue(aggiornata);
    const cache = new CacheGiornateAttivita({
      caricatore,
      orologio: orologio.ora,
    });

    const seminata = giornataFittizia("2026-06-10", 8);
    cache.seed(seminata);

    orologio.imposta(1_000_000 + DURATA_FRESH_MS);

    const lettura = cache.read("2026-06-10");
    expect(lettura!.stato).toBe("scaduto");
    expect(lettura!.eta).toBe(DURATA_FRESH_MS);

    // Il dato vecchio è restituito subito: l'elenco righe non si svuota.
    await expect(cache.load("2026-06-10")).resolves.toEqual(seminata);
    await cache.load("2026-06-10");
    await cache.load("2026-06-10");
    await Promise.resolve();

    expect(caricatore).toHaveBeenCalledTimes(1);
    expect(caricatore).toHaveBeenCalledWith("2026-06-10");

    await vi.waitFor(() => {
      expect(cache.read("2026-06-10")!.dati).toEqual(aggiornata);
    });
    expect(cache.read("2026-06-10")!.stato).toBe("fresco");
    expect(cache.read("2026-06-10")!.eta).toBe(0);
  });

  it("conserva al massimo un mese di giornate ed espelle la meno recentemente usata", async () => {
    const caricatore = vi
      .fn()
      .mockImplementation((data: string) =>
        Promise.resolve(giornataFittizia(data, 1)),
      );
    const cache = new CacheGiornateAttivita({ caricatore });

    // 31 giorni consecutivi: 2026-07-01 … 2026-07-31
    for (let giorno = 1; giorno <= MASSIMO_GIORNATE_IN_CACHE; giorno += 1) {
      await cache.load(`2026-07-${String(giorno).padStart(2, "0")}`);
    }
    expect(cache.giorniInCache()).toHaveLength(MASSIMO_GIORNATE_IN_CACHE);

    // Rileggo il primo giorno: diventa il più recentemente usato.
    expect(cache.read("2026-07-01")).not.toBeNull();

    // La trentaduesima giornata espelle 2026-07-02, non 2026-07-01.
    await cache.load("2026-08-01");

    expect(cache.giorniInCache()).toHaveLength(MASSIMO_GIORNATE_IN_CACHE);
    expect(cache.read("2026-07-02")).toBeNull();
    expect(cache.read("2026-07-01")!.dati.data).toBe("2026-07-01");
    expect(cache.read("2026-08-01")!.dati.data).toBe("2026-08-01");
  });

  it("non espelle la giornata appena scritta", async () => {
    const caricatore = vi
      .fn()
      .mockImplementation((data: string) =>
        Promise.resolve(giornataFittizia(data, 1)),
      );
    const cache = new CacheGiornateAttivita({ caricatore });

    // 36 giornate distinte: l'espulsione scatta cinque volte.
    for (let giorno = 1; giorno <= MASSIMO_GIORNATE_IN_CACHE + 5; giorno += 1) {
      const data =
        giorno <= 31
          ? `2026-07-${String(giorno).padStart(2, "0")}`
          : `2026-08-${String(giorno - 31).padStart(2, "0")}`;
      await cache.load(data);
      // La giornata appena caricata è sempre quella su cui si sta lavorando.
      expect(cache.read(data)!.dati.data).toBe(data);
    }

    expect(cache.giorniInCache()).toHaveLength(MASSIMO_GIORNATE_IN_CACHE);
    // Le cinque giornate più vecchie sono uscite, le ultime 31 sono in cache.
    expect(cache.read("2026-07-01")).toBeNull();
    expect(cache.read("2026-07-05")).toBeNull();
    expect(cache.read("2026-07-06")!.dati.data).toBe("2026-07-06");
    expect(cache.read("2026-08-05")!.dati.data).toBe("2026-08-05");
  });
});

// ═══════════════════════════════════════════════════════════════

describe("CacheContestoInserimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seed usa sempre la chiave costante: due semine non fanno crescere la cache oltre una voce", () => {
    const cache = new CacheContestoInserimento({ caricatore: vi.fn() });

    cache.seed(contestoFittizio("TechSolutions Srl"));
    cache.seed(contestoFittizio("DataFlow Spa"));

    expect(cache.chiaviInCache()).toEqual([CHIAVE_CONTESTO_INSERIMENTO]);
    expect(cache.haContesto()).toBe(true);
    // L'ultima semina è quella leggibile: la voce è stata sovrascritta, non affiancata.
    expect(cache.read()!.dati.clienti[0].ragioneSociale).toBe("DataFlow Spa");
  });

  it("revalida forza la lettura anche su una voce ancora fresca e aggiorna il dato", async () => {
    const orologio = orologioControllabile();
    const aggiornato = contestoFittizio("DataFlow Spa");
    const caricatore = vi.fn().mockResolvedValue(aggiornato);
    const cache = new CacheContestoInserimento({
      caricatore,
      orologio: orologio.ora,
    });

    cache.seed(contestoFittizio("TechSolutions Srl"));
    orologio.avanza(1_000);
    expect(cache.read()!.stato).toBe("fresco");

    // Il cambio giorno entro la finestra fresca non interroga il server: è ciò
    // che impedisce di richiedere clienti e voci ad ogni giornata.
    await expect(cache.load()).resolves.toEqual(
      contestoFittizio("TechSolutions Srl"),
    );
    expect(caricatore).not.toHaveBeenCalled();

    // Il ritorno sulla scheda invece rilegge comunque: un nuovo cliente
    // abilitato compare senza attendere la scadenza.
    await expect(cache.revalida()).resolves.toEqual(aggiornato);
    expect(caricatore).toHaveBeenCalledTimes(1);
    expect(cache.read()!.dati.clienti[0].ragioneSociale).toBe("DataFlow Spa");
    expect(cache.read()!.stato).toBe("fresco");
  });

  it("una invalidazione neutralizza una risposta già in volo, che non ripopola la voce", async () => {
    const trattenuta = promessaTrattenuta<ContestoInserimentoGiornata>();
    const caricatore = vi.fn().mockReturnValue(trattenuta.promessa);
    const cache = new CacheContestoInserimento({ caricatore });

    const caricamento = cache.load();
    expect(cache.caricamentiInVolo()).toBe(1);

    // La mutazione (per esempio una nuova offerta abilitata) avviene mentre la
    // lettura è ancora in volo.
    cache.invalidate();

    trattenuta.risolvi(contestoFittizio("TechSolutions Srl"));
    await expect(caricamento).resolves.toEqual(
      contestoFittizio("TechSolutions Srl"),
    );

    // Il dato antecedente alla mutazione non è entrato in cache.
    expect(cache.read()).toBeNull();
    expect(cache.haContesto()).toBe(false);
    expect(cache.chiaviInCache()).toEqual([]);
  });
});
