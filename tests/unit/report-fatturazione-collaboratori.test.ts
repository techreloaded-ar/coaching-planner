import { describe, it, expect } from "vitest";

import {
  calcolaReportFatturazioneCollaboratori,
  type CollaboratoreDelMese,
  type RigaRiepilogo,
} from "@/domain/consuntivi";

function riga(parziale: Partial<RigaRiepilogo> = {}): RigaRiepilogo {
  return {
    offertaId: "off-1",
    offertaCodice: "OFF-001",
    offertaDescrizione: "Percorso coaching",
    clienteId: "cliente-1",
    clienteRagioneSociale: "Cliente Uno",
    ore: 8,
    categoria: "FATTURABILE",
    rimborsoTrasfertaImporto: null,
    ...parziale,
  };
}

function collaboratore(parziale: Partial<CollaboratoreDelMese>): CollaboratoreDelMese {
  return {
    collaboratoreId: "c",
    nome: "Nome",
    cognome: "Cognome",
    attivo: true,
    tariffa: { modalita: "GIORNALIERA", importo: "450.00", validaDalMese: "2026-01" },
    righe: [],
    ...parziale,
  };
}

describe("calcolaReportFatturazioneCollaboratori", () => {
  it("include il mensile storico valido anche per un coach oggi cessato e senza righe", () => {
    const report = calcolaReportFatturazioneCollaboratori([collaboratore({
      attivo: false, righe: [], tariffa: { modalita: "FISSO_MENSILE", importo: "3500.00", validaDalMese: "2019-01", validaAlMese: "2019-12" },
    })]);
    expect(report.perCollaboratore).toHaveLength(1);
    expect(report.perCollaboratore[0].prestazioni).toBe("3500.00");
  });
  it("calcola per ciascuno l'importo del riepilogo mensile, con fogli vuoti in fondo e totali", () => {
    const report = calcolaReportFatturazioneCollaboratori([
      collaboratore({ collaboratoreId: "luca", nome: "Luca", cognome: "Bianchi" }),
      collaboratore({
        collaboratoreId: "giulia",
        nome: "Giulia",
        cognome: "Conti",
        righe: [
          riga({ ore: 16, rimborsoTrasfertaImporto: "40.00" }),
          riga({ ore: 4, categoria: "NON_FATTURABILE" }),
          riga({ ore: 8, categoria: "INVESTIMENTO" }),
        ],
      }),
      collaboratore({
        collaboratoreId: "paolo",
        nome: "Paolo",
        cognome: "Neri",
        tariffa: { modalita: "FISSO_MENSILE", importo: "1000.00", validaDalMese: "2026-01" },
      }),
      collaboratore({ collaboratoreId: "ex-senza-righe", attivo: false }),
      collaboratore({ collaboratoreId: "ex-con-righe", nome: "Anna", cognome: "Arancio", attivo: false, righe: [riga()] }),
      collaboratore({ collaboratoreId: "senza-tariffa", nome: "Zeno", cognome: "Zeta", tariffa: null, righe: [riga()] }),
    ]);

    expect(report.perCollaboratore.map((voce) => voce.collaboratoreId)).toEqual([
      "ex-con-righe",
      "giulia",
      "senza-tariffa",
      "luca",
      "paolo",
    ]);

    const giulia = report.perCollaboratore[1];
    expect(giulia).toMatchObject({
      collaboratoreNome: "Giulia Conti",
      modalitaTariffa: "GIORNALIERA",
      giornateDaFatturare: 2.5,
      prestazioni: "1125.00",
      rimborsiTrasferta: "40.00",
      importoAtteso: "1165.00",
      foglioVuoto: false,
    });

    expect(report.perCollaboratore[2]).toMatchObject({ modalitaTariffa: null, importoAtteso: "0.00" });
    expect(report.perCollaboratore[3]).toMatchObject({ foglioVuoto: true, importoAtteso: "0.00" });
    // Il fisso mensile è dovuto anche con il foglio vuoto.
    expect(report.perCollaboratore[4]).toMatchObject({ foglioVuoto: true, importoAtteso: "1000.00" });

    expect(report.totali).toEqual({
      fattureAttese: 3,
      giornateDaFatturare: 4.5,
      prestazioni: "2575.00",
      rimborsiTrasferta: "40.00",
      importoAtteso: "2615.00",
    });
  });

  it("restituisce un report vuoto senza collaboratori", () => {
    expect(calcolaReportFatturazioneCollaboratori([]).totali.importoAtteso).toBe("0.00");
  });
});

describe("calcolaReportFatturazioneCollaboratori con tariffa Percentuale", () => {
  it("riporta lo stesso compenso del riepilogo, con le sole giornate Fatturabile", () => {
    const report = calcolaReportFatturazioneCollaboratori([
      collaboratore({
        tariffa: { modalita: "PERCENTUALE", importo: "20.00", validaDalMese: "2026-01" },
        righe: [
          riga({ ore: 16, tariffaOffertaGiornaliera: "1000.00", rimborsoTrasfertaImporto: "50.00" }),
          riga({ ore: 8, categoria: "NON_FATTURABILE", tariffaOffertaGiornaliera: "1000.00" }),
        ],
      }),
    ]);

    expect(report.perCollaboratore[0]).toMatchObject({
      modalitaTariffa: "PERCENTUALE",
      importoTariffa: "20.00",
      giornateDaFatturare: 2,
      prestazioni: "1600.00",
      importoAtteso: "1650.00",
    });
  });
});
