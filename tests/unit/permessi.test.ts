import { describe, it, expect } from "vitest";
import {
  PERMESSI,
  PERMESSI_BACK_OFFICE,
  PERMESSI_PER_RUOLO,
  haAccessoBackOffice,
  permessiDelRuolo,
} from "@/domain/permessi";

describe("catalogo dei permessi", () => {
  it("elenca i dodici permessi nominati, senza duplicati", () => {
    expect([...PERMESSI]).toEqual([
      "GESTIRE_OFFERTE",
      "GESTIRE_ABILITAZIONI",
      "GESTIRE_CLIENTI",
      "GESTIRE_COLLABORATORI",
      "GESTIRE_UTENTI",
      "GESTIRE_VOCI_RIMBORSO",
      "GESTIRE_RIGHE_SOSPESE",
      "GESTIRE_IMPORTAZIONE",
      "CONSULTARE_REPORT_FATTURAZIONE_CLIENTI",
      "CONSULTARE_REPORT_FATTURAZIONE_COLLABORATORI",
      "CONSULTARE_REPORT_MARGINALITA",
      "CONSULTARE_FOGLI_ATTIVITA_ALTRUI",
    ]);
    expect(new Set(PERMESSI).size).toBe(PERMESSI.length);
  });
});

describe("mappa ruolo → permessi", () => {
  it.each(PERMESSI)("AMMINISTRATORE possiede %s", (permesso) => {
    expect(PERMESSI_PER_RUOLO.AMMINISTRATORE).toContain(permesso);
  });

  it("COLLABORATORE non ha alcun permesso", () => {
    expect(PERMESSI_PER_RUOLO.COLLABORATORE).toEqual([]);
  });

  it("permessiDelRuolo restituisce l'insieme della mappa", () => {
    expect(permessiDelRuolo("AMMINISTRATORE")).toEqual([...PERMESSI]);
    expect(permessiDelRuolo("COLLABORATORE")).toEqual([]);
  });
});

describe("haAccessoBackOffice", () => {
  it("i permessi di back office sono tutti tranne quello dei fogli altrui", () => {
    expect(PERMESSI_BACK_OFFICE).not.toContain("CONSULTARE_FOGLI_ATTIVITA_ALTRUI");
    expect(PERMESSI_BACK_OFFICE).toHaveLength(PERMESSI.length - 1);
  });

  it("vale true per l'amministratore e per il catalogo completo", () => {
    expect(haAccessoBackOffice(PERMESSI)).toBe(true);
    expect(haAccessoBackOffice(permessiDelRuolo("AMMINISTRATORE"))).toBe(true);
  });

  it("vale false senza permessi e per il collaboratore", () => {
    expect(haAccessoBackOffice([])).toBe(false);
    expect(haAccessoBackOffice(permessiDelRuolo("COLLABORATORE"))).toBe(false);
  });

  it("vale false con il solo permesso dei fogli altrui, che è di front office", () => {
    expect(haAccessoBackOffice(["CONSULTARE_FOGLI_ATTIVITA_ALTRUI"])).toBe(false);
  });

  it("vale true con un singolo permesso di back office", () => {
    expect(haAccessoBackOffice(["GESTIRE_IMPORTAZIONE"])).toBe(true);
    expect(haAccessoBackOffice(["CONSULTARE_REPORT_FATTURAZIONE_CLIENTI"])).toBe(true);
  });
});
