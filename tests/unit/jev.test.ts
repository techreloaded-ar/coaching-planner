import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analizzaEventiCalendario, type OffertaAssociabile } from "@/lib/jev";
import { proposteDaEventi, type PropostaEvento } from "@/domain/calendario-google";

const GIORNO = "2026-10-21";

const proposta = (eventoId: string, titolo: string, dominiPartecipanti: string[] = []): PropostaEvento => ({
  eventoId,
  titolo,
  descrizione: "",
  inizio: "09:00",
  fine: "10:00",
  ore: 1,
  dominiPartecipanti,
});

const OFFERTE: OffertaAssociabile[] = [
  {
    id: "off-bvl",
    codice: "BVL-TRASF",
    descrizione: "Trasformazione agile area IT",
    attiva: true,
    createdAt: new Date("2026-01-15T10:00:00Z"),
    cliente: { id: "cli-bvl", ragioneSociale: "Banca Valdostana S.p.A." },
  },
  {
    id: "off-frr-chiusa",
    codice: "FRR-KANBAN",
    descrizione: "Introduzione Kanban magazzino",
    attiva: false,
    createdAt: new Date("2025-12-31T10:00:00Z"),
    cliente: { id: "cli-frr", ragioneSociale: "Ferramenta Rossi S.r.l." },
  },
  {
    id: "off-int",
    codice: "INT-FORM",
    descrizione: "Formazione interna",
    attiva: true,
    createdAt: new Date("2025-06-01T10:00:00Z"),
    cliente: { id: "cli-int", ragioneSociale: "Agile Reloaded S.r.l." },
  },
];

const ETICHETTA_BVL = "Banca Valdostana S.p.A. – BVL-TRASF";
const ETICHETTA_FRR = "Ferramenta Rossi S.r.l. – FRR-KANBAN";

const API_KEY = "chiave-openrouter-segreta";

/** Risposta System One con le probabilità indicate. */
function rispostaJev(scelta: string, confidenza: number, cliente: number, nonLavorativo = 0.05): Response {
  return new Response(
    JSON.stringify({
      model: "typesafe/jev-1.14-20261014",
      answers: {
        clientIdentified: { type: "noul", noul: cliente },
        offer: { type: "choice", choice: scelta, confidence: confidenza, probabilities: { [scelta]: confidenza } },
        notWorkRelated: { type: "noul", noul: nonLavorativo },
      },
      usage: { input_tokens: 700, output_tokens: 75, cost: 0.00003 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

/** Tutte le righe di log scritte, qualunque sia il livello. */
function righeLog(): string[] {
  return [vi.mocked(console.info), vi.mocked(console.warn), vi.mocked(console.error)]
    .flatMap((spia) => spia.mock.calls)
    .map((argomenti) => argomenti.join(" "));
}

/** Corpi JSON inviati a Jev, nell'ordine delle chiamate. */
const corpiInviati = (mockFetch: ReturnType<typeof vi.fn>) =>
  mockFetch.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));

describe("analizzaEventiCalendario con Jev", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.stubEnv("E2E_TEST_MODE", "false");
    vi.stubEnv("OPENROUTER_API_KEY", API_KEY);
    vi.stubEnv("JEV_MODEL", "");
    vi.stubEnv("JEV_SOGLIA_CONFIDENZA", "");
    mockFetch.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("invia a System One un evento per richiesta, con la chiave solo nell'header e le offerte chiuse come opzioni", async () => {
    mockFetch.mockImplementation(async () => rispostaJev(ETICHETTA_BVL, 0.9, 0.9));

    await analizzaEventiCalendario(
      [{ ...proposta("ev-1", "Steering BVL", ["bancavaldostana.it"]), descrizione: "Sala 3", inizio: "14:30", fine: "15:15" }],
      OFFERTE,
      GIORNO
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/systemone");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);
    expect(init.body).not.toContain(API_KEY);

    const [corpo] = corpiInviati(mockFetch);
    expect(corpo.model).toBe("~typesafe/jev-latest");
    expect(corpo.state).toEqual({
      calendarEvent: {
        title: "Steering BVL",
        start: "2026-10-21T14:30",
        end: "2026-10-21T15:15",
        timeZone: "Europe/Rome",
        description: "Sala 3",
        attendeeDomains: ["bancavaldostana.it"],
      },
    });
    expect(Object.keys(corpo.questions)).toEqual(["clientIdentified", "offer", "notWorkRelated"]);
    expect(corpo.questions.clientIdentified.type).toBe("noul");
    expect(corpo.questions.clientIdentified.instructions.clients).toEqual([
      "Banca Valdostana S.p.A.",
      "Ferramenta Rossi S.r.l.",
      "Agile Reloaded S.r.l.",
    ]);
    expect(corpo.questions.notWorkRelated.type).toBe("noul");
    expect(corpo.questions.offer.type).toBe("choice");
    expect(corpo.questions.offer.criteria[ETICHETTA_FRR]).toEqual({
      client: "Ferramenta Rossi S.r.l.",
      offerCode: "FRR-KANBAN",
      offerDescription: "Introduzione Kanban magazzino",
      status: "closed",
      createdOn: "2025-12-31",
    });
    expect(corpo.questions.offer.criteria[ETICHETTA_BVL].status).toBe("active");
  });

  it("precompila con un invitato del dominio del cliente (AC-1)", async () => {
    mockFetch.mockResolvedValue(rispostaJev(ETICHETTA_BVL, 0.95, 0.97));

    const analisi = await analizzaEventiCalendario(
      [proposta("ev-sync", "Allineamento", ["bancavaldostana.it"])],
      OFFERTE,
      GIORNO
    );

    expect([...analisi.associazioni]).toEqual([["ev-sync", "off-bvl"]]);
  });

  it("chiama Jev anche tra soli colleghi e precompila con il cliente citato nel titolo (AC-2)", async () => {
    mockFetch.mockResolvedValue(rispostaJev(ETICHETTA_BVL, 0.88, 0.93));

    const analisi = await analizzaEventiCalendario(
      [proposta("ev-prep", "Preparazione workshop per Banca Valdostana", ["agilereloaded.it"])],
      OFFERTE,
      GIORNO
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(corpiInviati(mockFetch)[0].state.calendarEvent.attendeeDomains).toEqual([]);
    expect([...analisi.associazioni]).toEqual([["ev-prep", "off-bvl"]]);
  });

  it("lascia da scegliere un evento con soli domini di terzi e titolo generico (AC-3)", async () => {
    mockFetch.mockResolvedValue(rispostaJev(ETICHETTA_BVL, 0.6, 0.12));

    const analisi = await analizzaEventiCalendario(
      [proposta("ev-terzi", "Call di allineamento", ["gmail.com", "studiolinea.it", "partnerconsulting.eu"])],
      OFFERTE,
      GIORNO
    );

    expect(corpiInviati(mockFetch)[0].state.calendarEvent.attendeeDomains).toEqual([
      "gmail.com",
      "studiolinea.it",
      "partnerconsulting.eu",
    ]);
    expect(analisi.associazioni.size).toBe(0);
    expect(analisi.nonLavorativi.size).toBe(0);
  });

  it("toglie i domini interni configurati prima della chiamata (AC-4)", async () => {
    mockFetch.mockImplementation(async () => rispostaJev(ETICHETTA_BVL, 0.9, 0.9));

    await analizzaEventiCalendario(
      [proposta("ev-predefinito", "Sync", ["agilereloaded.it", "bancavaldostana.it"])],
      OFFERTE,
      GIORNO
    );
    vi.stubEnv("DOMINI_INTERNI", " Interno.example , agilereloaded.it");
    await analizzaEventiCalendario(
      [proposta("ev-configurato", "Sync", ["interno.example", "agilereloaded.it", "bancavaldostana.it"])],
      OFFERTE,
      GIORNO
    );

    expect(corpiInviati(mockFetch).map((c) => c.state.calendarEvent.attendeeDomains)).toEqual([
      ["bancavaldostana.it"],
      ["bancavaldostana.it"],
    ]);
  });

  it("non invia mai indirizzi email né righe di esempio (AC-5)", async () => {
    mockFetch.mockImplementation(async () => rispostaJev(ETICHETTA_BVL, 0.9, 0.9));
    const [daCalendario] = proposteDaEventi(
      [
        {
          id: "ev-google",
          summary: "Steering",
          start: { dateTime: `${GIORNO}T09:00:00+02:00` },
          end: { dateTime: `${GIORNO}T10:00:00+02:00` },
          attendees: [
            { email: "io@agilereloaded.it", self: true },
            { email: "elena.cerutti@bancavaldostana.it" },
            { email: "marco.bassi@gmail.com" },
          ],
        },
      ],
      GIORNO
    );

    await analizzaEventiCalendario([daCalendario], OFFERTE, GIORNO);

    const corpo = (mockFetch.mock.calls[0][1] as RequestInit).body as string;
    expect(corpo).not.toContain("@");
    expect(JSON.parse(corpo).state.calendarEvent.attendeeDomains).toEqual(["bancavaldostana.it", "gmail.com"]);
    expect(Object.keys(JSON.parse(corpo))).toEqual(["model", "state", "questions"]);
  });

  it("non precompila sotto soglia, senza cliente identificato o con offerta chiusa (AC-7)", async () => {
    mockFetch
      .mockResolvedValueOnce(rispostaJev(ETICHETTA_BVL, 0.69, 0.95))
      .mockResolvedValueOnce(rispostaJev(ETICHETTA_BVL, 0.99, 0.49))
      .mockResolvedValueOnce(rispostaJev(ETICHETTA_FRR, 0.99, 0.97))
      .mockResolvedValueOnce(rispostaJev(ETICHETTA_BVL, 0.7, 0.5));

    const analisi = await analizzaEventiCalendario(
      [
        proposta("ev-sotto-soglia", "Uno"),
        proposta("ev-cliente-dubbio", "Due"),
        proposta("ev-chiusa", "Tre"),
        proposta("ev-al-limite", "Quattro"),
      ],
      OFFERTE,
      GIORNO
    );

    expect([...analisi.associazioni]).toEqual([["ev-al-limite", "off-bvl"]]);
    expect(righeLog()).toEqual([
      expect.stringMatching(
        /^Jev: esito=ok modello=~typesafe\/jev-latest eventi=4 offerte=3 durataMs=\d+ associazioniAlta=1 associazioniBassa=3 nonLavorativi=0$/
      ),
    ]);
  });

  it("usa la soglia di JEV_SOGLIA_CONFIDENZA e il modello di JEV_MODEL", async () => {
    vi.stubEnv("JEV_SOGLIA_CONFIDENZA", "0.9");
    vi.stubEnv("JEV_MODEL", "typesafe/jev-1.14");
    mockFetch.mockResolvedValue(rispostaJev(ETICHETTA_BVL, 0.85, 0.95));

    const analisi = await analizzaEventiCalendario([proposta("ev", "Steering BVL")], OFFERTE, GIORNO);

    expect(analisi.associazioni.size).toBe(0);
    expect(corpiInviati(mockFetch)[0].model).toBe("typesafe/jev-1.14");
  });

  it("esclude gli eventi non lavorativi (AC-8)", async () => {
    mockFetch.mockResolvedValue(rispostaJev(ETICHETTA_BVL, 0.9, 0.2, 0.93));

    const analisi = await analizzaEventiCalendario([proposta("ev-pranzo", "Pausa pranzo")], OFFERTE, GIORNO);

    expect([...analisi.nonLavorativi]).toEqual(["ev-pranzo"]);
    expect(analisi.associazioni.size).toBe(0);
  });

  it("limita le richieste in parallelo e associa ogni risposta al proprio evento (AC-9)", async () => {
    let inVolo = 0;
    let massimoInVolo = 0;
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      inVolo++;
      massimoInVolo = Math.max(massimoInVolo, inVolo);
      await new Promise((r) => setTimeout(r, 5));
      inVolo--;
      const titolo = JSON.parse(init.body as string).state.calendarEvent.title as string;
      return titolo.startsWith("BVL") ? rispostaJev(ETICHETTA_BVL, 0.9, 0.9) : rispostaJev(ETICHETTA_BVL, 0.9, 0.1);
    });

    const proposte = Array.from({ length: 10 }, (_, i) => proposta(`ev-${i}`, i % 2 === 0 ? `BVL ${i}` : `Altro ${i}`));
    const analisi = await analizzaEventiCalendario(proposte, OFFERTE, GIORNO);

    expect(mockFetch).toHaveBeenCalledTimes(10);
    expect(massimoInVolo).toBe(4);
    expect([...analisi.associazioni.keys()].sort()).toEqual(["ev-0", "ev-2", "ev-4", "ev-6", "ev-8"]);
  });

  it("ritenta con backoff solo su 429 e 5xx (AC-9)", async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(new Response("{}", { status: 529 }))
      .mockResolvedValueOnce(rispostaJev(ETICHETTA_BVL, 0.9, 0.9));

    const promessa = analizzaEventiCalendario([proposta("ev", "Steering")], OFFERTE, GIORNO);
    await vi.runAllTimersAsync();

    expect((await promessa).associazioni.get("ev")).toBe("off-bvl");
    expect(mockFetch).toHaveBeenCalledTimes(3);

    mockFetch.mockReset();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 422, message: `Invalid question. Key ${API_KEY}` } }), { status: 422 })
    );
    await analizzaEventiCalendario([proposta("ev", "Steering")], OFFERTE, GIORNO);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(righeLog().at(-1)).toMatch(
      /^Jev: esito=errore-http modello=~typesafe\/jev-latest eventi=1 offerte=3 durataMs=\d+ associazioniAlta=0 associazioniBassa=0 nonLavorativi=0 eventiInErrore=1 stato=422 messaggio="Invalid question. Key \[chiave\]"$/
    );
  });

  it("dopo i tentativi esauriti degrada senza eccezioni, tenendo gli eventi riusciti (AC-10)", async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) =>
      JSON.parse(init.body as string).state.calendarEvent.title === "Riuscito"
        ? rispostaJev(ETICHETTA_BVL, 0.9, 0.9)
        : new Response(JSON.stringify({ error: { message: "Provider overloaded" } }), { status: 503 })
    );

    const promessa = analizzaEventiCalendario(
      [proposta("ev-ok", "Riuscito"), proposta("ev-ko", "Fallito")],
      OFFERTE,
      GIORNO
    );
    await vi.runAllTimersAsync();
    const analisi = await promessa;

    expect([...analisi.associazioni]).toEqual([["ev-ok", "off-bvl"]]);
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(righeLog()).toEqual([
      expect.stringMatching(/^Jev: esito=errore-http .*eventiInErrore=1 stato=503 messaggio="Provider overloaded"$/),
    ]);
  });

  it("distingue timeout, errore di rete e risposta non valida senza esporre dati (AC-10)", async () => {
    const eventi = [{ ...proposta("ev", "Kickoff riservato", ["bancavaldostana.it"]), descrizione: "Sala 3" }];

    mockFetch.mockRejectedValueOnce(new DOMException("scaduto", "TimeoutError"));
    expect((await analizzaEventiCalendario(eventi, OFFERTE, GIORNO)).associazioni.size).toBe(0);

    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await analizzaEventiCalendario(eventi, OFFERTE, GIORNO)).associazioni.size).toBe(0);

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ answers: { offer: { choice: "x" } } })));
    expect((await analizzaEventiCalendario(eventi, OFFERTE, GIORNO)).associazioni.size).toBe(0);

    mockFetch.mockResolvedValueOnce(new Response("<html>non json</html>", { status: 200 }));
    expect((await analizzaEventiCalendario(eventi, OFFERTE, GIORNO)).associazioni.size).toBe(0);

    const righe = righeLog();
    expect(righe).toEqual([
      expect.stringMatching(/^Jev: esito=timeout .*eventiInErrore=1$/),
      expect.stringMatching(/^Jev: esito=errore-rete .*eventiInErrore=1 tipoErrore=TypeError$/),
      expect.stringMatching(/^Jev: esito=risposta-non-valida /),
      expect.stringMatching(/^Jev: esito=risposta-non-valida /),
    ]);
    const tutto = righe.join("\n");
    for (const dato of [API_KEY, "Kickoff", "Sala 3", "bancavaldostana.it", "Banca Valdostana"]) {
      expect(tutto).not.toContain(dato);
    }
  });

  it("senza chiave non chiama Jev e lo registra (AC-10, AC-11)", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");

    const analisi = await analizzaEventiCalendario([proposta("ev", "Steering")], OFFERTE, GIORNO);

    expect(analisi.associazioni.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(righeLog()).toEqual(["Jev: esito=chiave-assente modello=~typesafe/jev-latest eventi=1 offerte=3 durataMs=0"]);
  });

  it("senza offerte abilitate non chiama Jev e lo registra; senza proposte non scrive log", async () => {
    await analizzaEventiCalendario([proposta("ev", "Steering")], [], GIORNO);
    await analizzaEventiCalendario([], OFFERTE, GIORNO);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(righeLog()).toEqual([
      "Jev: esito=nessuna-offerta-abilitata modello=~typesafe/jev-latest eventi=1 offerte=0 durataMs=0",
    ]);
  });
});

describe("analizzaEventiCalendario in E2E_TEST_MODE", () => {
  beforeEach(() => {
    vi.stubEnv("E2E_TEST_MODE", "true");
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("simula la regola di Jev: dominio o nome del cliente citato, solo offerte attive (AC-12)", async () => {
    const proposte: PropostaEvento[] = [
      proposta("ev-dominio", "Sync settimanale", ["bancavaldostana.it"]),
      proposta("ev-nome", "Preparazione workshop per banca valdostana s.p.a.", ["agilereloaded.it"]),
      proposta("ev-codice", "Riunione INT-FORM"),
      proposta("ev-chiusa", "Riunione FRR-KANBAN"),
      proposta("ev-interno", "Allineamento", ["agilereloaded.it"]),
      proposta("ev-descrizione", "Lavoro su formazione interna"),
      proposta("ev-palestra", "Palestra"),
      proposta("ev-terzi", "Call", ["gmail.com"]),
    ];

    const analisi = await analizzaEventiCalendario(proposte, OFFERTE, GIORNO);

    expect(fetch).not.toHaveBeenCalled();
    expect([...analisi.associazioni]).toEqual([
      ["ev-dominio", "off-bvl"],
      ["ev-nome", "off-bvl"],
      ["ev-codice", "off-int"],
    ]);
    expect([...analisi.nonLavorativi]).toEqual(["ev-palestra"]);
    expect(vi.mocked(console.info).mock.calls[0][0]).toMatch(
      /^Jev: esito=ok modello=simulato-e2e eventi=8 offerte=3 durataMs=\d+ associazioniAlta=3 associazioniBassa=1 nonLavorativi=1$/
    );
  });
});
