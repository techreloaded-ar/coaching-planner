import { describe, it, expect } from "vitest";

import {
  FILTRI_VUOTI,
  OFFERTA_DA_DEFINIRE,
  filtraRigheElenco,
  filtriDaQuery,
  filtriEffettivi,
  importoFatturaElenco,
  opzioniOfferte,
  queryFiltri,
  segmentiNota,
  totaliElenco,
  urlElenco,
} from "@/app/(front-office)/attivita/filtri-elenco";
import type { RigaAttivitaClient } from "@/lib/attivita-contract";

function riga(parziale: Partial<RigaAttivitaClient> & { id: string }): RigaAttivitaClient {
  return {
    data: "2026-11-04",
    ore: 2,
    nota: null,
    categoria: "FATTURABILE",
    rimborsoTrasfertaEtichetta: null,
    rimborsoTrasfertaImporto: null,
    offerta: { id: "off-a", codice: "OFF-A", descrizione: "Coaching Alpha", attiva: true },
    offertaNonAbilitata: false,
    cliente: { id: "cli-tech", ragioneSociale: "TechSolutions" },
    ...parziale,
  };
}

const righe = [
  riga({ id: "1", nota: "Sprint Retrospective team Alpha" }),
  riga({ id: "2", nota: "Planning", ore: 6, rimborsoTrasfertaImporto: "45.10" }),
  riga({
    id: "3",
    nota: "preparazione retro",
    ore: 1.5,
    offerta: { id: "off-b", codice: "OFF-B", descrizione: "Formazione PO", attiva: true },
  }),
  riga({
    id: "4",
    nota: "Kickoff retro",
    offerta: null,
    cliente: { id: "cli-data", ragioneSociale: "DataFlow" },
    rimborsoTrasfertaImporto: "20.20",
  }),
];

const ids = (elenco: RigaAttivitaClient[]) => elenco.map((r) => r.id);

describe("Elenco attività: filtri", () => {
  it("senza filtri mostra tutte le righe", () => {
    expect(ids(filtraRigheElenco(righe, FILTRI_VUOTI))).toEqual(["1", "2", "3", "4"]);
  });

  it("combina cliente, offerta e ricerca nella nota ignorando le maiuscole", () => {
    expect(ids(filtraRigheElenco(righe, { ...FILTRI_VUOTI, cliente: "cli-tech", nota: "  RETRO " }))).toEqual(["1", "3"]);
    expect(ids(filtraRigheElenco(righe, { ...FILTRI_VUOTI, offerta: "off-b" }))).toEqual(["3"]);
    expect(ids(filtraRigheElenco(righe, { ...FILTRI_VUOTI, offerta: OFFERTA_DA_DEFINIRE }))).toEqual(["4"]);
  });

  it("le offerte proposte seguono il cliente scelto", () => {
    expect(opzioniOfferte(righe, "cli-data").map((o) => o.valore)).toEqual([OFFERTA_DA_DEFINIRE]);
    expect(opzioniOfferte(righe, "cli-tech").map((o) => o.valore)).toEqual(["off-a", "off-b"]);
  });

  it("ignora cliente o offerta che nel mese non compaiono", () => {
    expect(filtriEffettivi(righe, { cliente: "assente", offerta: "off-a", nota: "x" })).toEqual({
      cliente: "",
      offerta: "off-a",
      nota: "x",
    });
    expect(filtriEffettivi(righe, { cliente: "cli-data", offerta: "off-a", nota: "" }).offerta).toBe("");
  });

  it("somma ore e rimborsi senza errori di arrotondamento", () => {
    expect(totaliElenco(righe)).toEqual({ ore: 11.5, rimborsi: "65.30" });
  });

  it("evidenzia i tratti della nota che corrispondono alla ricerca", () => {
    expect(segmentiNota("Retro e retro", "retro")).toEqual([
      { testo: "Retro", trovato: true },
      { testo: " e ", trovato: false },
      { testo: "retro", trovato: true },
    ]);
    expect(segmentiNota("Planning", "")).toEqual([{ testo: "Planning", trovato: false }]);
  });

  it("i filtri fanno andata e ritorno dall'URL", () => {
    const filtri = { cliente: "cli-tech", offerta: OFFERTA_DA_DEFINIRE, nota: "retro & co" };
    expect(filtriDaQuery(queryFiltri(filtri))).toEqual(filtri);
    expect(urlElenco("2026-11", FILTRI_VUOTI)).toBe("/attivita?mese=2026-11&vista=elenco");
    expect(urlElenco(null, { ...FILTRI_VUOTI, cliente: "c1" })).toBe("/attivita?vista=elenco&cliente=c1");
  });
});

describe("importoFatturaElenco", () => {
  const righeMese = [
    riga({ id: "a", ore: 8, rimborsoTrasfertaImporto: "35.00" }),
    riga({
      id: "b",
      ore: 4,
      cliente: { id: "cli-data", ragioneSociale: "DataFlow" },
      offerta: { id: "off-b", codice: "OFF-B", descrizione: "Formazione PO", attiva: true },
    }),
  ];
  const soloTech = righeMese.filter((r) => r.cliente.id === "cli-tech");

  it("con tariffa giornaliera segue le righe filtrate", () => {
    const contesto = {
      tariffa: { modalita: "GIORNALIERA" as const, importo: "400", validaDalMese: "2026-01" },
      tariffaGiornalieraPerOfferta: {},
    };
    expect(importoFatturaElenco(righeMese, contesto)).toBe("635.00");
    expect(importoFatturaElenco(soloTech, contesto)).toBe("435.00");
  });

  it("con fisso mensile mostra il fisso intero, più i rimborsi delle righe filtrate", () => {
    const contesto = {
      tariffa: { modalita: "FISSO_MENSILE" as const, importo: "3000", validaDalMese: "2026-01" },
      tariffaGiornalieraPerOfferta: {},
    };
    expect(importoFatturaElenco(soloTech, contesto)).toBe("3035.00");
    expect(importoFatturaElenco(righeMese.slice(1), contesto)).toBe("3000.00");
  });

  it("con tariffa percentuale usa la tariffa giornaliera dell'offerta meno la trattenuta", () => {
    const contesto = {
      tariffa: { modalita: "PERCENTUALE" as const, importo: "20", validaDalMese: "2026-01" },
      tariffaGiornalieraPerOfferta: { "off-a": "1000", "off-b": "500" },
    };
    // off-a: 1 gg × 800 + 35 di rimborso
    expect(importoFatturaElenco(soloTech, contesto)).toBe("835.00");
  });

  it("senza tariffa conta solo i rimborsi", () => {
    expect(
      importoFatturaElenco(righeMese, { tariffa: null, tariffaGiornalieraPerOfferta: {} })
    ).toBe("35.00");
  });
});
