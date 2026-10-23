#!/usr/bin/env python3
"""T4 · gate G1/G2: i test AGGIUNTI dalla consegna intercettano il difetto.

Uso (dal banco, mai dagli agenti di sviluppo):
  python3 gate_test_regressione.py --consegna <copia-immutabile> --base <commit-baseline-difettosa> \
      --uscita <cartella> [--database-url postgresql://...]

Contratto JSON (stampato su stdout e scritto in <uscita>/gate-test-regressione.json):
  {
    "controllo": "T4-gate-test-regressione",
    "esito": "ok" | "incerto",            # incerto = difetto non localizzabile o consegna non eseguibile
    "motivo": str | null,
    "G1": {"ok": bool, "casi": [str]},    # casi nuovi: passano sulla consegna e sulla baseline neutralizzata, falliscono sulla difettosa
    "G2": {"ok": bool, "solo_riepilogo": [str], "solo_avanzamento": [str]},
    "file_test_considerati": [str], "file_e2e_non_considerati": [str],
    "difetto_localizzato": {"calcolaRiepilogoMese": int, "calcolaAvanzamentoOfferte": int},
    "varianti": {nome: {"passati": [str], "falliti": [str], "errori_file": [str]}},
    "informativo": {"falliscono_sulla_difettosa_per_qualsiasi_motivo": [str]}
  }
Codice di uscita: 0 se il JSON è stato prodotto (anche con G1/G2 false), 2 se `esito` è "incerto".

Metodo (riproducibile, nessuna rete):
  1. File di test aggiunti/modificati dalla consegna tra --base e HEAD: `*.test.ts`/`*.test.tsx` fuori da
     tests/e2e e __oracolo__ (Playwright non è eseguito qui: richiederebbe un server). Anche i file
     di supporto aggiunti sotto tests/unit vengono copiati.
  2. Quattro varianti della baseline difettosa in worktree temporanei:
       difettosa         = --base così com'è
       neutralizzata     = troncamento rimosso in calcolaRiepilogoMese e calcolaAvanzamentoOfferte
       solo-riepilogo    = troncamento rimosso solo in calcolaAvanzamentoOfferte
       solo-avanzamento  = troncamento rimosso solo in calcolaRiepilogoMese
     La neutralizzazione riscrive `Math.floor((X) * 100) / 100` in `(X)` solo dentro il corpo della
     funzione indicata di src/domain/consuntivi/index.ts.
  3. Casi preesistenti (stesso file e nome nella versione --base) esclusi: contano solo i casi nuovi.
  4. Ogni variante (e un worktree di HEAD della consegna) esegue i file della consegna con la stessa
     configurazione Vitest generata (alias `@/`, mock `server-only`, TZ=UTC). Un file che non si
     carica non produce casi; la copia immutabile della consegna non viene modificata.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

FILE_DOMINIO = "src/domain/consuntivi/index.ts"
FUNZIONI = ("calcolaRiepilogoMese", "calcolaAvanzamentoOfferte")
TRONCAMENTO = re.compile(
    r"Math\.floor\(\s*(\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)|[\w.$\[\]]+(?:\s*/\s*[\w.$\[\]]+)?)\s*\*\s*100\s*\)\s*/\s*100(?:\.0+)?"
)

CONFIG_VITEST = """import path from "node:path";
import {{ loadEnvConfig }} from "@next/env";
import {{ defineConfig }} from "vitest/config";

loadEnvConfig(process.cwd());
process.env.TZ = "UTC";

export default defineConfig({{
\ttest: {{ globals: true, environment: "node", include: {include}, env: {{ TZ: "UTC" }} }},
\tresolve: {{
\t\talias: {{
\t\t\t"@": path.resolve(__dirname, "./src"),
\t\t\t"server-only": path.resolve(__dirname, "./tests/unit/__mocks__/server-only.ts"),
\t\t}},
\t}},
}});
"""


def git(repo, *argomenti):
    return subprocess.run(["git", "-C", str(repo), *argomenti], check=True, text=True, capture_output=True).stdout.strip()


def corpo_funzione(sorgente, nome):
    inizio = sorgente.find(f"export function {nome}(")
    if inizio < 0:
        return None
    successivo = sorgente.find("\nexport ", inizio + 1)
    return inizio, (successivo if successivo >= 0 else len(sorgente))


def neutralizza(sorgente, funzioni):
    conteggi = {}
    for nome in funzioni:
        intervallo = corpo_funzione(sorgente, nome)
        if not intervallo:
            conteggi[nome] = 0
            continue
        inizio, fine = intervallo
        corpo, quanti = TRONCAMENTO.subn(lambda m: m.group(1), sorgente[inizio:fine])
        conteggi[nome] = quanti
        sorgente = sorgente[:inizio] + corpo + sorgente[fine:]
    return sorgente, conteggi


def file_della_consegna(consegna, base):
    nomi = git(consegna, "diff", "--name-only", "--diff-filter=AM", base, "HEAD").splitlines()
    test_unit, e2e, supporto = [], [], []
    for nome in nomi:
        if nome.startswith("__oracolo__/"):
            continue
        if nome.startswith("tests/e2e/"):
            if nome.endswith(".spec.ts"):
                e2e.append(nome)
            continue
        if re.search(r"\.test\.tsx?$", nome):
            test_unit.append(nome)
        elif nome.startswith("tests/unit/"):
            supporto.append(nome)
    return test_unit, e2e, supporto


def esegui_vitest(cartella, file_test, nome_report, env):
    config = cartella / "vitest.gate-regressione.config.ts"
    config.write_text(CONFIG_VITEST.format(include=json.dumps(file_test)))
    report = cartella / nome_report
    report.unlink(missing_ok=True)
    subprocess.run(["npx", "vitest", "run", "--config", config.name, "--reporter=json", f"--outputFile={report.name}"],
                   cwd=cartella, text=True, capture_output=True, env=env, timeout=1800)
    config.unlink(missing_ok=True)
    passati, falliti, errori_file = set(), set(), []
    if report.exists():
        dati = json.loads(report.read_text())
        for file in dati.get("testResults", []):
            relativo = os.path.relpath(Path(file.get("name", "")).resolve(), cartella.resolve())
            risultati = file.get("assertionResults", [])
            if not risultati and file.get("status") == "failed":
                errori_file.append(f"{relativo}: {(file.get('message') or '')[:300]}")
            for caso in risultati:
                chiave = f"{relativo} > {caso.get('fullName') or caso.get('title')}"
                (passati if caso.get("status") == "passed" else falliti if caso.get("status") == "failed" else set()).add(chiave)
    else:
        errori_file.append("vitest non ha prodotto il report JSON")
    return passati, falliti, errori_file


def prepara_variante(consegna, base, radice, nome, funzioni_da_neutralizzare):
    cartella = radice / nome
    git(consegna, "worktree", "add", "--detach", "--force", str(cartella), base)
    (cartella / "node_modules").symlink_to(consegna / "node_modules")
    conteggi = {}
    if funzioni_da_neutralizzare:
        percorso = cartella / FILE_DOMINIO
        testo, conteggi = neutralizza(percorso.read_text(), funzioni_da_neutralizzare)
        percorso.write_text(testo)
    subprocess.run(["npx", "prisma", "generate"], cwd=cartella, text=True, capture_output=True, check=True)
    return cartella, conteggi


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--consegna", required=True, type=Path)
    parser.add_argument("--base", required=True, help="commit della baseline difettosa (punto di partenza di T4)")
    parser.add_argument("--uscita", required=True, type=Path)
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""))
    opzioni = parser.parse_args()
    consegna = opzioni.consegna.resolve()
    opzioni.uscita.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "TZ": "UTC"}
    if opzioni.database_url:
        env["DATABASE_URL"] = opzioni.database_url

    test_unit, e2e, supporto = file_della_consegna(consegna, opzioni.base)
    risultato = {
        "controllo": "T4-gate-test-regressione", "esito": "ok", "motivo": None,
        "G1": {"ok": False, "casi": []}, "G2": {"ok": False, "solo_riepilogo": [], "solo_avanzamento": []},
        "file_test_considerati": test_unit, "file_e2e_non_considerati": e2e,
        "difetto_localizzato": {}, "varianti": {}, "informativo": {},
    }
    radice = Path(tempfile.mkdtemp(prefix="oracolo-t4-gate-"))
    varianti, varianti_consegna = {}, {}
    try:
        if not test_unit:
            risultato["motivo"] = "la consegna non aggiunge né modifica test Vitest"
        else:
            piani = {
                "difettosa": (),
                "neutralizzata": FUNZIONI,
                "solo-riepilogo": ("calcolaAvanzamentoOfferte",),
                "solo-avanzamento": ("calcolaRiepilogoMese",),
            }
            for nome, funzioni in piani.items():
                varianti[nome], conteggi = prepara_variante(consegna, opzioni.base, radice, nome, funzioni)
                if nome == "neutralizzata":
                    risultato["difetto_localizzato"] = conteggi

            # Casi preesistenti: versione --base dei file modificati, eseguita prima della sovrascrittura.
            preesistenti_file = [f for f in test_unit if (varianti["neutralizzata"] / f).exists()]
            preesistenti = set()
            if preesistenti_file:
                passati, falliti, _ = esegui_vitest(varianti["neutralizzata"], preesistenti_file, "preesistenti.json", env)
                preesistenti = passati | falliti

            for cartella in varianti.values():
                for nome_file in test_unit + supporto:
                    destinazione = cartella / nome_file
                    destinazione.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(consegna / nome_file, destinazione)

            # La consegna gira in un proprio worktree di HEAD: la copia immutabile non viene toccata.
            cartella_consegna, _ = prepara_variante(consegna, "HEAD", radice, "consegna", ())
            varianti_consegna["consegna"] = cartella_consegna
            ok_consegna, _, errori_consegna = esegui_vitest(cartella_consegna, test_unit, "gate-consegna.json", env)
            nuovi_ok = ok_consegna - preesistenti
            risultato["varianti"]["consegna"] = {"passati": sorted(ok_consegna), "falliti": [], "errori_file": errori_consegna}
            esiti = {}
            for nome, cartella in varianti.items():
                passati, falliti, errori = esegui_vitest(cartella, test_unit, f"gate-{nome}.json", env)
                esiti[nome] = (passati, falliti)
                risultato["varianti"][nome] = {"passati": sorted(passati), "falliti": sorted(falliti), "errori_file": errori}

            neutri = esiti["neutralizzata"][0]
            causali = lambda variante: sorted(c for c in nuovi_ok if c in esiti[variante][1] and c in neutri)
            risultato["G1"] = {"ok": bool(causali("difettosa")), "casi": causali("difettosa")}
            solo_r, solo_a = causali("solo-riepilogo"), causali("solo-avanzamento")
            risultato["G2"] = {"ok": bool(solo_r) and bool(solo_a), "solo_riepilogo": solo_r, "solo_avanzamento": solo_a}
            falliti_qualsiasi = set(c for c in nuovi_ok if c not in esiti["difettosa"][0])
            risultato["informativo"]["falliscono_sulla_difettosa_per_qualsiasi_motivo"] = sorted(falliti_qualsiasi)

            if not all(risultato["difetto_localizzato"].get(f, 0) > 0 for f in FUNZIONI):
                risultato["esito"] = "incerto"
                risultato["motivo"] = "troncamento non localizzato in entrambe le funzioni della baseline difettosa"
    finally:
        for cartella in [*varianti.values(), *varianti_consegna.values()]:
            subprocess.run(["git", "-C", str(consegna), "worktree", "remove", "--force", str(cartella)], capture_output=True)
        shutil.rmtree(radice, ignore_errors=True)

    testo = json.dumps(risultato, indent=2, ensure_ascii=False)
    (opzioni.uscita / "gate-test-regressione.json").write_text(testo)
    print(testo)
    sys.exit(2 if risultato["esito"] == "incerto" else 0)


if __name__ == "__main__":
    main()
