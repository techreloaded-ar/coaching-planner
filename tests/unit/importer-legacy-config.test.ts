import { afterEach, describe, expect, it, vi } from "vitest";
import { configurazioneImporter, richiediImporter, statoConfigurazione } from "@/lib/importer-legacy/config";
import { analizza } from "@/lib/importer-legacy/analisi";

afterEach(() => vi.unstubAllEnvs());

describe("configurazione fissa dell'importatore", () => {
  it("permette l'import con sole sorgente e credenziali, anche con il vecchio flag disattivato", () => {
    vi.stubEnv("IMPORTER_ENABLED", "false");
    vi.stubEnv("IMPORTER_GOOGLE_SPREADSHEET_ID", "documento-test");
    vi.stubEnv("IMPORTER_GOOGLE_SERVICE_ACCOUNT_JSON", "credenziali-test");
    expect(richiediImporter().configurato).toBe(true);
    expect(statoConfigurazione()).not.toHaveProperty("credenziali");
  });

  it("richiede ancora una sorgente valida e le credenziali", () => {
    expect(configurazioneImporter({}).configurato).toBe(false);
    expect(configurazioneImporter({ IMPORTER_GOOGLE_SPREADSHEET_ID: "documento" }).configurato).toBe(false);
    expect(configurazioneImporter({ IMPORTER_GOOGLE_SPREADSHEET_ID: "https://esempio.it", IMPORTER_GOOGLE_SERVICE_ACCOUNT_JSON: "test" }).configurato).toBe(false);
    vi.stubEnv("IMPORTER_GOOGLE_SPREADSHEET_ID", "");
    expect(() => richiediImporter()).toThrow("Configura documento Google");
  });

  it("scarta sempre ND e usa il formato standard anche con vecchie variabili discordanti", () => {
    const cfg = configurazioneImporter({
      IMPORTER_SCHEDA_COACH: "coach2", IMPORTER_SCHEDA_GIORNATE: "altro",
      IMPORTER_CLIENTI_ESCLUSI: "", IMPORTER_CLIENTE_INTERNO: "altro",
      IMPORTER_PRIMO_MESE_TARIFFA: "non-valido",
    });
    const piano = analizza({ clienti: [{ cliente: "ND" }], offerte: [], coach: [],
      giornate: [{ cliente: " nd ", coach: "sconosciuto" }] },
    { clienti: [], offerte: [], utenti: [], giornate: [], rimborsi: [], registro: [] }, cfg);
    expect(piano.righe[0].stato).toBe("IGNORATA");
    expect(piano.anagrafiche.clienti).toEqual([]);
    expect(cfg.schede).toEqual({ clienti: "CLIENTI", offerte: "OFFERTE", coach: "COACH", giornate: "GIORNATE" });
    expect(cfg.clienteInterno).toBe("AGILERELOADED");
  });
});
