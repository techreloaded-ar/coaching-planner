import { describe, expect, it } from "vitest";
import {
  categoriaDaTipologia,
  cercaOfferta,
  leggiData,
  leggiNumero,
  type OffertaAbbinabile,
} from "@/domain/righe-sospese/abbinamento";

const offerta = (id: string, codice: string, clienteId = "c1"): OffertaAbbinabile => ({ id, codice, clienteId });
const nomi = new Map([["c1", "ENEL"], ["c2", "FABRICK"]]);

describe("cercaOfferta", () => {
  const mie = [offerta("a", "OFF-2018.296"), offerta("b", "ACCOUNTING_ENEL")];
  const tutte = [...mie, offerta("z", "4500168018", "c2")];

  it("trova il codice esatto a prescindere da maiuscole e spazi doppi", () => {
    expect(cercaOfferta(" off-2018.296 ", mie, tutte, nomi)).toEqual({ offerta: mie[0] });
  });
  it("tollera punteggiatura diversa e lo segnala come dedotta", () => {
    expect(cercaOfferta("OFF 2018 296", mie, tutte, nomi)).toMatchObject({ offerta: mie[0], dedotta: expect.any(String) });
  });
  it("riconosce un codice di un altro cliente", () => {
    expect(cercaOfferta("4500168018", mie, tutte, nomi)).toEqual({ motivo: "OFFERTA_ALTRO_CLIENTE", nota: "Codice intestato a: FABRICK" });
  });
  it("sospende un codice sconosciuto", () => {
    expect(cercaOfferta("XYZ", mie, tutte, nomi)).toMatchObject({ motivo: "OFFERTA_SCONOSCIUTA" });
  });
  it("con codice vuoto usa l'unica offerta o lascia l'offerta da definire", () => {
    expect(cercaOfferta("", [mie[0]], tutte, nomi)).toMatchObject({ offerta: mie[0], dedotta: "unica offerta del cliente" });
    expect(cercaOfferta("", mie, tutte, nomi)).toEqual({ offerta: null });
  });
  it("con codice vuoto preferisce l'offerta SENZA CODICE del cliente", () => {
    const senza = offerta("s", "SENZA CODICE");
    expect(cercaOfferta(null, [...mie, senza], tutte, nomi)).toMatchObject({ offerta: senza });
  });
});

describe("categoriaDaTipologia", () => {
  it("mappa i valori del foglio e la tipologia vuota", () => {
    expect(categoriaDaTipologia("non fatturabile", false)).toBe("NON_FATTURABILE");
    expect(categoriaDaTipologia("PIANIFICATA", false)).toBe("FATTURABILE");
    expect(categoriaDaTipologia("", false)).toBe("FATTURABILE");
    expect(categoriaDaTipologia("", true)).toBe("NON_FATTURABILE");
    expect(categoriaDaTipologia("boh", false)).toBeNull();
  });
});

describe("lettura celle", () => {
  it("legge date ISO e italiane e rifiuta quelle impossibili", () => {
    expect(leggiData("2026-01-05")).toBe("2026-01-05");
    expect(leggiData("5/1/2026")).toBe("2026-01-05");
    expect(leggiData("31/02/2026")).toBeNull();
    expect(leggiData("44642")).toBe("2022-03-22");
    expect(leggiData("")).toBeNull();
  });
  it("legge numeri con virgola o punto", () => {
    expect(leggiNumero("1,5")).toBe(1.5);
    expect(leggiNumero("900.00")).toBe(900);
    expect(leggiNumero("2018.0")).toBe(2018);
    expect(leggiNumero("")).toBeNull();
    expect(leggiNumero("otto")).toBeNull();
  });
});
