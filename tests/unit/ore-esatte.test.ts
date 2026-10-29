import { describe, it, expect } from "vitest";

import {
  calcolaAvanzamentoOfferte,
  calcolaMarginalitaClienti,
  calcolaReportFatturazioneClienti,
  calcolaRiepilogoMese,
  validaOre,
  MESSAGGIO_ORE_TROPPI_DECIMALI,
} from "@/domain/consuntivi";
import { oreInCentesimi, sommaOre } from "@/domain/types";

/**
 * 16 righe a due decimali che sommano esattamente 80,00 ore (10 giornate).
 * Sommate in virgola mobile danno 79,99999999999999: è il caso reale di
 * deriva che faceva risultare «In allerta» un'offerta esaurita.
 */
const ORE_CHE_SOMMANO_80 = [
  7.31, 6.26, 4.8, 6.41, 2.03, 2.65, 1.82, 7.53, 7.61, 4.87, 6.99, 1.01, 5.03,
  7.19, 4.46, 4.03,
];

function avanzamento(ore: number[], giorniPrevisti = 10) {
  const { perOfferta } = calcolaAvanzamentoOfferte(
    [
      {
        offertaId: "off-1",
        offertaCodice: "OFF-1",
        offertaDescrizione: "Percorso",
        clienteId: "cli-1",
        clienteRagioneSociale: "Cliente",
        giorniPrevisti,
      },
    ],
    ore.map((valore, indice) => ({
      offertaId: "off-1",
      collaboratoreId: `collab-${indice % 3}`,
      collaboratoreNome: `Collaboratore ${indice % 3}`,
      ore: valore,
      fatturabile: true,
      mese: indice < 8 ? "2026-01" : "2026-02",
    })),
  );
  return perOfferta[0];
}

describe("ore sommate in modo esatto", () => {
  it("la somma in virgola mobile del caso di prova deriva davvero", () => {
    expect(ORE_CHE_SOMMANO_80.reduce((a, b) => a + b, 0)).not.toBe(80);
    expect(sommaOre(...ORE_CHE_SOMMANO_80)).toBe(80);
    expect(oreInCentesimi(7.31)).toBe(731);
  });

  it("un'offerta che consuma esattamente il budget è ESAURITA con residuo 0", () => {
    const voce = avanzamento(ORE_CHE_SOMMANO_80);

    expect(voce.stato).toBe("ESAURITA");
    expect(voce.residuo).toBe(0);
    expect(voce.giornateErogate).toBe(10);
    expect(voce.percentualeUtilizzo).toBe(1);
    expect(voce.matriceMensile.totaleGiornate).toBe(10);
  });

  it("un centesimo d'ora in più è OLTRE_BUDGET, uno in meno non è esaurita", () => {
    expect(avanzamento([...ORE_CHE_SOMMANO_80, 0.01]).stato).toBe("OLTRE_BUDGET");

    const sotto = avanzamento([...ORE_CHE_SOMMANO_80.slice(0, -1), 4.02]);
    expect(sotto.stato).toBe("IN_ALLERTA");
    expect(sotto.residuo).toBeGreaterThan(0);
  });

  it("riepilogo mensile, report fatturazione e marginalità sommano senza residui", () => {
    const riepilogo = calcolaRiepilogoMese(
      ORE_CHE_SOMMANO_80.map((ore) => ({
        offertaId: "off-1",
        offertaCodice: "OFF-1",
        offertaDescrizione: "Percorso",
        clienteRagioneSociale: "Cliente",
        ore,
        categoria: "FATTURABILE" as const,
        rimborsoTrasfertaImporto: null,
      })),
      400,
    );
    expect(riepilogo.totali.oreTotali).toBe(80);
    expect(riepilogo.totali.giornateDaFatturare).toBe(10);
    expect(riepilogo.importoFattura).toBe("4000.00");

    const report = calcolaReportFatturazioneClienti(
      ORE_CHE_SOMMANO_80.map((ore, indice) => ({
        clienteId: "cli-1",
        clienteRagioneSociale: "Cliente",
        offertaId: "off-1",
        offertaCodice: "OFF-1",
        offertaDescrizione: "Percorso",
        tariffaOffertaGiornaliera: 500,
        collaboratoreId: "collab-1",
        collaboratoreNome: "Mario Rossi",
        ore,
        fatturabile: true,
        rimborsoTrasfertaImporto: null,
        data: `2026-01-${String(1 + indice).padStart(2, "0")}`,
        gestioneTrasfertaOfferta: "INCLUSA" as const,
        importoTrasfertaForfettariaOfferta: null,
      })),
    );
    const offerta = report.perCliente[0].perOfferta[0];
    expect(offerta.perCollaboratore[0].oreFatturabili).toBe(80);
    expect(offerta.giornateFatturabili).toBe(10);

    const marginalita = calcolaMarginalitaClienti(
      ORE_CHE_SOMMANO_80.map((ore) => ({
        clienteId: "cli-1",
        clienteRagioneSociale: "Cliente",
        offertaId: "off-1",
        offertaCodice: "OFF-1",
        offertaDescrizione: "Percorso",
        tariffaOffertaGiornaliera: 500,
        tariffaCollaboratoreGiornaliera: 300,
        ore,
        categoria: "FATTURABILE" as const,
      })),
    );
    expect(marginalita.totali.giornateFatturabili).toBe(10);
  });

  it("le ore con più di due decimali sono rifiutate, non arrotondate in silenzio", () => {
    expect(validaOre("1,255")).toEqual({
      valido: false,
      errore: MESSAGGIO_ORE_TROPPI_DECIMALI,
    });
    expect(validaOre("0.333").valido).toBe(false);
    expect(validaOre("1,25")).toEqual({ valido: true, valore: 1.25 });
    expect(validaOre("1.250")).toEqual({ valido: true, valore: 1.25 });
    expect(validaOre("7")).toEqual({ valido: true, valore: 7 });
  });
});
