import { describe, expect, it } from "vitest";
import {
  formattaEuro,
  formattaEuroArrotondato,
  formattaEuroConSimboloDavanti,
  formattaGiornate,
  formattaNumero,
  formattaNumeroGiornate,
  formattaOre,
} from "@/lib/formattazione";

describe("formattazione di ore e giornate", () => {
  it("usa la virgola, fino a due decimali e senza zeri finali", () => {
    expect(formattaOre(8)).toBe("8 h");
    expect(formattaOre(6.5)).toBe("6,5 h");
    expect(formattaOre(7.25)).toBe("7,25 h");
    expect(formattaGiornate(29 / 8)).toBe("3,63 gg");
    expect(formattaGiornate(2)).toBe("2 gg");
    expect(formattaNumeroGiornate(0.125)).toBe("0,13");
  });
});

// Intl usa uno spazio non separabile tra numero e simbolo: lo si normalizza.
const testo = (valore: string) => valore.replace(/\u00a0/g, " ");

describe("separatore delle migliaia sempre presente", () => {
  it("lo mette anche sotto le 10.000 unità, dove l'italiano di Intl lo omette", () => {
    expect(formattaNumero(7010)).toBe("7.010");
    expect(formattaNumero(1234.5)).toBe("1.234,5");
    expect(formattaNumero(999)).toBe("999");
    expect(formattaGiornate(1250)).toBe("1.250 gg");
  });

  it("vale per tutti i formati in euro", () => {
    expect(testo(formattaEuro("6560"))).toBe("6.560,00 €");
    expect(formattaEuroConSimboloDavanti("6560")).toBe("€ 6.560,00");
    expect(testo(formattaEuroArrotondato("7010.00"))).toBe("7.010 €");
    expect(testo(formattaEuroArrotondato("7010.40"))).toBe("7.010 €");
  });
});
