import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";

// ── Mock di Prisma ─────────────────────────────────────────────────

const mockTariffaCollaboratore = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { tariffaCollaboratore: mockTariffaCollaboratore },
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
  eliminaTariffaCollaboratore,
  salvaTariffaCollaboratore,
} from "@/app/(back-office)/anagrafiche/collaboratori/[id]/tariffe-actions";
import { MESSAGGIO_MESE_TARIFFA_OCCUPATO } from "@/domain/tariffe";

// ═══════════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════════

function statoIniziale() {
  return { errori: {} };
}

function formTariffa(campi: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const valori = {
    collaboratoreId: "collab-1",
    validaDalMese: "2026-07",
    modalita: "FISSO_MENSILE",
    importo: "6500,00",
    ...campi,
  };
  for (const [nome, valore] of Object.entries(valori)) formData.set(nome, valore);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRichiediRuoloApi.mockResolvedValue(undefined);
  mockTariffaCollaboratore.findFirst.mockResolvedValue(null);
  mockTariffaCollaboratore.updateMany.mockResolvedValue({ count: 1 });
});

// ═══════════════════════════════════════════════════════════════════
// salvaTariffaCollaboratore
// ═══════════════════════════════════════════════════════════════════

describe("salvaTariffaCollaboratore", () => {
  it("propaga l'errore di richiediRuoloApi senza toccare il database", async () => {
    mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

    await expect(salvaTariffaCollaboratore(statoIniziale(), formTariffa())).rejects.toThrow(
      "Accesso negato",
    );
    expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
    expect(mockTariffaCollaboratore.findFirst).not.toHaveBeenCalled();
    expect(mockTariffaCollaboratore.create).not.toHaveBeenCalled();
  });

  it("con dati non validi restituisce gli errori senza scritture", async () => {
    const result = await salvaTariffaCollaboratore(
      statoIniziale(),
      formTariffa({ validaDalMese: "2026-13", modalita: "ORARIA", importo: "0" }),
    );

    expect(result.errori).toEqual({
      validaDalMese: "Indica il mese da cui la tariffa è valida",
      modalita: "Scegli la modalità della tariffa",
      importo: "L'importo deve essere maggiore di zero",
    });
    expect(mockTariffaCollaboratore.findFirst).not.toHaveBeenCalled();
    expect(mockTariffaCollaboratore.create).not.toHaveBeenCalled();
    expect(mockTariffaCollaboratore.updateMany).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("rifiuta un mese già occupato da un'altra voce", async () => {
    mockTariffaCollaboratore.findFirst.mockResolvedValue({ id: "tariffa-esistente" });

    const result = await salvaTariffaCollaboratore(statoIniziale(), formTariffa());

    expect(result.errori).toEqual({ validaDalMese: MESSAGGIO_MESE_TARIFFA_OCCUPATO });
    expect(mockTariffaCollaboratore.findFirst).toHaveBeenCalledWith({
      where: { collaboratoreId: "collab-1", validaDalMese: "2026-07" },
      select: { id: true },
    });
    expect(mockTariffaCollaboratore.create).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("senza tariffaId crea una nuova voce con importo normalizzato", async () => {
    const result = await salvaTariffaCollaboratore(statoIniziale(), formTariffa());

    expect(result).toEqual({ errori: {}, successo: true });
    expect(mockTariffaCollaboratore.create).toHaveBeenCalledWith({
      data: {
        collaboratoreId: "collab-1",
        validaDalMese: "2026-07",
        modalita: "FISSO_MENSILE",
        importo: "6500.00",
      },
    });
    expect(mockTariffaCollaboratore.updateMany).not.toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/collaboratori/collab-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/collaboratori");
  });

  it("con tariffaId modifica la voce limitandosi al collaboratore e ignora sé stessa nel controllo del mese", async () => {
    const result = await salvaTariffaCollaboratore(
      statoIniziale(),
      formTariffa({ tariffaId: "tariffa-1", modalita: "GIORNALIERA", importo: "450" }),
    );

    expect(result).toEqual({ errori: {}, successo: true });
    expect(mockTariffaCollaboratore.findFirst).toHaveBeenCalledWith({
      where: { collaboratoreId: "collab-1", validaDalMese: "2026-07", id: { not: "tariffa-1" } },
      select: { id: true },
    });
    expect(mockTariffaCollaboratore.updateMany).toHaveBeenCalledWith({
      where: { id: "tariffa-1", collaboratoreId: "collab-1" },
      data: { validaDalMese: "2026-07", modalita: "GIORNALIERA", importo: "450.00" },
    });
    expect(mockTariffaCollaboratore.create).not.toHaveBeenCalled();
  });

  it("restituisce un errore se la voce da modificare non appartiene al collaboratore", async () => {
    mockTariffaCollaboratore.updateMany.mockResolvedValue({ count: 0 });

    const result = await salvaTariffaCollaboratore(
      statoIniziale(),
      formTariffa({ tariffaId: "tariffa-altrui" }),
    );

    expect(result.errori).toEqual({ _form: "Tariffa non trovata" });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("traduce il vincolo unico P2002 di un salvataggio concorrente nell'errore di mese occupato", async () => {
    mockTariffaCollaboratore.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const result = await salvaTariffaCollaboratore(statoIniziale(), formTariffa());

    expect(result.errori).toEqual({ validaDalMese: MESSAGGIO_MESE_TARIFFA_OCCUPATO });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// eliminaTariffaCollaboratore
// ═══════════════════════════════════════════════════════════════════

describe("eliminaTariffaCollaboratore", () => {
  function formEliminazione(tariffaId: string): FormData {
    const formData = new FormData();
    formData.set("collaboratoreId", "collab-1");
    formData.set("tariffaId", tariffaId);
    return formData;
  }

  it("propaga l'errore di richiediRuoloApi senza toccare il database", async () => {
    mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

    await expect(
      eliminaTariffaCollaboratore(statoIniziale(), formEliminazione("tariffa-2")),
    ).rejects.toThrow("Accesso negato");
    expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
    expect(mockTariffaCollaboratore.deleteMany).not.toHaveBeenCalled();
  });

  it("rifiuta l'eliminazione della voce più vecchia", async () => {
    mockTariffaCollaboratore.findFirst.mockResolvedValue({ id: "tariffa-1" });

    const result = await eliminaTariffaCollaboratore(statoIniziale(), formEliminazione("tariffa-1"));

    expect(result.errori).toEqual({ _form: "La tariffa più vecchia non si può eliminare" });
    expect(mockTariffaCollaboratore.findFirst).toHaveBeenCalledWith({
      where: { collaboratoreId: "collab-1" },
      orderBy: { validaDalMese: "asc" },
      select: { id: true },
    });
    expect(mockTariffaCollaboratore.deleteMany).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("elimina un'altra voce limitandosi al collaboratore", async () => {
    mockTariffaCollaboratore.findFirst.mockResolvedValue({ id: "tariffa-1" });

    const result = await eliminaTariffaCollaboratore(statoIniziale(), formEliminazione("tariffa-2"));

    expect(result).toEqual({ errori: {}, successo: true });
    expect(mockTariffaCollaboratore.deleteMany).toHaveBeenCalledWith({
      where: { id: "tariffa-2", collaboratoreId: "collab-1" },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/collaboratori/collab-1");
  });
});
