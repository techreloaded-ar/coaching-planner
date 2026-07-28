import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock di Prisma ─────────────────────────────────────────────────

const mockCollaboratore = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

const mockUtente = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

const mockRigaAttivita = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  collaboratore: mockCollaboratore,
  utente: mockUtente,
  rigaAttivita: mockRigaAttivita,
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

// ── Mock di richiediRuoloApi ───────────────────────────────────────

const { mockRichiediRuoloApi } = vi.hoisted(() => ({
  mockRichiediRuoloApi: vi.fn(),
}));

vi.mock("@/lib/dal", () => ({
  richiediRuoloApi: mockRichiediRuoloApi,
}));

// ── Mock del cookie di sessione ────────────────────────────────────

const { mockGetSessionCookie } = vi.hoisted(() => ({
  mockGetSessionCookie: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSessionCookie: mockGetSessionCookie,
  deleteSession: vi.fn(),
  DURATA_SESSIONE_ORE: 8,
}));

// ── Mock di next/cache ─────────────────────────────────────────────

const { mockRevalidatePath } = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

// ── Mock di next/navigation ────────────────────────────────────────

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

// ── Mock di valida-collaboratore ───────────────────────────────────

const { mockValidaCollaboratore, mockNormalizzaTariffaGiornaliera } = vi.hoisted(() => ({
  mockValidaCollaboratore: vi.fn(),
  mockNormalizzaTariffaGiornaliera: vi.fn(),
}));

vi.mock("@/domain/anagrafiche/valida-collaboratore", () => ({
  validaCollaboratore: mockValidaCollaboratore,
  normalizzaTariffaGiornaliera: mockNormalizzaTariffaGiornaliera,
}));

// ── Import dei moduli sotto test ───────────────────────────────────

import {
  elencaCollaboratori,
  elencaCollaboratoriSelezionabili,
  collaboratorePerId,
  storicoAttivitaCollaboratore,
} from "@/lib/collaboratori";
import { aggiornaCollaboratore } from "@/app/(back-office)/anagrafiche/collaboratori/actions";

// ═══════════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════════

function statoIniziale() {
  return { errori: {} };
}

const TARIFFA_NORMALIZZATA = {
  valore: "150.00",
  centesimi: BigInt(15000),
};

// ═══════════════════════════════════════════════════════════════════
// DAL collaboratori
// ═══════════════════════════════════════════════════════════════════

describe("DAL collaboratori", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
    mockDb.$transaction.mockImplementation((cb: (tx: typeof mockDb) => unknown) => cb(mockDb));
  });

  // ── 2. elencaCollaboratori ─────────────────────────────────────

  describe("elencaCollaboratori", () => {
    it("restituisce tutti i collaboratori (attivi e disattivati) con email utente, ordinati per cognome", async () => {
      const collaboratori = [
        {
          id: "1",
          userId: "u1",
          nome: "Mario",
          cognome: "Bianchi",
          partitaIva: "11111111111",
          tariffaGiornaliera: "100.00",
          attivo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          utente: { email: "mario.bianchi@example.com" },
        },
        {
          id: "2",
          userId: "u2",
          nome: "Luca",
          cognome: "Rossi",
          partitaIva: "22222222222",
          tariffaGiornaliera: "150.00",
          attivo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          utente: { email: "luca.rossi@example.com" },
        },
      ];
      mockCollaboratore.findMany.mockResolvedValue(collaboratori);

      const result = await elencaCollaboratori();

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCollaboratore.findMany).toHaveBeenCalledWith({
        orderBy: { cognome: "asc" },
        include: { utente: { select: { email: true } } },
      });
      expect(result).toEqual(collaboratori);
      expect(result).toHaveLength(2);
    });
  });

  // ── 3. elencaCollaboratoriSelezionabili ───────────────────────

  describe("elencaCollaboratoriSelezionabili", () => {
    it("restituisce solo i collaboratori attivi, ordinati per cognome", async () => {
      const collaboratoriAttivi = [
        {
          id: "1",
          userId: "u1",
          nome: "Mario",
          cognome: "Bianchi",
          partitaIva: "11111111111",
          tariffaGiornaliera: "100.00",
          attivo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "3",
          userId: "u3",
          nome: "Anna",
          cognome: "Verdi",
          partitaIva: "33333333333",
          tariffaGiornaliera: "120.00",
          attivo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockCollaboratore.findMany.mockResolvedValue(collaboratoriAttivi);

      const result = await elencaCollaboratoriSelezionabili();

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCollaboratore.findMany).toHaveBeenCalledWith({
        where: { attivo: true },
        orderBy: { cognome: "asc" },
      });
      expect(result).toEqual(collaboratoriAttivi);
      expect(result).toHaveLength(2);
      for (const c of result) {
        expect(c.attivo).toBe(true);
      }
    });
  });

  // ── 4. collaboratorePerId ──────────────────────────────────────

  describe("collaboratorePerId", () => {
    it("restituisce un collaboratore per ID con email utente", async () => {
      const collaboratore = {
        id: "collab-1",
        userId: "u1",
        nome: "Mario",
        cognome: "Bianchi",
        partitaIva: "11111111111",
        tariffaGiornaliera: "100.00",
        attivo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        utente: { email: "mario.bianchi@example.com" },
      };
      mockCollaboratore.findUnique.mockResolvedValue(collaboratore);

      const result = await collaboratorePerId("collab-1");

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCollaboratore.findUnique).toHaveBeenCalledWith({
        where: { id: "collab-1" },
        include: { utente: { select: { email: true } } },
      });
      expect(result).toEqual(collaboratore);
      expect(result?.cognome).toBe("Bianchi");
    });

    it("restituisce null quando il collaboratore non esiste", async () => {
      mockCollaboratore.findUnique.mockResolvedValue(null);

      const result = await collaboratorePerId("inesistente");

      expect(mockCollaboratore.findUnique).toHaveBeenCalledWith({
        where: { id: "inesistente" },
        include: { utente: { select: { email: true } } },
      });
      expect(result).toBeNull();
    });
  });

  // ── 10. storicoAttivitaCollaboratore ────────────────────────────

  describe("storicoAttivitaCollaboratore", () => {
    it("restituisce tutte le righe attività del collaboratore con cliente e offerta, ordinate per data", async () => {
      const righe = [
        {
          id: "riga-1",
          collaboratoreId: "collab-1",
          data: new Date("2026-03-10"),
          ore: 8,
          fatturabile: true,
          nota: "Sviluppo feature",
          offerta: { codice: "OFF-1", descrizione: "Sviluppo" },
          cliente: { ragioneSociale: "Acme S.r.l." },
        },
        {
          id: "riga-2",
          collaboratoreId: "collab-1",
          data: new Date("2026-04-05"),
          ore: 4,
          fatturabile: false,
          nota: null,
          offerta: { codice: "OFF-1", descrizione: "Sviluppo" },
          cliente: { ragioneSociale: "Acme S.r.l." },
        },
      ];
      mockRigaAttivita.findMany.mockResolvedValue(righe);

      const result = await storicoAttivitaCollaboratore("collab-1");

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockRigaAttivita.findMany).toHaveBeenCalledWith({
        where: { collaboratoreId: "collab-1" },
        include: { offerta: true, cliente: true },
        orderBy: [{ data: "asc" }, { createdAt: "asc" }],
      });
      expect(result).toEqual(righe);
    });

    it("propaga l'errore di richiediRuoloApi senza toccare il database", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(storicoAttivitaCollaboratore("collab-1")).rejects.toThrow(
        "Accesso negato",
      );
      expect(mockRigaAttivita.findMany).not.toHaveBeenCalled();
    });
  });

  // ── 1. Guardie di ruolo DAL ────────────────────────────────────

  describe("guardie di ruolo — DAL", () => {
    it("elencaCollaboratori propaga l'errore di richiediRuoloApi", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(elencaCollaboratori()).rejects.toThrow("Accesso negato");
      expect(mockCollaboratore.findMany).not.toHaveBeenCalled();
    });

    it("elencaCollaboratoriSelezionabili propaga l'errore di richiediRuoloApi", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(elencaCollaboratoriSelezionabili()).rejects.toThrow("Accesso negato");
      expect(mockCollaboratore.findMany).not.toHaveBeenCalled();
    });

    it("collaboratorePerId propaga l'errore di richiediRuoloApi", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(collaboratorePerId("collab-1")).rejects.toThrow("Accesso negato");
      expect(mockCollaboratore.findUnique).not.toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Server Actions collaboratori
// ═══════════════════════════════════════════════════════════════════

describe("Server Actions collaboratori", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
    mockDb.$transaction.mockImplementation((cb: (tx: typeof mockDb) => unknown) => cb(mockDb));
  });

  // ── 8. aggiornaCollaboratore ────────────────────────────────────

  describe("aggiornaCollaboratore", () => {
    it("con dati validi aggiorna Collaboratore e Utente in transazione, poi redirige", async () => {
      mockValidaCollaboratore.mockReturnValue({});
      mockNormalizzaTariffaGiornaliera.mockReturnValue(TARIFFA_NORMALIZZATA);
      mockCollaboratore.findUnique.mockResolvedValue({ userId: "utente-1" });

      const formData = new FormData();
      formData.set("id", "collab-1");
      formData.set("nome", "Mario");
      formData.set("cognome", "Bianchi");
      formData.set("partitaIva", "11111111111");
      formData.set("tariffaGiornaliera", "150");

      await aggiornaCollaboratore(statoIniziale(), formData);

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCollaboratore.findUnique).toHaveBeenCalledWith({
        where: { id: "collab-1" },
        select: { userId: true },
      });
      expect(mockDb.$transaction).toHaveBeenCalled();
      expect(mockCollaboratore.update).toHaveBeenCalledWith({
        where: { id: "collab-1" },
        data: {
          nome: "Mario",
          cognome: "Bianchi",
          partitaIva: "11111111111",
          tariffaGiornaliera: TARIFFA_NORMALIZZATA.valore,
        },
      });
      expect(mockUtente.update).toHaveBeenCalledWith({
        where: { id: "utente-1" },
        data: { nome: "Mario Bianchi" },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/collaboratori");
      expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/collaboratori?esito=salvato");
    });

    it("ignora un'email eventualmente presente nel FormData: utente.update riceve solo il nome", async () => {
      mockValidaCollaboratore.mockReturnValue({});
      mockNormalizzaTariffaGiornaliera.mockReturnValue(TARIFFA_NORMALIZZATA);
      mockCollaboratore.findUnique.mockResolvedValue({ userId: "utente-1" });

      const formData = new FormData();
      formData.set("id", "collab-1");
      formData.set("nome", "Mario");
      formData.set("cognome", "Bianchi");
      formData.set("email", "mario.bianchi@example.com");
      formData.set("partitaIva", "11111111111");
      formData.set("tariffaGiornaliera", "150");

      await aggiornaCollaboratore(statoIniziale(), formData);

      expect(mockUtente.update).toHaveBeenCalledWith({
        where: { id: "utente-1" },
        data: { nome: "Mario Bianchi" },
      });
      const datiUtenteAggiornati = mockUtente.update.mock.calls[0][0].data;
      expect(datiUtenteAggiornati).not.toHaveProperty("email");
    });

    it("restituisce errore se il collaboratore non esiste", async () => {
      mockValidaCollaboratore.mockReturnValue({});
      mockNormalizzaTariffaGiornaliera.mockReturnValue(TARIFFA_NORMALIZZATA);
      mockCollaboratore.findUnique.mockResolvedValue(null);

      const formData = new FormData();
      formData.set("id", "collab-inesistente");
      formData.set("nome", "Mario");
      formData.set("cognome", "Bianchi");
      formData.set("partitaIva", "11111111111");
      formData.set("tariffaGiornaliera", "150");

      const result = await aggiornaCollaboratore(statoIniziale(), formData);

      expect(result.errori).toEqual({ _form: "Collaboratore non trovato" });
      expect(mockDb.$transaction).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  // ── 1. Guardie di ruolo Server Actions ───────────────────────────

  describe("guardie di ruolo — Server Actions", () => {
    it("aggiornaCollaboratore propaga l'errore di richiediRuoloApi", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      const formData = new FormData();
      formData.set("id", "collab-1");

      await expect(
        aggiornaCollaboratore(statoIniziale(), formData)
      ).rejects.toThrow("Accesso negato");
      expect(mockCollaboratore.findUnique).not.toHaveBeenCalled();
    });
  });
});
