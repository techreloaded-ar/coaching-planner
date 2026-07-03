import { describe, it, expect } from "vitest";
import {
  calcolaReportFatturazioneClienti,
  type RigaReportFatturazione,
  type ScaglioneRimborso,
} from "@/domain/consuntivi";

// ── Helper e dati di esempio ────────────────────────────────────

/** Crea una riga di attività con valori di default sovrascrivibili */
function riga(
  modifiche: Partial<RigaReportFatturazione> = {},
): RigaReportFatturazione {
  return {
    clienteId: "cliente-1",
    clienteRagioneSociale: "Cliente Uno",
    offertaId: "offerta-1",
    offertaCodice: "OFF-001",
    offertaDescrizione: "Sviluppo software",
    tariffaOffertaGiornaliera: 500,
    ore: 8,
    fatturabile: true,
    trasfertaKm: null,
    ...modifiche,
  };
}

const scaglioni: ScaglioneRimborso[] = [
  { finoAKm: 50, importo: "15.00" },
  { finoAKm: 100, importo: "28.00" },
  { finoAKm: 250, importo: "85.00" },
];

// ═══════════════════════════════════════════════════════════════
// calcolaReportFatturazioneClienti
// ═══════════════════════════════════════════════════════════════

describe("calcolaReportFatturazioneClienti", () => {
  // ── Mese vuoto ─────────────────────────────────────────────

  it("restituisce un report vuoto con totali a zero quando non ci sono righe", () => {
    const report = calcolaReportFatturazioneClienti([], scaglioni);

    expect(report.perCliente).toEqual([]);
    expect(report.totali).toEqual({
      imponibileManodopera: "0.00",
      totaleRimborsi: "0.00",
      importoTotale: "0.00",
    });
  });

  // ── Conversione ore → giornate e tariffa offerta ───────────

  it("converte 8 ore in una giornata applicando la tariffa dell'offerta", () => {
    const report = calcolaReportFatturazioneClienti([riga({ ore: 8 })], scaglioni);

    const cliente = report.perCliente[0];
    expect(cliente.perOfferta[0].giornateFatturabili).toBe(1);
    expect(cliente.perOfferta[0].imponibile).toBe("500.00");
    expect(cliente.imponibileManodopera).toBe("500.00");
  });

  it("somma ore della stessa offerta e converte 8h+4h in 1,5 giornate (750.00 con tariffa 500)", () => {
    const righe = [
      riga({ ore: 8 }),
      riga({ ore: 4 }),
    ];

    const report = calcolaReportFatturazioneClienti(righe, scaglioni);

    const offerta = report.perCliente[0].perOfferta[0];
    expect(offerta.giornateFatturabili).toBe(1.5);
    expect(offerta.imponibile).toBe("750.00");
    expect(offerta.tariffaGiornaliera).toBe("500.00");
  });

  it("somma le ore di collaboratori diversi sulla stessa offerta", () => {
    const righe = [
      riga({ ore: 8 }), // collaboratore A
      riga({ ore: 8 }), // collaboratore B, stessa offerta/cliente
    ];

    const report = calcolaReportFatturazioneClienti(righe, scaglioni);

    expect(report.perCliente).toHaveLength(1);
    const offerta = report.perCliente[0].perOfferta[0];
    expect(offerta.giornateFatturabili).toBe(2);
    expect(offerta.imponibile).toBe("1000.00");
  });

  // ── Aggregazione per offerta e per cliente ─────────────────

  it("aggrega separatamente più offerte dello stesso cliente", () => {
    const righe = [
      riga({ offertaId: "offerta-1", offertaCodice: "OFF-001", ore: 8, tariffaOffertaGiornaliera: 500 }),
      riga({ offertaId: "offerta-2", offertaCodice: "OFF-002", ore: 8, tariffaOffertaGiornaliera: 400 }),
    ];

    const report = calcolaReportFatturazioneClienti(righe, scaglioni);

    expect(report.perCliente).toHaveLength(1);
    const cliente = report.perCliente[0];
    expect(cliente.perOfferta).toHaveLength(2);
    expect(cliente.perOfferta.map((o) => o.offertaCodice)).toEqual([
      "OFF-001",
      "OFF-002",
    ]);
    expect(cliente.imponibileManodopera).toBe("900.00");
  });

  it("aggrega separatamente clienti diversi ordinandoli per ragione sociale", () => {
    const righe = [
      riga({
        clienteId: "cliente-beta",
        clienteRagioneSociale: "Beta SRL",
        ore: 8,
        tariffaOffertaGiornaliera: 500,
      }),
      riga({
        clienteId: "cliente-alfa",
        clienteRagioneSociale: "Alfa SPA",
        ore: 8,
        tariffaOffertaGiornaliera: 400,
      }),
    ];

    const report = calcolaReportFatturazioneClienti(righe, scaglioni);

    expect(report.perCliente).toHaveLength(2);
    expect(report.perCliente.map((c) => c.clienteRagioneSociale)).toEqual([
      "Alfa SPA",
      "Beta SRL",
    ]);
  });

  // ── Esclusione righe non fatturabili ───────────────────────

  it("esclude dall'imponibile le ore non fatturabili", () => {
    const righe = [
      riga({ ore: 8, fatturabile: true }),
      riga({ ore: 8, fatturabile: false }),
    ];

    const report = calcolaReportFatturazioneClienti(righe, scaglioni);

    const offerta = report.perCliente[0].perOfferta[0];
    expect(offerta.giornateFatturabili).toBe(1);
    expect(offerta.imponibile).toBe("500.00");
  });

  it("non include un cliente con sole ore non fatturabili e nessun rimborso", () => {
    const righe = [riga({ ore: 8, fatturabile: false })];

    const report = calcolaReportFatturazioneClienti(righe, scaglioni);

    expect(report.perCliente).toEqual([]);
    expect(report.totali.imponibileManodopera).toBe("0.00");
  });

  // ── Ribaltamento rimborsi trasferta ────────────────────────

  it("ribalta il rimborso trasferta (stato OK) al cliente corretto", () => {
    const righe = [riga({ ore: 8, trasfertaKm: 150 })]; // scaglione fino a 250 → 85.00

    const report = calcolaReportFatturazioneClienti(righe, scaglioni);

    const cliente = report.perCliente[0];
    expect(cliente.rimborsiTrasferta).toBe("85.00");
    expect(cliente.importoTotale).toBe("585.00");
  });

  it("assegna i rimborsi al cliente della riga, non ad altri clienti", () => {
    const righe = [
      riga({
        clienteId: "cliente-alfa",
        clienteRagioneSociale: "Alfa SPA",
        ore: 8,
        trasfertaKm: 150,
      }),
      riga({
        clienteId: "cliente-beta",
        clienteRagioneSociale: "Beta SRL",
        ore: 8,
        trasfertaKm: null,
      }),
    ];

    const report = calcolaReportFatturazioneClienti(righe, scaglioni);

    const alfa = report.perCliente.find((c) => c.clienteId === "cliente-alfa")!;
    const beta = report.perCliente.find((c) => c.clienteId === "cliente-beta")!;
    expect(alfa.rimborsiTrasferta).toBe("85.00");
    expect(beta.rimborsiTrasferta).toBe("0.00");
  });

  it("esclude dai rimborsi le trasferte oltre la soglia massima", () => {
    const righe = [riga({ ore: 8, trasfertaKm: 300 })]; // oltre 250 → nessun rimborso

    const report = calcolaReportFatturazioneClienti(righe, scaglioni);

    const cliente = report.perCliente[0];
    expect(cliente.rimborsiTrasferta).toBe("0.00");
    expect(cliente.importoTotale).toBe("500.00");
  });

  it("somma più rimborsi trasferta validi dello stesso cliente", () => {
    const righe = [
      riga({ ore: 8, trasfertaKm: 150 }), // 85.00
      riga({ ore: 8, trasfertaKm: 30 }), // 15.00
    ];

    const report = calcolaReportFatturazioneClienti(righe, scaglioni);

    expect(report.perCliente[0].rimborsiTrasferta).toBe("100.00");
  });

  // ── Totali cliente e report ────────────────────────────────

  it("calcola il totale cliente come imponibile più rimborsi", () => {
    const righe = [riga({ ore: 8, tariffaOffertaGiornaliera: 500, trasfertaKm: 150 })];

    const report = calcolaReportFatturazioneClienti(righe, scaglioni);

    const cliente = report.perCliente[0];
    expect(cliente.imponibileManodopera).toBe("500.00");
    expect(cliente.rimborsiTrasferta).toBe("85.00");
    expect(cliente.importoTotale).toBe("585.00");
  });

  it("calcola i totali di report come somma dei valori per cliente", () => {
    const righe = [
      riga({
        clienteId: "cliente-alfa",
        clienteRagioneSociale: "Alfa SPA",
        ore: 8,
        tariffaOffertaGiornaliera: 500,
        trasfertaKm: 150,
      }),
      riga({
        clienteId: "cliente-beta",
        clienteRagioneSociale: "Beta SRL",
        ore: 8,
        tariffaOffertaGiornaliera: 400,
        trasfertaKm: 30,
      }),
    ];

    const report = calcolaReportFatturazioneClienti(righe, scaglioni);

    expect(report.totali.imponibileManodopera).toBe("900.00");
    expect(report.totali.totaleRimborsi).toBe("100.00");
    expect(report.totali.importoTotale).toBe("1000.00");
  });

  // ── Formattazione importi ──────────────────────────────────

  it("formatta gli importi come stringhe con due decimali", () => {
    const righe = [riga({ ore: 2, tariffaOffertaGiornaliera: 500 })]; // 2/8 * 500 = 125

    const report = calcolaReportFatturazioneClienti(righe, scaglioni);

    const cliente = report.perCliente[0];
    expect(cliente.perOfferta[0].imponibile).toBe("125.00");
    expect(cliente.imponibileManodopera).toBe("125.00");
    expect(cliente.importoTotale).toBe("125.00");
    expect(report.totali.importoTotale).toBe("125.00");
  });

  it("accetta la tariffa offerta sia come numero sia come stringa", () => {
    const report = calcolaReportFatturazioneClienti(
      [riga({ ore: 8, tariffaOffertaGiornaliera: "500" })],
      scaglioni,
    );

    expect(report.perCliente[0].perOfferta[0].imponibile).toBe("500.00");
  });
});
