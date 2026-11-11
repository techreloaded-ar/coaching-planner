import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";
import {
  richiediAlmenoUnPermessoApi,
  richiediPermesso,
  richiediPermessoApi,
  richiediSessioneApi,
} from "@/lib/dal";
import { PERMESSI } from "@/domain/permessi";

// ── Mock di Prisma ──────────────────────────────────────────────

const mockUtente = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

const mockCollaboratore = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    utente: mockUtente,
    collaboratore: mockCollaboratore,
  },
}));

// ── Mock del cookie di sessione ─────────────────────────────────

const { mockGetSessionCookie } = vi.hoisted(() => ({
  mockGetSessionCookie: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSessionCookie: mockGetSessionCookie,
  deleteSession: vi.fn(),
  DURATA_SESSIONE_ORE: 8,
}));

// ── Mock di next/navigation: redirect interrompe il flusso come in Next ─

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

// ═══════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════

type RuoloTest = "AMMINISTRATORE" | "COLLABORATORE";

function sessioneCookie(utenteId: string, ruolo: RuoloTest) {
  return {
    utenteId,
    ruolo,
    nome: "Test User",
    email: "test@example.com",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
}

function utenteDb(id: string, ruolo: RuoloTest) {
  return {
    id,
    ruolo,
    nome: "Test",
    cognome: "User",
    email: "t@test.local",
    attivo: true,
    collaboratore: null,
  };
}

function autentica(id: string, ruoloCookie: RuoloTest, ruoloDb: RuoloTest) {
  mockGetSessionCookie.mockResolvedValue(sessioneCookie(id, ruoloCookie));
  mockUtente.findUnique.mockResolvedValue(utenteDb(id, ruoloDb));
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// Permessi in sessione (AC-4)
// ═══════════════════════════════════════════════════════════════

describe("permessi in sessione", () => {
  it("seguono il ruolo a DB AMMINISTRATORE anche con cookie COLLABORATORE", async () => {
    autentica("promosso-1", "COLLABORATORE", "AMMINISTRATORE");

    const sessione = await richiediSessioneApi();

    expect(sessione.permessi).toEqual([...PERMESSI]);
  });

  it("seguono il ruolo a DB COLLABORATORE anche con cookie AMMINISTRATORE", async () => {
    autentica("declassato-1", "AMMINISTRATORE", "COLLABORATORE");

    const sessione = await richiediSessioneApi();

    expect(sessione.permessi).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// Guardia API / Server Action (AC-6)
// ═══════════════════════════════════════════════════════════════

describe("richiediPermessoApi", () => {
  it("lancia 401 senza sessione", async () => {
    mockGetSessionCookie.mockResolvedValue(null);

    await expect(richiediPermessoApi("GESTIRE_OFFERTE")).rejects.toMatchObject({
      name: "ErroreAutorizzazione",
      statusCode: 401,
    });
  });

  it("lancia 403 senza il permesso richiesto", async () => {
    autentica("api-col-1", "COLLABORATORE", "COLLABORATORE");

    await expect(richiediPermessoApi("GESTIRE_OFFERTE")).rejects.toMatchObject({
      name: "ErroreAutorizzazione",
      statusCode: 403,
    });
  });

  it("restituisce la sessione con i permessi quando il permesso c'è", async () => {
    autentica("api-admin-1", "AMMINISTRATORE", "AMMINISTRATORE");

    const sessione = await richiediPermessoApi("GESTIRE_OFFERTE");

    expect(sessione.utenteId).toBe("api-admin-1");
    expect(sessione.permessi).toContain("GESTIRE_OFFERTE");
    expect(sessione.permessi).toHaveLength(PERMESSI.length);
  });
});

describe("richiediAlmenoUnPermessoApi", () => {
  it("lancia 401 senza sessione", async () => {
    mockGetSessionCookie.mockResolvedValue(null);

    await expect(
      richiediAlmenoUnPermessoApi(["GESTIRE_CLIENTI", "GESTIRE_OFFERTE"])
    ).rejects.toMatchObject({ name: "ErroreAutorizzazione", statusCode: 401 });
  });

  it("lancia 403 se l'utente non ha nessuno dei permessi ammessi", async () => {
    autentica("almeno-col-1", "COLLABORATORE", "COLLABORATORE");

    await expect(
      richiediAlmenoUnPermessoApi(["GESTIRE_CLIENTI", "GESTIRE_OFFERTE"])
    ).rejects.toMatchObject({ name: "ErroreAutorizzazione", statusCode: 403 });
  });

  it("restituisce la sessione con i permessi quando ne ha almeno uno", async () => {
    autentica("almeno-admin-1", "AMMINISTRATORE", "AMMINISTRATORE");

    const sessione = await richiediAlmenoUnPermessoApi([
      "GESTIRE_CLIENTI",
      "GESTIRE_OFFERTE",
    ]);

    expect(sessione.utenteId).toBe("almeno-admin-1");
    expect(sessione.permessi).toHaveLength(PERMESSI.length);
  });
});

// ═══════════════════════════════════════════════════════════════
// Guardia RSC (AC-5) — ID distinti per caso, così la cache di React
// non memoizza tra un caso e l'altro
// ═══════════════════════════════════════════════════════════════

describe("richiediPermesso", () => {
  it("reindirizza alla radice senza sessione", async () => {
    mockGetSessionCookie.mockResolvedValue(null);

    await expect(richiediPermesso("GESTIRE_CLIENTI")).rejects.toThrow(/^REDIRECT:\/$/);
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("reindirizza all'area autenticata comune senza il permesso richiesto", async () => {
    autentica("rsc-col-1", "COLLABORATORE", "COLLABORATORE");

    await expect(richiediPermesso("GESTIRE_UTENTI")).rejects.toThrow(
      "REDIRECT:/attivita"
    );
    expect(redirect).toHaveBeenCalledWith("/attivita");
  });

  it("restituisce la sessione con il permesso richiesto", async () => {
    autentica("rsc-admin-1", "AMMINISTRATORE", "AMMINISTRATORE");

    const sessione = await richiediPermesso("CONSULTARE_REPORT_MARGINALITA");

    expect(sessione.utenteId).toBe("rsc-admin-1");
    expect(sessione.permessi).toContain("CONSULTARE_REPORT_MARGINALITA");
    expect(redirect).not.toHaveBeenCalled();
  });
});
