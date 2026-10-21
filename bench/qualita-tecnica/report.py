#!/usr/bin/env python3
"""Report 4 · «Il codice in più del percorso completo vale qualcosa?» (slug qualita-tecnica).

Uso (dalla radice del repository):
  python3 bench/common/tecnica.py punteggi            # ricalcola i punteggi → $BENCH_RUNS/tecnica-tutti.json
  python3 bench/qualita-tecnica/report.py             # dati.json + report.html in bench/reports/qualita-tecnica/

I numeri vengono solo da tecnica-tutti.json (misure di bench/common/tecnica.py) e dai metrics.json dei giudici.
La narrativa è in narrativa.json accanto a questo file: interpreta i numeri e non può aggiungerne.
"""
import json
import os
import random
import statistics
import sys
from pathlib import Path

BENCH = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BENCH))
from common import html as h  # noqa: E402

RUNS = Path(os.environ.get("BENCH_RUNS", BENCH.parent.parent / "coaching-planner-bench-runs"))
OUT = BENCH / "reports" / "qualita-tecnica"
TUTTI = json.loads((RUNS / "tecnica-tutti.json").read_text())
NARRATIVA = json.loads((Path(__file__).parent / "narrativa.json").read_text()) if (Path(__file__).parent / "narrativa.json").exists() else {}
CONTROLLI = json.loads((BENCH / "common" / "controlli.json").read_text())
e = h.e

ETICHETTE = {"C1": "ARchetipo completo", "C2": "Solo storie → diretto", "C3": "Solo storie → diretto, senza Wiki", "C4": "Senza piano",
             "C5": "Senza piano, senza Wiki", "PW": "Piano → implement", "PN": "Piano → implement, senza Wiki", "DN": "Diretto, senza Wiki"}
FLUSSI = {"C1": "archetipo-spec → archetipo-plan → archetipo-implement → archetipo-review", "C2": "archetipo-spec → sviluppo diretto → archetipo-wiki refresh",
          "C3": "archetipo-spec → sviluppo diretto", "C4": "archetipo-spec → sviluppo diretto → archetipo-wiki refresh → archetipo-review",
          "C5": "archetipo-spec → sviluppo diretto → archetipo-review", "PW": "archetipo-plan → archetipo-implement (storie fisse)",
          "PN": "archetipo-plan → archetipo-implement (storie fisse, senza Wiki)", "DN": "sviluppo diretto (storie fisse, senza Wiki)"}
COLORE_CELLA = {"C1": "#3c9c85", "C2": "#5aa9d6", "C3": "#9fcbe6", "C4": "#d49d32", "C5": "#e8c98a", "PW": "#8164c6", "PN": "#b7a6e0", "DN": "#8a9a9f"}
AREE = [("dimensione", "Dimensione e focalizzazione", 20), ("complessita", "Complessità", 15), ("duplicazione", "Duplicazione", 10),
        ("mutation", "Mutation score", 25), ("copertura_percorsi", "Copertura dei percorsi", 5), ("convenzioni", "Convenzioni del repo", 15),
        ("tipi", "Tipi e sicurezza statica", 10)]
CATEGORIE = {**h.CATEGORIE_DIFF}
ARMI = {"completo": ["C1"], "diretto": ["C2", "DN"], "piano": ["PW", "PN"], "senza_piano": ["C2", "DN"]}
SEME = 20261021


def score_mutanti(per_file, filtro):
    """Mutation score sui soli file che soddisfano il filtro (NoCoverage conta come non rilevato)."""
    k = sum(v.get("Killed", 0) + v.get("Timeout", 0) for f, v in per_file.items() if filtro(f))
    tot = k + sum(v.get("Survived", 0) + v.get("NoCoverage", 0) for f, v in per_file.items() if filtro(f))
    return round(100 * k / tot, 1) if tot else None


def consegne():
    elenco = sorted(TUTTI["consegne"], key=lambda c: (c["model"], list(ETICHETTE).index(c["config"]), c["prova"]))
    for c in elenco:
        pf = c.get("mutanti_per_file") or {}
        c["mutation_ts"] = score_mutanti(pf, lambda f: not f.endswith(".tsx"))
        c["mutation_tsx"] = score_mutanti(pf, lambda f: f.endswith(".tsx"))
        c["mutanti_senza_copertura_tsx"] = sum(v.get("NoCoverage", 0) for f, v in pf.items() if f.endswith(".tsx"))
    return elenco


def stat(valori):
    v = [x for x in valori if x is not None]
    if not v:
        return {"n": 0, "mediana": None, "min": None, "max": None, "media": None, "sd": None}
    return {"n": len(v), "mediana": round(statistics.median(v), 1), "min": round(min(v), 1), "max": round(max(v), 1),
            "media": round(statistics.mean(v), 1), "sd": round(statistics.stdev(v), 1) if len(v) > 1 else None}


def bootstrap_differenza(a, b, ricampionamenti=10000):
    """IC 95 % della differenza media(a) − media(b) ricampionando dentro ciascun gruppo (gruppi non appaiati)."""
    if not a or not b:
        return None
    rnd = random.Random(SEME)
    diffs = sorted(statistics.mean(rnd.choices(a, k=len(a))) - statistics.mean(rnd.choices(b, k=len(b))) for _ in range(ricampionamenti))
    return {"delta": round(statistics.mean(a) - statistics.mean(b), 1), "ic95": [round(diffs[int(0.025 * len(diffs))], 1), round(diffs[int(0.975 * len(diffs))], 1)],
            "n": [len(a), len(b)]}


def pearson(xs, ys):
    coppie = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    if len(coppie) < 3:
        return None
    xs, ys = zip(*coppie)
    mx, my = statistics.mean(xs), statistics.mean(ys)
    num = sum((x - mx) * (y - my) for x, y in coppie)
    den = (sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)) ** 0.5
    return round(num / den, 2) if den else None


def costo_giudici():
    voci, totale = [], 0.0
    for p in sorted(RUNS.glob("*/tecnica/giudice-*.json")):
        d = json.loads(p.read_text())
        c = d.get("cost_usd") or 0
        totale += c
        voci.append({"prova": p.parent.parent.name, "file": p.name, "usd": round(c, 3), "scartata": "scartat" in p.name})
    return {"voci": voci, "totale": round(totale, 2), "scartate": round(sum(v["usd"] for v in voci if v["scartata"]), 2)}


def dati():
    elenco = consegne()
    per_cella, per_modello = {}, {}
    for c in elenco:
        per_cella.setdefault((c["model"], c["config"]), []).append(c)
        per_modello.setdefault(c["model"], []).append(c)
    celle = []
    for (modello, config), lista in sorted(per_cella.items()):
        celle.append({"model": modello, "config": config, "n": len(lista),
                      "tecnico": stat([c["punteggio"]["totale"] for c in lista]), "funzionale": stat([c["qualita_funzionale"] for c in lista]),
                      "mutation": stat([c["mutation_score"] * 100 if c["mutation_score"] is not None else None for c in lista]),
                      "mutation_ts": stat([c["mutation_ts"] for c in lista]), "mutation_tsx": stat([c["mutation_tsx"] for c in lista]),
                      "righe_src": stat([c["righe_nette_src"] for c in lista]), "righe_totali": stat([c["righe_aggiunte_totali"] for c in lista])})
    confronti = []
    for modello in sorted(per_modello):
        gruppo = lambda configs: [c for c in per_modello[modello] if c["config"] in configs and c["discovery"].endswith("-wiki")]
        for nome, a, b in (("completo − diretto", "completo", "diretto"), ("con piano − senza piano", "piano", "senza_piano")):
            ga, gb = gruppo(ARMI[a]), gruppo(ARMI[b])
            confronti.append({"modello": modello, "confronto": nome, "a": [c["prova"] for c in ga], "b": [c["prova"] for c in gb],
                              "tecnico": bootstrap_differenza([c["punteggio"]["totale"] for c in ga], [c["punteggio"]["totale"] for c in gb]),
                              "funzionale": bootstrap_differenza([c["qualita_funzionale"] for c in ga], [c["qualita_funzionale"] for c in gb]),
                              "righe_src": bootstrap_differenza([c["righe_nette_src"] for c in ga], [c["righe_nette_src"] for c in gb]),
                              "mutation": bootstrap_differenza([100 * c["mutation_score"] for c in ga if c["mutation_score"] is not None],
                                                               [100 * c["mutation_score"] for c in gb if c["mutation_score"] is not None])})
    tutte = lambda chiave: [c[chiave] for c in elenco]
    for nome in ("completo − diretto",):
        ga = [c for c in elenco if c["config"] in ARMI["completo"]]
        gb = [c for c in elenco if c["config"] in ARMI["diretto"] and c["discovery"].endswith("-wiki")]
        confronti.append({"modello": "entrambi", "confronto": nome, "a": [c["prova"] for c in ga], "b": [c["prova"] for c in gb],
                          "tecnico": bootstrap_differenza([c["punteggio"]["totale"] for c in ga], [c["punteggio"]["totale"] for c in gb]),
                          "funzionale": bootstrap_differenza([c["qualita_funzionale"] for c in ga], [c["qualita_funzionale"] for c in gb]),
                          "righe_src": bootstrap_differenza([c["righe_nette_src"] for c in ga], [c["righe_nette_src"] for c in gb]),
                          "mutation": bootstrap_differenza([100 * c["mutation_score"] for c in ga], [100 * c["mutation_score"] for c in gb])})
    categorie_totali = {}
    for c in elenco:
        for cat, v in c["righe_per_categoria"].items():
            categorie_totali[cat] = categorie_totali.get(cat, 0) + v["ins"]
    tot_ins = sum(categorie_totali.values()) or 1
    accordo = []
    for c in elenco:
        g = [x for x in c["giudizi"] if x]
        if len(g) == 2:
            uguali = sum(1 for k in g[0]["copertura"] if g[0]["copertura"][k]["coperto"] == g[1]["copertura"][k]["coperto"])
            accordo.append({"prova": c["prova"], "quota": round(uguali / len(g[0]["copertura"]), 3),
                            "factory": g[0]["factory_fixtures"]["valore"] == g[1]["factory_fixtures"]["valore"],
                            "blocco": g[0]["blocco_condiviso"]["valore"] == g[1]["blocco_condiviso"]["valore"]})
    return {
        "consegne": elenco, "celle": celle, "confronti": confronti, "mediane_coorte": TUTTI["mediane_coorte"],
        "correlazioni": {"tecnico_funzionale": pearson(tutte("qualita_funzionale"), [c["punteggio"]["totale"] for c in elenco]),
                         "tecnico_righe_src": pearson(tutte("righe_nette_src"), [c["punteggio"]["totale"] for c in elenco]),
                         "funzionale_righe_src": pearson(tutte("righe_nette_src"), tutte("qualita_funzionale")),
                         "mutation_test_unit": pearson([c["numero_test"]["test_unit"] for c in elenco], [c["mutation_score"] for c in elenco]),
                         "mutation_righe_src": pearson(tutte("righe_nette_src"), [c["mutation_score"] for c in elenco]), "n": len(elenco)},
        "righe_per_punto": {c["prova"]: round(c["righe_aggiunte_totali"] / c["qualita_funzionale"], 1) for c in elenco if c["qualita_funzionale"]},
        "categorie_totali": {k: {"righe": v, "quota": round(100 * v / tot_ins, 1)} for k, v in sorted(categorie_totali.items(), key=lambda kv: -kv[1])},
        "accordo_giudice": accordo, "accordo_medio": round(statistics.mean(a["quota"] for a in accordo), 3) if accordo else None,
        "costo": costo_giudici(), "seme_bootstrap": SEME,
    }


# ── HTML ─────────────────────────────────────────────────────────────────────

def fmt(v, d=1):
    return "n.d." if v is None else f"{v:.{d}f}"


def nome_cella(c):
    return f'{c["model"].capitalize()} · {ETICHETTE[c["config"]]}'


def barra_diff(c):
    return h.barra([(et, col, c["righe_per_categoria"].get(cat, {}).get("ins", 0)) for cat, (et, col) in CATEGORIE.items()], "righe")


def tiles(d):
    cd = next(x for x in d["confronti"] if x["modello"] == "entrambi")
    rpp = statistics.median(d["righe_per_punto"].values())
    ms = {c["config"]: c["mutation"]["media"] for c in d["celle"] if c["model"] == "sonnet"}
    cat = d["categorie_totali"]
    app = cat.get("applicativo", {}).get("quota", 0) + cat.get("ui", {}).get("quota", 0)
    test = cat.get("test_unit", {}).get("quota", 0) + cat.get("test_e2e", {}).get("quota", 0)
    stato = cat.get("wiki", {}).get("quota", 0) + cat.get("archetipo", {}).get("quota", 0)
    t = cd["tecnico"]
    return '<div class="tiles">' + "".join([
        h.tile(f'{t["delta"]:+.1f}', f'Δ punteggio tecnico completo − diretto, entrambi i modelli (IC 95 % bootstrap {t["ic95"][0]:+.1f} … {t["ic95"][1]:+.1f}; n = {t["n"][0]} contro {t["n"][1]})'),
        h.tile(f'{rpp:.0f}', 'righe aggiunte per punto funzionale, mediana delle 20 consegne (tutte le categorie, lockfile escluso)'),
        h.tile(f'{fmt(ms.get("C1"), 0)} / {fmt(ms.get("C2"), 0)}', 'mutation score medio, Sonnet: ARchetipo completo / solo storie → diretto (test unit della consegna sui file src toccati)'),
        h.tile(f'{app:.0f} · {test:.0f} · {stato:.0f} %', 'quota delle righe aggiunte in codice applicativo e UI · test · Wiki e stato ARchetipo, su tutte le consegne'),
    ]) + "</div>"


def tabella_overview(d):
    righe = []
    for c in d["consegne"]:
        p = c["punteggio"]
        righe.append(
            f'<tr data-model="{c["model"]}" data-arm="{c["config"]}" data-tokens="0"><td><a href="#{c["prova"]}">{e(ETICHETTE[c["config"]])}</a><small>{e(c["prova"])} · storie {e(c["discovery"])}</small></td>'
            f'<td>{c["model"].capitalize()}</td><td class="num">{fmt(c["qualita_funzionale"])}<small>falliti: {", ".join(c["controlli_falliti"]) or "nessuno"}</small></td>'
            f'<td class="num"><strong>{fmt(p["totale"])}</strong><small>mutation {fmt(100 * c["mutation_score"] if c["mutation_score"] is not None else None, 0)} · conv. {p["aree"]["convenzioni"]:.0f}/15</small></td>'
            f'<td class="num">{c["righe_nette_src"]}<small>mediana coorte {d["mediane_coorte"][c["discovery"]]:.0f}</small></td>'
            f'<td class="num">{c["righe_aggiunte_totali"]}<small>{d["righe_per_punto"].get(c["prova"], "n.d.")} per punto</small></td>'
            f'<td class="num">{c["numero_test"]["test_unit"]} / {c["numero_test"]["test_e2e"]}</td>'
            f'<td class="skill-flow">{e(FLUSSI[c["config"]])}</td><td>{barra_diff(c)}</td></tr>')
    return ('<label>Modello<select id="model"><option value="">Entrambi</option><option value="sonnet">Sonnet</option><option value="opus">Opus</option></select></label>'
            '<div class="scroll"><table id="results"><thead><tr><th>Percorso</th><th>Modello</th><th class="num">Qualità funzionale<br>/100</th><th class="num">Qualità tecnica<br>/100</th>'
            '<th class="num">Righe nette<br>src</th><th class="num">Righe aggiunte<br>totali</th><th class="num">Test aggiunti<br>unit / e2e</th><th>Skill / processo eseguito</th>'
            '<th>Composizione del diff per categoria</th></tr></thead><tbody>' + "".join(righe) + '</tbody></table></div>' + h.legenda_diff() +
            '<p class="muted">In questo report la barra mostra la <strong>composizione del diff</strong> (righe aggiunte per categoria, lockfile escluso) invece del tempo per fase: '
            'stessa grafica dei report sulle run, legenda dedicata. Righe nette src = aggiunte − rimosse in <code>src/</code> esclusi test e migrazioni; la mediana della coorte '
            '(stesse storie di partenza) è il riferimento della voce «Dimensione».</p>')


def tabella_celle(d):
    righe = "".join(
        f'<tr><td>{c["model"].capitalize()}</td><td>{e(ETICHETTE[c["config"]])} <small>{c["config"]}</small></td><td class="num">{c["n"]}</td>'
        f'<td class="num">{fmt(c["tecnico"]["mediana"])}<small>{fmt(c["tecnico"]["min"])}–{fmt(c["tecnico"]["max"])}</small></td>'
        f'<td class="num">{fmt(c["funzionale"]["mediana"])}<small>{fmt(c["funzionale"]["min"])}–{fmt(c["funzionale"]["max"])}</small></td>'
        f'<td class="num">{fmt(c["mutation"]["mediana"], 0)}<small>{fmt(c["mutation"]["min"], 0)}–{fmt(c["mutation"]["max"], 0)}</small></td>'
        f'<td class="num">{fmt(c["mutation_ts"]["mediana"], 0)} / {fmt(c["mutation_tsx"]["mediana"], 0)}</td>'
        f'<td class="num">{fmt(c["righe_src"]["mediana"], 0)}<small>{fmt(c["righe_src"]["min"], 0)}–{fmt(c["righe_src"]["max"], 0)}</small></td>'
        f'<td class="num">{fmt(c["righe_totali"]["mediana"], 0)}<small>{fmt(c["righe_totali"]["min"], 0)}–{fmt(c["righe_totali"]["max"], 0)}</small></td></tr>' for c in d["celle"])
    return ('<div class="scroll"><table><thead><tr><th>Modello</th><th>Cella</th><th class="num">n</th><th class="num">Tecnico<br>mediana (min–max)</th>'
            '<th class="num">Funzionale<br>mediana (min–max)</th><th class="num">Mutation score %</th><th class="num">Mutation %<br>file .ts / .tsx</th><th class="num">Righe nette src</th><th class="num">Righe aggiunte totali</th></tr></thead>'
            f'<tbody>{righe}</tbody></table></div><p class="muted">Una cella con n = 1 è un\'osservazione, non una stima (criteri §2.5).</p>')


def tabella_confronti(d):
    def cella(b):
        return "n.d." if not b else f'{b["delta"]:+.1f}<small>IC 95 % {b["ic95"][0]:+.1f} … {b["ic95"][1]:+.1f} · n {b["n"][0]} vs {b["n"][1]}</small>'
    righe = "".join(
        f'<tr><td>{e(x["modello"].capitalize())}</td><td>{e(x["confronto"])}<small>{", ".join(x["a"])} contro {", ".join(x["b"])}</small></td>'
        f'<td class="num">{cella(x["tecnico"])}</td><td class="num">{cella(x["funzionale"])}</td><td class="num">{cella(x["mutation"])}</td><td class="num">{cella(x["righe_src"])}</td></tr>'
        for x in d["confronti"])
    return ('<div class="scroll"><table><thead><tr><th>Modello</th><th>Confronto a storie uguali</th><th class="num">Δ tecnico</th><th class="num">Δ funzionale</th>'
            f'<th class="num">Δ mutation %</th><th class="num">Δ righe nette src</th></tr></thead><tbody>{righe}</tbody></table></div>'
            f'<p class="muted">Differenza di medie fra gruppi (a − b) con intervallo bootstrap al 95 % (10 000 ricampionamenti dentro ciascun gruppo, seme {d["seme_bootstrap"]}). '
            'I gruppi non sono appaiati per replica: «completo» ha una sola consegna per modello. Con n così piccoli l\'intervallo descrive il campione, non la popolazione.</p>')


def tabella_metriche(d):
    intestazione = "".join(f'<th class="num">{e(t)}<br><small>{p}</small></th>' for _, t, p in AREE)
    righe = []
    for c in d["consegne"]:
        p = c["punteggio"]
        celle = "".join(f'<td class="num">{p["aree"][k]:g}</td>' for k, _, _ in AREE)
        dettagli = (f'righe {c["righe_nette_src"]} · funz. oltre 10: {c["complessita"].get("oltre_soglia", 0)}/{c["funzioni_toccate"]} max {c["complessita"].get("massima")} · '
                    f'dup {c["duplicazione"]["percentuale"]} % · mut {fmt(100 * c["mutation_score"] if c["mutation_score"] is not None else None, 0)} % · '
                    f'copertura {p["copertura_quota"]:.2f} · tipi violate {p["tipi_voci_violate"]}')
        righe.append(f'<tr><td><a href="#{c["prova"]}">{e(c["prova"])}</a><small>{e(nome_cella(c))}</small></td>{celle}<td class="num"><strong>{p["totale"]}</strong><small>{e(dettagli)}</small></td></tr>')
    return (f'<div class="scroll"><table class="resource-table"><thead><tr><th>Consegna</th>{intestazione}<th class="num">Totale</th></tr></thead><tbody>{"".join(righe)}</tbody></table></div>')


def scatter(d):
    W, H, ml, mb, mt, mr = 760, 420, 50, 44, 16, 20
    xs = [c["qualita_funzionale"] for c in d["consegne"]]
    ys = [c["punteggio"]["totale"] for c in d["consegne"]]
    x0, x1 = min(xs) - 2, max(xs) + 2
    y0, y1 = min(ys) - 4, max(ys) + 4
    sx = lambda v: ml + (v - x0) / (x1 - x0) * (W - ml - mr)
    sy = lambda v: H - mb - (v - y0) / (y1 - y0) * (H - mt - mb)
    griglia = ""
    for v in range(int(x0), int(x1) + 1):
        if v % 2 == 0:
            griglia += f'<line x1="{sx(v):.1f}" y1="{mt}" x2="{sx(v):.1f}" y2="{H - mb}" stroke="#e5ebe8"/><text x="{sx(v):.1f}" y="{H - mb + 16}" font-size="11" text-anchor="middle" fill="#61747c">{v}</text>'
    for v in range(int(y0), int(y1) + 1):
        if v % 5 == 0:
            griglia += f'<line x1="{ml}" y1="{sy(v):.1f}" x2="{W - mr}" y2="{sy(v):.1f}" stroke="#e5ebe8"/><text x="{ml - 6}" y="{sy(v) + 4:.1f}" font-size="11" text-anchor="end" fill="#61747c">{v}</text>'
    punti = ""
    for c in d["consegne"]:
        forma = "circle" if c["model"] == "sonnet" else "rect"
        x, y, col = sx(c["qualita_funzionale"]), sy(c["punteggio"]["totale"]), COLORE_CELLA[c["config"]]
        titolo = f'{c["prova"]} · funzionale {c["qualita_funzionale"]} · tecnico {c["punteggio"]["totale"]}'
        if forma == "circle":
            punti += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="{col}" stroke="#183a40" stroke-width="1"><title>{e(titolo)}</title></circle>'
        else:
            punti += f'<rect x="{x - 6:.1f}" y="{y - 6:.1f}" width="12" height="12" fill="{col}" stroke="#183a40" stroke-width="1"><title>{e(titolo)}</title></rect>'
        punti += f'<text x="{x + 9:.1f}" y="{y + 4:.1f}" font-size="10" fill="#22313a">{e(c["prova"])}</text>'
    legenda = "".join(f'<span><i style="background:{col}"></i>{e(ETICHETTE[k])} ({k})</span>' for k, col in COLORE_CELLA.items())
    return (f'<svg viewBox="0 0 {W} {H}" width="100%" style="max-width:{W}px;font-family:system-ui,sans-serif" role="img" aria-label="Qualità funzionale contro qualità tecnica">'
            f'{griglia}<text x="{(ml + W - mr) / 2:.0f}" y="{H - 6}" font-size="12" text-anchor="middle" fill="#486069">Qualità funzionale /100 (oracolo)</text>'
            f'<text transform="translate(14 {(mt + H - mb) / 2:.0f}) rotate(-90)" font-size="12" text-anchor="middle" fill="#486069">Qualità tecnica /100</text>{punti}</svg>'
            f'<div class="legend">{legenda}<span>● Sonnet · ■ Opus</span></div>'
            f'<p class="muted">Correlazione di Pearson su {d["correlazioni"]["n"]} consegne: tecnico × funzionale r = {d["correlazioni"]["tecnico_funzionale"]}; '
            f'tecnico × righe nette src r = {d["correlazioni"]["tecnico_righe_src"]}; funzionale × righe nette src r = {d["correlazioni"]["funzionale_righe_src"]}; '
            f'mutation score × numero di test unit aggiunti r = {d["correlazioni"]["mutation_test_unit"]}; mutation score × righe nette src r = {d["correlazioni"]["mutation_righe_src"]}.</p>')


def tabella_categorie(d):
    cats = list(CATEGORIE) + ["mockup"]
    intestazione = "".join(f'<th class="num">{e(CATEGORIE[c][0] if c in CATEGORIE else "Mockup")}</th>' for c in cats)
    righe = []
    for c in d["consegne"]:
        tot = sum(v["ins"] for v in c["righe_per_categoria"].values()) or 1
        celle = "".join(f'<td class="num">{c["righe_per_categoria"].get(k, {}).get("ins", 0)}<small>{100 * c["righe_per_categoria"].get(k, {}).get("ins", 0) / tot:.0f} %</small></td>' for k in cats)
        righe.append(f'<tr><td>{e(c["prova"])}<small>{e(nome_cella(c))}</small></td>{celle}<td class="num"><strong>{tot}</strong></td></tr>')
    totali = "".join(f'<td class="num"><strong>{d["categorie_totali"].get(k, {}).get("righe", 0)}</strong><small>{d["categorie_totali"].get(k, {}).get("quota", 0)} %</small></td>' for k in cats)
    return (f'<div class="scroll"><table class="resource-table"><thead><tr><th>Consegna</th>{intestazione}<th class="num">Totale</th></tr></thead><tbody>{"".join(righe)}'
            f'<tr><td><strong>Tutte</strong></td>{totali}<td class="num"><strong>{sum(v["righe"] for v in d["categorie_totali"].values())}</strong></td></tr></tbody></table></div>'
            '<p class="muted">Righe aggiunte rispetto alla baseline, per percorso e contenuto del file: codice applicativo = <code>src/**/*.ts</code> esclusi test; UI = <code>src/**/*.tsx</code>; '
            'test unit = <code>tests/unit/</code>; test e2e = <code>tests/e2e/</code>; migrazioni = <code>prisma/</code>; Wiki = <code>docs/wiki/</code>; '
            '<code>.archetipo/</code> = piani, backlog e stato; altro = README, docs non Wiki, configurazione. Il lockfile è escluso.</p>')


def dettaglio(c, d):
    p = c["punteggio"]
    g = [x for x in c["giudizi"] if x]
    copertura = ""
    for ctrl in CONTROLLI["controlli"]:
        k = ctrl["codice"]
        if g and k in g[0]["copertura"]:
            letture = [x["copertura"][k] for x in g]
            esito = " / ".join("✓" if l["coperto"] else "✗" for l in letture)
            test = next((l["test"] for l in letture if l["test"]), "")
            copertura += f'<tr><td><strong>{k}</strong> <small>{e(ctrl["verifica"])}</small></td><td>{esito}</td><td>{e(test)}</td></tr>'
    giudizi = "".join(
        f'<li><strong>Lettura {i + 1}</strong>: factory/fixtures <strong>{e(x["factory_fixtures"]["valore"])}</strong> ({e(x["factory_fixtures"]["evidenza"])}); '
        f'blocco condiviso <strong>{e(x["blocco_condiviso"]["valore"])}</strong> ({e(x["blocco_condiviso"]["evidenza"])})</li>' for i, x in enumerate(g))
    funzioni = "".join(f'<li>{e(f["file"])} · <code>{e(f["nome"])}</code> riga {f["riga"]} · complessità {f["complessita"]}</li>' for f in c["funzioni_oltre_soglia"])
    mut = c.get("mutanti") or {}
    violazioni = "".join(f'<li>{e(k)}: {e("; ".join(v))}</li>' for k, v in c["tipi"]["violazioni"].items() if v)
    note = "".join(f"<li>{e(n)}</li>" for n in p["note"])
    conv = "".join(f'<li>{e(k)}: {"n.a." if not v["applicabile"] else f"{v["punti"]:.1f}"}</li>' for k, v in p["convenzioni_voci"].items())
    return (
        f'<details id="{c["prova"]}"><summary>{e(nome_cella(c))} · {e(c["prova"])} · tecnico {p["totale"]} · funzionale {fmt(c["qualita_funzionale"])} · '
        f'{c["righe_nette_src"]} righe nette src</summary><div class="inside">'
        f'<p class="muted">Storie {", ".join(c["codes"])} da {e(c["discovery"])} · file src toccati: {len(c["file_src"])} · test aggiunti: {c["numero_test"]["test_unit"]} unit, {c["numero_test"]["test_e2e"]} e2e · '
        f'prove: ~/repo/coaching-planner-bench-runs/{e(c["prova"])}/tecnica/</p>'
        f'<h3>Punteggio per area</h3><ul>{"".join(f"<li>{e(t)}: <strong>{p['aree'][k]:g}</strong>/{pt}</li>" for k, t, pt in AREE)}</ul>'
        f'<h3>Mutation testing</h3><p>Score {fmt(100 * c["mutation_score"] if c["mutation_score"] is not None else None)} % · funzioni toccate {c["funzioni_toccate"]} su {c["complessita"].get("totale_funzioni_nei_file", "?")} nei file toccati; '
        f'mutanti: {e(json.dumps(mut, ensure_ascii=False))}. Sui soli file .ts {fmt(c["mutation_ts"])} %, sui componenti .tsx {fmt(c["mutation_tsx"])} % ({c["mutanti_senza_copertura_tsx"]} mutanti tsx senza copertura).</p>'
        f'<h3>Funzioni toccate oltre soglia di complessità 10</h3><ul>{funzioni or "<li>Nessuna.</li>"}</ul>'
        f'<h3>Copertura dei percorsi (giudice, due letture)</h3><div class="scroll"><table><thead><tr><th>Controllo</th><th>Letture</th><th>Test citato</th></tr></thead><tbody>{copertura}</tbody></table></div>'
        f'<h3>Checklist letta dal giudice</h3><ul>{giudizi or "<li>Nessuna lettura disponibile.</li>"}</ul>'
        f'<h3>Convenzioni (voci e punti)</h3><ul>{conv}</ul>'
        f'<h3>Tipi</h3><p>tsc: {c["tipi"]["tsc_errori"]} errori nella consegna, {c["tipi"]["tsc_errori_baseline"]} nella baseline, {c["tipi"]["tsc_nuovi"]} nuovi.</p><ul>{violazioni or "<li>Nessun any, as unknown as, @ts-ignore o eslint-disable nelle righe aggiunte.</li>"}</ul>'
        f'<h3>Note</h3><ul>{note or "<li>Nessuna.</li>"}</ul></div></details>')


def tabella_costo(d):
    costo = d["costo"]
    per_prova = {}
    for v in costo["voci"]:
        per_prova.setdefault(v["prova"], 0)
        per_prova[v["prova"]] += v["usd"]
    righe = "".join(f'<tr><td>Giudice Opus, {e(p)} (due letture{", più una scartata" if any(v["scartata"] and v["prova"] == p for v in costo["voci"]) else ""})</td><td class="num">{u:.2f}</td></tr>'
                    for p, u in sorted(per_prova.items()))
    return (f'<div class="scroll"><table><thead><tr><th>Voce</th><th class="num">USD</th></tr></thead><tbody>{righe}'
            f'<tr><td><strong>Totale giudici</strong> (di cui letture scartate {costo["scartate"]:.2f})</td><td class="num"><strong>{costo["totale"]:.2f}</strong></td></tr>'
            '<tr><td>Analisi statica e mutation testing (ESLint, jscpd, StrykerJS): nessun agente</td><td class="num">0.00</td></tr></tbody></table></div>')


def genera(d):
    t = lambda k: NARRATIVA.get(k, '<p class="muted">Narrativa non ancora scritta.</p>')
    n = len(d["consegne"])
    corpo = "".join([
        f'<header><div class="tag">Coaching Planner · Analisi statica e mutation testing · {n} consegne archiviate</div>'
        '<h1>Il codice in più del percorso completo vale qualcosa?</h1>'
        '<p>Nessun agente di sviluppo: le consegne sono quelle già archiviate dai report 0b e 0c (hash dell\'albero verificato). Per ciascuna: classificazione del diff, '
        'complessità (ESLint), duplicazione (jscpd), mutation testing (StrykerJS con il runner Vitest sui file src toccati), copertura dei percorsi e due voci di checklist '
        'lette da un giudice Opus in due letture, tipi (tsc e pattern). Punteggio tecnico secondo i <a href="../../index.html#criterio-tecnico">criteri comuni §2.2</a>.</p></header>',
        h.sezione("Cosa emerge", tiles(d) + t("cosa_emerge")),
        h.sezione("Overview delle consegne: qualità funzionale, qualità tecnica e composizione del diff", tabella_overview(d)),
        h.sezione("Per cella e confronti a storie uguali", tabella_celle(d) + "<h3>Confronti</h3>" + tabella_confronti(d) + t("confronti")),
        h.sezione("Funzionale × tecnico", scatter(d) + t("scatter")),
        h.sezione("Dove va il codice in più", tabella_categorie(d) + t("dove_va")),
        h.sezione("Metriche per consegna", tabella_metriche(d) + t("metriche")),
        h.sezione("Dettaglio per consegna", "".join(dettaglio(c, d) for c in d["consegne"])),
        h.sezione("Come è stata verificata la qualità",
                  '<p>Criteri comuni dell\'indice: <a href="../../index.html#criterio-funzionale">§2.1 qualità funzionale</a> (punteggi dell\'oracolo già registrati nei report 0b e 0c, '
                  'una valutazione per consegna) e <a href="../../index.html#criterio-tecnico">§2.2 qualità tecnica</a>, applicati per intero. Specifico di questo report:</p><ul>'
                  '<li><strong>Strumenti</strong> in <code>bench/strumenti/</code>: jscpd, StrykerJS 10 con <code>@stryker-mutator/vitest-runner</code>; ESLint, TypeScript e Vitest sono quelli della consegna. '
                  'Script: <code>bench/common/tecnica.py</code> (misura, giudice, punteggi), <code>bench/common/funzioni.js</code> (range delle funzioni dall\'AST TypeScript).</li>'
                  '<li><strong>Complessità</strong>: regola ESLint <code>complexity</code> con <code>max: 0</code> per riportare ogni funzione dei file src toccati; una funzione è «nuova o modificata» se '
                  'almeno una riga aggiunta cade nel suo range. Soglia 10, penalità se la massima supera 20.</li>'
                  '<li><strong>Mutation testing</strong>: mutanti su tutti i file <code>src/</code> toccati (anche componenti tsx), test unit della consegna (<code>tests/unit/</code>), copertura per test; '
                  'i mutanti senza copertura contano come non rilevati. Sandbox di Stryker fuori dalla copia della consegna.</li>'
                  '<li><strong>Giudice</strong>: Opus, effort medium, senza strumenti, JSON a schema chiuso; legge il diff dei file <code>src/**/*.ts</code>, <code>tests/</code> e <code>prisma/schema.prisma</code> '
                  '(componenti tsx e migrazioni SQL escluse per contenere il costo). Due letture per consegna, la seconda con il prompt in cache; divergenze → media con nota.</li>'
                  f'<li><strong>Accordo del giudice</strong> sulla copertura dei percorsi: {d["accordo_medio"]} (quota media di controlli con lo stesso esito nelle due letture).</li>'
                  '<li><strong>Tipi</strong>: <code>tsc --noEmit</code> sulla consegna (errori nell\'oracolo copiato esclusi) contro la baseline del repository principale; pattern sulle righe aggiunte.</li></ul>'),
        h.sezione("Limiti", t("limiti")),
        h.sezione("Come interpretare i risultati e ipotesi H4", t("interpretazione")),
        h.sezione("Costo dell'esperimento", tabella_costo(d)),
    ])
    footer = ("Generato da bench/qualita-tecnica/report.py (misure di bench/common/tecnica.py su tecnica-tutti.json) · punteggi funzionali dall'oracolo comune · "
              'prove in ~/repo/coaching-planner-bench-runs/ · <a href="../../index.html">Indice del banco</a>')
    return h.pagina("Il codice in più del percorso completo vale qualcosa?", corpo, footer)


def main():
    d = dati()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "dati.json").write_text(json.dumps(d, ensure_ascii=False, indent=1))
    (OUT / "report.html").write_text(genera(d))
    print(OUT / "report.html")


if __name__ == "__main__":
    main()
