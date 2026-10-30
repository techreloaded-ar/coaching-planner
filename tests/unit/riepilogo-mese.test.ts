import { describe, it, expect } from "vitest";

import {
  calcolaRiepilogoMese,
  type RigaRiepilogo,
} from "@/domain/consuntivi";
import type { TariffaApplicata } from "@/domain/tariffe";

function giornaliera(importo: string): TariffaApplicata {
  return { modalita: "GIORNALIERA", importo, validaDalMese: "2026-01" };
}

function fissoMensile(importo: string): TariffaApplicata {
  return { modalita: "FISSO_MENSILE", importo, validaDalMese: "2026-01" };
}

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
    const result = calcolaRiepilogoMese([], giornaliera("450"));

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
      modalitaTariffa: "GIORNALIERA",
      importoTariffa: "450.00",
      tariffaValidaDalMese: "2026-01",
      imponibileManodopera: "0.00",
      totaleRimborsi: "0.00",
    });
  });

  it("aggrega più righe sulla stessa offerta e calcola l'importo fattura", () => {
    const result = calcolaRiepilogoMese([riga({ ore: 8 }), riga({ ore: 4 })], giornaliera("450"));

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
      giornaliera("400"),
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
      giornaliera("400"),
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
      giornaliera("450"),
    );

    expect(result.totali.oreDaFatturare).toBe(4);
    expect(result.importoFattura).toBe("225.00");
  });

  it("esclude le righe di Investimento dall'importo ma mantiene i loro rimborsi", () => {
    const result = calcolaRiepilogoMese(
      [riga({ ore: 8, categoria: "INVESTIMENTO", rimborsoTrasfertaImporto: "30.00" })],
      giornaliera("450"),
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
      giornaliera("350"),
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
      giornaliera("450"),
    );

    expect(result.perOfferta[0]?.rimborsiTrasferta).toBe("28.00");
    expect(result.totali.totaleRimborsi).toBe("28.00");
    expect(result.breakdown.importoTariffa).toBe("450.00");
    expect(result.breakdown.imponibileManodopera).toBe("450.00");
    expect(result.importoFattura).toBe("478.00");
  });
});

describe("calcolaRiepilogoMese — modalità della tariffa", () => {
  const righeDelMese = [
    riga({ ore: 8, categoria: "FATTURABILE", rimborsoTrasfertaImporto: "20.00" }),
    riga({ ore: 4, categoria: "NON_FATTURABILE" }),
    riga({ ore: 4, categoria: "INVESTIMENTO", rimborsoTrasfertaImporto: "10.00" }),
  ];

  it("giornaliera: compenso = giornate da fatturare × importo, più i rimborsi", () => {
    const result = calcolaRiepilogoMese(righeDelMese, giornaliera("400"));

    expect(result.breakdown).toEqual({
      giornateDaFatturare: "1.50",
      modalitaTariffa: "GIORNALIERA",
      importoTariffa: "400.00",
      tariffaValidaDalMese: "2026-01",
      imponibileManodopera: "600.00",
      totaleRimborsi: "30.00",
    });
    expect(result.importoFattura).toBe("630.00");
  });

  it("fisso mensile: compenso = fisso più i rimborsi, a prescindere dalle ore", () => {
    const conPocheOre = calcolaRiepilogoMese(righeDelMese, fissoMensile("6500"));
    const conMolteOre = calcolaRiepilogoMese(
      [...righeDelMese, riga({ ore: 80, categoria: "FATTURABILE" })],
      fissoMensile("6500"),
    );

    expect(conPocheOre.breakdown).toMatchObject({
      modalitaTariffa: "FISSO_MENSILE",
      importoTariffa: "6500.00",
      imponibileManodopera: "6500.00",
      totaleRimborsi: "30.00",
    });
    expect(conPocheOre.importoFattura).toBe("6530.00");
    expect(conMolteOre.breakdown.imponibileManodopera).toBe("6500.00");
    expect(conMolteOre.importoFattura).toBe("6530.00");
  });

  it("fisso mensile: un mese senza righe mostra comunque il fisso", () => {
    const result = calcolaRiepilogoMese([], fissoMensile("6500"));

    expect(result.perOfferta).toEqual([]);
    expect(result.breakdown.imponibileManodopera).toBe("6500.00");
    expect(result.importoFattura).toBe("6500.00");
  });

  it("senza tariffa nel mese il compenso è zero e la modalità è null", () => {
    const result = calcolaRiepilogoMese(righeDelMese, null);

    expect(result.breakdown).toEqual({
      giornateDaFatturare: "1.50",
      modalitaTariffa: null,
      importoTariffa: "0.00",
      tariffaValidaDalMese: null,
      imponibileManodopera: "0.00",
      totaleRimborsi: "30.00",
    });
    expect(result.importoFattura).toBe("30.00");
  });
});

describe("calcolaRiepilogoMese — ore con offerta da definire", () => {
  const senzaOfferta = { offertaId: null, offertaCodice: "", offertaDescrizione: "" };

  it("aggrega le ore senza offerta in una voce per cliente, inclusa nei totali", () => {
    const result = calcolaRiepilogoMese(
      [
        riga({ ore: 8 }),
        riga({ ...senzaOfferta, clienteRagioneSociale: "Cliente Nuovo", ore: 3 }),
        riga({ ...senzaOfferta, clienteRagioneSociale: "Cliente Nuovo", ore: 1, categoria: "INVESTIMENTO" }),
        riga({ ...senzaOfferta, clienteRagioneSociale: "Altro Cliente", ore: 2 }),
      ],
      giornaliera("400"),
    );

    expect(result.perOfferta.map((voce) => [voce.offertaId, voce.clienteRagioneSociale, voce.oreTotali])).toEqual([
      ["off-1", "Cliente Uno", 8],
      [null, "Cliente Nuovo", 4],
      [null, "Altro Cliente", 2],
    ]);
    expect(result.perOfferta[1].oreDaFatturare).toBe(3);
    expect(result.totali.oreTotali).toBe(14);
    expect(result.totali.oreDaFatturare).toBe(13);
  });
});
