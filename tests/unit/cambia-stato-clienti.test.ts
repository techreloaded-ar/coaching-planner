import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCliente, mockRichiediRuoloApi, mockRedirect } = vi.hoisted(() => ({
  mockCliente: { updateMany: vi.fn() },
  mockRichiediRuoloApi: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { cliente: mockCliente } }));
vi.mock("@/lib/dal", () => ({ richiediRuoloApi: mockRichiediRuoloApi }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

import { cambiaStatoAction } from "@/app/(back-office)/anagrafiche/clienti/cambia-stato-action";

describe("cambiaStatoAction (clienti)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
  });

  it("disattiva tutti i clienti selezionati e riporta alla stessa posizione dell'elenco", async () => {
    const formData = new FormData();
    formData.append("id", "cliente-1");
    formData.append("id", "cliente-2");
    formData.set("attivo", "false");
    formData.set("q", "alfa");
    formData.set("pagina", "2");

    await cambiaStatoAction(formData);

    expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
    expect(mockCliente.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["cliente-1", "cliente-2"] } },
      data: { attivo: false },
    });
    expect(mockRedirect).toHaveBeenCalledWith("/anagrafiche/clienti?q=alfa&pagina=2");
  });

  it("senza clienti selezionati non aggiorna nulla", async () => {
    mockRedirect.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });
    const formData = new FormData();
    formData.set("attivo", "true");

    await expect(cambiaStatoAction(formData)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockCliente.updateMany).not.toHaveBeenCalled();
  });
});
