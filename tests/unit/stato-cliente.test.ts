import { describe, expect, it } from "vitest";
import {
  etichettaStatoCliente,
  leggiFiltroStatoCliente,
  parametriFiltroStatoCliente,
  statoCliente,
} from "@/domain/anagrafiche/stato-cliente";
import { leggiNoteDaForm } from "@/domain/anagrafiche/note";

describe("statoCliente", () => {
  it("è attivo con almeno un'offerta attiva e conta solo quelle attive", () => {
    expect(statoCliente([{ attiva: true }, { attiva: false }, { attiva: true }])).toEqual({
      tipo: "ATTIVO",
      numeroOfferte: 2,
    });
  });

  it("è nuovo senza offerte collegate", () => {
    expect(statoCliente([])).toEqual({ tipo: "NUOVO", numeroOfferte: 0 });
  });

  it("è non attivo con offerte tutte chiuse e conta le offerte chiuse", () => {
    expect(statoCliente([{ attiva: false }, { attiva: false }])).toEqual({
      tipo: "NON_ATTIVO",
      numeroOfferte: 2,
    });
  });
});

describe("etichettaStatoCliente", () => {
  it("usa testi brevi con singolare e plurale", () => {
    expect(etichettaStatoCliente({ tipo: "ATTIVO", numeroOfferte: 1 })).toBe("1 attiva");
    expect(etichettaStatoCliente({ tipo: "ATTIVO", numeroOfferte: 3 })).toBe("3 attive");
    expect(etichettaStatoCliente({ tipo: "NUOVO", numeroOfferte: 0 })).toBe("Nuovo");
    expect(etichettaStatoCliente({ tipo: "NON_ATTIVO", numeroOfferte: 1 })).toBe("1 chiusa");
    expect(etichettaStatoCliente({ tipo: "NON_ATTIVO", numeroOfferte: 5 })).toBe("5 chiuse");
  });
});

describe("filtro stato clienti nell'URL", () => {
  it("senza parametro, o con soli valori sconosciuti, seleziona attivi e nuovi", () => {
    expect(leggiFiltroStatoCliente(undefined)).toEqual(["ATTIVO", "NUOVO"]);
    expect(leggiFiltroStatoCliente("boh")).toEqual(["ATTIVO", "NUOVO"]);
  });

  it("legge gli stati richiesti nell'ordine del quick filter", () => {
    expect(leggiFiltroStatoCliente("non-attivi,attivi")).toEqual(["ATTIVO", "NON_ATTIVO"]);
    expect(leggiFiltroStatoCliente(["non-attivi"])).toEqual(["NON_ATTIVO"]);
  });

  it("omette il parametro per la selezione predefinita o vuota", () => {
    expect(parametriFiltroStatoCliente(["NUOVO", "ATTIVO"])).toEqual({});
    expect(parametriFiltroStatoCliente([])).toEqual({});
  });

  it("scrive gli altri filtri e li rilegge identici", () => {
    const parametri = parametriFiltroStatoCliente(["NON_ATTIVO", "ATTIVO", "NUOVO"]);
    expect(parametri).toEqual({ stato: "attivi,nuovi,non-attivi" });
    expect(leggiFiltroStatoCliente(parametri.stato)).toEqual(["ATTIVO", "NUOVO", "NON_ATTIVO"]);
  });
});

describe("leggiNoteDaForm", () => {
  function formConNote(note?: string): FormData {
    const formData = new FormData();
    if (note !== undefined) formData.set("note", note);
    return formData;
  }

  it("conserva gli a capo togliendo gli spazi esterni", () => {
    expect(leggiNoteDaForm(formConNote("  riga 1\nriga 2  "))).toBe("riga 1\nriga 2");
  });

  it("salva come vuote le note assenti o di soli spazi", () => {
    expect(leggiNoteDaForm(formConNote())).toBeNull();
    expect(leggiNoteDaForm(formConNote(" \n  "))).toBeNull();
  });
});
