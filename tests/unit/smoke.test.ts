import { describe, it, expect } from "vitest";
import { ORE_PER_GIORNATA } from "@/domain/types";

describe("Coaching Planner — test di fumo", () => {
  it("la costante ORE_PER_GIORNATA deve valere 8", () => {
    expect(ORE_PER_GIORNATA).toBe(8);
  });

  it("l'import del modulo di dominio funziona correttamente", () => {
    expect(typeof ORE_PER_GIORNATA).toBe("number");
  });
});
