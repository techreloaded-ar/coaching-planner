import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroreAutorizzazione } from "@/lib/dal";
import { tokenMeseCorrente } from "@/domain/calendario";
import { leggiXlsx } from "../e2e/support/xlsx-lettura";

/**
 * US-018 — Contratto di `GET /report/fatturazione-clienti/esporta`.
 *
 * Il report è mockato solo al confine `@/lib/report`: writer e builder sono
 * reali, così il corpo della risposta è un vero xlsx che viene riletto. La
 * guardia reale dell'autorizzazione (`richiediRuoloApi` dentro il report) è
 * provata end-to-end in `tests/e2e/esportazione-fatturazione.spec.ts`.
 */

const { mockReportFatturazioneClientiMese } = vi.hoisted(() => ({
  mockReportFatturazioneClientiMese: vi.fn(),
}));

vi.mock("@/lib/report", () => ({
  reportFatturazioneClientiMese: mockReportFatturazioneClientiMese,
}));

import { GET } from "../../src/app/(back-office)/report/fatturazione-clienti/esporta/route";

const URL_BASE = "http://localhost/report/fatturazione-clienti/esporta";

function reportConUnCliente(token: string) {
  return {
    token,
    perCliente: [
      {
        clienteId: "c1",
        clienteRagioneSociale: "Cliente Prova",
        perOfferta: [
          {
            offertaId: "o1",
            offertaCodice: "OFF-1",
            offertaDescrizione: "Consulenza",
            tariffaGiornaliera: "500.00",
            giornateFatturabili: 1,
            imponibile: "500.00",
            perCollaboratore: [
              {
                collaboratoreId: "k1",
                collaboratoreNome: "Mario Rossi",
                oreFatturabili: 8,
                giornateFatturabili: 1,
                imponibile: "500.00",
              },
            ],
          },
        ],
        rimborsiTrasferta: "0.00",
        imponibileManodopera: "500.00",
        importoTotale: "500.00",
      },
    ],
    totali: {
      imponibileManodopera: "500.00",
      totaleRimborsi: "0.00",
      importoTotale: "500.00",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReportFatturazioneClientiMese.mockImplementation(async (token: string) =>
    reportConUnCliente(token),
  );
});

describe("GET /report/fatturazione-clienti/esporta", () => {
  it("risponde 200 con un xlsx leggibile e le intestazioni di download", async () => {
    const risposta = await GET(new NextRequest(`${URL_BASE}?mese=2026-05`));

    expect(risposta.status).toBe(200);
    expect(risposta.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(risposta.headers.get("Content-Disposition")).toContain("attachment");
    expect(risposta.headers.get("Content-Disposition")).toContain(
      "fatturazione-clienti-2026-05.xlsx",
    );
    expect(risposta.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mockReportFatturazioneClientiMese).toHaveBeenCalledWith("2026-05");

    const xlsx = leggiXlsx(Buffer.from(await risposta.arrayBuffer()));
    expect(xlsx.fogli.map((f) => f.nome)).toEqual([
      "Fatturazione clienti",
      "Dettaglio collaboratori",
    ]);
    expect(xlsx.fogli[0].righe.some((r) => r[0] === "Cliente Prova")).toBe(true);
  });

  it.each([[""], ["2026-13"], ["abc"]])(
    "usa il mese corrente per il mese %j",
    async (mese) => {
      const url = mese === "" ? URL_BASE : `${URL_BASE}?mese=${mese}`;
      const risposta = await GET(new NextRequest(url));
      const corrente = tokenMeseCorrente();

      expect(mockReportFatturazioneClientiMese).toHaveBeenCalledWith(corrente);
      expect(risposta.headers.get("Content-Disposition")).toContain(
        `fatturazione-clienti-${corrente}.xlsx`,
      );
    },
  );

  it.each([401, 403] as const)(
    "propaga l'errore di autorizzazione %i senza corpo xlsx",
    async (stato) => {
      mockReportFatturazioneClientiMese.mockRejectedValue(
        new ErroreAutorizzazione(stato, "Accesso negato"),
      );

      const risposta = await GET(new NextRequest(`${URL_BASE}?mese=2026-05`));

      expect(risposta.status).toBe(stato);
      expect(risposta.headers.get("Content-Type")).toContain("application/json");
      expect(risposta.headers.get("Content-Disposition")).toBeNull();
      expect(await risposta.json()).toEqual({ errore: "Accesso negato" });
    },
  );

  it("risponde 500 senza dettagli interni", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockReportFatturazioneClientiMese.mockRejectedValue(new Error("boom"));

    const risposta = await GET(new NextRequest(`${URL_BASE}?mese=2026-05`));
    const testo = await risposta.text();

    expect(risposta.status).toBe(500);
    expect(JSON.parse(testo)).toEqual({ errore: "Errore interno" });
    expect(testo).not.toContain("boom");
  });
});
