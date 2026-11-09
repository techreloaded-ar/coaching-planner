import { describe, expect, it } from "vitest";
import { analizza, impronta, normalizzaRiga } from "@/lib/importer-legacy/analisi";
import { operazioni, parseDecisioni } from "@/lib/importer-legacy/decisioni";
import { configurazioneImporter } from "@/lib/importer-legacy/config";
import type { Archivio, Celle, Schede } from "@/lib/importer-legacy/types";
import { appendiNote, daImportareSenzaCodice } from "@/lib/importer-legacy/senza-codice";

const cfg = configurazioneImporter({ IMPORTER_GOOGLE_SPREADSHEET_ID: "test", IMPORTER_ENABLED: "true" });
function archivio(): Archivio {
  return { clienti: [{ id: "cliente", ragioneSociale: "Cliente Test" }], utenti: [{ id: "utente", email: "coach@example.com", collaboratore: { id: "coach" } }],
    offerte: [{ id: "offerta", codice: "OFF-2026", clienteId: "cliente" }], giornate: [], rimborsi: [], registro: [] };
}
function riga(extra: Celle = {}): Celle { return { coach: "C1", data: "2026-11-05", cliente: "Cliente Test", "codice offerta": "OFF-2026", ore: "8", "tipologia fatturazione": "FATTURABILE", ...extra }; }
function schede(rows: Celle[]): Schede { return { clienti: [], offerte: [], coach: [{ id: "C1", email: "coach@example.com" }], giornate: rows }; }
function esistente(a: Archivio, g = riga()) {
  const plan = analizza(schede([g]), a, cfg);
  return { ...plan.righe[0].proposta!, id: "giornata", versione: "2026-11-05T00:00:00.000Z" };
}

describe("offerta SENZA CODICE per cliente", () => {
  it("preserva le note esistenti alla lettera e non usa il ripiego per deduzioni fuzzy", () => {
    expect(appendiNote("Nota\nNota\n", "Nuova nota")).toBe("Nota\nNota\nNuova nota");
    const a = archivio(); a.offerte.push({ id: "ripiego", clienteId: "cliente", codice: "SENZA CODICE" });
    const r = analizza(schede([riga({ "codice offerta": "SENZA CODICE DA CENSIRE" })]), a, cfg).righe[0];
    expect(r.senzaCodice?.motivo).toBe("SCONOSCIUTA");
  });
  it("mantiene la scelta ambigua con ID stabile anche quando cambia la data", () => {
    const a = archivio();
    a.offerte.push(...["CORSO_APM_1", "CORSO_APM_2"].map((codice, i) => ({ codice, id: `o${i}`, clienteId: "cliente" })), { id: "ripiego", clienteId: "cliente", codice: "SENZA CODICE" });
    const raw = riga({ id: "stabile", "codice offerta": "CORSO APM" });
    const r = analizza(schede([raw]), a, cfg).righe[0];
    const saved = { ...r.proposta!, id: "giornata", versione: "2026-11-05T00:00:00Z" };
    a.giornate.push(saved);
    a.registro.push({ chiave: r.chiave, dati: raw, rigaAttivitaId: saved.id, impronta: impronta(saved), ignorata: false });
    const next = analizza(schede([{ ...raw, data: "2026-11-06" }]), a, cfg).righe[0];
    expect(next.stato).toBe("AGGIORNARE"); expect(next.collegataId).toBe(saved.id);
  });
  it("non deduce l'unica offerta con codice vuoto e riusa un solo ripiego per cliente", () => {
    const p = analizza(schede([riga({ "codice offerta": "", note: "Nota originale" }), riga({ "codice offerta": "inesistente" })]), archivio(), cfg);
    expect(p.anagrafiche.offerte).toHaveLength(1);
    expect(p.anagrafiche.offerte[0]).toMatchObject({ codice: "SENZA CODICE", tariffaGiornaliera: "0.00", giorniPrevisti: 0, ripiego: true });
    expect(p.righe.map((r) => r.proposta?.offertaId)).toEqual([p.anagrafiche.offerte[0].id, p.anagrafiche.offerte[0].id]);
    expect(p.righe.map((r) => r.senzaCodice?.motivo)).toEqual(["MANCANTE", "SCONOSCIUTA"]);
    expect(p.righe[0].proposta?.nota).toContain("Nota originale\n");
    expect(p.righe[1].proposta?.nota).toContain("inesistente");
    expect(p.righe.every((r) => daImportareSenzaCodice(r))).toBe(true);
  });
  it("riusa l'offerta SENZA CODICE esistente dello stesso cliente", () => {
    const a = archivio(); a.offerte.push({ id: "ripiego", clienteId: "cliente", codice: "SENZA CODICE" });
    const p = analizza(schede([riga({ "codice offerta": "?" })]), a, cfg);
    expect(p.anagrafiche.offerte).toHaveLength(0);
    expect(p.righe[0].proposta?.offertaId).toBe("ripiego");
  });
  it("lascia l'ambiguità da verificare e ammette solo la scelta esplicita", () => {
    const a = archivio(); a.offerte = ["CORSO_APM_1", "CORSO_APM_2"].map((codice, i) => ({ codice, id: `o${i}`, clienteId: "cliente" }));
    const p = analizza(schede([riga({ "codice offerta": "CORSO APM" })]), a, cfg);
    const r = p.righe[0];
    expect(r.stato).toBe("VERIFICARE"); expect(r.senzaCodice?.motivo).toBe("AMBIGUA");
    expect(operazioni(p, [])).toHaveLength(0); expect(daImportareSenzaCodice(r)).toBe(false);
    expect(daImportareSenzaCodice(r, "SENZA_CODICE")).toBe(true);
    expect(operazioni(p, [{ chiave: r.chiave, azione: "SENZA_CODICE" }])).toMatchObject([{ azione: "NUOVA" }]);
    expect(() => operazioni(p, [{ chiave: r.chiave, azione: "NUOVA" }])).toThrow("esplicitamente");
  });
  it("continua a scartare date invalide e codici intestati ad altri clienti", () => {
    const a = archivio(); a.offerte.push({ id: "altrui", clienteId: "altro", codice: "ALTRUI" });
    const p = analizza(schede([riga({ "codice offerta": "?", data: "errata" }), riga({ "codice offerta": "ALTRUI" })]), a, cfg);
    expect(p.righe.every((r) => r.stato === "NON_IMPORTABILE")).toBe(true);
    expect(p.anagrafiche.offerte).toHaveLength(0);
  });
  it("riconosce una giornata della fonte già registrata anche se cambia l'offerta e conserva le note", () => {
    const a = archivio();
    const raw = riga({ "codice offerta": "", note: "Nota fonte" });
    const originale = { ...esistente(a), nota: "Nota manuale", offertaId: "offerta" };
    a.giornate.push(originale);
    a.registro.push({ chiave: "vecchia-chiave", dati: raw, rigaAttivitaId: originale.id, impronta: impronta(originale), ignorata: false });
    const p = analizza(schede([raw]), a, cfg);
    expect(p.righe[0].stato).toBe("AGGIORNARE"); expect(p.righe[0].collegataId).toBe(originale.id);
    expect(p.righe[0].proposta?.nota).toContain("Nota manuale\nNota fonte\n");
    expect(appendiNote(p.righe[0].proposta?.nota, p.righe[0].proposta?.nota)).toBe(p.righe[0].proposta?.nota);
  });
});

describe("importer incrementale senza ID nel foglio", () => {
  it("prepara solo le nuove; non cambia l'archivio e non richiede AI", () => {
    const a = archivio();
    const before = structuredClone(a);
    const p = analizza(schede([riga()]), a, cfg);
    expect(p.righe[0].stato).toBe("PRONTA");
    expect(a).toEqual(before);
    expect(p.ai).toContain("non configurata");
  });
  it("prepara il profilo mancante dell’utente esistente prima delle giornate", () => {
    const a = archivio();
    a.utenti[0].collaboratore = null;
    const prima = structuredClone(a);
    const s = schede([riga()]);
    s.coach = [{ id: "C1", email: "coach@example.com", nome: "Coach", cognome: "Test", tipologia: "GIORNATA", importo: "400" }];
    const p = analizza(s, a, cfg);
    expect(p.anagrafiche.coach).toHaveLength(1);
    expect(p.anagrafiche.coach[0]).toMatchObject({ userId: "utente", utenteEsistente: true, importo: "400.00" });
    expect(p.righe[0].stato).toBe("PRONTA");
    expect(p.righe[0].proposta?.collaboratoreId).toBe(p.anagrafiche.coach[0].id);
    expect(a).toEqual(prima);
  });
  it("riutilizza il profilo esistente senza modificarlo o duplicarlo", () => {
    const p = analizza(schede([riga()]), archivio(), cfg);
    expect(p.anagrafiche.coach).toHaveLength(0);
    expect(p.righe[0].proposta?.collaboratoreId).toBe("coach");
  });
  it("se i dati del profilo mancante non sono validi segnala il problema senza inventarli", () => {
    const a = archivio(); a.utenti[0].collaboratore = null;
    const p = analizza(schede([riga()]), a, cfg);
    expect(p.anagrafiche.coach).toHaveLength(0);
    expect(p.anagrafiche.avvisi).toHaveLength(1);
    expect(p.righe[0].stato).toBe("NON_IMPORTABILE");
  });
  it("normalizza spazi, date seriali e numeri senza usare il numero di riga", () => {
    expect(normalizzaRiga(riga({ data: "05/11/2026", ore: "8,00", cliente: "  cliente  test " }))).toEqual(normalizzaRiga(riga()));
    const a = archivio();
    a.giornate.push(esistente(a));
    const p = analizza(schede([riga({ data: "05/11/2026", ore: "8,00" })]), a, cfg);
    expect(p.righe[0].stato).toBe("PRESENTE");
  });
  it("riconosce la molteplicità: una riga esistente non copre due righe identiche", () => {
    const a = archivio(); a.giornate.push(esistente(a));
    const p = analizza(schede([riga(), riga()]), a, cfg);
    expect(p.righe.map((r) => r.stato)).toEqual(["PRESENTE", "PRONTA"]);
    expect(p.righe[0].chiave).not.toBe(p.righe[1].chiave);
  });
  it("accetta entrambe le nuove righe identiche come lo script", () => {
    expect(analizza(schede([riga(), riga()]), archivio(), cfg).righe.map((r) => r.stato)).toEqual(["PRONTA", "PRONTA"]);
  });
  it("una variazione delle ore aggiorna automaticamente la corrispondenza unica", () => {
    const a = archivio(); a.giornate.push(esistente(a));
    const p = analizza(schede([riga({ ore: "4" })]), a, cfg);
    expect(p.righe[0].stato).toBe("AGGIORNARE");
    expect(p.righe[0].candidati[0].ore).toBe("8.00");
    expect(operazioni(p, [])).toMatchObject([{ azione: "AGGIORNA", destinazione: "giornata" }]);
    expect(operazioni(p, [{ chiave: p.righe[0].chiave, azione: "AGGIORNA", destinazione: "giornata" }])[0].azione).toBe("AGGIORNA");
  });
  it("considera anche le giornate storiche e respinge dati non validi", () => {
    const p = analizza(schede([riga({ data: "2025-01-01" }), riga({ ore: "non numerico" }), riga({ "spese coach": "abc" })]), archivio(), cfg);
    expect(p.righe.map((r) => r.stato)).toEqual(["PRONTA", "NON_IMPORTABILE", "PRONTA"]);
  });
  it("aggiorna le righe riconosciute e conserva quelle assenti dal foglio", () => {
    const a = archivio(); const g = esistente(a); a.giornate.push(g);
    const row = analizza(schede([riga()]), a, cfg).righe[0];
    a.registro.push({ chiave: row.chiave, dati: row.grezzi, rigaAttivitaId: g.id, impronta: impronta(g), ignorata: false });
    expect(analizza(schede([riga()]), a, cfg).righe[0].stato).toBe("PRESENTE");
    g.ore = "6.00";
    expect(analizza(schede([riga()]), a, cfg).righe[0].stato).toBe("AGGIORNARE");
    const senzaRiga = analizza(schede([]), a, cfg);
    expect(senzaRiga.righe.map((r) => r.stato)).toEqual(["SCOMPARSA"]);
    expect(operazioni(senzaRiga, [])).toHaveLength(0);
    expect(a.giornate).toHaveLength(1);
  });
  it("non considera scomparse le righe manuali, i dati invalidi ancora presenti o gli aggiornamenti ambigui", () => {
    const a = archivio(); const g = esistente(a); a.giornate.push(g);
    expect(analizza(schede([]), a, cfg).righe).toHaveLength(0);
    const r = analizza(schede([riga()]), a, cfg).righe[0];
    a.registro.push({ chiave: r.chiave, dati: r.grezzi, rigaAttivitaId: g.id, impronta: impronta(g), ignorata: false });
    expect(analizza(schede([riga({ ore: "non numeriche" })]), a, cfg).righe.map((r) => r.stato)).toEqual(["NON_IMPORTABILE"]);
    const ambiguo = analizza(schede([riga({ ore: "4" }), riga({ ore: "3" })]), a, cfg);
    expect(ambiguo.righe.some((r) => r.stato === "SCOMPARSA")).toBe(false);
  });
  it("rileva una sola occorrenza rimossa e richiede una scelta di eliminazione valida", () => {
    const a = archivio();
    a.giornate.push(esistente(a), { ...esistente(a), id: "seconda" });
    const prima = analizza(schede([riga(), riga()]), a, cfg);
    a.registro = prima.righe.map((r) => ({ chiave: r.chiave, dati: r.grezzi, rigaAttivitaId: r.collegataId!, impronta: impronta(r.proposta!), ignorata: false }));
    const dopo = analizza(schede([riga()]), a, cfg);
    expect(dopo.righe.map((r) => r.stato)).toEqual(["PRESENTE", "SCOMPARSA"]);
    const missing = dopo.righe[1];
    const ops = operazioni(dopo, [{ chiave: missing.chiave, azione: "ELIMINA" }]);
    expect(ops.find((op) => op.azione === "ELIMINA")?.destinazione).toBe(missing.collegataId);
    expect(() => operazioni(dopo, [{ chiave: dopo.righe[0].chiave, azione: "ELIMINA" }])).toThrow("soltanto");
    expect(() => operazioni(dopo, [{ chiave: missing.chiave, azione: "NUOVA" }])).toThrow("soltanto");
    const f = new FormData(); f.set(`scelta:${missing.chiave}`, "ELIMINA");
    expect(parseDecisioni(f)).toEqual([{ chiave: missing.chiave, azione: "ELIMINA" }]);
  });
  it("rivaluta gli scarti e le righe ignorate ad ogni lettura", () => {
    const a = archivio(); const row = analizza(schede([riga()]), a, cfg).righe[0];
    a.registro.push({ chiave: row.chiave, dati: row.grezzi, rigaAttivitaId: null, impronta: null, ignorata: true });
    expect(analizza(schede([riga()]), a, cfg).righe[0].stato).toBe("PRONTA");
  });
  it("accetta le offerte dedotte come lo script e le annota", () => {
    const r = analizza(schede([riga({ "codice offerta": "OFF 2026" })]), archivio(), cfg).righe[0];
    expect(r.stato).toBe("PRONTA");
    expect(r.proposta?.nota).toContain("Offerta dedotta");
  });
  it("rifiuta aggiornamenti arbitrari, conflitti e import di righe invalide", () => {
    const a = archivio(); a.giornate.push(esistente(a));
    const p = analizza(schede([riga({ ore: "4" }), riga({ ore: "3" })]), a, cfg);
    expect(() => operazioni(p, [{ chiave: p.righe[0].chiave, azione: "AGGIORNA", destinazione: "estranea" }])).toThrow("Seleziona");
    expect(() => operazioni(p, p.righe.map((r) => ({ chiave: r.chiave, azione: "AGGIORNA", destinazione: "giornata" })))).toThrow("Due righe");
    const invalid = analizza(schede([riga({ ore: "abc" })]), archivio(), cfg);
    expect(() => operazioni(invalid, [{ chiave: invalid.righe[0].chiave, azione: "NUOVA" }])).toThrow("dati validi");
  });
  it("non sovrascrive una giornata descritta da un'altra riga invariata", () => {
    const a = archivio(); a.giornate.push(esistente(a));
    const p = analizza(schede([riga(), riga({ ore: "4" })]), a, cfg);
    expect(() => operazioni(p, [{ chiave: p.righe[1].chiave, azione: "AGGIORNA", destinazione: "giornata" }])).toThrow("Seleziona");
  });
  it("prepara le anagrafiche mancanti, preservando il testo originale senza AI", () => {
    const s = schede([]);
    s.clienti = [{ cliente: "Nuovo Cliente", "indirizzo fatturazione": "Via Test, Milano" }];
    const p = analizza(s, archivio(), cfg);
    expect(p.anagrafiche.clienti[0].dati).toEqual({ note: "Indirizzo Fatturazione: Via Test, Milano" });
  });
  it("il reset considera anche il periodo precedente ma resta un'anteprima", () => {
    const a = archivio();
    const p = analizza(schede([riga({ data: "2025-01-01" })]), a, cfg, "RESET");
    expect(p.modalita).toBe("RESET"); expect(p.righe[0].stato).toBe("NON_IMPORTABILE");
    expect(a.clienti).toHaveLength(1);
  });
  it("valida le scelte inviate dai form", () => {
    const f = new FormData(); f.append("scelta:abc", "AGGIORNA:target");
    expect(parseDecisioni(f)).toEqual([{ chiave: "abc", azione: "AGGIORNA", destinazione: "target" }]);
    f.append("scelta:bad", "DROP"); expect(() => parseDecisioni(f)).toThrow("non valida");
  });
});

describe("riconciliazioni ambigue", () => {
  it("le colonne accessorie non distinguono due occorrenze della stessa chiave", () => {
    const a = archivio(); const g = esistente(a); a.giornate.push(g);
    const old = analizza(schede([riga()]), a, cfg).righe[0];
    a.registro.push({ chiave: old.chiave, dati: old.grezzi, rigaAttivitaId: g.id, impronta: impronta(g), ignorata: false });
    const p = analizza(schede([riga({ "colonna extra": "altro valore" }), riga()]), a, cfg);
    expect(p.righe.map((r) => r.stato)).toEqual(["PRESENTE", "PRONTA"]);
  });
  it("una data diversa è una nuova chiave e non sovrascrive la giornata precedente", () => {
    const a = archivio(); const g = esistente(a); a.giornate.push(g);
    const old = analizza(schede([riga()]), a, cfg).righe[0];
    a.registro.push({ chiave: old.chiave, dati: old.grezzi, rigaAttivitaId: g.id, impronta: impronta(g), ignorata: false });
    const p = analizza(schede([riga({ data: "2026-11-07" })]), a, cfg);
    expect(p.righe[0].stato).toBe("PRONTA"); expect(p.righe[0].candidati).toHaveLength(0);
  });
  it("una riga scomparsa presa in visione viene riconosciuta se ricompare", () => {
    const a = archivio(); const g = esistente(a); a.giornate.push(g);
    const old = analizza(schede([riga()]), a, cfg).righe[0];
    a.registro.push({ chiave: old.chiave, dati: old.grezzi, rigaAttivitaId: g.id, impronta: impronta(g), ignorata: true });
    expect(analizza(schede([]), a, cfg).righe.map((r) => r.stato)).toEqual(["SCOMPARSA"]);
    expect(analizza(schede([riga()]), a, cfg).righe[0].stato).toBe("PRESENTE");
  });
});

describe("aggiornamenti con ID stabile nel foglio", () => {
  it("riconosce la giornata anche quando cambiano data e ore", () => {
    const a = archivio(); const raw = riga({ id: "giornata-stabile" });
    const p = analizza(schede([raw]), a, cfg);
    const g = { ...p.righe[0].proposta!, id: "riga-db", versione: "v1" };
    a.giornate.push(g);
    a.registro.push({ chiave: p.righe[0].chiave, dati: raw, rigaAttivitaId: g.id, impronta: impronta(g), ignorata: false });
    const nuovo = analizza(schede([riga({ id: "giornata-stabile", data: "2026-11-09", ore: "4" })]), a, cfg);
    expect(nuovo.righe[0].stato).toBe("AGGIORNARE");
    expect(operazioni(nuovo, [])).toMatchObject([{ azione: "AGGIORNA", destinazione: "riga-db" }]);
  });
  it("rifiuta ID ripetuti senza confondere due giornate", () => {
    expect(() => analizza(schede([riga({ id: "a" }), riga({ id: "a" })]), archivio(), cfg)).toThrow("ID ripetuti");
  });
});

describe("chiave naturale collaboratore, data, cliente, offerta e ore", () => {
  it.each([false, true])("riserva prima le corrispondenze esatte anche con righe riordinate (%s)", (inverti) => {
    const a = archivio(); a.giornate.push(esistente(a));
    const rows = [riga({ ore: "4" }), riga()];
    if (inverti) rows.reverse();
    const p = analizza(schede(rows), a, cfg);
    expect(p.righe.find((r) => r.proposta?.ore === "8.00")?.stato).toBe("PRESENTE");
    expect(p.righe.find((r) => r.proposta?.ore === "4.00")?.stato).toBe("PRONTA");
    expect(operazioni(p, []).map((o) => o.azione).sort()).toEqual(["COLLEGA", "NUOVA"]);
  });
  it("non sceglie arbitrariamente fra più giornate con ore differenti", () => {
    const a = archivio();
    a.giornate.push(esistente(a), { ...esistente(a, riga({ ore: "6" })), id: "altra" });
    const p = analizza(schede([riga({ ore: "4" })]), a, cfg);
    expect(p.righe[0].stato).toBe("VERIFICARE");
    expect(p.righe[0].candidati).toHaveLength(2);
    expect(operazioni(p, [])).toEqual([]);
  });
  it("non assegna la stessa giornata a due righe nuove", () => {
    const a = archivio(); a.giornate.push(esistente(a));
    const p = analizza(schede([riga({ ore: "4" }), riga({ ore: "3" })]), a, cfg);
    expect(p.righe.map((r) => r.stato)).toEqual(["VERIFICARE", "VERIFICARE"]);
    expect(operazioni(p, [])).toEqual([]);
  });
  it("non confonde collaboratori, clienti, offerte o date differenti", () => {
    const a = archivio();
    const base = esistente(a);
    a.giornate.push({ ...base, collaboratoreId: "altro-coach" }, { ...base, id: "altro-cliente", clienteId: "altro-cliente" },
      { ...base, id: "altra-offerta", offertaId: null }, { ...base, id: "altra-data", data: "2026-11-06" });
    const p = analizza(schede([riga({ ore: "4" })]), a, cfg);
    expect(p.righe[0].stato).toBe("PRONTA");
    expect(p.righe[0].candidati).toHaveLength(0);
  });
  it("colonne accessorie, note e formattazione non creano una nuova chiave", () => {
    const a = archivio(); a.giornate.push({ ...esistente(a), nota: "Nota locale" });
    const originale = analizza(schede([riga()]), a, cfg);
    const modificata = analizza(schede([riga({ data: "05/11/2026", ore: "8,00", cliente: "  cliente TEST ", extra: "cambiato" })]), a, cfg);
    expect(modificata.righe[0].chiave).toBe(originale.righe[0].chiave);
    expect(modificata.righe[0].stato).toBe("AGGIORNARE");
    expect(operazioni(modificata, [])).toMatchObject([{ azione: "AGGIORNA", destinazione: "giornata" }]);
  });
});
