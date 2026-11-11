import { describe, it, expect } from "vitest";
import {
  PERMESSI,
  PERMESSI_PER_RUOLO,
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
