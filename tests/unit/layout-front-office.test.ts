import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

/**
 * US-110 AC-6 — Il titolo del front office diventa il selettore del foglio, e
 * l'elenco dei collaboratori viene letto, solo per chi ha il permesso di
 * consultare i fogli altrui. Si esegue il layout RSC reale; sessione, Prisma e
 * componenti di presentazione sono sostituiti.
 */

const mocks = vi.hoisted(() => ({
  verificaSessione: vi.fn(),
  risolviProfiloCollaboratoreCorrente: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/dal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dal")>()),
  verificaSessione: mocks.verificaSessione,
  risolviProfiloCollaboratoreCorrente: mocks.risolviProfiloCollaboratoreCorrente,
}));

vi.mock("@/lib/db", () => ({ db: { collaboratore: { findMany: mocks.findMany } } }));

vi.mock("@/app/struttura-applicazione", () => ({
  default: function StrutturaFinta() {
    return null;
  },
}));

vi.mock("@/app/(front-office)/selettore-foglio-attivita", () => ({
  default: function SelettoreFinto() {
    return null;
  },
}));

import FrontOfficeLayout from "@/app/(front-office)/layout";
import SelettoreFinto from "@/app/(front-office)/selettore-foglio-attivita";
import { PERMESSI, type Permesso } from "@/domain/permessi";

type ElementoIntestazione = ReactElement<{
  children?: unknown;
  collaboratori?: unknown;
  proprioCollaboratoreId?: string | null;
}>;

function sessione(ruolo: "AMMINISTRATORE" | "COLLABORATORE", permessi: readonly Permesso[]) {
  return { utenteId: "utente-1", ruolo, nome: "Anna Test", email: "anna@example.test", permessi };
}

async function intestazioneDelLayout(): Promise<ElementoIntestazione> {
  const elemento = (await FrontOfficeLayout({ children: null })) as ReactElement<{
    intestazione: ElementoIntestazione;
  }>;
  return elemento.props.intestazione;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("layout del front office", () => {
  it("senza il permesso il titolo è «Le mie attività» e l'elenco non viene letto, anche con ruolo AMMINISTRATORE", async () => {
    mocks.verificaSessione.mockResolvedValue(
      sessione(
        "AMMINISTRATORE",
        PERMESSI.filter((p) => p !== "CONSULTARE_FOGLI_ATTIVITA_ALTRUI")
      )
    );

    const intestazione = await intestazioneDelLayout();

    expect(intestazione.type).toBe("h1");
    expect(intestazione.props.children).toBe("Le mie attività");
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.risolviProfiloCollaboratoreCorrente).not.toHaveBeenCalled();
  });

  it("con il solo permesso compare il selettore con l'elenco dei collaboratori", async () => {
    const elenco = [
      { id: "c1", nome: "Mario", cognome: "Bianchi", attivo: true },
      { id: "c2", nome: "Luca", cognome: "Rossi", attivo: false },
    ];
    mocks.verificaSessione.mockResolvedValue(
      sessione("COLLABORATORE", ["CONSULTARE_FOGLI_ATTIVITA_ALTRUI"])
    );
    mocks.findMany.mockResolvedValue(elenco);
    mocks.risolviProfiloCollaboratoreCorrente.mockResolvedValue({ stato: "ASSENTE" });

    const intestazione = await intestazioneDelLayout();

    expect(intestazione.type).toBe(SelettoreFinto);
    expect(intestazione.props.collaboratori).toEqual(elenco);
    expect(intestazione.props.proprioCollaboratoreId).toBeNull();
  });

  it("per il collaboratore reale il titolo resta «Le mie attività»", async () => {
    mocks.verificaSessione.mockResolvedValue(sessione("COLLABORATORE", []));

    const intestazione = await intestazioneDelLayout();

    expect(intestazione.type).toBe("h1");
    expect(intestazione.props.children).toBe("Le mie attività");
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
