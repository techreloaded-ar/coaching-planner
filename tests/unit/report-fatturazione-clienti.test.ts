import { describe, it, expect } from "vitest";
import {
  calcolaReportFatturazioneClienti,
  type RigaReportFatturazione,
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
    collaboratoreId: "collaboratore-1",
    collaboratoreNome: "Mario Rossi",
    ore: 8,
    fatturabile: true,
    rimborsoTrasfertaImporto: null,
    ...modifiche,
  };
}

// ═══════════════════════════════════════════════════════════════
// calcolaReportFatturazioneClienti
// ═══════════════════════════════════════════════════════════════

describe("calcolaReportFatturazioneClienti", () => {
  // ── Mese vuoto ─────────────────────────────────────────────

  it("restituisce un report vuoto con totali a zero quando non ci sono righe", () => {
    const report = calcolaReportFatturazioneClienti([]);

    expect(report.perCliente).toEqual([]);
    expect(report.totali).toEqual({
      imponibileManodopera: "0.00",
      totaleRimborsi: "0.00",
      importoTotale: "0.00",
    });
  });

  // ── Conversione ore → giornate e tariffa offerta ───────────

  it("converte 8 ore in una giornata applicando la tariffa dell'offerta", () => {
    const report = calcolaReportFatturazioneClienti([riga({ ore: 8 })]);

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

    const report = calcolaReportFatturazioneClienti(righe);

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

    const report = calcolaReportFatturazioneClienti(righe);

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

    const report = calcolaReportFatturazioneClienti(righe);

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

    const report = calcolaReportFatturazioneClienti(righe);

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

    const report = calcolaReportFatturazioneClienti(righe);

    const offerta = report.perCliente[0].perOfferta[0];
    expect(offerta.giornateFatturabili).toBe(1);
    expect(offerta.imponibile).toBe("500.00");
  });

  it("non include un cliente con sole ore non fatturabili e nessun rimborso", () => {
    const righe = [riga({ ore: 8, fatturabile: false })];

    const report = calcolaReportFatturazioneClienti(righe);

    expect(report.perCliente).toEqual([]);
    expect(report.totali.imponibileManodopera).toBe("0.00");
  });

  // ── Ribaltamento rimborsi trasferta ────────────────────────

  it("ribalta il rimborso trasferta fotografato al cliente corretto", () => {
    const righe = [riga({ ore: 8, rimborsoTrasfertaImporto: "85.00" })];

    const report = calcolaReportFatturazioneClienti(righe);

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
        rimborsoTrasfertaImporto: "85.00",
      }),
      riga({
        clienteId: "cliente-beta",
        clienteRagioneSociale: "Beta SRL",
        ore: 8,
        rimborsoTrasfertaImporto: null,
      }),
    ];

    const report = calcolaReportFatturazioneClienti(righe);

    const alfa = report.perCliente.find((c) => c.clienteId === "cliente-alfa")!;
    const beta = report.perCliente.find((c) => c.clienteId === "cliente-beta")!;
    expect(alfa.rimborsiTrasferta).toBe("85.00");
    expect(beta.rimborsiTrasferta).toBe("0.00");
  });

  it("somma più rimborsi trasferta validi dello stesso cliente", () => {
    const righe = [
      riga({ ore: 8, rimborsoTrasfertaImporto: "85.00" }),
      riga({ ore: 8, rimborsoTrasfertaImporto: "15.00" }),
    ];

    const report = calcolaReportFatturazioneClienti(righe);

    expect(report.perCliente[0].rimborsiTrasferta).toBe("100.00");
  });

  // ── Totali cliente e report ────────────────────────────────

  it("calcola il totale cliente come imponibile più rimborsi", () => {
    const righe = [riga({ ore: 8, tariffaOffertaGiornaliera: 500, rimborsoTrasfertaImporto: "85.00" })];

    const report = calcolaReportFatturazioneClienti(righe);

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
        rimborsoTrasfertaImporto: "85.00",
      }),
      riga({
        clienteId: "cliente-beta",
        clienteRagioneSociale: "Beta SRL",
        ore: 8,
        tariffaOffertaGiornaliera: 400,
        rimborsoTrasfertaImporto: "15.00",
      }),
    ];

    const report = calcolaReportFatturazioneClienti(righe);

    expect(report.totali.imponibileManodopera).toBe("900.00");
    expect(report.totali.totaleRimborsi).toBe("100.00");
    expect(report.totali.importoTotale).toBe("1000.00");
  });

  // ── Formattazione importi ──────────────────────────────────

  it("formatta gli importi come stringhe con due decimali", () => {
    const righe = [riga({ ore: 2, tariffaOffertaGiornaliera: 500 })]; // 2/8 * 500 = 125

    const report = calcolaReportFatturazioneClienti(righe);

    const cliente = report.perCliente[0];
    expect(cliente.perOfferta[0].imponibile).toBe("125.00");
    expect(cliente.imponibileManodopera).toBe("125.00");
    expect(cliente.importoTotale).toBe("125.00");
    expect(report.totali.importoTotale).toBe("125.00");
  });

  it("accetta la tariffa offerta sia come numero sia come stringa", () => {
    const report = calcolaReportFatturazioneClienti(
      [riga({ ore: 8, tariffaOffertaGiornaliera: "500" })],
    );

    expect(report.perCliente[0].perOfferta[0].imponibile).toBe("500.00");
  });

  // ── Dettaglio per collaboratore ────────────────────────────

  describe("Dettaglio per collaboratore", () => {
    it("raggruppa i collaboratori per offerta con ore, giornate e imponibile", () => {
      const righe = [
        riga({
          offertaId: "offerta-1",
          offertaCodice: "OFF-001",
          tariffaOffertaGiornaliera: 500,
          collaboratoreId: "ada",
          collaboratoreNome: "Ada",
          ore: 8,
        }),
        riga({
          offertaId: "offerta-1",
          offertaCodice: "OFF-001",
          tariffaOffertaGiornaliera: 500,
          collaboratoreId: "bruno",
          collaboratoreNome: "Bruno",
          ore: 4,
        }),
        riga({
          offertaId: "offerta-2",
          offertaCodice: "OFF-002",
          tariffaOffertaGiornaliera: 400,
          collaboratoreId: "bruno",
          collaboratoreNome: "Bruno",
          ore: 8,
        }),
      ];

      const report = calcolaReportFatturazioneClienti(righe);

      const cliente = report.perCliente[0];
      const off1 = cliente.perOfferta.find((o) => o.offertaCodice === "OFF-001")!;
      const off2 = cliente.perOfferta.find((o) => o.offertaCodice === "OFF-002")!;

      expect(off1.perCollaboratore).toEqual([
        {
          collaboratoreId: "ada",
          collaboratoreNome: "Ada",
          oreFatturabili: 8,
          giornateFatturabili: 1,
          imponibile: "500.00",
        },
        {
          collaboratoreId: "bruno",
          collaboratoreNome: "Bruno",
          oreFatturabili: 4,
          giornateFatturabili: 0.5,
          imponibile: "250.00",
        },
      ]);

      expect(off2.perCollaboratore).toEqual([
        {
          collaboratoreId: "bruno",
          collaboratoreNome: "Bruno",
          oreFatturabili: 8,
          giornateFatturabili: 1,
          imponibile: "400.00",
        },
      ]);
    });

    it("somma in un'unica voce le righe dello stesso collaboratore sulla stessa offerta", () => {
      const righe = [
        riga({ collaboratoreId: "ada", collaboratoreNome: "Ada", ore: 8 }),
        riga({ collaboratoreId: "ada", collaboratoreNome: "Ada", ore: 4 }),
      ];

      const report = calcolaReportFatturazioneClienti(righe);

      const perCollaboratore =
        report.perCliente[0].perOfferta[0].perCollaboratore;
      expect(perCollaboratore).toHaveLength(1);
      expect(perCollaboratore[0]).toMatchObject({
        collaboratoreId: "ada",
        oreFatturabili: 12,
        giornateFatturabili: 1.5,
      });
    });

    it("esclude dal dettaglio le ore non fatturabili di un collaboratore senza alterare gli imponibili", () => {
      const righe = [
        riga({ collaboratoreId: "ada", collaboratoreNome: "Ada", ore: 8, fatturabile: true }),
        riga({ collaboratoreId: "bruno", collaboratoreNome: "Bruno", ore: 8, fatturabile: false }),
      ];

      const report = calcolaReportFatturazioneClienti(righe);

      const offerta = report.perCliente[0].perOfferta[0];
      expect(offerta.perCollaboratore).toHaveLength(1);
      expect(offerta.perCollaboratore[0].collaboratoreId).toBe("ada");
      expect(offerta.imponibile).toBe("500.00");
      expect(report.perCliente[0].imponibileManodopera).toBe("500.00");
    });

    it("ordina le voci per ore decrescenti e, a parità di ore, per nome crescente", () => {
      const righe = [
        riga({ collaboratoreId: "carla", collaboratoreNome: "Carla", ore: 4 }),
        riga({ collaboratoreId: "ada", collaboratoreNome: "Ada", ore: 8 }),
        riga({ collaboratoreId: "bruno", collaboratoreNome: "Bruno", ore: 4 }),
      ];

      const report = calcolaReportFatturazioneClienti(righe);

      const nomi = report.perCliente[0].perOfferta[0].perCollaboratore.map(
        (v) => v.collaboratoreNome,
      );
      expect(nomi).toEqual(["Ada", "Bruno", "Carla"]);
    });

    it("quadra gli imponibili arrotondati distribuendo il resto senza sforare il totale", () => {
      const righe = [
        riga({
          tariffaOffertaGiornaliera: 100,
          collaboratoreId: "ada",
          collaboratoreNome: "Ada",
          ore: 0.01,
        }),
        riga({
          tariffaOffertaGiornaliera: 100,
          collaboratoreId: "bruno",
          collaboratoreNome: "Bruno",
          ore: 0.01,
        }),
      ];

      const report = calcolaReportFatturazioneClienti(righe);

      const offerta = report.perCliente[0].perOfferta[0];
      expect(report.perCliente[0].imponibileManodopera).toBe("0.25");

      const perNome = new Map(
        offerta.perCollaboratore.map((v) => [v.collaboratoreNome, v.imponibile]),
      );
      expect(perNome.get("Ada")).toBe("0.13");
      expect(perNome.get("Bruno")).toBe("0.12");

      const sommaVoci = offerta.perCollaboratore.reduce(
        (somma, v) => somma + Number(v.imponibile),
        0,
      );
      expect(sommaVoci).toBeCloseTo(0.25, 10);
    });

    it("mantiene la somma delle voci esattamente uguale all'imponibile manodopera del cliente", () => {
      const righe = [
        riga({
          offertaId: "offerta-1",
          offertaCodice: "OFF-001",
          tariffaOffertaGiornaliera: 500,
          collaboratoreId: "ada",
          collaboratoreNome: "Ada",
          ore: 8,
        }),
        riga({
          offertaId: "offerta-1",
          offertaCodice: "OFF-001",
          tariffaOffertaGiornaliera: 500,
          collaboratoreId: "bruno",
          collaboratoreNome: "Bruno",
          ore: 4,
        }),
        riga({
          offertaId: "offerta-2",
          offertaCodice: "OFF-002",
          tariffaOffertaGiornaliera: 400,
          collaboratoreId: "bruno",
          collaboratoreNome: "Bruno",
          ore: 8,
        }),
      ];

      const report = calcolaReportFatturazioneClienti(righe);

      const cliente = report.perCliente[0];
      const sommaVoci = cliente.perOfferta
        .flatMap((o) => o.perCollaboratore)
        .reduce((somma, v) => somma + Number(v.imponibile), 0);
      expect(sommaVoci).toBe(Number(cliente.imponibileManodopera));
    });

    it("quadra con più di due collaboratori, distribuendo più centesimi residui in ordine di frazione", () => {
      // Ogni riga vale 0.9375 (raw): naive toFixed(2) per riga arrotonderebbe
      // ognuna a "0.94" (3 × 0.94 = 2.82), sforando l'imponibile visualizzato
      // "2.81". L'allocazione a resto massimo deve invece assegnare i soli 2
      // centesimi residui alle prime due voci in ordine (a parità di frazione,
      // stesso ordine di Ada/Bruno/Carla) e lasciare la terza al valore
      // inferiore, quadrando esattamente.
      const righe = [
        riga({
          tariffaOffertaGiornaliera: 250,
          collaboratoreId: "ada",
          collaboratoreNome: "Ada",
          ore: 0.03,
        }),
        riga({
          tariffaOffertaGiornaliera: 250,
          collaboratoreId: "bruno",
          collaboratoreNome: "Bruno",
          ore: 0.03,
        }),
        riga({
          tariffaOffertaGiornaliera: 250,
          collaboratoreId: "carla",
          collaboratoreNome: "Carla",
          ore: 0.03,
        }),
      ];

      const report = calcolaReportFatturazioneClienti(righe);

      const cliente = report.perCliente[0];
      expect(cliente.imponibileManodopera).toBe("2.81");

      const offerta = cliente.perOfferta[0];
      const perNome = new Map(
        offerta.perCollaboratore.map((v) => [v.collaboratoreNome, v.imponibile]),
      );
      expect(perNome.get("Ada")).toBe("0.94");
      expect(perNome.get("Bruno")).toBe("0.94");
      expect(perNome.get("Carla")).toBe("0.93");

      const sommaVoci = offerta.perCollaboratore.reduce(
        (somma, v) => somma + Number(v.imponibile),
        0,
      );
      expect(sommaVoci).toBeCloseTo(2.81, 10);
      expect(sommaVoci).not.toBeCloseTo(2.82, 10);
    });

    it("include un cliente con soli rimborsi come voce priva di offerte", () => {
      const righe = [
        riga({ ore: 8, fatturabile: false, rimborsoTrasfertaImporto: "85.00" }),
      ];

      const report = calcolaReportFatturazioneClienti(righe);

      expect(report.perCliente).toHaveLength(1);
      const cliente = report.perCliente[0];
      expect(cliente.perOfferta).toEqual([]);
      expect(cliente.rimborsiTrasferta).toBe("85.00");
      expect(cliente.imponibileManodopera).toBe("0.00");
    });
  });
});
