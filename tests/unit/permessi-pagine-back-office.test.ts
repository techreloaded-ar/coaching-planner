import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import type { Permesso } from "@/domain/permessi";

/**
 * US-109 — Guardrail statico: il layout del back office richiede solo un
 * qualsiasi permesso di back office (US-110), quindi ogni pagina deve dichiarare
 * da sé il permesso della propria area. Una pagina nuova senza voce nella mappa fa fallire il test.
 */

const RADICE_BACK_OFFICE = path.join(process.cwd(), "src/app/(back-office)");

/** Ordinata dal prefisso più specifico: vince la prima corrispondenza. */
const PERMESSO_PER_PREFISSO: ReadonlyArray<readonly [string, Permesso]> = [
  ["anagrafiche/clienti/[id]/offerte/", "GESTIRE_OFFERTE"],
  ["anagrafiche/clienti/", "GESTIRE_CLIENTI"],
  ["anagrafiche/collaboratori/", "GESTIRE_COLLABORATORI"],
  ["anagrafiche/persone/", "GESTIRE_UTENTI"],
  ["anagrafiche/utenti/", "GESTIRE_UTENTI"],
  ["anagrafiche/voci-rimborso/", "GESTIRE_VOCI_RIMBORSO"],
  ["anagrafiche/page.tsx", "GESTIRE_CLIENTI"],
  ["offerte/[offertaId]/collaboratori/", "GESTIRE_ABILITAZIONI"],
  ["offerte/", "GESTIRE_OFFERTE"],
  ["report/avanzamento-offerte/", "GESTIRE_OFFERTE"],
  ["report/fatturazione-clienti/", "CONSULTARE_REPORT_FATTURAZIONE_CLIENTI"],
  [
    "report/fatturazione-collaboratori/",
    "CONSULTARE_REPORT_FATTURAZIONE_COLLABORATORI",
  ],
  ["report/marginalita/", "CONSULTARE_REPORT_MARGINALITA"],
  ["righe-sospese/", "GESTIRE_RIGHE_SOSPESE"],
  ["importazione/", "GESTIRE_IMPORTAZIONE"],
];

const pagine = fs
  .readdirSync(RADICE_BACK_OFFICE, { recursive: true, encoding: "utf8" })
  .map((percorso) => percorso.split(path.sep).join("/"))
  .filter((percorso) => percorso.endsWith("page.tsx"))
  .sort();

function leggi(percorsoRelativo: string): string {
  return fs.readFileSync(path.join(RADICE_BACK_OFFICE, percorsoRelativo), "utf8");
}

describe("permessi delle pagine del back office", () => {
  it("il layout richiede l'accesso al back office, senza guardie per ruolo", () => {
    const layout = leggi("layout.tsx");

    expect(layout).toContain("richiediAccessoBackOffice()");
    expect(layout).not.toContain("verificaSessione()");
    expect(layout).not.toContain("richiediRuolo");
  });

  it("trova tutte le pagine del back office", () => {
    expect(pagine.length).toBeGreaterThanOrEqual(31);
  });

  it.each(pagine)("%s richiede il permesso della propria area", (pagina) => {
    const voce = PERMESSO_PER_PREFISSO.find(([prefisso]) =>
      pagina.startsWith(prefisso),
    );
    if (!voce) {
      throw new Error(`pagina senza area: ${pagina}`);
    }
    const [, permessoAtteso] = voce;

    expect(leggi(pagina)).toContain(`richiediPermesso("${permessoAtteso}")`);
  });
});
