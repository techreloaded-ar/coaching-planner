#!/usr/bin/env python3
"""Punteggio di una consegna per un compito, dai risultati dei livelli e delle fasi esterne.

  python3 punteggio.py --compito T3 --gate-ci gate-ci.json --vitest vitest-oracolo.json \
      --playwright playwright-oracolo.json [--gate-migrazione gate-migrazione.json] \
      [--gate-t4 gate-test-regressione.json] [--giudice-t4 giudice-t4.json] [--uscita evaluation.json]

Regole:
  - un controllo vale solo se il suo CODICE è nella checklist (oracoli/<Tn>/controlli.json) e il suo
    titolo «[area] CODICE ...» riporta la stessa area; un controllo assente conta come fallito;
  - punti per area = peso × superati / controlli della checklist in quell'area;
  - area «regressioni» = peso intero solo se il gate CI è tutto ok (tutto-o-niente);
  - `critici`: codici indicati nella checklist come violazioni critiche e falliti.
Contratto JSON: {"compito", "totale", "aree": {area: {peso, superati, controlli, punti}},
                 "controlli": {codice: {area, ok, origine, titolo, errore}}, "mancanti": [..],
                 "aree_incoerenti": [..], "violazioni_critiche": [..]}
"""
import argparse
import json
import re
from pathlib import Path

ORACOLI = Path(__file__).resolve().parent.parent
TITOLO = re.compile(r"\[(\w+)\]\s+([A-Z]\d+)")


def da_vitest(percorso):
    esiti = {}
    if percorso and Path(percorso).exists():
        for file in json.loads(Path(percorso).read_text()).get("testResults", []):
            for caso in file.get("assertionResults", []):
                trovato = TITOLO.search(caso.get("title", ""))
                if trovato:
                    esiti[trovato.group(2)] = {"area": trovato.group(1), "ok": caso.get("status") == "passed", "origine": "integrazione",
                                               "titolo": caso["title"], "errore": "\n".join(caso.get("failureMessages", []))[:1500]}
    return esiti


def da_playwright(percorso):
    esiti = {}

    def visita(suite):
        for spec in suite.get("specs", []):
            trovato = TITOLO.search(spec.get("title", ""))
            if trovato:
                risultati = [r for t in spec.get("tests", []) for r in t.get("results", [])]
                errore = "\n".join(str(r.get("error", {}).get("message", "")) for r in risultati if r.get("error"))
                esiti[trovato.group(2)] = {"area": trovato.group(1), "ok": bool(spec.get("ok")), "origine": "browser",
                                           "titolo": spec["title"], "errore": errore[:1500]}
        for figlia in suite.get("suites", []):
            visita(figlia)

    if percorso and Path(percorso).exists():
        for suite in json.loads(Path(percorso).read_text()).get("suites", []):
            visita(suite)
    return esiti


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--compito", required=True, choices=["T1", "T2", "T3", "T4"])
    parser.add_argument("--gate-ci", required=True)
    parser.add_argument("--vitest")
    parser.add_argument("--playwright")
    parser.add_argument("--gate-migrazione")
    parser.add_argument("--gate-t4")
    parser.add_argument("--giudice-t4")
    parser.add_argument("--uscita")
    opzioni = parser.parse_args()
    checklist = json.loads((ORACOLI / opzioni.compito / "controlli.json").read_text())
    attesi = {c["codice"]: c for c in checklist["controlli"]}

    esiti = {**da_vitest(opzioni.vitest), **da_playwright(opzioni.playwright)}
    if opzioni.gate_migrazione:
        gate = json.loads(Path(opzioni.gate_migrazione).read_text())
        valido = gate.get("esito") == "ok"
        for codice in ("P1", "P2"):
            esiti[codice] = {"area": "persistenza", "ok": valido and gate[codice]["ok"], "origine": "gate-migrazione",
                             "titolo": f"gate {codice}", "errore": "" if valido else str(gate.get("motivo"))}
        for codice, voce in gate.get("controlli", {}).items():
            esiti[codice] = {**voce, "ok": valido and voce["ok"], "origine": "gate-migrazione"}
    if opzioni.gate_t4:
        gate = json.loads(Path(opzioni.gate_t4).read_text())
        for codice in ("G1", "G2"):
            esiti[codice] = {"area": "regressione", "ok": gate.get("esito") == "ok" and gate[codice]["ok"],
                             "origine": "gate-t4", "titolo": f"gate {codice}", "errore": str(gate.get("motivo") or "")}
    if opzioni.giudice_t4:
        giudice = json.loads(Path(opzioni.giudice_t4).read_text())
        for codice in ("D1", "D2", "C4"):
            esiti[codice] = {"area": attesi[codice]["area"], "ok": giudice.get("esito") == "ok" and giudice[codice]["ok"],
                             "origine": "giudice-t4", "titolo": f"giudice {codice}", "errore": giudice[codice].get("motivazione", "")}

    controlli, incoerenti = {}, []
    for codice, voce in attesi.items():
        esito = esiti.get(codice)
        if esito and esito["area"] != voce["area"]:
            incoerenti.append(f"{codice}: area {esito['area']} invece di {voce['area']}")
            esito = {**esito, "ok": False}
        controlli[codice] = esito or {"area": voce["area"], "ok": False, "origine": None, "titolo": None, "errore": "controllo non eseguito"}
    mancanti = sorted(c for c in attesi if c not in esiti)

    gate_ci = json.loads(Path(opzioni.gate_ci).read_text())
    aree = {}
    for area, peso in checklist["aree"].items():
        if area == "regressioni":
            ok = bool(gate_ci.get("ok"))
            aree[area] = {"peso": peso, "superati": int(ok), "controlli": 1, "punti": peso if ok else 0}
            continue
        della_area = [c for c in controlli.values() if c["area"] == area]
        superati = sum(1 for c in della_area if c["ok"])
        aree[area] = {"peso": peso, "superati": superati, "controlli": len(della_area),
                      "punti": round(peso * superati / len(della_area), 2) if della_area else 0}
    critici = [c.split(":")[0].strip() for c in checklist.get("critici", [])]
    violazioni = [c for c in critici if 'VIOLAZIONE_CRITICA_' in controlli.get(c, {}).get('errore','')]
    critici_incerto = [c for c in critici if c not in violazioni and not controlli.get(c, {}).get('ok')]
    risultato = {"compito": opzioni.compito, "totale": round(sum(a["punti"] for a in aree.values()), 1), "aree": aree,
                 "controlli": controlli, "mancanti": mancanti, "aree_incoerenti": incoerenti,
                 "violazioni_critiche": sorted(violazioni), "controlli_critici_non_verificati":sorted(critici_incerto),
                 "valida":not mancanti and not incoerenti}
    testo = json.dumps(risultato, indent=2, ensure_ascii=False)
    if opzioni.uscita:
        Path(opzioni.uscita).write_text(testo)
    print(testo)


if __name__ == "__main__":
    main()
