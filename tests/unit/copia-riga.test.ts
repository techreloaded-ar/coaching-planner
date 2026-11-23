import { describe, expect, it } from "vitest";
import type { RigaAttivitaClient } from "@/lib/attivita-contract";
import {
  alternaGiorno,
  descriviGiorni,
  etichettaGiorni,
  mesiDeiGiorni,
  motivoNonCopiabile,
  raggruppaPerMese,
} from "@/lib/copia-riga";

function riga(sovrascritture: Partial<RigaAttivitaClient> = {}): RigaAttivitaClient {
  return {
    id: "riga-1",
    data: "2026-11-11",
    ore: 6,
    nota: "Retrospettiva",
    categoria: "FATTURABILE",
    rimborsoTrasfertaEtichetta: null,
    rimborsoTrasfertaImporto: null,
    offerta: { id: "offerta-1", codice: "NWL-2026-03", descrizione: "Coaching", attiva: true },
    offertaNonAbilitata: false,
    cliente: { id: "cliente-1", ragioneSociale: "Nordwind Logistica" },
    ...sovrascritture,
  };
}

describe("motivoNonCopiabile", () => {
  it("considera copiabile una riga su offerta attiva e abilitata", () => {
    expect(motivoNonCopiabile(riga())).toBeNull();
  });

  it("spiega perché una riga non è copiabile", () => {
    expect(motivoNonCopiabile(riga({ offerta: null }))).toBe(
      "Offerta da definire: assegnala prima di copiare"
    );
    expect(
      motivoNonCopiabile(
        riga({ offerta: { id: "o", codice: "X", descrizione: "", attiva: false } })
      )
    ).toBe("Offerta non più attiva");
    expect(motivoNonCopiabile(riga({ offertaNonAbilitata: true }))).toBe(
      "Offerta non più abilitata"
    );
  });
});

describe("alternaGiorno", () => {
  const ORIGINE = "2026-11-11";

  it("un primo clic aggiunge il giorno, in ordine crescente", () => {
    expect(alternaGiorno(["2026-11-19"], "2026-11-04", ORIGINE)).toEqual({
      tipo: "aggiunto",
      giorni: ["2026-11-04", "2026-11-19"],
    });
  });

  it("un secondo clic lo toglie", () => {
    expect(alternaGiorno(["2026-11-04", "2026-11-19"], "2026-11-04", ORIGINE)).toEqual({
      tipo: "tolto",
      giorni: ["2026-11-19"],
    });
  });

  it("il giorno di origine non entra e lascia la selezione invariata", () => {
    expect(alternaGiorno(["2026-11-04"], ORIGINE, ORIGINE)).toEqual({
      tipo: "origine",
      giorni: ["2026-11-04"],
    });
  });
});

describe("raggruppamento delle destinazioni", () => {
  const giorni = ["2026-12-03", "2026-11-19", "2026-11-04", "2026-11-12"];

  it("raggruppa per mese in ordine crescente", () => {
    expect(raggruppaPerMese(giorni)).toEqual([
      { token: "2026-11", giorni: ["2026-11-04", "2026-11-12", "2026-11-19"] },
      { token: "2026-12", giorni: ["2026-12-03"] },
    ]);
    expect(mesiDeiGiorni(giorni)).toEqual(["2026-11", "2026-12"]);
  });

  it("descrive i giorni incollati per mese", () => {
    expect(descriviGiorni(giorni)).toBe("4, 12 e 19 novembre 2026 · 3 dicembre 2026");
    expect(descriviGiorni(["2026-11-04"])).toBe("4 novembre 2026");
  });

  it("conta i giorni al singolare e al plurale", () => {
    expect(etichettaGiorni(1)).toBe("1 giorno");
    expect(etichettaGiorni(3)).toBe("3 giorni");
  });
});
