#!/usr/bin/env python3
"""Gate CI di regressione, tutto-o-niente (area «regressioni» di ogni compito).

Replica i passi di .github/workflows/ci.yml sulla copia immutabile della consegna, PRIMA di
installare l'oracolo (lint e build non devono vedere __oracolo__):
  python3 gate_ci.py --consegna <copia> --base <commit-baseline> \
      --database-url postgresql://.../oracolo_<prova> --e2e-database-url postgresql://.../oracolo_<prova>_e2e \
      --uscita <cartella>
Il server e2e usa la porta 3000 (`npm run start` dopo la build), TZ=UTC come la CI.

Contratto JSON (stdout e <uscita>/gate-ci.json):
  {"controllo": "gate-ci", "ok": bool,
   "passi": {"migrate": {...}, "seed": {...}, "lint": {...}, "unit": {...}, "build": {...}, "e2e_baseline": {...},
             "conservazione": {"ok": bool, "mancanti": [str], "disattivati": [str]}}}
  ok = tutti i passi ok. `conservazione`: tutti i file di test della baseline (tests/unit/*.test.ts,
  tests/e2e/*.spec.ts) ancora presenti e nessun test.skip/only/fixme/todo aggiunto sotto tests/.
  Gli e2e eseguiti sono quelli della BASELINE presenti nella consegna (i nuovi e2e girano col lint e la CI della consegna non è valutata qui).
"""
import argparse
import json
import os
import re
import subprocess
import time
from pathlib import Path


def git(repo, *argomenti):
    return subprocess.run(["git", "-C", str(repo), *argomenti], check=True, text=True, capture_output=True).stdout


def esegui(nome, comando, cwd, env, cartella_log, timeout=1800):
    inizio = time.time()
    try:
        processo = subprocess.run(comando, cwd=cwd, env=env, text=True, capture_output=True, timeout=timeout)
        codice, output = processo.returncode, processo.stdout + processo.stderr
    except subprocess.TimeoutExpired as scaduto:
        codice, output = -1, f"TIMEOUT dopo {timeout}s\n{scaduto.stdout or ''}{scaduto.stderr or ''}"
    (cartella_log / f"ci-{nome}.log").write_text(output)
    return {"ok": codice == 0, "exit": codice, "secondi": round(time.time() - inizio, 1)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--consegna", required=True, type=Path)
    parser.add_argument("--base", required=True)
    parser.add_argument("--database-url", required=True)
    parser.add_argument("--e2e-database-url", required=True)
    parser.add_argument("--uscita", required=True, type=Path)
    opzioni = parser.parse_args()
    if opzioni.database_url == opzioni.e2e_database_url:
        raise SystemExit("il database e2e deve essere distinto da quello applicativo")
    consegna = opzioni.consegna.resolve()
    uscita = opzioni.uscita.resolve()
    uscita.mkdir(parents=True, exist_ok=True)
    if (consegna / "__oracolo__").exists():
        raise SystemExit("eseguire il gate CI prima di installare l'oracolo")
    env = {**os.environ, "CI": "true", "TZ": "UTC", "NODE_ENV": "test", "E2E_TEST_MODE": "true",
           "DATABASE_URL": opzioni.database_url, "E2E_DATABASE_URL": opzioni.e2e_database_url,
           "PLAYWRIGHT_WEB_SERVER_COMMAND": "npm run start",
           "SESSION_SECRET": os.environ.get("SESSION_SECRET", "ci-session-secret-not-for-production-use"),
           "AUTH_SECRET": os.environ.get("AUTH_SECRET", "ci-auth-secret-not-for-production-use"),
           "GOOGLE_CLIENT_ID": os.environ.get("GOOGLE_CLIENT_ID", "ci-google-client-id"),
           "GOOGLE_CLIENT_SECRET": os.environ.get("GOOGLE_CLIENT_SECRET", "ci-google-client-secret"),
           "NEXT_PUBLIC_APP_URL": "http://localhost:3000"}

    baseline_test = sorted(
        f for f in git(consegna, "ls-tree", "-r", "--name-only", opzioni.base, "--", "tests").splitlines()
        if re.match(r"^tests/unit/[^/]+\.test\.ts$", f) or re.match(r"^tests/e2e/[^/]+\.spec\.ts$", f)
    )
    mancanti = [f for f in baseline_test if not (consegna / f).exists()]
    diff_test = git(consegna, "diff", opzioni.base, "HEAD", "--", "tests")
    disattivati = [r for r in diff_test.splitlines() if re.match(r"^\+.*\b(test|it|describe)\.(skip|only|fixme|todo)\(", r)]

    passi = {}
    passi["migrate"] = esegui("migrate", ["npx", "prisma", "migrate", "deploy"], consegna, env, uscita)
    passi["seed"] = esegui("seed", ["npx", "prisma", "db", "seed"], consegna, env, uscita)
    passi["lint"] = esegui("lint", ["npm", "run", "lint"], consegna, env, uscita)
    passi["unit"] = esegui("unit", ["npm", "test"], consegna, env, uscita)
    passi["build"] = esegui("build", ["npm", "run", "build"], consegna, env, uscita)
    e2e = [f for f in baseline_test if f.startswith("tests/e2e/") and f not in mancanti]
    passi["e2e_baseline"] = esegui("e2e-baseline", ["npx", "playwright", "test", *e2e, "--reporter=line"],
                                   consegna, env, uscita, timeout=3600)
    passi["conservazione"] = {"ok": not mancanti and not disattivati, "mancanti": mancanti, "disattivati": disattivati}
    risultato = {"controllo": "gate-ci", "ok": all(p["ok"] for p in passi.values()), "passi": passi}
    testo = json.dumps(risultato, indent=2, ensure_ascii=False)
    (uscita / "gate-ci.json").write_text(testo)
    print(testo)


if __name__ == "__main__":
    main()
