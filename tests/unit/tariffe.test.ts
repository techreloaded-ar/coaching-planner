import { describe, it, expect } from "vitest";
import {
  etichettaMeseTariffa,
  periodiDiValidita,
  tariffaValidaNelMese,
  validaVoceTariffa,
  type DatiVoceTariffaInput,
} from "@/domain/tariffe";

const gennaio = { validaDalMese: "2026-01", importo: "400" };
const luglio = { validaDalMese: "2026-07", importo: "6500" };
const ottobre = { validaDalMese: "2026-10", importo: "450" };

describe("tariffaValidaNelMese", () => {
  it("sceglie la voce con decorrenza più recente non successiva al mese", () => {
    const voci = [gennaio, luglio, ottobre];

    expect(tariffaValidaNelMese(voci, "2026-01")).toBe(gennaio);
    expect(tariffaValidaNelMese(voci, "2026-06")).toBe(gennaio);
    expect(tariffaValidaNelMese(voci, "2026-07")).toBe(luglio);
    expect(tariffaValidaNelMese(voci, "2026-09")).toBe(luglio);
    expect(tariffaValidaNelMese(voci, "2027-03")).toBe(ottobre);
  });

  it("restituisce null prima della prima voce e con storico vuoto", () => {
    expect(tariffaValidaNelMese([gennaio, luglio], "2025-12")).toBeNull();
    expect(tariffaValidaNelMese([], "2026-05")).toBeNull();
  });

  it("non dipende dall'ordine delle voci", () => {
    expect(tariffaValidaNelMese([ottobre, gennaio, luglio], "2026-08")).toBe(luglio);
  });
});

describe("validaVoceTariffa", () => {
  function voce(modifiche: Partial<DatiVoceTariffaInput> = {}): DatiVoceTariffaInput {
    return { validaDalMese: "2026-07", modalita: "GIORNALIERA", importo: "450", ...modifiche };
  }

  it("accetta una voce valida, anche con importo con virgola e fisso mensile", () => {
    expect(validaVoceTariffa(voce())).toEqual({});
    expect(validaVoceTariffa(voce({ importo: "450,50" }))).toEqual({});
    expect(validaVoceTariffa(voce({ modalita: "FISSO_MENSILE", importo: "6500" }))).toEqual({});
  });

  it.each(["", "2026-13", "2026-7", "07-2026", "luglio"])(
    "rifiuta un mese di decorrenza non nel formato YYYY-MM: '%s'",
    (validaDalMese) => {
      expect(validaVoceTariffa(voce({ validaDalMese })).validaDalMese).toBe(
        "Indica il mese da cui la tariffa è valida",
      );
    },
  );

  it.each(["", "ORARIA", "giornaliera"])("rifiuta una modalità sconosciuta: '%s'", (modalita) => {
    expect(validaVoceTariffa(voce({ modalita })).modalita).toBe(
      "Scegli la modalità della tariffa",
    );
  });

  it.each(["", "   "])("rifiuta l'importo vuoto %#", (importo) => {
    expect(validaVoceTariffa(voce({ importo })).importo).toBe("L'importo è obbligatorio");
  });

  it("rifiuta l'importo pari a zero", () => {
    expect(validaVoceTariffa(voce({ importo: "0" })).importo).toBe(
      "L'importo deve essere maggiore di zero",
    );
  });

  it.each(["10,999", "-12,00", "abc"])("rifiuta l'importo non valido '%s'", (importo) => {
    expect(validaVoceTariffa(voce({ importo })).importo).toBe(
      "Importo non valido: usa massimo 2 decimali",
    );
  });
});

describe("periodiDiValidita", () => {
  it("chiude ogni voce al mese precedente la successiva e lascia aperta l'ultima", () => {
    const periodi = periodiDiValidita([ottobre, gennaio, luglio]);

    expect(periodi.get(gennaio)).toBe("gen 2026 → giu 2026");
    expect(periodi.get(luglio)).toBe("lug 2026 → set 2026");
    expect(periodi.get(ottobre)).toBe("ott 2026 → in corso");
  });

  it("mostra un solo mese quando la voce dura un mese", () => {
    const giugno = { validaDalMese: "2026-06" };
    const periodi = periodiDiValidita([giugno, luglio]);

    expect(periodi.get(giugno)).toBe("giu 2026");
  });

  it("chiude un periodo a cavallo d'anno", () => {
    const novembre = { validaDalMese: "2025-11" };
    const periodi = periodiDiValidita([novembre, gennaio]);

    expect(periodi.get(novembre)).toBe("nov 2025 → dic 2025");
  });
});

describe("etichettaMeseTariffa", () => {
  it("formatta il token come mese abbreviato e anno, lasciando invariato un token non valido", () => {
    expect(etichettaMeseTariffa("2026-07")).toBe("lug 2026");
    expect(etichettaMeseTariffa("non-valido")).toBe("non-valido");
  });
});
