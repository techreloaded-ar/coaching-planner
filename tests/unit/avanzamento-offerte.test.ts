import { describe, it, expect } from "vitest";
import {
  calcolaAvanzamentoOfferte,
  SOGLIA_ALLERTA_UTILIZZO,
  type OffertaAvanzamento,
  type RigaAvanzamento,
} from "@/domain/consuntivi";

// ── Helper e dati di esempio ────────────────────────────────────

/** Crea una offerta di avanzamento con valori di default sovrascrivibili */
function offerta(modifiche: Partial<OffertaAvanzamento> = {}): OffertaAvanzamento {
  return {
    offertaId: "offerta-1",
    offertaCodice: "OFF-001",
    offertaDescrizione: "Sviluppo software",
    clienteId: "cliente-1",
    clienteRagioneSociale: "Cliente Uno",
    giorniPrevisti: 10,
    ...modifiche,
  };
}

/** Crea una riga di attività ai fini dell'avanzamento con valori di default sovrascrivibili */
function riga(modifiche: Partial<RigaAvanzamento> = {}): RigaAvanzamento {
  return {
    offertaId: "offerta-1",
    collaboratoreId: "collaboratore-1",
    collaboratoreNome: "Mario Rossi",
    ore: 8,
    fatturabile: true,
    ...modifiche,
  };
}

// ═══════════════════════════════════════════════════════════════
// calcolaAvanzamentoOfferte
// ═══════════════════════════════════════════════════════════════

describe("calcolaAvanzamentoOfferte", () => {
  // ── Report vuoto ───────────────────────────────────────────

  it("restituisce un report vuoto con totali a zero quando non ci sono offerte né righe", () => {
    const report = calcolaAvanzamentoOfferte([], []);

    expect(report.perOfferta).toEqual([]);
    expect(report.totali).toEqual({
      giornatePrevisteTotali: 0,
      giornateErogateTotali: 0,
      residuoTotale: 0,
    });
  });

  // ── Conversione ore → giornate ──────────────────────────────

  it("converte 8 ore fatturabili in 1 giornata erogata", () => {
    const report = calcolaAvanzamentoOfferte(
      [offerta({ giorniPrevisti: 10 })],
      [riga({ ore: 8 })],
    );

    expect(report.perOfferta[0].giornateErogate).toBe(1);
  });

  it("converte 12 ore fatturabili in 1,5 giornate erogate", () => {
    const report = calcolaAvanzamentoOfferte(
      [offerta({ giorniPrevisti: 10 })],
      [riga({ ore: 12 })],
    );

    expect(report.perOfferta[0].giornateErogate).toBe(1.5);
  });

  // ── Aggregazione per collaboratore ──────────────────────────

  it("aggrega più collaboratori sulla stessa offerta con dettaglio corretto e ordinamento decrescente", () => {
    const righe = [
      riga({ collaboratoreId: "collab-a", collaboratoreNome: "Anna Bianchi", ore: 8 }), // 1 giornata
      riga({ collaboratoreId: "collab-b", collaboratoreNome: "Bruno Verdi", ore: 16 }), // 2 giornate
    ];

    const report = calcolaAvanzamentoOfferte(
      [offerta({ giorniPrevisti: 10 })],
      righe,
    );

    const voce = report.perOfferta[0];
    expect(voce.giornateErogate).toBe(3);
    expect(voce.perCollaboratore).toHaveLength(2);
    // Ordinamento decrescente per giornate erogate: Bruno (2gg) prima di Anna (1gg)
    expect(voce.perCollaboratore.map((c) => c.collaboratoreNome)).toEqual([
      "Bruno Verdi",
      "Anna Bianchi",
    ]);
    expect(voce.perCollaboratore[0].giornateErogate).toBe(2);
    expect(voce.perCollaboratore[1].giornateErogate).toBe(1);
  });

  it("somma le ore dello stesso collaboratore su righe multiple della stessa offerta", () => {
    const righe = [
      riga({ collaboratoreId: "collab-a", collaboratoreNome: "Anna Bianchi", ore: 8 }),
      riga({ collaboratoreId: "collab-a", collaboratoreNome: "Anna Bianchi", ore: 4 }),
    ];

    const report = calcolaAvanzamentoOfferte(
      [offerta({ giorniPrevisti: 10 })],
      righe,
    );

    const voce = report.perOfferta[0];
    expect(voce.perCollaboratore).toHaveLength(1);
    expect(voce.perCollaboratore[0].giornateErogate).toBe(1.5);
  });

  // ── Residuo e stati ──────────────────────────────────────────

  it("calcola un residuo positivo quando erogato < previsto (stato IN_CORSO)", () => {
    const report = calcolaAvanzamentoOfferte(
      [offerta({ giorniPrevisti: 10 })],
      [riga({ ore: 40 })], // 5 giornate
    );

    const voce = report.perOfferta[0];
    expect(voce.giornatePreviste).toBe(10);
    expect(voce.giornateErogate).toBe(5);
    expect(voce.residuo).toBe(5);
    expect(voce.stato).toBe("IN_CORSO");
  });

  it("classifica come ESAURITA quando erogato == previsto (residuo nullo)", () => {
    const report = calcolaAvanzamentoOfferte(
      [offerta({ giorniPrevisti: 10 })],
      [riga({ ore: 80 })], // 10 giornate
    );

    const voce = report.perOfferta[0];
    expect(voce.residuo).toBe(0);
    expect(voce.stato).toBe("ESAURITA");
  });

  it("classifica come OLTRE_BUDGET quando erogato > previsto (residuo negativo)", () => {
    const report = calcolaAvanzamentoOfferte(
      [offerta({ giorniPrevisti: 10 })],
      [riga({ ore: 96 })], // 12 giornate
    );

    const voce = report.perOfferta[0];
    expect(voce.residuo).toBe(-2);
    expect(voce.stato).toBe("OLTRE_BUDGET");
  });

  // ── Soglia di allerta ─────────────────────────────────────────

  it("classifica come IN_ALLERTA esattamente all'85% di utilizzo con residuo positivo", () => {
    const report = calcolaAvanzamentoOfferte(
      [offerta({ giorniPrevisti: 20 })],
      [riga({ ore: 8 * 17 })], // 17 giornate = 85% di 20
    );

    const voce = report.perOfferta[0];
    expect(voce.percentualeUtilizzo).toBeCloseTo(SOGLIA_ALLERTA_UTILIZZO, 10);
    expect(voce.residuo).toBeGreaterThan(0);
    expect(voce.stato).toBe("IN_ALLERTA");
  });

  it("classifica come IN_CORSO appena sotto la soglia dell'85%", () => {
    const report = calcolaAvanzamentoOfferte(
      [offerta({ giorniPrevisti: 20 })],
      [riga({ ore: 8 * 16 })], // 16 giornate = 80% di 20
    );

    const voce = report.perOfferta[0];
    expect(voce.percentualeUtilizzo).toBeCloseTo(0.8, 10);
    expect(voce.stato).toBe("IN_CORSO");
  });

  // ── Esclusione righe non fatturabili ──────────────────────────

  it("esclude dall'erogato le righe non fatturabili e dal dettaglio per collaboratore", () => {
    const righe = [
      riga({ collaboratoreId: "collab-a", collaboratoreNome: "Anna Bianchi", ore: 8, fatturabile: true }),
      riga({ collaboratoreId: "collab-b", collaboratoreNome: "Bruno Verdi", ore: 8, fatturabile: false }),
    ];

    const report = calcolaAvanzamentoOfferte(
      [offerta({ giorniPrevisti: 10 })],
      righe,
    );

    const voce = report.perOfferta[0];
    expect(voce.giornateErogate).toBe(1);
    expect(voce.perCollaboratore).toHaveLength(1);
    expect(voce.perCollaboratore[0].collaboratoreNome).toBe("Anna Bianchi");
  });

  it("risulta con erogato 0 e perCollaboratore vuoto se l'offerta ha sole righe non fatturabili", () => {
    const righe = [riga({ ore: 8, fatturabile: false })];

    const report = calcolaAvanzamentoOfferte(
      [offerta({ giorniPrevisti: 10 })],
      righe,
    );

    const voce = report.perOfferta[0];
    expect(voce.giornateErogate).toBe(0);
    expect(voce.perCollaboratore).toEqual([]);
  });

  // ── Ordinamento per criticità ──────────────────────────────────

  it("ordina perOfferta per percentuale di utilizzo decrescente", () => {
    const offerte = [
      offerta({ offertaId: "offerta-bassa", offertaCodice: "OFF-BASSA", giorniPrevisti: 10 }),
      offerta({ offertaId: "offerta-alta", offertaCodice: "OFF-ALTA", giorniPrevisti: 10 }),
      offerta({ offertaId: "offerta-media", offertaCodice: "OFF-MEDIA", giorniPrevisti: 10 }),
    ];
    const righe = [
      riga({ offertaId: "offerta-bassa", ore: 8 }), // 1/10 = 10%
      riga({ offertaId: "offerta-alta", ore: 72 }), // 9/10 = 90%
      riga({ offertaId: "offerta-media", ore: 40 }), // 5/10 = 50%
    ];

    const report = calcolaAvanzamentoOfferte(offerte, righe);

    expect(report.perOfferta.map((v) => v.offertaCodice)).toEqual([
      "OFF-ALTA",
      "OFF-MEDIA",
      "OFF-BASSA",
    ]);
  });

  // ── Guardia divisione per zero ─────────────────────────────────

  it("gestisce giorniPrevisti = 0 senza produrre NaN/Infinity e risulta OLTRE_BUDGET se ha erogato", () => {
    const report = calcolaAvanzamentoOfferte(
      [offerta({ giorniPrevisti: 0 })],
      [riga({ ore: 8 })],
    );

    const voce = report.perOfferta[0];
    expect(voce.giornatePreviste).toBe(0);
    expect(voce.giornateErogate).toBe(1);
    expect(Number.isFinite(voce.percentualeUtilizzo)).toBe(true);
    expect(Number.isNaN(voce.percentualeUtilizzo)).toBe(false);
    expect(voce.residuo).toBeLessThan(0);
    expect(voce.stato).toBe("OLTRE_BUDGET");
  });

  // ── Offerta senza attività ──────────────────────────────────────

  it("include un'offerta senza attività con erogato 0, residuo = previste, perCollaboratore vuoto e stato IN_CORSO", () => {
    const report = calcolaAvanzamentoOfferte(
      [offerta({ giorniPrevisti: 10 })],
      [],
    );

    const voce = report.perOfferta[0];
    expect(voce.giornateErogate).toBe(0);
    expect(voce.residuo).toBe(10);
    expect(voce.perCollaboratore).toEqual([]);
    expect(voce.stato).toBe("IN_CORSO");
  });

  // ── Totali di portafoglio ────────────────────────────────────────

  it("calcola i totali di portafoglio come somma di previste/erogate/residuo tra le offerte", () => {
    const offerte = [
      offerta({ offertaId: "offerta-1", offertaCodice: "OFF-001", giorniPrevisti: 10 }),
      offerta({ offertaId: "offerta-2", offertaCodice: "OFF-002", giorniPrevisti: 20 }),
    ];
    const righe = [
      riga({ offertaId: "offerta-1", ore: 40 }), // 5 giornate
      riga({ offertaId: "offerta-2", ore: 160 }), // 20 giornate
    ];

    const report = calcolaAvanzamentoOfferte(offerte, righe);

    expect(report.totali).toEqual({
      giornatePrevisteTotali: 30,
      giornateErogateTotali: 25,
      residuoTotale: 5,
    });
  });
});
