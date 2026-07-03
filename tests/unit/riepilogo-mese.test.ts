import { describe, it, expect } from "vitest";

import {
  calcolaRiepilogoMese,
  type RigaRiepilogo,
  type ScaglioneRimborso,
} from "@/domain/consuntivi";

const scaglioniDefault: ScaglioneRimborso[] = [
  { finoAKm: 50, importo: "15.00" },
  { finoAKm: 100, importo: "28.00" },
  { finoAKm: 250, importo: "85.00" },
];

function riga(parziale: Partial<RigaRiepilogo> = {}): RigaRiepilogo {
  return {
    offertaId: "off-1",
    offertaCodice: "OFF-001",
    offertaDescrizione: "Percorso coaching",
    clienteRagioneSociale: "Cliente Uno",
    ore: 8,
    fatturabile: true,
    trasfertaKm: null,
    ...parziale,
  };
}

describe("calcolaRiepilogoMese", () => {
  it("restituisce un riepilogo vuoto per un mese senza righe", () => {
    const result = calcolaRiepilogoMese([], 450, scaglioniDefault);

    expect(result.perOfferta).toEqual([]);
    expect(result.importoFattura).toBe("0.00");
    expect(result.totali).toEqual({
      oreTotali: 0,
      oreFatturabili: 0,
      giornateTotali: 0,
      giornateFatturabili: 0,
      totaleRimborsi: "0.00",
    });
    expect(result.breakdown).toEqual({
      giornateFatturabili: "0.00",
      tariffaGiornaliera: "450.00",
      imponibileManodopera: "0.00",
      totaleRimborsi: "0.00",
    });
  });

  it("aggrega più righe sulla stessa offerta e calcola l'importo fattura", () => {
    const result = calcolaRiepilogoMese(
      [riga({ ore: 8 }), riga({ ore: 4 })],
      450,
      scaglioniDefault,
    );

    expect(result.perOfferta).toHaveLength(1);
    expect(result.perOfferta[0]).toMatchObject({
      oreTotali: 12,
      oreFatturabili: 12,
      giornateTotali: 1.5,
      giornateFatturabili: 1.5,
      rimborsiTrasferta: "0.00",
    });
    expect(result.totali.oreTotali).toBe(12);
    expect(result.totali.giornateTotali).toBe(1.5);
    expect(result.totali.giornateFatturabili).toBe(1.5);
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
      scaglioniDefault,
    );

    expect(result.perOfferta).toHaveLength(2);
    expect(result.perOfferta[0]?.giornateTotali).toBe(0.4375);
    expect(result.perOfferta[1]?.giornateTotali).toBe(0.5);
    expect(result.totali.giornateTotali).toBe(0.9375);
  });

  it("esclude le righe non fatturabili dall'importo ma le include nei totali ore", () => {
    const resultSoloNonFatturabile = calcolaRiepilogoMese(
      [riga({ ore: 4, fatturabile: false })],
      450,
      scaglioniDefault,
    );

    expect(resultSoloNonFatturabile.totali.oreTotali).toBe(4);
    expect(resultSoloNonFatturabile.totali.oreFatturabili).toBe(0);
    expect(resultSoloNonFatturabile.importoFattura).toBe("0.00");

    const resultMisto = calcolaRiepilogoMese(
      [riga({ ore: 8, fatturabile: true }), riga({ ore: 4, fatturabile: false })],
      450,
      scaglioniDefault,
    );

    expect(resultMisto.totali.oreTotali).toBe(12);
    expect(resultMisto.totali.oreFatturabili).toBe(8);
    expect(resultMisto.totali.giornateFatturabili).toBe(1);
    expect(resultMisto.importoFattura).toBe("450.00");
  });

  it("somma i rimborsi validi ed esclude quelli oltre soglia", () => {
    const result = calcolaRiepilogoMese(
      [
        riga({ ore: 8, trasfertaKm: 45 }),
        riga({
          offertaId: "off-2",
          offertaCodice: "OFF-002",
          offertaDescrizione: "Workshop",
          clienteRagioneSociale: "Cliente Due",
          ore: 8,
          trasfertaKm: 300,
        }),
      ],
      350,
      scaglioniDefault,
    );

    expect(result.perOfferta[0]?.rimborsiTrasferta).toBe("15.00");
    expect(result.perOfferta[1]?.rimborsiTrasferta).toBe("0.00");
    expect(result.totali.totaleRimborsi).toBe("15.00");
    expect(result.breakdown.totaleRimborsi).toBe("15.00");
    expect(result.importoFattura).toBe("715.00");
  });

  it("formatta gli importi come stringhe con due decimali", () => {
    const result = calcolaRiepilogoMese(
      [riga({ ore: 8, trasfertaKm: 100 })],
      "450",
      scaglioniDefault,
    );

    expect(result.perOfferta[0]?.rimborsiTrasferta).toBe("28.00");
    expect(result.totali.totaleRimborsi).toBe("28.00");
    expect(result.breakdown.tariffaGiornaliera).toBe("450.00");
    expect(result.breakdown.imponibileManodopera).toBe("450.00");
    expect(result.importoFattura).toBe("478.00");
  });
});
