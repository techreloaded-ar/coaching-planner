import { describe, it, expect } from "vitest";
import { creaXlsx } from "@/lib/xlsx";
import { leggiXlsx } from "../e2e/support/xlsx-lettura";

describe("creaXlsx", () => {
  it("produce lo zip con le parti OOXML attese e i fogli nell'ordine dato", () => {
    const xlsx = leggiXlsx(
      creaXlsx([
        { nome: "Primo", righe: [["a"]] },
        { nome: "Secondo", righe: [["b"]] },
      ]),
    );

    expect(Object.keys(xlsx.parti)).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
    ]);
    expect(xlsx.fogli.map((f) => f.nome)).toEqual(["Primo", "Secondo"]);
  });

  it("riporta testo, numeri e celle vuote in un roundtrip", () => {
    const [foglio] = leggiXlsx(
      creaXlsx([
        {
          nome: "F",
          righe: [
            ["Cliente", { valore: 1234.5, stile: "importo" }, null, 0.25],
            [],
            [null, "dopo riga vuota"],
          ],
        },
      ]),
    ).fogli;

    expect(foglio.righe[0]).toEqual(["Cliente", 1234.5, null, 0.25]);
    expect(foglio.righe[1]).toEqual([]);
    expect(foglio.righe[2]).toEqual([null, "dopo riga vuota"]);
  });

  it("escapa i caratteri XML e rimuove i caratteri di controllo", () => {
    const [foglio] = leggiXlsx(
      creaXlsx([
        { nome: "A & B", righe: [[`A & B <x> "q" 'z'`, "ciao\u0001mondo"]] },
      ]),
    ).fogli;

    expect(foglio.nome).toBe("A & B");
    expect(foglio.righe[0]).toEqual([`A & B <x> "q" 'z'`, "ciaomondo"]);
  });

  it("applica gli stili di base e il formato custom delle giornate", () => {
    const xlsx = leggiXlsx(
      creaXlsx([
        {
          nome: "F",
          righe: [
            [
              { valore: "T", stile: "grassetto" },
              { valore: 1, stile: "importo" },
              { valore: 2, stile: "importoGrassetto" },
              { valore: 3, stile: "giornate" },
            ],
          ],
        },
      ]),
    );
    const sheet = xlsx.parti["xl/worksheets/sheet1.xml"];

    expect(sheet).toContain('r="A1" t="inlineStr" s="1"');
    expect(sheet).toContain('r="B1" s="2"');
    expect(sheet).toContain('r="C1" s="3"');
    expect(sheet).toContain('r="D1" s="4"');
    expect(xlsx.parti["xl/styles.xml"]).toContain('numFmtId="164"');
  });

  it("indirizza le colonne oltre la Z", () => {
    const riga = Array.from({ length: 28 }, (_, i) => i);
    const xlsx = leggiXlsx(creaXlsx([{ nome: "F", righe: [riga] }]));

    expect(xlsx.parti["xl/worksheets/sheet1.xml"]).toContain('r="AB1"');
    expect(xlsx.fogli[0].righe[0][27]).toBe(27);
  });

  it("scrive le larghezze colonna prima di sheetData", () => {
    const sheet = leggiXlsx(
      creaXlsx([{ nome: "F", righe: [["a"]], larghezzeColonne: [30, 12] }]),
    ).parti["xl/worksheets/sheet1.xml"];

    expect(sheet).toContain('<col min="1" max="1" width="30" customWidth="1"/>');
    expect(sheet.indexOf("<cols>")).toBeLessThan(sheet.indexOf("<sheetData>"));
  });

  it("il lettore rifiuta uno zip con un byte alterato (CRC)", () => {
    const buffer = creaXlsx([{ nome: "F", righe: [["contenuto"]] }]);
    const posizione = buffer.indexOf("contenuto");
    buffer[posizione] ^= 0xff;

    expect(() => leggiXlsx(buffer)).toThrow(/CRC/);
  });

  it("rifiuta input non validi", () => {
    expect(() => creaXlsx([])).toThrow();
    expect(() => creaXlsx([{ nome: "", righe: [] }])).toThrow();
    expect(() => creaXlsx([{ nome: "x".repeat(32), righe: [] }])).toThrow();
    expect(() => creaXlsx([{ nome: "a/b", righe: [] }])).toThrow();
    expect(() =>
      creaXlsx([
        { nome: "A", righe: [] },
        { nome: "a", righe: [] },
      ]),
    ).toThrow();
    expect(() => creaXlsx([{ nome: "F", righe: [[Number.NaN]] }])).toThrow();
  });
});
