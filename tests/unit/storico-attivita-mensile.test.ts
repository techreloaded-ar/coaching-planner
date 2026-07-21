import { describe, it, expect } from "vitest";

import {
  raggruppaAttivitaPerMese,
  type RigaStoricoAttivita,
} from "@/domain/consuntivi";

let contatoreId = 0;

function riga(parziale: Partial<RigaStoricoAttivita> = {}): RigaStoricoAttivita {
  contatoreId += 1;
  return {
    id: `r${contatoreId}`,
    data: "2026-03-10",
    clienteRagioneSociale: "Cliente Uno",
    offertaCodice: "OFF-001",
    offertaDescrizione: "Percorso coaching",
    ore: 8,
    fatturabile: true,
    nota: null,
    ...parziale,
  };
}

describe("raggruppaAttivitaPerMese", () => {
  it("restituisce un array vuoto per input vuoto", () => {
    expect(raggruppaAttivitaPerMese([])).toEqual([]);
  });

  it("raggruppa righe su due mesi diversi con token in ordine decrescente", () => {
    const result = raggruppaAttivitaPerMese([
      riga({ data: "2026-03-10" }),
      riga({ data: "2026-04-05" }),
      riga({ data: "2026-03-22" }),
    ]);

    expect(result.map((mese) => mese.token)).toEqual(["2026-04", "2026-03"]);
    expect(result).toHaveLength(2);
  });

  it("mantiene le righe dello stesso mese in un solo gruppo nell'ordine di input", () => {
    const result = raggruppaAttivitaPerMese([
      riga({ data: "2026-03-10", ore: 4 }),
      riga({ data: "2026-03-22", ore: 2 }),
      riga({ data: "2026-03-05", ore: 6 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].righe.map((r) => r.data)).toEqual([
      "2026-03-10",
      "2026-03-22",
      "2026-03-05",
    ]);
  });

  it("calcola oreTotali come somma delle ore e giornateTotali come ore diviso 8", () => {
    const result = raggruppaAttivitaPerMese([
      riga({ data: "2026-03-10", ore: 8 }),
      riga({ data: "2026-03-22", ore: 4 }),
    ]);

    expect(result[0].oreTotali).toBe(12);
    expect(result[0].giornateTotali).toBe(1.5);
  });

  it("arrotonda i totali a 2 decimali anche con ore che producono valori periodici", () => {
    const result = raggruppaAttivitaPerMese([
      riga({ data: "2026-03-10", ore: 0.1 }),
      riga({ data: "2026-03-22", ore: 0.2 }),
    ]);

    // 0.1 + 0.2 = 0.30000000000000004 in virgola mobile → arrotondato a 0.3
    expect(result[0].oreTotali).toBe(0.3);
    // 0.3 / 8 = 0.0375 → arrotondato a 0.04
    expect(result[0].giornateTotali).toBe(0.04);
  });

  it("conserva invariati cliente, offerta, ore, fatturabile e nota nelle righe del gruppo", () => {
    const conNota = riga({
      data: "2026-04-05",
      clienteRagioneSociale: "TechSolutions SRL",
      offertaCodice: "OFF-101",
      offertaDescrizione: "Coaching executive",
      ore: 6,
      fatturabile: true,
      nota: "Sessione di feedback",
    });
    const senzaNota = riga({
      data: "2026-04-06",
      clienteRagioneSociale: "DataFlow SpA",
      offertaCodice: "OFF-202",
      offertaDescrizione: "Mentoring tecnico",
      ore: 2,
      fatturabile: false,
      nota: null,
    });

    const result = raggruppaAttivitaPerMese([conNota, senzaNota]);

    expect(result).toHaveLength(1);
    expect(result[0].righe).toEqual([conNota, senzaNota]);
  });
});
