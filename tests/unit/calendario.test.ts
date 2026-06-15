import { describe, it, expect } from "vitest";
import {
  tokenMeseCorrente,
  parseTokenMese,
  formattaTokenMese,
  etichettaMese,
  mesePrecedente,
  meseSuccessivo,
  costruisciGrigliaMese,
} from "@/domain/calendario";
import type { CellaGiorno } from "@/domain/calendario";

// ── Helpers ─────────────────────────────────────────────────────

/** Verifica che una data abbia anno, mese (1-based) e giorno attesi */
function dataAttesa(d: Date, anno: number, mese: number, giorno: number): boolean {
  return (
    d.getFullYear() === anno &&
    d.getMonth() === mese - 1 &&
    d.getDate() === giorno
  );
}

// ── tokenMeseCorrente ──────────────────────────────────────────

describe("tokenMeseCorrente", () => {
  it("restituisce un token YYYY-MM valido", () => {
    const token = tokenMeseCorrente();
    expect(token).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  it("corrisponde al mese corrente", () => {
    const oggi = new Date();
    const token = tokenMeseCorrente();
    const parsed = parseTokenMese(token);
    expect(parsed).not.toBeNull();
    expect(parsed!.anno).toBe(oggi.getFullYear());
    expect(parsed!.mese).toBe(oggi.getMonth() + 1);
  });
});

// ── parseTokenMese ─────────────────────────────────────────────

describe("parseTokenMese", () => {
  it("parsa un token valido", () => {
    expect(parseTokenMese("2026-06")).toEqual({ anno: 2026, mese: 6 });
    expect(parseTokenMese("2025-01")).toEqual({ anno: 2025, mese: 1 });
    expect(parseTokenMese("2025-12")).toEqual({ anno: 2025, mese: 12 });
  });

  it("restituisce null per formati non validi", () => {
    expect(parseTokenMese("2026-13")).toBeNull(); // mese fuori range
    expect(parseTokenMese("2026-00")).toBeNull();
    expect(parseTokenMese("26-06")).toBeNull();  // anno corto
    expect(parseTokenMese("202606")).toBeNull();  // senza trattino
    expect(parseTokenMese("abcd-ef")).toBeNull();
    expect(parseTokenMese("")).toBeNull();
  });

  it("restituisce null per input invalidi vari", () => {
    expect(parseTokenMese("2026-6")).toBeNull();   // mese senza zero padding
    expect(parseTokenMese("2026-1")).toBeNull();
  });
});

// ── formattaTokenMese ──────────────────────────────────────────

describe("formattaTokenMese", () => {
  it("formatta anno e mese in YYYY-MM", () => {
    expect(formattaTokenMese(2026, 6)).toBe("2026-06");
    expect(formattaTokenMese(2025, 1)).toBe("2025-01");
    expect(formattaTokenMese(2025, 12)).toBe("2025-12");
  });

  it("normalizza mesi oltre il range", () => {
    // mese 13 → anno successivo, mese 1
    expect(formattaTokenMese(2025, 13)).toBe("2026-01");
    // mese 0 → anno precedente, mese 12
    expect(formattaTokenMese(2026, 0)).toBe("2025-12");
    // mese 24 → due anni avanti
    expect(formattaTokenMese(2025, 24)).toBe("2026-12");
  });
});

// ── etichettaMese ──────────────────────────────────────────────

describe("etichettaMese", () => {
  it("restituisce il nome del mese in italiano", () => {
    expect(etichettaMese("2026-01")).toBe("gennaio 2026");
    expect(etichettaMese("2026-06")).toBe("giugno 2026");
    expect(etichettaMese("2026-12")).toBe("dicembre 2026");
  });

  it("gestisce mesi con anno diverso", () => {
    expect(etichettaMese("2025-03")).toBe("marzo 2025");
    expect(etichettaMese("2027-08")).toBe("agosto 2027");
  });

  it("usa il token originale come fallback per input invalido", () => {
    expect(etichettaMese("non-valido")).toBe("non-valido");
  });
});

// ── Navigazione mese ───────────────────────────────────────────

describe("mesePrecedente", () => {
  it("restituisce il mese precedente nello stesso anno", () => {
    expect(mesePrecedente("2026-06")).toBe("2026-05");
    expect(mesePrecedente("2026-12")).toBe("2026-11");
    expect(mesePrecedente("2026-02")).toBe("2026-01");
  });

  it("attraversa il confine d'anno", () => {
    expect(mesePrecedente("2026-01")).toBe("2025-12");
    expect(mesePrecedente("2025-01")).toBe("2024-12");
  });

  it("restituisce il token originale per input invalido", () => {
    expect(mesePrecedente("non-valido")).toBe("non-valido");
  });
});

describe("meseSuccessivo", () => {
  it("restituisce il mese successivo nello stesso anno", () => {
    expect(meseSuccessivo("2026-06")).toBe("2026-07");
    expect(meseSuccessivo("2026-01")).toBe("2026-02");
    expect(meseSuccessivo("2026-11")).toBe("2026-12");
  });

  it("attraversa il confine d'anno", () => {
    expect(meseSuccessivo("2026-12")).toBe("2027-01");
    expect(meseSuccessivo("2025-12")).toBe("2026-01");
  });

  it("restituisce il token originale per input invalido", () => {
    expect(meseSuccessivo("non-valido")).toBe("non-valido");
  });
});

// ── Griglia mese ───────────────────────────────────────────────

describe("costruisciGrigliaMese", () => {
  it("restituisce array vuoto per token invalido", () => {
    expect(costruisciGrigliaMese("non-valido")).toEqual([]);
  });

  it("produce una griglia con un numero di celle multiplo di 7", () => {
    const griglia = costruisciGrigliaMese("2026-06");
    expect(griglia.length % 7).toBe(0);
    expect(griglia.length).toBeGreaterThanOrEqual(28);
    expect(griglia.length).toBeLessThanOrEqual(42); // max 6 settimane
  });

  it("la griglia inizia di lunedì", () => {
    const griglia = costruisciGrigliaMese("2026-06");
    // lunedì = 1 in getDay() ISO, ma noi usiamo js getDay: lunedì=1
    // Il primo giorno della griglia deve essere un lunedì
    expect(griglia[0].data.getDay()).toBe(1); // 1 = lunedì
  });

  it("la griglia finisce di domenica", () => {
    const griglia = costruisciGrigliaMese("2026-06");
    expect(griglia[griglia.length - 1].data.getDay()).toBe(0); // 0 = domenica
  });

  // ── Mesi con diverso numero di giorni ─────────────────────

  it("mese di 31 giorni (gennaio 2026)", () => {
    const griglia = costruisciGrigliaMese("2026-01");
    // Gennaio 2026: 1° = giovedì → 3 giorni precedenti, 31 giorni, 1 successivo = 35
    const giorniMese = griglia.filter((c) => !c.fuoriMese);
    expect(giorniMese.length).toBe(31);
  });

  it("mese di 30 giorni (giugno 2026)", () => {
    const griglia = costruisciGrigliaMese("2026-06");
    // Giugno 2026: 1° = lunedì → 0 giorni precedenti, 30 giorni, 5 successivi = 35
    const giorniMese = griglia.filter((c) => !c.fuoriMese);
    expect(giorniMese.length).toBe(30);
    // Primo giorno è lunedì 1 giugno
    expect(dataAttesa(griglia[0].data, 2026, 6, 1)).toBe(true);
    expect(griglia[0].fuoriMese).toBe(false);
  });

  it("mese di 28 giorni: febbraio 2026 (non bisestile)", () => {
    const griglia = costruisciGrigliaMese("2026-02");
    const giorniMese = griglia.filter((c) => !c.fuoriMese);
    expect(giorniMese.length).toBe(28);
  });

  it("mese di 29 giorni: febbraio 2024 (bisestile)", () => {
    const griglia = costruisciGrigliaMese("2024-02");
    // Febbraio 2024: 1° = giovedì → 3 giorni precedenti, 29 giorni, 3 successivi = 35
    const giorniMese = griglia.filter((c) => !c.fuoriMese);
    expect(giorniMese.length).toBe(29);
  });

  // ── Marcatura giorni fuori mese ────────────────────────────

  it("marca correttamente i giorni fuori mese all'inizio", () => {
    // Giugno 2026 inizia di lunedì → nessun giorno fuori mese all'inizio
    const grigliaGiugno = costruisciGrigliaMese("2026-06");
    expect(grigliaGiugno[0].fuoriMese).toBe(false);

    // Maggio 2026: 1° = venerdì → 4 giorni precedenti (lun-gio di aprile)
    const grigliaMaggio = costruisciGrigliaMese("2026-05");
    expect(grigliaMaggio[0].fuoriMese).toBe(true); // lunedì 27 aprile
    expect(grigliaMaggio[3].fuoriMese).toBe(true); // giovedì 30 aprile
    expect(grigliaMaggio[4].fuoriMese).toBe(false); // venerdì 1 maggio
  });

  it("marca correttamente i giorni fuori mese alla fine", () => {
    // Giugno 2026: 30 giorni, 1° = lunedì → 30 giugno = martedì,
    // giorni successivi: mercoledì 1 luglio → domenica 5 luglio = 5 giorni
    const griglia = costruisciGrigliaMese("2026-06");
    const ultimiGiorni = griglia.slice(-5);
    for (const g of ultimiGiorni) {
      expect(g.fuoriMese).toBe(true);
    }
    // Verifica che i giorni del mese di giugno non siano fuori mese
    const giorniGiugno = griglia.filter(
      (c) => c.data.getMonth() === 5 && c.data.getFullYear() === 2026
    );
    for (const g of giorniGiugno) {
      expect(g.fuoriMese).toBe(false);
    }
  });

  // ── Marcatura weekend ──────────────────────────────────────

  it("marca correttamente i weekend (sabato e domenica)", () => {
    const griglia = costruisciGrigliaMese("2026-06");
    for (const cella of griglia) {
      const jsDay = cella.data.getDay();
      if (jsDay === 0 || jsDay === 6) {
        expect(cella.isWeekend).toBe(true);
      } else {
        expect(cella.isWeekend).toBe(false);
      }
    }
  });

  // ── Contenuto dei giorni ───────────────────────────────────

  it("contiene tutti i giorni del mese in ordine", () => {
    const griglia = costruisciGrigliaMese("2026-03");
    const giorniMarzo = griglia
      .filter((c) => !c.fuoriMese)
      .map((c) => c.data.getDate());

    expect(giorniMarzo[0]).toBe(1);
    expect(giorniMarzo[giorniMarzo.length - 1]).toBe(31);

    // Verifica che siano in ordine crescente
    for (let i = 1; i < giorniMarzo.length; i++) {
      expect(giorniMarzo[i]).toBe(giorniMarzo[i - 1] + 1);
    }
  });

  // ── Proprietà delle celle ──────────────────────────────────

  it("ogni cella ha le proprietà attese", () => {
    const griglia = costruisciGrigliaMese("2026-06");
    for (const cella of griglia) {
      expect(cella.data).toBeInstanceOf(Date);
      expect(typeof cella.fuoriMese).toBe("boolean");
      expect(typeof cella.isWeekend).toBe("boolean");
    }
  });
});
