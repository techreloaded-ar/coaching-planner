import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * US-052 — Contratto di `GET /api/attivita/calendario`.
 *
 * La sicurezza è provata sul confine che la applica: la route non espone alcun
 * parametro di identità, quindi il test non «prova» a passare un id altrui —
 * verifica invece che l'unico id usato nella lettura sia quello del profilo
 * risolto dal DAL. La prova osservabile dell'assenza dei dati altrui resta nel
 * test browser `tests/e2e/calendario-segregazione.spec.ts`.
 */

const {
  mockRisolviProfiloCollaboratoreCorrente,
  mockDatiCalendarioMesePerCollaboratoreAutorizzato,
} = vi.hoisted(() => ({
  mockRisolviProfiloCollaboratoreCorrente: vi.fn(),
  mockDatiCalendarioMesePerCollaboratoreAutorizzato: vi.fn(),
}));

vi.mock("@/lib/dal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dal")>();
  return {
    ...actual,
    risolviProfiloCollaboratoreCorrente: mockRisolviProfiloCollaboratoreCorrente,
  };
});

vi.mock("@/lib/attivita", () => ({
  datiCalendarioMesePerCollaboratoreAutorizzato:
    mockDatiCalendarioMesePerCollaboratoreAutorizzato,
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/attivita/calendario/route";
import { ErroreAutorizzazione } from "@/lib/dal";

const BASE_URL = "https://coaching-planner.test";

function richiesta(query = ""): NextRequest {
  return new NextRequest(`${BASE_URL}/api/attivita/calendario${query}`);
}

function profiloAttivo(collaboratoreId: string) {
  return {
    stato: "ATTIVO" as const,
    collaboratore: {
      id: collaboratoreId,
      userId: "user-1",
      nome: "Giulia",
      cognome: "Conti",
      partitaIva: "IT12345678901",
      tariffaGiornaliera: "350.00",
      attivo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

function aspettatiHeaderPrivati(risposta: Response): void {
  expect(risposta.headers.get("cache-control")).toBe("private, no-store");
  expect(risposta.headers.get("vary")).toBe("Cookie");
}

describe("GET /api/attivita/calendario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Validazione del token mese ───────────────────────────────

  it("risponde 400 se il parametro mese è assente, senza interrogare il read model", async () => {
    const risposta = await GET(richiesta());

    expect(risposta.status).toBe(400);
    await expect(risposta.json()).resolves.toEqual({
      errore: "Parametro 'mese' richiesto nel formato YYYY-MM",
    });
    aspettatiHeaderPrivati(risposta);
    expect(mockDatiCalendarioMesePerCollaboratoreAutorizzato).not.toHaveBeenCalled();
  });

  it.each(["2026-13", "2026-1", "26-01", "2026/01", "", "abc"])(
    "risponde 400 per il token malformato %j senza interrogare il read model",
    async (mese) => {
      const risposta = await GET(
        richiesta(`?mese=${encodeURIComponent(mese)}`)
      );

      expect(risposta.status).toBe(400);
      expect(mockDatiCalendarioMesePerCollaboratoreAutorizzato).not.toHaveBeenCalled();
    }
  );

  // ── Autenticazione e autorizzazione ──────────────────────────

  it("risponde 401 quando la sessione è assente", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockRejectedValue(
      new ErroreAutorizzazione(401, "Non autenticato")
    );

    const risposta = await GET(richiesta("?mese=2026-06"));

    expect(risposta.status).toBe(401);
    await expect(risposta.json()).resolves.toEqual({ errore: "Non autenticato" });
    aspettatiHeaderPrivati(risposta);
    expect(mockDatiCalendarioMesePerCollaboratoreAutorizzato).not.toHaveBeenCalled();
  });

  it.each(["ASSENTE", "DISATTIVATO"] as const)(
    "risponde 403 quando il profilo collaboratore è %s",
    async (stato) => {
      mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({ stato });

      const risposta = await GET(richiesta("?mese=2026-06"));

      expect(risposta.status).toBe(403);
      await expect(risposta.json()).resolves.toEqual({
        errore: "Profilo collaboratore non operativo",
      });
      expect(mockDatiCalendarioMesePerCollaboratoreAutorizzato).not.toHaveBeenCalled();
    }
  );

  it("propaga il 403 lanciato dal DAL come 403, non come 500", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockRejectedValue(
      new ErroreAutorizzazione(403, "Accesso negato")
    );

    const risposta = await GET(richiesta("?mese=2026-06"));

    expect(risposta.status).toBe(403);
    await expect(risposta.json()).resolves.toEqual({ errore: "Accesso negato" });
  });

  // ── Successo e contratto del DTO ─────────────────────────────

  it("restituisce il DTO del mese richiesto con gli header dei dati privati", async () => {
    const dto = {
      token: "2026-06",
      collaboratoreId: "collab-giulia",
      sintesiPerGiorno: {
        "2026-06-02": {
          data: "2026-06-02",
          righe: 2,
          oreTotali: 12,
          clienti: [
            {
              clienteId: "cliente-ts",
              ragioneSociale: "TechSolutions Srl",
              ore: 12,
            },
          ],
        },
      },
    };

    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-giulia")
    );
    mockDatiCalendarioMesePerCollaboratoreAutorizzato.mockResolvedValue(dto);

    const risposta = await GET(richiesta("?mese=2026-06"));

    expect(risposta.status).toBe(200);
    await expect(risposta.json()).resolves.toEqual(dto);
    aspettatiHeaderPrivati(risposta);
  });

  it("legge il mese esclusivamente con l'id del profilo risolto dal DAL", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-del-profilo")
    );
    mockDatiCalendarioMesePerCollaboratoreAutorizzato.mockResolvedValue({
      token: "2026-06",
      collaboratoreId: "collab-del-profilo",
      sintesiPerGiorno: {},
    });

    // La query string contiene parametri che la route non deve considerare:
    // non esiste alcun modo documentato di indicare un collaboratore.
    await GET(
      richiesta(
        "?mese=2026-06&collaboratoreId=collab-di-un-altro&userId=altro-utente"
      )
    );

    expect(mockDatiCalendarioMesePerCollaboratoreAutorizzato).toHaveBeenCalledTimes(1);
    expect(mockDatiCalendarioMesePerCollaboratoreAutorizzato).toHaveBeenCalledWith(
      "2026-06",
      "collab-del-profilo"
    );
  });

  it("non espone dettagli interni quando la lettura falla in modo inatteso", async () => {
    const erroreConsole = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-giulia")
    );
    mockDatiCalendarioMesePerCollaboratoreAutorizzato.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.7:5432")
    );

    const risposta = await GET(richiesta("?mese=2026-06"));

    expect(risposta.status).toBe(500);
    await expect(risposta.json()).resolves.toEqual({ errore: "Errore interno" });

    erroreConsole.mockRestore();
  });
});
