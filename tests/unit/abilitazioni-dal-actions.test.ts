import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock di Prisma ─────────────────────────────────────────────────

const mockAbilitazioneOfferta = vi.hoisted(() => ({
  findMany: vi.fn(),
  createMany: vi.fn(),
  deleteMany: vi.fn(),
}));

const mockOfferta = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  abilitazioneOfferta: mockAbilitazioneOfferta,
  offerta: mockOfferta,
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

// ── Import dei moduli sotto test ───────────────────────────────────

import {
  elencaOfferteAbilitate,
  elencaOfferteAbilitabili,
} from "@/lib/abilitazioni";
import {
  abilitaCollaboratoreSuOfferte,
  revocaAbilitazioneCollaboratore,
} from "@/app/(back-office)/anagrafiche/collaboratori/[id]/abilitazioni-actions";

// ═══════════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════════

/**
 * Replica minimale dell'errore lanciato dalle guardie API: il modulo reale
 * `@/lib/dal` è mockato, quindi la classe non è importabile da lì.
 */
class ErroreAutorizzazione extends Error {
  readonly statusCode: 401 | 403;

  constructor(statusCode: 401 | 403, message: string) {
    super(message);
    this.name = "ErroreAutorizzazione";
    this.statusCode = statusCode;
  }
}

function statoIniziale() {
  return { errori: {} };
}

// ═══════════════════════════════════════════════════════════════════
// DAL abilitazioni — query
// ═══════════════════════════════════════════════════════════════════

describe("DAL abilitazioni — query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
  });

  // ── 2. elencaOfferteAbilitate ──────────────────────────────────

  describe("elencaOfferteAbilitate", () => {
    it("interroga con where, include e orderBy attesi e mappa le abilitazioni", async () => {
      const abilitazioni = [
        {
          collaboratoreId: "collab-1",
          offertaId: "off-1",
          offerta: {
            id: "off-1",
            codice: "OFF-1",
            descrizione: "Sviluppo",
            attiva: true,
            cliente: { ragioneSociale: "Acme S.r.l." },
          },
        },
        {
          collaboratoreId: "collab-1",
          offertaId: "off-2",
          offerta: {
            id: "off-2",
            codice: "OFF-2",
            descrizione: "Manutenzione",
            attiva: false,
            cliente: { ragioneSociale: "Beta S.p.A." },
          },
        },
      ];
      mockAbilitazioneOfferta.findMany.mockResolvedValue(abilitazioni);

      const result = await elencaOfferteAbilitate("collab-1");

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockAbilitazioneOfferta.findMany).toHaveBeenCalledWith({
        where: { collaboratoreId: "collab-1" },
        include: {
          offerta: {
            include: { cliente: { select: { ragioneSociale: true } } },
          },
        },
        orderBy: [
          { offerta: { cliente: { ragioneSociale: "asc" } } },
          { offerta: { codice: "asc" } },
        ],
      });
      expect(result).toEqual([
        {
          offertaId: "off-1",
          codice: "OFF-1",
          descrizione: "Sviluppo",
          clienteRagioneSociale: "Acme S.r.l.",
          offertaAttiva: true,
        },
        {
          offertaId: "off-2",
          codice: "OFF-2",
          descrizione: "Manutenzione",
          clienteRagioneSociale: "Beta S.p.A.",
          offertaAttiva: false,
        },
      ]);
    });
  });

  // ── 3. elencaOfferteAbilitabili ────────────────────────────────

  describe("elencaOfferteAbilitabili", () => {
    it("filtra le offerte attive non ancora abilitate per il collaboratore", async () => {
      const offerte = [
        {
          id: "off-3",
          codice: "OFF-3",
          descrizione: "Consulenza",
          cliente: { ragioneSociale: "Gamma S.r.l." },
        },
      ];
      mockOfferta.findMany.mockResolvedValue(offerte);

      const result = await elencaOfferteAbilitabili("collab-1");

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockOfferta.findMany).toHaveBeenCalledWith({
        where: {
          attiva: true,
          abilitazioniCollaboratori: { none: { collaboratoreId: "collab-1" } },
        },
        include: { cliente: { select: { ragioneSociale: true } } },
        orderBy: [{ cliente: { ragioneSociale: "asc" } }, { codice: "asc" }],
      });
      expect(result).toEqual([
        {
          offertaId: "off-3",
          codice: "OFF-3",
          descrizione: "Consulenza",
          clienteRagioneSociale: "Gamma S.r.l.",
        },
      ]);
    });
  });

  // ── 4. Guardie di ruolo — query ────────────────────────────────

  describe("guardie di ruolo — query", () => {
    it("elencaOfferteAbilitate rigetta e non interroga il DB se il ruolo è negato", async () => {
      mockRichiediRuoloApi.mockRejectedValue(
        new ErroreAutorizzazione(403, "Ruolo richiesto: AMMINISTRATORE"),
      );

      await expect(elencaOfferteAbilitate("collab-1")).rejects.toThrow(
        ErroreAutorizzazione,
      );
      expect(mockAbilitazioneOfferta.findMany).not.toHaveBeenCalled();
    });

    it("elencaOfferteAbilitabili rigetta e non interroga il DB se il ruolo è negato", async () => {
      mockRichiediRuoloApi.mockRejectedValue(
        new ErroreAutorizzazione(403, "Ruolo richiesto: AMMINISTRATORE"),
      );

      await expect(elencaOfferteAbilitabili("collab-1")).rejects.toThrow(
        ErroreAutorizzazione,
      );
      expect(mockOfferta.findMany).not.toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Server Actions abilitazioni
// ═══════════════════════════════════════════════════════════════════

describe("Server Actions abilitazioni", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
  });

  // ── 5-7. abilitaCollaboratoreSuOfferte ─────────────────────────

  describe("abilitaCollaboratoreSuOfferte", () => {
    it("con due offerte attive crea le coppie con skipDuplicates e conferma", async () => {
      mockOfferta.findMany.mockResolvedValue([{ id: "off-1" }, { id: "off-2" }]);
      mockAbilitazioneOfferta.createMany.mockResolvedValue({ count: 2 });

      const formData = new FormData();
      formData.set("collaboratoreId", "collab-1");
      formData.append("offertaId", "off-1");
      formData.append("offertaId", "off-2");

      const result = await abilitaCollaboratoreSuOfferte(statoIniziale(), formData);

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockOfferta.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["off-1", "off-2"] }, attiva: true },
        select: { id: true },
      });
      expect(mockAbilitazioneOfferta.createMany).toHaveBeenCalledWith({
        data: [
          { collaboratoreId: "collab-1", offertaId: "off-1" },
          { collaboratoreId: "collab-1", offertaId: "off-2" },
        ],
        skipDuplicates: true,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        "/anagrafiche/collaboratori/collab-1",
      );
      expect(result).toEqual({ errori: {}, successo: true });
    });

    it("con selezione vuota non scrive e valorizza errori._form", async () => {
      const formData = new FormData();
      formData.set("collaboratoreId", "collab-1");

      const result = await abilitaCollaboratoreSuOfferte(statoIniziale(), formData);

      expect(mockOfferta.findMany).not.toHaveBeenCalled();
      expect(mockAbilitazioneOfferta.createMany).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(result.errori._form).toBeTruthy();
      expect(result.successo).toBeUndefined();
    });

    it("se un'offerta non è disponibile non scrive e valorizza errori._form", async () => {
      // Richieste due offerte, ma solo una risulta attiva/esistente.
      mockOfferta.findMany.mockResolvedValue([{ id: "off-1" }]);

      const formData = new FormData();
      formData.set("collaboratoreId", "collab-1");
      formData.append("offertaId", "off-1");
      formData.append("offertaId", "off-inesistente");

      const result = await abilitaCollaboratoreSuOfferte(statoIniziale(), formData);

      expect(mockAbilitazioneOfferta.createMany).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(result.errori._form).toBeTruthy();
      expect(result.successo).toBeUndefined();
    });
  });

  // ── 8. revocaAbilitazioneCollaboratore ─────────────────────────

  describe("revocaAbilitazioneCollaboratore", () => {
    it("elimina la sola coppia bersaglio e conferma", async () => {
      mockAbilitazioneOfferta.deleteMany.mockResolvedValue({ count: 1 });

      const formData = new FormData();
      formData.set("collaboratoreId", "collab-1");
      formData.set("offertaId", "off-1");

      const result = await revocaAbilitazioneCollaboratore(statoIniziale(), formData);

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockAbilitazioneOfferta.deleteMany).toHaveBeenCalledWith({
        where: { collaboratoreId: "collab-1", offertaId: "off-1" },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        "/anagrafiche/collaboratori/collab-1",
      );
      expect(result).toEqual({ errori: {}, successo: true });
    });
  });

  // ── 9. Guardie di ruolo — Server Actions ───────────────────────

  describe("guardie di ruolo — Server Actions", () => {
    it("abilitaCollaboratoreSuOfferte rigetta e non scrive se il ruolo è negato", async () => {
      mockRichiediRuoloApi.mockRejectedValue(
        new ErroreAutorizzazione(403, "Ruolo richiesto: AMMINISTRATORE"),
      );

      const formData = new FormData();
      formData.set("collaboratoreId", "collab-1");
      formData.append("offertaId", "off-1");

      await expect(
        abilitaCollaboratoreSuOfferte(statoIniziale(), formData),
      ).rejects.toThrow(ErroreAutorizzazione);
      expect(mockAbilitazioneOfferta.createMany).not.toHaveBeenCalled();
    });

    it("revocaAbilitazioneCollaboratore rigetta e non scrive se il ruolo è negato", async () => {
      mockRichiediRuoloApi.mockRejectedValue(
        new ErroreAutorizzazione(403, "Ruolo richiesto: AMMINISTRATORE"),
      );

      const formData = new FormData();
      formData.set("collaboratoreId", "collab-1");
      formData.set("offertaId", "off-1");

      await expect(
        revocaAbilitazioneCollaboratore(statoIniziale(), formData),
      ).rejects.toThrow(ErroreAutorizzazione);
      expect(mockAbilitazioneOfferta.deleteMany).not.toHaveBeenCalled();
    });
  });
});
