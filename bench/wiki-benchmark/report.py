#!/usr/bin/env python3
"""Genera il report HTML del benchmark ARchetipo × Wiki.

Uso:
  python3 report.py            # dati → narrativa (sessione Opus) → report.html
  python3 report.py dati       # solo report-dati.json
  python3 report.py html       # solo report.html (riusa narrativa.json se esiste)

Legge run.json, phases/*/metrics.json, discovery.json, valutazione/evaluation.json e wiki.json
da $BENCH_RUNS e scrive lì report-dati.json, narrativa.json e report.html.
I numeri vengono solo da questi file; la narrativa li interpreta e non può aggiungerne.
"""
import html
import json
import re
import subprocess
import sys
from pathlib import Path

import run as banco

RUNS = banco.RUNS
ETICHETTE_SKILL = {
    "archetipo-spec": ("Chiarimento condiviso · archetipo-spec", "#d49d32"),
    "archetipo-plan": ("Piano · archetipo-plan", "#8164c6"),
    "archetipo-implement": ("Implementazione · archetipo-implement · review interna inclusa", "#3e8ac7"),
    "archetipo-review": ("Accettazione · archetipo-review", "#3c9c85"),
    "archetipo-wiki": ("Manutenzione Wiki · archetipo-wiki refresh", "#c4566b"),
    "diretto": ("Sviluppo diretto · nessuna skill ARchetipo", "#5aa3d6"),
}
FLUSSI = {
    "completo": "archetipo-spec → archetipo-plan → archetipo-implement → archetipo-review",
    "storie-diretto": "archetipo-spec → sviluppo diretto",
    "senza-piano": "archetipo-spec → sviluppo diretto → archetipo-review",
    "piano": "archetipo-spec → archetipo-plan → archetipo-implement",
}
CSS = (Path(__file__).parent / "report.css").read_text()

PROMPT_NARRATIVA = """Sei l'analista di un benchmark che confronta percorsi di sviluppo ARchetipo con e senza Wiki su Coaching Planner, con Sonnet e Opus. Il file `report-dati.json` nella cartella corrente contiene TUTTI i numeri: leggilo per intero. Puoi aprire i file citati (dialoghi del chiarimento, esiti dei controlli, transcript) per capire le cause, ma non inventare numeri: usa solo quelli presenti nei dati, arrotondati come nei dati.

Scrivi in italiano, tono sobrio come un rapporto tecnico, distinguendo osservazioni da ipotesi e ricordando che c'è una sola replica per combinazione. Non tradurre i termini tecnici inglesi d'uso comune.

Produci un file `narrativa.json` con queste chiavi, ciascuna un frammento HTML (solo <p>, <ul>, <li>, <strong>, <table>, <tr>, <th>, <td>, <small>):
- "cosa_emerge": 3-4 paragrafi con il miglior compromesso per modello e l'incidenza della Wiki.
- "wiki": interpretazione della sezione Wiki: costo (fasi dedicate e operazioni dentro le fasi), coppie C2/C3 e C4/C5, stato della Wiki a fine consegna, conflitto con RF-15 emerso o no con e senza Wiki.
- "chiarimento": tabella dei temi del profilo del committente (decisione RF-15, chi, granularità, quali mesi, effetto su tutte le scritture, riapertura con motivazione, storico, visibilità, concorrenza, schede aperte, dati invariati) × i 4 chiarimenti, con valori Esplicito / Parziale / Non chiarito, ricavati dai dialoghi e dalle storie.
- "problemi_intercettati": tabella percorso / problema / come è emerso / cosa permette di dire, dai transcript di review e accettazione.
- "interpretazione": come leggere i confronti e i difetti dietro i punteggi.
- "quando_wiki": tabella situazione / percorso suggerito / fondamento e limite.
- "cosa_cambiare": raccomandazioni concrete per ARchetipo e per le skill che mantengono la Wiki, con riferimenti alle skill.
Scrivi solo il file, nessuna domanda."""


def leggi(percorso, predefinito=None):
    return json.loads(percorso.read_text()) if percorso.exists() else predefinito


def fasi(cartella):
    """Fasi nell'ordine di esecuzione registrato in run.json."""
    ordine = leggi(cartella / "run.json")["phases"]
    return [leggi(cartella / "phases" / f / "metrics.json") for f in ordine]


def somma_token(elenco):
    totale = {}
    for m in elenco:
        totale = banco.add_tokens(totale, m.get("tokens", {}))
    return totale


def dati():
    chiarimenti = {}
    for cartella in sorted(RUNS.glob("D-*")):
        d = leggi(cartella / "discovery.json")
        if d:
            chiarimenti[d["id"]] = {**d, "dialogo": str(cartella / "phases" / "01-spec" / "dialogo.md")}
    prove = []
    for spec in banco.CFG["runs"]:
        cartella = RUNS / spec["id"]
        info = leggi(cartella / "run.json")
        if not info:
            continue
        chiarimento = chiarimenti[info["discovery"]]
        elenco = [chiarimento["metrics"]] + fasi(cartella)
        valutazione = leggi(cartella / "valutazione" / "evaluation.json", {})
        wiki_operazioni = {
            "chiamate": sum(m["wiki"]["count"] for m in elenco),
            "secondi_tool": round(sum(m["wiki"]["seconds"] for m in elenco), 1),
            "token_solo_wiki": sum(m["wiki"]["tokens_wiki_only_calls"].get("total", 0) for m in elenco),
            "token_misti": sum(m["wiki"]["tokens_mixed_calls"].get("total", 0) for m in elenco),
            "per_skill": {},
        }
        for m in elenco:
            voce = wiki_operazioni["per_skill"].setdefault(m["skill"], {"chiamate": 0, "token_solo_wiki": 0})
            voce["chiamate"] += m["wiki"]["count"]
            voce["token_solo_wiki"] += m["wiki"]["tokens_wiki_only_calls"].get("total", 0)
        fasi_wiki = [m for m in elenco if m["skill"] == "archetipo-wiki"]
        prove.append({
            **{k: info[k] for k in ("id", "model", "config", "label", "wiki", "discovery", "codes", "outcomes", "diffstat")},
            "pipeline": banco.CFG["configs"][info["config"]]["pipeline"],
            "minuti": round(sum(m["duration_ms"] for m in elenco) / 60000, 1),
            "usd": round(sum(m["cost_usd"] for m in elenco), 2),
            "token": somma_token(elenco),
            "fasi": [{"fase": m["phase"], "skill": m["skill"], "minuti": round(m["duration_ms"] / 60000, 2),
                      "usd": round(m["cost_usd"], 3), "token": m["tokens"], "esito_spec": m.get("spec_status_after"),
                      "wiki_chiamate": m["wiki"]["count"]} for m in elenco],
            "wiki_operazioni": wiki_operazioni,
            "fase_wiki": {"minuti": round(sum(m["duration_ms"] for m in fasi_wiki) / 60000, 1),
                          "usd": round(sum(m["cost_usd"] for m in fasi_wiki), 2),
                          "token": somma_token(fasi_wiki).get("total", 0)},
            "qualita": valutazione.get("totale"),
            "aree": valutazione.get("aree"),
            "violazioni_critiche": valutazione.get("violazioni_critiche"),
            "controlli_falliti": {k: c["titolo"] for k, c in valutazione.get("controlli", {}).items() if not c["ok"]},
            "gate": {k: v.get("ok") for k, v in valutazione.get("gate", {}).items()},
            "wiki_stato": leggi(cartella / "valutazione" / "wiki.json"),
            "cartella": str(cartella),
        })
    coppie = []
    for modello in banco.CFG["models"]:
        per_config = {p["config"]: p for p in prove if p["model"] == modello}
        for con, senza in (("C2", "C3"), ("C4", "C5")):
            if con in per_config and senza in per_config:
                a, b = per_config[con], per_config[senza]
                coppie.append({
                    "modello": modello, "con": con, "senza": senza,
                    "delta_minuti": round(a["minuti"] - b["minuti"], 1),
                    "delta_token_m": round((a["token"].get("total", 0) - b["token"].get("total", 0)) / 1e6, 2),
                    "delta_usd": round(a["usd"] - b["usd"], 2),
                    "delta_qualita": None if a["qualita"] is None or b["qualita"] is None
                    else round(a["qualita"] - b["qualita"], 1),
                })
    risultato = {"richiesta": banco.RICHIESTA, "rubrica": banco.CFG["rubrica"], "chiarimenti": chiarimenti,
                 "prove": prove, "coppie_wiki": coppie}
    banco.write_json(RUNS / "report-dati.json", risultato)
    return risultato


def narrativa():
    subprocess.run([
        "claude", "-p", PROMPT_NARRATIVA,
        "--model", banco.CFG["valutazione"]["model"], "--effort", "high",
        "--setting-sources", "project,local", "--permission-mode", "bypassPermissions",
        "--output-format", "json", "--add-dir", str(RUNS),
    ], cwd=RUNS, check=True, capture_output=True, text=True, env=banco.agent_env())


# ── HTML ─────────────────────────────────────────────────────────────────────

e = html.escape


def mln(token):
    return f"{token / 1e6:,.3f}".replace(",", "X").replace(".", ",").replace("X", ".")


def barra(prova):
    totale = sum(f["minuti"] for f in prova["fasi"]) or 1
    gruppi = {}
    for f in prova["fasi"]:
        gruppi[f["skill"]] = gruppi.get(f["skill"], 0) + f["minuti"]
    segmenti = "".join(
        f'<span title="{e(ETICHETTE_SKILL[s][0])} · {m:.1f} min" style="background:{ETICHETTE_SKILL[s][1]};width:{100 * m / totale:.2f}%"></span>'
        for s, m in gruppi.items())
    didascalie = "".join(f'<div><i style="background:{ETICHETTE_SKILL[s][1]}"></i>{e(ETICHETTE_SKILL[s][0])} · {m:.1f} min</div>'
                         for s, m in gruppi.items())
    return f'<div class="bar">{segmenti}</div><div class="phase-caption">{didascalie}</div>'


def riferimento(prove, prova):
    base = next((p for p in prove if p["model"] == prova["model"] and p["config"] == "C3"), None)
    return f'{prova["minuti"] / base["minuti"]:.2f}× C3' if base and base["minuti"] else ""


def tabella_overview(prove):
    righe = []
    for p in prove:
        flusso = FLUSSI[p["pipeline"]] + (" → archetipo-wiki refresh" if p["wiki"] and p["pipeline"] != "completo" else "")
        righe.append(
            f'<tr data-model="{p["model"]}"><td><a href="#{p["id"]}">{e(p["label"])}</a><small>{"con" if p["wiki"] else "senza"} Wiki · {p["config"]}</small></td>'
            f'<td>{p["model"].capitalize()}</td><td class="num">{p["minuti"]:.1f}<small>{riferimento(prove, p)}</small></td>'
            f'<td class="num">{"n.d." if p["qualita"] is None else p["qualita"]}<small>{", ".join(p["violazioni_critiche"] or []) or "nessuna violazione critica"}</small></td>'
            f'<td class="num">{mln(p["token"].get("total", 0))}<small>milioni</small></td><td class="num">{p["usd"]:.2f}<small>USD</small></td>'
            f'<td class="skill-flow">{e(flusso)}</td><td>{barra(p)}</td></tr>')
    legenda = "".join(f'<span><i style="background:{c}"></i>{e(n)}</span>' for n, c in ETICHETTE_SKILL.values())
    return (
        '<label>Modello<select id="filtro"><option value="">Entrambi</option>'
        + "".join(f'<option value="{m}">{m.capitalize()}</option>' for m in banco.CFG["models"])
        + '</select></label><div class="scroll"><table id="results"><thead><tr><th>Percorso</th><th>Modello</th>'
        '<th class="num">Prima consegna<br>min</th><th class="num">Qualità funzionale<br>/100</th><th class="num">Token totali<br>M</th>'
        '<th class="num">Costo<br>USD</th><th>Skill / processo eseguito</th><th>Distribuzione del tempo e skill per fase</th></tr></thead><tbody>'
        + "".join(righe) + f'</tbody></table></div><div class="legend">{legenda}</div>')


def tabella_token(prove):
    righe = "".join(
        f'<tr><td>{e(p["label"])} <small>{"con" if p["wiki"] else "senza"} Wiki</small></td><td>{p["model"].capitalize()}</td>'
        f'<td class="num">{mln(p["token"].get("total", 0))}</td><td class="num">{mln(p["token"].get("input_uncached", 0))}</td>'
        f'<td class="num">{mln(p["token"].get("cache_read", 0))}</td><td class="num">{mln(p["token"].get("cache_creation", 0))}</td>'
        f'<td class="num">{p["token"].get("output", 0) / 1000:,.1f}</td><td class="num">{p["usd"]:.2f}</td></tr>' for p in prove)
    return ('<div class="scroll"><table><thead><tr><th>Percorso</th><th>Modello</th><th class="num">Totale M</th>'
            '<th class="num">Input non cache M</th><th class="num">Cache read M</th><th class="num">Cache creation M</th>'
            f'<th class="num">Output k</th><th class="num">USD</th></tr></thead><tbody>{righe}</tbody></table></div>')


def tabella_wiki(prove, coppie):
    righe = []
    for p in prove:
        if not p["wiki"]:
            continue
        op, stato = p["wiki_operazioni"], p["wiki_stato"] or {}
        quota = 100 * op["token_solo_wiki"] / max(p["token"].get("total", 1), 1)
        giudice = stato.get("giudice") or {}
        righe.append(
            f'<tr><td>{e(p["label"])}</td><td>{p["model"].capitalize()}</td>'
            f'<td class="num">{p["fase_wiki"]["minuti"]:.1f}<small>{p["fase_wiki"]["usd"]:.2f} USD</small></td>'
            f'<td class="num">{op["chiamate"]}<small>{op["secondi_tool"]:.0f} s nei tool</small></td>'
            f'<td class="num">{mln(op["token_solo_wiki"])}<small>{quota:.1f}% del percorso</small></td>'
            f'<td class="num">{mln(op["token_misti"])}</td>'
            f'<td>{"✓" if stato.get("validate_ok") else "✗"} validate<small>{len(stato.get("candidate_non_aggiornate", []))} pagine candidate non aggiornate</small></td>'
            f'<td>{"✓" if giudice.get("decisione_superata") else "✗"} ADR su RF-15<small>{giudice.get("affermazioni_false", "n.d.")} affermazioni false</small></td></tr>')
    coppie_html = "".join(
        f'<tr><td>{c["modello"].capitalize()}</td><td>{c["con"]} − {c["senza"]}</td><td class="num">{c["delta_minuti"]:+.1f}</td>'
        f'<td class="num">{c["delta_token_m"]:+.2f}</td><td class="num">{c["delta_usd"]:+.2f}</td>'
        f'<td class="num">{"n.d." if c["delta_qualita"] is None else f"{c["delta_qualita"]:+.1f}"}</td></tr>' for c in coppie)
    return (
        '<h3>Costo della Wiki per percorso</h3><div class="scroll"><table><thead><tr><th>Percorso</th><th>Modello</th>'
        '<th class="num">Fase dedicata<br>min</th><th class="num">Operazioni Wiki<br>nelle fasi</th><th class="num">Token turni solo Wiki<br>M</th>'
        '<th class="num">Token turni misti<br>M</th><th>Stato a fine consegna</th><th>Decisione e accuratezza</th></tr></thead><tbody>'
        + "".join(righe) + '</tbody></table></div><p class="muted">Fase dedicata = archetipo-wiki refresh (misura esatta). '
        'Operazioni Wiki = chiamate a <code>archetipo wiki</code> e letture/scritture su <code>docs/wiki/</code> in tutte le fasi, chiarimento incluso. '
        'Token dei turni solo Wiki = usage delle chiamate al modello che hanno emesso esclusivamente operazioni Wiki: è una stima per turni, '
        'i turni misti sono riportati a parte e non ripartiti.</p>'
        '<h3>Coppie che isolano la Wiki</h3><div class="scroll"><table><thead><tr><th>Modello</th><th>Coppia</th>'
        '<th class="num">Δ min</th><th class="num">Δ token M</th><th class="num">Δ USD</th><th class="num">Δ qualità</th></tr></thead><tbody>'
        + coppie_html + '</tbody></table></div>')


def tabella_qualita(prove, rubrica):
    intestazione = "".join(f'<th class="num">{e(a)}<br><small>{p}</small></th>' for a, p in rubrica.items())
    righe = []
    for p in prove:
        aree = p["aree"] or {}
        celle = "".join(
            f'<td class="num">{aree[a]["punti"]:g}<small>{aree[a]["superati"]}/{aree[a]["eseguiti"]}</small></td>' if a in aree
            else '<td class="num">n.d.</td>' for a in rubrica)
        righe.append(f'<tr><td>{e(p["label"])} <small>{p["model"].capitalize()} · {"con" if p["wiki"] else "senza"} Wiki</small></td>'
                     f'{celle}<td class="num"><strong>{"n.d." if p["qualita"] is None else p["qualita"]}</strong></td></tr>')
    return (f'<div class="scroll"><table class="resource-table"><thead><tr><th>Percorso</th>{intestazione}<th class="num">Totale</th></tr></thead>'
            f'<tbody>{"".join(righe)}</tbody></table></div>')


def dettaglio(prova):
    righe = "".join(
        f'<tr><td>{e(f["fase"])}</td><td>{e(ETICHETTE_SKILL[f["skill"]][0])}</td><td class="num">{f["minuti"]:.1f}</td>'
        f'<td class="num">{mln(f["token"].get("total", 0))}</td><td class="num">{mln(f["token"].get("input_uncached", 0))}</td>'
        f'<td class="num">{mln(f["token"].get("cache_read", 0) + f["token"].get("cache_creation", 0))}</td>'
        f'<td class="num">{f["token"].get("output", 0) / 1000:,.1f}</td><td class="num">{f["usd"]:.2f}</td>'
        f'<td class="num">{f["wiki_chiamate"]}</td><td>{e(f["esito_spec"] or "")}</td></tr>' for f in prova["fasi"])
    falliti = "".join(f"<li><strong>{e(k)}</strong> {e(t)}</li>" for k, t in sorted(prova["controlli_falliti"].items()))
    return (
        f'<details id="{prova["id"]}"><summary>{prova["model"].capitalize()} · {e(prova["label"])} · {"con" if prova["wiki"] else "senza"} Wiki · '
        f'{prova["minuti"]:.1f} min · {mln(prova["token"].get("total", 0))} M token · {prova["usd"]:.2f} USD</summary><div class="inside">'
        f'<p class="muted">Storie: {", ".join(prova["codes"])} · {e(prova["diffstat"])}. Il chiarimento condiviso è incluso una volta. '
        f'Prove: <a href="{e(prova["cartella"])}">{e(prova["cartella"])}</a></p>'
        '<div class="scroll"><table class="resource-table"><thead><tr><th>Fase</th><th>Skill / metodo</th><th class="num">Min attivi</th>'
        '<th class="num">Token M</th><th class="num">Input non cache M</th><th class="num">Input cache M</th><th class="num">Output k</th>'
        f'<th class="num">USD</th><th class="num">Op. Wiki</th><th>Stato spec dopo</th></tr></thead><tbody>{righe}</tbody></table></div>'
        f'<h3>Prima consegna: controlli falliti</h3><ul>{falliti or "<li>Nessuno.</li>"}</ul></div></details>')


def sezione(titolo, corpo):
    return f"<section><h2>{e(titolo)}</h2>{corpo}</section>"


def genera_html(d, testi):
    prove = d["prove"]
    t = lambda chiave: testi.get(chiave, '<p class="muted">Narrativa non ancora generata.</p>')
    chiarimenti = "".join(
        f'<li><strong>{e(c["id"])}</strong>: {len(c["codes"])} storie ({", ".join(c["codes"])}), {c["metrics"].get("exchanges", "?")} scambi, '
        f'{c["metrics"]["duration_ms"] / 60000:.1f} min, {c["metrics"]["cost_usd"]:.2f} USD · <a href="{e(c["dialogo"])}">dialogo</a></li>'
        for c in d["chiarimenti"].values())
    rubrica = "".join(f"<tr><td>{e(a)}</td><td class='num'>{p}</td></tr>" for a, p in d["rubrica"].items())
    corpo = "".join([
        f'<header><div class="tag">Coaching Planner · Esperimento esplorativo · {len(prove)} prove</div>'
        '<h1>ARchetipo e la Wiki, dal requisito vago alla consegna</h1>'
        f'<p>Richiesta iniziale: «{e(d["richiesta"])}»</p><p>Cinque configurazioni (completo; storie → diretto con e senza Wiki; '
        'senza piano con e senza Wiki) con Sonnet e Opus, stesso effort.</p></header>',
        sezione("Cosa emerge", t("cosa_emerge")),
        sezione("Overview delle run: tempi, qualità, token, costo e skill",
                '<p class="muted">Minuti di lavoro attivo fino alla consegna, inclusi strumenti, test e subagenti; attese del committente simulato '
                'escluse. Il chiarimento è condiviso per modello e variante Wiki ed è aggiunto una volta a ogni percorso che lo riusa: '
                'non sommare le righe.</p>' + tabella_overview(prove)),
        sezione("Quanti token e quanto costo ha consumato ogni percorso", tabella_token(prove) +
                '<p class="muted">Totale = input non in cache + cache read + cache creation + output, dal <code>modelUsage</code> di Claude Code '
                '(subagenti inclusi), verificato contro i transcript. Il costo è quello riportato da Claude Code a prezzi di listino.</p>'),
        sezione("Incidenza della Wiki", tabella_wiki(prove, d["coppie_wiki"]) + t("wiki")),
        sezione("Tempi e consumi per skill e per singola fase", "".join(dettaglio(p) for p in prove)),
        sezione("Come è stata verificata la qualità",
                '<p>Oracolo esterno comune sulla prima consegna immutata (hash dell\'albero verificato): Postgres reale, server action '
                'invocate con sessioni firmate sintetiche, browser Chromium contro <code>next start</code>, gate di regressione della CI. '
                'Un adattatore per consegna, generato da un agente fisso e conservato, collega i controlli alle interfacce prodotte senza '
                'implementare capacità mancanti.</p>'
                f'<table><thead><tr><th>Area</th><th class="num">Punti</th></tr></thead><tbody>{rubrica}</tbody></table>'
                '<p class="muted">Punti area = peso × controlli superati / controlli eseguiti; regressioni tutto-o-niente. Le violazioni '
                'critiche (scrittura in mese chiuso, chiusura da non amministratore) sono riportate separatamente.</p>'
                + tabella_qualita(prove, d["rubrica"])),
        sezione("Come interpretare i risultati", t("interpretazione")),
        sezione("Che cosa è stato chiarito prima dello sviluppo", f"<ul>{chiarimenti}</ul>" + t("chiarimento")),
        sezione("Quale lavoro ha intercettato problemi", t("problemi_intercettati")),
        sezione("Quando conviene la Wiki", t("quando_wiki")),
        sezione("Cosa cambiare in ARchetipo", t("cosa_cambiare")),
        sezione("Metodo e limiti",
                "<ul><li>Una funzionalità, una prova per combinazione, ordine fisso: risultati esplorativi, non stime statistiche.</li>"
                "<li>Il committente è simulato da un profilo fissato prima delle prove e risponde solo ai temi sollevati.</li>"
                "<li>Il beneficio di una Wiki mantenuta si vede soprattutto sulla funzionalità successiva: qui si misurano il costo di "
                "mantenerla e il beneficio di leggerne una già matura.</li>"
                "<li>L'attribuzione dei token alle operazioni Wiki dentro le fasi è una stima per turni.</li>"
                "<li>Login OAuth non verificato; il browser esegue click DOM, non prove di usabilità con persone.</li></ul>"),
    ])
    script = ("<script>document.getElementById('filtro').addEventListener('change',function(){var v=this.value;"
              "document.querySelectorAll('#results tbody tr').forEach(function(r){r.hidden=v&&r.dataset.model!==v;});});</script>")
    return (f'<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>ARchetipo e Wiki: dal requisito vago alla consegna</title><style>{CSS}</style></head><body><main>{corpo}'
            f'<footer>Generato da bench/wiki-benchmark/report.py</footer></main>{script}</body></html>')


def main(argv):
    comando = argv[0] if argv else "tutto"
    d = dati() if comando in ("tutto", "dati") else leggi(RUNS / "report-dati.json")
    if comando == "dati":
        return print(RUNS / "report-dati.json")
    if comando == "tutto":
        narrativa()
    testi = leggi(RUNS / "narrativa.json", {})
    (RUNS / "report.html").write_text(genera_html(d, testi))
    print(RUNS / "report.html")


if __name__ == "__main__":
    main(sys.argv[1:])
