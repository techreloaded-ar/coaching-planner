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

const mockTariffaCollaboratore = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  collaboratore: mockCollaboratore,
  utente: mockUtente,
  tariffaCollaboratore: mockTariffaCollaboratore,
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

// ── Mock di richiediPermessoApi ────────────────────────────────────

const { mockRichiediPermessoApi } = vi.hoisted(() => ({
  mockRichiediPermessoApi: vi.fn(),
}));

vi.mock("@/lib/dal", () => ({
  richiediPermessoApi: mockRichiediPermessoApi,
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

const { mockValidaCollaboratore } = vi.hoisted(() => ({
  mockValidaCollaboratore: vi.fn(),
}));

vi.mock("@/domain/anagrafiche/valida-collaboratore", () => ({
  validaCollaboratore: mockValidaCollaboratore,
}));

// ── Import dei moduli sotto test ───────────────────────────────────

import {
  elencaCollaboratori,
  elencaCollaboratoriSelezionabili,
  collaboratorePerId,
  storicoTariffeCollaboratore,
} from "@/lib/collaboratori";
import { aggiornaCollaboratore } from "@/app/(back-office)/anagrafiche/collaboratori/actions";

// ═══════════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════════

function statoIniziale() {
  return { errori: {} };
}

// ═══════════════════════════════════════════════════════════════════
// DAL collaboratori
// ═══════════════════════════════════════════════════════════════════

describe("DAL collaboratori", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediPermessoApi.mockResolvedValue(undefined);
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
          attivo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          utente: { email: "mario.bianchi@example.com" },
          // Simula il Decimal Prisma con un oggetto dotato di toString()
          tariffe: [
            { validaDalMese: "2026-01", modalita: "GIORNALIERA", importo: { toFixed: () => "450.00" } },
            { validaDalMese: "2026-07", modalita: "FISSO_MENSILE", importo: { toFixed: () => "6500.00" } },
          ],
        },
        {
          id: "2",
          userId: "u2",
          nome: "Luca",
          cognome: "Rossi",
          partitaIva: "22222222222",
          attivo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          utente: { email: "luca.rossi@example.com" },
          tariffe: [],
        },
      ];
      mockCollaboratore.findMany.mockResolvedValue(collaboratori);

      const result = await elencaCollaboratori();

      expect(mockRichiediPermessoApi).toHaveBeenCalledWith("GESTIRE_COLLABORATORI");
      expect(mockCollaboratore.findMany).toHaveBeenCalledWith({
        orderBy: { cognome: "asc" },
        include: {
          utente: { select: { email: true } },
          tariffe: { select: { validaDalMese: true, validaAlMese: true, modalita: true, importo: true } },
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: "1", utente: { email: "mario.bianchi@example.com" } });
      expect(result[0].tariffe).toEqual([
        { validaDalMese: "2026-01", modalita: "GIORNALIERA", importo: "450.00" },
        { validaDalMese: "2026-07", modalita: "FISSO_MENSILE", importo: "6500.00" },
      ]);
      expect(result[1].tariffe).toEqual([]);
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
          attivo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockCollaboratore.findMany.mockResolvedValue(collaboratoriAttivi);

      const result = await elencaCollaboratoriSelezionabili();

      expect(mockRichiediPermessoApi).toHaveBeenCalledWith("GESTIRE_COLLABORATORI");
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
        attivo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        utente: { email: "mario.bianchi@example.com" },
      };
      mockCollaboratore.findUnique.mockResolvedValue(collaboratore);

      const result = await collaboratorePerId("collab-1");

      expect(mockRichiediPermessoApi).toHaveBeenCalledWith("GESTIRE_COLLABORATORI");
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

  // ── storicoTariffeCollaboratore ────────────────────────────────

  describe("storicoTariffeCollaboratore", () => {
    it("restituisce lo storico tariffe dalla più recente con importi come stringhe", async () => {
      mockTariffaCollaboratore.findMany.mockResolvedValue([
        { id: "t2", validaDalMese: "2026-07", modalita: "FISSO_MENSILE", importo: { toFixed: () => "6500.00" } },
        { id: "t1", validaDalMese: "2026-01", modalita: "GIORNALIERA", importo: { toFixed: () => "450.00" } },
      ]);

      const result = await storicoTariffeCollaboratore("collab-1");

      expect(mockRichiediPermessoApi).toHaveBeenCalledWith("GESTIRE_COLLABORATORI");
      expect(mockTariffaCollaboratore.findMany).toHaveBeenCalledWith({
        where: { collaboratoreId: "collab-1" },
        orderBy: { validaDalMese: "desc" },
        select: { id: true, validaDalMese: true, validaAlMese: true, modalita: true, importo: true },
      });
      expect(result).toEqual([
        { id: "t2", validaDalMese: "2026-07", modalita: "FISSO_MENSILE", importo: "6500.00" },
        { id: "t1", validaDalMese: "2026-01", modalita: "GIORNALIERA", importo: "450.00" },
      ]);
    });

    it("propaga l'errore di richiediPermessoApi senza toccare il database", async () => {
      mockRichiediPermessoApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(storicoTariffeCollaboratore("collab-1")).rejects.toThrow("Accesso negato");
      expect(mockTariffaCollaboratore.findMany).not.toHaveBeenCalled();
    });
  });

  // ── 1. Guardie di ruolo DAL ────────────────────────────────────

  describe("guardie di permesso — DAL", () => {
    it("elencaCollaboratori propaga l'errore di richiediPermessoApi", async () => {
      mockRichiediPermessoApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(elencaCollaboratori()).rejects.toThrow("Accesso negato");
      expect(mockCollaboratore.findMany).not.toHaveBeenCalled();
    });

    it("elencaCollaboratoriSelezionabili propaga l'errore di richiediPermessoApi", async () => {
      mockRichiediPermessoApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(elencaCollaboratoriSelezionabili()).rejects.toThrow("Accesso negato");
      expect(mockCollaboratore.findMany).not.toHaveBeenCalled();
    });

    it("collaboratorePerId propaga l'errore di richiediPermessoApi", async () => {
      mockRichiediPermessoApi.mockRejectedValue(new Error("Accesso negato"));

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
    mockRichiediPermessoApi.mockResolvedValue(undefined);
    mockDb.$transaction.mockImplementation((cb: (tx: typeof mockDb) => unknown) => cb(mockDb));
  });

  // ── 8. aggiornaCollaboratore ────────────────────────────────────

  describe("aggiornaCollaboratore", () => {
    it("con dati validi aggiorna Collaboratore e Utente in transazione, poi redirige", async () => {
      mockValidaCollaboratore.mockReturnValue({});
      mockCollaboratore.findUnique.mockResolvedValue({ userId: "utente-1" });

      const formData = new FormData();
      formData.set("id", "collab-1");
      formData.set("nome", "Mario");
      formData.set("cognome", "Bianchi");
      formData.set("partitaIva", "11111111111");
      // Un campo tariffa residuo nel form viene ignorato: la tariffa vive nello storico.
      formData.set("tariffaGiornaliera", "150");

      await aggiornaCollaboratore(statoIniziale(), formData);

      expect(mockRichiediPermessoApi).toHaveBeenCalledWith("GESTIRE_COLLABORATORI");
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
        },
      });
      expect(mockUtente.update).toHaveBeenCalledWith({
        where: { id: "utente-1" },
        data: { nome: "Mario", cognome: "Bianchi" },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/collaboratori");
      expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/collaboratori?esito=salvato");
    });

    it("ignora un'email eventualmente presente nel FormData: utente.update riceve solo nome e cognome", async () => {
      mockValidaCollaboratore.mockReturnValue({});
      mockCollaboratore.findUnique.mockResolvedValue({ userId: "utente-1" });

      const formData = new FormData();
      formData.set("id", "collab-1");
      formData.set("nome", "Mario");
      formData.set("cognome", "Bianchi");
      formData.set("email", "mario.bianchi@example.com");
      formData.set("partitaIva", "11111111111");

      await aggiornaCollaboratore(statoIniziale(), formData);

      expect(mockUtente.update).toHaveBeenCalledWith({
        where: { id: "utente-1" },
        data: { nome: "Mario", cognome: "Bianchi" },
      });
      const datiUtenteAggiornati = mockUtente.update.mock.calls[0][0].data;
      expect(datiUtenteAggiornati).not.toHaveProperty("email");
    });

    it("restituisce errore se il collaboratore non esiste", async () => {
      mockValidaCollaboratore.mockReturnValue({});
      mockCollaboratore.findUnique.mockResolvedValue(null);

      const formData = new FormData();
      formData.set("id", "collab-inesistente");
      formData.set("nome", "Mario");
      formData.set("cognome", "Bianchi");
      formData.set("partitaIva", "11111111111");

      const result = await aggiornaCollaboratore(statoIniziale(), formData);

      expect(result.errori).toEqual({ _form: "Collaboratore non trovato" });
      expect(mockDb.$transaction).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  // ── 1. Guardie di ruolo Server Actions ───────────────────────────

  describe("guardie di permesso — Server Actions", () => {
    it("aggiornaCollaboratore propaga l'errore di richiediPermessoApi", async () => {
      mockRichiediPermessoApi.mockRejectedValue(new Error("Accesso negato"));

      const formData = new FormData();
      formData.set("id", "collab-1");

      await expect(
        aggiornaCollaboratore(statoIniziale(), formData)
      ).rejects.toThrow("Accesso negato");
      expect(mockCollaboratore.findUnique).not.toHaveBeenCalled();
    });
  });
});
