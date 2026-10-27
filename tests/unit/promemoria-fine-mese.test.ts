import { describe, it, expect } from "vitest";
import {
  contenutoEmailPromemoriaFineMese,
  eUltimoGiornoLavorativoDelMese,
  ultimoGiornoLavorativoDelMese,
} from "@/domain/promemoria-fine-mese";
import { giornoCivile } from "@/domain/calendario-google";

describe("ultimoGiornoLavorativoDelMese", () => {
  it.each([
    ["2026-10", "2026-10-30"], // il 31 è sabato
    ["2026-11", "2026-11-30"],
    ["2027-02", "2027-02-26"], // il 28 è domenica
    ["2026-05", "2026-05-29"], // il 31 è domenica
    ["2026-12", "2026-12-31"],
  ])("%s ⇒ %s", (mese, atteso) => {
    expect(ultimoGiornoLavorativoDelMese(mese)).toBe(atteso);
  });
});

describe("eUltimoGiornoLavorativoDelMese", () => {
  it("è vero per l'ultimo venerdì di ottobre 2026", () => {
    expect(eUltimoGiornoLavorativoDelMese("2026-10-30")).toBe(true);
  });

  it.each(["2026-10-31", "2026-10-29", "2026-02-30"])("è falso per %s", (giorno) => {
    expect(eUltimoGiornoLavorativoDelMese(giorno)).toBe(false);
  });
});

describe("giornoCivile", () => {
  it("usa il fuso di Roma in ora solare (UTC+1)", () => {
    expect(giornoCivile(new Date("2026-10-30T23:30:00Z"))).toBe("2026-10-31");
  });

  it("usa il fuso di Roma in ora legale (UTC+2)", () => {
    expect(giornoCivile(new Date("2026-07-30T22:30:00Z"))).toBe("2026-07-31");
  });

  it("restituisce lo stesso giorno all'orario del cron", () => {
    expect(giornoCivile(new Date("2026-10-30T07:00:00Z"))).toBe("2026-10-30");
  });
});

describe("contenutoEmailPromemoriaFineMese", () => {
  const contenuto = contenutoEmailPromemoriaFineMese({
    nome: "Giulia",
    mese: "2026-10",
    urlApplicazione: "https://cp.example",
  });

  it("cita il mese nell'oggetto", () => {
    expect(contenuto.oggetto).toContain("ottobre 2026");
  });

  it("ricorda compilazione e fattura con il link all'applicazione", () => {
    for (const atteso of [
      "Giulia",
      "coaching planner",
      "fattura",
      "ottobre 2026",
      "https://cp.example/attivita",
    ]) {
      expect(contenuto.testo).toContain(atteso);
    }
  });

  it("non raddoppia lo slash finale dell'URL", () => {
    const { testo } = contenutoEmailPromemoriaFineMese({
      nome: "Giulia",
      mese: "2026-10",
      urlApplicazione: "https://cp.example/",
    });
    expect(testo).toContain("https://cp.example/attivita");
    expect(testo).not.toContain("//attivita");
  });
});
