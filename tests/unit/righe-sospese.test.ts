import { describe, expect, it } from "vitest";
import { leggiFiltroRigheSospese, parametriFiltroRigheSospese } from "@/domain/righe-sospese";

describe("filtro righe sospese", () => {
  it("senza parametri o con valori sconosciuti mostra le righe aperte di tutti i motivi", () => {
    expect(leggiFiltroRigheSospese({})).toEqual({ stato: "aperte", motivo: null });
    expect(leggiFiltroRigheSospese({ stato: "chiuse", motivo: "boh" })).toEqual({ stato: "aperte", motivo: null });
  });

  it("legge stato e motivo validi e li riscrive omettendo i predefiniti", () => {
    const filtro = leggiFiltroRigheSospese({ stato: "risolte", motivo: "CLIENTE_SCONOSCIUTO" });
    expect(filtro).toEqual({ stato: "risolte", motivo: "CLIENTE_SCONOSCIUTO" });
    expect(parametriFiltroRigheSospese(filtro)).toEqual({ stato: "risolte", motivo: "CLIENTE_SCONOSCIUTO" });
    expect(parametriFiltroRigheSospese({ stato: "aperte", motivo: null })).toEqual({});
  });
});
