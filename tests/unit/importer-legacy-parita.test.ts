import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import type { Configurazione } from "../../scripts/importa-storico/configurazione";
import type { Archivio, Celle, Schede } from "@/lib/importer-legacy/types";

const mocks = vi.hoisted(() => ({ leggi: vi.fn() }));
vi.mock("../../scripts/importa-storico/foglio", async (original) => ({
  ...await original<object>(), leggiScheda: mocks.leggi,
}));
vi.mock("node:fs", async (original) => ({ ...await original<object>(), mkdirSync: vi.fn(), writeFileSync: vi.fn() }));
import { importaGiornate } from "../../scripts/importa-storico/giornate";
import { analizza } from "@/lib/importer-legacy/analisi";
import { configurazioneImporter } from "@/lib/importer-legacy/config";

describe("parità con il motore giornate originale", () => {
  it("mantiene la parità salvo le offerte sconosciute ora recuperate su SENZA CODICE", async () => {
    const row = (extra: Celle = {}): Celle => ({ coach: "C1", cliente: "Cliente", "codice offerta": "OFF 2026", data: "2026-11-05", ore: "8", "tipologia fatturazione": "FATTURABILE", ...extra });
    const schede: Schede = { clienti: [], offerte: [], coach: [{ id: "C1", email: "coach@example.com", nome: "Coach", cognome: "Test" }], giornate: [
      row(), row(), row({ "spese coach": "abc" }), row({ "spese coach": "-2" }), row({ ore: "" }),
      row({ cliente: "ND" }), row({ coach: "assente" }), row({ "codice offerta": "assente" }),
      row({ data: "non leggibile" }), row({ ore: "abc" }), row({ ore: "100" }),
    ] };
    const archive: Archivio = { clienti: [{ id: "cliente", ragioneSociale: "Cliente" }], utenti: [{ id: "utente", email: "coach@example.com", collaboratore: { id: "coach" } }],
      offerte: [{ id: "offerta", clienteId: "cliente", codice: "OFF-2026" }], giornate: [], rimborsi: [], registro: [] };
    mocks.leggi.mockImplementation(async (_cfg, name: string) => {
      const righe = name === "COACH" ? schede.coach : schede.giornate;
      return { righe, intestazioni: Object.keys(righe[0]) };
    });
    const tx = {
      utente: { findMany: async () => archive.utenti }, cliente: { findMany: async () => archive.clienti },
      offerta: { findMany: async () => archive.offerte }, voceRimborsoTrasferta: { findMany: async () => [] },
      rigaAttivitaSospesa: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
      rigaAttivita: { createMany: async () => ({ count: 0 }) }, abilitazioneOfferta: { createMany: async () => ({ count: 0 }) },
    } as unknown as Prisma.TransactionClient;
    const cfg = { schede: { coach: "COACH", giornate: "GIORNATE" }, clientiEsclusi: new Set(["ND"]), clienteInterno: "AGILERELOADED", cartellaLavoro: "/unused", giornateReimportaDal: "2018-01-01" } as Configurazione;
    const originale = await importaGiornate(tx, cfg, { reset: true });
    const piano = analizza(schede, archive, configurazioneImporter({}));
    expect(piano.righe.filter((r) => r.stato === "NON_IMPORTABILE")).toHaveLength(Object.values(originale.sospesePerMotivo).reduce((a, n) => a + n, 0) - 1);
    expect(piano.righe.filter((r) => r.stato === "PRONTA")).toHaveLength(originale.importate + 1);
    expect(piano.righe.filter((r) => r.senzaCodice)).toHaveLength(1);
    expect(piano.righe.filter((r) => r.stato === "IGNORATA")).toHaveLength(originale.righeDiClientiEsclusi);
    expect(piano.righe.filter((r) => r.stato === "VERIFICARE")).toHaveLength(0);
  });
});
