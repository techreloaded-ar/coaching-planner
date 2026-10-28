import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroreAutorizzazione } from "@/lib/dal";

/**
 * Contratto di `GET /report/fatturazione-clienti/dati`, la rotta letta dalla
 * cache client del report per il cambio mese. Report e guardia di ruolo sono
 * mockati ai rispettivi confini: la guardia reale è provata end-to-end in `tests/e2e/report-fatturazione-navigazione-mese.spec.ts`.
 */

const { mockReportFatturazioneClientiMese, mockRichiediRuoloApi } = vi.hoisted(() => ({
  mockReportFatturazioneClientiMese: vi.fn(),
  mockRichiediRuoloApi: vi.fn(),
}));

vi.mock("@/lib/dal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dal")>()),
  richiediRuoloApi: mockRichiediRuoloApi,
}));

vi.mock("@/lib/report", () => ({
  reportFatturazioneClientiMese: mockReportFatturazioneClientiMese,
}));

import { GET } from "../../src/app/(back-office)/report/fatturazione-clienti/dati/route";

const URL_BASE = "http://localhost/report/fatturazione-clienti/dati";

function reportVuoto(token: string) {
  return {
    token,
    perCliente: [],
    totali: { imponibileManodopera: "0.00", totaleTrasferteForfettarie: "0.00", importoTotale: "0.00" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRichiediRuoloApi.mockResolvedValue({ ruolo: "AMMINISTRATORE" });
  mockReportFatturazioneClientiMese.mockImplementation(async (token: string) =>
    reportVuoto(token),
  );
});

describe("GET /report/fatturazione-clienti/dati", () => {
  it("risponde 200 con il report del mese e intestazioni private", async () => {
    const risposta = await GET(new NextRequest(`${URL_BASE}?mese=2026-05`));

    expect(risposta.status).toBe(200);
    expect(risposta.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mockReportFatturazioneClientiMese).toHaveBeenCalledWith("2026-05");
    expect(await risposta.json()).toEqual(reportVuoto("2026-05"));
  });

  it.each([[""], ["2026-13"], ["abc"]])(
    "rifiuta con 400 il mese %j senza leggere il report",
    async (mese) => {
      const url = mese === "" ? URL_BASE : `${URL_BASE}?mese=${mese}`;
      const risposta = await GET(new NextRequest(url));

      expect(risposta.status).toBe(400);
      expect(mockReportFatturazioneClientiMese).not.toHaveBeenCalled();
    },
  );

  it.each([401, 403] as const)(
    "propaga l'errore di autorizzazione %i senza dati, anche con mese non valido",
    async (stato) => {
      mockRichiediRuoloApi.mockRejectedValue(
        new ErroreAutorizzazione(stato, "Accesso negato"),
      );

      for (const url of [`${URL_BASE}?mese=2026-05`, `${URL_BASE}?mese=abc`]) {
        const risposta = await GET(new NextRequest(url));

        expect(risposta.status).toBe(stato);
        expect(await risposta.json()).toEqual({ errore: "Accesso negato" });
      }
      expect(mockReportFatturazioneClientiMese).not.toHaveBeenCalled();
    },
  );

  it("risponde 500 senza dettagli su un errore interno", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockReportFatturazioneClientiMese.mockRejectedValue(new Error("db giù"));

    const risposta = await GET(new NextRequest(`${URL_BASE}?mese=2026-05`));

    expect(risposta.status).toBe(500);
    expect(await risposta.json()).toEqual({ errore: "Errore interno" });
  });
});
