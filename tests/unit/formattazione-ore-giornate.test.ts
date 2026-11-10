import { describe, expect, it } from "vitest";
import { formattaGiornate, formattaNumeroGiornate, formattaOre } from "@/lib/formattazione";

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
