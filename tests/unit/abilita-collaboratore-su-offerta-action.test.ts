import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  offerta: { findUnique: vi.fn() },
  collaboratore: { findUnique: vi.fn() },
  abilitazioneOfferta: { createMany: vi.fn() },
  richiediRuoloApi: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    offerta: mocks.offerta,
    collaboratore: mocks.collaboratore,
    abilitazioneOfferta: mocks.abilitazioneOfferta,
  },
}));
vi.mock("@/lib/dal", () => ({ richiediRuoloApi: mocks.richiediRuoloApi }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { abilitaCollaboratoreSuOfferta } from "@/lib/actions/abilitazioni-offerte";

describe("abilitaCollaboratoreSuOfferta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.offerta.findUnique.mockResolvedValue({ attiva: true });
    mocks.collaboratore.findUnique.mockResolvedValue({ attivo: true });
  });

  it("abilita la coppia in modo idempotente, solo per l'amministratore", async () => {
    const esito = await abilitaCollaboratoreSuOfferta("collab-1", "off-1");

    expect(esito).toEqual({ success: true });
    expect(mocks.richiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
    expect(mocks.abilitazioneOfferta.createMany).toHaveBeenCalledWith({
      data: [{ collaboratoreId: "collab-1", offertaId: "off-1" }],
      skipDuplicates: true,
    });
  });

  it("non abilita se il chiamante non è amministratore", async () => {
    mocks.richiediRuoloApi.mockRejectedValueOnce(new Error("Ruolo richiesto: AMMINISTRATORE"));

    await expect(abilitaCollaboratoreSuOfferta("collab-1", "off-1")).rejects.toThrow();
    expect(mocks.abilitazioneOfferta.createMany).not.toHaveBeenCalled();
  });

  it("rifiuta offerte disattivate e collaboratori disattivati", async () => {
    mocks.offerta.findUnique.mockResolvedValueOnce({ attiva: false });
    expect(await abilitaCollaboratoreSuOfferta("collab-1", "off-1")).toEqual({
      success: false,
      error: "L'offerta non è attiva",
    });

    mocks.collaboratore.findUnique.mockResolvedValueOnce({ attivo: false });
    expect(await abilitaCollaboratoreSuOfferta("collab-1", "off-1")).toEqual({
      success: false,
      error: "Il collaboratore non è attivo",
    });

    expect(mocks.abilitazioneOfferta.createMany).not.toHaveBeenCalled();
  });
});
