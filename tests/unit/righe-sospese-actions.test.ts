import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  rigaAttivitaSospesa: { updateMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

const { mockRichiediRuoloApi } = vi.hoisted(() => ({ mockRichiediRuoloApi: vi.fn() }));

vi.mock("@/lib/dal", () => ({ richiediRuoloApi: mockRichiediRuoloApi }));

const { mockRevalidatePath } = vi.hoisted(() => ({ mockRevalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

import { cambiaRisoluzioneRigheSospeseAction } from "@/app/(back-office)/righe-sospese/actions";

function formRisoluzione(risolta: boolean, id: string[]): FormData {
  const formData = new FormData();
  for (const valore of id) formData.append("id", valore);
  formData.set("risolta", String(risolta));
  return formData;
}

describe("cambiaRisoluzioneRigheSospeseAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRichiediRuoloApi.mockResolvedValue(undefined);
  });

  it("valorizza risoltaIl solo sulle righe selezionate ancora aperte", async () => {
    await cambiaRisoluzioneRigheSospeseAction(formRisoluzione(true, ["riga-1", "riga-2", "riga-1"]));

    expect(mockRichiediRuoloApi).toHaveBeenCalledWith("AMMINISTRATORE");
    expect(mockDb.rigaAttivitaSospesa.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["riga-1", "riga-2"] }, risoltaIl: null },
      data: { risoltaIl: expect.any(Date) },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/righe-sospese");
  });

  it("azzera risoltaIl sulle righe selezionate già risolte", async () => {
    await cambiaRisoluzioneRigheSospeseAction(formRisoluzione(false, ["riga-3"]));

    expect(mockDb.rigaAttivitaSospesa.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["riga-3"] }, risoltaIl: { not: null } },
      data: { risoltaIl: null },
    });
  });

  it("senza selezione non scrive nulla", async () => {
    await cambiaRisoluzioneRigheSospeseAction(formRisoluzione(true, []));

    expect(mockDb.rigaAttivitaSospesa.updateMany).not.toHaveBeenCalled();
  });

  it("rifiuta chi non è amministratore prima di scrivere", async () => {
    mockRichiediRuoloApi.mockRejectedValue(new Error("Accesso negato"));

    await expect(
      cambiaRisoluzioneRigheSospeseAction(formRisoluzione(true, ["riga-1"])),
    ).rejects.toThrow("Accesso negato");
    expect(mockDb.rigaAttivitaSospesa.updateMany).not.toHaveBeenCalled();
  });
});
