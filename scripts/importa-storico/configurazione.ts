// Configurazione dello script: un file di variabili dedicato, mai .env/.env.local
// dell'applicazione, così la connection string del database storico è esplicita.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { normalizzaTesto } from "@/domain/righe-sospese/abbinamento";

export interface Configurazione {
  databaseUrl: string;
  /** Link Google Sheets, oppure percorso di un file .xlsx */
  origineFoglio: string;
  /** Chiave JSON di un service account Google con cui è condiviso il foglio; vuoto = foglio pubblico */
  fileServiceAccountGoogle: string;
  schede: { clienti: string; offerte: string; coach: string; giornate: string };
  /** Nomi cliente (normalizzati) da ignorare in ogni scheda */
  clientiEsclusi: Set<string>;
  /** Cliente interno: le sue ore senza tipologia non si fatturano */
  clienteInterno: string;
  /** Email (minuscole) degli utenti da censire come amministratori */
  emailAmministratori: Set<string>;
  importoTrasfertaForfettariaPredefinito: number;
  primoMeseTariffa: string;
  /** Voci di rimborso trasferta da garantire prima delle giornate */
  vociRimborsoTrasferta: { etichetta: string; importo: number }[];
  claude: { comando: string; modello: string; dimensioneLotto: number };
  /** Cartella per cache dell'inferenza e report */
  cartellaLavoro: string;
}

function leggiOrigineFoglio(valore: string): string {
  if (/docs\.google\.com\/spreadsheets/.test(valore)) return valore;
  const percorso = path.resolve(valore);
  if (!existsSync(percorso)) throw new Error(`FOGLIO_ORIGINE non è un link Google Sheets e il file non esiste: ${percorso}`);
  return percorso;
}

export const PERCORSO_CONFIGURAZIONE_PREDEFINITO = "scripts/importa-storico/.env.importa-storico";

export function caricaConfigurazione(percorsoFile: string): Configurazione {
  let variabili: Record<string, string>;
  try {
    variabili = parseEnv(readFileSync(percorsoFile, "utf8")) as Record<string, string>;
  } catch {
    throw new Error(
      `File di configurazione non trovato: ${percorsoFile}\n` +
        `  Copia scripts/importa-storico/.env.importa-storico.example in ${PERCORSO_CONFIGURAZIONE_PREDEFINITO} e compilalo.`,
    );
  }
  const leggi = (nome: string, predefinito?: string): string => {
    const valore = (variabili[nome] ?? "").trim();
    if (valore) return valore;
    if (predefinito !== undefined) return predefinito;
    throw new Error(`Variabile ${nome} mancante in ${percorsoFile}`);
  };
  const leggiNumero = (nome: string, predefinito: string): number => {
    const numero = Number(leggi(nome, predefinito).replace(",", "."));
    if (!(numero >= 0)) throw new Error(`Variabile ${nome} non numerica in ${percorsoFile}`);
    return numero;
  };
  const elenco = (nome: string, predefinito: string, separatore = ",") =>
    leggi(nome, predefinito).split(separatore).map((v) => v.trim()).filter(Boolean);

  const primoMeseTariffa = leggi("PRIMO_MESE_TARIFFA", "2018-01");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(primoMeseTariffa)) throw new Error("PRIMO_MESE_TARIFFA deve essere nel formato YYYY-MM");

  // "Fino a 100 km = 75; Eventi = 100": etichetta e importo separati da "=", voci separate da ";"
  const vociRimborsoTrasferta = elenco("VOCI_RIMBORSO_TRASFERTA", "", ";").map((voce) => {
    const [etichetta, importoGrezzo, ...resto] = voce.split("=").map((v) => v.trim());
    const importo = Number((importoGrezzo ?? "").replace(/€/g, "").replace(",", "."));
    if (!etichetta || resto.length || !(importo > 0)) throw new Error(`VOCI_RIMBORSO_TRASFERTA: voce non valida "${voce}" (atteso "etichetta = importo")`);
    return { etichetta, importo };
  });

  return {
    databaseUrl: leggi("DATABASE_URL"),
    vociRimborsoTrasferta,
    origineFoglio: leggiOrigineFoglio(leggi("FOGLIO_ORIGINE")),
    fileServiceAccountGoogle: leggi("GOOGLE_SERVICE_ACCOUNT_FILE", ""),
    schede: {
      clienti: leggi("SCHEDA_CLIENTI", "CLIENTI"),
      offerte: leggi("SCHEDA_OFFERTE", "OFFERTE"),
      coach: leggi("SCHEDA_COACH", "COACH"),
      giornate: leggi("SCHEDA_GIORNATE", "GIORNATE"),
    },
    clientiEsclusi: new Set(elenco("CLIENTI_ESCLUSI", "ND").map(normalizzaTesto)),
    clienteInterno: normalizzaTesto(leggi("CLIENTE_INTERNO", "AGILERELOADED")),
    emailAmministratori: new Set(elenco("EMAIL_AMMINISTRATORI", "").map((e) => e.toLowerCase())),
    importoTrasfertaForfettariaPredefinito: leggiNumero("IMPORTO_TRASFERTA_FORFETTARIA_PREDEFINITO", "220"),
    primoMeseTariffa,
    claude: {
      comando: leggi("CLAUDE_COMANDO", "claude"),
      modello: leggi("CLAUDE_MODELLO", ""),
      dimensioneLotto: Math.max(1, leggiNumero("CLAUDE_DIMENSIONE_LOTTO", "20")),
    },
    cartellaLavoro: path.resolve(leggi("CARTELLA_LAVORO", "scripts/importa-storico/lavoro")),
  };
}
