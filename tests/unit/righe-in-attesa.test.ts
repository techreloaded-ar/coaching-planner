import { describe, expect, it } from "vitest";
import type { RigaAttivitaClient } from "@/lib/attivita-contract";
import { righeConOperazioniInAttesa } from "@/lib/righe-in-attesa";

function riga(id: string, ore: number): RigaAttivitaClient {
  return {
    id,
    data: "2026-11-24",
    ore,
    nota: null,
    categoria: "FATTURABILE",
    rimborsoTrasfertaEtichetta: null,
    rimborsoTrasfertaImporto: null,
    offerta: { id: "o1", codice: "OFF-1", descrizione: "Percorso", attiva: true },
    offertaNonAbilitata: false,
    cliente: { id: "c1", ragioneSociale: "Cliente" },
  };
}

describe("righe del giorno con le operazioni in attesa", () => {
  it("senza operazioni mostra le righe del server, nessuna in attesa", () => {
    const mostrate = righeConOperazioniInAttesa([riga("a", 2)], []);
    expect(mostrate).toEqual([{ ...riga("a", 2), inAttesa: false }]);
  });

  it("una riga nuova compare subito in coda, in attesa", () => {
    const mostrate = righeConOperazioniInAttesa(
      [riga("a", 2)],
      [{ tipo: "nuova", chiave: "k1", riga: riga("provvisoria-1", 3) }],
    );
    expect(mostrate.map((r) => [r.id, r.inAttesa])).toEqual([
      ["a", false],
      ["provvisoria-1", true],
    ]);
  });

  it("una modifica mostra già i nuovi valori al posto della riga", () => {
    const mostrate = righeConOperazioniInAttesa(
      [riga("a", 2), riga("b", 1)],
      [{ tipo: "modifica", chiave: "k1", riga: riga("a", 5) }],
    );
    expect(mostrate.map((r) => [r.id, r.ore, r.inAttesa])).toEqual([
      ["a", 5, true],
      ["b", 1, false],
    ]);
  });

  it("un'eliminazione toglie subito la riga", () => {
    const mostrate = righeConOperazioniInAttesa(
      [riga("a", 2), riga("b", 1)],
      [{ tipo: "eliminazione", chiave: "k1", rigaId: "a" }],
    );
    expect(mostrate.map((r) => r.id)).toEqual(["b"]);
  });

  it("applica più operazioni nell'ordine di invio", () => {
    const mostrate = righeConOperazioniInAttesa(
      [riga("a", 2)],
      [
        { tipo: "nuova", chiave: "k1", riga: riga("provvisoria-1", 3) },
        { tipo: "eliminazione", chiave: "k2", rigaId: "a" },
        { tipo: "nuova", chiave: "k3", riga: riga("provvisoria-2", 4) },
      ],
    );
    expect(mostrate.map((r) => r.id)).toEqual(["provvisoria-1", "provvisoria-2"]);
  });
});
