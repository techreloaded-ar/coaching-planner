import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Foglio attività consultato da un amministratore (`?collaboratore=<id>`).
 *
 * Il parametro arriva dal browser ed è solo una richiesta: queste prove
 * verificano che diventi un collaboratore autorizzato esclusivamente per un
 * amministratore, sia nelle letture (route) sia nelle scritture (Server
 * Action), e che il foglio di un collaboratore disattivato resti in sola
 * lettura.
 */

const mocks = vi.hoisted(() => ({
  richiediSessioneApi: vi.fn(),
  risolviProfiloCollaboratoreCorrente: vi.fn(),
  righeDelGiorno: vi.fn(),
  collaboratore: { findUnique: vi.fn() },
  rigaAttivita: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  offerta: { findUnique: vi.fn() },
  abilitazioneOfferta: { findUnique: vi.fn() },
  cliente: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  db: {
    collaboratore: mocks.collaboratore,
    rigaAttivita: mocks.rigaAttivita,
    offerta: mocks.offerta,
    abilitazioneOfferta: mocks.abilitazioneOfferta,
    cliente: mocks.cliente,
  },
}));

vi.mock("@/lib/dal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dal")>();
  return {
    ...actual,
    richiediSessioneApi: mocks.richiediSessioneApi,
    risolviProfiloCollaboratoreCorrente: mocks.risolviProfiloCollaboratoreCorrente,
  };
});

vi.mock("@/lib/attivita", () => ({
  righeDelGiornoPerCollaboratoreAutorizzato: mocks.righeDelGiorno,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { NextRequest } from "next/server";
import { ErroreAutorizzazione } from "@/lib/dal";
import {
  MESSAGGIO_FOGLIO_SOLA_LETTURA,
  risolviCollaboratoreConsultato,
} from "@/lib/foglio-attivita";
import { urlDelFoglio } from "@/lib/url-foglio-attivita";
import { GET as getGiornata } from "@/app/api/attivita/giornata/route";
import { creaRiga, eliminaRiga } from "@/lib/actions/righe-attivita";

const AMMINISTRATORE = {
  utenteId: "utente-admin",
  ruolo: "AMMINISTRATORE",
  nome: "Anna Admin",
  email: "admin@example.test",
};
const COLLABORATORE = {
  utenteId: "utente-giulia",
  ruolo: "COLLABORATORE",
  nome: "Giulia Conti",
  email: "giulia@example.test",
};

function collaboratore(id: string, attivo = true) {
  return {
    id,
    userId: `utente-${id}`,
    nome: "Mario",
    cognome: "Rossi",
    partitaIva: null,
    attivo,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function richiestaGiornata(query: string): NextRequest {
  return new NextRequest(`https://coaching-planner.test/api/attivita/giornata${query}`);
}

function formRiga(campi: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [chiave, valore] of Object.entries(campi)) fd.append(chiave, valore);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("urlDelFoglio", () => {
  it("lascia invariato l'URL del proprio foglio e aggiunge il collaboratore consultato", () => {
    expect(urlDelFoglio("/attivita", null)).toBe("/attivita");
    expect(urlDelFoglio("/attivita", "c1")).toBe("/attivita?collaboratore=c1");
    expect(urlDelFoglio("/attivita/2026-10-12?mese=2026-10", "c1")).toBe(
      "/attivita/2026-10-12?mese=2026-10&collaboratore=c1"
    );
  });
});

describe("risolviCollaboratoreConsultato", () => {
  it("rifiuta con 403 un utente non amministratore senza leggere il collaboratore", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(COLLABORATORE);

    await expect(risolviCollaboratoreConsultato("collab-mario")).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mocks.collaboratore.findUnique).not.toHaveBeenCalled();
  });

  it("restituisce all'amministratore il collaboratore, anche disattivato, o null se non esiste", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(AMMINISTRATORE);
    mocks.collaboratore.findUnique.mockResolvedValueOnce(collaboratore("collab-mario", false));
    mocks.collaboratore.findUnique.mockResolvedValueOnce(null);

    await expect(risolviCollaboratoreConsultato("collab-mario")).resolves.toMatchObject({
      id: "collab-mario",
      attivo: false,
    });
    await expect(risolviCollaboratoreConsultato("inesistente")).resolves.toBeNull();
  });
});

describe("GET /api/attivita/giornata con collaboratore consultato", () => {
  it("per un amministratore legge la giornata del collaboratore indicato", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(AMMINISTRATORE);
    mocks.collaboratore.findUnique.mockResolvedValue(collaboratore("collab-mario"));
    mocks.righeDelGiorno.mockResolvedValue({ data: "2026-10-12", collaboratoreId: "collab-mario", righe: [] });

    const risposta = await getGiornata(richiestaGiornata("?data=2026-10-12&collaboratore=collab-mario"));

    expect(risposta.status).toBe(200);
    expect(mocks.righeDelGiorno).toHaveBeenCalledWith("2026-10-12", "collab-mario");
    expect(mocks.risolviProfiloCollaboratoreCorrente).not.toHaveBeenCalled();
  });

  it("per un non amministratore risponde 403 senza leggere i dati altrui", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(COLLABORATORE);

    const risposta = await getGiornata(richiestaGiornata("?data=2026-10-12&collaboratore=collab-mario"));

    expect(risposta.status).toBe(403);
    expect(mocks.righeDelGiorno).not.toHaveBeenCalled();
  });

  it("risponde 404 per un collaboratore inesistente", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(AMMINISTRATORE);
    mocks.collaboratore.findUnique.mockResolvedValue(null);

    const risposta = await getGiornata(richiestaGiornata("?data=2026-10-12&collaboratore=inesistente"));

    expect(risposta.status).toBe(404);
    expect(mocks.righeDelGiorno).not.toHaveBeenCalled();
  });
});

describe("Server Action sul foglio consultato", () => {
  const campiRiga = {
    collaboratoreConsultatoId: "collab-mario",
    clienteId: "cliente-1",
    offertaId: "offerta-1",
    ore: "4",
    data: "2026-10-12",
  };

  beforeEach(() => {
    mocks.offerta.findUnique.mockResolvedValue({ clienteId: "cliente-1", attiva: true });
    mocks.abilitazioneOfferta.findUnique.mockResolvedValue({ collaboratoreId: "collab-mario" });
    mocks.rigaAttivita.create.mockResolvedValue({ id: "riga-nuova" });
  });

  it("un amministratore crea la riga intestata al collaboratore consultato, con le sue abilitazioni", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(AMMINISTRATORE);
    mocks.collaboratore.findUnique.mockResolvedValue(collaboratore("collab-mario"));

    const esito = await creaRiga(formRiga(campiRiga));

    expect(esito).toEqual({ success: true });
    expect(mocks.abilitazioneOfferta.findUnique).toHaveBeenCalledWith({
      where: {
        collaboratoreId_offertaId: { collaboratoreId: "collab-mario", offertaId: "offerta-1" },
      },
    });
    expect(mocks.rigaAttivita.create.mock.calls[0][0].data.collaboratoreId).toBe("collab-mario");
    expect(mocks.risolviProfiloCollaboratoreCorrente).not.toHaveBeenCalled();
  });

  it("rifiuta la scrittura sul foglio di un collaboratore disattivato", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(AMMINISTRATORE);
    mocks.collaboratore.findUnique.mockResolvedValue(collaboratore("collab-mario", false));

    const esito = await creaRiga(formRiga(campiRiga));

    expect(esito).toEqual({ success: false, error: MESSAGGIO_FOGLIO_SOLA_LETTURA });
    expect(mocks.rigaAttivita.create).not.toHaveBeenCalled();
  });

  it("un collaboratore non può scrivere sul foglio di un altro", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(COLLABORATORE);

    const esito = await creaRiga(formRiga(campiRiga));

    expect(esito.success).toBe(false);
    expect(mocks.collaboratore.findUnique).not.toHaveBeenCalled();
    expect(mocks.rigaAttivita.create).not.toHaveBeenCalled();
  });

  it("un amministratore elimina solo le righe del collaboratore consultato", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(AMMINISTRATORE);
    mocks.collaboratore.findUnique.mockResolvedValue(collaboratore("collab-mario"));
    mocks.rigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-di-un-altro",
      data: new Date("2026-10-12T12:00:00Z"),
    });

    const esito = await eliminaRiga("riga-altrui", "collab-mario");

    expect(esito.success).toBe(false);
    expect(mocks.rigaAttivita.delete).not.toHaveBeenCalled();
  });

  it("propaga come esito, non come eccezione, la sessione assente", async () => {
    mocks.richiediSessioneApi.mockRejectedValue(new ErroreAutorizzazione(401, "Non autenticato"));

    await expect(eliminaRiga("riga-1", "collab-mario")).resolves.toEqual({
      success: false,
      error: "Non autenticato",
    });
  });
});
