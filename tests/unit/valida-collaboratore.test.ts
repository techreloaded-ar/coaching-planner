import { describe, it, expect } from "vitest";
import {
  normalizzaTariffaGiornaliera,
  validaCollaboratore,
  type DatiCollaboratoreInput,
} from "@/domain/anagrafiche/valida-collaboratore";

// ── Helper: crea un input minimo valido ────────────────────────

function baseInput(
  overrides: Partial<DatiCollaboratoreInput> = {}
): DatiCollaboratoreInput {
  return {
    nome: "Mario",
    cognome: "Rossi",
    partitaIva: "12345678901",
    tariffaGiornaliera: "650,00",
    ...overrides,
  };
}

// ── 1. Campi obbligatori ───────────────────────────────────────

describe("validaCollaboratore — campi obbligatori", () => {
  describe("nome", () => {
    it("restituisce errore se il nome è vuoto", () => {
      const errori = validaCollaboratore(baseInput({ nome: "" }));
      expect(errori.nome).toBe("Il nome è obbligatorio");
    });

    it("restituisce errore se il nome è composto solo da spazi", () => {
      const errori = validaCollaboratore(baseInput({ nome: "   " }));
      expect(errori.nome).toBe("Il nome è obbligatorio");
    });

    it("non segnala errore sul nome se valorizzato", () => {
      const errori = validaCollaboratore(baseInput({ nome: "Luca" }));
      expect(errori.nome).toBeUndefined();
    });
  });

  describe("cognome", () => {
    it("restituisce errore se il cognome è vuoto", () => {
      const errori = validaCollaboratore(baseInput({ cognome: "" }));
      expect(errori.cognome).toBe("Il cognome è obbligatorio");
    });

    it("restituisce errore se il cognome è composto solo da spazi", () => {
      const errori = validaCollaboratore(baseInput({ cognome: "   " }));
      expect(errori.cognome).toBe("Il cognome è obbligatorio");
    });

    it("non segnala errore sul cognome se valorizzato", () => {
      const errori = validaCollaboratore(baseInput({ cognome: "Bianchi" }));
      expect(errori.cognome).toBeUndefined();
    });
  });

  describe("partitaIva", () => {
    it("restituisce errore se la partita IVA è vuota", () => {
      const errori = validaCollaboratore(baseInput({ partitaIva: "" }));
      expect(errori.partitaIva).toBe("La partita IVA è obbligatoria");
    });

    it("restituisce errore se la partita IVA è composta solo da spazi", () => {
      const errori = validaCollaboratore(baseInput({ partitaIva: "   " }));
      expect(errori.partitaIva).toBe("La partita IVA è obbligatoria");
    });

    it("non segnala errore sulla partita IVA se valorizzata con 11 cifre", () => {
      const errori = validaCollaboratore(
        baseInput({ partitaIva: "98765432109" })
      );
      expect(errori.partitaIva).toBeUndefined();
    });
  });

  describe("tariffaGiornaliera", () => {
    it("restituisce errore se la tariffa giornaliera è vuota", () => {
      const errori = validaCollaboratore(
        baseInput({ tariffaGiornaliera: "" })
      );
      expect(errori.tariffaGiornaliera).toBe(
        "La tariffa giornaliera è obbligatoria"
      );
    });

    it("restituisce errore se la tariffa giornaliera è composta solo da spazi", () => {
      const errori = validaCollaboratore(
        baseInput({ tariffaGiornaliera: "   " })
      );
      expect(errori.tariffaGiornaliera).toBe(
        "La tariffa giornaliera è obbligatoria"
      );
    });

    it("non segnala errore sulla tariffa giornaliera se valorizzata correttamente", () => {
      const errori = validaCollaboratore(
        baseInput({ tariffaGiornaliera: "500,00" })
      );
      expect(errori.tariffaGiornaliera).toBeUndefined();
    });
  });

  it("non segnala errori quando tutti i campi obbligatori sono presenti", () => {
    const errori = validaCollaboratore(baseInput());
    expect(errori).toEqual({});
  });
});

// ── 3. Partita IVA — formato ───────────────────────────────────

describe("validaCollaboratore — formato partita IVA", () => {
  it("accetta 11 cifre", () => {
    const errori = validaCollaboratore(
      baseInput({ partitaIva: "12345678901" })
    );
    expect(errori.partitaIva).toBeUndefined();
  });

  it("rifiuta 10 cifre", () => {
    const errori = validaCollaboratore(
      baseInput({ partitaIva: "1234567890" })
    );
    expect(errori.partitaIva).toBe("La partita IVA deve essere di 11 cifre");
  });

  it("rifiuta 12 cifre", () => {
    const errori = validaCollaboratore(
      baseInput({ partitaIva: "123456789012" })
    );
    expect(errori.partitaIva).toBe("La partita IVA deve essere di 11 cifre");
  });

  it("rifiuta se contiene lettere", () => {
    const errori = validaCollaboratore(
      baseInput({ partitaIva: "1234567890A" })
    );
    expect(errori.partitaIva).toBe("La partita IVA deve essere di 11 cifre");
  });
});

// ── 4. Tariffa giornaliera ──────────────────────────────────────

describe("validaCollaboratore — tariffa giornaliera", () => {
  it("accetta un importo con virgola", () => {
    const errori = validaCollaboratore(
      baseInput({ tariffaGiornaliera: "650,50" })
    );
    expect(errori.tariffaGiornaliera).toBeUndefined();
  });

  it("accetta un importo con punto", () => {
    const errori = validaCollaboratore(
      baseInput({ tariffaGiornaliera: "650.50" })
    );
    expect(errori.tariffaGiornaliera).toBeUndefined();
  });

  it("rifiuta zero", () => {
    const errori = validaCollaboratore(
      baseInput({ tariffaGiornaliera: "0" })
    );
    expect(errori.tariffaGiornaliera).toBe(
      "La tariffa giornaliera deve essere maggiore di zero"
    );
  });

  it("rifiuta un importo negativo", () => {
    const errori = validaCollaboratore(
      baseInput({ tariffaGiornaliera: "-12,00" })
    );
    expect(errori.tariffaGiornaliera).toBe(
      "Importo non valido: usa massimo 2 decimali"
    );
  });

  it("rifiuta un valore testuale", () => {
    const errori = validaCollaboratore(
      baseInput({ tariffaGiornaliera: "abc" })
    );
    expect(errori.tariffaGiornaliera).toBe(
      "Importo non valido: usa massimo 2 decimali"
    );
  });

  it("rifiuta più di due cifre decimali", () => {
    const errori = validaCollaboratore(
      baseInput({ tariffaGiornaliera: "10,999" })
    );
    expect(errori.tariffaGiornaliera).toBe(
      "Importo non valido: usa massimo 2 decimali"
    );
  });
});

// ── 5. Record completamente valido ──────────────────────────────

describe("validaCollaboratore — record completamente valido", () => {
  it("restituisce oggetto vuoto quando tutti i campi sono validi", () => {
    const errori = validaCollaboratore(baseInput());
    expect(errori).toEqual({});
  });
});

// ── 6. normalizzaTariffaGiornaliera ──────────────────────────────

describe("normalizzaTariffaGiornaliera", () => {
  it("normalizza la virgola in formato decimale stabile", () => {
    expect(normalizzaTariffaGiornaliera("650,5")).toEqual({
      valore: "650.50",
      centesimi: BigInt(65050),
    });
  });

  it("normalizza il punto in formato decimale stabile", () => {
    expect(normalizzaTariffaGiornaliera("650.5")).toEqual({
      valore: "650.50",
      centesimi: BigInt(65050),
    });
  });

  it("normalizza un importo intero senza decimali", () => {
    expect(normalizzaTariffaGiornaliera("500")).toEqual({
      valore: "500.00",
      centesimi: BigInt(50000),
    });
  });

  it("restituisce null per input non valido (troppi decimali)", () => {
    expect(normalizzaTariffaGiornaliera("12,345")).toBeNull();
  });

  it("restituisce null per input non valido (formato '1.234,56')", () => {
    expect(normalizzaTariffaGiornaliera("1.234,56")).toBeNull();
  });
});
