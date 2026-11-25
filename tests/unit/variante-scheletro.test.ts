import { describe, expect, it } from "vitest";
import { GRUPPI_AMMINISTRAZIONE } from "@/app/navigazione-amministrazione";
import { varianteScheletro } from "@/app/variante-scheletro";

/**
 * Lo scheletro mostrato durante il caricamento riproduce la pagina di arrivo:
 * i `loading.tsx` stanno sui segmenti genitori, quindi la scelta dipende solo
 * dall'indirizzo di destinazione.
 */
describe("varianteScheletro", () => {
  it("area attività: calendario predefinito, elenco con ?vista=elenco, riepilogo e giornata", () => {
    expect(varianteScheletro("/attivita", null)).toBe("calendario");
    expect(varianteScheletro("/attivita", "calendario")).toBe("calendario");
    expect(varianteScheletro("/attivita", "elenco")).toBe("elenco-attivita");
    expect(varianteScheletro("/attivita/riepilogo", null)).toBe("riepilogo");
    expect(varianteScheletro("/attivita/2026-11-25", null)).toBe("giornata");
  });

  it("una giornata non valida, che riporta al calendario, mostra il calendario", () => {
    expect(varianteScheletro("/attivita/non-una-data", null)).toBe("calendario");
  });

  it("ogni voce di amministrazione ha uno scheletro di elenco, report o importazione", () => {
    const attese: Record<string, string> = {
      "/anagrafiche/clienti": "elenco",
      "/offerte": "elenco",
      "/anagrafiche/persone": "elenco",
      "/anagrafiche/voci-rimborso": "elenco",
      "/importazione": "importazione",
      "/report/fatturazione-clienti": "report",
      "/report/fatturazione-collaboratori": "report",
      "/report/marginalita": "report",
    };
    const voci = GRUPPI_AMMINISTRAZIONE.flatMap((gruppo) => gruppo.voci.map((voce) => voce.href));

    expect([...voci].sort()).toEqual(Object.keys(attese).sort());
    for (const href of voci) {
      expect(varianteScheletro(href, null), href).toBe(attese[href]);
    }
  });

  it("gli indirizzi che reindirizzano a un elenco e le righe sospese mostrano un elenco", () => {
    for (const href of [
      "/anagrafiche",
      "/anagrafiche/utenti",
      "/anagrafiche/collaboratori",
      "/report/avanzamento-offerte",
      "/righe-sospese",
    ]) {
      expect(varianteScheletro(href, null), href).toBe("elenco");
    }
  });

  it("schede e moduli sotto una sezione mostrano lo scheletro di dettaglio", () => {
    for (const href of [
      "/anagrafiche/clienti/c1",
      "/anagrafiche/clienti/nuovo",
      "/anagrafiche/persone/u1",
      "/offerte/nuova",
      "/offerte/o1/collaboratori",
      "/report/marginalita/c1",
    ]) {
      expect(varianteScheletro(href, null), href).toBe("dettaglio");
    }
  });

  it("ignora la barra finale", () => {
    expect(varianteScheletro("/offerte/", null)).toBe("elenco");
    expect(varianteScheletro("/attivita/", null)).toBe("calendario");
  });
});
