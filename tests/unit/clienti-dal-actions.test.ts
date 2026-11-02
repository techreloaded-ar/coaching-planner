import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock di Prisma ─────────────────────────────────────────────────

const mockCliente = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { cliente: mockCliente },
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

// ── Mock di validaCliente ──────────────────────────────────────────

const { mockValidaCliente } = vi.hoisted(() => ({
  mockValidaCliente: vi.fn(),
}));

vi.mock("@/domain/anagrafiche/valida-cliente", () => ({
  validaCliente: mockValidaCliente,
}));

// ── Import dei moduli sotto test ───────────────────────────────────

import {
  elencaClientiPaginati,
  elencaClientiSelezionabili,
  clientePerId,
} from "@/lib/clienti";
import {
  creaCliente,
  aggiornaCliente,
} from "@/app/(back-office)/anagrafiche/clienti/actions";

// ═══════════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════════

function statoIniziale() {
  return { errori: {} };
}

// ═══════════════════════════════════════════════════════════════════
// DAL clienti
// ═══════════════════════════════════════════════════════════════════

describe("DAL clienti", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
  });

  // ── 1. elencaClientiPaginati ──────────────────────────────────

  describe("elencaClientiPaginati", () => {
    it("senza ricerca legge solo la pagina richiesta dei clienti attivi e nuovi, con i conteggi per stato", async () => {
      mockCliente.count
        .mockResolvedValueOnce(120)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(7);
      mockCliente.findMany.mockResolvedValue([]);

      const result = await elencaClientiPaginati({ ricerca: "", pagina: 2 });

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCliente.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { offerte: { some: { attiva: true } } },
            { offerte: { none: {} } },
          ],
        },
        include: { offerte: { select: { attiva: true } } },
        orderBy: [{ ragioneSociale: "asc" }, { id: "asc" }],
        skip: 25,
        take: 25,
      });
      expect(result).toMatchObject({
        paginaCorrente: 2,
        totalePagine: 5,
        totaleElementi: 120,
        conteggiPerStato: { ATTIVO: 100, NUOVO: 20, NON_ATTIVO: 7 },
        statiSelezionati: ["ATTIVO", "NUOVO"],
      });
    });

    it("con il filtro sui non attivi legge solo i clienti con offerte tutte chiuse", async () => {
      mockCliente.count.mockResolvedValue(0);
      mockCliente.findMany.mockResolvedValue([]);

      await elencaClientiPaginati({ ricerca: "", pagina: 1, stati: ["NON_ATTIVO"] });

      expect(mockCliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { AND: [{ offerte: { some: {} } }, { offerte: { none: { attiva: true } } }] },
            ],
          },
        }),
      );
    });

    it("restituisce ogni cliente con lo stato derivato dalle sue offerte", async () => {
      mockCliente.count.mockResolvedValue(3);
      mockCliente.findMany.mockResolvedValue([
        { id: "a", ragioneSociale: "A", offerte: [{ attiva: true }, { attiva: false }] },
        { id: "b", ragioneSociale: "B", offerte: [] },
        { id: "c", ragioneSociale: "C", offerte: [{ attiva: false }, { attiva: false }] },
      ]);

      const { clienti } = await elencaClientiPaginati({ ricerca: "", pagina: 1 });

      expect(clienti).toEqual([
        { id: "a", ragioneSociale: "A", stato: { tipo: "ATTIVO", numeroOfferte: 1 } },
        { id: "b", ragioneSociale: "B", stato: { tipo: "NUOVO", numeroOfferte: 0 } },
        { id: "c", ragioneSociale: "C", stato: { tipo: "NON_ATTIVO", numeroOfferte: 2 } },
      ]);
    });

    it("con una ricerca cerca su tutti i clienti a prescindere dal filtro e conta gli stati dell'insieme cercato", async () => {
      mockCliente.count.mockResolvedValue(0);
      mockCliente.findMany.mockResolvedValue([]);

      await elencaClientiPaginati({ ricerca: "rossi", pagina: 1, stati: ["ATTIVO"] });

      const filtro = { contains: "rossi", mode: "insensitive" };
      const where = {
        OR: [
          { ragioneSociale: filtro },
          { partitaIva: filtro },
          { citta: filtro },
        ],
      };
      expect(mockCliente.count).toHaveBeenCalledWith({ where });
      expect(mockCliente.count).toHaveBeenCalledWith({
        where: { AND: [where, { offerte: { some: { attiva: true } } }] },
      });
      expect(mockCliente.count).toHaveBeenCalledWith({
        where: { AND: [where, { offerte: { none: {} } }] },
      });
      expect(mockCliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where, skip: 0 }),
      );
    });

    it("una pagina oltre l'ultima restituisce l'ultima pagina valida", async () => {
      mockCliente.count.mockResolvedValue(60);
      mockCliente.findMany.mockResolvedValue([]);

      const result = await elencaClientiPaginati({ ricerca: "", pagina: 7 });

      expect(result.paginaCorrente).toBe(3);
      expect(mockCliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 50, take: 25 }),
      );
    });
  });

  // ── 2. elencaClientiSelezionabili ─────────────────────────────

  describe("elencaClientiSelezionabili", () => {
    it("restituisce tutti i clienti, qualunque sia il loro stato, ordinati per ragioneSociale", async () => {
      const clienti = [
        { id: "1", ragioneSociale: "Cliente A" },
        { id: "3", ragioneSociale: "Cliente C" },
      ];
      mockCliente.findMany.mockResolvedValue(clienti);

      const result = await elencaClientiSelezionabili();

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCliente.findMany).toHaveBeenCalledWith({
        orderBy: { ragioneSociale: "asc" },
      });
      expect(result).toEqual(clienti);
    });
  });

  // ── 3-4. clientePerId ─────────────────────────────────────────

  describe("clientePerId", () => {
    it("restituisce un cliente per ID con lo stato derivato dalle offerte", async () => {
      const cliente = {
        id: "cliente-1",
        ragioneSociale: "Test SRL",
        partitaIva: "12345678901",
        codiceFiscale: null,
        indirizzo: null,
        citta: null,
        cap: null,
        provincia: null,
        pec: null,
        codiceDestinatario: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockCliente.findUnique.mockResolvedValue({
        ...cliente,
        offerte: [{ attiva: true }, { attiva: true }, { attiva: false }],
      });

      const result = await clientePerId("cliente-1");

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCliente.findUnique).toHaveBeenCalledWith({
        where: { id: "cliente-1" },
        include: { offerte: { select: { attiva: true } } },
      });
      expect(result).toEqual({ ...cliente, stato: { tipo: "ATTIVO", numeroOfferte: 2 } });
      expect(result?.ragioneSociale).toBe("Test SRL");
    });

    it("restituisce null quando il cliente non esiste", async () => {
      mockCliente.findUnique.mockResolvedValue(null);

      const result = await clientePerId("inesistente");

      expect(mockCliente.findUnique).toHaveBeenCalledWith({
        where: { id: "inesistente" },
        include: { offerte: { select: { attiva: true } } },
      });
      expect(result).toBeNull();
    });
  });

  // ── 5. Guardie di ruolo DAL ───────────────────────────────────

  describe("guardie di ruolo — DAL", () => {
    it("elencaClientiPaginati propaga l'errore di richiediRuoloApi", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(
        elencaClientiPaginati({ ricerca: "", pagina: 1 }),
      ).rejects.toThrow("Accesso negato");
      expect(mockCliente.findMany).not.toHaveBeenCalled();
    });

    it("elencaClientiSelezionabili propaga l'errore di richiediRuoloApi", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(elencaClientiSelezionabili()).rejects.toThrow("Accesso negato");
      expect(mockCliente.findMany).not.toHaveBeenCalled();
    });

    it("clientePerId propaga l'errore di richiediRuoloApi", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(clientePerId("cliente-1")).rejects.toThrow("Accesso negato");
      expect(mockCliente.findUnique).not.toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Server Actions clienti
// ═══════════════════════════════════════════════════════════════════

describe("Server Actions clienti", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
  });

  // ── 6-7. creaCliente ──────────────────────────────────────────

  describe("creaCliente", () => {
    it("con dati non validi restituisce errori senza scrivere a DB", async () => {
      mockValidaCliente.mockReturnValue({
        ragioneSociale: "La ragione sociale è obbligatoria",
        partitaIva: "La partita IVA è obbligatoria",
      });

      const formData = new FormData();
      formData.set("ragioneSociale", "");
      formData.set("partitaIva", "");

      const result = await creaCliente(statoIniziale(), formData);

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockValidaCliente).toHaveBeenCalled();
      expect(result.errori).toHaveProperty("ragioneSociale");
      expect(result.errori).toHaveProperty("partitaIva");
      expect(result.errori.ragioneSociale).toBe("La ragione sociale è obbligatoria");
      expect(result.errori.partitaIva).toBe("La partita IVA è obbligatoria");
      expect(mockCliente.create).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("senza partita IVA salva il campo come null", async () => {
      mockValidaCliente.mockReturnValue({});

      const formData = new FormData();
      formData.set("ragioneSociale", "Solo Ragione SRL");
      formData.set("partitaIva", "  ");

      await creaCliente(statoIniziale(), formData);

      expect(mockCliente.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ragioneSociale: "Solo Ragione SRL",
          partitaIva: null,
        }),
      });
    });

    it("con dati validi crea il record e redirige", async () => {
      mockValidaCliente.mockReturnValue({});

      const formData = new FormData();
      formData.set("ragioneSociale", "Test SRL");
      formData.set("partitaIva", "12345678901");
      formData.set("codiceFiscale", "RSSMRA80A01H501U");
      formData.set("indirizzo", "Via Roma 1");
      formData.set("citta", "Milano");
      formData.set("cap", "20121");
      formData.set("provincia", "MI");
      formData.set("pec", "test@pec.it");
      formData.set("codiceDestinatario", "ABC1234");
      formData.set("personaRiferimento", "  Mario Rossi (HR)  ");
      formData.set("note", "  Referente: Mario\nPreferisce la PEC  ");

      await creaCliente(statoIniziale(), formData);

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCliente.create).toHaveBeenCalledWith({
        data: {
          ragioneSociale: "Test SRL",
          partitaIva: "12345678901",
          codiceFiscale: "RSSMRA80A01H501U",
          indirizzo: "Via Roma 1",
          citta: "Milano",
          cap: "20121",
          provincia: "MI",
          pec: "test@pec.it",
          codiceDestinatario: "ABC1234",
          personaRiferimento: "Mario Rossi (HR)",
          note: "Referente: Mario\nPreferisce la PEC",
        },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/clienti");
      expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/clienti?esito=creato");
    });
  });

  // ── 8. aggiornaCliente ───────────────────────────────────────

  describe("aggiornaCliente", () => {
    it("aggiorna il record esistente e redirige", async () => {
      mockValidaCliente.mockReturnValue({});

      const formData = new FormData();
      formData.set("id", "cliente-1");
      formData.set("ragioneSociale", "Test SRL Updated");
      formData.set("partitaIva", "12345678901");
      formData.set("codiceFiscale", "");
      formData.set("indirizzo", "Via Milano 2");
      formData.set("citta", "Roma");
      formData.set("cap", "00100");
      formData.set("provincia", "RM");
      formData.set("pec", "");
      formData.set("codiceDestinatario", "");
      formData.set("personaRiferimento", "  ");
      formData.set("note", "   ");

      await aggiornaCliente(statoIniziale(), formData);

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCliente.update).toHaveBeenCalledWith({
        where: { id: "cliente-1" },
        data: {
          ragioneSociale: "Test SRL Updated",
          partitaIva: "12345678901",
          codiceFiscale: null,
          indirizzo: "Via Milano 2",
          citta: "Roma",
          cap: "00100",
          provincia: "RM",
          pec: null,
          codiceDestinatario: null,
          personaRiferimento: null,
          note: null,
        },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/clienti");
      expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/clienti?esito=salvato");
    });
  });

  // ── 11. Guardie di ruolo Server Actions ───────────────────────

  describe("guardie di ruolo — Server Actions", () => {
    it("creaCliente propaga l'errore di richiediRuoloApi", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      const formData = new FormData();
      formData.set("ragioneSociale", "Test");

      await expect(
        creaCliente(statoIniziale(), formData)
      ).rejects.toThrow("Accesso negato");
      expect(mockCliente.create).not.toHaveBeenCalled();
    });

    it("aggiornaCliente propaga l'errore di richiediRuoloApi", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      const formData = new FormData();
      formData.set("id", "cliente-1");

      await expect(
        aggiornaCliente(statoIniziale(), formData)
      ).rejects.toThrow("Accesso negato");
      expect(mockCliente.update).not.toHaveBeenCalled();
    });
  });
});
