#!/usr/bin/env python3
"""Verifica statica dell'oracolo (nessun server, nessun database): ogni controllo della checklist
è coperto ESATTAMENTE una volta, dal livello dichiarato e con l'area dichiarata; nessun test usa
skip/only/todo/fixme; nessun titolo duplicato o estraneo alla checklist.

  python3 verifica_copertura.py [T1 T2 T3 T4]
Esce con codice 1 se trova problemi.
"""
import json
import re
import sys
from pathlib import Path

ORACOLI = Path(__file__).resolve().parent.parent
TITOLO = re.compile(r"""\btest\(\s*["'`]\[(\w+)\]\s+([A-Z]\d+)\s""")
VIETATI = re.compile(r"\b(test|it|describe)\.(skip|only|todo|fixme)\b|\btest\.fail\(|waitForTimeout\(|workers:\s*1\b")
FASI_ESTERNE = {
    "T1": {"P1": "gate", "P2": "gate"},
    "T3": {"P1": "gate", "P2": "gate"},
    "T4": {"G1": "gate", "G2": "gate", "D1": "giudice", "D2": "giudice", "C4": "giudice"},
}
FILE_LIVELLO = {
    "integrazione.test.ts": "integrazione",
    "browser.spec.ts": "browser",
    "migrazione/migrazione.test.ts": "integrazione",
}


def verifica(compito):
    problemi = []
    checklist = json.loads((ORACOLI / compito / "controlli.json").read_text())
    attesi = {c["codice"]: c for c in checklist["controlli"]}
    trovati = {}
    for relativo, livello in FILE_LIVELLO.items():
        percorso = ORACOLI / compito / relativo
        if not percorso.exists():
            continue
        testo = percorso.read_text()
        for riga in VIETATI.findall(testo):
            problemi.append(f"{relativo}: costrutto vietato {riga}")
        for area, codice in TITOLO.findall(testo):
            if codice in trovati:
                problemi.append(f"{codice} duplicato ({trovati[codice][2]} e {relativo})")
            trovati[codice] = (area, livello, relativo)
    for codice, livello in FASI_ESTERNE.get(compito, {}).items():
        if codice in trovati:
            problemi.append(f"{codice} è una fase esterna ({livello}) ma compare anche in {trovati[codice][2]}")
        trovati[codice] = (attesi.get(codice, {}).get("area"), livello, "fase esterna")
    for codice, voce in attesi.items():
        if codice not in trovati:
            problemi.append(f"{codice} non coperto")
            continue
        area, livello, origine = trovati[codice]
        if area != voce["area"]:
            problemi.append(f"{codice}: area {area} invece di {voce['area']} ({origine})")
        if livello != voce["livello"]:
            problemi.append(f"{codice}: livello {livello} invece di {voce['livello']} ({origine})")
    for codice in trovati:
        if codice not in attesi:
            problemi.append(f"{codice} non è nella checklist")
    attesi_n = 25 if compito == "T4" else 24
    if len(attesi) != attesi_n:
        problemi.append(f"la checklist ha {len(attesi)} controlli invece di {attesi_n}")
    return len(trovati), problemi


def main():
    compiti = sys.argv[1:] or ["T1", "T2", "T3", "T4"]
    errori = 0
    for compito in compiti:
        quanti, problemi = verifica(compito)
        print(f"{compito}: {quanti} controlli coperti" + ("" if not problemi else f", {len(problemi)} problemi"))
        for problema in problemi:
            print(f"  - {problema}")
        errori += len(problemi)
    sys.exit(1 if errori else 0)


if __name__ == "__main__":
    main()
