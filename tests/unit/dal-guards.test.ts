import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ErroreAutorizzazione,
  richiediSessioneApi,
  richiediRuoloApi,
  richiediCollaboratoreCorrente,
  risolviProfiloCollaboratoreCorrente,
  verificaAccessoDatiCollaboratore,
} from "@/lib/dal";

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

// ── Mock di next/navigation (serve per richiediRuolo nelle guardie page, ma qui siamo isolati) ─

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// ═══════════════════════════════════════════════════════════════
// Helper: cookie di sessione con payload valido
// ═══════════════════════════════════════════════════════════════

function sessioneCookie(utenteId: string, ruolo: "AMMINISTRATORE" | "COLLABORATORE") {
  return {
    utenteId,
    ruolo,
    nome: "Test User",
    email: "test@example.com",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
}

// ═══════════════════════════════════════════════════════════════
// ErroreAutorizzazione
// ═══════════════════════════════════════════════════════════════

describe("ErroreAutorizzazione", () => {
  it("ha statusCode 401 per errore di autenticazione", () => {
    const err = new ErroreAutorizzazione(401, "Non autenticato");
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe("ErroreAutorizzazione");
    expect(err.message).toBe("Non autenticato");
  });

  it("ha statusCode 403 per errore di ruolo", () => {
    const err = new ErroreAutorizzazione(403, "Accesso negato");
    expect(err.statusCode).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════
// richiediSessioneApi
// ═══════════════════════════════════════════════════════════════

describe("richiediSessioneApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lancia 401 se non c'è cookie di sessione", async () => {
    mockGetSessionCookie.mockResolvedValue(null);

    await expect(richiediSessioneApi()).rejects.toThrow(ErroreAutorizzazione);
    await expect(richiediSessioneApi()).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("lancia 401 se il cookie è presente ma l'utente non esiste a DB", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("utente-inesistente", "AMMINISTRATORE")
    );
    mockUtente.findUnique.mockResolvedValue(null);

    await expect(richiediSessioneApi()).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("restituisce la sessione se autenticato", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("admin-1", "AMMINISTRATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "admin-1",
      ruolo: "AMMINISTRATORE",
      nome: "Admin",
      email: "admin@test.local",
    });

    const sessione = await richiediSessioneApi();
    expect(sessione).toBeDefined();
    expect(sessione.utenteId).toBe("admin-1");
    expect(sessione.ruolo).toBe("AMMINISTRATORE");
  });

  it("lancia 401 se il collaboratore è stato disattivato (profilo collaboratore.attivo === false)", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("col-1", "COLLABORATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "col-1",
      ruolo: "COLLABORATORE",
      nome: "Giulia",
      email: "giulia@test.local",
      collaboratore: { attivo: false },
    });

    await expect(richiediSessioneApi()).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("restituisce la sessione se il collaboratore è attivo", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("col-1", "COLLABORATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "col-1",
      ruolo: "COLLABORATORE",
      nome: "Giulia",
      email: "giulia@test.local",
      collaboratore: { attivo: true },
    });

    const sessione = await richiediSessioneApi();
    expect(sessione.utenteId).toBe("col-1");
    expect(sessione.ruolo).toBe("COLLABORATORE");
  });

  it("restituisce la sessione per un amministratore senza profilo collaboratore (collaboratore: null)", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("admin-1", "AMMINISTRATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "admin-1",
      ruolo: "AMMINISTRATORE",
      nome: "Admin",
      email: "admin@test.local",
      collaboratore: null,
    });

    const sessione = await richiediSessioneApi();
    expect(sessione.utenteId).toBe("admin-1");
    expect(sessione.ruolo).toBe("AMMINISTRATORE");
  });

  it("mantiene la sessione amministrativa con profilo collaboratore disattivato", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("admin-1", "AMMINISTRATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "admin-1",
      ruolo: "AMMINISTRATORE",
      nome: "Admin",
      email: "admin@test.local",
      collaboratore: { attivo: false },
    });

    await expect(richiediSessioneApi()).resolves.toMatchObject({
      utenteId: "admin-1",
      ruolo: "AMMINISTRATORE",
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// richiediRuoloApi
// ═══════════════════════════════════════════════════════════════

describe("richiediRuoloApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lancia 403 se il collaboratore prova ad accedere a un'area admin", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("col-1", "COLLABORATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "col-1",
      ruolo: "COLLABORATORE",
      nome: "Giulia",
      email: "giulia@test.local",
    });

    await expect(richiediRuoloApi("AMMINISTRATORE")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("restituisce la sessione se il ruolo corrisponde", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("admin-1", "AMMINISTRATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "admin-1",
      ruolo: "AMMINISTRATORE",
      nome: "Admin",
      email: "admin@test.local",
    });

    const sessione = await richiediRuoloApi("AMMINISTRATORE");
    expect(sessione.ruolo).toBe("AMMINISTRATORE");
  });
});

// ═══════════════════════════════════════════════════════════════
// richiediCollaboratoreCorrente
// ═══════════════════════════════════════════════════════════════

describe("risolviProfiloCollaboratoreCorrente e richiediCollaboratoreCorrente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("risolve un profilo attivo associato a un amministratore", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("admin-1", "AMMINISTRATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "admin-1",
      ruolo: "AMMINISTRATORE",
      nome: "Admin",
      email: "admin@test.local",
      collaboratore: { attivo: true },
    });
    mockCollaboratore.findUnique.mockResolvedValue({ id: "collab-admin", attivo: true });

    await expect(risolviProfiloCollaboratoreCorrente()).resolves.toMatchObject({
      stato: "ATTIVO",
      collaboratore: { id: "collab-admin" },
    });
  });

  it("distingue il profilo assente", async () => {
    mockGetSessionCookie.mockResolvedValue(sessioneCookie("admin-1", "AMMINISTRATORE"));
    mockUtente.findUnique.mockResolvedValue({ id: "admin-1", ruolo: "AMMINISTRATORE" });
    mockCollaboratore.findUnique.mockResolvedValue(null);

    await expect(risolviProfiloCollaboratoreCorrente()).resolves.toEqual({ stato: "ASSENTE" });
  });

  it("distingue il profilo disattivato senza renderlo operativo", async () => {
    mockGetSessionCookie.mockResolvedValue(sessioneCookie("admin-1", "AMMINISTRATORE"));
    mockUtente.findUnique.mockResolvedValue({
      id: "admin-1",
      ruolo: "AMMINISTRATORE",
      collaboratore: { attivo: false },
    });
    mockCollaboratore.findUnique.mockResolvedValue({ id: "collab-admin", attivo: false });

    await expect(risolviProfiloCollaboratoreCorrente()).resolves.toEqual({ stato: "DISATTIVATO" });
    await expect(richiediCollaboratoreCorrente()).resolves.toBeNull();
  });

  it("restituisce il profilo collaboratore se associato all'utente", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("col-1", "COLLABORATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "col-1",
      ruolo: "COLLABORATORE",
      nome: "Giulia",
      email: "giulia@test.local",
    });
    mockCollaboratore.findUnique.mockResolvedValue({
      id: "collab-abc",
      userId: "col-1",
      nome: "Giulia",
      cognome: "Conti",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "250.00",
      attivo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const profilo = await richiediCollaboratoreCorrente();
    expect(profilo).not.toBeNull();
    expect(profilo!.id).toBe("collab-abc");
    expect(profilo!.nome).toBe("Giulia");
  });

  it("restituisce null se l'amministratore non ha un profilo collaboratore", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("admin-1", "AMMINISTRATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "admin-1",
      ruolo: "AMMINISTRATORE",
      nome: "Admin",
      email: "admin@test.local",
    });
    mockCollaboratore.findUnique.mockResolvedValue(null);

    const profilo = await richiediCollaboratoreCorrente();
    expect(profilo).toBeNull();
  });

  it("lancia 401 se non autenticato", async () => {
    mockGetSessionCookie.mockResolvedValue(null);

    await expect(richiediCollaboratoreCorrente()).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// verificaAccessoDatiCollaboratore
// ═══════════════════════════════════════════════════════════════

describe("verificaAccessoDatiCollaboratore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("amministratore può accedere ai dati di qualsiasi collaboratore", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("admin-1", "AMMINISTRATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "admin-1",
      ruolo: "AMMINISTRATORE",
      nome: "Admin",
      email: "admin@test.local",
    });

    // L'amministratore non ha bisogno di un profilo collaboratore
    const sessione = await verificaAccessoDatiCollaboratore("collab-altri");
    expect(sessione.ruolo).toBe("AMMINISTRATORE");
  });

  it("collaboratore può accedere ai propri dati", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("col-1", "COLLABORATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "col-1",
      ruolo: "COLLABORATORE",
      nome: "Giulia",
      email: "giulia@test.local",
    });
    mockCollaboratore.findUnique.mockResolvedValue({
      id: "collab-giulia",
      userId: "col-1",
    });

    const sessione = await verificaAccessoDatiCollaboratore("collab-giulia");
    expect(sessione.ruolo).toBe("COLLABORATORE");
  });

  it("collaboratore NON può accedere ai dati di un altro collaboratore → 403", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("col-1", "COLLABORATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "col-1",
      ruolo: "COLLABORATORE",
      nome: "Giulia",
      email: "giulia@test.local",
    });
    mockCollaboratore.findUnique.mockResolvedValue({
      id: "collab-giulia",
      userId: "col-1",
    });

    await expect(
      verificaAccessoDatiCollaboratore("collab-altro")
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("lancia 401 se non autenticato", async () => {
    mockGetSessionCookie.mockResolvedValue(null);

    await expect(
      verificaAccessoDatiCollaboratore("qualsiasi-id")
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("collaboratore senza profilo → 403 quando prova ad accedere a dati", async () => {
    mockGetSessionCookie.mockResolvedValue(
      sessioneCookie("col-senza-profilo", "COLLABORATORE")
    );
    mockUtente.findUnique.mockResolvedValue({
      id: "col-senza-profilo",
      ruolo: "COLLABORATORE",
      nome: "Senza",
      email: "senza@test.local",
    });
    mockCollaboratore.findUnique.mockResolvedValue(null);

    await expect(
      verificaAccessoDatiCollaboratore("collab-qualsiasi")
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
