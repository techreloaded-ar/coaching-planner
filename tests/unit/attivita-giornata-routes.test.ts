import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * US-056 — Contratto di `GET /api/attivita/giornata`,
 * `GET /api/attivita/contesto-inserimento` e
 * `GET /api/attivita/offerte-cliente`.
 *
 * Le tre route trasportano dati della scheda giornata verso il browser. Come
 * per `/api/attivita/calendario`, la sicurezza è provata sul confine che la
 * applica: nessuna delle tre espone un parametro di identità, quindi il test
 * non «prova» a passare un id altrui — verifica invece che l'unico id che
 * raggiunge la lettura sia quello del profilo risolto dal DAL, ispezionando
 * l'argomento effettivamente passato.
 *
 * Per `offerte-cliente` il browser sceglie soltanto **quale cliente** guardare:
 * l'identità del collaboratore non compare fra gli argomenti della lettura,
 * perché è la lettura stessa a derivarla dalla sessione server.
 *
 * Il test di non regressione delle intestazioni condivise resta
 * `tests/unit/attivita-calendario-route.test.ts`, che non viene toccato.
 */

const {
  mockRisolviProfiloCollaboratoreCorrente,
  mockRigheDelGiornoPerCollaboratoreAutorizzato,
  mockContestoInserimentoPerCollaboratoreAutorizzato,
  mockOfferteAbilitatePerCliente,
} = vi.hoisted(() => ({
  mockRisolviProfiloCollaboratoreCorrente: vi.fn(),
  mockRigheDelGiornoPerCollaboratoreAutorizzato: vi.fn(),
  mockContestoInserimentoPerCollaboratoreAutorizzato: vi.fn(),
  mockOfferteAbilitatePerCliente: vi.fn(),
}));

vi.mock("@/lib/dal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dal")>();
  return {
    ...actual,
    risolviProfiloCollaboratoreCorrente: mockRisolviProfiloCollaboratoreCorrente,
  };
});

vi.mock("@/lib/attivita", () => ({
  righeDelGiornoPerCollaboratoreAutorizzato:
    mockRigheDelGiornoPerCollaboratoreAutorizzato,
  contestoInserimentoPerCollaboratoreAutorizzato:
    mockContestoInserimentoPerCollaboratoreAutorizzato,
  offerteAbilitatePerCliente: mockOfferteAbilitatePerCliente,
}));

import { NextRequest } from "next/server";
import { GET as getGiornata } from "@/app/api/attivita/giornata/route";
import { GET as getContestoInserimento } from "@/app/api/attivita/contesto-inserimento/route";
import { GET as getOfferteCliente } from "@/app/api/attivita/offerte-cliente/route";
import { ErroreAutorizzazione } from "@/lib/dal";

const BASE_URL = "https://coaching-planner.test";

function richiestaGiornata(query = ""): NextRequest {
  return new NextRequest(`${BASE_URL}/api/attivita/giornata${query}`);
}

function richiestaOfferteCliente(query = ""): NextRequest {
  return new NextRequest(`${BASE_URL}/api/attivita/offerte-cliente${query}`);
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

function giornataVuota(data: string, collaboratoreId: string) {
  return { data, collaboratoreId, righe: [] };
}

describe("GET /api/attivita/giornata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Validazione del parametro data ───────────────────────────

  it("risponde 400 se il parametro data è assente, senza interrogare il read model", async () => {
    const risposta = await getGiornata(richiestaGiornata());

    expect(risposta.status).toBe(400);
    await expect(risposta.json()).resolves.toEqual({
      errore: "Parametro 'data' richiesto nel formato YYYY-MM-DD",
    });
    aspettatiHeaderPrivati(risposta);
    expect(mockRigheDelGiornoPerCollaboratoreAutorizzato).not.toHaveBeenCalled();
    expect(mockRisolviProfiloCollaboratoreCorrente).not.toHaveBeenCalled();
  });

  it.each([
    "2026-6-1",
    "2026-06",
    "26-06-01",
    "2026/06/01",
    "",
    "abc",
    "2026-02-30",
    "2026-04-31",
  ])(
    "risponde 400 per la data non valida %j senza interrogare il read model",
    async (data) => {
      const risposta = await getGiornata(
        richiestaGiornata(`?data=${encodeURIComponent(data)}`)
      );

      expect(risposta.status).toBe(400);
      aspettatiHeaderPrivati(risposta);
      expect(mockRigheDelGiornoPerCollaboratoreAutorizzato).not.toHaveBeenCalled();
    }
  );

  // ── Autenticazione e autorizzazione ──────────────────────────

  it("risponde 401 quando la sessione è assente", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockRejectedValue(
      new ErroreAutorizzazione(401, "Non autenticato")
    );

    const risposta = await getGiornata(richiestaGiornata("?data=2026-06-02"));

    expect(risposta.status).toBe(401);
    await expect(risposta.json()).resolves.toEqual({ errore: "Non autenticato" });
    aspettatiHeaderPrivati(risposta);
    expect(mockRigheDelGiornoPerCollaboratoreAutorizzato).not.toHaveBeenCalled();
  });

  it.each(["ASSENTE", "DISATTIVATO"] as const)(
    "risponde 403 quando il profilo collaboratore è %s",
    async (stato) => {
      mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({ stato });

      const risposta = await getGiornata(richiestaGiornata("?data=2026-06-02"));

      expect(risposta.status).toBe(403);
      await expect(risposta.json()).resolves.toEqual({
        errore: "Profilo collaboratore non operativo",
      });
      aspettatiHeaderPrivati(risposta);
      expect(mockRigheDelGiornoPerCollaboratoreAutorizzato).not.toHaveBeenCalled();
    }
  );

  it("propaga il 403 lanciato dal DAL come 403, non come 500", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockRejectedValue(
      new ErroreAutorizzazione(403, "Accesso negato")
    );

    const risposta = await getGiornata(richiestaGiornata("?data=2026-06-02"));

    expect(risposta.status).toBe(403);
    await expect(risposta.json()).resolves.toEqual({ errore: "Accesso negato" });
    aspettatiHeaderPrivati(risposta);
  });

  // ── Successo e contratto del DTO ─────────────────────────────

  it("restituisce il DTO della giornata richiesta con gli header dei dati privati", async () => {
    const dto = {
      data: "2026-06-02",
      collaboratoreId: "collab-giulia",
      righe: [
        {
          id: "riga-1",
          data: "2026-06-02",
          ore: 8,
          nota: "Analisi requisiti",
          fatturabile: true,
          rimborsoTrasfertaEtichetta: "Trasferta Milano",
          rimborsoTrasfertaImporto: "45.00",
          offerta: {
            id: "offerta-1",
            codice: "OFF-2026-001",
            descrizione: "Consulenza continuativa",
          },
          cliente: {
            id: "cliente-ts",
            ragioneSociale: "TechSolutions Srl",
          },
        },
      ],
    };

    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-giulia")
    );
    mockRigheDelGiornoPerCollaboratoreAutorizzato.mockResolvedValue(dto);

    const risposta = await getGiornata(richiestaGiornata("?data=2026-06-02"));

    expect(risposta.status).toBe(200);
    await expect(risposta.json()).resolves.toEqual(dto);
    aspettatiHeaderPrivati(risposta);
  });

  it("legge la giornata esclusivamente con l'id del profilo risolto dal DAL", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-del-profilo")
    );
    mockRigheDelGiornoPerCollaboratoreAutorizzato.mockResolvedValue(
      giornataVuota("2026-06-02", "collab-del-profilo")
    );

    // La query string contiene parametri che la route non deve considerare:
    // non esiste alcun modo documentato di indicare un collaboratore.
    await getGiornata(
      richiestaGiornata(
        "?data=2026-06-02&collaboratoreId=collab-di-un-altro&userId=altro-utente"
      )
    );

    expect(mockRigheDelGiornoPerCollaboratoreAutorizzato).toHaveBeenCalledTimes(1);
    expect(mockRigheDelGiornoPerCollaboratoreAutorizzato).toHaveBeenCalledWith(
      "2026-06-02",
      "collab-del-profilo"
    );
    // Nessun terzo argomento: la data e l'id del profilo sono tutto ciò che
    // raggiunge la lettura, e nessun valore della query string vi arriva.
    const argomentiLettura =
      mockRigheDelGiornoPerCollaboratoreAutorizzato.mock.calls[0];
    expect(argomentiLettura).toHaveLength(2);
    expect(argomentiLettura).not.toContain("collab-di-un-altro");
    expect(argomentiLettura).not.toContain("altro-utente");
  });

  it("non espone dettagli interni quando la lettura falla in modo inatteso", async () => {
    const erroreConsole = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-giulia")
    );
    mockRigheDelGiornoPerCollaboratoreAutorizzato.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.7:5432")
    );

    const risposta = await getGiornata(richiestaGiornata("?data=2026-06-02"));

    expect(risposta.status).toBe(500);
    await expect(risposta.json()).resolves.toEqual({ errore: "Errore interno" });
    aspettatiHeaderPrivati(risposta);

    erroreConsole.mockRestore();
  });
});

describe("GET /api/attivita/contesto-inserimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Autenticazione e autorizzazione ──────────────────────────

  it("risponde 401 quando la sessione è assente", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockRejectedValue(
      new ErroreAutorizzazione(401, "Non autenticato")
    );

    const risposta = await getContestoInserimento();

    expect(risposta.status).toBe(401);
    await expect(risposta.json()).resolves.toEqual({ errore: "Non autenticato" });
    aspettatiHeaderPrivati(risposta);
    expect(
      mockContestoInserimentoPerCollaboratoreAutorizzato
    ).not.toHaveBeenCalled();
  });

  it.each(["ASSENTE", "DISATTIVATO"] as const)(
    "risponde 403 quando il profilo collaboratore è %s",
    async (stato) => {
      mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({ stato });

      const risposta = await getContestoInserimento();

      expect(risposta.status).toBe(403);
      await expect(risposta.json()).resolves.toEqual({
        errore: "Profilo collaboratore non operativo",
      });
      aspettatiHeaderPrivati(risposta);
      expect(
        mockContestoInserimentoPerCollaboratoreAutorizzato
      ).not.toHaveBeenCalled();
    }
  );

  it("propaga il 403 lanciato dal DAL come 403, non come 500", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockRejectedValue(
      new ErroreAutorizzazione(403, "Accesso negato")
    );

    const risposta = await getContestoInserimento();

    expect(risposta.status).toBe(403);
    await expect(risposta.json()).resolves.toEqual({ errore: "Accesso negato" });
    aspettatiHeaderPrivati(risposta);
  });

  // ── Successo e contratto del DTO ─────────────────────────────

  it("restituisce il DTO del contesto con gli header dei dati privati", async () => {
    const dto = {
      collaboratoreId: "collab-giulia",
      clienti: [{ id: "cliente-ts", ragioneSociale: "TechSolutions Srl" }],
      vociRimborso: [
        { id: "voce-1", etichetta: "Trasferta Milano", importo: "45.00" },
      ],
    };

    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-giulia")
    );
    mockContestoInserimentoPerCollaboratoreAutorizzato.mockResolvedValue(dto);

    const risposta = await getContestoInserimento();

    expect(risposta.status).toBe(200);
    await expect(risposta.json()).resolves.toEqual(dto);
    aspettatiHeaderPrivati(risposta);
  });

  it("non dichiara alcun parametro di richiesta", () => {
    // Il gestore non riceve nemmeno la richiesta: non esiste una superficie da
    // cui un identificativo del browser possa entrare.
    expect(getContestoInserimento).toHaveLength(0);
  });

  it("legge il contesto esclusivamente con l'id del profilo risolto dal DAL", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-del-profilo")
    );
    mockContestoInserimentoPerCollaboratoreAutorizzato.mockResolvedValue({
      collaboratoreId: "collab-del-profilo",
      clienti: [],
      vociRimborso: [],
    });

    await getContestoInserimento();

    expect(mockContestoInserimentoPerCollaboratoreAutorizzato).toHaveBeenCalledTimes(1);
    expect(mockContestoInserimentoPerCollaboratoreAutorizzato).toHaveBeenCalledWith(
      "collab-del-profilo"
    );
    expect(
      mockContestoInserimentoPerCollaboratoreAutorizzato.mock.calls[0]
    ).toHaveLength(1);
  });

  it("non espone dettagli interni quando la lettura falla in modo inatteso", async () => {
    const erroreConsole = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-giulia")
    );
    mockContestoInserimentoPerCollaboratoreAutorizzato.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.7:5432")
    );

    const risposta = await getContestoInserimento();

    expect(risposta.status).toBe(500);
    await expect(risposta.json()).resolves.toEqual({ errore: "Errore interno" });
    aspettatiHeaderPrivati(risposta);

    erroreConsole.mockRestore();
  });
});

describe("GET /api/attivita/offerte-cliente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Validazione del parametro cliente ────────────────────────

  it("risponde 400 se il parametro cliente è assente, senza interrogare il read model", async () => {
    const risposta = await getOfferteCliente(richiestaOfferteCliente());

    expect(risposta.status).toBe(400);
    await expect(risposta.json()).resolves.toEqual({
      errore: "Parametro 'cliente' richiesto",
    });
    aspettatiHeaderPrivati(risposta);
    expect(mockOfferteAbilitatePerCliente).not.toHaveBeenCalled();
    // La validazione precede la risoluzione della sessione: una richiesta
    // malformata non arriva nemmeno al DAL.
    expect(mockRisolviProfiloCollaboratoreCorrente).not.toHaveBeenCalled();
  });

  it("risponde 400 se il parametro cliente è presente ma vuoto, senza interrogare il read model", async () => {
    const risposta = await getOfferteCliente(
      richiestaOfferteCliente("?cliente=")
    );

    expect(risposta.status).toBe(400);
    await expect(risposta.json()).resolves.toEqual({
      errore: "Parametro 'cliente' richiesto",
    });
    aspettatiHeaderPrivati(risposta);
    expect(mockOfferteAbilitatePerCliente).not.toHaveBeenCalled();
    expect(mockRisolviProfiloCollaboratoreCorrente).not.toHaveBeenCalled();
  });

  it("risponde 400 se il parametro cliente contiene solo spazi, senza interrogare il read model", async () => {
    // Come per `data` e `mese` delle route sorelle, il parametro viene
    // normalizzato: un identificativo di soli spazi non è un cliente e non deve
    // raggiungere il read model.
    const risposta = await getOfferteCliente(
      richiestaOfferteCliente("?cliente=%20%20")
    );

    expect(risposta.status).toBe(400);
    await expect(risposta.json()).resolves.toEqual({
      errore: "Parametro 'cliente' richiesto",
    });
    aspettatiHeaderPrivati(risposta);
    expect(mockOfferteAbilitatePerCliente).not.toHaveBeenCalled();
    expect(mockRisolviProfiloCollaboratoreCorrente).not.toHaveBeenCalled();
  });

  it("normalizza gli spazi attorno all'id cliente prima di interrogare il read model", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-1")
    );
    mockOfferteAbilitatePerCliente.mockResolvedValue([]);

    const risposta = await getOfferteCliente(
      richiestaOfferteCliente("?cliente=%20cliente-ts%20")
    );

    expect(risposta.status).toBe(200);
    expect(mockOfferteAbilitatePerCliente).toHaveBeenCalledWith("cliente-ts");
  });

  // ── Autenticazione e autorizzazione ──────────────────────────

  it("risponde 401 quando la sessione è assente", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockRejectedValue(
      new ErroreAutorizzazione(401, "Non autenticato")
    );

    const risposta = await getOfferteCliente(
      richiestaOfferteCliente("?cliente=cliente-ts")
    );

    expect(risposta.status).toBe(401);
    await expect(risposta.json()).resolves.toEqual({ errore: "Non autenticato" });
    aspettatiHeaderPrivati(risposta);
    expect(mockOfferteAbilitatePerCliente).not.toHaveBeenCalled();
  });

  it("propaga come 401 anche l'errore di autorizzazione lanciato dalla lettura", async () => {
    // `offerteAbilitatePerCliente` rideriva il collaboratore dalla sessione e
    // lancia a sua volta: quel 401 non deve degradare in 500.
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-giulia")
    );
    mockOfferteAbilitatePerCliente.mockRejectedValue(
      new ErroreAutorizzazione(
        401,
        "Devi essere un collaboratore per visualizzare le offerte"
      )
    );

    const risposta = await getOfferteCliente(
      richiestaOfferteCliente("?cliente=cliente-ts")
    );

    expect(risposta.status).toBe(401);
    await expect(risposta.json()).resolves.toEqual({
      errore: "Devi essere un collaboratore per visualizzare le offerte",
    });
    aspettatiHeaderPrivati(risposta);
  });

  it.each(["ASSENTE", "DISATTIVATO"] as const)(
    "risponde 403 quando il profilo collaboratore è %s",
    async (stato) => {
      mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue({ stato });

      const risposta = await getOfferteCliente(
        richiestaOfferteCliente("?cliente=cliente-ts")
      );

      expect(risposta.status).toBe(403);
      await expect(risposta.json()).resolves.toEqual({
        errore: "Profilo collaboratore non operativo",
      });
      aspettatiHeaderPrivati(risposta);
      expect(mockOfferteAbilitatePerCliente).not.toHaveBeenCalled();
    }
  );

  it("propaga il 403 lanciato dal DAL come 403, non come 500", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockRejectedValue(
      new ErroreAutorizzazione(403, "Accesso negato")
    );

    const risposta = await getOfferteCliente(
      richiestaOfferteCliente("?cliente=cliente-ts")
    );

    expect(risposta.status).toBe(403);
    await expect(risposta.json()).resolves.toEqual({ errore: "Accesso negato" });
    aspettatiHeaderPrivati(risposta);
  });

  // ── Successo e contratto del DTO ─────────────────────────────

  it("restituisce le offerte del cliente sotto la chiave offerte con gli header dei dati privati", async () => {
    const offerte = [
      {
        id: "offerta-1",
        codice: "OFF-2026-001",
        descrizione: "Consulenza continuativa",
      },
      {
        id: "offerta-2",
        codice: "OFF-2026-002",
        descrizione: "Formazione team",
      },
    ];

    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-giulia")
    );
    mockOfferteAbilitatePerCliente.mockResolvedValue(offerte);

    const risposta = await getOfferteCliente(
      richiestaOfferteCliente("?cliente=cliente-ts")
    );

    expect(risposta.status).toBe(200);
    await expect(risposta.json()).resolves.toEqual({ offerte });
    aspettatiHeaderPrivati(risposta);
  });

  it("restituisce 200 con un elenco vuoto quando il collaboratore non è abilitato su alcuna offerta del cliente", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-giulia")
    );
    mockOfferteAbilitatePerCliente.mockResolvedValue([]);

    const risposta = await getOfferteCliente(
      richiestaOfferteCliente("?cliente=cliente-senza-offerte")
    );

    // Un elenco vuoto è un esito legittimo, non un 404: il cascade select
    // mostra semplicemente nessuna offerta selezionabile.
    expect(risposta.status).toBe(200);
    await expect(risposta.json()).resolves.toEqual({ offerte: [] });
    aspettatiHeaderPrivati(risposta);
  });

  it("legge le offerte con il solo id cliente della query, senza alcuna identità proveniente dal browser", async () => {
    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-del-profilo")
    );
    mockOfferteAbilitatePerCliente.mockResolvedValue([]);

    // La query string contiene parametri che la route non deve considerare:
    // l'unica scelta concessa al browser è quale cliente guardare.
    await getOfferteCliente(
      richiestaOfferteCliente(
        "?cliente=cliente-ts&collaboratoreId=collab-di-un-altro&userId=altro-utente"
      )
    );

    expect(mockOfferteAbilitatePerCliente).toHaveBeenCalledTimes(1);
    expect(mockOfferteAbilitatePerCliente).toHaveBeenCalledWith("cliente-ts");

    // Un solo argomento: nessun identificativo di collaboratore raggiunge la
    // lettura, né dalla query string né dal profilo — è la lettura stessa a
    // ricavare il collaboratore dalla sessione server.
    const argomentiLettura = mockOfferteAbilitatePerCliente.mock.calls[0];
    expect(argomentiLettura).toHaveLength(1);
    expect(argomentiLettura).not.toContain("collab-di-un-altro");
    expect(argomentiLettura).not.toContain("altro-utente");
    expect(argomentiLettura).not.toContain("collab-del-profilo");
  });

  it("non espone dettagli interni quando la lettura falla in modo inatteso", async () => {
    const erroreConsole = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    mockRisolviProfiloCollaboratoreCorrente.mockResolvedValue(
      profiloAttivo("collab-giulia")
    );
    mockOfferteAbilitatePerCliente.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.7:5432")
    );

    const risposta = await getOfferteCliente(
      richiestaOfferteCliente("?cliente=cliente-ts")
    );

    expect(risposta.status).toBe(500);
    await expect(risposta.json()).resolves.toEqual({ errore: "Errore interno" });
    aspettatiHeaderPrivati(risposta);

    erroreConsole.mockRestore();
  });
});
