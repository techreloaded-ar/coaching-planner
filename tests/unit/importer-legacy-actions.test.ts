import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), crea: vi.fn(), applica: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/dal", () => ({ richiediPermessoApi: mocks.auth }));
vi.mock("@/lib/importer-legacy/servizio", () => ({ creaAnteprima: mocks.crea, applicaAnteprima: mocks.applica }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { analizzaAction, importaAction } from "@/app/(back-office)/importazione/actions";
afterEach(() => vi.restoreAllMocks());
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}); mocks.auth.mockResolvedValue({ utenteId: "admin" }); mocks.crea.mockResolvedValue({ id: "job" }); mocks.applica.mockResolvedValue({}); });
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
    expect(mocks.auth).toHaveBeenCalledWith("GESTIRE_IMPORTAZIONE");
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

it.each([
  ["P2028", "Transazione di importazione interrotta o scaduta"],
  ["P2034", "I dati sono cambiati durante l’importazione"],
])("distingue %s e registra solo metadati senza dati riservati", async (code, messaggio) => {
  mocks.applica.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("SQL e dati riservati", { code, clientVersion: "test" }));
  const f = new FormData(); f.set("id", "job");
  await expect(importaAction(f)).rejects.toThrow(encodeURIComponent(messaggio));
  expect(console.error).toHaveBeenCalledWith("[importer-legacy] Operazione fallita", expect.objectContaining({ fase: "salvataggio", codice: code, durataMs: expect.any(Number) }));
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("riservati");
});
