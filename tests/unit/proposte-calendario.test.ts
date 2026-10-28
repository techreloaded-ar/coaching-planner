import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockEventi, mockAssocia, mockDecifra } = vi.hoisted(() => ({
  mockDb: {
    collegamentoCalendarioGoogle: { findUnique: vi.fn() },
    eventoCalendarioGestito: { findMany: vi.fn() },
    offerta: { findMany: vi.fn() },
  },
  mockEventi: vi.fn(),
  mockAssocia: vi.fn(),
  mockDecifra: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/calendario-google", () => ({ eventiAttornoAlGiorno: mockEventi }));
vi.mock("@/lib/jev", () => ({ analizzaEventiCalendario: mockAssocia }));
vi.mock("@/lib/cifratura-token", () => ({ decifraToken: mockDecifra }));

import {
  calendarioCollegato,
  proposteCalendarioPerCollaboratoreAutorizzato,
} from "@/lib/proposte-calendario";

const GIORNO = "2026-10-21";

const OFFERTA_ACME = {
  id: "off-acme",
  codice: "ACME-01",
  descrizione: "Coaching agile",
  attiva: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  cliente: { id: "cli-acme", ragioneSociale: "Acme Spa" },
};

function eventoGoogle(id: string, summary: string, ora: string) {
  return {
    id,
    summary,
    start: { dateTime: `${GIORNO}T${ora}:00+02:00` },
    end: { dateTime: `${GIORNO}T${ora.replace(/^(\d\d)/, (h) => String(Number(h) + 1).padStart(2, "0"))}:00+02:00` },
  };
}

describe("proposteCalendarioPerCollaboratoreAutorizzato", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockDb.collegamentoCalendarioGoogle.findUnique.mockResolvedValue({
      refreshTokenCifrato: "cifrato",
    });
    mockDecifra.mockReturnValue("refresh-token");
    mockDb.eventoCalendarioGestito.findMany.mockResolvedValue([]);
    mockDb.offerta.findMany.mockResolvedValue([OFFERTA_ACME]);
    mockAssocia.mockResolvedValue({ associazioni: new Map(), nonLavorativi: new Set() });
  });

  it("senza collegamento non contatta Google né Jev (US-002 AC-6)", async () => {
    mockDb.collegamentoCalendarioGoogle.findUnique.mockResolvedValue(null);

    const risultato = await proposteCalendarioPerCollaboratoreAutorizzato(GIORNO, "collab-1");

    expect(risultato).toEqual({ stato: "NON_COLLEGATO", proposte: [] });
    expect(mockEventi).not.toHaveBeenCalled();
    expect(mockAssocia).not.toHaveBeenCalled();
  });

  it("legge il calendario del solo collaboratore indicato (US-002 AC-7)", async () => {
    mockEventi.mockResolvedValue([]);

    await proposteCalendarioPerCollaboratoreAutorizzato(GIORNO, "collab-1");

    expect(mockDb.collegamentoCalendarioGoogle.findUnique).toHaveBeenCalledWith({
      where: { collaboratoreId: "collab-1" },
      select: { refreshTokenCifrato: true },
    });
    expect(mockEventi).toHaveBeenCalledWith("refresh-token", GIORNO);
  });

  it("traduce un calendario illeggibile nello stato ERRORE (US-002 AC-5)", async () => {
    mockEventi.mockRejectedValue(new Error("invalid_grant"));

    expect(await proposteCalendarioPerCollaboratoreAutorizzato(GIORNO, "collab-1")).toEqual({
      stato: "ERRORE",
      proposte: [],
    });
  });

  it("tratta un token non decifrabile come calendario da ricollegare", async () => {
    mockDecifra.mockImplementation(() => {
      throw new Error("Token cifrato non valido");
    });

    expect((await proposteCalendarioPerCollaboratoreAutorizzato(GIORNO, "collab-1")).stato).toBe(
      "ERRORE"
    );
  });

  it("associa le proposte con Jev sulle offerte abilitate, comprese le chiuse", async () => {
    mockEventi.mockResolvedValue([
      eventoGoogle("ev-acme", "Kickoff Acme", "09:00"),
      eventoGoogle("ev-pranzo", "Pausa pranzo", "13:00"),
    ]);
    mockAssocia.mockResolvedValue({
      associazioni: new Map([["ev-acme", "off-acme"]]),
      nonLavorativi: new Set(),
    });

    const risultato = await proposteCalendarioPerCollaboratoreAutorizzato(GIORNO, "collab-1");

    expect(mockAssocia).toHaveBeenCalledTimes(1);
    expect(mockDb.offerta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cliente: { attivo: true },
          abilitazioniCollaboratori: { some: { collaboratoreId: "collab-1" } },
        },
      })
    );
    expect(risultato).toEqual({
      stato: "COLLEGATO",
      proposte: [
        {
          eventoId: "ev-acme",
          titolo: "Kickoff Acme",
          inizio: "09:00",
          fine: "10:00",
          ore: 1,
          cliente: { id: "cli-acme", ragioneSociale: "Acme Spa" },
          offerta: { id: "off-acme", codice: "ACME-01", descrizione: "Coaching agile" },
        },
        {
          eventoId: "ev-pranzo",
          titolo: "Pausa pranzo",
          inizio: "13:00",
          fine: "14:00",
          ore: 1,
          cliente: null,
          offerta: null,
        },
      ],
    });
  });

  it("esclude gli eventi già gestiti e non chiama Jev se non resta nulla (US-004 AC-5)", async () => {
    mockEventi.mockResolvedValue([eventoGoogle("ev-gestito", "Call", "09:00")]);
    mockDb.eventoCalendarioGestito.findMany.mockResolvedValue([
      { eventoCalendarioId: "ev-gestito" },
    ]);

    const risultato = await proposteCalendarioPerCollaboratoreAutorizzato(GIORNO, "collab-1");

    expect(mockDb.eventoCalendarioGestito.findMany).toHaveBeenCalledWith({
      where: { collaboratoreId: "collab-1", eventoCalendarioId: { in: ["ev-gestito"] } },
      select: { eventoCalendarioId: true },
    });
    expect(risultato).toEqual({ stato: "COLLEGATO", proposte: [] });
    expect(mockAssocia).not.toHaveBeenCalled();
  });
});

describe("proposteCalendarioPerCollaboratoreAutorizzato con l'analisi di Jev", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.collegamentoCalendarioGoogle.findUnique.mockResolvedValue({
      refreshTokenCifrato: "cifrato",
    });
    mockDecifra.mockReturnValue("refresh-token");
    mockDb.eventoCalendarioGestito.findMany.mockResolvedValue([]);
    mockDb.offerta.findMany.mockResolvedValue([OFFERTA_ACME]);
  });

  it("passa a Jev la giornata e le offerte, senza righe di esempio, ed esclude i non lavorativi", async () => {
    mockEventi.mockResolvedValue([
      eventoGoogle("ev-sync", "Sync settimanale", "09:00"),
      eventoGoogle("ev-palestra", "Palestra", "13:00"),
    ]);
    mockAssocia.mockResolvedValue({
      associazioni: new Map([["ev-sync", "off-acme"]]),
      nonLavorativi: new Set(["ev-palestra"]),
    });

    const risultato = await proposteCalendarioPerCollaboratoreAutorizzato(GIORNO, "collab-1");

    expect(mockAssocia).toHaveBeenCalledWith(expect.any(Array), [OFFERTA_ACME], GIORNO);
    expect(risultato.proposte.map((p) => [p.eventoId, p.offerta?.id ?? null])).toEqual([
      ["ev-sync", "off-acme"],
    ]);
  });

  it("senza offerte abilitate lascia le proposte da completare", async () => {
    mockEventi.mockResolvedValue([eventoGoogle("ev-call", "Call", "09:00")]);
    mockDb.offerta.findMany.mockResolvedValue([]);
    mockAssocia.mockResolvedValue({ associazioni: new Map(), nonLavorativi: new Set() });

    const risultato = await proposteCalendarioPerCollaboratoreAutorizzato(GIORNO, "collab-1");

    expect(risultato.proposte).toHaveLength(1);
    expect(risultato.proposte[0].cliente).toBeNull();
  });
});

describe("calendarioCollegato", () => {
  it("riflette la presenza del collegamento del collaboratore", async () => {
    mockDb.collegamentoCalendarioGoogle.findUnique.mockResolvedValueOnce({ id: "c" });
    expect(await calendarioCollegato("collab-1")).toBe(true);

    mockDb.collegamentoCalendarioGoogle.findUnique.mockResolvedValueOnce(null);
    expect(await calendarioCollegato("collab-1")).toBe(false);
  });
});
