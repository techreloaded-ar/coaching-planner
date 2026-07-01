import { describe, it, expect } from "vitest";
import {
  validaKmTrasferta,
  calcolaRimborsoTrasferta,
  type ScaglioneRimborso,
} from "@/domain/consuntivi";

// ── Scaglioni di esempio ────────────────────────────────────────

function scaglioni(importi: (string | number)[]): ScaglioneRimborso[] {
  return [
    { finoAKm: 50, importo: importi[0] },
    { finoAKm: 100, importo: importi[1] },
    { finoAKm: 250, importo: importi[2] },
  ];
}

const scaglioniDefault: ScaglioneRimborso[] = [
  { finoAKm: 50, importo: "15.00" },
  { finoAKm: 100, importo: "28.00" },
  { finoAKm: 250, importo: "85.00" },
];

// ═══════════════════════════════════════════════════════════════
// validaKmTrasferta
// ═══════════════════════════════════════════════════════════════

describe("validaKmTrasferta", () => {
  // ── Casi validi ────────────────────────────────────────────

  it("accetta un intero positivo", () => {
    expect(validaKmTrasferta("150")).toEqual({ valido: true, valore: 150 });
  });

  it("accetta un intero positivo con spazi", () => {
    expect(validaKmTrasferta("  42  ")).toEqual({ valido: true, valore: 42 });
  });

  it("accetta la soglia esatta di uno scaglione", () => {
    expect(validaKmTrasferta("100")).toEqual({ valido: true, valore: 100 });
  });

  it("accetta 1 km", () => {
    expect(validaKmTrasferta("1")).toEqual({ valido: true, valore: 1 });
  });

  // ── Casi non validi ────────────────────────────────────────

  it("rifiuta stringa vuota", () => {
    const result = validaKmTrasferta("");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta solo spazi", () => {
    const result = validaKmTrasferta("   ");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta zero", () => {
    const result = validaKmTrasferta("0");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta valori negativi", () => {
    const result = validaKmTrasferta("-1");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta decimali con virgola", () => {
    const result = validaKmTrasferta("12,5");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta decimali con punto", () => {
    const result = validaKmTrasferta("12.5");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta testo non numerico", () => {
    const result = validaKmTrasferta("abc");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });

  it("rifiuta testo misto a numeri", () => {
    const result = validaKmTrasferta("150km");
    expect(result.valido).toBe(false);
    expect(result.errore).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// calcolaRimborsoTrasferta
// ═══════════════════════════════════════════════════════════════

describe("calcolaRimborsoTrasferta", () => {
  // ── Casi OK ────────────────────────────────────────────────

  it("sceglie lo scaglione fino a 250 km per 150 km", () => {
    const result = calcolaRimborsoTrasferta(150, scaglioniDefault);
    expect(result.stato).toBe("OK");
    expect(result.km).toBe(150);
    expect(result.importo).toBe("85.00");
    expect(result.finoAKm).toBe(250);
    expect(result.labelFascia).toBe("fino a 250 km");
  });

  it("sceglie il primo scaglione per 1 km", () => {
    const result = calcolaRimborsoTrasferta(1, scaglioniDefault);
    expect(result.stato).toBe("OK");
    expect(result.importo).toBe("15.00");
    expect(result.finoAKm).toBe(50);
  });

  it("sceglie lo scaglione esatto quando i km coincidono con la soglia", () => {
    const result = calcolaRimborsoTrasferta(100, scaglioniDefault);
    expect(result.stato).toBe("OK");
    expect(result.importo).toBe("28.00");
    expect(result.finoAKm).toBe(100);
    expect(result.labelFascia).toBe("fino a 100 km");
  });

  it("sceglie la soglia esatta per il massimo scaglione", () => {
    const result = calcolaRimborsoTrasferta(250, scaglioniDefault);
    expect(result.stato).toBe("OK");
    expect(result.importo).toBe("85.00");
    expect(result.finoAKm).toBe(250);
  });

  it("funziona con scaglioni non ordinati", () => {
    const nonOrdinati: ScaglioneRimborso[] = [
      { finoAKm: 250, importo: "85.00" },
      { finoAKm: 50, importo: "15.00" },
      { finoAKm: 100, importo: "28.00" },
    ];
    const result = calcolaRimborsoTrasferta(150, nonOrdinati);
    expect(result.stato).toBe("OK");
    expect(result.finoAKm).toBe(250);
  });

  it("gestisce importo come numero", () => {
    const scaglioniNum: ScaglioneRimborso[] = [
      { finoAKm: 100, importo: 28.5 },
    ];
    const result = calcolaRimborsoTrasferta(80, scaglioniNum);
    expect(result.stato).toBe("OK");
    expect(result.importo).toBe("28.50");
  });

  // ── Casi OLTRE SOGLIA ──────────────────────────────────────

  it("restituisce OLTRE_SOGLIA quando i km superano il massimo", () => {
    const result = calcolaRimborsoTrasferta(300, scaglioniDefault);
    expect(result.stato).toBe("OLTRE_SOGLIA");
    expect(result.messaggio).toBeDefined();
    expect(result.messaggio).toContain("250");
    expect(result.importo).toBeUndefined();
  });

  // ── Casi NESSUNO_SCAGLIONE ─────────────────────────────────

  it("restituisce NESSUNO_SCAGLIONE con array vuoto", () => {
    const result = calcolaRimborsoTrasferta(100, []);
    expect(result.stato).toBe("NESSUNO_SCAGLIONE");
    expect(result.messaggio).toBeDefined();
    expect(result.importo).toBeUndefined();
  });
});
