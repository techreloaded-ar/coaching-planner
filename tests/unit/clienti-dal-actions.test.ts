import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock di Prisma ─────────────────────────────────────────────────

const mockCliente = vi.hoisted(() => ({
  findMany: vi.fn(),
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
  elencaClienti,
  elencaClientiSelezionabili,
  clientePerId,
} from "@/lib/clienti";
import {
  creaCliente,
  aggiornaCliente,
  cambiaStatoCliente,
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

  // ── 1. elencaClienti ──────────────────────────────────────────

  describe("elencaClienti", () => {
    it("restituisce tutti i clienti ordinati per ragioneSociale", async () => {
      const clienti = [
        {
          id: "1",
          ragioneSociale: "Alfa SPA",
          attivo: true,
          partitaIva: "11111111111",
          codiceFiscale: null,
          indirizzo: null,
          citta: null,
          cap: null,
          provincia: null,
          pec: null,
          codiceDestinatario: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "2",
          ragioneSociale: "Beta SRL",
          attivo: false,
          partitaIva: "22222222222",
          codiceFiscale: null,
          indirizzo: null,
          citta: null,
          cap: null,
          provincia: null,
          pec: null,
          codiceDestinatario: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockCliente.findMany.mockResolvedValue(clienti);

      const result = await elencaClienti();

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCliente.findMany).toHaveBeenCalledWith({
        orderBy: { ragioneSociale: "asc" },
      });
      expect(result).toEqual(clienti);
      expect(result).toHaveLength(2);
    });
  });

  // ── 2. elencaClientiSelezionabili ─────────────────────────────

  describe("elencaClientiSelezionabili", () => {
    it("restituisce solo i clienti attivi, ordinati per ragioneSociale", async () => {
      const clientiAttivi = [
        {
          id: "1",
          ragioneSociale: "Cliente A",
          attivo: true,
          partitaIva: "11111111111",
          codiceFiscale: null,
          indirizzo: null,
          citta: null,
          cap: null,
          provincia: null,
          pec: null,
          codiceDestinatario: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "3",
          ragioneSociale: "Cliente C",
          attivo: true,
          partitaIva: "33333333333",
          codiceFiscale: null,
          indirizzo: null,
          citta: null,
          cap: null,
          provincia: null,
          pec: null,
          codiceDestinatario: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockCliente.findMany.mockResolvedValue(clientiAttivi);

      const result = await elencaClientiSelezionabili();

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCliente.findMany).toHaveBeenCalledWith({
        where: { attivo: true },
        orderBy: { ragioneSociale: "asc" },
      });
      expect(result).toEqual(clientiAttivi);
      expect(result).toHaveLength(2);
      // Verifica che tutti i clienti restituiti siano attivi
      for (const c of result) {
        expect(c.attivo).toBe(true);
      }
    });
  });

  // ── 3-4. clientePerId ─────────────────────────────────────────

  describe("clientePerId", () => {
    it("restituisce un cliente per ID", async () => {
      const cliente = {
        id: "cliente-1",
        ragioneSociale: "Test SRL",
        attivo: true,
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
      mockCliente.findUnique.mockResolvedValue(cliente);

      const result = await clientePerId("cliente-1");

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCliente.findUnique).toHaveBeenCalledWith({
        where: { id: "cliente-1" },
      });
      expect(result).toEqual(cliente);
      expect(result?.ragioneSociale).toBe("Test SRL");
    });

    it("restituisce null quando il cliente non esiste", async () => {
      mockCliente.findUnique.mockResolvedValue(null);

      const result = await clientePerId("inesistente");

      expect(mockCliente.findUnique).toHaveBeenCalledWith({
        where: { id: "inesistente" },
      });
      expect(result).toBeNull();
    });
  });

  // ── 5. Guardie di ruolo DAL ───────────────────────────────────

  describe("guardie di ruolo — DAL", () => {
    it("elencaClienti propaga l'errore di richiediRuoloApi", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      await expect(elencaClienti()).rejects.toThrow("Accesso negato");
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
          attivo: true,
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
        },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/clienti");
      expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/clienti?esito=salvato");
    });
  });

  // ── 9-10. cambiaStatoCliente ─────────────────────────────────

  describe("cambiaStatoCliente", () => {
    it("attiva un cliente impostando attivo a true", async () => {
      const formData = new FormData();
      formData.set("id", "cliente-1");
      formData.set("attivo", "true");

      const result = await cambiaStatoCliente(statoIniziale(), formData);

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCliente.update).toHaveBeenCalledWith({
        where: { id: "cliente-1" },
        data: { attivo: true },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/clienti");
      expect(result.successo).toBe(true);
      expect(result.errori).toEqual({});
    });

    it("disattiva un cliente impostando attivo a false", async () => {
      const formData = new FormData();
      formData.set("id", "cliente-2");
      formData.set("attivo", "false");

      const result = await cambiaStatoCliente(statoIniziale(), formData);

      expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
      expect(mockCliente.update).toHaveBeenCalledWith({
        where: { id: "cliente-2" },
        data: { attivo: false },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/clienti");
      expect(result.successo).toBe(true);
      expect(result.errori).toEqual({});
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

    it("cambiaStatoCliente propaga l'errore di richiediRuoloApi", async () => {
      mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

      const formData = new FormData();
      formData.set("id", "cliente-1");

      await expect(
        cambiaStatoCliente(statoIniziale(), formData)
      ).rejects.toThrow("Accesso negato");
      expect(mockCliente.update).not.toHaveBeenCalled();
    });
  });
});
