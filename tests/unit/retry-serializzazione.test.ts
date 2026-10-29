import { describe, expect, it, vi } from "vitest";
import { eseguiConRetrySerializzazione } from "@/lib/retry-serializzazione";

function conflittoAlCommit() {
  return Object.assign(new Error("TransactionWriteConflict"), {
    name: "DriverAdapterError",
    cause: {
      originalCode: "40001",
      originalMessage: "could not serialize access due to read/write dependencies among transactions",
      kind: "TransactionWriteConflict",
    },
  });
}

describe("eseguiConRetrySerializzazione", () => {
  it.each([
    ["P2034", { code: "P2034" }],
    ["PrismaPg al commit", conflittoAlCommit()],
  ])("ritenta tutta l'operazione per %s e ne restituisce il risultato", async (_, errore) => {
    const operazione = vi.fn().mockRejectedValueOnce(errore).mockResolvedValue("salvato");
    await expect(eseguiConRetrySerializzazione(operazione)).resolves.toBe("salvato");
    expect(operazione).toHaveBeenCalledTimes(2);
  });

  it("propaga l'ultimo conflitto dopo tre retry, senza un ciclo infinito", async () => {
    const errore = conflittoAlCommit();
    const operazione = vi.fn().mockRejectedValue(errore);
    await expect(eseguiConRetrySerializzazione(operazione)).rejects.toBe(errore);
    expect(operazione).toHaveBeenCalledTimes(4);
  });

  it.each([
    null,
    "40001",
    { code: "P2002" },
    { code: "P2028" },
    new Error("40001"),
    { name: "DriverAdapterError", cause: { originalCode: "40P01", kind: "TransactionWriteConflict" } },
    { name: "DriverAdapterError", cause: { originalCode: "40001", kind: "ConnectionClosed" } },
    { name: "DriverAdapterError" },
  ])("non ritenta errori diversi dal conflitto di serializzazione: %j", async (errore) => {
    const operazione = vi.fn().mockRejectedValue(errore);
    await expect(eseguiConRetrySerializzazione(operazione)).rejects.toBe(errore);
    expect(operazione).toHaveBeenCalledTimes(1);
  });
});
