import { describe, it, expect, vi, beforeEach } from "vitest";

const mockScaglioneKm = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { scaglioneKm: mockScaglioneKm },
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

const { mockValidaScaglione, mockVerificaSogliaUnica } = vi.hoisted(() => ({
  mockValidaScaglione: vi.fn(),
  mockVerificaSogliaUnica: vi.fn(),
}));

vi.mock("@/domain/anagrafiche/valida-scaglione", () => ({
  validaScaglione: mockValidaScaglione,
  verificaSogliaUnica: mockVerificaSogliaUnica,
}));

const { mockNormalizzaTariffa } = vi.hoisted(() => ({
  mockNormalizzaTariffa: vi.fn(),
}));

vi.mock("@/domain/anagrafiche/valida-offerta", () => ({
  normalizzaTariffaGiornaliera: mockNormalizzaTariffa,
}));

import { elencaScaglioni, scaglionePerId } from "@/lib/scaglioni";
import {
  creaScaglione,
  aggiornaScaglione,
  eliminaScaglione,
} from "@/app/(back-office)/anagrafiche/scaglioni/actions";

const ERRORE_SOGLIA_DUPLICATA =
  "Esiste già uno scaglione con questa soglia: le soglie non possono sovrapporsi";

describe("DAL scaglioni", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
  });

  it("elenca gli scaglioni ordinati per soglia crescente", async () => {
    const scaglioni = [
      { id: "scg-1", finoAKm: 100, importo: "28.00", createdAt: new Date(), updatedAt: new Date() },
      { id: "scg-2", finoAKm: 200, importo: "50.00", createdAt: new Date(), updatedAt: new Date() },
    ];
    mockScaglioneKm.findMany.mockResolvedValue(scaglioni);

    const result = await elencaScaglioni();

    expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
    expect(mockScaglioneKm.findMany).toHaveBeenCalledWith({
      orderBy: { finoAKm: "asc" },
    });
    expect(result).toEqual(scaglioni);
  });

  it("restituisce uno scaglione per id", async () => {
    const scaglione = {
      id: "scg-1",
      finoAKm: 100,
      importo: "28.00",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockScaglioneKm.findUnique.mockResolvedValue(scaglione);

    const result = await scaglionePerId("scg-1");

    expect(mockScaglioneKm.findUnique).toHaveBeenCalledWith({ where: { id: "scg-1" } });
    expect(result).toEqual(scaglione);
  });
});

describe("Server Actions scaglioni", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
    mockValidaScaglione.mockReturnValue({});
    mockVerificaSogliaUnica.mockReturnValue(null);
    mockNormalizzaTariffa.mockReturnValue({ valore: "28.00", centesimi: 2800n });
    mockScaglioneKm.findMany.mockResolvedValue([]);
    mockScaglioneKm.create.mockResolvedValue(undefined);
    mockScaglioneKm.update.mockResolvedValue(undefined);
    mockScaglioneKm.delete.mockResolvedValue(undefined);
  });

  it("con dati invalidi non scrive a DB e restituisce la mappa errori", async () => {
    mockValidaScaglione.mockReturnValue({
      finoAKm: "La soglia massima è obbligatoria",
    });

    const formData = new FormData();
    formData.set("finoAKm", "");
    formData.set("importo", "28,00");

    const result = await creaScaglione({ errori: {} }, formData);

    expect(result.errori.finoAKm).toBe("La soglia massima è obbligatoria");
    expect(mockScaglioneKm.create).not.toHaveBeenCalled();
  });

  it("rifiuta una soglia duplicata individuata dalla verifica pura", async () => {
    mockVerificaSogliaUnica.mockReturnValue(ERRORE_SOGLIA_DUPLICATA);

    const formData = new FormData();
    formData.set("finoAKm", "100");
    formData.set("importo", "28,00");

    const result = await creaScaglione({ errori: {} }, formData);

    expect(result.errori.finoAKm).toBe(ERRORE_SOGLIA_DUPLICATA);
    expect(mockScaglioneKm.create).not.toHaveBeenCalled();
  });

  it("traduce il P2002 in errore sul campo finoAKm in creazione", async () => {
    const errore = new Error("duplicate") as Error & { code: string };
    errore.code = "P2002";
    mockScaglioneKm.create.mockRejectedValue(errore);

    const formData = new FormData();
    formData.set("finoAKm", "100");
    formData.set("importo", "28,00");

    const result = await creaScaglione({ errori: {} }, formData);

    expect(result.errori.finoAKm).toBe(ERRORE_SOGLIA_DUPLICATA);
  });

  it("crea lo scaglione e rivalida i path", async () => {
    const formData = new FormData();
    formData.set("finoAKm", "100");
    formData.set("importo", "28,00");

    await creaScaglione({ errori: {} }, formData);

    expect(mockScaglioneKm.create).toHaveBeenCalledWith({
      data: { finoAKm: 100, importo: "28.00" },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/scaglioni");
    expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/scaglioni?esito=creato");
  });

  it("aggiorna lo scaglione escludendo se stesso dal controllo di unicità", async () => {
    const formData = new FormData();
    formData.set("id", "scg-1");
    formData.set("finoAKm", "150");
    formData.set("importo", "30,00");

    await aggiornaScaglione({ errori: {} }, formData);

    expect(mockVerificaSogliaUnica).toHaveBeenCalledWith(150, [], "scg-1");
    expect(mockScaglioneKm.update).toHaveBeenCalledWith({
      where: { id: "scg-1" },
      data: { finoAKm: 150, importo: "28.00" },
    });
    expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/scaglioni?esito=salvato");
  });

  it("traduce il P2002 in errore sul campo finoAKm in aggiornamento", async () => {
    const errore = new Error("duplicate") as Error & { code: string };
    errore.code = "P2002";
    mockScaglioneKm.update.mockRejectedValue(errore);

    const formData = new FormData();
    formData.set("id", "scg-1");
    formData.set("finoAKm", "150");
    formData.set("importo", "30,00");

    const result = await aggiornaScaglione({ errori: {} }, formData);

    expect(result.errori.finoAKm).toBe(ERRORE_SOGLIA_DUPLICATA);
  });

  it("elimina lo scaglione e rivalida i path", async () => {
    const formData = new FormData();
    formData.set("id", "scg-1");

    await eliminaScaglione(formData);

    expect(mockScaglioneKm.delete).toHaveBeenCalledWith({ where: { id: "scg-1" } });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/scaglioni");
    expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/scaglioni?esito=eliminato");
  });

  it("applica la guardia di ruolo su DAL e Server Actions", async () => {
    mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

    await expect(elencaScaglioni()).rejects.toThrow("Accesso negato");
    await expect(scaglionePerId("scg-1")).rejects.toThrow("Accesso negato");

    const formData = new FormData();
    formData.set("finoAKm", "100");
    formData.set("importo", "28,00");

    await expect(creaScaglione({ errori: {} }, formData)).rejects.toThrow("Accesso negato");
    expect(mockScaglioneKm.create).not.toHaveBeenCalled();

    const formDataElimina = new FormData();
    formDataElimina.set("id", "scg-1");
    await expect(eliminaScaglione(formDataElimina)).rejects.toThrow("Accesso negato");
    expect(mockScaglioneKm.delete).not.toHaveBeenCalled();
  });
});
