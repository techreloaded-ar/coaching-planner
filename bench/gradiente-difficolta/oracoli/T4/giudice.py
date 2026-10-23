#!/usr/bin/env python3
"""T4 · giudice a checklist chiusa per D1, D2 (diagnosi) e C4 (focalizzazione).

Uso (dal banco):
  python3 giudice.py --consegna <copia-immutabile> --base <commit-baseline-difettosa> \
      --riepilogo-finale <file di testo con il riepilogo finale del team> \
      --riferimento <patch unificata del riferimento, base..riferimento> \
      --uscita <cartella> [--modello opus] [--effort high] [--budget-usd 3] [--solo-preparazione]

Contratto JSON (stdout e <uscita>/giudice-t4.json):
  {
    "controllo": "T4-giudice",
    "D1": {"ok": bool, "motivazione": str},   # causa: troncamento per riga ai centesimi di giornata e perdita delle frazioni
    "D2": {"ok": bool, "motivazione": str},   # entrambi i percorsi corretti: riepilogo mensile e avanzamento offerte
    "C4": {"ok": bool, "motivazione": str, "file_fuori_riferimento": [str], "giudicati": {file: bool}},
    "esito": "ok" | "incerto",                # incerto = risposta del giudice non interpretabile
    "modello": str
  }
Codice di uscita 0 con esito ok, 2 con esito incerto.

C4 è prima meccanico: file applicativi (src/, prisma/, scripts/, next.config.*, package*.json) modificati
dalla consegna e NON dal riferimento. Nessuno → C4 vero senza giudice. Altrimenti il giudice risponde,
per ciascun file, se la modifica è necessaria alla correzione della famiglia del difetto (sì/no):
C4 è vero solo se tutti i file sono giudicati necessari.
La checklist è congelata in `giudice-checklist.md`; il giudice NON vede profilo né oracolo.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

QUI = Path(__file__).resolve().parent
APPLICATIVI = re.compile(r"^(src/|prisma/|scripts/|next\.config\.|package(-lock)?\.json$|proxy\.ts$|middleware\.ts$)")
GENERATI = re.compile(r"^src/generated/")


def git(repo, *argomenti):
    return subprocess.run(["git", "-C", str(repo), *argomenti], check=True, text=True, capture_output=True).stdout


def file_da_patch(testo):
    return sorted({m.group(1) for m in re.finditer(r"^\+\+\+ b/(.+)$", testo, re.M)} |
                  {m.group(1) for m in re.finditer(r"^--- a/(.+)$", testo, re.M)} - {"/dev/null"})


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--consegna", required=True, type=Path)
    parser.add_argument("--base", required=True)
    parser.add_argument("--riepilogo-finale", required=True, type=Path)
    parser.add_argument("--riferimento", required=True, type=Path, help="patch unificata del riferimento")
    parser.add_argument("--uscita", required=True, type=Path)
    parser.add_argument("--modello", default="opus")
    parser.add_argument("--effort", default="medium")
    parser.add_argument("--budget-usd", default="3")
    parser.add_argument("--solo-preparazione", action="store_true", help="scrive il prompt senza invocare il giudice")
    opzioni = parser.parse_args()
    opzioni.uscita.mkdir(parents=True, exist_ok=True)

    diff_consegna = git(opzioni.consegna, "diff", opzioni.base, "HEAD", "--", ".", ":(exclude)docs", ":(exclude)__oracolo__")
    modificati = [f for f in git(opzioni.consegna, "diff", "--name-only", opzioni.base, "HEAD").splitlines()
                  if APPLICATIVI.match(f) and not GENERATI.match(f)]
    del_riferimento = {f for f in file_da_patch(opzioni.riferimento.read_text())}
    fuori = sorted(f for f in modificati if f not in del_riferimento)

    checklist = (QUI / "giudice-checklist.md").read_text()
    blocco_file = "\n".join(f"- {f}" for f in fuori) or "(nessuno: C4 già deciso, rispondi comunque con \"giudicati\": {})"
    prompt = checklist.format(
        riepilogo=opzioni.riepilogo_finale.read_text()[:40000],
        diff=diff_consegna[:120000],
        file_fuori=blocco_file,
    )
    (opzioni.uscita / "giudice-t4-prompt.md").write_text(prompt)
    risultato = {"controllo": "T4-giudice", "modello": opzioni.modello, "esito": "ok",
                 "D1": {"ok": False, "motivazione": ""}, "D2": {"ok": False, "motivazione": ""},
                 "C4": {"ok": not fuori, "motivazione": "nessun file applicativo fuori dal riferimento" if not fuori else "",
                        "file_fuori_riferimento": fuori, "giudicati": {}}}
    if opzioni.solo_preparazione:
        print(json.dumps({"prompt": str(opzioni.uscita / "giudice-t4-prompt.md"), "file_fuori_riferimento": fuori}, ensure_ascii=False))
        return

    stream = opzioni.uscita / "stream-giudice-t4.jsonl"
    if stream.exists():
        raise SystemExit("Giudizio precedente incompleto: preservare e diagnosticare prima di ripetere")
    with stream.open("w") as out, (opzioni.uscita / "giudice-t4-stderr.log").open("w") as err:
        processo = subprocess.run(
            ["claude", "-p", prompt, "--model", opzioni.modello, "--effort", opzioni.effort,
             "--output-format", "stream-json", "--verbose", "--tools", "",
             "--setting-sources", "project,local", "--strict-mcp-config", "--permission-mode", "bypassPermissions",
             "--max-budget-usd", str(opzioni.budget_usd)],
            cwd=opzioni.consegna, stdin=subprocess.DEVNULL, stdout=out, stderr=err)
    eventi = [json.loads(linea) for linea in stream.read_text().splitlines() if linea.strip()]
    risultati = [evento for evento in eventi if evento.get("type") == "result"]
    esito = risultati[-1] if risultati else None
    if not esito or esito.get("is_error") or esito.get("subtype") != "success":
        raise SystemExit("STOP giudice T4 in errore: stream e costo conservati")
    risposta = esito.get("result", "")
    (opzioni.uscita / "giudice-t4-risposta.md").write_text(risposta)
    trovato = re.search(r"GIUDIZIO_T4\s+(\{.*\})", risposta)
    try:
        giudizio = json.loads(trovato.group(1)) if trovato else None
    except json.JSONDecodeError:
        giudizio = None
    if not giudizio:
        risultato["esito"] = "incerto"
    else:
        for codice in ("D1", "D2"):
            voce = giudizio.get(codice, {})
            risultato[codice] = {"ok": voce.get("esito") is True, "motivazione": str(voce.get("motivazione", ""))}
        if fuori:
            giudicati = {f: giudizio.get("C4", {}).get("giudicati", {}).get(f) is True for f in fuori}
            risultato["C4"].update(ok=all(giudicati.values()), giudicati=giudicati,
                                   motivazione=str(giudizio.get("C4", {}).get("motivazione", "")))
    testo = json.dumps(risultato, indent=2, ensure_ascii=False)
    (opzioni.uscita / "giudice-t4.json").write_text(testo)
    print(testo)
    sys.exit(0 if risultato["esito"] == "ok" else 2)


if __name__ == "__main__":
    main()
