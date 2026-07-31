import { describe, it, expect } from "vitest";
import {
  validaVoceRimborso,
  type DatiVoceRimborsoInput,
} from "@/domain/anagrafiche/valida-voce-rimborso";

function baseInput(
  overrides: Partial<DatiVoceRimborsoInput> = {}
): DatiVoceRimborsoInput {
  return {
    etichetta: "Trasferta fuori regione",
    importo: "28,00",
    ...overrides,
  };
}

describe("validaVoceRimborso — etichetta", () => {
  it("restituisce errore se l'etichetta è vuota", () => {
    const errori = validaVoceRimborso(baseInput({ etichetta: "" }));
    expect(errori.etichetta).toBe("L'etichetta è obbligatoria");
  });

  it("rifiuta un'etichetta composta solo da spazi", () => {
    const errori = validaVoceRimborso(baseInput({ etichetta: "   " }));
    expect(errori.etichetta).toBe("L'etichetta è obbligatoria");
  });

  it("accetta un'etichetta valorizzata", () => {
    const errori = validaVoceRimborso(
      baseInput({ etichetta: "Trasferta in giornata" })
    );
    expect(errori.etichetta).toBeUndefined();
  });
});

describe("validaVoceRimborso — importo forfettario", () => {
  it("restituisce errore se l'importo è vuoto", () => {
    const errori = validaVoceRimborso(baseInput({ importo: "" }));
    expect(errori.importo).toBe("L'importo forfettario è obbligatorio");
  });

  it("rifiuta zero", () => {
    const errori = validaVoceRimborso(baseInput({ importo: "0" }));
    expect(errori.importo).toBe("L'importo deve essere maggiore di zero");
  });

  it("rifiuta un importo negativo", () => {
    const errori = validaVoceRimborso(baseInput({ importo: "-5,00" }));
    expect(errori.importo).toBe("Importo non valido: usa massimo 2 decimali");
  });

  it("rifiuta un valore testuale", () => {
    const errori = validaVoceRimborso(baseInput({ importo: "abc" }));
    expect(errori.importo).toBe("Importo non valido: usa massimo 2 decimali");
  });

  it("rifiuta più di due cifre decimali", () => {
    const errori = validaVoceRimborso(baseInput({ importo: "28,999" }));
    expect(errori.importo).toBe("Importo non valido: usa massimo 2 decimali");
  });

  it("accetta un importo con la virgola", () => {
    const errori = validaVoceRimborso(baseInput({ importo: "28,50" }));
    expect(errori.importo).toBeUndefined();
  });

  it("accetta un importo con il punto", () => {
    const errori = validaVoceRimborso(baseInput({ importo: "28.50" }));
    expect(errori.importo).toBeUndefined();
  });
});

describe("validaVoceRimborso — record valido", () => {
  it("restituisce mappa vuota quando tutti i campi sono validi", () => {
    expect(validaVoceRimborso(baseInput())).toEqual({});
  });
});
