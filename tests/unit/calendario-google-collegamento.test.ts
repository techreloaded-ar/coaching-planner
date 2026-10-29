import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockProfilo, mockSessione, mockScambia, mockCollegamento, mockGestito, mockCollaboratoreCorrente, mockRevalidate } =
  vi.hoisted(() => ({
    mockProfilo: vi.fn(),
    mockSessione: vi.fn(),
    mockScambia: vi.fn(),
    mockCollegamento: { upsert: vi.fn(), deleteMany: vi.fn() },
    mockGestito: { createMany: vi.fn() },
    mockCollaboratoreCorrente: vi.fn(),
    mockRevalidate: vi.fn(),
  }));

vi.mock("@/lib/dal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dal")>();
  return {
    ...actual,
    risolviProfiloCollaboratoreCorrente: mockProfilo,
    richiediSessioneApi: mockSessione,
    richiediCollaboratoreCorrente: mockCollaboratoreCorrente,
  };
});
vi.mock("@/lib/db", () => ({
  db: { collegamentoCalendarioGoogle: mockCollegamento, eventoCalendarioGestito: mockGestito },
}));
vi.mock("@/lib/calendario-google", () => ({
  scambiaCodiceCalendario: mockScambia,
  urlConsensoCalendario: (state: string) => `https://accounts.google.test/consenso?state=${state}`,
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidate }));

import { NextRequest } from "next/server";
import { ErroreAutorizzazione } from "@/lib/dal";
import { GET as collega } from "@/app/api/calendario-google/collega/route";
import { GET as callback } from "@/app/api/calendario-google/callback/route";
import { rifiutaPropostaCalendario, scollegaCalendarioGoogle } from "@/lib/actions/calendario-google";
import { decifraToken } from "@/lib/cifratura-token";

const BASE = "http://localhost:3000";
const COLLABORATORE = { id: "collab-1" };

function richiestaCallback(query: string, cookie = "calendario_oauth_state=state-ok; calendario_oauth_code_verifier=verifier-ok") {
  return new NextRequest(`${BASE}/api/calendario-google/callback?${query}`, {
    headers: { cookie },
  });
}

function esito(response: Response): string | null {
  expect(response.status).toBe(307);
  const destinazione = new URL(response.headers.get("location")!);
  // Il ritorno dal consenso porta sempre alle Impostazioni, dove vive il connettore.
  expect(destinazione.pathname).toBe("/impostazioni/connettori");
  return destinazione.searchParams.get("calendario");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SESSION_SECRET", "segreto-di-test-lungo-almeno-trentadue-caratteri");
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockSessione.mockResolvedValue({ utenteId: "u-1", email: "collab@test.local" });
  mockProfilo.mockResolvedValue({ stato: "ATTIVO", collaboratore: COLLABORATORE });
  mockCollaboratoreCorrente.mockResolvedValue(COLLABORATORE);
  mockScambia.mockResolvedValue({
    refreshToken: "refresh-token-google",
    emailAutorizzata: "collab@test.local",
  });
});

describe("GET /api/calendario-google/collega (US-001)", () => {
  it("reindirizza al consenso e salva state e code verifier in cookie limitati (AC-2)", async () => {
    const response = await collega();

    expect(response.status).toBe(307);
    const state = new URL(response.headers.get("location")!).searchParams.get("state");
    const cookie = response.cookies.get("calendario_oauth_state")!;
    expect(cookie.value).toBe(state);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe("/api/calendario-google");
    expect(response.cookies.get("calendario_oauth_code_verifier")?.value).toBeTruthy();
  });

  it("rifiuta con 403 un utente senza profilo collaboratore attivo (AC-6)", async () => {
    mockProfilo.mockResolvedValue({ stato: "ASSENTE" });
    expect((await collega()).status).toBe(403);
  });

  it("rifiuta con 401 senza sessione (AC-6)", async () => {
    mockSessione.mockRejectedValue(new ErroreAutorizzazione(401, "Non autenticato"));
    expect((await collega()).status).toBe(401);
  });
});

describe("GET /api/calendario-google/callback (US-001)", () => {
  it("salva il token cifrato sul collaboratore della sessione (AC-2, AC-4)", async () => {
    const response = await callback(richiestaCallback("code=codice&state=state-ok"));

    expect(esito(response)).toBe("collegato");
    expect(mockScambia).toHaveBeenCalledWith("codice", "verifier-ok");
    const { where, create, update } = mockCollegamento.upsert.mock.calls[0][0];
    expect(where).toEqual({ collaboratoreId: "collab-1" });
    expect(create.refreshTokenCifrato).not.toContain("refresh-token-google");
    expect(decifraToken(create.refreshTokenCifrato)).toBe("refresh-token-google");
    expect(update.refreshTokenCifrato).toBe(create.refreshTokenCifrato);
    expect(response.cookies.get("calendario_oauth_state")?.value).toBe("");
  });

  it.each([
    ["consenso negato", "error=access_denied&state=state-ok", undefined],
    ["state errato", "code=codice&state=state-altro", undefined],
    ["state assente", "code=codice", undefined],
    ["cookie assenti", "code=codice&state=state-ok", ""],
  ])("con %s torna non collegato senza salvare nulla (AC-3)", async (_caso, query, cookie) => {
    const response = await callback(richiestaCallback(query, cookie));

    expect(esito(response)).toBe("negato");
    expect(mockCollegamento.upsert).not.toHaveBeenCalled();
  });

  it("non salva nulla se Google non rilascia il token (AC-3)", async () => {
    mockScambia.mockResolvedValue(null);

    expect(esito(await callback(richiestaCallback("code=codice&state=state-ok")))).toBe("negato");
    expect(mockCollegamento.upsert).not.toHaveBeenCalled();
  });

  it("collega se l'account autorizzato differisce solo per maiuscole (US-003 AC-2/AC-4)", async () => {
    mockScambia.mockResolvedValue({
      refreshToken: "refresh-token-google",
      emailAutorizzata: "Collab@Test.Local",
    });

    expect(esito(await callback(richiestaCallback("code=codice&state=state-ok")))).toBe("collegato");
    expect(mockCollegamento.upsert).toHaveBeenCalledOnce();
  });

  it("con un account Google diverso non salva nulla e torna con l'esito dedicato (US-003 AC-3)", async () => {
    mockScambia.mockResolvedValue({
      refreshToken: "refresh-token-personale",
      emailAutorizzata: "personale@gmail.com",
    });

    const response = await callback(richiestaCallback("code=codice&state=state-ok"));

    expect(esito(response)).toBe("account-diverso");
    expect(response.headers.get("location")).not.toContain("personale");
    expect(mockCollegamento.upsert).not.toHaveBeenCalled();
    expect(response.cookies.get("calendario_oauth_state")?.value).toBe("");
  });

  it("non collega il calendario a un profilo non operativo (AC-6)", async () => {
    mockProfilo.mockResolvedValue({ stato: "DISATTIVATO" });

    expect(esito(await callback(richiestaCallback("code=codice&state=state-ok")))).toBe("negato");
    expect(mockScambia).not.toHaveBeenCalled();
  });
});

describe("azioni del calendario", () => {
  it("scollega rimuovendo il solo token del collaboratore corrente (US-001 AC-5)", async () => {
    await scollegaCalendarioGoogle();

    expect(mockCollegamento.deleteMany).toHaveBeenCalledWith({
      where: { collaboratoreId: "collab-1" },
    });
    expect(mockRevalidate).toHaveBeenCalledWith("/impostazioni/connettori");
    expect(mockRevalidate).toHaveBeenCalledWith("/attivita");
  });

  it("senza profilo operativo scollega e rifiuta nulla", async () => {
    mockCollaboratoreCorrente.mockResolvedValue(null);

    await scollegaCalendarioGoogle();
    expect(await rifiutaPropostaCalendario("ev-1")).toEqual({
      success: false,
      error: "Profilo collaboratore non operativo",
    });
    expect(mockCollegamento.deleteMany).not.toHaveBeenCalled();
    expect(mockGestito.createMany).not.toHaveBeenCalled();
  });

  it("rifiuta una proposta registrando l'evento come gestito dal collaboratore corrente (US-004 AC-4, AC-8)", async () => {
    expect(await rifiutaPropostaCalendario("ev-1")).toEqual({ success: true });

    expect(mockGestito.createMany).toHaveBeenCalledWith({
      data: [{ collaboratoreId: "collab-1", eventoCalendarioId: "ev-1" }],
      skipDuplicates: true,
    });
  });
});
