import { describe, it, expect } from "vitest";
import {
  calcolaReportFatturazioneClienti,
  type RigaReportFatturazione,
} from "@/domain/consuntivi";
import {
  costruisciFogliFatturazioneClienti,
  nomeFileFatturazioneClienti,
} from "@/lib/esportazione-fatturazione";
import { creaXlsx } from "@/lib/xlsx";
import { leggiXlsx } from "../e2e/support/xlsx-lettura";

function riga(
  modifiche: Partial<RigaReportFatturazione> = {},
): RigaReportFatturazione {
  return {
    clienteId: "cliente-1",
    clienteRagioneSociale: "Alfa",
    offertaId: "offerta-1",
    offertaCodice: "OFF-001",
    offertaDescrizione: "Sviluppo software",
    tariffaOffertaGiornaliera: 500,
    collaboratoreId: "collaboratore-1",
    collaboratoreNome: "Mario Rossi",
    ore: 8,
    fatturabile: true,
    rimborsoTrasfertaImporto: null,
    data: "2026-05-04",
    gestioneTrasfertaOfferta: "INCLUSA",
    importoTrasfertaForfettariaOfferta: null,
    ...modifiche,
  };
}

function esporta(righe: RigaReportFatturazione[]) {
  const report = { token: "2026-05", ...calcolaReportFatturazioneClienti(righe) };
  const [riepilogo, dettaglio] = leggiXlsx(
    creaXlsx(costruisciFogliFatturazioneClienti(report, "Maggio 2026")),
  ).fogli;
  return { report, riepilogo, dettaglio };
}

const num = (valore: string) => Number(valore);

describe("costruisciFogliFatturazioneClienti", () => {
  const righe = [
    riga({ ore: 8 }),
    riga({
      collaboratoreId: "collaboratore-2",
      collaboratoreNome: "Anna Verdi",
      ore: 4,
      rimborsoTrasfertaImporto: "35.00",
    }),
    riga({ ore: 6, fatturabile: false }),
    ...[
      { collaboratoreId: "collaboratore-1", data: "2026-05-04" },
      { collaboratoreId: "collaboratore-2", data: "2026-05-04" },
    ].map((modifiche) =>
      riga({
        offertaId: "offerta-2",
        offertaCodice: "OFF-002",
        offertaDescrizione: "Coaching",
        tariffaOffertaGiornaliera: 300,
        ore: 4,
        rimborsoTrasfertaImporto: "35.00",
        gestioneTrasfertaOfferta: "FORFETTARIA",
        importoTrasfertaForfettariaOfferta: "80.00",
        ...modifiche,
      }),
    ),
    riga({
      clienteId: "cliente-2",
      clienteRagioneSociale: "Beta",
      offertaId: "offerta-3",
      offertaCodice: "OFF-003",
      offertaDescrizione: "Formazione",
      tariffaOffertaGiornaliera: "512.50",
      collaboratoreId: "collaboratore-3",
      collaboratoreNome: "Luca Neri",
      ore: 2.5,
    }),
  ];

  it("riporta titolo, intestazioni e offerte con i valori del report", () => {
    const { report, riepilogo } = esporta(righe);

    expect(riepilogo.nome).toBe("Fatturazione clienti");
    expect(riepilogo.righe[0]).toEqual(["Fatturazione clienti — Maggio 2026"]);
    expect(riepilogo.righe[2]).toEqual([
      "Cliente",
      "Codice offerta",
      "Descrizione offerta",
      "Tariffa/gg",
      "Giornate",
      "Imponibile manodopera",
      "Giorni trasferta",
      "Trasferte forfettarie",
      "Totale da fatturare",
    ]);

    const alfa = report.perCliente[0];
    const [prima, seconda] = alfa.perOfferta;
    expect(riepilogo.righe[3]).toEqual([
      "Alfa",
      prima.offertaCodice,
      prima.offertaDescrizione,
      num(prima.tariffaGiornaliera),
      prima.giornateFatturabili,
      num(prima.imponibile),
      0,
      0,
    ]);
    expect(riepilogo.righe[4]).toEqual([
      "Alfa",
      seconda.offertaCodice,
      seconda.offertaDescrizione,
      num(seconda.tariffaGiornaliera),
      seconda.giornateFatturabili,
      num(seconda.imponibile),
      2,
      160,
    ]);
    expect(seconda.importoTrasferte).toBe("160.00");
  });

  it("riporta i totali di ogni cliente e il totale mese uguali al report", () => {
    const { report, riepilogo } = esporta(righe);
    const [alfa, beta] = report.perCliente;

    const totaleAlfa = riepilogo.righe.find((r) => r[0] === "Totale Alfa")!;
    expect(totaleAlfa.slice(4)).toEqual([
      alfa.perOfferta.reduce((s, o) => s + o.giornateFatturabili, 0),
      num(alfa.imponibileManodopera),
      2,
      num(alfa.trasferteForfettarie),
      num(alfa.importoTotale),
    ]);

    const totaleBeta = riepilogo.righe.find((r) => r[0] === "Totale Beta")!;
    expect(totaleBeta.slice(5)).toEqual([
      num(beta.imponibileManodopera),
      0,
      num(beta.trasferteForfettarie),
      num(beta.importoTotale),
    ]);

    const totaleMese = riepilogo.righe.at(-1)!;
    expect(totaleMese[0]).toBe("Totale mese");
    expect(totaleMese.slice(5)).toEqual([
      num(report.totali.imponibileManodopera),
      2,
      num(report.totali.totaleTrasferteForfettarie),
      num(report.totali.importoTotale),
    ]);
    expect(totaleMese[4]).toBe(
      report.perCliente
        .flatMap((c) => c.perOfferta)
        .reduce((s, o) => s + o.giornateFatturabili, 0),
    );
  });

  it("include un cliente di sole trasferte forfettarie con giornate 0", () => {
    const { riepilogo } = esporta([
      riga({
        clienteRagioneSociale: "Solo Trasferte",
        fatturabile: false,
        rimborsoTrasfertaImporto: "20.00",
        gestioneTrasfertaOfferta: "FORFETTARIA",
        importoTrasfertaForfettariaOfferta: "80.00",
      }),
    ]);

    expect(riepilogo.righe.find((r) => r[1] === "OFF-001")!.slice(4)).toEqual(
      [0, 0, 1, 80],
    );
    expect(riepilogo.righe.find((r) => r[0] === "Totale Solo Trasferte")!.slice(4)).toEqual(
      [0, 0, 1, 80, 80],
    );
    expect(riepilogo.righe.at(-1)!.slice(4)).toEqual([0, 0, 1, 80, 80]);
  });

  it("con report vuoto contiene solo titolo, intestazioni e totale mese a zero", () => {
    const { riepilogo, dettaglio } = esporta([]);

    expect(riepilogo.righe).toHaveLength(4);
    expect(riepilogo.righe[3]).toEqual(["Totale mese", null, null, null, 0, 0, 0, 0, 0]);
    expect(dettaglio.righe).toHaveLength(3);
  });

  it("il secondo foglio ha una riga per collaboratore e offerta come il report", () => {
    const { report, dettaglio } = esporta(righe);

    expect(dettaglio.nome).toBe("Dettaglio collaboratori");
    const attese = report.perCliente.flatMap((c) =>
      c.perOfferta.flatMap((o) =>
        o.perCollaboratore.map((v) => [
          c.clienteRagioneSociale,
          o.offertaCodice,
          v.collaboratoreNome,
          v.oreFatturabili,
          v.giornateFatturabili,
          num(v.imponibile),
        ]),
      ),
    );
    expect(dettaglio.righe.slice(3)).toEqual(attese);
    expect(attese).toHaveLength(5);
  });

  it("conserva le ragioni sociali con caratteri speciali", () => {
    const { riepilogo } = esporta([riga({ clienteRagioneSociale: "Rossi & Figli" })]);

    expect(riepilogo.righe[3][0]).toBe("Rossi & Figli");
    expect(riepilogo.righe.some((r) => r[0] === "Totale Rossi & Figli")).toBe(true);
  });

  it("nomeFileFatturazioneClienti contiene il token del mese", () => {
    expect(nomeFileFatturazioneClienti("2026-05")).toBe(
      "fatturazione-clienti-2026-05.xlsx",
    );
  });
});
