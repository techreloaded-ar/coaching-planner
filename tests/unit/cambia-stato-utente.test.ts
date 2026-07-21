import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  utente: {
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  collaboratore: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

const { mockRichiediRuoloApi } = vi.hoisted(() => ({
  mockRichiediRuoloApi: vi.fn(),
}));

vi.mock("@/lib/dal", () => ({
  richiediRuoloApi: mockRichiediRuoloApi,
}));

const { mockRevalidatePath } = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { cambiaStatoUtenteAction } from "@/app/(back-office)/anagrafiche/utenti/cambia-stato-utente-action";

function formCambioStato(attivo: boolean): FormData {
  const formData = new FormData();
  formData.set("id", "utente-1");
  formData.set("attivo", String(attivo));
  return formData;
}

const SELECT_UTENTE = {
  ruolo: true,
  attivo: true,
  collaboratore: { select: { id: true } },
};

const CONTA_ALTRI_AMMINISTRATORI = {
  where: {
    ruolo: "AMMINISTRATORE",
    attivo: true,
    id: { not: "utente-1" },
  },
};

describe("cambiaStatoUtenteAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
    mockDb.$transaction.mockImplementation(
      async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
    );
  });

  it("invalida il collaboratore, cascando lo stato al profilo e aggiornando le pagine correlate", async () => {
    mockDb.utente.findUnique.mockResolvedValue({
      ruolo: "COLLABORATORE",
      attivo: true,
      collaboratore: { id: "collaboratore-1" },
    });
    mockDb.utente.count.mockResolvedValue(0);

    await cambiaStatoUtenteAction(formCambioStato(false));

    expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.utente.findUnique).toHaveBeenCalledWith({
      where: { id: "utente-1" },
      select: SELECT_UTENTE,
    });
    expect(mockDb.utente.count).toHaveBeenCalledWith(
      CONTA_ALTRI_AMMINISTRATORI,
    );
    expect(mockDb.utente.update).toHaveBeenCalledWith({
      where: { id: "utente-1" },
      data: { attivo: false },
    });
    expect(mockDb.collaboratore.update).toHaveBeenCalledWith({
      where: { id: "collaboratore-1" },
      data: { attivo: false },
    });
    expect(mockRevalidatePath).toHaveBeenNthCalledWith(
      1,
      "/anagrafiche/utenti",
    );
    expect(mockRevalidatePath).toHaveBeenNthCalledWith(
      2,
      "/anagrafiche/collaboratori",
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      "/anagrafiche/utenti?esito=invalidato",
    );
  });

  it("riattiva utente e profilo collaboratore senza contare gli amministratori", async () => {
    mockDb.utente.findUnique.mockResolvedValue({
      ruolo: "COLLABORATORE",
      attivo: false,
      collaboratore: { id: "collaboratore-1" },
    });

    await cambiaStatoUtenteAction(formCambioStato(true));

    expect(mockDb.utente.count).not.toHaveBeenCalled();
    expect(mockDb.utente.update).toHaveBeenCalledWith({
      where: { id: "utente-1" },
      data: { attivo: true },
    });
    expect(mockDb.collaboratore.update).toHaveBeenCalledWith({
      where: { id: "collaboratore-1" },
      data: { attivo: true },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/anagrafiche/utenti");
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      "/anagrafiche/collaboratori",
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      "/anagrafiche/utenti?esito=riattivato",
    );
  });

  it("invalida un utente senza profilo collaboratore senza tentare la cascata", async () => {
    mockDb.utente.findUnique.mockResolvedValue({
      ruolo: "COLLABORATORE",
      attivo: true,
      collaboratore: null,
    });
    mockDb.utente.count.mockResolvedValue(0);

    await cambiaStatoUtenteAction(formCambioStato(false));

    expect(mockDb.utente.update).toHaveBeenCalledWith({
      where: { id: "utente-1" },
      data: { attivo: false },
    });
    expect(mockDb.collaboratore.update).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith(
      "/anagrafiche/utenti?esito=invalidato",
    );
  });

  it("blocca l'invalidazione dell'ultimo amministratore senza scritture", async () => {
    mockDb.utente.findUnique.mockResolvedValue({
      ruolo: "AMMINISTRATORE",
      attivo: true,
      collaboratore: null,
    });
    mockDb.utente.count.mockResolvedValue(0);

    await cambiaStatoUtenteAction(formCambioStato(false));

    expect(mockDb.utente.count).toHaveBeenCalledWith(
      CONTA_ALTRI_AMMINISTRATORI,
    );
    expect(mockDb.utente.update).not.toHaveBeenCalled();
    expect(mockDb.collaboratore.update).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith(
      "/anagrafiche/utenti?errore=ultimo-amministratore",
    );
  });

  it("invalida un amministratore quando ne rimane almeno un altro attivo", async () => {
    mockDb.utente.findUnique.mockResolvedValue({
      ruolo: "AMMINISTRATORE",
      attivo: true,
      collaboratore: null,
    });
    mockDb.utente.count.mockResolvedValue(1);

    await cambiaStatoUtenteAction(formCambioStato(false));

    expect(mockDb.utente.count).toHaveBeenCalledWith(
      CONTA_ALTRI_AMMINISTRATORI,
    );
    expect(mockDb.utente.update).toHaveBeenCalledWith({
      where: { id: "utente-1" },
      data: { attivo: false },
    });
    expect(mockDb.collaboratore.update).not.toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledTimes(2);
    expect(mockRedirect).toHaveBeenCalledWith(
      "/anagrafiche/utenti?esito=invalidato",
    );
  });

  it("riattiva un amministratore senza applicare la protezione dell'ultimo admin", async () => {
    mockDb.utente.findUnique.mockResolvedValue({
      ruolo: "AMMINISTRATORE",
      attivo: false,
      collaboratore: null,
    });

    await cambiaStatoUtenteAction(formCambioStato(true));

    expect(mockDb.utente.count).not.toHaveBeenCalled();
    expect(mockDb.utente.update).toHaveBeenCalledWith({
      where: { id: "utente-1" },
      data: { attivo: true },
    });
    expect(mockRevalidatePath).toHaveBeenCalledTimes(2);
    expect(mockRedirect).toHaveBeenCalledWith(
      "/anagrafiche/utenti?esito=riattivato",
    );
  });

  it("usa l'isolamento serializzabile e ritenta un conflitto P2034", async () => {
    mockDb.$transaction
      .mockRejectedValueOnce({ code: "P2034" })
      .mockImplementationOnce(
        async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
      );
    mockDb.utente.findUnique.mockResolvedValue({
      ruolo: "COLLABORATORE",
      attivo: true,
      collaboratore: null,
    });

    await cambiaStatoUtenteAction(formCambioStato(false));

    expect(mockDb.$transaction).toHaveBeenCalledTimes(2);
    expect(mockDb.$transaction).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
    expect(mockDb.$transaction).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
    expect(mockDb.utente.update).toHaveBeenCalledWith({
      where: { id: "utente-1" },
      data: { attivo: false },
    });
  });

  it("propaga il fallimento della guardia senza accedere al database", async () => {
    mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

    await expect(
      cambiaStatoUtenteAction(formCambioStato(false)),
    ).rejects.toThrow("Accesso negato");

    expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
    expect(mockDb.$transaction).not.toHaveBeenCalled();
    expect(mockDb.utente.findUnique).not.toHaveBeenCalled();
    expect(mockDb.utente.count).not.toHaveBeenCalled();
    expect(mockDb.utente.update).not.toHaveBeenCalled();
    expect(mockDb.collaboratore.update).not.toHaveBeenCalled();
  });
});
