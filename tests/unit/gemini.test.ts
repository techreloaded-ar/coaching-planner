import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { associaEventiAOfferte, type OffertaAssociabile } from "@/lib/gemini";
import type { PropostaEvento } from "@/domain/calendario-google";

const PROPOSTE: PropostaEvento[] = [
  { eventoId: "ev-acme", titolo: "Kickoff progetto con Acme", descrizione: "Sala 3", inizio: "09:00", fine: "10:00", ore: 1 },
  { eventoId: "ev-pranzo", titolo: "Pausa pranzo", descrizione: "", inizio: "13:00", fine: "14:00", ore: 1 },
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

describe("associaEventiAOfferte (US-003)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.stubEnv("E2E_TEST_MODE", "false");
    vi.stubEnv("GEMINI_API_KEY", API_KEY);
    vi.stubEnv("GEMINI_MODEL", "");
    mockFetch.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("invia a Gemini solo eventi e offerte abilitate, con la chiave nell'header (AC-1, AC-5)", async () => {
    mockFetch.mockResolvedValue(rispostaGemini([]));

    await associaEventiAOfferte(PROPOSTE, OFFERTE);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
    );
    expect(url).not.toContain(API_KEY);
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(API_KEY);

    const corpo = init.body as string;
    expect(corpo).not.toContain(API_KEY);
    const prompt = JSON.parse(corpo).contents[0].parts[0].text as string;
    expect(prompt).toContain('"offertaId":"off-acme","codice":"ACME-01","descrizione":"Coaching agile","cliente":"Acme Spa"');
    expect(prompt).toContain('"eventoId":"ev-acme","titolo":"Kickoff progetto con Acme","descrizione":"Sala 3","orario":"09:00-10:00"');
  });

  it("restituisce le associazioni indicate da Gemini (AC-2)", async () => {
    mockFetch.mockResolvedValue(
      rispostaGemini([
        { eventoId: "ev-acme", offertaId: "off-acme" },
        { eventoId: "ev-pranzo", offertaId: null },
      ])
    );

    const associazioni = await associaEventiAOfferte(PROPOSTE, OFFERTE);

    expect([...associazioni]).toEqual([["ev-acme", "off-acme"]]);
  });

  it("scarta offerte non abilitate ed eventi sconosciuti (AC-3)", async () => {
    mockFetch.mockResolvedValue(
      rispostaGemini([
        { eventoId: "ev-acme", offertaId: "off-non-abilitata" },
        { eventoId: "ev-inventato", offertaId: "off-beta" },
      ])
    );

    expect((await associaEventiAOfferte(PROPOSTE, OFFERTE)).size).toBe(0);
  });

  it("senza API key non chiama Gemini e non associa nulla (AC-4)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    expect((await associaEventiAOfferte(PROPOSTE, OFFERTE)).size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("degrada a nessuna associazione su errore HTTP, di rete o risposta malformata (AC-4)", async () => {
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    expect((await associaEventiAOfferte(PROPOSTE, OFFERTE)).size).toBe(0);

    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await associaEventiAOfferte(PROPOSTE, OFFERTE)).size).toBe(0);

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "non json" }] } }] }))
    );
    expect((await associaEventiAOfferte(PROPOSTE, OFFERTE)).size).toBe(0);

    const messaggiLoggati = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(messaggiLoggati).not.toContain(API_KEY);
  });

  it("non chiama Gemini senza proposte o senza offerte abilitate (AC-6)", async () => {
    await associaEventiAOfferte([], OFFERTE);
    await associaEventiAOfferte(PROPOSTE, []);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("usa il modello configurato in GEMINI_MODEL", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-pro");
    mockFetch.mockResolvedValue(rispostaGemini([]));

    await associaEventiAOfferte(PROPOSTE, OFFERTE);

    expect(mockFetch.mock.calls[0][0]).toContain("/models/gemini-2.5-pro:generateContent");
  });
});
