import { describe, it, expect } from "vitest";
import {
  validaScaglione,
  verificaSogliaUnica,
  type DatiScaglioneInput,
} from "@/domain/anagrafiche/valida-scaglione";

function baseInput(overrides: Partial<DatiScaglioneInput> = {}): DatiScaglioneInput {
  return {
    finoAKm: "100",
    importo: "28,00",
    ...overrides,
  };
}

describe("validaScaglione — soglia massima", () => {
  it("restituisce errore se la soglia è vuota", () => {
    const errori = validaScaglione(baseInput({ finoAKm: "" }));
    expect(errori.finoAKm).toBe("La soglia massima è obbligatoria");
  });

  it("rifiuta un valore non intero", () => {
    const errori = validaScaglione(baseInput({ finoAKm: "100,5" }));
    expect(errori.finoAKm).toBe("Inserisci un numero intero di chilometri");
  });

  it("rifiuta un valore testuale", () => {
    const errori = validaScaglione(baseInput({ finoAKm: "cento" }));
    expect(errori.finoAKm).toBe("Inserisci un numero intero di chilometri");
  });

  it("rifiuta zero", () => {
    const errori = validaScaglione(baseInput({ finoAKm: "0" }));
    expect(errori.finoAKm).toBe("La soglia deve essere maggiore di zero");
  });

  it("rifiuta un valore negativo", () => {
    const errori = validaScaglione(baseInput({ finoAKm: "-10" }));
    expect(errori.finoAKm).toBe("Inserisci un numero intero di chilometri");
  });

  it("accetta un intero positivo", () => {
    const errori = validaScaglione(baseInput({ finoAKm: "100" }));
    expect(errori.finoAKm).toBeUndefined();
  });
});

describe("validaScaglione — importo forfettario", () => {
  it("restituisce errore se l'importo è vuoto", () => {
    const errori = validaScaglione(baseInput({ importo: "" }));
    expect(errori.importo).toBe("L'importo forfettario è obbligatorio");
  });

  it("rifiuta zero", () => {
    const errori = validaScaglione(baseInput({ importo: "0" }));
    expect(errori.importo).toBe("L'importo deve essere maggiore di zero");
  });

  it("rifiuta un importo negativo", () => {
    const errori = validaScaglione(baseInput({ importo: "-5,00" }));
    expect(errori.importo).toBe("Importo non valido: usa massimo 2 decimali");
  });

  it("rifiuta un valore testuale", () => {
    const errori = validaScaglione(baseInput({ importo: "abc" }));
    expect(errori.importo).toBe("Importo non valido: usa massimo 2 decimali");
  });

  it("rifiuta più di due cifre decimali", () => {
    const errori = validaScaglione(baseInput({ importo: "28,999" }));
    expect(errori.importo).toBe("Importo non valido: usa massimo 2 decimali");
  });

  it("accetta un importo con la virgola", () => {
    const errori = validaScaglione(baseInput({ importo: "28,50" }));
    expect(errori.importo).toBeUndefined();
  });

  it("accetta un importo con il punto", () => {
    const errori = validaScaglione(baseInput({ importo: "28.50" }));
    expect(errori.importo).toBeUndefined();
  });
});

describe("validaScaglione — record valido", () => {
  it("restituisce mappa vuota quando tutti i campi sono validi", () => {
    expect(validaScaglione(baseInput())).toEqual({});
  });
});

describe("verificaSogliaUnica", () => {
  const esistenti = [
    { id: "scg-1", finoAKm: 100 },
    { id: "scg-2", finoAKm: 200 },
  ];

  it("segnala la sovrapposizione con una soglia già usata", () => {
    expect(verificaSogliaUnica(100, esistenti)).toBe(
      "Esiste già uno scaglione con questa soglia: le soglie non possono sovrapporsi"
    );
  });

  it("ammette la modifica dello stesso scaglione escludendo il proprio id", () => {
    expect(verificaSogliaUnica(100, esistenti, "scg-1")).toBeNull();
  });

  it("non segnala nulla per una soglia nuova", () => {
    expect(verificaSogliaUnica(300, esistenti)).toBeNull();
  });
});
