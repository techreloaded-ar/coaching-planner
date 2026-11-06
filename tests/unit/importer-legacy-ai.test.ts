import { afterEach, describe, expect, it, vi } from "vitest";
import { assisteConAI } from "@/lib/importer-legacy/ai";
import { analizza } from "@/lib/importer-legacy/analisi";
import { configurazioneImporter } from "@/lib/importer-legacy/config";

const env = { IMPORTER_AI_BASE_URL: "https://ai.example.com/v1", IMPORTER_AI_API_KEY: "secret", IMPORTER_AI_MODEL: "model" };
function piano() { return analizza({ clienti: [{ cliente: "Test", "indirizzo fatturazione": "Via Test 1" }], offerte: [], coach: [], giornate: [{ coach: "sconosciuto", data: "2026-11-05" }] }, { clienti: [], offerte: [], utenti: [], giornate: [], rimborsi: [], registro: [] }, configurazioneImporter({})); }
afterEach(() => vi.unstubAllGlobals());

describe("AI opzionale dell'importer", () => {
  it("senza configurazione non effettua richieste", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const p = piano(); const original = structuredClone(p);
    await assisteConAI(p, {}); expect(p).toEqual(original); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["rete", "http", "json", "schema", "dati"])("continua senza AI in caso di errore %s", async (failure) => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (failure === "rete") throw new DOMException("Timeout", "TimeoutError");
      if (failure === "http") return new Response("secret", { status: 500 });
      const content = failure === "json" ? "non json" : failure === "schema" ? "{}" : JSON.stringify({ righe: [], clienti: [{ id: "inesistente", dati: {} }] });
      return Response.json({ choices: [{ message: { content } }] });
    }));
    const p = piano(); const before = structuredClone(p);
    await assisteConAI(p, env);
    expect(p.ai).toContain("puoi continuare");
    expect(p.righe).toEqual(before.righe); expect(p.anagrafiche).toEqual(before.anagrafiche);
    expect(p.ai).not.toContain("secret");
  });
  it("mostra suggerimenti senza promuovere i casi dubbi e richiede verifica dei dati cliente", async () => {
    const p = piano();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ choices: [{ message: { content: JSON.stringify({ righe: [{ chiave: p.righe[0].chiave, suggerimento: "Verifica il collaboratore" }], clienti: [{ id: p.anagrafiche.clienti[0].id, dati: { indirizzo: "Via Test 1" } }] }) } }] })));
    await assisteConAI(p, env);
    expect(p.righe[0].stato).toBe("NON_IMPORTABILE"); expect(p.righe[0].suggerimento).toContain("Verifica");
    expect(p.anagrafiche.clienti[0].verifica).toBe(true);
    expect(p.anagrafiche.clienti[0].dati.note).toContain("Via Test 1");
  });
});
