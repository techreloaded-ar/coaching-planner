#!/usr/bin/env python3
"""Giudice della qualità della scoperta (criteri §2.3 dell'indice) per i chiarimenti del report 6.

Uso (dalla radice del repository):
  python3 bench/fase-spec/giudice.py all | <id> [...]     due letture Opus per chiarimento → <cella>/giudizio-1.json, giudizio-2.json

Opus, effort medium, senza strumenti, JSON a schema chiuso. Legge dialogo.md e storie.md; assegna a ogni tema del profilo
Esplicito (2), Parziale (1), Non chiarito (0); indicatori di processo: conflitto con RF-15 sollevato (sì/no, fonte),
bozza completa mostrata prima del salvataggio, voci di «Fuori perimetro». La seconda lettura riusa il prompt (cache).
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

BENCH = Path(__file__).resolve().parent.parent
os.environ.setdefault("BENCH_MATRICE", "matrice-spec.json")
sys.path.insert(0, str(BENCH / "wiki-benchmark"))
import run as banco  # noqa: E402

RUNS = banco.RUNS / "fase-spec"
CONTROLLI = json.loads((BENCH / "common" / "controlli.json").read_text())
TEMI = {
    "decisione_rf15": "Decisione precedente (RF-15): il PRD dice che il mese resta sempre modificabile, senza blocco; il committente ora la supera. Esplicito se la storia o il dialogo registra il superamento della decisione precedente come scelta consapevole.",
    "chi": "Chi: solo l'amministratore chiude e riapre; i collaboratori vedono lo stato ma non lo cambiano.",
    "granularita": "Granularità: il mese si chiude per tutti i collaboratori e tutti i clienti insieme, non per cliente né per collaboratore.",
    "quali_mesi": "Quali mesi: solo mesi già conclusi; non si può chiudere il mese corrente né un mese futuro.",
    "effetto_scritture": "Effetto su tutte le scritture: in un mese chiuso nessuno può creare, modificare o eliminare righe attività, rimuovere rimborsi trasferta, né duplicare o spostare righe verso giorni di quel mese; vale anche per l'amministratore.",
    "riapertura_motivazione": "Riapertura con motivazione: l'amministratore può riaprire indicando una motivazione obbligatoria.",
    "storico": "Storico: chi ha chiuso o riaperto e quando, con lo storico completo, non solo l'ultimo stato.",
    "visibilita": "Visibilità: calendario e dettaglio giornata mostrano che il mese è chiuso e non offrono azioni di modifica; i report indicano se il mese è chiuso.",
    "concorrenza": "Concorrenza: una scrittura in corso mentre l'amministratore chiude deve finire prima della chiusura o essere rifiutata; nessuna scrittura dopo la chiusura.",
    "schede_aperte": "Schede aperte: chi aveva il calendario aperto da prima della chiusura riceve un errore chiaro al salvataggio, non un falso successo.",
    "dati_invariati": "Dati invariati: chiudere non cambia né cancella righe; i report di fatturazione restano identici.",
}
VALORI = ["Esplicito", "Parziale", "Non chiarito"]
SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["temi", "rf15_sollevato", "rf15_fonte", "bozza_completa_mostrata", "fuori_perimetro_voci", "fuori_perimetro_esempi", "note"],
    "properties": {
        "temi": {"type": "object", "additionalProperties": False, "required": list(TEMI),
                 "properties": {k: {"type": "object", "additionalProperties": False, "required": ["valore", "evidenza"],
                                    "properties": {"valore": {"type": "string", "enum": VALORI}, "evidenza": {"type": "string"}}} for k in TEMI}},
        "rf15_sollevato": {"type": "boolean"},
        "rf15_fonte": {"type": "string", "enum": ["prd", "wiki", "entrambi", "nessuna"]},
        "bozza_completa_mostrata": {"type": "boolean"},
        "fuori_perimetro_voci": {"type": "integer"},
        "fuori_perimetro_esempi": {"type": "string"},
        "note": {"type": "string"},
    },
}
MODELLO, EFFORT, BUDGET = "opus", "medium", 3


def prompt_di(id_, dialogo, storie):
    temi = "\n".join(f"- `{k}` — {v}" for k, v in TEMI.items())
    return f"""Sei un giudice a checklist chiusa. Valuti quanto un chiarimento dei requisiti ha scoperto il bisogno reale di un committente. Il committente simulato aveva un profilo nascosto con 11 temi (sotto); rispondeva solo a ciò che gli veniva chiesto e in approvazione segnalava solo contraddizioni esplicite. Leggi il dialogo tra il team e il committente e le storie finali salvate nel backlog, poi assegna a ogni tema un valore:

- **Esplicito**: il bisogno del tema è scritto nelle storie finali (criterio di accettazione, dimostrazione o fuori perimetro) in modo che chi implementa non possa sbagliare, oppure è stato chiesto e risposto nel dialogo e le storie lo riportano.
- **Parziale**: il tema è toccato ma incompleto o ambiguo (es. blocco solo su alcune scritture, visibilità solo nel dettaglio giornata, «riapertura» senza motivazione), oppure chiarito nel dialogo ma non riportato nelle storie.
- **Non chiarito**: il tema non compare né nel dialogo né nelle storie, o le storie dicono il contrario del bisogno.

Un tema escluso esplicitamente in «Fuori perimetro» è Parziale se l'esclusione è dichiarata (il committente ha potuto vederla), Non chiarito se non è dichiarata. Giudica sul testo, senza supplire con buon senso ciò che non è scritto. Per ogni tema cita in una frase l'evidenza (storia e AC, o messaggio del dialogo).

Temi del profilo:
{temi}

Indicatori di processo:
- `rf15_sollevato`: il team ha sollevato con il committente il conflitto con la decisione precedente (il PRD, RF-15 o le righe 109/122 del PRD, o la Wiki) prima di scrivere le storie; `rf15_fonte`: da dove l'ha citata (prd, wiki, entrambi, nessuna).
- `bozza_completa_mostrata`: prima di salvare, il team ha mostrato al committente la bozza intera delle storie (titolo, storia, criteri di accettazione) e ne ha chiesto l'approvazione; vero solo se la bozza completa compare nel dialogo prima del messaggio che annuncia il salvataggio.
- `fuori_perimetro_voci`: quante voci distinte compaiono nelle sezioni «Fuori perimetro» (o equivalenti) delle storie finali; `fuori_perimetro_esempi`: le prime tre, separate da punto e virgola.

Rispondi SOLO con il JSON richiesto.

# Chiarimento «{id_}»

## Dialogo

{dialogo}

## Storie finali salvate nel backlog

{storie}
"""


def giudica(id_, letture=(1, 2)):
    cella = RUNS / id_
    if not (cella / "discovery.json").exists():
        return print(f"{id_}: senza discovery.json, salto")
    prompt = prompt_di(id_, (cella / "phases" / "01-spec" / "dialogo.md").read_text(), (cella / "storie.md").read_text())
    (cella / "giudizio-prompt.txt").write_text(prompt)
    env = banco.agent_env()
    for n in letture:
        dest = cella / f"giudizio-{n}.json"
        if dest.exists() and json.loads(dest.read_text()).get("risposta"):
            continue
        res = subprocess.run(["claude", "-p", "--model", MODELLO, "--effort", EFFORT, "--tools", "", "--setting-sources", "", "--strict-mcp-config",
                              "--no-session-persistence", "--output-format", "json", "--json-schema", json.dumps(SCHEMA), "--max-budget-usd", str(BUDGET)],
                             input=prompt, capture_output=True, text=True, cwd=banco.RUNS / "_committente", env=env, timeout=1200)
        try:
            esito = json.loads(res.stdout)
        except json.JSONDecodeError:
            (cella / f"giudizio-{n}.err").write_text(res.stdout + res.stderr)
            sys.exit(f"{id_}: lettura {n} senza JSON (exit {res.returncode})")
        risposta = esito.get("structured_output")
        if not risposta and esito.get("result"):
            try:
                risposta = json.loads(re.sub(r"^```(?:json)?|```$", "", esito["result"].strip(), flags=re.M))
            except json.JSONDecodeError:
                risposta = None
        banco.write_json(dest, {"id": id_, "lettura": n, "modello": MODELLO, "effort": EFFORT, "cost_usd": esito.get("total_cost_usd"),
                                "usage": esito.get("usage"), "duration_ms": esito.get("duration_ms"), "is_error": esito.get("is_error"),
                                "risposta": risposta, "grezzo": None if risposta else esito})
        if esito.get("is_error") or not risposta:
            sys.exit(f"{id_}: lettura {n} in errore o senza risposta: {str(esito)[:300]}")
        punti = sum({"Esplicito": 2, "Parziale": 1, "Non chiarito": 0}[v["valore"]] for v in risposta["temi"].values())
        print(f"{id_}: lettura {n} · {esito.get('total_cost_usd', 0):.2f} USD · {round(100 * punti / 22)}/100 · RF-15 {risposta['rf15_sollevato']} "
              f"· bozza {risposta['bozza_completa_mostrata']} · fuori perimetro {risposta['fuori_perimetro_voci']}", flush=True)


def main(argv):
    ids = [c["id"] for c in banco.CFG["celle"]] if argv and argv[0] == "all" else argv
    for id_ in ids:
        giudica(id_)


if __name__ == "__main__":
    main(sys.argv[1:])
