import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), crea: vi.fn(), applica: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/dal", () => ({ richiediRuoloApi: mocks.auth }));
vi.mock("@/lib/importer-legacy/servizio", () => ({ creaAnteprima: mocks.crea, applicaAnteprima: mocks.applica }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { analizzaAction, importaAction } from "@/app/(back-office)/importazione/actions";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ utenteId: "admin" }); mocks.crea.mockResolvedValue({ id: "job" }); mocks.applica.mockResolvedValue({}); });
describe("autorizzazione e azioni importer", () => {
  it.each([analizzaAction, importaAction])("rifiuta l'accesso prima di leggere il foglio o scrivere", async (action) => {
    mocks.auth.mockRejectedValue(new Error("Vietato"));
    await expect(action(new FormData())).rejects.toThrow("Vietato");
    expect(mocks.crea).not.toHaveBeenCalled(); expect(mocks.applica).not.toHaveBeenCalled();
  });
  it("non accetta modalità diverse dalle due previste", async () => {
    const f = new FormData(); f.set("modalita", "invalida");
    await expect(analizzaAction(f)).rejects.toThrow("errore="); expect(mocks.crea).not.toHaveBeenCalled();
  });
  it("apre solo l'anteprima appena creata dall'analisi", async () => {
    const f = new FormData(); f.set("modalita", "INCREMENTALE");
    await expect(analizzaAction(f)).rejects.toThrow("REDIRECT /importazione?id=job");
    expect(mocks.crea).toHaveBeenCalledWith("admin", "INCREMENTALE");
  });
  it("invia solo le decisioni esplicite e la revisione al servizio protetto", async () => {
    const f = new FormData(); f.set("id", "job"); f.set("revisione", "rev"); f.set("scelta:abc", "NUOVA"); f.append("clienteAI", "cliente");
    await expect(importaAction(f)).rejects.toThrow("salvata=1");
    expect(mocks.applica).toHaveBeenCalledWith("job", "rev", [{ chiave: "abc", azione: "NUOVA" }], ["cliente"], "", false);
  });
  it("inoltra la scelta ambigua e la conferma SENZA CODICE", async () => {
    const f = new FormData(); f.set("id", "job"); f.set("revisione", "rev"); f.set("scelta:abc", "SENZA_CODICE"); f.set("confermaSenzaCodice", "on");
    await expect(importaAction(f)).rejects.toThrow("salvata=1");
    expect(mocks.applica).toHaveBeenCalledWith("job", "rev", [{ chiave: "abc", azione: "SENZA_CODICE" }], [], "", true);
  });
  it("mantiene l'anteprima corrente se la conferma fallisce", async () => {
    mocks.applica.mockRejectedValue(new Error("Errore"));
    const f = new FormData(); f.set("id", "job");
    await expect(importaAction(f)).rejects.toThrow("REDIRECT /importazione?id=job&errore=");
  });
});
