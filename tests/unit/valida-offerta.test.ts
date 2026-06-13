import { describe, it, expect } from "vitest";
import {
  normalizzaTariffaGiornaliera,
  validaOfferta,
  type DatiOffertaInput,
} from "@/domain/anagrafiche/valida-offerta";

function baseInput(overrides: Partial<DatiOffertaInput> = {}): DatiOffertaInput {
  return {
    codice: "OFF-2026-001",
    descrizione: "Percorso di coaching executive",
    tariffaGiornaliera: "650,00",
    giorniPrevisti: "10",
    ...overrides,
  };
}

describe("validaOfferta — campi obbligatori", () => {
  it("restituisce errore se il codice è vuoto", () => {
    const errori = validaOfferta(baseInput({ codice: "" }));
    expect(errori.codice).toBe("Il codice offerta è obbligatorio");
  });

  it("restituisce errore se la descrizione è vuota", () => {
    const errori = validaOfferta(baseInput({ descrizione: "" }));
    expect(errori.descrizione).toBe("La descrizione è obbligatoria");
  });
});

describe("validaOfferta — tariffa giornaliera", () => {
  it("accetta un importo con virgola", () => {
    const errori = validaOfferta(baseInput({ tariffaGiornaliera: "650,50" }));
    expect(errori.tariffaGiornaliera).toBeUndefined();
  });

  it("accetta un importo con punto", () => {
    const errori = validaOfferta(baseInput({ tariffaGiornaliera: "650.50" }));
    expect(errori.tariffaGiornaliera).toBeUndefined();
  });

  it("rifiuta zero", () => {
    const errori = validaOfferta(baseInput({ tariffaGiornaliera: "0" }));
    expect(errori.tariffaGiornaliera).toBe(
      "La tariffa giornaliera deve essere maggiore di zero"
    );
  });

  it("rifiuta un importo negativo", () => {
    const errori = validaOfferta(baseInput({ tariffaGiornaliera: "-12,00" }));
    expect(errori.tariffaGiornaliera).toBe(
      "Importo non valido: usa massimo 2 decimali"
    );
  });

  it("rifiuta un valore testuale", () => {
    const errori = validaOfferta(baseInput({ tariffaGiornaliera: "abc" }));
    expect(errori.tariffaGiornaliera).toBe(
      "Importo non valido: usa massimo 2 decimali"
    );
  });

  it("rifiuta più di due cifre decimali", () => {
    const errori = validaOfferta(baseInput({ tariffaGiornaliera: "10,999" }));
    expect(errori.tariffaGiornaliera).toBe(
      "Importo non valido: usa massimo 2 decimali"
    );
  });
});

describe("validaOfferta — giorni previsti", () => {
  it("rifiuta zero", () => {
    const errori = validaOfferta(baseInput({ giorniPrevisti: "0" }));
    expect(errori.giorniPrevisti).toBe(
      "I giorni previsti devono essere maggiori di zero"
    );
  });

  it("rifiuta un numero negativo", () => {
    const errori = validaOfferta(baseInput({ giorniPrevisti: "-2" }));
    expect(errori.giorniPrevisti).toBe(
      "I giorni previsti devono essere maggiori di zero"
    );
  });

  it("rifiuta un numero decimale", () => {
    const errori = validaOfferta(baseInput({ giorniPrevisti: "2.5" }));
    expect(errori.giorniPrevisti).toBe(
      "Inserisci un numero intero di giorni (es. 10)"
    );
  });

  it("rifiuta un valore testuale", () => {
    const errori = validaOfferta(baseInput({ giorniPrevisti: "dieci" }));
    expect(errori.giorniPrevisti).toBe(
      "Inserisci un numero intero di giorni (es. 10)"
    );
  });
});

describe("validaOfferta — record valido", () => {
  it("restituisce oggetto vuoto quando tutti i campi sono validi", () => {
    const errori = validaOfferta(baseInput());
    expect(errori).toEqual({});
  });
});

describe("normalizzaTariffaGiornaliera", () => {
  it("normalizza la virgola in formato decimale stabile", () => {
    expect(normalizzaTariffaGiornaliera("650,5")).toEqual({
      valore: "650.50",
      centesimi: 65050n,
    });
  });

  it("restituisce null per input non valido", () => {
    expect(normalizzaTariffaGiornaliera("12,345")).toBeNull();
  });
});
