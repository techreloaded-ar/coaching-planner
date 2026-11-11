import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  gruppiAmministrazioneVisibili,
  type GruppoAmministrazione,
} from "@/app/navigazione-amministrazione";
import {
  PERMESSI,
  haAccessoBackOffice,
  permessiDelRuolo,
  type Permesso,
} from "@/domain/permessi";

/**
 * US-110 — Le voci di amministrazione della sidebar seguono i permessi: ogni
 * voce compare solo con il permesso della pagina di destinazione e un gruppo
 * senza voci non mostra il proprio titolo.
 */

const etichette = (gruppi: readonly GruppoAmministrazione[]) =>
  gruppi.flatMap((gruppo) => gruppo.voci.map((voce) => voce.etichetta));

const senzaIcone = (gruppi: readonly GruppoAmministrazione[]) =>
  gruppi.map((gruppo) => ({
    titolo: gruppo.titolo,
    voci: gruppo.voci.map(({ href, etichetta }) => ({ href, etichetta })),
  }));

describe("gruppiAmministrazioneVisibili", () => {
  it("con il solo report di fatturazione clienti mostra soltanto quella voce, nella sola Reportistica", () => {
    const gruppi = gruppiAmministrazioneVisibili(["CONSULTARE_REPORT_FATTURAZIONE_CLIENTI"]);

    expect(senzaIcone(gruppi)).toEqual([
      {
        titolo: "Reportistica",
        voci: [{ href: "/report/fatturazione-clienti", etichetta: "Fatturazione clienti" }],
      },
    ]);
    expect(gruppi.map((gruppo) => gruppo.titolo)).not.toContain("Anagrafica");
  });

  it("all'amministratore mostra gli 8 link di amministrazione nell'ordine attuale", () => {
    const gruppi = gruppiAmministrazioneVisibili(permessiDelRuolo("AMMINISTRATORE"));

    expect(gruppi.map((gruppo) => gruppo.titolo)).toEqual(["Anagrafica", "Reportistica"]);
    expect(etichette(gruppi)).toEqual([
      "Clienti",
      "Offerte",
      "Persone",
      "Voci di rimborso",
      "Importazione",
      "Fatturazione clienti",
      "Fatturazione collaboratori",
      "Marginalità",
    ]);
  });

  it("al collaboratore e al solo permesso dei fogli altrui non mostra alcun gruppo", () => {
    expect(gruppiAmministrazioneVisibili(permessiDelRuolo("COLLABORATORE"))).toEqual([]);
    expect(gruppiAmministrazioneVisibili(["CONSULTARE_FOGLI_ATTIVITA_ALTRUI"])).toEqual([]);
  });

  it.each<[string, Permesso]>([
    ["/anagrafiche/clienti", "GESTIRE_CLIENTI"],
    ["/offerte", "GESTIRE_OFFERTE"],
    ["/anagrafiche/persone", "GESTIRE_UTENTI"],
    ["/anagrafiche/voci-rimborso", "GESTIRE_VOCI_RIMBORSO"],
    ["/importazione", "GESTIRE_IMPORTAZIONE"],
    ["/report/fatturazione-clienti", "CONSULTARE_REPORT_FATTURAZIONE_CLIENTI"],
    ["/report/fatturazione-collaboratori", "CONSULTARE_REPORT_FATTURAZIONE_COLLABORATORI"],
    ["/report/marginalita", "CONSULTARE_REPORT_MARGINALITA"],
  ])("la voce %s richiede %s", (href, permesso) => {
    const hrefVisibili = (permessi: readonly Permesso[]) =>
      gruppiAmministrazioneVisibili(permessi).flatMap((gruppo) =>
        gruppo.voci.map((voce) => voce.href)
      );

    expect(hrefVisibili([permesso])).toEqual([href]);
    expect(hrefVisibili(PERMESSI.filter((p) => p !== permesso))).not.toContain(href);
  });
});

describe("etichetta «Amministrazione»", () => {
  it("compare con il solo report di fatturazione clienti, non per il collaboratore", () => {
    expect(haAccessoBackOffice(["CONSULTARE_REPORT_FATTURAZIONE_CLIENTI"])).toBe(true);
    expect(haAccessoBackOffice(permessiDelRuolo("COLLABORATORE"))).toBe(false);
  });

  it("la sidebar la condiziona all'accesso al back office e rende solo i gruppi visibili", () => {
    const sidebar = fs.readFileSync(
      path.join(process.cwd(), "src/app/sidebar-applicazione.tsx"),
      "utf8"
    );

    expect(sidebar).toContain("haAccessoBackOffice(permessi) &&");
    expect(sidebar).toContain("gruppiAmministrazioneVisibili(permessi)");
    expect(sidebar).not.toContain("GRUPPI_AMMINISTRAZIONE.map");
    expect(sidebar).not.toContain("amministratore &&");
  });
});
