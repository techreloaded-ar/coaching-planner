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
  collaboratore: { findUnique: vi.fn(), findMany: vi.fn() },
  rigaAttivita: {
    create: vi.fn(),
    createMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  offerta: { findUnique: vi.fn() },
  cliente: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  db: {
    collaboratore: mocks.collaboratore,
    rigaAttivita: mocks.rigaAttivita,
    offerta: mocks.offerta,
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

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

import { NextRequest } from "next/server";
import { ErroreAutorizzazione, type SessioneUtente } from "@/lib/dal";
import {
  MESSAGGIO_FOGLIO_SOLA_LETTURA,
  collaboratoreConsultatoDellaPagina,
  collaboratoriDelSelettore,
  risolviCollaboratoreConsultato,
} from "@/lib/foglio-attivita";
import { PERMESSI } from "@/domain/permessi";
import { urlDelFoglio } from "@/lib/url-foglio-attivita";
import { GET as getGiornata } from "@/app/api/attivita/giornata/route";
import {
  creaRiga,
  duplicaRigaSuGiorni,
  eliminaRiga,
  modificaRiga,
} from "@/lib/actions/righe-attivita";

const AMMINISTRATORE: SessioneUtente = {
  utenteId: "utente-admin",
  ruolo: "AMMINISTRATORE",
  nome: "Anna Admin",
  email: "admin@example.test",
  permessi: PERMESSI,
};
const COLLABORATORE: SessioneUtente = {
  utenteId: "utente-giulia",
  ruolo: "COLLABORATORE",
  nome: "Giulia Conti",
  email: "giulia@example.test",
  permessi: [],
};
/** Ruolo AMMINISTRATORE ma senza il permesso: decide il permesso, non il ruolo. */
const AMMINISTRATORE_SENZA_FOGLI_ALTRUI: SessioneUtente = {
  ...AMMINISTRATORE,
  permessi: PERMESSI.filter((p) => p !== "CONSULTARE_FOGLI_ATTIVITA_ALTRUI"),
};
const COLLABORATORE_CON_FOGLI_ALTRUI: SessioneUtente = {
  ...COLLABORATORE,
  permessi: ["CONSULTARE_FOGLI_ATTIVITA_ALTRUI"],
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
    mocks.rigaAttivita.create.mockResolvedValue({ id: "riga-nuova" });
  });

  it("un amministratore crea la riga intestata al collaboratore consultato", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(AMMINISTRATORE);
    mocks.collaboratore.findUnique.mockResolvedValue(collaboratore("collab-mario"));

    const esito = await creaRiga(formRiga(campiRiga));

    expect(esito).toEqual({ success: true });
    expect(mocks.rigaAttivita.create.mock.calls[0][0].data.collaboratoreId).toBe("collab-mario");
    expect(mocks.risolviProfiloCollaboratoreCorrente).not.toHaveBeenCalled();
  });

  it("ignora sul foglio consultato l'evento del calendario, che è personale", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(AMMINISTRATORE);
    mocks.collaboratore.findUnique.mockResolvedValue(collaboratore("collab-mario"));

    const esito = await creaRiga(formRiga({ ...campiRiga, eventoCalendarioId: "evento-1" }));

    // Nessuna transazione con l'evento: la `db` di prova non ha `$transaction`.
    expect(esito).toEqual({ success: true });
    expect(mocks.rigaAttivita.create).toHaveBeenCalledTimes(1);
  });

  it("un amministratore modifica e duplica le righe del collaboratore consultato", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(AMMINISTRATORE);
    mocks.collaboratore.findUnique.mockResolvedValue(collaboratore("collab-mario"));
    mocks.rigaAttivita.findUnique.mockResolvedValue({
      collaboratoreId: "collab-mario",
      offertaId: "offerta-1",
      clienteId: "cliente-1",
      data: new Date("2026-10-12T12:00:00Z"),
      ore: "4",
      nota: null,
      categoria: "FATTURABILE",
      rimborsoTrasfertaEtichetta: null,
      rimborsoTrasfertaImporto: null,
    });

    const modifica = await modificaRiga(
      formRiga({ collaboratoreConsultatoId: "collab-mario", rigaId: "riga-1", ore: "6" })
    );
    const duplicazione = await duplicaRigaSuGiorni("riga-1", ["2026-10-13"], "collab-mario");

    expect(modifica).toEqual({ success: true });
    expect(mocks.rigaAttivita.update).toHaveBeenCalledWith({
      where: { id: "riga-1" },
      data: { ore: 6 },
    });
    expect(duplicazione).toEqual({ success: true, giorniCreati: 1 });
    expect(mocks.rigaAttivita.createMany.mock.calls[0][0].data[0].collaboratoreId).toBe(
      "collab-mario"
    );
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

describe("permesso di consultare i fogli altrui", () => {
  it("senza il permesso risolviCollaboratoreConsultato risponde 403, anche con ruolo AMMINISTRATORE", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(AMMINISTRATORE_SENZA_FOGLI_ALTRUI);

    await expect(risolviCollaboratoreConsultato("collab-mario")).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mocks.collaboratore.findUnique).not.toHaveBeenCalled();
  });

  it("senza il permesso la route della giornata altrui risponde 403", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(AMMINISTRATORE_SENZA_FOGLI_ALTRUI);

    const risposta = await getGiornata(richiestaGiornata("?data=2026-10-12&collaboratore=collab-mario"));

    expect(risposta.status).toBe(403);
    expect(mocks.collaboratore.findUnique).not.toHaveBeenCalled();
    expect(mocks.righeDelGiorno).not.toHaveBeenCalled();
  });

  it("senza il permesso non si scrive sul foglio di un altro", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(AMMINISTRATORE_SENZA_FOGLI_ALTRUI);

    const esito = await creaRiga(
      formRiga({
        collaboratoreConsultatoId: "collab-mario",
        clienteId: "cliente-1",
        offertaId: "offerta-1",
        ore: "4",
        data: "2026-10-12",
      })
    );

    expect(esito.success).toBe(false);
    expect(mocks.collaboratore.findUnique).not.toHaveBeenCalled();
    expect(mocks.rigaAttivita.create).not.toHaveBeenCalled();
  });

  it("senza il permesso la pagina riporta al proprio foglio", async () => {
    await expect(
      collaboratoreConsultatoDellaPagina(AMMINISTRATORE_SENZA_FOGLI_ALTRUI, "collab-mario")
    ).rejects.toThrow("REDIRECT:/attivita");
    expect(mocks.collaboratore.findUnique).not.toHaveBeenCalled();
  });

  it("senza il permesso l'elenco del selettore risponde 403 senza leggere i collaboratori", async () => {
    await expect(collaboratoriDelSelettore(AMMINISTRATORE_SENZA_FOGLI_ALTRUI)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mocks.collaboratore.findMany).not.toHaveBeenCalled();
  });

  it("con il solo permesso, anche con ruolo COLLABORATORE, il foglio altrui e il selettore sono ammessi", async () => {
    mocks.richiediSessioneApi.mockResolvedValue(COLLABORATORE_CON_FOGLI_ALTRUI);
    mocks.collaboratore.findUnique.mockResolvedValue(collaboratore("collab-mario"));
    const elenco = [{ id: "collab-mario", nome: "Mario", cognome: "Rossi", attivo: true }];
    mocks.collaboratore.findMany.mockResolvedValue(elenco);

    await expect(risolviCollaboratoreConsultato("collab-mario")).resolves.toMatchObject({
      id: "collab-mario",
    });
    await expect(collaboratoriDelSelettore(COLLABORATORE_CON_FOGLI_ALTRUI)).resolves.toEqual(elenco);
  });
});
