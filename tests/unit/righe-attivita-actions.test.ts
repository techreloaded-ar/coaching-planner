import { describe, it, expect, vi, beforeEach } from "vitest";
import { creaRiga, modificaRiga, eliminaRiga } from "@/lib/actions/righe-attivita";

// ── Mock di Prisma ──────────────────────────────────────────────

const mockRigaAttivita = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    rigaAttivita: mockRigaAttivita,
  },
}));

// ── Mock del DAL ────────────────────────────────────────────────

const mockRichiediCollaboratoreCorrente = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dal")>();
  return {
    ...actual,
    richiediCollaboratoreCorrente: mockRichiediCollaboratoreCorrente,
  };
});

// ── Mock di revalidatePath ──────────────────────────────────────

const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

// ═══════════════════════════════════════════════════════════════
// Helper: FormData builder
// ═══════════════════════════════════════════════════════════════

function creaFormData(campi: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campi)) {
    fd.append(k, v);
  }
  return fd;
}

// ═══════════════════════════════════════════════════════════════
// Helpers: risposte mock
// ═══════════════════════════════════════════════════════════════

function collaboratoreMock() {
  return {
    id: "collab-giulia",
    userId: "user-giulia",
    nome: "Giulia",
    cognome: "Conti",
    partitaIva: "IT12345678901",
    tariffaGiornaliera: "350.00",
    attivo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ═══════════════════════════════════════════════════════════════
// Test
// ═══════════════════════════════════════════════════════════════

describe("creaRiga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea un record con tutti i campi corretti", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(collaboratoreMock());
    mockRigaAttivita.create.mockResolvedValue({ id: "riga-1" });

    const fd = creaFormData({
      clienteId: "cliente-1",
      offertaId: "offerta-1",
      ore: "8",
      nota: "Analisi requisiti",
      data: "2026-07-01",
    });
    // checkbox fatturabile: quando è checked, viene inviato "on"
    fd.append("fatturabile", "on");

    const result = await creaRiga(fd);

    expect(result.success).toBe(true);
    expect(mockRigaAttivita.create).toHaveBeenCalledTimes(1);

    const chiamata = mockRigaAttivita.create.mock.calls[0][0];
    expect(chiamata.data.collaboratoreId).toBe("collab-giulia");
    expect(chiamata.data.clienteId).toBe("cliente-1");
    expect(chiamata.data.offertaId).toBe("offerta-1");
    expect(chiamata.data.ore).toBe(8);
    expect(chiamata.data.nota).toBe("Analisi requisiti");
    expect(chiamata.data.fatturabile).toBe(true);

    // Verifica revalidate
    expect(mockRevalidatePath).toHaveBeenCalledWith("/attivita/2026-07-01");
  });

  it("crea una riga con fatturabile disattivato", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(collaboratoreMock());
    mockRigaAttivita.create.mockResolvedValue({ id: "riga-2" });

    const fd = creaFormData({
      clienteId: "cliente-1",
      offertaId: "offerta-1",
      ore: "4",
      data: "2026-07-02",
    });
    // Non appendere "fatturabile" = deselezionato

    const result = await creaRiga(fd);

    expect(result.success).toBe(true);
    const chiamata = mockRigaAttivita.create.mock.calls[0][0];
    expect(chiamata.data.fatturabile).toBe(false);
  });

  it("rifiuta ore non valide con messaggio di errore", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(collaboratoreMock());

    const fd = creaFormData({
      clienteId: "cliente-1",
      offertaId: "offerta-1",
      ore: "0",
      data: "2026-07-01",
    });

    const result = await creaRiga(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockRigaAttivita.create).not.toHaveBeenCalled();
  });

  it("rifiuta ore negative", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(collaboratoreMock());

    const fd = creaFormData({
      clienteId: "cliente-1",
      offertaId: "offerta-1",
      ore: "-3",
      data: "2026-07-01",
    });

    const result = await creaRiga(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rifiuta ore testuali", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(collaboratoreMock());

    const fd = creaFormData({
      clienteId: "cliente-1",
      offertaId: "offerta-1",
      ore: "abc",
      data: "2026-07-01",
    });

    const result = await creaRiga(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rifiuta campi obbligatori mancanti", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(collaboratoreMock());

    const fd = creaFormData({
      clienteId: "cliente-1",
      // offertaId mancante
      ore: "8",
      data: "2026-07-01",
    });

    const result = await creaRiga(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Compila tutti i campi obbligatori");
  });

  it("restituisce errore se non autenticato", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(null);

    const fd = creaFormData({
      clienteId: "cliente-1",
      offertaId: "offerta-1",
      ore: "8",
      data: "2026-07-01",
    });

    const result = await creaRiga(fd);

    expect(result.success).toBe(false);
    expect(result.error).toContain("collaboratore");
  });
});

// ═══════════════════════════════════════════════════════════════

describe("modificaRiga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggiorna i campi modificati", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(collaboratoreMock());
    mockRigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-giulia",
    });
    mockRigaAttivita.update.mockResolvedValue({ id: "riga-1" });

    const fd = creaFormData({
      rigaId: "riga-1",
      ore: "6.5",
      nota: "Nota aggiornata",
      data: "2026-07-01",
    });
    fd.append("fatturabile", "on");

    const result = await modificaRiga(fd);

    expect(result.success).toBe(true);
    expect(mockRigaAttivita.update).toHaveBeenCalledTimes(1);

    const chiamata = mockRigaAttivita.update.mock.calls[0][0];
    expect(chiamata.where.id).toBe("riga-1");
    expect(chiamata.data.ore).toBe(6.5);
    expect(chiamata.data.nota).toBe("Nota aggiornata");
    expect(chiamata.data.fatturabile).toBe(true);

    expect(mockRevalidatePath).toHaveBeenCalledWith("/attivita/2026-07-01");
  });

  it("rifiuta riga di altro collaboratore", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(collaboratoreMock());
    mockRigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-altro",
    });

    const fd = creaFormData({
      rigaId: "riga-altrui",
      ore: "8",
      data: "2026-07-01",
    });

    const result = await modificaRiga(fd);

    expect(result.success).toBe(false);
    expect(result.error).toContain("altro collaboratore");
    expect(mockRigaAttivita.update).not.toHaveBeenCalled();
  });

  it("rifiuta riga inesistente", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(collaboratoreMock());
    mockRigaAttivita.findUnique.mockResolvedValue(null);

    const fd = creaFormData({
      rigaId: "riga-inesistente",
      ore: "8",
      data: "2026-07-01",
    });

    const result = await modificaRiga(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Riga non trovata");
  });

  it("restituisce errore se non autenticato", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(null);

    const fd = creaFormData({
      rigaId: "riga-1",
      ore: "8",
      data: "2026-07-01",
    });

    const result = await modificaRiga(fd);

    expect(result.success).toBe(false);
    expect(result.error).toContain("collaboratore");
  });
});

// ═══════════════════════════════════════════════════════════════

describe("eliminaRiga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancella correttamente il record", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(collaboratoreMock());
    mockRigaAttivita.findUnique
      // Prima chiamata: verificaProprietario
      .mockResolvedValueOnce({ collaboratoreId: "collab-giulia" })
      // Seconda chiamata: recupera la data per revalidate
      .mockResolvedValueOnce({ data: new Date(2026, 6, 1) });
    mockRigaAttivita.delete.mockResolvedValue({ id: "riga-1" });

    const result = await eliminaRiga("riga-1");

    expect(result.success).toBe(true);
    expect(mockRigaAttivita.delete).toHaveBeenCalledWith({
      where: { id: "riga-1" },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/attivita/2026-07-01");
  });

  it("rifiuta riga di altro collaboratore", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(collaboratoreMock());
    mockRigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-altro",
    });

    const result = await eliminaRiga("riga-altrui");

    expect(result.success).toBe(false);
    expect(result.error).toContain("altro collaboratore");
    expect(mockRigaAttivita.delete).not.toHaveBeenCalled();
  });

  it("rifiuta riga inesistente", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(collaboratoreMock());
    mockRigaAttivita.findUnique.mockResolvedValue(null);

    const result = await eliminaRiga("riga-inesistente");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Riga non trovata");
  });

  it("restituisce errore se non autenticato", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(null);

    const result = await eliminaRiga("riga-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("collaboratore");
  });
});
