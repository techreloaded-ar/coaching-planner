import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock di Prisma ─────────────────────────────────────────────────

const mockAbilitazioneOfferta = vi.hoisted(() => ({
  findMany: vi.fn(),
  createMany: vi.fn(),
  deleteMany: vi.fn(),
}));

const mockCollaboratore = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

const mockOfferta = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  abilitazioneOfferta: mockAbilitazioneOfferta,
  collaboratore: mockCollaboratore,
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

// ── Import dei moduli sotto test ───────────────────────────────────

import {
  elencaCollaboratoriIngaggiati,
  elencaCollaboratoriIngaggiabili,
} from "@/lib/abilitazioni";
import {
  ingaggiaCollaboratoriSuOfferta,
  revocaIngaggioCollaboratore,
} from "@/app/(back-office)/offerte/[offertaId]/collaboratori/ingaggi-actions";

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
// DAL ingaggi offerta — query
// ═══════════════════════════════════════════════════════════════════

describe("DAL ingaggi offerta — query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
  });

  // ── 1. elencaCollaboratoriIngaggiati ───────────────────────────

  describe("elencaCollaboratoriIngaggiati", () => {
    it("interroga con where, select e orderBy attesi e mappa nome, cognome ed email", async () => {
      const abilitazioni = [
        {
          collaboratoreId: "collab-1",
          offertaId: "off-1",
          collaboratore: {
            id: "collab-1",
            nome: "Giulia",
            cognome: "Bianchi",
            attivo: true,
            utente: { email: "giulia.bianchi@example.com" },
          },
        },
        {
          collaboratoreId: "collab-2",
          offertaId: "off-1",
          collaboratore: {
            id: "collab-2",
            nome: "Marco",
            cognome: "Rossi",
            attivo: true,
            utente: { email: "marco.rossi@example.com" },
          },
        },
      ];
      mockAbilitazioneOfferta.findMany.mockResolvedValue(abilitazioni);

      const result = await elencaCollaboratoriIngaggiati("off-1");

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockAbilitazioneOfferta.findMany).toHaveBeenCalledWith({
        where: { offertaId: "off-1" },
        include: {
          collaboratore: {
            select: {
              id: true,
              nome: true,
              cognome: true,
              attivo: true,
              utente: { select: { email: true } },
            },
          },
        },
        orderBy: [
          { collaboratore: { cognome: "asc" } },
          { collaboratore: { nome: "asc" } },
        ],
      });
      expect(result).toEqual([
        {
          collaboratoreId: "collab-1",
          nome: "Giulia",
          cognome: "Bianchi",
          email: "giulia.bianchi@example.com",
          collaboratoreAttivo: true,
        },
        {
          collaboratoreId: "collab-2",
          nome: "Marco",
          cognome: "Rossi",
          email: "marco.rossi@example.com",
          collaboratoreAttivo: true,
        },
      ]);
    });

    it("mantiene elencato con collaboratoreAttivo a false un profilo disattivato", async () => {
      mockAbilitazioneOfferta.findMany.mockResolvedValue([
        {
          collaboratoreId: "collab-3",
          offertaId: "off-1",
          collaboratore: {
            id: "collab-3",
            nome: "Anna",
            cognome: "Verdi",
            attivo: false,
            utente: { email: "anna.verdi@example.com" },
          },
        },
      ]);

      const result = await elencaCollaboratoriIngaggiati("off-1");

      expect(result).toEqual([
        {
          collaboratoreId: "collab-3",
          nome: "Anna",
          cognome: "Verdi",
          email: "anna.verdi@example.com",
          collaboratoreAttivo: false,
        },
      ]);
    });
  });

  // ── 2. elencaCollaboratoriIngaggiabili ─────────────────────────

  describe("elencaCollaboratoriIngaggiabili", () => {
    it("filtra i collaboratori attivi non ancora ingaggiati sull'offerta", async () => {
      const collaboratori = [
        {
          id: "collab-4",
          nome: "Luca",
          cognome: "Neri",
          utente: { email: "luca.neri@example.com" },
        },
      ];
      mockCollaboratore.findMany.mockResolvedValue(collaboratori);

      const result = await elencaCollaboratoriIngaggiabili("off-1");

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCollaboratore.findMany).toHaveBeenCalledWith({
        where: {
          attivo: true,
          abilitazioniOfferte: { none: { offertaId: "off-1" } },
        },
        select: {
          id: true,
          nome: true,
          cognome: true,
          utente: { select: { email: true } },
        },
        orderBy: [{ cognome: "asc" }, { nome: "asc" }],
      });
      expect(result).toEqual([
        {
          collaboratoreId: "collab-4",
          nome: "Luca",
          cognome: "Neri",
          email: "luca.neri@example.com",
        },
      ]);
    });
  });

  // ── 3. Guardie di ruolo — query ────────────────────────────────

  describe("guardie di ruolo — query", () => {
    it("elencaCollaboratoriIngaggiati rigetta e non interroga il DB se il ruolo è negato", async () => {
      mockRichiediRuoloApi.mockRejectedValue(
        new ErroreAutorizzazione(403, "Ruolo richiesto: AMMINISTRATORE"),
      );

      await expect(elencaCollaboratoriIngaggiati("off-1")).rejects.toThrow(
        ErroreAutorizzazione,
      );
      expect(mockAbilitazioneOfferta.findMany).not.toHaveBeenCalled();
    });

    it("elencaCollaboratoriIngaggiabili rigetta e non interroga il DB se il ruolo è negato", async () => {
      mockRichiediRuoloApi.mockRejectedValue(
        new ErroreAutorizzazione(403, "Ruolo richiesto: AMMINISTRATORE"),
      );

      await expect(elencaCollaboratoriIngaggiabili("off-1")).rejects.toThrow(
        ErroreAutorizzazione,
      );
      expect(mockCollaboratore.findMany).not.toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Server Actions ingaggi offerta
// ═══════════════════════════════════════════════════════════════════

describe("Server Actions ingaggi offerta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
    mockOfferta.findUnique.mockResolvedValue({ attiva: true });
  });

  // ── 4. ingaggiaCollaboratoriSuOfferta ──────────────────────────

  describe("ingaggiaCollaboratoriSuOfferta", () => {
    it("con due collaboratori attivi crea le coppie con skipDuplicates e conferma", async () => {
      mockCollaboratore.findMany.mockResolvedValue([
        { id: "collab-1" },
        { id: "collab-2" },
      ]);
      mockAbilitazioneOfferta.createMany.mockResolvedValue({ count: 2 });

      const formData = new FormData();
      formData.set("offertaId", "off-1");
      formData.append("collaboratoreId", "collab-1");
      formData.append("collaboratoreId", "collab-2");

      const result = await ingaggiaCollaboratoriSuOfferta(statoIniziale(), formData);

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockOfferta.findUnique).toHaveBeenCalledWith({
        where: { id: "off-1" },
        select: { attiva: true },
      });
      expect(mockCollaboratore.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["collab-1", "collab-2"] }, attivo: true },
        select: { id: true },
      });
      expect(mockAbilitazioneOfferta.createMany).toHaveBeenCalledWith({
        data: [
          { collaboratoreId: "collab-1", offertaId: "off-1" },
          { collaboratoreId: "collab-2", offertaId: "off-1" },
        ],
        skipDuplicates: true,
      });
      expect(mockRevalidatePath.mock.calls).toEqual([
        ["/offerte/off-1/collaboratori"],
        ["/anagrafiche/collaboratori/collab-1"],
        ["/anagrafiche/collaboratori/collab-2"],
      ]);
      expect(result).toEqual({ errori: {}, successo: true });
    });

    it("senza offertaId non scrive e valorizza errori._form", async () => {
      const formData = new FormData();
      formData.append("collaboratoreId", "collab-1");

      const result = await ingaggiaCollaboratoriSuOfferta(statoIniziale(), formData);

      expect(mockCollaboratore.findMany).not.toHaveBeenCalled();
      expect(mockAbilitazioneOfferta.createMany).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(result.errori._form).toBeTruthy();
      expect(result.successo).toBeUndefined();
    });

    it("con selezione vuota non scrive e valorizza errori._form", async () => {
      const formData = new FormData();
      formData.set("offertaId", "off-1");

      const result = await ingaggiaCollaboratoriSuOfferta(statoIniziale(), formData);

      expect(mockCollaboratore.findMany).not.toHaveBeenCalled();
      expect(mockAbilitazioneOfferta.createMany).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(result.errori._form).toBeTruthy();
      expect(result.successo).toBeUndefined();
    });

    it("se un collaboratore non è attivo o non esiste non scrive e valorizza errori._form", async () => {
      // Richiesti due collaboratori, ma solo uno risulta attivo/esistente.
      mockCollaboratore.findMany.mockResolvedValue([{ id: "collab-1" }]);

      const formData = new FormData();
      formData.set("offertaId", "off-1");
      formData.append("collaboratoreId", "collab-1");
      formData.append("collaboratoreId", "collab-disattivato");

      const result = await ingaggiaCollaboratoriSuOfferta(statoIniziale(), formData);

      expect(mockAbilitazioneOfferta.createMany).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(result.errori._form).toBeTruthy();
      expect(result.successo).toBeUndefined();
    });

    it("se l'offerta non esiste non scrive e valorizza errori._form", async () => {
      mockOfferta.findUnique.mockResolvedValue(null);

      const formData = new FormData();
      formData.set("offertaId", "off-inesistente");
      formData.append("collaboratoreId", "collab-1");

      const result = await ingaggiaCollaboratoriSuOfferta(statoIniziale(), formData);

      expect(mockCollaboratore.findMany).not.toHaveBeenCalled();
      expect(mockAbilitazioneOfferta.createMany).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(result.errori._form).toBeTruthy();
      expect(result.successo).toBeUndefined();
    });

    it("se l'offerta non è attiva non scrive e valorizza errori._form", async () => {
      mockOfferta.findUnique.mockResolvedValue({ attiva: false });

      const formData = new FormData();
      formData.set("offertaId", "off-1");
      formData.append("collaboratoreId", "collab-1");

      const result = await ingaggiaCollaboratoriSuOfferta(statoIniziale(), formData);

      expect(mockCollaboratore.findMany).not.toHaveBeenCalled();
      expect(mockAbilitazioneOfferta.createMany).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(result.errori._form).toBeTruthy();
      expect(result.successo).toBeUndefined();
    });
  });

  // ── 5. revocaIngaggioCollaboratore ─────────────────────────────

  describe("revocaIngaggioCollaboratore", () => {
    it("elimina la sola coppia bersaglio, revalida entrambe le pagine e conferma", async () => {
      mockAbilitazioneOfferta.deleteMany.mockResolvedValue({ count: 1 });

      const formData = new FormData();
      formData.set("offertaId", "off-1");
      formData.set("collaboratoreId", "collab-1");

      const result = await revocaIngaggioCollaboratore(statoIniziale(), formData);

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockAbilitazioneOfferta.deleteMany).toHaveBeenCalledWith({
        where: { collaboratoreId: "collab-1", offertaId: "off-1" },
      });
      expect(mockRevalidatePath.mock.calls).toEqual([
        ["/offerte/off-1/collaboratori"],
        ["/anagrafiche/collaboratori/collab-1"],
      ]);
      expect(result).toEqual({ errori: {}, successo: true });
    });

    it("senza offertaId non elimina nulla e valorizza errori._form", async () => {
      const formData = new FormData();
      formData.set("collaboratoreId", "collab-1");

      const result = await revocaIngaggioCollaboratore(statoIniziale(), formData);

      expect(mockAbilitazioneOfferta.deleteMany).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(result.errori._form).toBeTruthy();
      expect(result.successo).toBeUndefined();
    });

    it("senza collaboratoreId non elimina nulla e valorizza errori._form", async () => {
      const formData = new FormData();
      formData.set("offertaId", "off-1");

      const result = await revocaIngaggioCollaboratore(statoIniziale(), formData);

      expect(mockAbilitazioneOfferta.deleteMany).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(result.errori._form).toBeTruthy();
      expect(result.successo).toBeUndefined();
    });
  });

  // ── 6. Guardie di ruolo — Server Actions ───────────────────────

  describe("guardie di ruolo — Server Actions", () => {
    it("ingaggiaCollaboratoriSuOfferta rigetta e non scrive se il ruolo è negato", async () => {
      mockRichiediRuoloApi.mockRejectedValue(
        new ErroreAutorizzazione(403, "Ruolo richiesto: AMMINISTRATORE"),
      );

      const formData = new FormData();
      formData.set("offertaId", "off-1");
      formData.append("collaboratoreId", "collab-1");

      await expect(
        ingaggiaCollaboratoriSuOfferta(statoIniziale(), formData),
      ).rejects.toThrow(ErroreAutorizzazione);
      expect(mockOfferta.findUnique).not.toHaveBeenCalled();
      expect(mockCollaboratore.findMany).not.toHaveBeenCalled();
      expect(mockAbilitazioneOfferta.createMany).not.toHaveBeenCalled();
    });

    it("revocaIngaggioCollaboratore rigetta e non scrive se il ruolo è negato", async () => {
      mockRichiediRuoloApi.mockRejectedValue(
        new ErroreAutorizzazione(403, "Ruolo richiesto: AMMINISTRATORE"),
      );

      const formData = new FormData();
      formData.set("offertaId", "off-1");
      formData.set("collaboratoreId", "collab-1");

      await expect(
        revocaIngaggioCollaboratore(statoIniziale(), formData),
      ).rejects.toThrow(ErroreAutorizzazione);
      expect(mockAbilitazioneOfferta.deleteMany).not.toHaveBeenCalled();
    });
  });
});
