import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  attivitaDelMese,
  clientiAttiviPerSelezione,
  contestoInserimentoPerCollaboratoreAutorizzato,
  datiCalendarioMesePerCollaboratoreAutorizzato,
  offerteAbilitatePerCliente,
  righeDelGiornoPerCollaboratoreAutorizzato,
} from "@/lib/attivita";
import { ErroreAutorizzazione } from "@/lib/dal";

// ── Mock di Prisma ──────────────────────────────────────────────

const mockRigaAttivita = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

const mockOfferta = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

const mockCliente = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

const mockVoceRimborsoTrasferta = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    rigaAttivita: mockRigaAttivita,
    offerta: mockOfferta,
    cliente: mockCliente,
    voceRimborsoTrasferta: mockVoceRimborsoTrasferta,
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
  clienteId = "cliente-1",
  offertaId = "offerta-1",
): unknown {
  return {
    id: `riga-${data.toISOString()}`,
    collaboratoreId: "collab-1",
    clienteId,
    offertaId,
    data,
    ore,
    nota: null,
    fatturabile: true,
    rimborsoTrasfertaImporto: null,
    createdAt: data,
    updatedAt: data,
    offerta: {
      id: offertaId,
      codice: codiceOfferta,
      descrizione: "Consulenza",
      clienteId,
      tariffaGiornaliera: "550.00",
      giorniPrevisti: 40,
      attiva: true,
      createdAt: data,
      updatedAt: data,
    },
    cliente: {
      id: clienteId,
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
      rigaFittizia(new Date(2026, 5, 2), 8, "TS-001", "TechSolutions Srl", "cliente-techsolutions", "offerta-ts-001"),
      rigaFittizia(new Date(2026, 5, 2), 4, "TS-001", "TechSolutions Srl", "cliente-techsolutions", "offerta-ts-001"),
      rigaFittizia(new Date(2026, 5, 2), 2, "DF-001", "DataFlow SpA", "cliente-dataflow", "offerta-df-001"),
    ];
    mockRigaAttivita.findMany.mockResolvedValue(righe);

    const result = await attivitaDelMese("2026-06");

    expect(result.righe.length).toBe(3);
    expect(result.perGiorno.size).toBe(1); // un solo giorno

    const sintesi = result.perGiorno.get("2026-06-02");
    expect(sintesi).toBeDefined();
    expect(sintesi!.righe).toBe(3);
    expect(sintesi!.oreTotali).toBe(14); // 8 + 4 + 2
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

  // ── Sintesi per cliente ──────────────────────────────────────

  it("somma le ore per cliente su più offerte diverse mantenendo invariati righe e ore totali del giorno", async () => {
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
      rigaFittizia(
        new Date(2026, 5, 8),
        4,
        "TS-001",
        "TechSolutions Srl",
        "cliente-1",
        "offerta-1",
      ),
      rigaFittizia(
        new Date(2026, 5, 8),
        2,
        "TS-002",
        "TechSolutions Srl",
        "cliente-1",
        "offerta-2",
      ),
      rigaFittizia(
        new Date(2026, 5, 8),
        3,
        "DF-001",
        "DataFlow SpA",
        "cliente-2",
        "offerta-3",
      ),
    ];
    mockRigaAttivita.findMany.mockResolvedValue(righe);

    const result = await attivitaDelMese("2026-06");
    const sintesi = result.perGiorno.get("2026-06-08");

    expect(sintesi!.righe).toBe(3);
    expect(sintesi!.oreTotali).toBe(9);

    expect(sintesi!.clienti).toHaveLength(2);
    expect(sintesi!.clienti[0]).toEqual({
      clienteId: "cliente-1",
      ragioneSociale: "TechSolutions Srl",
      ore: 6,
    });
    expect(sintesi!.clienti[1]).toEqual({
      clienteId: "cliente-2",
      ragioneSociale: "DataFlow SpA",
      ore: 3,
    });
  });

  it("elenca i clienti del giorno nell'ordine di prima apparizione", async () => {
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
      rigaFittizia(
        new Date(2026, 5, 9),
        2,
        "DF-001",
        "DataFlow SpA",
        "cliente-2",
        "offerta-2",
      ),
      rigaFittizia(
        new Date(2026, 5, 9),
        3,
        "TS-001",
        "TechSolutions Srl",
        "cliente-1",
        "offerta-1",
      ),
      rigaFittizia(
        new Date(2026, 5, 9),
        1,
        "AC-001",
        "Acme Spa",
        "cliente-3",
        "offerta-3",
      ),
    ];
    mockRigaAttivita.findMany.mockResolvedValue(righe);

    const result = await attivitaDelMese("2026-06");
    const sintesi = result.perGiorno.get("2026-06-09");

    expect(sintesi!.clienti.map((c) => c.clienteId)).toEqual([
      "cliente-2",
      "cliente-1",
      "cliente-3",
    ]);
  });

  it("non duplica il cliente quando più righe della stessa offerta ricadono nello stesso giorno", async () => {
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
      rigaFittizia(new Date(2026, 5, 22), 4, "TS-001", "TechSolutions Srl"),
      rigaFittizia(new Date(2026, 5, 22), 2, "TS-001", "TechSolutions Srl"),
    ];
    mockRigaAttivita.findMany.mockResolvedValue(righe);

    const result = await attivitaDelMese("2026-06");
    const sintesi = result.perGiorno.get("2026-06-22");

    expect(sintesi!.clienti).toEqual([
      {
        clienteId: "cliente-1",
        ragioneSociale: "TechSolutions Srl",
        ore: 6,
      },
    ]);
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
    expect(chiamata.orderBy).toEqual([{ data: "asc" }, { createdAt: "asc" }]);
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

// ═══════════════════════════════════════════════════════════════
// US-052 — Lettura specializzata del calendario mensile
// ═══════════════════════════════════════════════════════════════

/** Riga come la restituisce il `select` minimo della lettura calendario. */
function rigaCalendario(
  data: Date,
  ore: number,
  clienteId: string,
  ragioneSociale: string,
  createdAt = data,
) {
  return {
    data,
    ore,
    createdAt,
    cliente: { id: clienteId, ragioneSociale },
  };
}

describe("datiCalendarioMesePerCollaboratoreAutorizzato", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Filtri, proiezione e ordinamento ────────────────────────

  it("filtra per collaboratore autorizzato con intervallo half-open e proiezione minima", async () => {
    mockRigaAttivita.findMany.mockResolvedValue([]);

    await datiCalendarioMesePerCollaboratoreAutorizzato("2026-06", "collab-autorizzato");

    expect(mockRigaAttivita.findMany).toHaveBeenCalledTimes(1);
    const chiamata = mockRigaAttivita.findMany.mock.calls[0][0];

    expect(chiamata.where.collaboratoreId).toBe("collab-autorizzato");

    // Intervallo half-open: [1 giugno 2026, 1 luglio 2026)
    const inizio = chiamata.where.data.gte;
    const fine = chiamata.where.data.lt;
    expect(inizio).toBeInstanceOf(Date);
    expect(fine).toBeInstanceOf(Date);
    expect([inizio.getFullYear(), inizio.getMonth(), inizio.getDate()]).toEqual([
      2026, 5, 1,
    ]);
    expect([fine.getFullYear(), fine.getMonth(), fine.getDate()]).toEqual([
      2026, 6, 1,
    ]);
    // L'estremo superiore è esclusivo: nessun `lte` residuo.
    expect(chiamata.where.data.lte).toBeUndefined();

    // Proiezione minima: nessuna entità Offerta/Cliente caricata per intero.
    expect(chiamata.select).toEqual({
      data: true,
      ore: true,
      createdAt: true,
      cliente: { select: { id: true, ragioneSociale: true } },
    });
    expect(chiamata.include).toBeUndefined();

    // Ordine stabile: data, poi creazione.
    expect(chiamata.orderBy).toEqual([{ data: "asc" }, { createdAt: "asc" }]);
  });

  it("usa il primo giorno del mese successivo come estremo escluso anche a dicembre", async () => {
    mockRigaAttivita.findMany.mockResolvedValue([]);

    await datiCalendarioMesePerCollaboratoreAutorizzato("2026-12", "collab-1");

    const fine = mockRigaAttivita.findMany.mock.calls[0][0].where.data.lt;
    expect([fine.getFullYear(), fine.getMonth(), fine.getDate()]).toEqual([
      2027, 0, 1,
    ]);
  });

  it("non accetta l'id dal chiamante per aggirare il filtro: l'id ricevuto è l'unico usato", async () => {
    mockRigaAttivita.findMany.mockResolvedValue([]);

    await datiCalendarioMesePerCollaboratoreAutorizzato("2026-06", "collab-solo-questo");

    const chiamata = mockRigaAttivita.findMany.mock.calls[0][0];
    expect(chiamata.where.collaboratoreId).toBe("collab-solo-questo");
    expect(Object.keys(chiamata.where)).toEqual(["collaboratoreId", "data"]);
  });

  // ── Token non valido ─────────────────────────────────────────

  it("restituisce un mese vuoto senza interrogare il DB se il token non è valido", async () => {
    const risultato = await datiCalendarioMesePerCollaboratoreAutorizzato(
      "non-valido",
      "collab-1",
    );

    expect(risultato).toEqual({
      token: "non-valido",
      collaboratoreId: "collab-1",
      sintesiPerGiorno: {},
    });
    expect(mockRigaAttivita.findMany).not.toHaveBeenCalled();
  });

  it("restituisce un mese vuoto quando il collaboratore non ha righe", async () => {
    mockRigaAttivita.findMany.mockResolvedValue([]);

    const risultato = await datiCalendarioMesePerCollaboratoreAutorizzato(
      "2026-06",
      "collab-1",
    );

    expect(risultato).toEqual({
      token: "2026-06",
      collaboratoreId: "collab-1",
      sintesiPerGiorno: {},
    });
  });

  // ── Aggregazione osservabile sul DTO ────────────────────────

  it("somma le ore dello stesso cliente su più offerte e conta le righe del giorno", async () => {
    mockRigaAttivita.findMany.mockResolvedValue([
      rigaCalendario(new Date(2026, 5, 2), 8, "cliente-ts", "TechSolutions Srl"),
      rigaCalendario(new Date(2026, 5, 2), 4, "cliente-ts", "TechSolutions Srl"),
    ]);

    const { sintesiPerGiorno } = await datiCalendarioMesePerCollaboratoreAutorizzato(
      "2026-06",
      "collab-1",
    );

    expect(sintesiPerGiorno["2026-06-02"]).toEqual({
      data: "2026-06-02",
      righe: 2,
      oreTotali: 12,
      clienti: [
        { clienteId: "cliente-ts", ragioneSociale: "TechSolutions Srl", ore: 12 },
      ],
    });
  });

  it("mantiene i clienti in ordine di prima apparizione nel giorno", async () => {
    mockRigaAttivita.findMany.mockResolvedValue([
      rigaCalendario(new Date(2026, 5, 3), 2, "cliente-df", "DataFlow SpA"),
      rigaCalendario(new Date(2026, 5, 3), 5, "cliente-ts", "TechSolutions Srl"),
      rigaCalendario(new Date(2026, 5, 3), 1, "cliente-df", "DataFlow SpA"),
    ]);

    const { sintesiPerGiorno } = await datiCalendarioMesePerCollaboratoreAutorizzato(
      "2026-06",
      "collab-1",
    );

    const giorno = sintesiPerGiorno["2026-06-03"];
    expect(giorno.righe).toBe(3);
    expect(giorno.oreTotali).toBe(8);
    expect(giorno.clienti).toEqual([
      { clienteId: "cliente-df", ragioneSociale: "DataFlow SpA", ore: 3 },
      { clienteId: "cliente-ts", ragioneSociale: "TechSolutions Srl", ore: 5 },
    ]);
  });

  it("indicizza più giorni distinti per data YYYY-MM-DD", async () => {
    mockRigaAttivita.findMany.mockResolvedValue([
      rigaCalendario(new Date(2026, 5, 1), 6, "cliente-ts", "TechSolutions Srl"),
      rigaCalendario(new Date(2026, 5, 15), 3.5, "cliente-df", "DataFlow SpA"),
      rigaCalendario(new Date(2026, 5, 30), 8, "cliente-ts", "TechSolutions Srl"),
    ]);

    const { token, sintesiPerGiorno } =
      await datiCalendarioMesePerCollaboratoreAutorizzato("2026-06", "collab-1");

    expect(token).toBe("2026-06");
    expect(Object.keys(sintesiPerGiorno)).toEqual([
      "2026-06-01",
      "2026-06-15",
      "2026-06-30",
    ]);
    expect(sintesiPerGiorno["2026-06-15"].oreTotali).toBe(3.5);
  });

  it("produce per il calendario la stessa sintesi di attivitaDelMese sugli stessi dati", async () => {
    const righeComplete = [
      rigaFittizia(new Date(2026, 5, 4), 7.25, "TS-001", "TechSolutions Srl", "cliente-ts", "offerta-a"),
      rigaFittizia(new Date(2026, 5, 4), 3.75, "TS-002", "TechSolutions Srl", "cliente-ts", "offerta-b"),
      rigaFittizia(new Date(2026, 5, 4), 2, "DF-001", "DataFlow SpA", "cliente-df", "offerta-c"),
    ];

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
    mockRigaAttivita.findMany.mockResolvedValue(righeComplete);
    const riferimento = await attivitaDelMese("2026-06");

    mockRigaAttivita.findMany.mockResolvedValue(
      righeComplete.map((riga) => {
        const completa = riga as {
          data: Date;
          ore: number;
          createdAt: Date;
          cliente: { id: string; ragioneSociale: string };
        };
        return rigaCalendario(
          completa.data,
          completa.ore,
          completa.cliente.id,
          completa.cliente.ragioneSociale,
          completa.createdAt,
        );
      }),
    );
    const { sintesiPerGiorno } = await datiCalendarioMesePerCollaboratoreAutorizzato(
      "2026-06",
      "collab-1",
    );

    expect(sintesiPerGiorno).toEqual(Object.fromEntries(riferimento.perGiorno));
  });
});

describe("offerteAbilitatePerCliente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("interroga il DB filtrando su clienteId, offerte attive e abilitazione del collaboratore corrente", async () => {
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

    const offerteAttese = [
      { id: "offerta-1", codice: "TS-001", descrizione: "Consulenza" },
    ];
    mockOfferta.findMany.mockResolvedValue(offerteAttese);

    const result = await offerteAbilitatePerCliente("cliente-techsolutions");

    expect(mockOfferta.findMany).toHaveBeenCalledTimes(1);
    expect(mockOfferta.findMany).toHaveBeenCalledWith({
      where: {
        clienteId: "cliente-techsolutions",
        attiva: true,
        abilitazioniCollaboratori: {
          some: { collaboratoreId: "collab-giulia" },
        },
      },
      select: {
        id: true,
        codice: true,
        descrizione: true,
      },
      orderBy: { codice: "asc" },
    });
    expect(result).toBe(offerteAttese);
  });

  it("lancia ErroreAutorizzazione se non c'è un collaboratore corrente", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(null);

    await expect(
      offerteAbilitatePerCliente("cliente-techsolutions")
    ).rejects.toBeInstanceOf(ErroreAutorizzazione);
    expect(mockOfferta.findMany).not.toHaveBeenCalled();
  });
});

describe("clientiAttiviPerSelezione", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("interroga il DB filtrando sui clienti attivi con almeno un'offerta attiva abilitata per il collaboratore corrente", async () => {
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

    const clientiAttesi = [
      { id: "cliente-techsolutions", ragioneSociale: "TechSolutions" },
    ];
    mockCliente.findMany.mockResolvedValue(clientiAttesi);

    const result = await clientiAttiviPerSelezione();

    expect(mockCliente.findMany).toHaveBeenCalledTimes(1);
    expect(mockCliente.findMany).toHaveBeenCalledWith({
      where: {
        attivo: true,
        offerte: {
          some: {
            attiva: true,
            abilitazioniCollaboratori: {
              some: { collaboratoreId: "collab-giulia" },
            },
          },
        },
      },
      select: {
        id: true,
        ragioneSociale: true,
      },
      orderBy: { ragioneSociale: "asc" },
    });
    expect(result).toBe(clientiAttesi);
  });

  it("lancia ErroreAutorizzazione se non c'è un collaboratore corrente", async () => {
    mockRichiediCollaboratoreCorrente.mockResolvedValue(null);

    await expect(clientiAttiviPerSelezione()).rejects.toBeInstanceOf(
      ErroreAutorizzazione
    );
    expect(mockCliente.findMany).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// US-056 — Letture della giornata e del contesto di inserimento
//
// Entrambe ricevono l'id del collaboratore **già autorizzato** dal chiamante:
// non risolvono la sessione e non sono guardie. I test qui sotto asseriscono
// il payload Prisma esatto e il DTO restituito.
// ═══════════════════════════════════════════════════════════════

/** Riga come la restituisce l'`include` della lettura della giornata. */
function rigaConContesto(
  modifiche: {
    id?: string;
    data?: Date;
    ore?: { toString: () => string };
    nota?: string | null;
    fatturabile?: boolean;
    rimborsoTrasfertaEtichetta?: string | null;
    rimborsoTrasfertaImporto?: { toString: () => string } | null;
    createdAt?: Date;
    clienteId?: string;
    ragioneSociale?: string;
    offertaId?: string;
    codiceOfferta?: string;
    descrizioneOfferta?: string;
  } = {},
) {
  const data = modifiche.data ?? new Date(2026, 5, 10);
  const clienteId = modifiche.clienteId ?? "cliente-techsolutions";
  const offertaId = modifiche.offertaId ?? "offerta-ts-001";
  return {
    id: modifiche.id ?? "riga-1",
    collaboratoreId: "collab-autorizzato",
    clienteId,
    offertaId,
    data,
    // Simula il Decimal Prisma con un oggetto dotato di toString()
    ore: modifiche.ore ?? { toString: () => "7.25" },
    nota: modifiche.nota ?? null,
    fatturabile: modifiche.fatturabile ?? true,
    rimborsoTrasfertaEtichetta: modifiche.rimborsoTrasfertaEtichetta ?? null,
    rimborsoTrasfertaImporto: modifiche.rimborsoTrasfertaImporto ?? null,
    createdAt: modifiche.createdAt ?? data,
    updatedAt: data,
    offerta: {
      id: offertaId,
      codice: modifiche.codiceOfferta ?? "TS-001",
      descrizione: modifiche.descrizioneOfferta ?? "Consulenza",
      clienteId,
      tariffaGiornaliera: { toString: () => "550.00" },
      giorniPrevisti: 40,
      attiva: true,
      createdAt: data,
      updatedAt: data,
    },
    cliente: {
      id: clienteId,
      ragioneSociale: modifiche.ragioneSociale ?? "TechSolutions Srl",
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

describe("righeDelGiornoPerCollaboratoreAutorizzato", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Filtri, proiezione e ordinamento ────────────────────────

  it("filtra per il collaboratore ricevuto e per l'intervallo del giorno, ordinando per creazione crescente", async () => {
    mockRigaAttivita.findMany.mockResolvedValue([]);

    await righeDelGiornoPerCollaboratoreAutorizzato("2026-06-10", "collab-autorizzato");

    expect(mockRigaAttivita.findMany).toHaveBeenCalledTimes(1);
    expect(mockRigaAttivita.findMany).toHaveBeenCalledWith({
      where: {
        collaboratoreId: "collab-autorizzato",
        data: {
          gte: new Date(2026, 5, 10),
          lte: new Date(2026, 5, 10, 23, 59, 59, 999),
        },
      },
      include: {
        offerta: true,
        cliente: true,
      },
      orderBy: { createdAt: "asc" },
    });
  });

  it("non accetta l'id dal chiamante per aggirare il filtro: l'id ricevuto è l'unico usato", async () => {
    mockRigaAttivita.findMany.mockResolvedValue([]);

    const risultato = await righeDelGiornoPerCollaboratoreAutorizzato(
      "2026-06-10",
      "collab-solo-questo",
    );

    const chiamata = mockRigaAttivita.findMany.mock.calls[0][0];
    expect(chiamata.where.collaboratoreId).toBe("collab-solo-questo");
    expect(Object.keys(chiamata.where)).toEqual(["collaboratoreId", "data"]);
    expect(risultato.collaboratoreId).toBe("collab-solo-questo");
  });

  it("non risolve alcuna sessione: l'autorizzazione resta al chiamante", async () => {
    mockRigaAttivita.findMany.mockResolvedValue([]);

    await righeDelGiornoPerCollaboratoreAutorizzato("2026-06-10", "collab-autorizzato");

    expect(mockRichiediCollaboratoreCorrente).not.toHaveBeenCalled();
  });

  // ── DTO restituito ──────────────────────────────────────────

  it("serializza le righe della giornata nel DTO del client mantenendo l'ordine di lettura", async () => {
    mockRigaAttivita.findMany.mockResolvedValue([
      rigaConContesto({
        id: "riga-mattina",
        ore: { toString: () => "4.5" },
        nota: "Analisi requisiti",
        rimborsoTrasfertaEtichetta: "Pranzo",
        rimborsoTrasfertaImporto: { toString: () => "12.50" },
      }),
      rigaConContesto({
        id: "riga-pomeriggio",
        ore: { toString: () => "3" },
        fatturabile: false,
        clienteId: "cliente-dataflow",
        ragioneSociale: "DataFlow SpA",
        offertaId: "offerta-df-001",
        codiceOfferta: "DF-001",
        descrizioneOfferta: "Formazione",
      }),
    ]);

    const risultato = await righeDelGiornoPerCollaboratoreAutorizzato(
      "2026-06-10",
      "collab-autorizzato",
    );

    expect(risultato).toEqual({
      data: "2026-06-10",
      collaboratoreId: "collab-autorizzato",
      righe: [
        {
          id: "riga-mattina",
          data: "2026-06-10",
          ore: 4.5,
          nota: "Analisi requisiti",
          fatturabile: true,
          rimborsoTrasfertaEtichetta: "Pranzo",
          rimborsoTrasfertaImporto: "12.50",
          offerta: {
            id: "offerta-ts-001",
            codice: "TS-001",
            descrizione: "Consulenza",
          },
          cliente: {
            id: "cliente-techsolutions",
            ragioneSociale: "TechSolutions Srl",
          },
        },
        {
          id: "riga-pomeriggio",
          data: "2026-06-10",
          ore: 3,
          nota: null,
          fatturabile: false,
          rimborsoTrasfertaEtichetta: null,
          rimborsoTrasfertaImporto: null,
          offerta: {
            id: "offerta-df-001",
            codice: "DF-001",
            descrizione: "Formazione",
          },
          cliente: {
            id: "cliente-dataflow",
            ragioneSociale: "DataFlow SpA",
          },
        },
      ],
    });
  });

  it("restituisce una giornata vuota quando il collaboratore non ha righe", async () => {
    mockRigaAttivita.findMany.mockResolvedValue([]);

    const risultato = await righeDelGiornoPerCollaboratoreAutorizzato(
      "2026-06-10",
      "collab-autorizzato",
    );

    expect(risultato).toEqual({
      data: "2026-06-10",
      collaboratoreId: "collab-autorizzato",
      righe: [],
    });
  });

  // ── Data non valida ─────────────────────────────────────────

  it("restituisce una giornata vuota senza interrogare il DB se la data non è nel formato YYYY-MM-DD", async () => {
    const risultato = await righeDelGiornoPerCollaboratoreAutorizzato(
      "10-06-2026",
      "collab-autorizzato",
    );

    expect(risultato).toEqual({
      data: "10-06-2026",
      collaboratoreId: "collab-autorizzato",
      righe: [],
    });
    expect(mockRigaAttivita.findMany).not.toHaveBeenCalled();
    expect(mockRichiediCollaboratoreCorrente).not.toHaveBeenCalled();
  });

  it("restituisce una giornata vuota senza interrogare il DB se il giorno non esiste nel calendario", async () => {
    const risultato = await righeDelGiornoPerCollaboratoreAutorizzato(
      "2026-02-30",
      "collab-autorizzato",
    );

    expect(risultato).toEqual({
      data: "2026-02-30",
      collaboratoreId: "collab-autorizzato",
      righe: [],
    });
    expect(mockRigaAttivita.findMany).not.toHaveBeenCalled();
  });
});

describe("contestoInserimentoPerCollaboratoreAutorizzato", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCliente.findMany.mockResolvedValue([]);
    mockVoceRimborsoTrasferta.findMany.mockResolvedValue([]);
  });

  // ── Payload Prisma delle due letture ────────────────────────

  it("interroga i clienti attivi con almeno un'offerta attiva abilitata per il collaboratore ricevuto", async () => {
    await contestoInserimentoPerCollaboratoreAutorizzato("collab-autorizzato");

    expect(mockCliente.findMany).toHaveBeenCalledTimes(1);
    expect(mockCliente.findMany).toHaveBeenCalledWith({
      where: {
        attivo: true,
        offerte: {
          some: {
            attiva: true,
            abilitazioniCollaboratori: {
              some: { collaboratoreId: "collab-autorizzato" },
            },
          },
        },
      },
      select: {
        id: true,
        ragioneSociale: true,
      },
      orderBy: { ragioneSociale: "asc" },
    });
  });

  it("legge le voci di rimborso trasferta ordinate per data di creazione crescente", async () => {
    await contestoInserimentoPerCollaboratoreAutorizzato("collab-autorizzato");

    expect(mockVoceRimborsoTrasferta.findMany).toHaveBeenCalledTimes(1);
    expect(mockVoceRimborsoTrasferta.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "asc" },
    });
  });

  it("non risolve alcuna sessione: l'autorizzazione resta al chiamante", async () => {
    await contestoInserimentoPerCollaboratoreAutorizzato("collab-autorizzato");

    expect(mockRichiediCollaboratoreCorrente).not.toHaveBeenCalled();
  });

  // ── DTO restituito ──────────────────────────────────────────

  it("restituisce clienti e voci in un solo DTO, con l'importo convertito in stringa e l'identità ricevuta", async () => {
    mockCliente.findMany.mockResolvedValue([
      { id: "cliente-dataflow", ragioneSociale: "DataFlow SpA" },
      { id: "cliente-techsolutions", ragioneSociale: "TechSolutions Srl" },
    ]);
    mockVoceRimborsoTrasferta.findMany.mockResolvedValue([
      {
        id: "voce-pranzo",
        etichetta: "Pranzo",
        // Simula il Decimal Prisma con un oggetto dotato di toString()
        importo: { toString: () => "12.50" },
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1),
      },
      {
        id: "voce-pernotto",
        etichetta: "Pernottamento",
        importo: { toString: () => "80.00" },
        createdAt: new Date(2026, 0, 2),
        updatedAt: new Date(2026, 0, 2),
      },
    ]);

    const risultato = await contestoInserimentoPerCollaboratoreAutorizzato(
      "collab-solo-questo",
    );

    expect(risultato).toEqual({
      collaboratoreId: "collab-solo-questo",
      clienti: [
        { id: "cliente-dataflow", ragioneSociale: "DataFlow SpA" },
        { id: "cliente-techsolutions", ragioneSociale: "TechSolutions Srl" },
      ],
      vociRimborso: [
        { id: "voce-pranzo", etichetta: "Pranzo", importo: "12.50" },
        { id: "voce-pernotto", etichetta: "Pernottamento", importo: "80.00" },
      ],
    });
  });

  it("restituisce liste vuote senza fallire quando non ci sono clienti né voci", async () => {
    const risultato = await contestoInserimentoPerCollaboratoreAutorizzato(
      "collab-autorizzato",
    );

    expect(risultato).toEqual({
      collaboratoreId: "collab-autorizzato",
      clienti: [],
      vociRimborso: [],
    });
  });
});
