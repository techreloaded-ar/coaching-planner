import { describe, it, expect, vi, beforeEach } from "vitest";
import { creaRiga, modificaRiga, eliminaRiga, rimuoviTrasferta } from "@/lib/actions/righe-attivita";

// ── Mock di Prisma ──────────────────────────────────────────────

const mockRigaAttivita = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findUnique: vi.fn(),
}));

const mockScaglioneKm = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

const mockOfferta = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

const mockAbilitazioneOfferta = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    rigaAttivita: mockRigaAttivita,
    scaglioneKm: mockScaglioneKm,
    offerta: mockOfferta,
    abilitazioneOfferta: mockAbilitazioneOfferta,
  },
}));

// ── Mock del DAL ────────────────────────────────────────────────

const mockRisolviProfiloCollaboratoreCorrente = vi.hoisted(() => vi.fn());
const mockRichiediCollaboratoreCorrente = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dal")>();
  return {
    ...actual,
    risolviProfiloCollaboratoreCorrente: mockRisolviProfiloCollaboratoreCorrente,
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

beforeEach(() => {
  mockRichiediCollaboratoreCorrente.mockResolvedValue(collaboratoreMock());
});

// ═══════════════════════════════════════════════════════════════
// Test
// ═══════════════════════════════════════════════════════════════

describe("creaRiga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock offerta valida per tutte le chiamate (necessario per verificaOffertaCliente)
    mockOfferta.findUnique.mockResolvedValue({
      clienteId: "cliente-1",
      attiva: true,
    });
    // Mock abilitazione presente per tutte le chiamate (necessario per verificaAbilitazioneOfferta)
    mockAbilitazioneOfferta.findUnique.mockResolvedValue({
      collaboratoreId: "collab-giulia",
      offertaId: "offerta-1",
    });
    // Mock scaglioni per validazione km (quando presente)
    mockScaglioneKm.findMany.mockResolvedValue([
      { finoAKm: 50, importo: "15.00" },
      { finoAKm: 100, importo: "28.00" },
      { finoAKm: 250, importo: "85.00" },
    ]);
  });

  it("crea un record con tutti i campi corretti", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
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
    expect(chiamata.data.trasfertaKm).toBeNull();

    // Verifica revalidate
    expect(mockRevalidatePath).toHaveBeenCalledWith("/attivita/2026-07-01");
  });

  it("crea una riga con trasfertaKm valido", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.create.mockResolvedValue({ id: "riga-1" });

    const fd = creaFormData({
      clienteId: "cliente-1",
      offertaId: "offerta-1",
      ore: "8",
      data: "2026-07-01",
      trasfertaKm: "150",
    });
    fd.append("fatturabile", "on");

    const result = await creaRiga(fd);

    expect(result.success).toBe(true);
    expect(mockRigaAttivita.create).toHaveBeenCalledTimes(1);

    const chiamata = mockRigaAttivita.create.mock.calls[0][0];
    expect(chiamata.data.trasfertaKm).toBe(150);
  });

  it("rifiuta trasfertaKm oltre soglia massima", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });

    const fd = creaFormData({
      clienteId: "cliente-1",
      offertaId: "offerta-1",
      ore: "8",
      data: "2026-07-01",
      trasfertaKm: "500",
    });

    const result = await creaRiga(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("250");
    expect(mockRigaAttivita.create).not.toHaveBeenCalled();
  });

  it("crea una riga con fatturabile disattivato", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
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
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });

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
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });

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
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });

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
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });

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

  it("rifiuta offerta non appartenente al cliente", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockOfferta.findUnique.mockResolvedValue({
      clienteId: "cliente-altro",
      attiva: true,
    });

    const fd = creaFormData({
      clienteId: "cliente-1",
      offertaId: "offerta-altrui",
      ore: "8",
      data: "2026-07-01",
    });

    const result = await creaRiga(fd);

    expect(result.success).toBe(false);
    expect(result.error).toContain("appartiene");
    expect(mockRigaAttivita.create).not.toHaveBeenCalled();
  });

  it("rifiuta offerta non abilitata per il collaboratore (AC-2)", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockAbilitazioneOfferta.findUnique.mockResolvedValue(null);

    const fd = creaFormData({
      clienteId: "cliente-1",
      offertaId: "offerta-1",
      ore: "8",
      data: "2026-07-01",
    });

    const result = await creaRiga(fd);

    expect(result).toEqual({
      success: false,
      error: "Non sei abilitato a registrare attività su questa offerta",
    });
    expect(mockRigaAttivita.create).not.toHaveBeenCalled();
  });

  it("scrive l'attività dell'amministratore sul suo profilo collegato", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: { ...collaboratoreMock(), id: "collab-admin", userId: "admin-1" },
    });
    mockRigaAttivita.create.mockResolvedValue({ id: "riga-admin" });

    const result = await creaRiga(creaFormData({
      clienteId: "cliente-1",
      offertaId: "offerta-1",
      ore: "8",
      data: "2026-07-01",
    }));

    expect(result.success).toBe(true);
    expect(mockRigaAttivita.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ collaboratoreId: "collab-admin" }),
      })
    );
  });

  it.each([
    ["assente", { stato: "ASSENTE" }, "non ha un profilo"],
    ["disattivato", { stato: "DISATTIVATO" }, "è disattivato"],
  ])("non scrive né interroga dati attività con profilo %s", async (_stato, profilo, messaggio) => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(profilo);

    const result = await creaRiga(creaFormData({
      clienteId: "cliente-1",
      offertaId: "offerta-1",
      ore: "8",
      data: "2026-07-01",
    }));

    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining(messaggio) }));
    expect(mockRigaAttivita.create).not.toHaveBeenCalled();
    expect(mockOfferta.findUnique).not.toHaveBeenCalled();
    expect(mockScaglioneKm.findMany).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════

describe("modificaRiga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScaglioneKm.findMany.mockResolvedValue([
      { finoAKm: 50, importo: "15.00" },
      { finoAKm: 100, importo: "28.00" },
      { finoAKm: 250, importo: "85.00" },
    ]);
    // Mock offerta e abilitazione presente, usati solo quando cambia l'offerta della riga
    mockOfferta.findUnique.mockResolvedValue({
      clienteId: "cliente-1",
      attiva: true,
    });
    mockAbilitazioneOfferta.findUnique.mockResolvedValue({
      collaboratoreId: "collab-giulia",
      offertaId: "offerta-2",
    });
  });

  it("aggiorna i campi modificati", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
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

  it("aggiorna trasfertaKm a un nuovo valore valido", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-giulia",
    });
    mockRigaAttivita.update.mockResolvedValue({ id: "riga-1" });

    const fd = creaFormData({
      rigaId: "riga-1",
      trasfertaKm: "150",
      data: "2026-07-01",
    });

    const result = await modificaRiga(fd);

    expect(result.success).toBe(true);
    const chiamata = mockRigaAttivita.update.mock.calls[0][0];
    expect(chiamata.data.trasfertaKm).toBe(150);
  });

  it("rimuove trasfertaKm quando inviato vuoto", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-giulia",
    });
    mockRigaAttivita.update.mockResolvedValue({ id: "riga-1" });

    const fd = creaFormData({
      rigaId: "riga-1",
      trasfertaKm: "",
      data: "2026-07-01",
    });

    const result = await modificaRiga(fd);

    expect(result.success).toBe(true);
    const chiamata = mockRigaAttivita.update.mock.calls[0][0];
    expect(chiamata.data.trasfertaKm).toBeNull();
  });

  it("a parità di offerta aggiorna le ore senza consultare l'abilitazione (AC-4)", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-giulia",
      offertaId: "offerta-1",
      clienteId: "cliente-1",
    });
    mockRigaAttivita.update.mockResolvedValue({ id: "riga-1" });

    const fd = creaFormData({
      rigaId: "riga-1",
      offertaId: "offerta-1",
      ore: "5",
      data: "2026-07-01",
    });

    const result = await modificaRiga(fd);

    expect(result.success).toBe(true);
    expect(mockOfferta.findUnique).not.toHaveBeenCalled();
    expect(mockAbilitazioneOfferta.findUnique).not.toHaveBeenCalled();
    expect(mockRigaAttivita.update).toHaveBeenCalledTimes(1);
  });

  it("rifiuta l'aggiornamento del clienteId quando l'offerta resta la stessa ma non gli appartiene (fix regressione)", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-giulia",
      offertaId: "offerta-1",
      clienteId: "cliente-1",
    });

    const fd = creaFormData({
      rigaId: "riga-1",
      offertaId: "offerta-1",
      clienteId: "cliente-2",
      data: "2026-07-01",
    });

    const result = await modificaRiga(fd);

    expect(result).toEqual({
      success: false,
      error: "L'offerta non appartiene al cliente selezionato",
    });
    expect(mockRigaAttivita.update).not.toHaveBeenCalled();
  });

  it("aggiorna il clienteId quando corrisponde al reale proprietario dell'offerta invariata", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-giulia",
      offertaId: "offerta-1",
      clienteId: "cliente-2",
    });
    mockRigaAttivita.update.mockResolvedValue({ id: "riga-1" });

    const fd = creaFormData({
      rigaId: "riga-1",
      offertaId: "offerta-1",
      clienteId: "cliente-1",
      data: "2026-07-01",
    });

    const result = await modificaRiga(fd);

    expect(result.success).toBe(true);
    expect(mockAbilitazioneOfferta.findUnique).not.toHaveBeenCalled();
    const chiamata = mockRigaAttivita.update.mock.calls[0][0];
    expect(chiamata.data.clienteId).toBe("cliente-1");
  });

  it("aggiorna quando cambia verso un'offerta abilitata del cliente", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-giulia",
      offertaId: "offerta-1",
      clienteId: "cliente-1",
    });
    mockRigaAttivita.update.mockResolvedValue({ id: "riga-1" });

    const fd = creaFormData({
      rigaId: "riga-1",
      offertaId: "offerta-2",
      data: "2026-07-01",
    });

    const result = await modificaRiga(fd);

    expect(result.success).toBe(true);
    const chiamata = mockRigaAttivita.update.mock.calls[0][0];
    expect(chiamata.data.offertaId).toBe("offerta-2");
  });

  it("rifiuta il cambio verso un'offerta non abilitata (AC-5)", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-giulia",
      offertaId: "offerta-1",
      clienteId: "cliente-1",
    });
    mockAbilitazioneOfferta.findUnique.mockResolvedValue(null);

    const fd = creaFormData({
      rigaId: "riga-1",
      offertaId: "offerta-3",
      data: "2026-07-01",
    });

    const result = await modificaRiga(fd);

    expect(result).toEqual({
      success: false,
      error: "Non sei abilitato a registrare attività su questa offerta",
    });
    expect(mockRigaAttivita.update).not.toHaveBeenCalled();
  });

  it("rifiuta riga di altro collaboratore", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
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
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
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

  it("restituisce un messaggio per profilo assente", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({ stato: "ASSENTE" });

    const fd = creaFormData({
      rigaId: "riga-1",
      ore: "8",
      data: "2026-07-01",
    });

    const result = await modificaRiga(fd);

    expect(result.success).toBe(false);
    expect(result.error).toContain("profilo Collaboratore");
  });
});

// ═══════════════════════════════════════════════════════════════

describe("eliminaRiga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancella correttamente il record", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique
      // Prima chiamata: caricaRigaDelCollaboratore
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

  it("elimina la riga anche se l'offerta non è più abilitata, senza consultare l'abilitazione (AC-4)", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique
      // Prima chiamata: caricaRigaDelCollaboratore
      .mockResolvedValueOnce({
        collaboratoreId: "collab-giulia",
        offertaId: "offerta-1",
        clienteId: "cliente-1",
      })
      // Seconda chiamata: recupera la data per revalidate
      .mockResolvedValueOnce({ data: new Date(2026, 6, 1) });
    mockAbilitazioneOfferta.findUnique.mockResolvedValue(null);
    mockRigaAttivita.delete.mockResolvedValue({ id: "riga-1" });

    const result = await eliminaRiga("riga-1");

    expect(result.success).toBe(true);
    expect(mockRigaAttivita.delete).toHaveBeenCalledWith({
      where: { id: "riga-1" },
    });
    expect(mockAbilitazioneOfferta.findUnique).not.toHaveBeenCalled();
  });

  it("rifiuta riga di altro collaboratore", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-altro",
    });

    const result = await eliminaRiga("riga-altrui");

    expect(result.success).toBe(false);
    expect(result.error).toContain("altro collaboratore");
    expect(mockRigaAttivita.delete).not.toHaveBeenCalled();
  });

  it("rifiuta riga inesistente", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique.mockResolvedValue(null);

    const result = await eliminaRiga("riga-inesistente");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Riga non trovata");
  });

  it("restituisce un messaggio per profilo assente", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({ stato: "ASSENTE" });

    const result = await eliminaRiga("riga-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("profilo Collaboratore");
  });
});

// ═══════════════════════════════════════════════════════════════

describe("rimuoviTrasferta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imposta trasfertaKm a null sulla riga propria", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique
      .mockResolvedValueOnce({ collaboratoreId: "collab-giulia" })
      .mockResolvedValueOnce({ data: new Date(2026, 6, 1) });
    mockRigaAttivita.update.mockResolvedValue({ id: "riga-1" });

    const result = await rimuoviTrasferta("riga-1");

    expect(result.success).toBe(true);
    expect(mockRigaAttivita.update).toHaveBeenCalledWith({
      where: { id: "riga-1" },
      data: { trasfertaKm: null },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/attivita/2026-07-01");
  });

  it("rifiuta riga di altro collaboratore", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-altro",
    });

    const result = await rimuoviTrasferta("riga-altrui");

    expect(result.success).toBe(false);
    expect(result.error).toContain("altro collaboratore");
    expect(mockRigaAttivita.update).not.toHaveBeenCalled();
  });

  it("rifiuta riga inesistente", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({
      stato: "ATTIVO",
      collaboratore: collaboratoreMock(),
    });
    mockRigaAttivita.findUnique.mockResolvedValue(null);

    const result = await rimuoviTrasferta("riga-inesistente");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Riga non trovata");
  });

  it("restituisce un messaggio per profilo assente", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({ stato: "ASSENTE" });

    const result = await rimuoviTrasferta("riga-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("profilo Collaboratore");
  });
});
