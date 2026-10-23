#!/usr/bin/env python3
"""Installa l'oracolo di un compito nella copia immutabile di una consegna.

  python3 installa_oracolo.py --compito T3 --consegna <repo> --adattatore <cartella-adattatore>
  python3 installa_oracolo.py --compito T3 --consegna <repo> --adattatore-nullo

Risultato (la cartella viene ricreata da zero a ogni installazione):
  <repo>/__oracolo__/            ← contenuto di oracoli/<Tn>/ (contratto, test, config, script, adattatore-nullo/)
  <repo>/__oracolo__/shared/     ← oracoli/shared/
  <repo>/__oracolo__/ADATTATORI.md ← istruzioni per chi scrive l'adattatore
  <repo>/__oracolo__/adattatore/ ← adattatore della consegna (o copia di adattatore-nullo/)
Nient'altro della consegna viene toccato. Stampa JSON {"oracolo": percorso, "adattatore": origine}.
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

ORACOLI = Path(__file__).resolve().parent.parent
IGNORA = shutil.ignore_patterns("__pycache__", "*.pyc", "*.log", "playwright-oracolo.json", "test-results")


def installa(compito, consegna, adattatore=None, nullo=False):
    sorgente = ORACOLI / compito
    if not (sorgente / "contratto.ts").exists():
        sys.exit(f"compito sconosciuto: {compito}")
    destinazione = Path(consegna).resolve() / "__oracolo__"
    shutil.rmtree(destinazione, ignore_errors=True)
    shutil.copytree(sorgente, destinazione, ignore=IGNORA)
    shutil.copytree(ORACOLI / "shared", destinazione / "shared", ignore=IGNORA)
    shutil.copy2(ORACOLI / "ADATTATORI.md", destinazione / "ADATTATORI.md")
    origine = sorgente / "adattatore-nullo" if nullo else Path(adattatore).resolve()
    attesi = ["integrazione.ts", "browser.ts"] + (["dati.ts"] if compito == "T3" else [])
    mancanti = [f for f in attesi if not (origine / f).exists()]
    if mancanti:
        sys.exit(f"adattatore incompleto in {origine}: mancano {mancanti}")
    shutil.copytree(origine, destinazione / "adattatore", ignore=IGNORA)
    return destinazione, origine


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--compito", required=True, choices=["T1", "T2", "T3", "T4"])
    parser.add_argument("--consegna", required=True)
    gruppo = parser.add_mutually_exclusive_group(required=True)
    gruppo.add_argument("--adattatore")
    gruppo.add_argument("--adattatore-nullo", action="store_true")
    opzioni = parser.parse_args()
    destinazione, origine = installa(opzioni.compito, opzioni.consegna, opzioni.adattatore, opzioni.adattatore_nullo)
    print(json.dumps({"oracolo": str(destinazione), "adattatore": str(origine)}))


if __name__ == "__main__":
    main()
