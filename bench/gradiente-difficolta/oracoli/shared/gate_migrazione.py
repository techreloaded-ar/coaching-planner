#!/usr/bin/env python3
"""Gate di persistenza P1/P2 con DATI preesistenti (T1, T3) e controlli M1–M3 di T3.

Uso (dal banco; il database deve essere DEDICATO: lo schema `public` viene ricreato):
  python3 gate_migrazione.py --compito T1|T3 --consegna <copia-immutabile> --base <commit-baseline> \
      --database-url postgresql://.../oracolo_<prova>_migrazione --uscita <cartella>
Per T3 l'oracolo con l'adattatore della consegna deve essere già installato in <consegna>/__oracolo__
(installa_oracolo.py). La copia della consegna non viene modificata (solo `prisma migrate deploy`
sul database dedicato); la baseline gira in un worktree temporaneo.

Fasi:
  1. worktree della baseline (--base), node_modules della consegna in symlink, `prisma generate`;
  2. schema azzerato, `prisma migrate deploy` + `prisma db seed` della BASELINE;
  3. fase «prima» (shared/migrazione/fase-prima.test.ts, adattatore nullo): dataset deterministico di
     31 mesi e foto dei report con il codice della baseline → foto-prima.json; impronte delle tabelle;
  4. `prisma migrate deploy` della CONSEGNA sullo stesso database, con i dati;
  5. impronte delle stesse colonne dopo il deploy; drift schema/migrazioni;
  6. solo T3: Vitest `__oracolo__/migrazione/vitest.migrazione.config.ts` sulla consegna → M1, M2, M3.

Contratto JSON (stdout e <uscita>/gate-migrazione.json):
  {
    "controllo": "gate-migrazione", "compito": "T1"|"T3", "esito": "ok"|"incerto", "motivo": str|null,
    "P1": {"ok": bool, "deploy_ok": bool, "migrazioni_nuove": [str],
           "additiva": {"ok": bool, "colonne_mancanti": {tabella: [col]}, "tabelle_con_dati_alterati": [str]} | null},
    "P2": {"ok": bool, "drift_ok": bool},
    "controlli": {"M1": {"area": "migrazione", "ok": bool, "titolo": str, "errore": str}, ...}   # solo T3
  }
  P1 = deploy riuscito su dati ∧ almeno una migrazione nuova ∧ (T1) additiva: nessuna colonna della
       baseline rimossa e righe preesistenti identiche sulle colonne della baseline.
  P2 = nessun drift tra database migrato e schema.prisma ∧ almeno una migrazione nuova.
  esito "incerto" (codice 2) se la BASELINE non si prepara: in quel caso P1/P2/M non sono validi.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

QUI = Path(__file__).resolve().parent
sys.path.insert(0, str(QUI))
from installa_oracolo import installa  # noqa: E402

TITOLO = re.compile(r"\[(\w+)\]\s+([A-Z]\d+)")


def git(repo, *argomenti):
    return subprocess.run(["git", "-C", str(repo), *argomenti], check=True, text=True, capture_output=True).stdout.strip()


def esegui(nome, comando, cwd, env, cartella_log, timeout=1800):
    inizio = time.time()
    try:
        processo = subprocess.run(comando, cwd=cwd, env=env, text=True, capture_output=True, timeout=timeout)
        codice, output = processo.returncode, processo.stdout + processo.stderr
    except subprocess.TimeoutExpired as scaduto:
        codice, output = -1, f"TIMEOUT dopo {timeout}s\n{scaduto.stdout or ''}{scaduto.stderr or ''}"
    (cartella_log / f"{nome}.log").write_text(output)
    return {"ok": codice == 0, "exit": codice, "secondi": round(time.time() - inizio, 1), "output": output}


def esiti_vitest(percorso):
    esiti = {}
    if not percorso.exists():
        return esiti
    for file in json.loads(percorso.read_text()).get("testResults", []):
        for caso in file.get("assertionResults", []):
            trovato = TITOLO.search(caso.get("title", ""))
            if trovato:
                esiti[trovato.group(2)] = {"area": trovato.group(1), "ok": caso.get("status") == "passed",
                                           "titolo": caso["title"], "errore": "\n".join(caso.get("failureMessages", []))[:1500]}
    return esiti


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--compito", required=True, choices=["T1", "T3"])
    parser.add_argument("--consegna", required=True, type=Path)
    parser.add_argument("--base", required=True)
    parser.add_argument("--database-url", required=True)
    parser.add_argument("--uscita", required=True, type=Path)
    opzioni = parser.parse_args()
    consegna = opzioni.consegna.resolve()
    uscita = opzioni.uscita.resolve()
    uscita.mkdir(parents=True, exist_ok=True)
    nome_db = opzioni.database_url.rsplit("/", 1)[-1].split("?")[0]
    env = {**os.environ, "TZ": "UTC", "DATABASE_URL": opzioni.database_url, "E2E_DATABASE_URL": opzioni.database_url,
           "ORACOLO_CONFERMA_AZZERAMENTO": nome_db, "ORACOLO_FOTO_PRIMA": str(uscita / "foto-prima.json")}
    risultato = {"controllo": "gate-migrazione", "compito": opzioni.compito, "esito": "ok", "motivo": None,
                 "P1": {"ok": False, "deploy_ok": False, "migrazioni_nuove": [], "additiva": None},
                 "P2": {"ok": False, "drift_ok": False}, "controlli": {}}
    if opzioni.compito == "T3" and not (consegna / "__oracolo__" / "adattatore" / "dati.ts").exists():
        sys.exit("T3: installare prima l'oracolo con l'adattatore della consegna (installa_oracolo.py)")

    radice = Path(tempfile.mkdtemp(prefix="oracolo-migrazione-"))
    baseline = radice / "baseline"
    try:
        git(consegna, "worktree", "add", "--detach", "--force", str(baseline), opzioni.base)
        (baseline / "node_modules").symlink_to(consegna / "node_modules")
        installa(opzioni.compito, baseline, nullo=True)
        passi = [
            ("baseline-generate", ["npx", "prisma", "generate"]),
            ("azzera-schema", ["node", "__oracolo__/shared/migrazione/azzera-schema.mjs"]),
            ("baseline-migrate-deploy", ["npx", "prisma", "migrate", "deploy"]),
            ("baseline-seed", ["npx", "prisma", "db", "seed"]),
            ("fase-prima", ["npx", "vitest", "run", "--config", "__oracolo__/shared/migrazione/vitest.prima.config.ts"]),
        ]
        for nome, comando in passi:
            if not esegui(nome, comando, baseline, env, uscita)["ok"]:
                risultato.update(esito="incerto", motivo=f"preparazione della baseline fallita al passo {nome}")
                break
        else:
            impronte_prima = esegui("impronte-prima", ["node", "__oracolo__/shared/migrazione/impronte.mjs"], baseline, env, uscita)
            (uscita / "impronte-prima.json").write_text(impronte_prima["output"])

            deploy = esegui("consegna-migrate-deploy", ["npx", "prisma", "migrate", "deploy"], consegna, env, uscita)
            impronte_dopo = esegui("impronte-dopo", ["node", "__oracolo__/shared/migrazione/impronte.mjs", "--come",
                                                     str(uscita / "impronte-prima.json")], baseline, env, uscita)
            (uscita / "impronte-dopo.json").write_text(impronte_dopo["output"])
            drift = esegui("consegna-schema-drift", ["npx", "prisma", "migrate", "diff", "--from-config-datasource",
                                                     "--to-schema", "prisma/schema.prisma", "--exit-code"], consegna, env, uscita)
            nuove = git(consegna, "diff", "--name-only", "--diff-filter=A", opzioni.base, "HEAD", "--", "prisma/migrations").splitlines()
            nuove = sorted({str(Path(f).parent.name) for f in nuove if f.endswith("migration.sql")})
            risultato["P1"].update(deploy_ok=deploy["ok"], migrazioni_nuove=nuove)
            risultato["P2"].update(drift_ok=drift["ok"], ok=drift["ok"] and bool(nuove))
            additiva_ok = True
            if opzioni.compito == "T1":
                prima = json.loads(impronte_prima["output"])["tabelle"]
                dopo = json.loads(impronte_dopo["output"] or '{"tabelle": {}}')["tabelle"]
                mancanti = {t: v["mancanti"] for t, v in dopo.items() if v.get("mancanti")}
                alterate = sorted(t for t, v in prima.items() if dopo.get(t, {}).get("impronta") != v["impronta"])
                additiva_ok = impronte_dopo["ok"] and not mancanti and not alterate
                risultato["P1"]["additiva"] = {"ok": additiva_ok, "colonne_mancanti": mancanti, "tabelle_con_dati_alterati": alterate}
            risultato["P1"]["ok"] = deploy["ok"] and bool(nuove) and additiva_ok

            if opzioni.compito == "T3":
                report = uscita / "vitest-migrazione.json"
                report.unlink(missing_ok=True)
                if deploy["ok"]:
                    esegui("consegna-migrazione-m", ["npx", "vitest", "run", "--config", "__oracolo__/migrazione/vitest.migrazione.config.ts",
                                                     "--reporter=json", f"--outputFile={report}"], consegna, env, uscita)
                controlli = esiti_vitest(report)
                for codice in ("M1", "M2", "M3"):
                    controlli.setdefault(codice, {"area": "migrazione", "ok": False, "titolo": f"[migrazione] {codice}",
                                                  "errore": "non eseguito: migrate deploy della consegna fallito o report assente"})
                risultato["controlli"] = controlli
    finally:
        subprocess.run(["git", "-C", str(consegna), "worktree", "remove", "--force", str(baseline)], capture_output=True)
        shutil.rmtree(radice, ignore_errors=True)

    testo = json.dumps(risultato, indent=2, ensure_ascii=False)
    (uscita / "gate-migrazione.json").write_text(testo)
    print(testo)
    sys.exit(2 if risultato["esito"] == "incerto" else 0)


if __name__ == "__main__":
    main()
