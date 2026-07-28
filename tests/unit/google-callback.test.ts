import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCookies,
  mockCookieStore,
  mockScambiaCodice,
  mockUtente,
  mockAccount,
  mockCreateSession,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieStore: { get: vi.fn() },
  mockScambiaCodice: vi.fn(),
  mockUtente: { findUnique: vi.fn() },
  mockAccount: { upsert: vi.fn() },
  mockCreateSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/google-oauth", () => ({
  scambiaCodice: mockScambiaCodice,
}));

vi.mock("@/lib/db", () => ({
  db: {
    utente: mockUtente,
    account: mockAccount,
  },
}));

vi.mock("@/lib/session", () => ({
  createSession: mockCreateSession,
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/auth/google/callback/route";
import { HOME_AUTENTICATA } from "@/lib/policy-rotte";

const BASE_URL = "https://coaching-planner.test";

function richiestaCallback(): NextRequest {
  return new NextRequest(
    `${BASE_URL}/api/auth/google/callback?code=codice-google&state=state-valido`
  );
}

function expectRedirectErrore(response: Response): void {
  expect(response.status).toBe(307);

  const destinazione = new URL(response.headers.get("location")!);
  expect(destinazione.pathname).toBe("/");
  expect(destinazione.searchParams.get("error")).toBe("1");
}

describe("GET /api/auth/google/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCookies.mockResolvedValue(mockCookieStore);
    mockCookieStore.get.mockImplementation((nome: string) => {
      if (nome === "google_oauth_state") return { value: "state-valido" };
      if (nome === "google_oauth_code_verifier") {
        return { value: "code-verifier-valido" };
      }
      return undefined;
    });
    mockScambiaCodice.mockResolvedValue({
      accessToken: "access-token-google",
      profilo: {
        sub: "google-user-1",
        email: "utente@test.local",
        email_verified: true,
        nome: "Utente Test",
      },
    });
    mockAccount.upsert.mockResolvedValue({});
  });

  it("reindirizza l'utente invalidato all'errore generico senza creare sessione né account", async () => {
    mockUtente.findUnique.mockResolvedValue({
      id: "utente-inattivo",
      ruolo: "COLLABORATORE",
      nome: "Utente",
      cognome: "Inattivo",
      email: "utente@test.local",
      attivo: false,
      collaboratore: { attivo: true },
    });

    const response = await GET(richiestaCallback());

    expectRedirectErrore(response);
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockAccount.upsert).not.toHaveBeenCalled();
  });

  it("reindirizza l'utente non censito allo stesso errore generico senza creare sessione né account", async () => {
    mockUtente.findUnique.mockResolvedValue(null);

    const response = await GET(richiestaCallback());

    expectRedirectErrore(response);
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockAccount.upsert).not.toHaveBeenCalled();
  });

  it("crea la sessione dell'utente attivo e lo reindirizza alla home autenticata", async () => {
    mockUtente.findUnique.mockResolvedValue({
      id: "utente-attivo",
      ruolo: "AMMINISTRATORE",
      nome: "Utente",
      cognome: "Attivo",
      email: "utente@test.local",
      attivo: true,
      collaboratore: null,
    });

    const response = await GET(richiestaCallback());

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe(
      HOME_AUTENTICATA
    );
    expect(mockCreateSession).toHaveBeenCalledWith(
      "utente-attivo",
      "AMMINISTRATORE",
      "Utente Attivo",
      "utente@test.local"
    );
  });
});
