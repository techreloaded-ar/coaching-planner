import { describe, expect, it } from "vitest";
import { preparaCoach } from "@/lib/importer-legacy/coach";
import { configurazioneImporter } from "@/lib/importer-legacy/config";
import { periodiDiValidita, tariffaValidaNelMese } from "@/domain/tariffe";
import type { Archivio, Celle } from "@/lib/importer-legacy/types";

const cfg = configurazioneImporter({ IMPORTER_GOOGLE_SPREADSHEET_ID: "test" });
const archive = (): Archivio => ({ clienti: [], offerte: [], utenti: [], giornate: [], rimborsi: [], registro: [] });
const row = (extra: Celle = {}): Celle => ({ id: "C1", nome: "Ada", cognome: "Rossi", email: "ada@example.com",
  dal_mese: "2018-01", al_mese: "2018-12", tipologia: "PERCENTUALE", importo: "30", ...extra });

describe("COACH con storico e cessazioni", () => {
  it("raggruppa e ordina i periodi, conserva la trattenuta e riconosce interruzione e rientro", () => {
    const input = [row({ dal_mese: "2026-01", al_mese: "", tipologia: "GIORNALIERA", importo: "550" }), row()];
    const [coach] = preparaCoach(input, archive(), cfg, [], "2025-11");
    expect(coach.attivo).toBe(false);
    expect(coach.tariffe).toEqual([
      { validaDalMese: "2018-01", validaAlMese: "2018-12", modalita: "PERCENTUALE", importo: "30.00" },
      { validaDalMese: "2026-01", validaAlMese: null, modalita: "GIORNALIERA", importo: "550.00" },
    ]);
    expect(preparaCoach(input, archive(), cfg, [], "2026-11")[0].attivo).toBe(true);
    expect(tariffaValidaNelMese(coach.tariffe!, "2018-12")?.importo).toBe("30.00");
    expect(tariffaValidaNelMese(coach.tariffe!, "2019-01")).toBeNull();
  });
  it.each([
    [row(), row()],
    [row({ al_mese: "" }), row({ dal_mese: "2019-01" })],
    [row(), row({ dal_mese: "2018-12", al_mese: "2019-12" })],
    [row({ al_mese: "2017-12" })],
    [row({ dal_mese: "2018-13" })],
    [row({ importo: "100" })],
    [row({ dal_mese: "" })],
    [row(), row({ nome: "Altra" })],
    [row(), row({ id: "C2" })],
    [row(), row({ email: "altra@example.com" })],
  ])("blocca storici incoerenti prima di scrivere", (...input) => {
    expect(() => preparaCoach(input, archive(), cfg, [], "2026-11")).toThrow();
  });
  it("non fa riemergere una vecchia tariffa aperta quando l'ultima scade", () => {
    const tariffe = [{ validaDalMese: "2018-01" }, { validaDalMese: "2020-01", validaAlMese: "2020-03" }];
    expect(tariffaValidaNelMese(tariffe, "2020-04")).toBeNull();
    expect(periodiDiValidita(tariffe).get(tariffe[1])).toContain("mar 2020");
  });
  it("non propone aggiornamenti identici ma riconosce modifiche allo storico e allo stato", () => {
    const a = archive(), [coach] = preparaCoach([row()], a, cfg, [], "2026-11");
    a.utenti.push({ id: "user", email: coach.email, ruolo: "COLLABORATORE", attivo: false,
      collaboratore: { id: "coach", attivo: false, tariffe: coach.tariffe } });
    expect(preparaCoach([row()], a, cfg, [], "2026-11")).toEqual([]);
    expect(preparaCoach([row({ importo: "20" })], a, cfg, [], "2026-11")[0]).toMatchObject({ id: "coach", profiloEsistente: true, attivo: false });
  });
});
