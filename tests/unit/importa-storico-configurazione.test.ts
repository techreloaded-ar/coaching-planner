import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { caricaConfigurazione } from "../../scripts/importa-storico/configurazione";

const VARIABILI_MINIME = [
  'DATABASE_URL="postgresql://utente:password@localhost:5432/prova"',
  'FOGLIO_ORIGINE="https://docs.google.com/spreadsheets/d/abc/edit"',
];

const cartelleTemporanee: string[] = [];

function scriviConfigurazione(righe: string[]): string {
  const cartella = mkdtempSync(path.join(tmpdir(), "importa-storico-config-"));
  cartelleTemporanee.push(cartella);
  const percorso = path.join(cartella, ".env.importa-storico");
  writeFileSync(percorso, [...VARIABILI_MINIME, ...righe].join("\n") + "\n");
  return percorso;
}

afterEach(() => {
  for (const cartella of cartelleTemporanee.splice(0)) rmSync(cartella, { recursive: true, force: true });
});

describe("caricaConfigurazione: GIORNATE_REIMPORTA_DAL", () => {
  it("vale 2026-01-01 se non indicata", () => {
    expect(caricaConfigurazione(scriviConfigurazione([])).giornateReimportaDal).toBe("2026-01-01");
  });

  it("legge la data indicata nel file", () => {
    expect(caricaConfigurazione(scriviConfigurazione(["GIORNATE_REIMPORTA_DAL=2027-01-01"])).giornateReimportaDal).toBe("2027-01-01");
  });

  it("rifiuta una data non nel formato YYYY-MM-DD", () => {
    expect(() => caricaConfigurazione(scriviConfigurazione(["GIORNATE_REIMPORTA_DAL=01/01/2026"]))).toThrow(/GIORNATE_REIMPORTA_DAL/);
    expect(() => caricaConfigurazione(scriviConfigurazione(["GIORNATE_REIMPORTA_DAL=2026-13-01"]))).toThrow(/GIORNATE_REIMPORTA_DAL/);
  });
});
