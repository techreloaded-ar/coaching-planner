import { describe, it, expect, vi, beforeEach } from "vitest";
import { attivitaDelMese } from "@/lib/attivita";

// ── Mock di Prisma ──────────────────────────────────────────────

const mockRigaAttivita = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    rigaAttivita: mockRigaAttivita,
  },
}));

// ── Mock del DAL (solo richiediCollaboratoreCorrente) ────────────

const mockRichiediCollaboratoreCorrente = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dal")>();
  return {
    ...actual,
    richiediCollaboratoreCorrente: mockRichiediCollaboratoreCorrente,
  };
});

// ═══════════════════════════════════════════════════════════════
// Helper: costruisce una RigaAttivita fittizia
// ═══════════════════════════════════════════════════════════════

function rigaFittizia(
  data: Date,
  ore: number,
  codiceOfferta: string,
  ragioneSociale: string,
): unknown {
  return {
    id: `riga-${data.toISOString()}`,
    collaboratoreId: "collab-1",
    clienteId: "cliente-1",
    offertaId: "offerta-1",
    data,
    ore,
    nota: null,
    fatturabile: true,
    trasfertaKm: null,
    createdAt: data,
    updatedAt: data,
    offerta: {
      id: "offerta-1",
      codice: codiceOfferta,
      descrizione: "Consulenza",
      clienteId: "cliente-1",
      tariffaGiornaliera: "550.00",
      giorniPrevisti: 40,
      attiva: true,
      createdAt: data,
      updatedAt: data,
    },
    cliente: {
      id: "cliente-1",
      ragioneSociale,
      partitaIva: null,
      codiceFiscale: null,
      indirizzo: null,
      citta: null,
      cap: null,
      provincia: null,
      pec: null,
      codiceDestinatario: null,
      attivo: true,
      createdAt: data,
      updatedAt: data,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// Test
// ═══════════════════════════════════════════════════════════════

describe("attivitaDelMese", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Risultato vuoto ─────────────────────────────────────────

  it("restituisce risultato vuoto per token invalido", async () => {
    const result = await attivitaDelMese("non-valido");
    expect(result.righe).toEqual([]);
    expect(result.perGiorno.size).toBe(0);
  });

  it("non esegue query di attività se il profilo non è operativo", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(null);

    const result = await attivitaDelMese("2026-06");
    expect(result.righe).toEqual([]);
    expect(result.perGiorno.size).toBe(0);
    expect(mockRigaAttivita.findMany).not.toHaveBeenCalled();
  });

  // ── Filtro sull'intervallo del mese ─────────────────────────

  it("interroga il DB con l'intervallo corretto del mese", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue({
      id: "collab-1",
      userId: "user-1",
      nome: "Giulia",
      cognome: "Conti",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "350.00",
      attivo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRigaAttivita.findMany.mockResolvedValue([]);

    await attivitaDelMese("2026-06");

    // Verifica i parametri della query
    expect(mockRigaAttivita.findMany).toHaveBeenCalledTimes(1);
    const chiamata = mockRigaAttivita.findMany.mock.calls[0][0];

    // Filtro sul collaboratoreId
    expect(chiamata.where.collaboratoreId).toBe("collab-1");

    // Intervallo del mese: 1 giugno 2026 → 30 giugno 2026
    const inizio = chiamata.where.data.gte;
    const fine = chiamata.where.data.lte;
    expect(inizio).toBeInstanceOf(Date);
    expect(fine).toBeInstanceOf(Date);
    expect(inizio.getFullYear()).toBe(2026);
    expect(inizio.getMonth()).toBe(5); // 0-based, giugno
    expect(inizio.getDate()).toBe(1);
    expect(fine.getFullYear()).toBe(2026);
    expect(fine.getMonth()).toBe(5);
    expect(fine.getDate()).toBe(30);
  });

  it("interroga con l'intervallo corretto per un mese di 31 giorni", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue({
      id: "collab-1",
      userId: "user-1",
      nome: "Giulia",
      cognome: "Conti",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "350.00",
      attivo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRigaAttivita.findMany.mockResolvedValue([]);

    await attivitaDelMese("2026-01");

    const chiamata = mockRigaAttivita.findMany.mock.calls[0][0];
    const fine = chiamata.where.data.lte;
    expect(fine.getDate()).toBe(31);
  });

  it("interroga con l'intervallo corretto per febbraio bisestile", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue({
      id: "collab-1",
      userId: "user-1",
      nome: "Giulia",
      cognome: "Conti",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "350.00",
      attivo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRigaAttivita.findMany.mockResolvedValue([]);

    await attivitaDelMese("2024-02");

    const chiamata = mockRigaAttivita.findMany.mock.calls[0][0];
    const fine = chiamata.where.data.lte;
    expect(fine.getDate()).toBe(29);
  });

  // ── Aggregazione per giorno ─────────────────────────────────

  it("aggrega correttamente più righe nello stesso giorno", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue({
      id: "collab-1",
      userId: "user-1",
      nome: "Giulia",
      cognome: "Conti",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "350.00",
      attivo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const righe = [
      rigaFittizia(new Date(2026, 5, 2), 8, "TS-001", "TechSolutions Srl"),
      rigaFittizia(new Date(2026, 5, 2), 4, "TS-001", "TechSolutions Srl"),
      rigaFittizia(new Date(2026, 5, 2), 2, "DF-001", "DataFlow SpA"),
    ];
    mockRigaAttivita.findMany.mockResolvedValue(righe);

    const result = await attivitaDelMese("2026-06");

    expect(result.righe.length).toBe(3);
    expect(result.perGiorno.size).toBe(1); // un solo giorno

    const sintesi = result.perGiorno.get("2026-06-02");
    expect(sintesi).toBeDefined();
    expect(sintesi!.righe).toBe(3);
    expect(sintesi!.oreTotali).toBe(14); // 8 + 4 + 2
    expect(sintesi!.codici).toEqual(["TS-001", "DF-001"]);
  });

  it("aggrega correttamente giorni diversi", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue({
      id: "collab-1",
      userId: "user-1",
      nome: "Giulia",
      cognome: "Conti",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "350.00",
      attivo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const righe = [
      rigaFittizia(new Date(2026, 5, 2), 8, "TS-001", "TechSolutions Srl"),
      rigaFittizia(new Date(2026, 5, 3), 6.5, "TS-001", "TechSolutions Srl"),
      rigaFittizia(new Date(2026, 5, 4), 7, "DF-001", "DataFlow SpA"),
      rigaFittizia(new Date(2026, 5, 5), 4, "TS-001", "TechSolutions Srl"),
    ];
    mockRigaAttivita.findMany.mockResolvedValue(righe);

    const result = await attivitaDelMese("2026-06");

    expect(result.righe.length).toBe(4);
    expect(result.perGiorno.size).toBe(4);

    const g2 = result.perGiorno.get("2026-06-02");
    expect(g2!.righe).toBe(1);
    expect(g2!.oreTotali).toBe(8);

    const g3 = result.perGiorno.get("2026-06-03");
    expect(g3!.righe).toBe(1);
    expect(g3!.oreTotali).toBe(6.5);

    const g4 = result.perGiorno.get("2026-06-04");
    expect(g4!.righe).toBe(1);
    expect(g4!.oreTotali).toBe(7);

    const g5 = result.perGiorno.get("2026-06-05");
    expect(g5!.righe).toBe(1);
    expect(g5!.oreTotali).toBe(4);
  });

  it("i codici offerta sono distinti e senza duplicati", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue({
      id: "collab-1",
      userId: "user-1",
      nome: "Giulia",
      cognome: "Conti",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "350.00",
      attivo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const righe = [
      rigaFittizia(new Date(2026, 5, 15), 4, "TS-001", "TechSolutions"),
      rigaFittizia(new Date(2026, 5, 15), 4, "TS-001", "TechSolutions"),
      rigaFittizia(new Date(2026, 5, 15), 2, "TS-001", "TechSolutions"),
    ];
    mockRigaAttivita.findMany.mockResolvedValue(righe);

    const result = await attivitaDelMese("2026-06");
    const sintesi = result.perGiorno.get("2026-06-15");
    // TS-001 deve apparire una sola volta
    expect(sintesi!.codici).toEqual(["TS-001"]);
  });

  // ── Segregazione: il filtro è sul collaboratoreId della sessione ──

  it("filtra le attività dell'amministratore collegato al suo solo profilo", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue({
      id: "collab-admin",
      userId: "admin-1",
      nome: "Admin",
      cognome: "Operativo",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "350.00",
      attivo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRigaAttivita.findMany.mockResolvedValue([]);

    await attivitaDelMese("2026-06");

    expect(mockRigaAttivita.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ collaboratoreId: "collab-admin" }),
      })
    );
  });

  it("filtra sempre sul collaboratoreId della sessione, non su altri", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue({
      id: "collab-giulia",
      userId: "user-giulia",
      nome: "Giulia",
      cognome: "Conti",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "350.00",
      attivo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRigaAttivita.findMany.mockResolvedValue([]);

    await attivitaDelMese("2026-06");

    // Il filtro deve usare l'id del collaboratore della sessione
    expect(mockRigaAttivita.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          collaboratoreId: "collab-giulia",
        }),
      })
    );
  });

  // ── Include offerta e cliente ───────────────────────────────

  it("include offerta e cliente nella query", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue({
      id: "collab-1",
      userId: "user-1",
      nome: "Giulia",
      cognome: "Conti",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "350.00",
      attivo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRigaAttivita.findMany.mockResolvedValue([]);

    await attivitaDelMese("2026-06");

    const chiamata = mockRigaAttivita.findMany.mock.calls[0][0];
    expect(chiamata.include).toEqual({
      offerta: true,
      cliente: true,
    });
  });

  // ── Ordine per data crescente ───────────────────────────────

  it("ordina le righe per data crescente", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue({
      id: "collab-1",
      userId: "user-1",
      nome: "Giulia",
      cognome: "Conti",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "350.00",
      attivo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRigaAttivita.findMany.mockResolvedValue([]);

    await attivitaDelMese("2026-06");

    const chiamata = mockRigaAttivita.findMany.mock.calls[0][0];
    expect(chiamata.orderBy).toEqual({ data: "asc" });
  });

  // ── Ore con decimali ────────────────────────────────────────

  it("gestisce correttamente ore con decimali", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue({
      id: "collab-1",
      userId: "user-1",
      nome: "Giulia",
      cognome: "Conti",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "350.00",
      attivo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const righe = [
      rigaFittizia(new Date(2026, 5, 10), 7.25, "TS-001", "TechSolutions"),
      rigaFittizia(new Date(2026, 5, 10), 3.75, "TS-001", "TechSolutions"),
    ];
    mockRigaAttivita.findMany.mockResolvedValue(righe);

    const result = await attivitaDelMese("2026-06");
    const sintesi = result.perGiorno.get("2026-06-10");
    expect(sintesi!.oreTotali).toBe(11.0); // 7.25 + 3.75 = 11.0
  });
});
