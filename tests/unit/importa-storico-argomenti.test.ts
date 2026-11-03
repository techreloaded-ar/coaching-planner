import { describe, expect, it } from "vitest";
import { flagTrattenutiDaNpm, leggiArgomenti } from "../../scripts/importa-storico/argomenti";

const CONFIG_PREDEFINITA = "scripts/importa-storico/.env.importa-storico";

describe("leggiArgomenti dell'import storico", () => {
  it("senza argomenti esegue tutti i passi in modalità additiva", () => {
    expect(leggiArgomenti([], CONFIG_PREDEFINITA)).toEqual({
      passi: ["clienti", "offerte", "coach", "rimborsi", "giornate"],
      dryRun: false,
      reset: false,
      config: CONFIG_PREDEFINITA,
    });
  });

  it("legge i flag dalla riga di comando (bash/zsh: il `--` arriva a npm)", () => {
    const opzioni = leggiArgomenti(["giornate", "--reset", "--dry-run", "--config", "altro.env"], CONFIG_PREDEFINITA);
    expect(opzioni).toEqual({ passi: ["giornate"], dryRun: true, reset: true, config: "altro.env" });
  });

  it("accetta anche --config=<file>", () => {
    expect(leggiArgomenti(["--config=altro.env"], CONFIG_PREDEFINITA).config).toBe("altro.env");
  });

  it("recupera --reset e --dry-run trattenuti da npm come npm_config_* (PowerShell: il `--` viene consumato)", () => {
    const env = { npm_config_reset: "true", npm_config_dry_run: "true" };
    const opzioni = leggiArgomenti(["giornate"], CONFIG_PREDEFINITA, env);
    expect(opzioni).toEqual({ passi: ["giornate"], dryRun: true, reset: true, config: CONFIG_PREDEFINITA });
  });

  it("da PowerShell `--config altro.env` arriva come npm_config_config=true più il file tra i posizionali", () => {
    const env = { npm_config_config: "true" };
    expect(leggiArgomenti(["altro.env", "giornate"], CONFIG_PREDEFINITA, env)).toEqual({
      passi: ["giornate"],
      dryRun: false,
      reset: false,
      config: "altro.env",
    });
    expect(leggiArgomenti(["giornate", "altro.env"], CONFIG_PREDEFINITA, env).config).toBe("altro.env");
  });

  it("da PowerShell `--config=altro.env` arriva come npm_config_config=altro.env", () => {
    expect(leggiArgomenti([], CONFIG_PREDEFINITA, { npm_config_config: "altro.env" }).config).toBe("altro.env");
  });

  it("ignora le variabili npm_config_* non impostate a true o vuote", () => {
    expect(flagTrattenutiDaNpm({ npm_config_reset: "false", npm_config_dry_run: "", npm_config_config: "" })).toEqual([]);
    expect(flagTrattenutiDaNpm({})).toEqual([]);
  });

  it("rifiuta un argomento sconosciuto e un --config senza file", () => {
    expect(() => leggiArgomenti(["--azzera"], CONFIG_PREDEFINITA)).toThrow(/Argomento non riconosciuto: --azzera/);
    expect(() => leggiArgomenti(["--config"], CONFIG_PREDEFINITA)).toThrow(/--config richiede il percorso/);
    expect(() => leggiArgomenti(["--config", "--reset"], CONFIG_PREDEFINITA)).toThrow(/--config richiede il percorso/);
    expect(() => leggiArgomenti(["altro.env"], CONFIG_PREDEFINITA, { npm_config_config: "true" }).config).not.toThrow();
    expect(() => leggiArgomenti(["altro.env"], CONFIG_PREDEFINITA)).toThrow(/Argomento non riconosciuto: altro.env/);
  });
});
