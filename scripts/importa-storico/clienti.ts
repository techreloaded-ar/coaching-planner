// Passo CLIENTI: ragione sociale dalla colonna "Cliente"; i dati di fatturazione
// sono testo libero compilato a mano, quindi li estrae Claude Code (CLI, senza
// tool) e poi li convalida validaCliente: ciò che non passa finisce nelle note.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Prisma } from "@/generated/prisma/client";
import { validaCliente } from "@/domain/anagrafiche/valida-cliente";
import { normalizzaTesto } from "@/domain/righe-sospese/abbinamento";
import type { Configurazione } from "./configurazione";
import { cella, leggiScheda, richiediColonne, type RigaFoglio } from "./foglio";

const COLONNE_DETTAGLIO = ["Intestazione Fattura", "Indirizzo Fatturazione", "Partita Iva", "Modalità invio fattura", "Persona di riferimento"];

interface ClienteInferito {
  cliente: string;
  partitaIva: string;
  codiceFiscale: string;
  indirizzo: string;
  citta: string;
  cap: string;
  provincia: string;
  pec: string;
  codiceDestinatario: string;
  personaRiferimento: string;
  note: string;
}

const CAMPI_INFERITI = ["cliente", "partitaIva", "codiceFiscale", "indirizzo", "citta", "cap", "provincia", "pec", "codiceDestinatario", "personaRiferimento", "note"] as const;

const SCHEMA_RISPOSTA = {
  type: "object",
  properties: {
    clienti: {
      type: "array",
      items: {
        type: "object",
        properties: Object.fromEntries(
          CAMPI_INFERITI.map((k) => [k, { type: "string" }]),
        ),
        required: [...CAMPI_INFERITI],
        additionalProperties: false,
      },
    },
  },
  required: ["clienti"],
  additionalProperties: false,
};

const ISTRUZIONI = `Sei un assistente amministrativo italiano. Ricevi righe di un foglio clienti compilato a mano:
per ogni cliente le celle "intestazioneFattura", "indirizzoFatturazione", "partitaIva", "modalitaInvioFattura",
"personaDiRiferimento" contengono testo libero, spesso con più informazioni nella stessa cella o nella cella sbagliata.
Estrai i dati di fatturazione e restituisci SOLO il JSON richiesto, un elemento per ogni cliente in ingresso,
con "cliente" identico al valore ricevuto. Regole:
- partitaIva: 11 cifre. Togli il prefisso IT, togli ".0" finale, ripristina lo zero iniziale se le cifre sono 10.
- codiceFiscale: solo se indicato esplicitamente come codice fiscale (11 cifre o 16 alfanumerici maiuscoli).
- indirizzo: via/piazza e civico. citta: solo il nome. cap: 5 cifre. provincia: sigla di 2 lettere maiuscole;
  se non è scritta ma la città è un capoluogo italiano noto, ricavala.
- pec: un indirizzo email di posta certificata o comunque l'email indicata per l'invio delle fatture.
- codiceDestinatario: codice SDI / codice univoco di 7 caratteri alfanumerici, maiuscolo.
- personaRiferimento: nome della persona di riferimento con i suoi contatti (email, telefono), in una riga.
- note: tutto ciò che non trova posto nei campi: intestazione della fattura se diversa dal nome cliente
  (es. "Intestazione fattura: Poliedra SPA"), email non PEC, indicazioni su stato estero, dubbi o
  incongruenze. Vuoto se non c'è nulla.
- Non inventare dati: campo vuoto se l'informazione manca.`;

export interface EsitoClienti {
  inseriti: number;
  conDatiFatturazione: number;
  esclusi: string[];
  duplicati: string[];
  /** cliente → campi scartati dalla validazione, finiti nelle note */
  campiScartati: Record<string, string[]>;
}

export interface ClientiPreparati {
  righe: { ragioneSociale: string; dati: Partial<ClienteInferito> }[];
  esito: Omit<EsitoClienti, "inseriti">;
}

/** Legge la scheda e interroga Claude: nessun accesso al database. */
export async function preparaClienti(cfg: Configurazione): Promise<ClientiPreparati> {
  const scheda = await leggiScheda(cfg, cfg.schede.clienti);
  richiediColonne(scheda, cfg.schede.clienti, ["Cliente"]);

  const visti = new Set<string>();
  const esito: ClientiPreparati["esito"] = { conDatiFatturazione: 0, esclusi: [], duplicati: [], campiScartati: {} };
  const daInferire: RigaFoglio[] = [];
  const righe: ClientiPreparati["righe"] = [];
  for (const riga of scheda.righe) {
    const ragioneSociale = cella(riga, "Cliente").replace(/\s+/g, " ");
    if (!ragioneSociale) continue;
    const chiave = normalizzaTesto(ragioneSociale);
    if (cfg.clientiEsclusi.has(chiave)) { esito.esclusi.push(ragioneSociale); continue; }
    if (visti.has(chiave)) { esito.duplicati.push(ragioneSociale); continue; }
    visti.add(chiave);
    righe.push({ ragioneSociale, dati: {} });
    if (COLONNE_DETTAGLIO.some((c) => cella(riga, c))) daInferire.push(riga);
  }

  const inferiti = inferisciConClaude(daInferire, cfg);
  for (const r of righe) {
    const inferito = inferiti.get(normalizzaTesto(r.ragioneSociale));
    if (!inferito) continue;
    esito.conDatiFatturazione++;
    const { dati, scartati } = convalida(r.ragioneSociale, inferito);
    r.dati = dati;
    if (scartati.length) esito.campiScartati[r.ragioneSociale] = scartati;
  }
  return { righe, esito };
}

/** Campi non validi per l'applicazione: rimossi e riportati nelle note, così nulla va perso. */
function convalida(ragioneSociale: string, inferito: ClienteInferito): { dati: Partial<ClienteInferito>; scartati: string[] } {
  const dati: Partial<ClienteInferito> = {};
  for (const campo of ["partitaIva", "codiceFiscale", "indirizzo", "citta", "cap", "provincia", "pec", "codiceDestinatario", "personaRiferimento"] as const) {
    const valore = (inferito[campo] ?? "").trim();
    if (valore) dati[campo] = campo === "provincia" || campo === "codiceDestinatario" || campo === "codiceFiscale" ? valore.toUpperCase() : valore;
  }
  const errori = validaCliente({ ragioneSociale, ...dati });
  const note = [(inferito.note ?? "").trim()].filter(Boolean);
  const scartati: string[] = [];
  for (const campo of Object.keys(errori) as (keyof typeof dati)[]) {
    if (!(campo in dati)) continue;
    note.push(`${campo} non valido, da verificare: ${dati[campo]} (${errori[campo]})`);
    scartati.push(`${campo}=${dati[campo]}`);
    delete dati[campo];
  }
  if (note.length) dati.note = note.join("\n");
  return { dati, scartati };
}

function inferisciConClaude(righe: RigaFoglio[], cfg: Configurazione): Map<string, ClienteInferito> {
  const risultato = new Map<string, ClienteInferito>();
  if (righe.length === 0) return risultato;
  mkdirSync(cfg.cartellaLavoro, { recursive: true });
  const percorsoCache = path.join(cfg.cartellaLavoro, "clienti-inferiti.json");
  const cache: Record<string, ClienteInferito> = existsSync(percorsoCache) ? JSON.parse(readFileSync(percorsoCache, "utf8")) : {};

  const inIngresso = righe.map((riga) => ({
    cliente: cella(riga, "Cliente").replace(/\s+/g, " "),
    intestazioneFattura: cella(riga, "Intestazione Fattura"),
    indirizzoFatturazione: cella(riga, "Indirizzo Fatturazione"),
    partitaIva: cella(riga, "Partita Iva"),
    modalitaInvioFattura: cella(riga, "Modalità invio fattura"),
    personaDiRiferimento: cella(riga, "Persona di riferimento"),
  }));
  const impronta = (voce: (typeof inIngresso)[number]) => createHash("sha256").update(JSON.stringify(voce)).digest("hex");

  const daChiedere = inIngresso.filter((voce) => !cache[impronta(voce)]);
  for (let i = 0; i < daChiedere.length; i += cfg.claude.dimensioneLotto) {
    const lotto = daChiedere.slice(i, i + cfg.claude.dimensioneLotto);
    console.log(`  Claude: estrazione dati di ${lotto.length} clienti (${i + lotto.length}/${daChiedere.length})…`);
    const risposta = chiediAClaude(lotto, cfg);
    for (const voce of lotto) {
      const estratto = risposta.find((c) => normalizzaTesto(c.cliente) === normalizzaTesto(voce.cliente));
      if (!estratto) throw new Error(`Claude non ha restituito il cliente "${voce.cliente}": rilancia l'import`);
      cache[impronta(voce)] = estratto;
    }
    writeFileSync(percorsoCache, JSON.stringify(cache, null, 1));
  }
  for (const voce of inIngresso) risultato.set(normalizzaTesto(voce.cliente), cache[impronta(voce)]);
  return risultato;
}

function chiediAClaude(lotto: object[], cfg: Configurazione): ClienteInferito[] {
  const argomenti = [
    "-p", "--output-format", "json", "--json-schema", JSON.stringify(SCHEMA_RISPOSTA),
    "--tools", "", "--system-prompt", ISTRUZIONI,
    ...(cfg.claude.modello ? ["--model", cfg.claude.modello] : []),
  ];
  const processo = spawnSync(cfg.claude.comando, argomenti, {
    input: `Righe del foglio clienti:\n${JSON.stringify(lotto, null, 1)}`,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (processo.error) throw new Error(`Impossibile eseguire "${cfg.claude.comando}": ${processo.error.message}`);
  let esito: { is_error?: boolean; result?: string; structured_output?: { clienti: ClienteInferito[] } };
  try {
    esito = JSON.parse(processo.stdout);
  } catch {
    throw new Error(`Risposta di Claude non leggibile (exit ${processo.status}):\n${processo.stderr || processo.stdout}`);
  }
  if (esito.is_error) throw new Error(`Claude ha risposto con un errore: ${esito.result}`);
  const clienti = esito.structured_output?.clienti ?? (JSON.parse(esito.result ?? "{}") as { clienti?: ClienteInferito[] }).clienti;
  if (!Array.isArray(clienti)) throw new Error(`Claude non ha prodotto l'elenco clienti atteso: ${esito.result}`);
  return clienti;
}

export async function scriviClienti(tx: Prisma.TransactionClient, preparati: ClientiPreparati): Promise<EsitoClienti> {
  await tx.cliente.createMany({
    data: preparati.righe.map(({ ragioneSociale, dati }) => ({
      ragioneSociale,
      partitaIva: dati.partitaIva ?? null,
      codiceFiscale: dati.codiceFiscale ?? null,
      indirizzo: dati.indirizzo ?? null,
      citta: dati.citta ?? null,
      cap: dati.cap ?? null,
      provincia: dati.provincia ?? null,
      pec: dati.pec ?? null,
      codiceDestinatario: dati.codiceDestinatario ?? null,
      personaRiferimento: dati.personaRiferimento ?? null,
      note: dati.note ?? null,
    })),
  });
  return { inseriti: preparati.righe.length, ...preparati.esito };
}
