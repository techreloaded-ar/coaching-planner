import { describe, it, expect } from "vitest";
import {
  calcolaPaginaElenco,
  leggiPosizioneElenco,
  numeriPagineVisibili,
  urlPosizioneElenco,
} from "@/lib/paginazione";

describe("paginazione degli elenchi", () => {
  it("legge ricerca e pagina dai parametri URL, con pagina 1 per valori non validi", () => {
    expect(leggiPosizioneElenco({ q: "  Alfa ", pagina: "3" })).toEqual({ ricerca: "Alfa", pagina: 3 });
    expect(leggiPosizioneElenco({ pagina: "abc" })).toEqual({ ricerca: "", pagina: 1 });
    expect(leggiPosizioneElenco({ pagina: "-2" }).pagina).toBe(1);
    expect(leggiPosizioneElenco({ q: ["primo", "secondo"] }).ricerca).toBe("primo");
  });

  it("riduce la pagina all'intervallo valido con 50 elementi per pagina", () => {
    expect(calcolaPaginaElenco(1, 0)).toEqual({ paginaCorrente: 1, totalePagine: 1, totaleElementi: 0 });
    expect(calcolaPaginaElenco(2, 50)).toMatchObject({ paginaCorrente: 1, totalePagine: 1 });
    expect(calcolaPaginaElenco(5, 101)).toMatchObject({ paginaCorrente: 3, totalePagine: 3 });
  });

  it("costruisce URL puliti omettendo ricerca vuota e pagina 1", () => {
    expect(urlPosizioneElenco("/offerte", { ricerca: "", pagina: 1 })).toBe("/offerte");
    expect(urlPosizioneElenco("/offerte", { ricerca: "a b", pagina: 2 })).toBe("/offerte?q=a+b&pagina=2");
    expect(urlPosizioneElenco("/offerte", { ricerca: "", pagina: 1 }, { esito: "ok" })).toBe("/offerte?esito=ok");
  });

  it("mostra prima, ultima, corrente e adiacenti, con salti", () => {
    expect(numeriPagineVisibili(1, 1)).toEqual([1]);
    expect(numeriPagineVisibili(1, 4)).toEqual([1, 2, "…", 4]);
    expect(numeriPagineVisibili(5, 9)).toEqual([1, "…", 4, 5, 6, "…", 9]);
    expect(numeriPagineVisibili(9, 9)).toEqual([1, "…", 8, 9]);
  });
});
