import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { analizza } from "@/lib/importer-legacy/analisi";
import { leggiArchivio } from "@/lib/importer-legacy/archivio";
import { configurazioneImporter } from "@/lib/importer-legacy/config";
import { applicaAnteprima, creaAnteprima, leggiPiano } from "@/lib/importer-legacy/servizio";
import type { Celle, Piano, Schede } from "@/lib/importer-legacy/types";

vi.mock("@/lib/importer-legacy/google", () => ({ leggiGoogle: vi.fn() }));
import { leggiGoogle } from "@/lib/importer-legacy/google";

let sheet: string;
let clienteId: string;
let collaboratoreId: string;
let offertaId: string;
let email: string;
let cliente: string;

function row(extra: Celle = {}): Celle {
  return { coach: "C1", cliente, "codice offerta": "OFF", data: "2026-11-05", ore: "8", "tipologia fatturazione": "FATTURABILE", ...extra };
}
function schede(rows: Celle[]): Schede { return { clienti: [], offerte: [], coach: [{ id: "C1", email }], giornate: rows }; }
async function preview(s: Schede, mode: Piano["modalita"] = "INCREMENTALE") {
  const cfg = configurazioneImporter();
  const archive = await db.$transaction((tx) => leggiArchivio(tx, sheet));
  const piano = analizza(s, archive, cfg, mode);
  const job = await db.importazioneLegacy.create({ data: { origine: sheet, autoreId: "test-admin", piano: JSON.parse(JSON.stringify(piano)) } });
  return { job, piano };
}
async function refresh(id: string) { return db.importazioneLegacy.findUniqueOrThrow({ where: { id } }); }

beforeEach(async () => {
  sheet = `test-${randomUUID()}`; cliente = `Cliente ${sheet}`; email = `${sheet}@example.com`;
  vi.stubEnv("IMPORTER_GOOGLE_SPREADSHEET_ID", sheet);
  vi.stubEnv("IMPORTER_GOOGLE_SERVICE_ACCOUNT_JSON", "configurazione-test-non-usata-per-la-scrittura");
  vi.stubEnv("IMPORTER_AI_BASE_URL", "");
  vi.stubEnv("IMPORTER_EMAIL_AMMINISTRATORI", "");
  const c = await db.cliente.create({ data: { ragioneSociale: cliente } }); clienteId = c.id;
  const u = await db.utente.create({ data: { nome: "Coach", cognome: "Test", email, collaboratore: { create: { nome: "Coach", cognome: "Test" } } }, include: { collaboratore: true } }); collaboratoreId = u.collaboratore!.id;
  offertaId = (await db.offerta.create({ data: { clienteId, codice: "OFF" } })).id;
});
afterAll(async () => { vi.unstubAllEnvs(); await db.$disconnect(); });

describe("persistenza reale importer (database dedicato)", () => {
  it("sincronizza i periodi del coach esistente e disattiva l'accesso dopo la cessazione", async () => {
    const s = schede([row()]);
    s.coach = [
      { id: "C1", email, nome: "Coach", cognome: "Test", dal_mese: "2018-01", al_mese: "2018-12", tipologia: "PERCENTUALE", importo: "30" },
      { id: "C1", email, nome: "Coach", cognome: "Test", dal_mese: "2019-01", al_mese: "2020-12", tipologia: "FISSO_MENSILE", importo: "3500" },
    ];
    const { job, piano } = await preview(s);
    expect(piano.anagrafiche.coach).toHaveLength(1);
    expect(piano.anagrafiche.coach[0].tariffe).toHaveLength(2);
    await applicaAnteprima(job.id, job.updatedAt.toISOString(), [], [], "");
    const saved = await db.collaboratore.findUniqueOrThrow({ where: { id: collaboratoreId }, include: { tariffe: { orderBy: { validaDalMese: "asc" } }, utente: true } });
    expect(saved.attivo).toBe(false); expect(saved.utente.attivo).toBe(false);
    expect(saved.tariffe[0]).toMatchObject({ modalita: "PERCENTUALE", validaAlMese: "2018-12" });
    expect(saved.tariffe[0].importo.toString()).toBe("30");
    expect(saved.tariffe[1].validaAlMese).toBe("2020-12");
    expect((await preview(s)).piano.anagrafiche.coach).toHaveLength(0);
    s.coach.push({ id: "C1", email, nome: "Coach", cognome: "Test", dal_mese: "2021-01", al_mese: "", tipologia: "GIORNALIERA", importo: "500" });
    const rientro = await preview(s);
    await applicaAnteprima(rientro.job.id, rientro.job.updatedAt.toISOString(), [], [], "");
    expect((await db.collaboratore.findUniqueOrThrow({ where: { id: collaboratoreId } })).attivo).toBe(true);
    expect((await db.utente.findUniqueOrThrow({ where: { email } })).attivo).toBe(true);
    expect(await db.tariffaCollaboratore.count({ where: { collaboratoreId } })).toBe(3);
  });
  it("mantiene per default la giornata rimossa e cancella solo quella scelta, conservando le manuali", async () => {
    const prima = await preview(schede([row(), row({ data: "2026-11-06" })]));
    await applicaAnteprima(prima.job.id, prima.job.updatedAt.toISOString(), [], [], "");
    const manuale = await db.rigaAttivita.create({ data: { collaboratoreId, clienteId, offertaId, data: new Date("2026-11-07T12:00:00Z"), ore: "3" } });
    const seconda = await preview(schede([row({ ore: "4" })]));
    expect(seconda.piano.righe.map((r) => r.stato)).toEqual(["AGGIORNARE", "SCOMPARSA"]);
    await applicaAnteprima(seconda.job.id, seconda.job.updatedAt.toISOString(), [], [], "");
    expect(await db.rigaAttivita.count({ where: { collaboratoreId } })).toBe(3);
    const terza = await preview(schede([row({ ore: "4" })]));
    const missing = terza.piano.righe.find((r) => r.stato === "SCOMPARSA")!;
    const esito = await applicaAnteprima(terza.job.id, terza.job.updatedAt.toISOString(), [{ chiave: missing.chiave, azione: "ELIMINA" }], [], "");
    expect(esito.eliminate).toBe(1);
    expect(await db.rigaAttivita.findUnique({ where: { id: missing.collegataId } })).toBeNull();
    expect(await db.rigaAttivita.findUnique({ where: { id: manuale.id } })).not.toBeNull();
    expect(await db.importazioneLegacyRiga.count({ where: { origine: sheet } })).toBe(1);
    expect((await preview(schede([row({ ore: "4" })]))).piano.righe.map((r) => r.stato)).toEqual(["PRESENTE"]);
  });
  it("blocca una cancellazione se il DB cambia dopo l'analisi o il collegamento appartiene anche a un altro documento", async () => {
    const prima = await preview(schede([row()]));
    await applicaAnteprima(prima.job.id, prima.job.updatedAt.toISOString(), [], [], "");
    const seconda = await preview(schede([])); const missing = seconda.piano.righe[0];
    await db.rigaAttivita.update({ where: { id: missing.collegataId }, data: { nota: "Modifica dopo analisi" } });
    await expect(applicaAnteprima(seconda.job.id, seconda.job.updatedAt.toISOString(), [{ chiave: missing.chiave, azione: "ELIMINA" }], [], "")).rejects.toThrow("cambiati dopo");
    await db.importazioneLegacyRiga.create({ data: { origine: `altro-${sheet}`, chiave: "altra", dati: {}, rigaAttivitaId: missing.collegataId } });
    const terza = await preview(schede([]));
    await expect(applicaAnteprima(terza.job.id, terza.job.updatedAt.toISOString(), [{ chiave: terza.piano.righe[0].chiave, azione: "ELIMINA" }], [], "")).rejects.toThrow("altro documento");
    expect(await db.rigaAttivita.findUnique({ where: { id: missing.collegataId } })).not.toBeNull();
    expect(await refresh(terza.job.id)).toMatchObject({ stato: "ANTEPRIMA" });
  });
  it("conferma, crea un ripiego per cliente e reimporta senza duplicare giornate o note", async () => {
    const s = schede([row({ "codice offerta": "", note: "Nota originale" }), row({ "codice offerta": "MANCANTE", data: "2026-11-06", "spese coach": "75" })]);
    const { job, piano } = await preview(s);
    await expect(applicaAnteprima(job.id, job.updatedAt.toISOString(), [], [], "")).rejects.toThrow("Conferma le associazioni");
    expect(await db.offerta.count({ where: { clienteId, codice: "SENZA CODICE" } })).toBe(0);
    await applicaAnteprima(job.id, job.updatedAt.toISOString(), [], [], "", true);
    const offerte = await db.offerta.findMany({ where: { clienteId, codice: "SENZA CODICE" } });
    expect(offerte).toHaveLength(1); expect(offerte[0].tariffaGiornaliera?.toString()).toBe("0");
    const righe = await db.rigaAttivita.findMany({ where: { collaboratoreId }, orderBy: { data: "asc" } });
    expect(righe).toHaveLength(2); expect(righe.every((r) => r.offertaId === offerte[0].id)).toBe(true);
    expect(righe[0].nota).toContain("Nota originale"); expect(righe[1].rimborsoTrasfertaImporto?.toString()).toBe("75");
    expect(await db.importazioneLegacy.findUnique({ where: { id: job.id } })).toBeNull();
    expect(await db.importazioneLegacyRiga.count({ where: { origine: sheet } })).toBe(2);
    expect(piano.anagrafiche.offerte).toHaveLength(1);
    await db.rigaAttivita.update({ where: { id: righe[0].id }, data: { nota: `${righe[0].nota}\nNota manuale` } });
    const next = await preview(s);
    expect(next.piano.righe.every((r) => r.stato === "PRESENTE")).toBe(true);
    await applicaAnteprima(next.job.id, next.job.updatedAt.toISOString(), [], [], "");
    expect(await db.rigaAttivita.count({ where: { collaboratoreId } })).toBe(2);
    expect((await db.rigaAttivita.findUniqueOrThrow({ where: { id: righe[0].id } })).nota).toBe(`${righe[0].nota}\nNota manuale`);
  });
  it("non crea ripieghi per ambiguità non scelte e conserva la scelta alle letture successive", async () => {
    await db.offerta.createMany({ data: ["CORSO_APM_1", "CORSO_APM_2"].map((codice) => ({ codice, clienteId })) });
    const s = schede([row({ "codice offerta": "CORSO APM" })]);
    const primo = await preview(s);
    await applicaAnteprima(primo.job.id, primo.job.updatedAt.toISOString(), [], [], "");
    expect(await db.offerta.count({ where: { clienteId, codice: "SENZA CODICE" } })).toBe(0);
    expect(await db.rigaAttivita.count({ where: { collaboratoreId } })).toBe(0);
    expect(await db.importazioneLegacy.findUnique({ where: { id: primo.job.id } })).toBeNull();
    const nuova = await preview(s);
    const secondo = nuova.job;
    const p = nuova.piano;
    const decisione = [{ chiave: p.righe[0].chiave, azione: "SENZA_CODICE" as const }];
    await expect(applicaAnteprima(secondo.id, secondo.updatedAt.toISOString(), decisione, [], "")).rejects.toThrow("Conferma le associazioni");
    await applicaAnteprima(secondo.id, secondo.updatedAt.toISOString(), decisione, [], "", true);
    const next = await preview(s);
    expect(next.piano.righe[0].stato).toBe("PRESENTE");
    await applicaAnteprima(next.job.id, next.job.updatedAt.toISOString(), [], [], "");
    const saved = await db.rigaAttivita.findMany({ where: { collaboratoreId } });
    expect(saved).toHaveLength(1); expect(saved[0].nota?.match(/scelta dell’amministratore/g)).toHaveLength(1);
  });
  it("importa dalla fotografia, riconosce i tentativi ripetuti e aggiorna le ore sulla corrispondenza unica", async () => {
    const { job } = await preview(schede([row()]));
    const net = vi.fn(() => { throw new Error("non si deve rileggere il foglio durante l'import"); }); vi.stubGlobal("fetch", net);
    await applicaAnteprima(job.id, job.updatedAt.toISOString(), [], [], "");
    expect(net).not.toHaveBeenCalled(); vi.unstubAllGlobals();
    expect(await db.rigaAttivita.count({ where: { collaboratoreId } })).toBe(1);
    await expect(applicaAnteprima(job.id, job.updatedAt.toISOString(), [], [], "")).rejects.toThrow("Anteprima assente");
    const p2 = await preview(schede([row()]));
    expect(p2.piano.righe[0].stato).toBe("PRESENTE");
    const p3 = await preview(schede([row({ ore: "4" })]));
    expect(p3.piano.righe[0].stato).toBe("AGGIORNARE");
    const target = p3.piano.righe[0].candidati[0].id;
    await applicaAnteprima(p3.job.id, p3.job.updatedAt.toISOString(), [], [], "");
    expect((await db.rigaAttivita.findUniqueOrThrow({ where: { id: target } })).ore.toString()).toBe("4");
    expect(await db.rigaAttivita.count({ where: { collaboratoreId } })).toBe(1);
    expect((await preview(schede([row({ ore: "4" })]))).piano.righe[0].stato).toBe("PRESENTE");
  });
  it("completa un amministratore esistente mantenendo identità, ruolo e account Google", async () => {
    const adminEmail = `admin-${sheet}@example.com`;
    const admin = await db.utente.create({ data: { nome: "Nome conservato", cognome: "Originale", email: adminEmail,
      ruolo: "AMMINISTRATORE", note: "Da conservare", account: { create: { type: "oauth", provider: "google", providerAccountId: sheet } } }, include: { account: true } });
    const s = schede([row()]);
    s.coach = [{ id: "C1", email: adminEmail, nome: "Nome dal foglio", cognome: "Coach", tipologia: "GIORNATA", importo: "400" }];
    const { job, piano } = await preview(s);
    expect(piano.anagrafiche.coach[0]).toMatchObject({ userId: admin.id, utenteEsistente: true });
    expect(piano.righe[0].stato).toBe("PRONTA");
    expect(await db.collaboratore.findUnique({ where: { userId: admin.id } })).toBeNull();
    await applicaAnteprima(job.id, job.updatedAt.toISOString(), [], [], "");
    const saved = await db.utente.findUniqueOrThrow({ where: { id: admin.id }, include: { collaboratore: { include: { tariffe: true } }, account: true } });
    expect(saved).toMatchObject({ nome: admin.nome, cognome: admin.cognome, ruolo: "AMMINISTRATORE", email: adminEmail, note: "Da conservare" });
    expect(saved.account).toEqual(admin.account);
    expect(saved.collaboratore?.id).toBe(piano.anagrafiche.coach[0].id);
    expect(saved.collaboratore?.tariffe[0].importo.toFixed(2)).toBe("400.00");
    expect(await db.rigaAttivita.count({ where: { collaboratoreId: saved.collaboratore!.id } })).toBe(1);
    const p2 = await preview(s);
    expect(p2.piano.anagrafiche.coach).toHaveLength(0);
    expect(p2.piano.righe[0].stato).toBe("PRESENTE");
  });
  it("sostituisce l’anteprima corrente senza accumulare importazioni", async () => {
    vi.mocked(leggiGoogle).mockResolvedValue(schede([row()]));
    const prima = await creaAnteprima("admin", "INCREMENTALE");
    const vecchia = await refresh(prima.id);
    vi.mocked(leggiGoogle).mockResolvedValue(schede([row({ ore: "4" })]));
    const seconda = await creaAnteprima("admin", "INCREMENTALE");
    expect(await db.importazioneLegacy.count({ where: { origine: sheet } })).toBe(1);
    expect(await db.importazioneLegacy.findUnique({ where: { id: prima.id } })).toBeNull();
    await expect(applicaAnteprima(prima.id, vecchia.updatedAt.toISOString(), [], [], "")).rejects.toThrow("Anteprima assente");
    expect(leggiPiano((await refresh(seconda.id)).piano).righe[0].proposta?.ore).toBe("4.00");
    expect(await db.rigaAttivita.count({ where: { collaboratoreId } })).toBe(0);
  });
  it("due richieste concorrenti non creano duplicati", async () => {
    const { job } = await preview(schede([row()]));
    const results = await Promise.allSettled([applicaAnteprima(job.id, job.updatedAt.toISOString(), [], [], ""), applicaAnteprima(job.id, job.updatedAt.toISOString(), [], [], "")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.rigaAttivita.count({ where: { collaboratoreId } })).toBe(1);
  });
  it("una modifica locale dopo l'anteprima impedisce qualsiasi scrittura parziale", async () => {
    const { job } = await preview(schede([row()]));
    await db.rigaAttivita.create({ data: { collaboratoreId, clienteId, offertaId, data: new Date("2026-11-06T12:00:00Z"), ore: "2" } });
    await expect(applicaAnteprima(job.id, job.updatedAt.toISOString(), [], [], "")).rejects.toThrow("cambiati dopo l’analisi");
    expect(await db.importazioneLegacyRiga.count({ where: { origine: sheet } })).toBe(0);
    expect(await refresh(job.id)).toMatchObject({ stato: "ANTEPRIMA" });
    expect(await db.rigaAttivita.count({ where: { collaboratoreId } })).toBe(1);
  });
  it("accetta i duplicati del foglio e non li reinserisce alla lettura successiva", async () => {
    const s = schede([row(), row({ data: "2026-11-06" }), row({ data: "2026-11-06" })]);
    const { job } = await preview(s);
    await applicaAnteprima(job.id, job.updatedAt.toISOString(), [], [], "");
    expect(await db.importazioneLegacy.findUnique({ where: { id: job.id } })).toBeNull();
    expect(await db.rigaAttivita.count({ where: { collaboratoreId } })).toBe(3);
    const next = await preview(s);
    expect(next.piano.righe.every((r) => r.stato === "PRESENTE")).toBe(true);
    await applicaAnteprima(next.job.id, next.job.updatedAt.toISOString(), [], [], "");
    expect(await db.rigaAttivita.count({ where: { collaboratoreId } })).toBe(3);
  });
  it("rivaluta gli scarti e segnala le giornate assenti mantenendole nell'app", async () => {
    const { job, piano } = await preview(schede([row(), row({ data: "non leggibile" })]));
    await applicaAnteprima(job.id, job.updatedAt.toISOString(), [{ chiave: piano.righe[1].chiave, azione: "IGNORA" }], [], "");
    const p2 = await preview(schede([row({ data: "non leggibile" })]));
    expect(p2.piano.righe.map((r) => r.stato)).toEqual(["NON_IMPORTABILE", "SCOMPARSA"]);
    expect(await db.rigaAttivita.count({ where: { collaboratoreId } })).toBe(1);
  });
  it("aggiorna una giornata con ID stabile senza duplicarla né cancellare le altre", async () => {
    const primo = await preview(schede([row({ id: "stabile" })]));
    await applicaAnteprima(primo.job.id, primo.job.updatedAt.toISOString(), [], [], "");
    const originale = await db.rigaAttivita.findFirstOrThrow({ where: { collaboratoreId } });
    const secondo = await preview(schede([row({ id: "stabile", data: "2026-11-07", ore: "4" })]));
    expect(secondo.piano.righe[0].stato).toBe("AGGIORNARE");
    await applicaAnteprima(secondo.job.id, secondo.job.updatedAt.toISOString(), [], [], "");
    const saved = await db.rigaAttivita.findUniqueOrThrow({ where: { id: originale.id } });
    expect(saved.ore.toFixed(2)).toBe("4.00");
    expect(saved.data.toISOString()).toContain("2026-11-07");
    expect(await db.rigaAttivita.count({ where: { collaboratoreId } })).toBe(1);
  });
  it("aggiunge le anagrafiche nello stesso commit e conserva i dati AI solo se approvati", async () => {
    const s = schede([]);
    s.clienti.push({ cliente: `Nuovo ${sheet}`, "indirizzo fatturazione": "Via Test 1" });
    const { job, piano } = await preview(s);
    const c = piano.anagrafiche.clienti[0]; c.verifica = true; c.dati.indirizzo = "Via Test 1";
    const updated = await db.importazioneLegacy.update({ where: { id: job.id }, data: { piano: JSON.parse(JSON.stringify(piano)) } });
    await applicaAnteprima(job.id, updated.updatedAt.toISOString(), [], [], "");
    const saved = await db.cliente.findUniqueOrThrow({ where: { id: c.id } });
    expect(saved.indirizzo).toBeNull(); expect(saved.note).toContain("Via Test 1");
  });
  it("il reset richiede conferma e viene annullato atomicamente se un vincolo fallisce", async () => {
    vi.stubEnv("IMPORTER_EMAIL_AMMINISTRATORI", email);
    const s = schede([row()]);
    s.clienti = [{ cliente }];
    s.offerte = [{ data: "2026", cliente, offerta: "OFF" }];
    s.coach = [{ id: "C1", email, nome: "Coach", cognome: "Test", tipologia: "GIORNATA", importo: "400" }];
    const { job, piano } = await preview(s, "RESET");
    expect(piano.righe[0].stato).toBe("PRONTA");
    const prima = await db.utente.count();
    await expect(applicaAnteprima(job.id, job.updatedAt.toISOString(), [], [], "")).rejects.toThrow("AZZERA TUTTO");
    expect(await db.utente.count()).toBe(prima);
    // Una tariffa oltre il range del DB fa fallire il commit dopo le cancellazioni.
    piano.anagrafiche.coach[0].tariffe![0].importo = "99999999999999999";
    const changed = await db.importazioneLegacy.update({ where: { id: job.id }, data: { piano: JSON.parse(JSON.stringify(piano)) } });
    await expect(applicaAnteprima(job.id, changed.updatedAt.toISOString(), [], [], "AZZERA TUTTO")).rejects.toThrow();
    expect(await db.utente.count()).toBe(prima);
    expect(await db.cliente.findUnique({ where: { id: clienteId } })).not.toBeNull();
  });
  it("il reset confermato ricrea il foglio e conserva la propria registrazione", async () => {
    vi.stubEnv("IMPORTER_EMAIL_AMMINISTRATORI", email);
    const s = schede([row()]);
    s.clienti = [{ cliente }]; s.offerte = [{ data: "2026", cliente, offerta: "OFF" }];
    s.coach = [{ id: "C1", email, nome: "Coach", cognome: "Test", tipologia: "GIORNATA", importo: "400" }];
    const adminPrima = await db.utente.findMany({ where: { ruolo: "AMMINISTRATORE" }, include: { account: true, session: true } });
    const { job } = await preview(s, "RESET");
    await applicaAnteprima(job.id, job.updatedAt.toISOString(), [], [], "AZZERA TUTTO");
    expect(await db.utente.count()).toBe(adminPrima.length + 1);
    expect((await db.utente.findUniqueOrThrow({ where: { email } })).ruolo).toBe("AMMINISTRATORE");
    for (const admin of adminPrima) expect(await db.utente.findUniqueOrThrow({ where: { id: admin.id }, include: { account: true, session: true } })).toEqual(admin);
    expect(await db.rigaAttivita.count()).toBe(1);
    expect(await db.importazioneLegacy.findUnique({ where: { id: job.id } })).toBeNull();
    expect((await preview(s)).piano.righe[0].stato).toBe("PRESENTE");
  });
});

it("aggiorna un PAIR preesistente senza dimezzare le ore del coach né duplicare", async () => {
  const s = schede([row({ "tipologia fatturazione": "PAIR" })]);
  const first = await preview(s);
  await applicaAnteprima(first.job.id, first.job.updatedAt.toISOString(), [], [], "");
  const saved = await db.rigaAttivita.findFirstOrThrow({ where: { collaboratoreId } });
  await db.rigaAttivita.update({ where: { id: saved.id }, data: { categoria: "NON_FATTURABILE", inAffiancamento: false } });
  const next = await preview(s);
  expect(next.piano.righe[0].stato).toBe("AGGIORNARE");
  await applicaAnteprima(next.job.id, next.job.updatedAt.toISOString(), [], [], "");
  expect(await db.rigaAttivita.count({ where: { collaboratoreId } })).toBe(1);
  const updated = await db.rigaAttivita.findUniqueOrThrow({ where: { id: saved.id } });
  expect(updated.inAffiancamento).toBe(true);
  expect(updated.categoria).toBe("FATTURABILE");
  expect(Number(updated.ore)).toBe(8);
  expect((await preview(s)).piano.righe[0].stato).toBe("PRESENTE");
});
