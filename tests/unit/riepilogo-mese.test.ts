import { describe, it, expect } from "vitest";

import {
  calcolaRiepilogoMese,
  type RigaRiepilogo,
} from "@/domain/consuntivi";

function riga(parziale: Partial<RigaRiepilogo> = {}): RigaRiepilogo {
  return {
    offertaId: "off-1",
    offertaCodice: "OFF-001",
    offertaDescrizione: "Percorso coaching",
    clienteRagioneSociale: "Cliente Uno",
    ore: 8,
    categoria: "FATTURABILE",
    rimborsoTrasfertaImporto: null,
    ...parziale,
  };
}

describe("calcolaRiepilogoMese", () => {
  it("restituisce un riepilogo vuoto per un mese senza righe", () => {
    const result = calcolaRiepilogoMese([], 450);

    expect(result.perOfferta).toEqual([]);
    expect(result.importoFattura).toBe("0.00");
    expect(result.totali).toEqual({
      oreTotali: 0,
      orePerCategoria: { FATTURABILE: 0, NON_FATTURABILE: 0, INVESTIMENTO: 0 },
      oreDaFatturare: 0,
      giornateTotali: 0,
      giornateDaFatturare: 0,
      totaleRimborsi: "0.00",
    });
    expect(result.breakdown).toEqual({
      giornateDaFatturare: "0.00",
      tariffaGiornaliera: "450.00",
      imponibileManodopera: "0.00",
      totaleRimborsi: "0.00",
    });
  });

  it("aggrega più righe sulla stessa offerta e calcola l'importo fattura", () => {
    const result = calcolaRiepilogoMese([riga({ ore: 8 }), riga({ ore: 4 })], 450);

    expect(result.perOfferta).toHaveLength(1);
    expect(result.perOfferta[0]).toMatchObject({
      oreTotali: 12,
      oreDaFatturare: 12,
      giornateTotali: 1.5,
      giornateDaFatturare: 1.5,
      rimborsiTrasferta: "0.00",
    });
    expect(result.totali.oreTotali).toBe(12);
    expect(result.totali.giornateTotali).toBe(1.5);
    expect(result.totali.giornateDaFatturare).toBe(1.5);
    expect(result.importoFattura).toBe("675.00");
  });

  it("mantiene precisione nella conversione ore → giornate e aggrega offerte diverse", () => {
    const result = calcolaRiepilogoMese(
      [
        riga({ ore: 3.5 }),
        riga({
          offertaId: "off-2",
          offertaCodice: "OFF-002",
          offertaDescrizione: "Workshop",
          clienteRagioneSociale: "Cliente Due",
          ore: 4,
        }),
      ],
      400,
    );

    expect(result.perOfferta).toHaveLength(2);
    expect(result.perOfferta[0]?.giornateTotali).toBe(0.4375);
    expect(result.perOfferta[1]?.giornateTotali).toBe(0.5);
    expect(result.totali.giornateTotali).toBe(0.9375);
  });

  it("include le righe Non fatturabile nell'importo ed esclude quelle di Investimento", () => {
    const result = calcolaRiepilogoMese(
      [
        riga({ ore: 8, categoria: "FATTURABILE" }),
        riga({ ore: 4, categoria: "NON_FATTURABILE" }),
        riga({ ore: 4, categoria: "INVESTIMENTO" }),
      ],
      400,
    );

    expect(result.totali.oreTotali).toBe(16);
    expect(result.totali.orePerCategoria).toEqual({
      FATTURABILE: 8,
      NON_FATTURABILE: 4,
      INVESTIMENTO: 4,
    });
    expect(result.totali.oreDaFatturare).toBe(12);
    expect(result.totali.giornateDaFatturare).toBe(1.5);
    expect(result.breakdown.imponibileManodopera).toBe("600.00");
    expect(result.importoFattura).toBe("600.00");
    expect(result.perOfferta[0]?.orePerCategoria).toEqual({
      FATTURABILE: 8,
      NON_FATTURABILE: 4,
      INVESTIMENTO: 4,
    });
  });

  it("conta per intero le righe Non fatturabile", () => {
    const result = calcolaRiepilogoMese(
      [riga({ ore: 4, categoria: "NON_FATTURABILE" })],
      450,
    );

    expect(result.totali.oreDaFatturare).toBe(4);
    expect(result.importoFattura).toBe("225.00");
  });

  it("esclude le righe di Investimento dall'importo ma mantiene i loro rimborsi", () => {
    const result = calcolaRiepilogoMese(
      [riga({ ore: 8, categoria: "INVESTIMENTO", rimborsoTrasfertaImporto: "30.00" })],
      450,
    );

    expect(result.totali.oreTotali).toBe(8);
    expect(result.totali.oreDaFatturare).toBe(0);
    expect(result.breakdown.imponibileManodopera).toBe("0.00");
    expect(result.importoFattura).toBe("30.00");
  });

  it("somma i rimborsi fotografati e ignora le righe senza rimborso", () => {
    const result = calcolaRiepilogoMese(
      [
        riga({ ore: 8, rimborsoTrasfertaImporto: "15.00" }),
        riga({
          offertaId: "off-2",
          offertaCodice: "OFF-002",
          offertaDescrizione: "Workshop",
          clienteRagioneSociale: "Cliente Due",
          ore: 8,
          rimborsoTrasfertaImporto: null,
        }),
      ],
      350,
    );

    expect(result.perOfferta[0]?.rimborsiTrasferta).toBe("15.00");
    expect(result.perOfferta[1]?.rimborsiTrasferta).toBe("0.00");
    expect(result.totali.totaleRimborsi).toBe("15.00");
    expect(result.breakdown.totaleRimborsi).toBe("15.00");
    expect(result.importoFattura).toBe("715.00");
  });

  it("formatta gli importi come stringhe con due decimali", () => {
    const result = calcolaRiepilogoMese(
      [riga({ ore: 8, rimborsoTrasfertaImporto: "28.00" })],
      "450",
    );

    expect(result.perOfferta[0]?.rimborsiTrasferta).toBe("28.00");
    expect(result.totali.totaleRimborsi).toBe("28.00");
    expect(result.breakdown.tariffaGiornaliera).toBe("450.00");
    expect(result.breakdown.imponibileManodopera).toBe("450.00");
    expect(result.importoFattura).toBe("478.00");
  });
});
