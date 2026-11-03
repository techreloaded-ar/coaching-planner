// Passo GIORNATE: ogni riga del foglio diventa una RigaAttivita se collaboratore,
// cliente e offerta si abbinano, altrimenti una RigaAttivitaSospesa con il motivo
// (vedi docs/righe-attivita-sospese-approccio.md). L'import arriva sempre in fondo.
//
// Una riga attività non ha una chiave che la identifichi nel foglio, quindi senza --reset
// non si può fare un'aggiunta vera: le giornate con data precedente a GIORNATE_REIMPORTA_DAL
// restano congelate nel database (le righe del foglio di quel periodo si ignorano), quelle
// da quella data in poi vengono cancellate e reimportate dal foglio per intero.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { MotivoSospensione, Prisma } from "@/generated/prisma/client";
import { ORE_PER_GIORNATA } from "@/domain/types";
import {
  categoriaDaTipologia,
  cercaOfferta,
  leggiData,
  leggiNumero,
  normalizzaTesto,
  type OffertaAbbinabile,
} from "@/domain/righe-sospese/abbinamento";
import type { Configurazione } from "./configurazione";
import { cella, leggiScheda, richiediColonne } from "./foglio";
import { leggiSchedaCoach, mappaIdCoachEmail } from "./coach";

/** Limite della colonna ore: Decimal(4,2). */
const ORE_MASSIME_RAPPRESENTABILI = 99.99;
const ETICHETTA_RIMBORSO_GENERICA = "Spese dal foglio storico";

export interface EsitoGiornate {
  righeLette: number;
  /** Solo senza --reset: periodo cancellato dal database e reimportato dal foglio. */
  periodoReimportato?: { dal: string; righeAttivitaEliminate: number; righeSospeseEliminate: number };
  /** Righe del foglio con data precedente al periodo reimportato: lasciate com'erano nel database. */
  righeCongelate: number;
  importate: number;
  sospeseGiaPresenti: number;
  conOffertaDaDefinire: number;
  conOffertaDedotta: number;
  conOreDaiGiorni: number;
  conOreZero: number;
  conRimborso: number;
  abilitazioniCreate: number;
  righeDiClientiEsclusi: number;
  sospesePerMotivo: Record<MotivoSospensione, number>;
  reportSospese: string;
}

const FORMATO_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Senza --reset: cancella righe attività e righe sospese con data da `dal` (YYYY-MM-DD) in poi.
 * Le sospese conservano la data come testo: si cancellano solo quelle con data leggibile nel periodo,
 * le altre restano e il confronto per chiave evita di reinserirle.
 */
async function svuotaPeriodoDaReimportare(tx: Prisma.TransactionClient, dal: string): Promise<NonNullable<EsitoGiornate["periodoReimportato"]>> {
  const [anno, mese, giorno] = dal.split("-").map(Number);
  const righeAttivitaEliminate = (await tx.rigaAttivita.deleteMany({ where: { data: { gte: new Date(Date.UTC(anno, mese - 1, giorno)) } } })).count;
  const sospese = await tx.rigaAttivitaSospesa.findMany({ select: { id: true, data: true } });
  const idSospeseNelPeriodo = sospese.filter((s) => s.data && FORMATO_DATA_ISO.test(s.data) && s.data >= dal).map((s) => s.id);
  const righeSospeseEliminate = (await tx.rigaAttivitaSospesa.deleteMany({ where: { id: { in: idSospeseNelPeriodo } } })).count;
  return { dal, righeAttivitaEliminate, righeSospeseEliminate };
}

export async function importaGiornate(tx: Prisma.TransactionClient, cfg: Configurazione, opzioni: { reset: boolean }): Promise<EsitoGiornate> {
  const scheda = await leggiScheda(cfg, cfg.schede.giornate);
  richiediColonne(scheda, cfg.schede.giornate, ["Coach", "Data", "Cliente", "Codice Offerta", "Ore", "Tipologia Fatturazione"]);
  const idCoachEmail = mappaIdCoachEmail(await leggiSchedaCoach(cfg));

  const utenti = await tx.utente.findMany({ select: { email: true, collaboratore: { select: { id: true } } } });
  const collaboratorePerEmail = new Map(utenti.map((u) => [u.email.toLowerCase(), u.collaboratore?.id ?? null]));
  const clienti = await tx.cliente.findMany({ select: { id: true, ragioneSociale: true } });
  const idCliente = new Map(clienti.map((c) => [normalizzaTesto(c.ragioneSociale), c.id]));
  const nomeCliente = new Map(clienti.map((c) => [c.id, c.ragioneSociale]));
  const offerte: OffertaAbbinabile[] = await tx.offerta.findMany({ select: { id: true, codice: true, clienteId: true } });
  const offertePerCliente = new Map<string, OffertaAbbinabile[]>();
  for (const o of offerte) offertePerCliente.set(o.clienteId, [...(offertePerCliente.get(o.clienteId) ?? []), o]);
  const vociRimborso = await tx.voceRimborsoTrasferta.findMany({ select: { etichetta: true, importo: true } });
  const etichettaPerImporto = new Map(vociRimborso.map((v) => [Number(v.importo), v.etichetta]));

  // Con --reset il database è già vuoto: entra ogni riga del foglio. Senza --reset si svuota il
  // periodo da reimportare e nel foglio si considerano solo le righe di quel periodo.
  const periodoReimportato = opzioni.reset ? undefined : await svuotaPeriodoDaReimportare(tx, cfg.giornateReimportaDal);
  const congelata = (data: string | null) => periodoReimportato !== undefined && data !== null && data < periodoReimportato.dal;

  const esito: EsitoGiornate = {
    righeLette: 0, periodoReimportato, righeCongelate: 0, importate: 0, sospeseGiaPresenti: 0, conOffertaDaDefinire: 0, conOffertaDedotta: 0,
    conOreDaiGiorni: 0, conOreZero: 0, conRimborso: 0, abilitazioniCreate: 0, righeDiClientiEsclusi: 0,
    sospesePerMotivo: { COLLABORATORE_SCONOSCIUTO: 0, CLIENTE_SCONOSCIUTO: 0, OFFERTA_SCONOSCIUTA: 0, OFFERTA_ALTRO_CLIENTE: 0, DATI_NON_VALIDI: 0 },
    reportSospese: path.join(cfg.cartellaLavoro, "righe-sospese.csv"),
  };
  const righe: Prisma.RigaAttivitaCreateManyInput[] = [];
  const sospese: Prisma.RigaAttivitaSospesaCreateManyInput[] = [];
  const abilitazioni = new Set<string>();
  // Le righe sospese si confrontano con quelle rimaste nel database (senza data leggibile o fuori
  // periodo), così non si reinseriscono due volte. Le righe attività non hanno una chiave: nel
  // periodo reimportato entrano tutte, anche se ripetute nel foglio.
  const chiaveSospesa = (s: Pick<Prisma.RigaAttivitaSospesaCreateManyInput, "collaboratore" | "data" | "cliente" | "codiceOfferta" | "ore" | "tipologiaFatturazione">) =>
    [s.collaboratore, s.data, s.cliente, s.codiceOfferta, s.ore, s.tipologiaFatturazione].map(normalizzaTesto).join("|");
  const sospesePresenti = new Set((await tx.rigaAttivitaSospesa.findMany()).map(chiaveSospesa));

  for (const riga of scheda.righe) {
    const grezzi = {
      collaboratore: cella(riga, "Coach"), data: cella(riga, "Data"), cliente: cella(riga, "Cliente"),
      codiceOfferta: cella(riga, "Codice Offerta"), ore: cella(riga, "Ore"), tipologiaFatturazione: cella(riga, "Tipologia Fatturazione"),
    };
    if (!Object.values(grezzi).some(Boolean)) continue;
    esito.righeLette++;
    const data = leggiData(grezzi.data);
    if (congelata(data)) { esito.righeCongelate++; continue; }
    const sospendi = (motivo: MotivoSospensione, nota: string) => {
      const sospesa = { ...grezzi, data: data ?? grezzi.data, motivo, nota };
      if (sospesePresenti.has(chiaveSospesa(sospesa))) { esito.sospeseGiaPresenti++; return; }
      esito.sospesePerMotivo[motivo]++;
      sospese.push(sospesa);
    };

    const clienteNormalizzato = normalizzaTesto(grezzi.cliente);
    if (cfg.clientiEsclusi.has(clienteNormalizzato)) { esito.righeDiClientiEsclusi++; continue; }

    const emailCoach = idCoachEmail.get(normalizzaTesto(grezzi.collaboratore));
    const collaboratoreId = emailCoach ? collaboratorePerEmail.get(emailCoach) : undefined;
    if (!collaboratoreId) {
      sospendi("COLLABORATORE_SCONOSCIUTO", !emailCoach ? "ID coach assente nella scheda coach" : collaboratoreId === null ? `Utente ${emailCoach} senza profilo collaboratore` : `Utente ${emailCoach} non censito`);
      continue;
    }
    const clienteId = idCliente.get(clienteNormalizzato);
    if (!clienteId) { sospendi("CLIENTE_SCONOSCIUTO", "Cliente assente in anagrafica"); continue; }

    const ricerca = cercaOfferta(grezzi.codiceOfferta, offertePerCliente.get(clienteId) ?? [], offerte, nomeCliente);
    if ("motivo" in ricerca) { sospendi(ricerca.motivo, ricerca.nota); continue; }

    if (!data) { sospendi("DATI_NON_VALIDI", `Data non leggibile: "${grezzi.data}"`); continue; }
    const categoria = categoriaDaTipologia(grezzi.tipologiaFatturazione, clienteNormalizzato === cfg.clienteInterno);
    if (!categoria) { sospendi("DATI_NON_VALIDI", `Tipologia di fatturazione sconosciuta: "${grezzi.tipologiaFatturazione}"`); continue; }
    const note: string[] = [];
    let ore = leggiNumero(grezzi.ore);
    if (grezzi.ore && ore === null) { sospendi("DATI_NON_VALIDI", `Ore non numeriche: "${grezzi.ore}"`); continue; }
    if (ore === null) {
      const giorni = leggiNumero(cella(riga, "Giorni Fatturati verso Cliente"));
      if (giorni && giorni > 0) { ore = giorni * ORE_PER_GIORNATA; note.push(`Ore ricavate dai giorni fatturati (${giorni})`); esito.conOreDaiGiorni++; }
      else { ore = 0; note.push("Ore non indicate nel foglio originale"); esito.conOreZero++; }
    } else if (ore === 0) { note.push("Ore pari a zero nel foglio originale"); esito.conOreZero++; }
    ore = Math.round(ore * 100) / 100;
    if (ore < 0 || ore > ORE_MASSIME_RAPPRESENTABILI) { sospendi("DATI_NON_VALIDI", `Ore fuori intervallo: ${grezzi.ore}`); continue; }

    const tipologiaNormalizzata = normalizzaTesto(grezzi.tipologiaFatturazione);
    if (!tipologiaNormalizzata) note.push("Tipologia non indicata nel foglio originale");
    else if (!["FATTURABILE", "NON FATTURABILE", "INVESTIMENTO"].includes(tipologiaNormalizzata)) note.push(`Tipologia nel foglio originale: ${grezzi.tipologiaFatturazione}`);
    if (ricerca.offerta === null) esito.conOffertaDaDefinire++;
    else if (ricerca.dedotta) { note.push(`Offerta dedotta: ${ricerca.dedotta}`); esito.conOffertaDedotta++; }

    const spese = leggiNumero(cella(riga, "Spese Coach"));
    const rimborso = spese && spese > 0 ? { rimborsoTrasfertaImporto: spese.toFixed(2), rimborsoTrasfertaEtichetta: etichettaPerImporto.get(spese) ?? ETICHETTA_RIMBORSO_GENERICA } : {};
    if (spese && spese > 0) esito.conRimborso++;

    if (ricerca.offerta) abilitazioni.add(`${collaboratoreId}|${ricerca.offerta.id}`);

    const [anno, mese, giorno] = data.split("-").map(Number);
    righe.push({
      collaboratoreId, clienteId, offertaId: ricerca.offerta?.id ?? null,
      data: new Date(Date.UTC(anno, mese - 1, giorno, 12)),
      ore: ore.toFixed(2), categoria, nota: note.length ? note.join(". ") : null, ...rimborso,
    });
    esito.importate++;
  }

  // Un foglio senza giornate nel periodo (scheda sbagliata, export parziale) non deve svuotare il
  // database di quell'anno: la transazione viene annullata.
  if (periodoReimportato && periodoReimportato.righeAttivitaEliminate > 0 && righe.length === 0 && sospese.length === 0) {
    throw new Error(
      `Il foglio non ha giornate dal ${periodoReimportato.dal}, ma il database ne ha ${periodoReimportato.righeAttivitaEliminate}: ` +
        "mi fermo senza cancellarle. Controlla la scheda GIORNATE o GIORNATE_REIMPORTA_DAL.",
    );
  }

  const DIMENSIONE_BLOCCO = 1000;
  for (let i = 0; i < righe.length; i += DIMENSIONE_BLOCCO) await tx.rigaAttivita.createMany({ data: righe.slice(i, i + DIMENSIONE_BLOCCO) });
  for (let i = 0; i < sospese.length; i += DIMENSIONE_BLOCCO) await tx.rigaAttivitaSospesa.createMany({ data: sospese.slice(i, i + DIMENSIONE_BLOCCO) });
  const datiAbilitazioni = [...abilitazioni].map((chiave) => { const [collaboratoreId, offertaId] = chiave.split("|"); return { collaboratoreId, offertaId }; });
  esito.abilitazioniCreate = (await tx.abilitazioneOfferta.createMany({ data: datiAbilitazioni, skipDuplicates: true })).count;

  mkdirSync(cfg.cartellaLavoro, { recursive: true });
  const csv = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  writeFileSync(esito.reportSospese, [
    "motivo;coach;data;cliente;codice offerta;ore;tipologia;nota",
    ...sospese.map((s) => [s.motivo, s.collaboratore, s.data, s.cliente, s.codiceOfferta, s.ore, s.tipologiaFatturazione, s.nota].map(csv).join(";")),
  ].join("\n") + "\n");
  return esito;
}
