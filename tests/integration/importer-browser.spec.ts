import { randomUUID } from "node:crypto";
import { test, expect } from "../e2e/support/fixtures";
import { preparaSessioneE2e } from "../e2e/support/auth";
import { dataNelMeseRiservato } from "../e2e/support/date";
import { analizza } from "../../src/lib/importer-legacy/analisi";
import type { Archivio, Schede } from "../../src/lib/importer-legacy/types";
import type { E2eDataFactory } from "../e2e/support/factory";

// Fotografia reale del DB, nello stesso ordine deterministico del reader applicativo.
async function archivio(factory: E2eDataFactory): Promise<Archivio> {
  const [clienti, utenti, offerte, giornate, rimborsi] = await Promise.all([
    factory.prisma.query('SELECT "id", "ragioneSociale" FROM "Cliente" ORDER BY "id"'),
    factory.prisma.query('SELECT u."id", u."email", c."id" AS "collaboratoreId" FROM "Utente" u LEFT JOIN "Collaboratore" c ON c."userId"=u."id" ORDER BY u."id"'),
    factory.prisma.query('SELECT "id", "codice", "clienteId" FROM "Offerta" ORDER BY "id"'),
    factory.prisma.query(`SELECT *, "data"::text AS "dataISO", "updatedAt" AT TIME ZONE 'UTC' AS "versioneUTC" FROM "RigaAttivita" ORDER BY "id"`),
    factory.prisma.query('SELECT "etichetta", "importo"::text FROM "VoceRimborsoTrasferta" ORDER BY "id"'),
  ]);
  return { clienti: clienti.rows, utenti: utenti.rows.map((u) => ({ id: u.id, email: u.email, collaboratore: u.collaboratoreId ? { id: u.collaboratoreId } : null })), offerte: offerte.rows,
    giornate: giornate.rows.map((g) => ({ id: g.id, versione: g.versioneUTC.toISOString(), data: g.dataISO, collaboratoreId: g.collaboratoreId, clienteId: g.clienteId, offertaId: g.offertaId,
      ore: Number(g.ore).toFixed(2), categoria: g.categoria, rimborsoTrasfertaImporto: g.rimborsoTrasfertaImporto === null ? null : Number(g.rimborsoTrasfertaImporto).toFixed(2), rimborsoTrasfertaEtichetta: g.rimborsoTrasfertaEtichetta, nota: g.nota })),
    rimborsi: rimborsi.rows, registro: [] };
}

test("anteprima, confronto e importazione approvata funzionano senza AI", async ({ page, factory }, testInfo) => {
  const admin = await factory.createUtente({ ruolo: "AMMINISTRATORE" });
  const coach = await factory.createCollaboratore();
  const { cliente, offerta } = await factory.createClienteConOfferta();
  await factory.createOfferta({ cliente, codice: `CORSO_APM_1_${randomUUID()}` });
  await factory.createOfferta({ cliente, codice: `CORSO_APM_2_${randomUUID()}` });
  const data = dataNelMeseRiservato("importer-browser", 5);
  const nuovaData = dataNelMeseRiservato("importer-browser", 6);
  const esistente = await factory.createRigaAttivita({ collaboratore: coach, cliente, offerta, data: new Date(`${data}T12:00:00Z`), ore: 8, nota: null });
  await preparaSessioneE2e(page, admin.email);
  const raw = { coach: "C1", cliente: cliente.ragioneSociale, "codice offerta": offerta.codice, ore: "4", data: data, "tipologia fatturazione": "FATTURABILE" };
  const schede: Schede = { clienti: [], offerte: [], coach: [{ id: "C1", email: coach.utente.email }], giornate: [raw, { ...raw, data: nuovaData }, { ...raw, ore: "abc" },
    { ...raw, data: dataNelMeseRiservato("importer-browser", 7), "codice offerta": "", note: "Nota originale da mantenere" },
    { ...raw, data: dataNelMeseRiservato("importer-browser", 8), "codice offerta": "OFF-SCONOSCIUTA" },
    { ...raw, data: dataNelMeseRiservato("importer-browser", 9), "codice offerta": "CORSO APM" },
  ] };
  const piano = analizza(schede, await archivio(factory), { abilitato: true, configurato: true, id: "e2e-importer", credenziali: "", dalMese: "2018-01", clienteInterno: "INTERNO", esclusi: [], amministratori: [], schede: { clienti: "CLIENTI", offerte: "OFFERTE", coach: "COACH", giornate: "GIORNATE" } });
  const id = randomUUID();
  await factory.prisma.query('INSERT INTO "ImportazioneLegacy" ("id","origine","autoreId","piano","updatedAt") VALUES ($1,$2,$3,$4,NOW())', [id, "e2e-importer", admin.id, JSON.stringify(piano)]);
  // Un'anteprima salvata non deve comparire all'apertura della pagina.
  await page.goto("/importazione");
  await expect(page.getByRole("button", { name: "Analizza foglio", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Anteprima importazione")).toHaveCount(0);
  await page.goto(`/importazione?id=${id}`);
  await expect(page.getByLabel("Anteprima importazione")).toBeVisible();
  await page.getByRole("link", { name: "Offerte", exact: true }).click();
  await page.getByRole("link", { name: "Importazione", exact: true }).click();
  await expect(page.getByLabel("Anteprima importazione")).toHaveCount(0);
  await page.goto(`/importazione?id=${id}`);
  await expect(page.getByLabel("Anteprima importazione")).toHaveAttribute("data-idratata", "true");
  await expect(page.getByRole("button", { name: "Analizza foglio", exact: true })).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Storico importazioni", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pronte da importare (1)", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Da aggiornare (1)", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "AI non configurata" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Da importare su SENZA CODICE (2)", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Importa e aggiorna", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Da importare su SENZA CODICE (2)", exact: true }).click();
  const ripieghi = page.getByRole("region", { name: "Da importare su SENZA CODICE", exact: true });
  await expect(ripieghi).toContainText("OFF-SCONOSCIUTA");
  await expect(ripieghi).toContainText("Non indicato");
  await expect(ripieghi).toContainText("Nota originale da mantenere");
  await expect(ripieghi.getByText(/Offerta da creare alla conferma/)).toHaveCount(2);
  await page.getByRole("checkbox", { name: "Confermo le associazioni a SENZA CODICE", exact: true }).check();
  await page.getByRole("button", { name: "Da verificare (1)", exact: true }).click();
  await page.getByRole("combobox", { name: "Decisione per riga 7", exact: true }).selectOption("SENZA_CODICE");
  await expect(page.getByRole("button", { name: "Da importare su SENZA CODICE (3)", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Confermo le associazioni a SENZA CODICE", exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Da importare su SENZA CODICE (3)", exact: true }).click();
  await expect(ripieghi).toContainText("per scelta dell’amministratore");
  await page.screenshot({ path: testInfo.outputPath("anteprima-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Da aggiornare (1)", exact: true }).click();
  const review = page.getByRole("region", { name: "Da aggiornare", exact: true });
  await review.getByText("Dati originali e confronto", { exact: true }).click();
  await expect(review.getByText("8.00", { exact: true })).toBeVisible();
  await expect(review.getByRole("combobox")).toHaveCount(0);
  await page.getByRole("button", { name: "Scarti (1)", exact: true }).click();
  await expect(page.getByRole("region", { name: "Scarti", exact: true }).getByRole("combobox")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Da importare su SENZA CODICE (3)", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("anteprima-mobile.png"), fullPage: true });
  await page.getByRole("checkbox", { name: "Confermo le associazioni a SENZA CODICE", exact: true }).check();
  await page.getByRole("button", { name: "Importa e aggiorna", exact: true }).click();
  await page.waitForURL(/salvata=1/);
  await expect(page.getByRole("status").filter({ hasText: "Importazione completata" })).toBeVisible();
  const saved = await factory.prisma.query('SELECT "id", "ore"::text FROM "RigaAttivita" WHERE "collaboratoreId"=$1', [coach.collaboratore.id]);
  expect(saved.rows).toHaveLength(5);
  expect(Number(saved.rows.find((g) => g.id === esistente.id)?.ore)).toBe(4);
  await expect(page.getByLabel("Anteprima importazione")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Analizza foglio", exact: true })).toBeEnabled();
  await page.goto(`/importazione?id=${id}`);
  await expect(page.getByLabel("Anteprima importazione")).toHaveCount(0);
  const offerteRipiego = await factory.prisma.query('SELECT "id", "tariffaGiornaliera"::text FROM "Offerta" WHERE "clienteId"=$1 AND "codice"=$2', [cliente.id, "SENZA CODICE"]);
  expect(offerteRipiego.rows).toHaveLength(1);
  expect(Number(offerteRipiego.rows[0].tariffaGiornaliera)).toBe(0);
  const anteprime = await factory.prisma.query('SELECT "id" FROM "ImportazioneLegacy" WHERE "id"=$1', [id]);
  expect(anteprime.rows).toHaveLength(0);
  const registro = await factory.prisma.query('SELECT "id" FROM "ImportazioneLegacyRiga" WHERE "origine"=$1', ["e2e-importer"]);
  expect(registro.rows).toHaveLength(5);
});
