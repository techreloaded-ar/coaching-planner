import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analizzaEventiCalendario, type OffertaAssociabile } from "@/lib/gemini";
import type { PropostaEvento } from "@/domain/calendario-google";

const PROPOSTE: PropostaEvento[] = [
  { eventoId: "ev-acme", titolo: "Kickoff progetto con Acme", descrizione: "Sala 3", inizio: "09:00", fine: "10:00", ore: 1, dominiPartecipanti: ["acme.it"] },
  { eventoId: "ev-pranzo", titolo: "Pausa pranzo", descrizione: "", inizio: "13:00", fine: "14:00", ore: 1, dominiPartecipanti: [] },
  { eventoId: "ev-call", titolo: "Call", descrizione: "", inizio: "15:00", fine: "16:00", ore: 1, dominiPartecipanti: [] },
];

const OFFERTE: OffertaAssociabile[] = [
  { id: "off-acme", codice: "ACME-01", descrizione: "Coaching agile", cliente: { id: "cli-acme", ragioneSociale: "Acme Spa" } },
  { id: "off-beta", codice: "BETA-02", descrizione: "Formazione", cliente: { id: "cli-beta", ragioneSociale: "Beta Srl" } },
];

const API_KEY = "chiave-gemini-segreta";

function rispostaGemini(associazioni: unknown): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ associazioni }) }] } }],
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

describe("analizzaEventiCalendario", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.stubEnv("E2E_TEST_MODE", "false");
    vi.stubEnv("GEMINI_API_KEY", API_KEY);
    vi.stubEnv("GEMINI_MODEL", "");
    mockFetch.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("invia eventi con domini dei partecipanti, offerte abilitate ed esempi, con la chiave nell'header", async () => {
    mockFetch.mockResolvedValue(rispostaGemini([]));

    await analizzaEventiCalendario(PROPOSTE, OFFERTE, [
      { nota: "Retrospettiva Acme", offertaId: "off-acme" },
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
    );
    expect(url).not.toContain(API_KEY);
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(API_KEY);

    const corpo = JSON.parse(init.body as string);
    expect(init.body).not.toContain(API_KEY);
    const prompt = corpo.contents[0].parts[0].text as string;
    expect(prompt).toContain('"offertaId":"off-acme","codice":"ACME-01","descrizione":"Coaching agile","cliente":"Acme Spa"');
    expect(prompt).toContain('"eventoId":"ev-acme","titolo":"Kickoff progetto con Acme","descrizione":"Sala 3","orario":"09:00-10:00","dominiPartecipanti":["acme.it"]');
    expect(prompt).toContain('[{"nota":"Retrospettiva Acme","offertaId":"off-acme"}]');
    // Confidenza e non lavorativo sono richiesti dallo schema di risposta.
    expect(corpo.generationConfig.responseSchema.properties.associazioni.items.required).toEqual([
      "eventoId",
      "offertaId",
      "confidenza",
      "nonLavorativo",
    ]);
    expect(corpo.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
  });

  it("precompila solo a confidenza alta ed esclude i non lavorativi (US-001, US-002)", async () => {
    mockFetch.mockResolvedValue(
      rispostaGemini([
        { eventoId: "ev-acme", offertaId: "off-acme", confidenza: "ALTA", nonLavorativo: false },
        { eventoId: "ev-pranzo", offertaId: null, confidenza: "BASSA", nonLavorativo: true },
        { eventoId: "ev-call", offertaId: "off-beta", confidenza: "BASSA", nonLavorativo: false },
      ])
    );

    const analisi = await analizzaEventiCalendario(PROPOSTE, OFFERTE);

    expect([...analisi.associazioni]).toEqual([["ev-acme", "off-acme"]]);
    expect([...analisi.nonLavorativi]).toEqual(["ev-pranzo"]);
    expect(righeLog()).toEqual([
      expect.stringMatching(
        /^Gemini: esito=ok modello=gemini-flash-latest eventi=3 offerte=2 durataMs=\d+ associazioniAlta=1 associazioniBassa=1 nonLavorativi=1$/
      ),
    ]);
  });

  it("scarta offerte non abilitate ed eventi sconosciuti", async () => {
    mockFetch.mockResolvedValue(
      rispostaGemini([
        { eventoId: "ev-acme", offertaId: "off-non-abilitata", confidenza: "ALTA", nonLavorativo: false },
        { eventoId: "ev-inventato", offertaId: "off-beta", confidenza: "ALTA", nonLavorativo: true },
      ])
    );

    const analisi = await analizzaEventiCalendario(PROPOSTE, OFFERTE);

    expect(analisi.associazioni.size).toBe(0);
    expect(analisi.nonLavorativi.size).toBe(0);
  });

  it("senza API key non chiama Gemini e lo registra (US-004)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const analisi = await analizzaEventiCalendario(PROPOSTE, OFFERTE);

    expect(analisi.associazioni.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(righeLog()).toEqual([
      "Gemini: esito=chiave-assente modello=gemini-flash-latest eventi=3 offerte=2 durataMs=0",
    ]);
  });

  it("senza offerte abilitate non chiama Gemini e lo registra (US-004)", async () => {
    await analizzaEventiCalendario(PROPOSTE, []);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(righeLog()).toEqual([
      "Gemini: esito=nessuna-offerta-abilitata modello=gemini-flash-latest eventi=3 offerte=0 durataMs=0",
    ]);
  });

  it("senza proposte non chiama Gemini e non scrive log", async () => {
    await analizzaEventiCalendario([], OFFERTE);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(righeLog()).toEqual([]);
  });

  it("registra stato e messaggio di Google sugli errori HTTP, senza la chiave (US-004)", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 402,
            message: `Your prepayment credits are depleted. Key ${API_KEY}`,
            status: "PAYMENT_REQUIRED",
          },
        }),
        { status: 402 }
      )
    );

    const analisi = await analizzaEventiCalendario(PROPOSTE, OFFERTE);

    expect(analisi.associazioni.size).toBe(0);
    const [riga, ...altre] = righeLog();
    expect(altre).toEqual([]);
    expect(riga).toMatch(
      /^Gemini: esito=errore-http modello=gemini-flash-latest eventi=3 offerte=2 durataMs=\d+ stato=402 statoGoogle=PAYMENT_REQUIRED messaggio="Your prepayment credits are depleted. Key \[chiave\]"$/
    );
  });

  it("distingue timeout, errore di rete e risposta non valida senza esporre dati (US-004)", async () => {
    mockFetch.mockRejectedValueOnce(new DOMException("scaduto", "TimeoutError"));
    expect((await analizzaEventiCalendario(PROPOSTE, OFFERTE)).associazioni.size).toBe(0);

    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await analizzaEventiCalendario(PROPOSTE, OFFERTE)).associazioni.size).toBe(0);

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "non json" }] } }] }))
    );
    expect((await analizzaEventiCalendario(PROPOSTE, OFFERTE)).associazioni.size).toBe(0);

    mockFetch.mockResolvedValueOnce(new Response("<html>non json</html>", { status: 200 }));
    expect((await analizzaEventiCalendario(PROPOSTE, OFFERTE)).associazioni.size).toBe(0);

    const righe = righeLog();
    expect(righe).toEqual([
      expect.stringMatching(/^Gemini: esito=timeout .*durataMs=\d+$/),
      expect.stringMatching(/^Gemini: esito=errore-rete .*tipoErrore=TypeError$/),
      expect.stringMatching(/^Gemini: esito=risposta-non-valida /),
      expect.stringMatching(/^Gemini: esito=risposta-non-valida /),
    ]);
    const tutto = righe.join("\n");
    for (const dato of [API_KEY, "Kickoff", "Sala 3", "acme.it", "Pausa pranzo"]) {
      expect(tutto).not.toContain(dato);
    }
  });

  it("usa il modello configurato in GEMINI_MODEL, senza livello di ragionamento per i modelli pro", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-pro");
    mockFetch.mockResolvedValue(rispostaGemini([]));

    await analizzaEventiCalendario(PROPOSTE, OFFERTE);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/models/gemini-2.5-pro:generateContent");
    expect(JSON.parse(init.body as string).generationConfig.thinkingConfig).toBeUndefined();
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

  it("simula confidenza alta (dominio o codice), bassa (descrizione) ed eventi non lavorativi", async () => {
    const proposte: PropostaEvento[] = [
      { ...PROPOSTE[2], eventoId: "ev-dominio", titolo: "Sync settimanale", dominiPartecipanti: ["acmespa.com"] },
      { ...PROPOSTE[2], eventoId: "ev-codice", titolo: "Riunione BETA-02" },
      { ...PROPOSTE[2], eventoId: "ev-descrizione", titolo: "Sessione di formazione" },
      { ...PROPOSTE[2], eventoId: "ev-palestra", titolo: "Palestra" },
      { ...PROPOSTE[2], eventoId: "ev-nulla", titolo: "Call" },
    ];

    const analisi = await analizzaEventiCalendario(proposte, OFFERTE);

    expect(fetch).not.toHaveBeenCalled();
    expect([...analisi.associazioni]).toEqual([
      ["ev-dominio", "off-acme"],
      ["ev-codice", "off-beta"],
    ]);
    expect([...analisi.nonLavorativi]).toEqual(["ev-palestra"]);
    expect(vi.mocked(console.info).mock.calls[0][0]).toMatch(
      /^Gemini: esito=ok modello=simulato-e2e eventi=5 offerte=2 durataMs=\d+ associazioniAlta=2 associazioniBassa=1 nonLavorativi=1$/
    );
  });
});
