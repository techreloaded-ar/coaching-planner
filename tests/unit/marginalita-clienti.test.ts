import { describe, it, expect } from "vitest";
import {
  calcolaMarginalitaClienti,
  calcolaReportFatturazioneClienti,
  calcolaRiepilogoMese,
  type RigaMarginalita,
  type RigaReportFatturazione,
  type RigaRiepilogo,
} from "@/domain/consuntivi";
import { normalizzaPeriodoMesi } from "@/domain/calendario";

function riga(modifiche: Partial<RigaMarginalita> = {}): RigaMarginalita {
  return {
    clienteId: "cliente-1",
    clienteRagioneSociale: "Cliente Uno",
    offertaId: "offerta-1",
    offertaCodice: "OFF-001",
    offertaDescrizione: "Sviluppo software",
    tariffaOffertaGiornaliera: 600,
    collaboratoreId: "collab-1",
    mese: "2026-01",
    modalitaTariffaCollaboratore: "GIORNALIERA",
    importoTariffaCollaboratore: 400,
    ore: 8,
    categoria: "FATTURABILE",
    ...modifiche,
  };
}

const offertaA = {
  offertaId: "offerta-a",
  offertaCodice: "OFF-A",
  tariffaOffertaGiornaliera: 600,
};
const offertaB = {
  offertaId: "offerta-b",
  offertaCodice: "OFF-B",
  tariffaOffertaGiornaliera: 300,
};

describe("calcolaMarginalitaClienti", () => {
  it("restituisce un report vuoto con totali a zero", () => {
    const report = calcolaMarginalitaClienti([]);

    expect(report.perCliente).toEqual([]);
    expect(report.totali).toEqual({
      giornateFatturabili: 0,
      ricavi: "0.00",
      costi: "0.00",
      margine: "0.00",
      marginePercentuale: null,
      margineNegativo: false,
    });
  });

  describe("scenario con due offerte, una in perdita", () => {
    const report = calcolaMarginalitaClienti([
      riga({ ...offertaA, ore: 12 }),
      riga({ ...offertaB, ore: 8 }),
    ]);
    const cliente = report.perCliente[0];

    it("calcola ricavi, costi e margine per cliente (AC-1)", () => {
      expect(report.perCliente).toHaveLength(1);
      expect(cliente.ricavi).toBe("1200.00");
      expect(cliente.costi).toBe("1000.00");
      expect(cliente.margine).toBe("200.00");
      expect(cliente.marginePercentuale).toBeCloseTo(1 / 6, 4);
      expect(report.totali.margine).toBe("200.00");
    });

    it("calcola ricavi, costi e margine per offerta (AC-2)", () => {
      const [a, b] = cliente.perOfferta;
      expect(a).toMatchObject({
        offertaCodice: "OFF-A",
        giornateFatturabili: 1.5,
        ricavi: "900.00",
        costi: "600.00",
        margine: "300.00",
      });
      expect(b).toMatchObject({
        offertaCodice: "OFF-B",
        ricavi: "300.00",
        costi: "400.00",
        margine: "-100.00",
      });
    });

    it("evidenzia come negativo solo il margine sotto zero (AC-4)", () => {
      const [a, b] = cliente.perOfferta;
      expect(a.margineNegativo).toBe(false);
      expect(b.margineNegativo).toBe(true);
      expect(cliente.margineNegativo).toBe(false);
      expect(report.totali.margineNegativo).toBe(false);
    });
  });

  it("segnala negativo il cliente quando tutte le sue offerte sono in perdita (AC-4)", () => {
    const report = calcolaMarginalitaClienti([
      riga({ tariffaOffertaGiornaliera: 300 }),
    ]);

    expect(report.perCliente[0].margineNegativo).toBe(true);
    expect(report.totali.margineNegativo).toBe(true);
  });

  it("conta il costo delle righe Non fatturabile senza ricavo ed esclude l'Investimento", () => {
    const report = calcolaMarginalitaClienti([
      riga({ tariffaOffertaGiornaliera: 800, ore: 8, categoria: "FATTURABILE" }),
      riga({ tariffaOffertaGiornaliera: 800, ore: 8, categoria: "NON_FATTURABILE" }),
      riga({ tariffaOffertaGiornaliera: 800, ore: 8, categoria: "INVESTIMENTO" }),
    ]);

    expect(report.perCliente[0].perOfferta[0]).toMatchObject({
      giornateFatturabili: 1,
      ricavi: "800.00",
      costi: "800.00",
      margine: "0.00",
      margineNegativo: false,
    });
  });

  it("mostra con margine negativo l'offerta con sole righe Non fatturabile", () => {
    const report = calcolaMarginalitaClienti([
      riga({ ...offertaA, ore: 8 }),
      riga({ ...offertaB, ore: 4, categoria: "NON_FATTURABILE" }),
    ]);

    const [, b] = report.perCliente[0].perOfferta;
    expect(b).toMatchObject({
      offertaCodice: "OFF-B",
      giornateFatturabili: 0,
      ricavi: "0.00",
      costi: "200.00",
      margine: "-200.00",
      marginePercentuale: null,
      margineNegativo: true,
    });
    expect(report.perCliente[0].costi).toBe("600.00");
  });

  it("omette il cliente con sole righe di Investimento", () => {
    const report = calcolaMarginalitaClienti([riga({ categoria: "INVESTIMENTO" })]);
    expect(report.perCliente).toEqual([]);
  });

  it("ordina clienti per ragione sociale e offerte per codice", () => {
    const report = calcolaMarginalitaClienti([
      riga({ clienteId: "z", clienteRagioneSociale: "Zeta", ...offertaB }),
      riga({ clienteId: "a", clienteRagioneSociale: "Alfa", ...offertaB }),
      riga({ clienteId: "a", clienteRagioneSociale: "Alfa", ...offertaA }),
    ]);

    expect(report.perCliente.map((c) => c.clienteRagioneSociale)).toEqual([
      "Alfa",
      "Zeta",
    ]);
    expect(report.perCliente[0].perOfferta.map((o) => o.offertaCodice)).toEqual(
      ["OFF-A", "OFF-B"],
    );
  });

  it("calcola il margine come differenza degli importi arrotondati", () => {
    const [cliente] = calcolaMarginalitaClienti([
      riga({
        ore: 1,
        tariffaOffertaGiornaliera: 333.35,
        importoTariffaCollaboratore: 111.15,
      }),
    ]).perCliente;

    expect(cliente.ricavi).toBe("41.67");
    expect(cliente.costi).toBe("13.89");
    expect(cliente.margine).toBe("27.78");
  });

  describe("coerenza con i report mensili esistenti (AC-3)", () => {
    const righe: RigaMarginalita[] = [
      riga({
        clienteId: "c1",
        clienteRagioneSociale: "Alfa",
        offertaId: "o1",
        offertaCodice: "O-1",
        tariffaOffertaGiornaliera: "512.50",
        ore: 2.5,
        importoTariffaCollaboratore: "333.33",
      }),
      riga({
        clienteId: "c1",
        clienteRagioneSociale: "Alfa",
        offertaId: "o1",
        offertaCodice: "O-1",
        tariffaOffertaGiornaliera: "512.50",
        ore: 5.75,
        importoTariffaCollaboratore: "410.10",
      }),
      riga({
        clienteId: "c2",
        clienteRagioneSociale: "Beta",
        offertaId: "o2",
        offertaCodice: "O-2",
        tariffaOffertaGiornaliera: 777.77,
        ore: 7.25,
        importoTariffaCollaboratore: "410.10",
      }),
    ];

    it("i ricavi coincidono con l'imponibile del report fatturazione clienti", () => {
      const fatturazione = calcolaReportFatturazioneClienti(
        righe.map(
          (r): RigaReportFatturazione => ({
            clienteId: r.clienteId,
            clienteRagioneSociale: r.clienteRagioneSociale,
            offertaId: r.offertaId,
            offertaCodice: r.offertaCodice,
            offertaDescrizione: r.offertaDescrizione,
            tariffaOffertaGiornaliera: r.tariffaOffertaGiornaliera,
            collaboratoreId: "x",
            collaboratoreNome: "X",
            ore: r.ore,
            fatturabile: r.categoria === "FATTURABILE",
            rimborsoTrasfertaImporto: null,
            data: "2026-01-01",
            gestioneTrasfertaOfferta: "INCLUSA",
            importoTrasfertaForfettariaOfferta: null,
          }),
        ),
      );
      const marginalita = calcolaMarginalitaClienti(righe);

      expect(marginalita.perCliente.map((c) => c.ricavi)).toEqual(
        fatturazione.perCliente.map((c) => c.imponibileManodopera),
      );
      for (const [i, cliente] of marginalita.perCliente.entries()) {
        expect(cliente.perOfferta.map((o) => o.ricavi)).toEqual(
          fatturazione.perCliente[i].perOfferta.map((o) => o.imponibile),
        );
      }
      expect(marginalita.totali.ricavi).toBe(
        fatturazione.totali.imponibileManodopera,
      );
    });

    it("i costi di un collaboratore coincidono con l'imponibile del riepilogo mensile", () => {
      const tariffa = "410.10";
      const righeCollaboratore = righe.filter(
        (r) => r.importoTariffaCollaboratore === tariffa,
      );
      const riepilogo = calcolaRiepilogoMese(
        righeCollaboratore.map(
          (r): RigaRiepilogo => ({
            offertaId: r.offertaId,
            offertaCodice: r.offertaCodice,
            offertaDescrizione: r.offertaDescrizione,
            clienteRagioneSociale: r.clienteRagioneSociale,
            ore: r.ore,
            categoria: r.categoria,
            rimborsoTrasfertaImporto: null,
          }),
        ),
        { modalita: "GIORNALIERA", importo: tariffa, validaDalMese: "2026-01" },
      );

      expect(calcolaMarginalitaClienti(righeCollaboratore).totali.costi).toBe(
        riepilogo.breakdown.imponibileManodopera,
      );
    });
  });
});

describe("calcolaMarginalitaClienti — ore senza offerta", () => {
  const senzaOfferta = {
    offertaId: null,
    offertaCodice: "Senza offerta",
    offertaDescrizione: "da assegnare a un'offerta",
    tariffaOffertaGiornaliera: 0,
  };

  it("mostra la voce senza offerta con ricavi zero e costi del collaboratore", () => {
    const report = calcolaMarginalitaClienti([riga({ ore: 8 }), riga({ ...senzaOfferta, ore: 4 })]);

    const [cliente] = report.perCliente;
    expect(cliente.perOfferta.map((voce) => voce.offertaId)).toEqual(["offerta-1", null]);
    const voce = cliente.perOfferta[1];
    expect(voce.ricavi).toBe("0.00");
    expect(voce.costi).toBe("200.00");
    expect(report.totali.ricavi).toBe("600.00");
    expect(report.totali.costi).toBe("600.00");
  });

  it("ripartisce il fisso mensile anche sulle ore senza offerta", () => {
    const report = calcolaMarginalitaClienti(
      [
        riga({ ore: 8, modalitaTariffaCollaboratore: "FISSO_MENSILE", importoTariffaCollaboratore: 3000 }),
        riga({ ...senzaOfferta, ore: 8, modalitaTariffaCollaboratore: "FISSO_MENSILE", importoTariffaCollaboratore: 3000 }),
      ],
      [{ collaboratoreId: "collab-1", mese: "2026-01", importo: "3000" }],
    );

    const [conOfferta, senza] = report.perCliente[0].perOfferta;
    expect(conOfferta.fissoRipartito).toBe("1500.00");
    expect(senza.fissoRipartito).toBe("1500.00");
  });
});

describe("calcolaMarginalitaClienti — storico tariffe del collaboratore", () => {
  const offertaC = {
    offertaId: "offerta-c",
    offertaCodice: "OFF-C",
    tariffaOffertaGiornaliera: 300,
  };
  const aFisso = {
    collaboratoreId: "collab-fisso",
    mese: "2026-03",
    modalitaTariffaCollaboratore: "FISSO_MENSILE" as const,
    importoTariffaCollaboratore: 6500,
  };

  it("il costo giornaliero usa la tariffa valida nel mese di ogni riga", () => {
    const report = calcolaMarginalitaClienti([
      riga({ mese: "2026-01", importoTariffaCollaboratore: 400, ore: 8 }),
      riga({ mese: "2026-02", importoTariffaCollaboratore: "500.00", ore: 8 }),
    ]);

    expect(report.perCliente[0].perOfferta[0]).toMatchObject({
      ricavi: "1200.00",
      costi: "900.00",
      fissoRipartito: "0.00",
    });
    expect(report.fissiNonAttribuibili).toBe("0.00");
  });

  it("ripartisce il fisso mensile sulle offerte in proporzione alle ore Fatturabile e Non fatturabile", () => {
    const report = calcolaMarginalitaClienti(
      [
        riga({ ...aFisso, ...offertaA, ore: 80 }),
        riga({ ...aFisso, ...offertaB, ore: 16 }),
        riga({ ...aFisso, ...offertaB, ore: 4, categoria: "NON_FATTURABILE" }),
        riga({ ...aFisso, ...offertaB, ore: 40, categoria: "INVESTIMENTO" }),
      ],
      [{ collaboratoreId: "collab-fisso", mese: "2026-03", importo: "6500.00" }],
    );

    const [a, b] = report.perCliente[0].perOfferta;
    expect(a).toMatchObject({ offertaCodice: "OFF-A", costi: "5200.00", fissoRipartito: "5200.00" });
    expect(b).toMatchObject({ offertaCodice: "OFF-B", costi: "1300.00", fissoRipartito: "1300.00" });
    expect(report.totali.costi).toBe("6500.00");
    expect(report.fissiNonAttribuibili).toBe("0.00");
  });

  it("arrotonda le quote al centesimo con somma esattamente pari al fisso", () => {
    const report = calcolaMarginalitaClienti(
      [
        riga({ ...aFisso, ...offertaA, ore: 8 }),
        riga({ ...aFisso, ...offertaB, ore: 8 }),
        riga({ ...aFisso, ...offertaC, ore: 8 }),
      ],
      [{ collaboratoreId: "collab-fisso", mese: "2026-03", importo: 100 }],
    );

    const quote = report.perCliente[0].perOfferta.map((o) => o.fissoRipartito);
    expect(quote).toEqual(["33.34", "33.33", "33.33"]);
    expect(report.perCliente[0].costi).toBe("100.00");
    expect(report.totali.costi).toBe("100.00");
  });

  it("un fisso senza ore nel mese è non attribuibile ma pesa sui costi totali", () => {
    const report = calcolaMarginalitaClienti(
      [riga({ ore: 8 })],
      [{ collaboratoreId: "collab-fisso", mese: "2026-03", importo: "1000.00" }],
    );

    expect(report.perCliente[0].costi).toBe("400.00");
    expect(report.perCliente[0].perOfferta[0].fissoRipartito).toBe("0.00");
    expect(report.fissiNonAttribuibili).toBe("1000.00");
    expect(report.totali.costi).toBe("1400.00");
    expect(report.totali.margine).toBe("-800.00");
  });

  it("le sole ore di Investimento di un collaboratore a fisso non attribuiscono il fisso", () => {
    const report = calcolaMarginalitaClienti(
      [riga({ ...aFisso, ore: 8, categoria: "INVESTIMENTO" })],
      [{ collaboratoreId: "collab-fisso", mese: "2026-03", importo: "6500.00" }],
    );

    expect(report.perCliente).toEqual([]);
    expect(report.fissiNonAttribuibili).toBe("6500.00");
    expect(report.totali.costi).toBe("6500.00");
  });
});

describe("normalizzaPeriodoMesi", () => {
  it("usa il mese corrente quando i valori mancano", () => {
    expect(normalizzaPeriodoMesi(undefined, undefined, "2026-10")).toEqual({
      da: "2026-10",
      a: "2026-10",
    });
  });

  it("usa il mese corrente per i token non validi", () => {
    expect(normalizzaPeriodoMesi("xx", "2026-13", "2026-10")).toEqual({
      da: "2026-10",
      a: "2026-10",
    });
  });

  it("scambia gli estremi quando da è successivo ad a", () => {
    expect(normalizzaPeriodoMesi("2026-05", "2026-02", "2026-10")).toEqual({
      da: "2026-02",
      a: "2026-05",
    });
  });

  it("lascia invariato un intervallo valido a cavallo d'anno", () => {
    expect(normalizzaPeriodoMesi("2025-12", "2026-01", "2026-10")).toEqual({
      da: "2025-12",
      a: "2026-01",
    });
  });
});
