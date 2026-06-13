import { describe, it, expect, vi, beforeEach } from "vitest";

const mockOfferta = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { offerta: mockOfferta },
}));

const { mockRichiediRuoloApi } = vi.hoisted(() => ({
  mockRichiediRuoloApi: vi.fn(),
}));

vi.mock("@/lib/dal", () => ({
  richiediRuoloApi: mockRichiediRuoloApi,
}));

const { mockRevalidatePath } = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

const { mockClientePerId } = vi.hoisted(() => ({
  mockClientePerId: vi.fn(),
}));

vi.mock("@/lib/clienti", () => ({
  clientePerId: mockClientePerId,
}));

const { mockValidaOfferta, mockNormalizzaTariffa } = vi.hoisted(() => ({
  mockValidaOfferta: vi.fn(),
  mockNormalizzaTariffa: vi.fn(),
}));

vi.mock("@/domain/anagrafiche/valida-offerta", () => ({
  validaOfferta: mockValidaOfferta,
  normalizzaTariffaGiornaliera: mockNormalizzaTariffa,
}));

import { elencaOffertePerCliente, offertaPerId } from "@/lib/offerte";
import {
  creaOfferta,
  aggiornaOfferta,
} from "@/app/(back-office)/anagrafiche/clienti/[id]/offerte/actions";

describe("DAL offerte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
  });

  it("elenca le offerte di un cliente ordinate per codice", async () => {
    const offerte = [
      {
        id: "off-1",
        codice: "OFF-001",
        descrizione: "Analisi",
        clienteId: "cli-1",
        tariffaGiornaliera: "650.00",
        giorniPrevisti: 10,
        attiva: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockOfferta.findMany.mockResolvedValue(offerte);

    const result = await elencaOffertePerCliente("cli-1");

    expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
    expect(mockOfferta.findMany).toHaveBeenCalledWith({
      where: { clienteId: "cli-1" },
      orderBy: { codice: "asc" },
    });
    expect(result).toEqual(offerte);
  });

  it("restituisce un'offerta per id con il cliente incluso", async () => {
    const offerta = {
      id: "off-1",
      codice: "OFF-001",
      descrizione: "Analisi",
      clienteId: "cli-1",
      tariffaGiornaliera: "650.00",
      giorniPrevisti: 10,
      attiva: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      cliente: {
        id: "cli-1",
        ragioneSociale: "Cliente demo",
        attivo: true,
      },
    };
    mockOfferta.findUnique.mockResolvedValue(offerta);

    const result = await offertaPerId("off-1");

    expect(mockOfferta.findUnique).toHaveBeenCalledWith({
      where: { id: "off-1" },
      include: { cliente: true },
    });
    expect(result).toEqual(offerta);
  });
});

describe("Server Actions offerte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
    mockValidaOfferta.mockReturnValue({});
    mockNormalizzaTariffa.mockReturnValue({ valore: "650.00", centesimi: 65000n });
    mockClientePerId.mockResolvedValue({
      id: "cli-1",
      ragioneSociale: "Cliente demo",
      attivo: true,
    });
    mockOfferta.create.mockResolvedValue(undefined);
    mockOfferta.update.mockResolvedValue(undefined);
  });

  it("con dati invalidi non scrive a DB e restituisce gli errori", async () => {
    mockValidaOfferta.mockReturnValue({
      tariffaGiornaliera: "La tariffa giornaliera è obbligatoria",
    });

    const formData = new FormData();
    formData.set("clienteId", "cli-1");
    formData.set("codice", "OFF-001");

    const result = await creaOfferta({ errori: {} }, formData);

    expect(result.errori.tariffaGiornaliera).toBe(
      "La tariffa giornaliera è obbligatoria"
    );
    expect(mockOfferta.create).not.toHaveBeenCalled();
  });

  it("rifiuta la creazione su cliente disattivato", async () => {
    mockClientePerId.mockResolvedValue({
      id: "cli-1",
      ragioneSociale: "Cliente demo",
      attivo: false,
    });

    const formData = new FormData();
    formData.set("clienteId", "cli-1");
    formData.set("codice", "OFF-001");
    formData.set("descrizione", "Analisi");
    formData.set("tariffaGiornaliera", "650,00");
    formData.set("giorniPrevisti", "5");

    const result = await creaOfferta({ errori: {} }, formData);

    expect(result.errori._form).toBe(
      "Non puoi creare offerte per un cliente disattivato"
    );
    expect(mockOfferta.create).not.toHaveBeenCalled();
  });

  it("traduce il P2002 in errore sul campo codice", async () => {
    const errore = new Error("duplicate") as Error & { code: string };
    errore.code = "P2002";
    mockOfferta.create.mockRejectedValue(errore);

    const formData = new FormData();
    formData.set("clienteId", "cli-1");
    formData.set("codice", "OFF-001");
    formData.set("descrizione", "Analisi");
    formData.set("tariffaGiornaliera", "650,00");
    formData.set("giorniPrevisti", "5");

    const result = await creaOfferta({ errori: {} }, formData);

    expect(result.errori.codice).toBe(
      "Esiste già un'offerta con questo codice per questo cliente"
    );
  });

  it("crea l'offerta e rivalida i path", async () => {
    const formData = new FormData();
    formData.set("clienteId", "cli-1");
    formData.set("codice", "OFF-001");
    formData.set("descrizione", "Analisi");
    formData.set("tariffaGiornaliera", "650,00");
    formData.set("giorniPrevisti", "5");

    await creaOfferta({ errori: {} }, formData);

    expect(mockOfferta.create).toHaveBeenCalledWith({
      data: {
        clienteId: "cli-1",
        codice: "OFF-001",
        descrizione: "Analisi",
        tariffaGiornaliera: "650.00",
        giorniPrevisti: 5,
        attiva: true,
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/clienti");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/clienti/cli-1");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/anagrafiche/clienti/cli-1?esito=offerta-creata"
    );
  });

  it("aggiorna l'offerta e rivalida i path", async () => {
    const formData = new FormData();
    formData.set("id", "off-1");
    formData.set("clienteId", "cli-1");
    formData.set("codice", "OFF-002");
    formData.set("descrizione", "Delivery");
    formData.set("tariffaGiornaliera", "700,00");
    formData.set("giorniPrevisti", "8");

    await aggiornaOfferta({ errori: {} }, formData);

    expect(mockOfferta.update).toHaveBeenCalledWith({
      where: { id: "off-1" },
      data: {
        codice: "OFF-002",
        descrizione: "Delivery",
        tariffaGiornaliera: "650.00",
        giorniPrevisti: 8,
      },
    });
    expect(mockRedirect).toHaveBeenCalledWith(
      "/anagrafiche/clienti/cli-1?esito=offerta-salvata"
    );
  });

  it("traduce il P2002 anche in aggiornamento", async () => {
    const errore = new Error("duplicate") as Error & { code: string };
    errore.code = "P2002";
    mockOfferta.update.mockRejectedValue(errore);

    const formData = new FormData();
    formData.set("id", "off-1");
    formData.set("clienteId", "cli-1");
    formData.set("codice", "OFF-002");
    formData.set("descrizione", "Delivery");
    formData.set("tariffaGiornaliera", "700,00");
    formData.set("giorniPrevisti", "8");

    const result = await aggiornaOfferta({ errori: {} }, formData);

    expect(result.errori.codice).toBe(
      "Esiste già un'offerta con questo codice per questo cliente"
    );
  });

  it("applica la guardia di ruolo su DAL e actions", async () => {
    mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

    await expect(elencaOffertePerCliente("cli-1")).rejects.toThrow("Accesso negato");
    await expect(offertaPerId("off-1")).rejects.toThrow("Accesso negato");

    const formData = new FormData();
    formData.set("clienteId", "cli-1");

    await expect(creaOfferta({ errori: {} }, formData)).rejects.toThrow(
      "Accesso negato"
    );
    expect(mockOfferta.create).not.toHaveBeenCalled();
  });
});
