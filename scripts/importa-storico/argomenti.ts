/**
 * Lettura degli argomenti della riga di comando dell'import storico.
 *
 * Lo script si lancia con `npm run db:importa-storico -- [passo] [--dry-run] [--reset] [--config <file>]`.
 * Da bash e zsh il separatore `--` arriva a npm, che passa i flag allo script così come sono.
 * Da PowerShell invece la shell consuma il `--` e npm interpreta `--reset`, `--dry-run` e
 * `--config` come proprie opzioni: non li passa allo script ma li espone come variabili
 * d'ambiente `npm_config_reset`, `npm_config_dry_run`, `npm_config_config`. Gli argomenti
 * posizionali (`giornate`, `tutto`, ma anche il file che segue `--config`) arrivano in
 * entrambi i casi.
 *
 * Qui si leggono entrambe le fonti, così lo stesso comando documentato funziona ovunque.
 */

export const PASSI_IMPORT = ["clienti", "offerte", "coach", "rimborsi", "giornate"] as const;
export type PassoImport = (typeof PASSI_IMPORT)[number];

export type OpzioniImport = {
  passi: PassoImport[];
  dryRun: boolean;
  reset: boolean;
  config: string;
};

/** Sottoinsieme di process.env che interessa qui; un oggetto vuoto va bene (niente NODE_ENV obbligatorio). */
export type VariabiliAmbiente = Readonly<Record<string, string | undefined>>;

export const USO = `Uso: [tutto|${PASSI_IMPORT.join("|")}] [--dry-run] [--reset] [--config <file>]`;

/**
 * Ricostruisce i flag che npm ha trattenuto come proprie opzioni (caso PowerShell senza `--`).
 * `--config <file>` diventa `npm_config_config=true` e il file resta tra i posizionali:
 * si restituisce il solo `--config`, il parser lo abbina al primo posizionale non riconosciuto.
 * `--config=<file>` diventa invece `npm_config_config=<file>`.
 */
export function flagTrattenutiDaNpm(env: VariabiliAmbiente): string[] {
  const flag: string[] = [];
  if (env.npm_config_reset === "true") flag.push("--reset");
  if (env.npm_config_dry_run === "true") flag.push("--dry-run");
  const config = env.npm_config_config;
  if (config === "true") flag.push("--config");
  else if (config) flag.push(`--config=${config}`);
  return flag;
}

export function leggiArgomenti(argv: readonly string[], configPredefinita: string, env: VariabiliAmbiente = {}): OpzioniImport {
  const opzioni: OpzioniImport = { passi: [...PASSI_IMPORT], dryRun: false, reset: false, config: configPredefinita };
  const argomenti = [...flagTrattenutiDaNpm(env), ...argv];
  let fileConfigInAttesa = false;

  for (const a of argomenti) {
    if (a === "--dry-run") opzioni.dryRun = true;
    else if (a === "--reset") opzioni.reset = true;
    else if (a === "--config") fileConfigInAttesa = true;
    else if (a.startsWith("--config=")) opzioni.config = a.slice("--config=".length);
    else if (a === "tutto") opzioni.passi = [...PASSI_IMPORT];
    else if ((PASSI_IMPORT as readonly string[]).includes(a)) opzioni.passi = [a as PassoImport];
    else if (fileConfigInAttesa && !a.startsWith("--")) {
      opzioni.config = a;
      fileConfigInAttesa = false;
    } else throw new Error(`Argomento non riconosciuto: ${a}\n${USO}`);
  }

  if (fileConfigInAttesa) throw new Error(`--config richiede il percorso di un file\n${USO}`);
  if (!opzioni.config) throw new Error(`--config richiede il percorso di un file\n${USO}`);
  return opzioni;
}
