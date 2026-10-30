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
    data: "2026-03-02",
    gestioneTrasfertaOfferta: "INCLUSA",
    importoTrasfertaForfettariaOfferta: null,
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
      totaleTrasferteForfettarie: "0.00",
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

  // ── Trasferte forfettarie ──────────────────────────────────

  /** Riga su un'offerta con trasferta forfettaria da 80 €/gg */
  function rigaForfettaria(
    modifiche: Partial<RigaReportFatturazione> = {},
  ): RigaReportFatturazione {
    return riga({
      gestioneTrasfertaOfferta: "FORFETTARIA",
      importoTrasfertaForfettariaOfferta: "80.00",
      rimborsoTrasfertaImporto: "35.00",
      ...modifiche,
    });
  }

  it("fattura un forfait per ogni collaboratore in trasferta nello stesso giorno", () => {
    const righe = [
      rigaForfettaria({ collaboratoreId: "c-1", data: "2026-03-02" }),
      rigaForfettaria({ collaboratoreId: "c-2", collaboratoreNome: "Anna Bianchi", data: "2026-03-02" }),
      rigaForfettaria({ collaboratoreId: "c-1", data: "2026-03-03" }),
    ];

    const offerta = calcolaReportFatturazioneClienti(righe).perCliente[0].perOfferta[0];

    expect(offerta.giorniTrasferta).toBe(3);
    expect(offerta.importoTrasfertaForfettaria).toBe("80.00");
    expect(offerta.importoTrasferte).toBe("240.00");
  });

  it("conta una sola volta più righe dello stesso collaboratore nello stesso giorno", () => {
    const righe = [
      rigaForfettaria({ ore: 4 }),
      rigaForfettaria({ ore: 4 }),
    ];

    const offerta = calcolaReportFatturazioneClienti(righe).perCliente[0].perOfferta[0];

    expect(offerta.giorniTrasferta).toBe(1);
    expect(offerta.importoTrasferte).toBe("80.00");
  });

  it("conta il giorno di trasferta qualunque sia la categoria dell'attività", () => {
    const righe = [
      rigaForfettaria({ fatturabile: true, data: "2026-03-02" }),
      rigaForfettaria({ fatturabile: false, data: "2026-03-03" }),
    ];

    const offerta = calcolaReportFatturazioneClienti(righe).perCliente[0].perOfferta[0];

    expect(offerta.giorniTrasferta).toBe(2);
  });

  it("non conta giorni senza rimborso trasferta registrato", () => {
    const righe = [rigaForfettaria({ rimborsoTrasfertaImporto: null })];

    const offerta = calcolaReportFatturazioneClienti(righe).perCliente[0].perOfferta[0];

    expect(offerta.giorniTrasferta).toBe(0);
    expect(offerta.importoTrasferte).toBe("0.00");
  });

  it("non fattura trasferte su un'offerta con trasferta inclusa, anche con rimborsi", () => {
    const righe = [riga({ rimborsoTrasfertaImporto: "85.00" })];

    const cliente = calcolaReportFatturazioneClienti(righe).perCliente[0];

    expect(cliente.perOfferta[0].giorniTrasferta).toBe(0);
    expect(cliente.perOfferta[0].importoTrasfertaForfettaria).toBeNull();
    expect(cliente.trasferteForfettarie).toBe("0.00");
    expect(cliente.importoTotale).toBe("500.00");
  });

  it("non ribalta al cliente gli importi dei rimborsi dei collaboratori", () => {
    const righe = [rigaForfettaria({ rimborsoTrasfertaImporto: "110.00" })];

    const cliente = calcolaReportFatturazioneClienti(righe).perCliente[0];

    expect(cliente.trasferteForfettarie).toBe("80.00");
    expect(cliente.importoTotale).toBe("580.00");
  });

  it("calcola il totale cliente come imponibile più trasferte forfettarie delle sue offerte", () => {
    const righe = [
      rigaForfettaria({ offertaId: "offerta-a", offertaCodice: "OFF-A" }),
      riga({ offertaId: "offerta-b", offertaCodice: "OFF-B", rimborsoTrasfertaImporto: "35.00" }),
    ];

    const cliente = calcolaReportFatturazioneClienti(righe).perCliente[0];

    expect(cliente.imponibileManodopera).toBe("1000.00");
    expect(cliente.trasferteForfettarie).toBe("80.00");
    expect(cliente.importoTotale).toBe("1080.00");
  });

  it("calcola i totali di report come somma dei valori per cliente", () => {
    const righe = [
      rigaForfettaria({
        clienteId: "cliente-alfa",
        clienteRagioneSociale: "Alfa SPA",
        tariffaOffertaGiornaliera: 500,
      }),
      rigaForfettaria({
        clienteId: "cliente-beta",
        clienteRagioneSociale: "Beta SRL",
        offertaId: "offerta-2",
        tariffaOffertaGiornaliera: 400,
        importoTrasfertaForfettariaOfferta: "20.00",
      }),
    ];

    const report = calcolaReportFatturazioneClienti(righe);

    expect(report.totali.imponibileManodopera).toBe("900.00");
    expect(report.totali.totaleTrasferteForfettarie).toBe("100.00");
    expect(report.totali.importoTotale).toBe("1000.00");
  });

  it("include un cliente con sole trasferte forfettarie e nessuna giornata fatturabile", () => {
    const righe = [rigaForfettaria({ fatturabile: false })];

    const report = calcolaReportFatturazioneClienti(righe);

    expect(report.perCliente).toHaveLength(1);
    const cliente = report.perCliente[0];
    expect(cliente.perOfferta[0].giornateFatturabili).toBe(0);
    expect(cliente.perOfferta[0].perCollaboratore).toEqual([]);
    expect(cliente.imponibileManodopera).toBe("0.00");
    expect(cliente.trasferteForfettarie).toBe("80.00");
  });

  it("esclude un cliente con soli rimborsi su offerte con trasferta inclusa", () => {
    const righe = [riga({ fatturabile: false, rimborsoTrasfertaImporto: "85.00" })];

    expect(calcolaReportFatturazioneClienti(righe).perCliente).toEqual([]);
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

    it("non altera l'allocazione con un'offerta di sole trasferte forfettarie", () => {
      const righe = [
        riga({ ore: 8 }),
        riga({
          offertaId: "offerta-solo-trasferte",
          offertaCodice: "OFF-T",
          fatturabile: false,
          gestioneTrasfertaOfferta: "FORFETTARIA",
          importoTrasfertaForfettariaOfferta: "80.00",
          rimborsoTrasfertaImporto: "35.00",
        }),
      ];

      const cliente = calcolaReportFatturazioneClienti(righe).perCliente[0];

      expect(cliente.perOfferta.map((o) => o.offertaCodice)).toEqual(["OFF-001", "OFF-T"]);
      expect(cliente.perOfferta[0].perCollaboratore[0].imponibile).toBe("500.00");
      expect(cliente.importoTotale).toBe("580.00");
    });
  });
});

describe("calcolaReportFatturazioneClienti — ore senza offerta", () => {
  const senzaOfferta = {
    offertaId: null,
    offertaCodice: "Senza offerta",
    offertaDescrizione: "da assegnare a un'offerta",
    tariffaOffertaGiornaliera: 0,
  };

  it("riporta le ore senza offerta in una voce a importo zero, in fondo al cliente", () => {
    const report = calcolaReportFatturazioneClienti([
      riga({ ore: 8 }),
      riga({ ...senzaOfferta, ore: 4 }),
    ]);

    const [cliente] = report.perCliente;
    expect(cliente.perOfferta.map((voce) => voce.offertaId)).toEqual(["offerta-1", null]);
    const voceSenzaOfferta = cliente.perOfferta[1];
    expect(voceSenzaOfferta.giornateFatturabili).toBe(0.5);
    expect(voceSenzaOfferta.imponibile).toBe("0.00");
    expect(voceSenzaOfferta.perCollaboratore).toEqual([
      expect.objectContaining({ collaboratoreNome: "Mario Rossi", oreFatturabili: 4, imponibile: "0.00" }),
    ]);
    expect(cliente.importoTotale).toBe("500.00");
    expect(report.totali.importoTotale).toBe("500.00");
  });

  it("non applica trasferte forfettarie alle ore senza offerta", () => {
    const report = calcolaReportFatturazioneClienti([
      riga({
        ...senzaOfferta,
        rimborsoTrasfertaImporto: "30.00",
        gestioneTrasfertaOfferta: "FORFETTARIA",
        importoTrasfertaForfettariaOfferta: "80.00",
      }),
    ]);

    const voce = report.perCliente[0].perOfferta[0];
    expect(voce.giorniTrasferta).toBe(0);
    expect(voce.importoTrasferte).toBe("0.00");
    expect(report.totali.importoTotale).toBe("0.00");
  });
});
