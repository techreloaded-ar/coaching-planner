import { describe, it, expect } from "vitest";
import { validaOre } from "@/domain/consuntivi";

describe("validaOre", () => {
  // ── Casi validi ────────────────────────────────────────────

  it("accetta un intero positivo", () => {
    expect(validaOre("8")).toEqual({ valido: true, valore: 8 });
  });

  it("accetta un decimale con virgola", () => {
    expect(validaOre("3,5")).toEqual({ valido: true, valore: 3.5 });
  });

  it("accetta un decimale con punto", () => {
    expect(validaOre("0.5")).toEqual({ valido: true, valore: 0.5 });
  });

  it("accetta un valore con spazi (trim)", () => {
    expect(validaOre("  4  ")).toEqual({ valido: true, valore: 4 });
  });

  it("accetta il valore massimo 24", () => {
    expect(validaOre("24")).toEqual({ valido: true, valore: 24 });
  });

  it("accetta 24 con virgola (24,0)", () => {
    expect(validaOre("24,0")).toEqual({ valido: true, valore: 24 });
  });

  // ── Casi non validi ────────────────────────────────────────

  it("rifiuta stringa vuota", () => {
    const result = validaOre("");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta solo spazi", () => {
    const result = validaOre("   ");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta zero", () => {
    const result = validaOre("0");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta zero con virgola", () => {
    const result = validaOre("0,0");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta valori negativi", () => {
    const result = validaOre("-1");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta valori negativi decimali", () => {
    const result = validaOre("-0.5");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta testo non numerico", () => {
    const result = validaOre("abc");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta testo misto a numeri", () => {
    const result = validaOre("8h");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta valori superiori a 24", () => {
    const result = validaOre("25");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta valori molto superiori a 24", () => {
    const result = validaOre("100");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

});
