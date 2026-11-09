/** Prova del servizio reale su una fotografia Google letta in sola lettura.
 * Non carica file .env; DATABASE_URL deve essere esplicita e locale.
 * NODE_OPTIONS='--conditions=react-server' npx tsx scripts/verifica-importazione-locale.ts /percorso/source.json --reset
 */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { normalizzaIntestazione } from "./importa-storico/foglio";
import { db } from "../src/lib/db";
import { configurazioneImporter } from "../src/lib/importer-legacy/config";
import { analizza } from "../src/lib/importer-legacy/analisi";
import { leggiArchivio } from "../src/lib/importer-legacy/archivio";
import { applicaAnteprima, contaRighe } from "../src/lib/importer-legacy/servizio";
import { tariffaValidaNelMese } from "../src/domain/tariffe";
import type { Celle, Decisione, Piano, Schede } from "../src/lib/importer-legacy/types";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname === "/coaching_planner", "Solo database locale coaching_planner");
  const file = process.argv[2];
  const reset = process.argv.includes("--reset");
  assert(file && (reset !== process.argv.includes("--incrementale")), "Specificare fotografia JSON e --reset oppure --incrementale");
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<keyof Schede, unknown[][]>;
  const schede = Object.fromEntries(Object.entries(raw).map(([k, matrix]) => {
    const headers = matrix[0].map((h) => normalizzaIntestazione(String(h)));
    return [k, matrix.slice(1).map((row): Celle => Object.fromEntries(headers.map((h, i) => [h, String(row[i] ?? "").trim()])))];
  })) as unknown as Schede;
  process.env.IMPORTER_ENABLED = "true";
  process.env.IMPORTER_GOOGLE_SERVICE_ACCOUNT_JSON = "fotografia-connettore-non-usata-per-la-lettura";
  process.env.IMPORTER_GOOGLE_SPREADSHEET_ID = "1zJxcrP_i4_VwfDhOaCZ4_IL9SquYUDLIKd9RP8SFdDI";
  const cfg = configurazioneImporter();
  const admins = await db.utente.findMany({ where: { ruolo: "AMMINISTRATORE" }, include: { account: true, session: true }, orderBy: { id: "asc" } });
  assert(admins.length, "Occorre almeno un amministratore da conservare");
  const prepara = async (modalita: Piano["modalita"]) => {
    const archivio = await db.$transaction((tx) => leggiArchivio(tx, cfg.id), { timeout: 60_000 });
    const piano = analizza(schede, archivio, cfg, modalita);
    const job = await db.importazioneLegacy.create({ data: { origine: cfg.id, autoreId: admins[0].id, piano: JSON.parse(JSON.stringify(piano)) } });
    return { piano, job };
  };
  const primo = await prepara(reset ? "RESET" : "INCREMENTALE");
  console.log(JSON.stringify({ fase: "anteprima", coach: primo.piano.anagrafiche.coach.length,
    tariffe: primo.piano.anagrafiche.coach.reduce((n, c) => n + (c.tariffe?.length ?? 1), 0), righe: contaRighe(primo.piano.righe) }));
  const scelte: Decisione[] = primo.piano.righe.flatMap<Decisione>((r) => r.stato === "NON_IMPORTABILE" ? [{ chiave: r.chiave, azione: "IGNORA" as const }]
    : r.stato === "VERIFICARE" && r.senzaCodice?.motivo === "AMBIGUA" ? [{ chiave: r.chiave, azione: "SENZA_CODICE" as const }] : []);
  assert(!primo.piano.righe.some((r) => r.stato === "VERIFICARE" && !scelte.some((d) => d.chiave === r.chiave)), "Ambiguità non risolta");
  const esito = await applicaAnteprima(primo.job.id, primo.job.updatedAt.toISOString(), scelte, [], reset ? "AZZERA TUTTO" : "", true);
  assert.deepEqual(await db.utente.findMany({ where: { ruolo: "AMMINISTRATORE" }, include: { account: true, session: true }, orderBy: { id: "asc" } }), admins);
  const coach = await db.collaboratore.findMany({ include: { tariffe: true, utente: true } });
  assert.equal(coach.length, new Set(schede.coach.map((r) => r.id)).size);
  assert.equal(await db.tariffaCollaboratore.count(), schede.coach.length);
  const mese = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" }).format(new Date());
  for (const c of coach) {
    assert.equal(c.attivo, tariffaValidaNelMese(c.tariffe, mese) !== null);
    if (c.utente.ruolo !== "AMMINISTRATORE") assert.equal(c.utente.attivo, c.attivo);
  }
  const count = await db.rigaAttivita.count();
  const secondo = await prepara("INCREMENTALE");
  assert.equal(secondo.piano.anagrafiche.coach.length, 0, "Il reimport non deve duplicare o riscrivere i coach");
  assert(!secondo.piano.righe.some((r) => ["PRONTA", "AGGIORNARE", "SCOMPARSA"].includes(r.stato)), "Il reimport deve essere stabile");
  await applicaAnteprima(secondo.job.id, secondo.job.updatedAt.toISOString(), [], [], "", true);
  assert.equal(await db.rigaAttivita.count(), count);
  const report = { origine: cfg.id, esito, amministratoriConservati: admins.length, collaboratori: coach.length,
    attivi: coach.filter((c) => c.attivo).length, cessati: coach.filter((c) => !c.attivo).length,
    tariffe: await db.tariffaCollaboratore.count(), giornate: count,
    reimport: contaRighe(secondo.piano.righe),
    scarti: primo.piano.righe.filter((r) => r.stato === "NON_IMPORTABILE").map((r) => ({ riga: r.numero, motivo: r.motivo })),
    avvisi: primo.piano.anagrafiche.avvisi };
  writeFileSync(`${file}.report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
