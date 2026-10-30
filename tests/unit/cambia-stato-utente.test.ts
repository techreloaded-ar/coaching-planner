import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  utente: {
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  collaboratore: {
    updateMany: vi.fn(),
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

function formCambioStato(attivo: boolean, id: string[] = ["utente-1"]): FormData {
  const formData = new FormData();
  for (const valore of id) formData.append("id", valore);
  formData.set("attivo", String(attivo));
  return formData;
}

const SELECT_UTENTE = {
  id: true,
  ruolo: true,
  attivo: true,
  collaboratore: { select: { id: true } },
};

function contaAltriAmministratori(id: string[] = ["utente-1"]) {
  return {
    where: {
      ruolo: "AMMINISTRATORE",
      attivo: true,
      id: { notIn: id },
    },
  };
}

describe("cambiaStatoUtenteAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
    mockDb.$transaction.mockImplementation(
      async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
    );
  });

  it("disattiva il collaboratore, cascando lo stato al profilo e aggiornando le pagine correlate", async () => {
    mockDb.utente.findMany.mockResolvedValue([
      { id: "utente-1", ruolo: "COLLABORATORE", attivo: true, collaboratore: { id: "collaboratore-1" } },
    ]);
    mockDb.utente.count.mockResolvedValue(0);

    await cambiaStatoUtenteAction(formCambioStato(false));

    expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.utente.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["utente-1"] } },
      select: SELECT_UTENTE,
    });
    expect(mockDb.utente.count).toHaveBeenCalledWith(contaAltriAmministratori());
    expect(mockDb.utente.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["utente-1"] } },
      data: { attivo: false },
    });
    expect(mockDb.collaboratore.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["collaboratore-1"] } },
      data: { attivo: false },
    });
    expect(mockRevalidatePath).toHaveBeenNthCalledWith(1, "/anagrafiche/utenti");
    expect(mockRevalidatePath).toHaveBeenNthCalledWith(2, "/anagrafiche/collaboratori");
    expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/utenti?esito=disattivato");
  });

  it("disattiva più utenti in un'unica transazione, cascando solo sui profili esistenti", async () => {
    mockDb.utente.findMany.mockResolvedValue([
      { id: "utente-1", ruolo: "COLLABORATORE", attivo: true, collaboratore: { id: "collaboratore-1" } },
      { id: "utente-2", ruolo: "AMMINISTRATORE", attivo: true, collaboratore: null },
    ]);
    mockDb.utente.count.mockResolvedValue(1);

    await cambiaStatoUtenteAction(formCambioStato(false, ["utente-1", "utente-2"]));

    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.utente.count).toHaveBeenCalledWith(
      contaAltriAmministratori(["utente-1", "utente-2"]),
    );
    expect(mockDb.utente.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["utente-1", "utente-2"] } },
      data: { attivo: false },
    });
    expect(mockDb.collaboratore.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["collaboratore-1"] } },
      data: { attivo: false },
    });
    expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/utenti?esito=disattivato");
  });

  it("riattiva utente e profilo collaboratore senza contare gli amministratori", async () => {
    mockDb.utente.findMany.mockResolvedValue([
      { id: "utente-1", ruolo: "COLLABORATORE", attivo: false, collaboratore: { id: "collaboratore-1" } },
    ]);

    await cambiaStatoUtenteAction(formCambioStato(true));

    expect(mockDb.utente.count).not.toHaveBeenCalled();
    expect(mockDb.utente.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["utente-1"] } },
      data: { attivo: true },
    });
    expect(mockDb.collaboratore.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["collaboratore-1"] } },
      data: { attivo: true },
    });
    expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/utenti?esito=riattivato");
  });

  it("disattiva un utente senza profilo collaboratore senza tentare la cascata", async () => {
    mockDb.utente.findMany.mockResolvedValue([
      { id: "utente-1", ruolo: "COLLABORATORE", attivo: true, collaboratore: null },
    ]);
    mockDb.utente.count.mockResolvedValue(0);

    await cambiaStatoUtenteAction(formCambioStato(false));

    expect(mockDb.utente.updateMany).toHaveBeenCalledTimes(1);
    expect(mockDb.collaboratore.updateMany).not.toHaveBeenCalled();
  });

  it("blocca la disattivazione dell'ultimo amministratore senza scritture", async () => {
    mockDb.utente.findMany.mockResolvedValue([
      { id: "utente-1", ruolo: "AMMINISTRATORE", attivo: true, collaboratore: null },
    ]);
    mockDb.utente.count.mockResolvedValue(0);

    await cambiaStatoUtenteAction(formCambioStato(false));

    expect(mockDb.utente.updateMany).not.toHaveBeenCalled();
    expect(mockDb.collaboratore.updateMany).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/utenti?errore=ultimo-amministratore");
  });

  it("rifiuta per intero una selezione che comprende tutti gli amministratori attivi", async () => {
    mockDb.utente.findMany.mockResolvedValue([
      { id: "utente-1", ruolo: "AMMINISTRATORE", attivo: true, collaboratore: null },
      { id: "utente-2", ruolo: "AMMINISTRATORE", attivo: true, collaboratore: null },
      { id: "utente-3", ruolo: "COLLABORATORE", attivo: true, collaboratore: { id: "collaboratore-3" } },
    ]);
    mockDb.utente.count.mockResolvedValue(0);

    await cambiaStatoUtenteAction(
      formCambioStato(false, ["utente-1", "utente-2", "utente-3"]),
    );

    expect(mockDb.utente.count).toHaveBeenCalledWith(
      contaAltriAmministratori(["utente-1", "utente-2", "utente-3"]),
    );
    expect(mockDb.utente.updateMany).not.toHaveBeenCalled();
    expect(mockDb.collaboratore.updateMany).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/utenti?errore=ultimo-amministratore");
  });

  it("disattiva un amministratore quando ne rimane almeno un altro attivo", async () => {
    mockDb.utente.findMany.mockResolvedValue([
      { id: "utente-1", ruolo: "AMMINISTRATORE", attivo: true, collaboratore: null },
    ]);
    mockDb.utente.count.mockResolvedValue(1);

    await cambiaStatoUtenteAction(formCambioStato(false));

    expect(mockDb.utente.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["utente-1"] } },
      data: { attivo: false },
    });
    expect(mockRevalidatePath).toHaveBeenCalledTimes(2);
    expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/utenti?esito=disattivato");
  });

  it("riattiva un amministratore senza applicare la protezione dell'ultimo admin", async () => {
    mockDb.utente.findMany.mockResolvedValue([
      { id: "utente-1", ruolo: "AMMINISTRATORE", attivo: false, collaboratore: null },
    ]);

    await cambiaStatoUtenteAction(formCambioStato(true));

    expect(mockDb.utente.count).not.toHaveBeenCalled();
    expect(mockDb.utente.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["utente-1"] } },
      data: { attivo: true },
    });
    expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/utenti?esito=riattivato");
  });

  it("dopo un conflitto rilegge il numero di amministratori e blocca la disattivazione dell'ultimo", async () => {
    mockDb.utente.findMany.mockResolvedValue([
      { id: "utente-1", ruolo: "AMMINISTRATORE", attivo: true, collaboratore: null },
    ]);
    mockDb.utente.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    mockDb.utente.updateMany.mockRejectedValueOnce({
      name: "DriverAdapterError",
      cause: { originalCode: "40001", kind: "TransactionWriteConflict" },
    });

    await cambiaStatoUtenteAction(formCambioStato(false));

    expect(mockDb.$transaction).toHaveBeenCalledTimes(2);
    expect(mockDb.utente.count).toHaveBeenCalledTimes(2);
    expect(mockDb.utente.updateMany).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/utenti?errore=ultimo-amministratore");
  });

  it.each([
      ["P2034", { code: "P2034" }],
      ["PrismaPg al commit", {
        name: "DriverAdapterError",
        cause: { originalCode: "40001", kind: "TransactionWriteConflict" },
      }],
    ])("usa Serializable e ritenta il conflitto %s", async (_, conflitto) => {
    mockDb.$transaction
      .mockRejectedValueOnce(conflitto)
      .mockImplementationOnce(
        async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
      );
    mockDb.utente.findMany.mockResolvedValue([
      { id: "utente-1", ruolo: "COLLABORATORE", attivo: true, collaboratore: null },
    ]);

    await cambiaStatoUtenteAction(formCambioStato(false));

    expect(mockDb.$transaction).toHaveBeenCalledTimes(2);
    expect(mockDb.$transaction).toHaveBeenNthCalledWith(1, expect.any(Function), { isolationLevel: "Serializable" });
    expect(mockDb.$transaction).toHaveBeenNthCalledWith(2, expect.any(Function), { isolationLevel: "Serializable" });
    expect(mockDb.utente.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["utente-1"] } },
      data: { attivo: false },
    });
  });

  it("propaga il fallimento della guardia senza accedere al database", async () => {
    mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

    await expect(cambiaStatoUtenteAction(formCambioStato(false))).rejects.toThrow("Accesso negato");

    expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
    expect(mockDb.$transaction).not.toHaveBeenCalled();
    expect(mockDb.utente.findMany).not.toHaveBeenCalled();
    expect(mockDb.utente.updateMany).not.toHaveBeenCalled();
    expect(mockDb.collaboratore.updateMany).not.toHaveBeenCalled();
  });
});
