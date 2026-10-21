#!/usr/bin/env python3
"""Report 6 · «Dove si gioca la qualità: la fase spec» (slug fase-spec).

Uso (dalla radice del repository):
  python3 bench/fase-spec/report.py        # dati.json + report.html in bench/reports/fase-spec/

Legge discovery.json, phases/01-spec/metrics.json, giudizio-1.json e giudizio-2.json di ogni cella in $BENCH_RUNS/fase-spec/.
La narrativa è in narrativa.json accanto a questo file e non può aggiungere numeri.
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

CFG = json.loads((BENCH / "wiki-benchmark" / "matrice-spec.json").read_text())
RUNS = Path(os.environ.get("BENCH_RUNS", BENCH.parent.parent / "coaching-planner-bench-runs")) / "fase-spec"
OUT = BENCH / "reports" / "fase-spec"
NARRATIVA = json.loads((Path(__file__).parent / "narrativa.json").read_text()) if (Path(__file__).parent / "narrativa.json").exists() else {}
RICHIESTA = (BENCH / "wiki-benchmark" / "richiesta.txt").read_text().strip()
e = h.e
PUNTI = {"Esplicito": 2, "Parziale": 1, "Non chiarito": 0}
TEMI = ["decisione_rf15", "chi", "granularita", "quali_mesi", "effetto_scritture", "riapertura_motivazione", "storico", "visibilita",
        "concorrenza", "schede_aperte", "dati_invariati"]
ETICHETTE_TEMI = {"decisione_rf15": "Decisione RF-15", "chi": "Chi", "granularita": "Granularità", "quali_mesi": "Quali mesi",
                  "effetto_scritture": "Tutte le scritture", "riapertura_motivazione": "Motivazione", "storico": "Storico", "visibilita": "Visibilità",
                  "concorrenza": "Concorrenza", "schede_aperte": "Schede aperte", "dati_invariati": "Dati invariati"}
FASI = {"domande": ("Domande", "#d49d32"), "bozza": ("Bozza", "#8164c6"), "revisione_avversaria": ("Revisione avversaria", "#9c6b3c"),
        "salvataggio": ("Salvataggio", "#3c9c85")}
SEME = CFG["seme"]
VARIANTI = list(CFG["varianti"])


def leggi(p, predefinito=None):
    return json.loads(p.read_text()) if p.exists() else predefinito


def carica():
    celle = []
    for c in CFG["celle"]:
        d = leggi(RUNS / c["id"] / "discovery.json")
        if not d:
            continue
        m = d["metrics"]
        letture = [leggi(RUNS / c["id"] / f"giudizio-{n}.json", {}).get("risposta") for n in (1, 2)]
        valide = [l for l in letture if l]
        temi = {}
        for t in TEMI:
            valori = [l["temi"][t]["valore"] for l in valide]
            temi[t] = min(valori, key=lambda v: PUNTI[v]) if valori else None  # in caso di disaccordo vale la lettura più bassa
        punteggio = round(100 * sum(PUNTI[v] for v in temi.values() if v) / 22, 1) if valide else None
        accordo = (sum(1 for t in TEMI if valide[0]["temi"][t]["valore"] == valide[1]["temi"][t]["valore"]) / len(TEMI)) if len(valide) == 2 else None
        costo_giudice = sum((leggi(RUNS / c["id"] / f"giudizio-{n}.json", {}) or {}).get("cost_usd") or 0 for n in (1, 2))
        celle.append({
            **c, "codes": d["codes"], "storie": len(d["codes"]), "scambi": m["exchanges"], "minuti": round(m["duration_ms"] / 60000, 2),
            "usd": round(m["cost_usd"] + m.get("committente_cost_usd", 0), 3), "usd_committente": round(m.get("committente_cost_usd", 0), 3),
            "token": m["tokens"].get("total", 0), "wiki_operazioni": m["wiki"]["count"], "fasi_minuti": m.get("fasi_minuti", {}),
            "attesa_committente_min": round(m.get("committente_seconds", 0) / 60, 2), "avvio": m.get("avvio"), "hash_skill_spec": m["precondizioni"]["hash_skill_spec"],
            "temi": temi, "punteggio": punteggio, "accordo": accordo, "letture": len(valide), "costo_giudice": round(costo_giudice, 3),
            "rf15_sollevato": valide[0]["rf15_sollevato"] if valide else None, "rf15_fonte": valide[0]["rf15_fonte"] if valide else None,
            "bozza_mostrata": all(l["bozza_completa_mostrata"] for l in valide) if valide else None,
            "fuori_perimetro": min(l["fuori_perimetro_voci"] for l in valide) if valide else None,
            "note_giudice": [l["note"] for l in valide], "letture_grezze": valide,
        })
    return celle


def stat(valori):
    v = [x for x in valori if x is not None]
    if not v:
        return {"n": 0, "mediana": None, "min": None, "max": None, "media": None, "sd": None}
    return {"n": len(v), "mediana": round(statistics.median(v), 1), "min": round(min(v), 1), "max": round(max(v), 1),
            "media": round(statistics.mean(v), 2), "sd": round(statistics.stdev(v), 2) if len(v) > 1 else None}


def bootstrap(a, b, n=10000):
    """IC 95 % di mediana(a) − mediana(b) ricampionando dentro ciascun gruppo (repliche indipendenti, non appaiate)."""
    if not a or not b:
        return None
    rnd = random.Random(SEME)
    diffs = sorted(statistics.median(rnd.choices(a, k=len(a))) - statistics.median(rnd.choices(b, k=len(b))) for _ in range(n))
    return {"delta": round(statistics.median(a) - statistics.median(b), 1), "ic95": [round(diffs[int(0.025 * n)], 1), round(diffs[int(0.975 * n)], 1)],
            "delta_media": round(statistics.mean(a) - statistics.mean(b), 1), "n": [len(a), len(b)]}


def dati():
    celle = carica()
    per_cella = {}
    for c in celle:
        per_cella.setdefault((c["variante"], c["model"]), []).append(c)
    riepilogo = []
    for (v, m), lista in sorted(per_cella.items()):
        base = [c["punteggio"] for c in per_cella.get(("V0", m), []) if c["punteggio"] is not None]
        punteggi = [c["punteggio"] for c in lista if c["punteggio"] is not None]
        usd = [c["usd"] for c in lista]
        copertura = {t: {val: sum(1 for c in lista if c["temi"].get(t) == val) for val in PUNTI} for t in TEMI}
        bs = bootstrap(punteggi, base) if v != "V0" else None
        costo_base = statistics.mean(c["usd"] for c in per_cella.get(("V0", m), [])) if per_cella.get(("V0", m)) else None
        riepilogo.append({
            "variante": v, "model": m, "n": len(lista), "giudicate": len(punteggi),
            "punteggio": stat(punteggi), "vs_v0": bs, "usd": stat(usd), "minuti": stat([c["minuti"] for c in lista]),
            "scambi": stat([c["scambi"] for c in lista]), "storie": stat([c["storie"] for c in lista]), "token_m": stat([c["token"] / 1e6 for c in lista]),
            "wiki": stat([c["wiki_operazioni"] for c in lista]), "fuori_perimetro": stat([c["fuori_perimetro"] for c in lista]),
            "rf15": sum(1 for c in lista if c["rf15_sollevato"]), "bozza": sum(1 for c in lista if c["bozza_mostrata"]),
            "accordo": stat([c["accordo"] for c in lista]), "copertura": copertura,
            "rapporto_costo": round(statistics.mean(usd) / costo_base, 2) if costo_base else None,
            "costo_per_punto": (round((statistics.mean(usd) - costo_base) / bs["delta_media"], 3) if bs and bs["delta_media"] > 0 and costo_base is not None else None),
            "fasi": {f: round(statistics.mean(c["fasi_minuti"].get(f, 0) for c in lista), 2) for f in FASI},
            "adottabile": bool(bs and bs["delta"] >= 10 and bs["ic95"][0] > 0 and costo_base and statistics.mean(usd) <= 2 * costo_base) if bs else None,
        })
    # variabilità: SD dentro le celle (pooled) contro SD tra le mediane delle varianti, per modello
    variabilita = {}
    for m in CFG["models"]:
        dentro = [c["punteggio"] for c in celle if c["model"] == m and c["punteggio"] is not None]
        gruppi = [[c["punteggio"] for c in per_cella.get((v, m), []) if c["punteggio"] is not None] for v in VARIANTI]
        gruppi = [g for g in gruppi if len(g) > 1]
        pooled = (sum((len(g) - 1) * statistics.variance(g) for g in gruppi) / sum(len(g) - 1 for g in gruppi)) ** 0.5 if gruppi else None
        mediane = [statistics.median(g) for g in gruppi]
        variabilita[m] = {"sd_pooled_dentro": round(pooled, 1) if pooled else None, "sd_tra_mediane_varianti": round(statistics.stdev(mediane), 1) if len(mediane) > 1 else None,
                          "mediane_varianti": [round(x, 1) for x in mediane], "n": len(dentro)}
    mai_chiariti = {t: sum(1 for c in celle if c["temi"].get(t) == "Non chiarito") for t in TEMI}
    migliori = {}
    for m in CFG["models"]:
        cand = [r for r in riepilogo if r["model"] == m and r["vs_v0"]]
        if cand:
            migliori[m] = max(cand, key=lambda r: r["vs_v0"]["delta"])
    accordi = [c["accordo"] for c in celle if c["accordo"] is not None]
    costo = {"chiarimenti": round(sum(c["usd"] for c in celle), 2), "committente": round(sum(c["usd_committente"] for c in celle), 2),
             "giudici": round(sum(c["costo_giudice"] for c in celle), 2)}
    scartate = sorted(p.name for p in (RUNS / "_scartati").glob("*")) if (RUNS / "_scartati").exists() else []
    costo["scartate"] = round(sum((leggi(p / "phases" / "01-spec" / "metrics.json", {}) or {}).get("cost_usd", 0) for p in (RUNS / "_scartati").glob("*")), 2) if scartate else 0.0
    persi = leggi(RUNS / "costi-persi.json", [])
    costo["persi"] = persi
    costo["scartate"] = round(costo["scartate"] + sum(v["usd"] for v in persi), 2)
    costo["totale"] = round(costo["chiarimenti"] + costo["giudici"] + costo["scartate"], 2)
    return {"celle": celle, "riepilogo": riepilogo, "variabilita": variabilita, "mai_chiariti": mai_chiariti, "migliori": migliori,
            "accordo_medio": round(statistics.mean(accordi), 3) if accordi else None, "costo": costo, "scartate": scartate, "seme": SEME,
            "n_celle": len(celle), "n_giudicate": sum(1 for c in celle if c["punteggio"] is not None), "richiesta": RICHIESTA}


# ── HTML ─────────────────────────────────────────────────────────────────────

def fmt(v, d=1):
    return "n.d." if v is None else f"{v:.{d}f}"


def etichetta(v, m):
    return f'{CFG["varianti"][v]["label"]} ({v}) · {m.capitalize()}'


def barra_fasi(fasi):
    return h.barra([(et, col, fasi.get(k, 0)) for k, (et, col) in FASI.items()])


def tiles(d):
    t = []
    for m in CFG["models"]:
        r = d["migliori"].get(m)
        if r:
            t.append(h.tile(f'{r["vs_v0"]["delta"]:+.0f}', f'{m.capitalize()}: miglior variante {r["variante"]} ({e(CFG["varianti"][r["variante"]]["label"])}), Δ mediana contro V0, '
                            f'IC 95 % bootstrap {r["vs_v0"]["ic95"][0]:+.0f} … {r["vs_v0"]["ic95"][1]:+.0f} su {r["giudicate"]} e {next(x for x in d["riepilogo"] if x["model"] == m and x["variante"] == "V0")["giudicate"]} repliche'))
    usd = statistics.mean(c["usd"] for c in d["celle"]) if d["celle"] else 0
    t.append(h.tile(f'{usd:.2f} USD', f'costo medio per chiarimento, committente simulato incluso, su {d["n_celle"]} chiarimenti (Sonnet {statistics.mean([c["usd"] for c in d["celle"] if c["model"] == "sonnet"] or [0]):.2f}, Opus {statistics.mean([c["usd"] for c in d["celle"] if c["model"] == "opus"] or [0]):.2f})'))
    peggiori = sorted(d["mai_chiariti"].items(), key=lambda kv: -kv[1])[:3]
    t.append(h.tile(" · ".join(f'{v}' for _, v in peggiori), "chiarimenti su " + str(d["n_giudicate"]) + " in cui restano «Non chiarito» i tre temi peggiori: " + ", ".join(e(ETICHETTE_TEMI[k]) for k, _ in peggiori)))
    t.append(h.tile(f'{(d["accordo_medio"] or 0) * 100:.0f} %', "accordo tra le due letture del giudice (quota di temi con lo stesso valore); in caso di disaccordo vale la lettura più bassa"))
    return '<div class="tiles">' + "".join(t) + "</div>"


def tabella_overview(d):
    righe = []
    for r in d["riepilogo"]:
        bs = r["vs_v0"]
        delta = "riferimento" if not bs else f'{bs["delta"]:+.1f}<small>IC {bs["ic95"][0]:+.1f} … {bs["ic95"][1]:+.1f}</small>'
        righe.append(
            f'<tr data-model="{r["model"]}" data-arm="{r["variante"]}" data-tokens="{r["token_m"]["media"]}"><td><a href="#{r["variante"]}-{r["model"]}">{e(CFG["varianti"][r["variante"]]["label"])}</a><small>{r["variante"]} · {r["n"]} repliche</small></td>'
            f'<td>{r["model"].capitalize()}</td><td class="num">{fmt(r["minuti"]["mediana"])}<small>{fmt(r["minuti"]["min"])}–{fmt(r["minuti"]["max"])}</small></td>'
            f'<td class="num"><strong>{fmt(r["punteggio"]["mediana"])}</strong><small>{fmt(r["punteggio"]["min"])}–{fmt(r["punteggio"]["max"])} · n {r["giudicate"]}</small></td>'
            f'<td class="num">{delta}</td><td class="num">{fmt(r["token_m"]["media"], 3)}</td><td class="num">{fmt(r["usd"]["media"], 2)}<small>{fmt(r["rapporto_costo"], 2)}× V0</small></td>'
            f'<td class="skill-flow">archetipo-spec {r["variante"]} → committente simulato (Opus) → archetipo spec add</td><td>{barra_fasi(r["fasi"])}</td></tr>')
    legenda = h.legenda([(et, col) for et, col in FASI.values()])
    return ('<label>Modello<select id="model"><option value="">Entrambi</option><option value="sonnet">Sonnet</option><option value="opus">Opus</option></select></label>'
            '<div class="scroll"><table id="results"><thead><tr><th>Variante</th><th>Modello</th><th class="num">Minuti attivi<br>mediana (min–max)</th>'
            '<th class="num">Qualità della scoperta<br>/100, mediana</th><th class="num">Δ contro V0</th><th class="num">Token totali<br>M, media</th><th class="num">Costo<br>USD, media</th>'
            '<th>Skill / processo eseguito</th><th>Distribuzione del tempo per fase (media)</th></tr></thead><tbody>' + "".join(righe) + "</tbody></table></div>" + legenda +
            '<p class="muted">Una riga per cella (variante × modello). Minuti attivi = durata delle sessioni dell\'agente, attese del committente simulato escluse. '
            'Le fasi sono stimate dai turni del dialogo: «domande» = turni senza bozza, «bozza» = turni in cui compare un criterio AC-1, «revisione avversaria» = durata dei subagenti (V4), '
            '«salvataggio» = turno in cui le storie entrano nel backlog. Δ = differenza di mediane contro V0 dello stesso modello, IC 95 % bootstrap (10 000 ricampionamenti, seme fisso).</p>')


def heatmap(d):
    blocchi = ""
    for m in CFG["models"]:
        righe = ""
        for t in TEMI:
            celle = ""
            for v in VARIANTI:
                r = next((x for x in d["riepilogo"] if x["variante"] == v and x["model"] == m), None)
                if not r:
                    celle += "<td>—</td>"
                    continue
                c = r["copertura"][t]
                n = sum(c.values()) or 1
                esp = c["Esplicito"] / n
                colore = f"rgba(60,156,133,{0.15 + 0.7 * esp:.2f})" if esp >= c["Non chiarito"] / n else f"rgba(201,106,90,{0.15 + 0.7 * c['Non chiarito'] / n:.2f})"
                celle += f'<td class="num" style="background:{colore}">{c["Esplicito"]} / {c["Parziale"]} / {c["Non chiarito"]}</td>'
            righe += f'<tr><td>{e(ETICHETTE_TEMI[t])}</td>{celle}</tr>'
        intestazione = "".join(f'<th class="num">{v}<br><small>{e(CFG["varianti"][v]["label"])}</small></th>' for v in VARIANTI)
        blocchi += f'<h3>{m.capitalize()}</h3><div class="scroll"><table><thead><tr><th>Tema</th>{intestazione}</tr></thead><tbody>{righe}</tbody></table></div>'
    return blocchi + ('<p class="muted">Conteggi Esplicito / Parziale / Non chiarito sulle repliche giudicate della cella (fino a 10). Verde: prevalgono gli Esplicito; rosso: prevalgono i Non chiarito.</p>')


def tabella_processo(d):
    righe = "".join(
        f'<tr><td>{e(CFG["varianti"][r["variante"]]["label"])} <small>{r["variante"]}</small></td><td>{r["model"].capitalize()}</td>'
        f'<td class="num">{r["rf15"]}/{r["n"]}</td><td class="num">{r["bozza"]}/{r["n"]}</td><td class="num">{fmt(r["fuori_perimetro"]["mediana"], 0)}<small>{fmt(r["fuori_perimetro"]["min"], 0)}–{fmt(r["fuori_perimetro"]["max"], 0)}</small></td>'
        f'<td class="num">{fmt(r["storie"]["mediana"], 0)}<small>{fmt(r["storie"]["min"], 0)}–{fmt(r["storie"]["max"], 0)}</small></td>'
        f'<td class="num">{fmt(r["scambi"]["mediana"], 0)}<small>{fmt(r["scambi"]["min"], 0)}–{fmt(r["scambi"]["max"], 0)}</small></td>'
        f'<td class="num">{fmt(r["minuti"]["mediana"])}</td><td class="num">{fmt(r["usd"]["media"], 2)}</td><td class="num">{fmt(r["wiki"]["mediana"], 0)}</td>'
        f'<td class="num">{"n.d." if r["costo_per_punto"] is None else f"{r["costo_per_punto"]:.3f}"}</td><td class="num">{fmt((r["accordo"]["media"] or 0) * 100 if r["accordo"]["media"] is not None else None, 0)} %</td>'
        f'<td>{"" if r["adottabile"] is None else ("<strong>sì</strong>" if r["adottabile"] else "no")}</td></tr>' for r in d["riepilogo"])
    return ('<div class="scroll"><table class="resource-table"><thead><tr><th>Variante</th><th>Modello</th><th class="num">RF-15<br>sollevato</th><th class="num">Bozza completa<br>mostrata</th>'
            '<th class="num">Fuori<br>perimetro</th><th class="num">Storie</th><th class="num">Scambi</th><th class="num">Minuti</th><th class="num">USD</th><th class="num">Op. Wiki</th>'
            f'<th class="num">USD per punto<br>guadagnato</th><th class="num">Accordo<br>giudice</th><th>Adottabile<br>(soglia H6)</th></tr></thead><tbody>{righe}</tbody></table></div>'
            '<p class="muted">USD per punto guadagnato = (costo medio della variante − costo medio di V0) / Δ media contro V0, solo se Δ &gt; 0. '
            '«Adottabile» = supera V0 di almeno 10 punti con intervallo bootstrap sopra zero e costo ≤ 2× V0, sul singolo modello; la soglia di H6 richiede entrambi i modelli.</p>')


def tabella_variabilita(d):
    righe = "".join(f'<tr><td>{m.capitalize()}</td><td class="num">{fmt(v["sd_pooled_dentro"])}</td><td class="num">{fmt(v["sd_tra_mediane_varianti"])}</td>'
                    f'<td>{", ".join(str(x) for x in v["mediane_varianti"])}</td><td class="num">{v["n"]}</td></tr>' for m, v in d["variabilita"].items())
    return ('<div class="scroll"><table style="max-width:900px"><thead><tr><th>Modello</th><th class="num">SD pooled tra repliche<br>della stessa variante</th>'
            f'<th class="num">SD tra le mediane<br>delle varianti</th><th>Mediane V0…V4</th><th class="num">n</th></tr></thead><tbody>{righe}</tbody></table></div>')


def dettagli(d):
    blocchi = ""
    for r in d["riepilogo"]:
        lista = [c for c in d["celle"] if c["variante"] == r["variante"] and c["model"] == r["model"]]
        righe = ""
        for c in sorted(lista, key=lambda c: c["replica"]):
            temi = " ".join(f'<span title="{e(ETICHETTE_TEMI[t])}">{ {"Esplicito": "E", "Parziale": "P", "Non chiarito": "·"}.get(c["temi"].get(t), "?") }</span>' for t in TEMI)
            righe += (f'<tr><td>{e(c["id"])}<small>{", ".join(c["codes"])}</small></td><td class="num">{fmt(c["punteggio"])}</td><td style="font-family:monospace;letter-spacing:2px">{temi}</td>'
                      f'<td class="num">{c["scambi"]}</td><td class="num">{c["minuti"]:.1f}</td><td class="num">{c["usd"]:.2f}</td><td class="num">{c["wiki_operazioni"]}</td>'
                      f'<td>{"sì" if c["rf15_sollevato"] else "no"} ({e(c["rf15_fonte"] or "")})</td><td>{"sì" if c["bozza_mostrata"] else "no"}</td><td class="num">{fmt(c["fuori_perimetro"], 0)}</td>'
                      f'<td class="num">{fmt((c["accordo"] or 0) * 100 if c["accordo"] is not None else None, 0)} %</td>'
                      f'<td><small>{e(c["note_giudice"][0] if c["note_giudice"] else "")}</small></td></tr>')
        blocchi += (f'<details id="{r["variante"]}-{r["model"]}"><summary>{e(etichetta(r["variante"], r["model"]))} · mediana {fmt(r["punteggio"]["mediana"])} · '
                    f'{r["n"]} repliche · {fmt(r["usd"]["media"], 2)} USD medi</summary><div class="inside">'
                    f'<p class="muted">Prove in ~/repo/coaching-planner-bench-runs/fase-spec/S-{r["variante"]}-{r["model"]}-rNN/ (dialogo.md, storie.md, transcript, giudizio-1.json, giudizio-2.json). '
                    f'Temi nell\'ordine: {", ".join(e(ETICHETTE_TEMI[t]) for t in TEMI)}; E = Esplicito, P = Parziale, · = Non chiarito.</p>'
                    '<div class="scroll"><table class="resource-table"><thead><tr><th>Chiarimento</th><th class="num">Punteggio</th><th>Temi</th><th class="num">Scambi</th><th class="num">Min</th>'
                    '<th class="num">USD</th><th class="num">Op. Wiki</th><th>RF-15</th><th>Bozza</th><th class="num">Fuori per.</th><th class="num">Accordo</th><th>Nota del giudice</th></tr></thead>'
                    f'<tbody>{righe}</tbody></table></div></div></details>')
    return blocchi


def diff_skill():
    blocchi = ""
    for v, info in CFG["varianti"].items():
        if not info["file"]:
            continue
        testo = (BENCH / "fase-spec" / "varianti" / info["file"]).read_text()
        blocchi += (f'<details><summary>{v} · {e(info["label"])}</summary><div class="inside"><p class="muted">{e(info["descrizione"])}. Blocco inserito in SKILL.md della copia '
                    f'prima di «Output Boundaries»; la skill originale resta intatta nel banco (bench/fase-spec/varianti/{info["file"]}).</p>'
                    f'<pre style="white-space:pre-wrap;font-size:12px;background:#f4f6f4;padding:12px;border-radius:8px">{e(testo)}</pre></div></details>')
    return blocchi


def tabella_costo(d):
    c = d["costo"]
    righe = [("Chiarimenti (sessioni archetipo-spec), " + str(d["n_celle"]) + " celle", c["chiarimenti"] - c["committente"]),
             ("Committente simulato (Opus, effort low)", c["committente"]),
             (f'Giudice Opus, due letture per chiarimento ({d["n_giudicate"]} giudicati)', c["giudici"]),
             (f'Chiarimenti scartati ({len(d["scartate"])}: {", ".join(d["scartate"]) or "nessuno"}) e turni persi per interruzioni ({"; ".join(v["voce"] for v in c["persi"]) or "nessuno"})', c["scartate"])]
    return ('<div class="scroll"><table style="max-width:800px"><thead><tr><th>Voce</th><th class="num">USD</th></tr></thead><tbody>'
            + "".join(f'<tr><td>{e(v)}</td><td class="num">{u:.2f}</td></tr>' for v, u in righe)
            + f'<tr><td><strong>Totale registrato</strong> (budget 120)</td><td class="num"><strong>{c["totale"]:.2f}</strong></td></tr></tbody></table></div>')


def genera(d):
    t = lambda k: NARRATIVA.get(k, '<p class="muted">Narrativa non ancora scritta.</p>')
    corpo = "".join([
        f'<header><div class="tag">Coaching Planner · Esperimento sulla fase spec · {d["n_celle"]} chiarimenti</div>'
        '<h1>Dove si gioca la qualità: la fase spec</h1>'
        f'<p>Richiesta iniziale: «{e(d["richiesta"])}». Cinque varianti di <code>archetipo-spec</code> (V0 baseline, V1 checklist generica di scoperta, V2 bozza completa prima del salvataggio, '
        'V3 ricerca dei conflitti obbligatoria, V4 reviewer avversario) × Sonnet e Opus × 10 repliche, stesso profilo nascosto, committente simulato Opus in sessione separata, '
        'Wiki presente e <code>wiki.enabled: true</code> verificato dal banco. Qualità della scoperta secondo i <a href="../../index.html#criterio-scoperta">criteri comuni §2.3</a>.</p></header>',
        h.sezione("Cosa emerge", tiles(d) + t("cosa_emerge")),
        h.sezione("Overview delle celle: tempi, qualità della scoperta, token, costo e fasi", tabella_overview(d)),
        h.sezione("Copertura dei temi del profilo per variante", heatmap(d) + t("temi")),
        h.sezione("Indicatori di processo e costo per punto", tabella_processo(d) + t("processo")),
        h.sezione("Variabilità tra repliche e tra varianti", tabella_variabilita(d) + t("variabilita")),
        h.sezione("I 100 chiarimenti, per cella", dettagli(d)),
        h.sezione("Diff delle skill copiate", diff_skill()),
        h.sezione("Come è stata verificata la qualità",
                  '<p>Criteri comuni dell\'indice: <a href="../../index.html#criterio-scoperta">§2.3 qualità della scoperta</a> e <a href="../../index.html#criterio-costo">§2.4 costo e tempo</a>, applicati per intero. Specifico di questo report:</p><ul>'
                  '<li><strong>Esecuzione</strong>: <code>bench/fase-spec/run.py</code>, clone isolato per cella con Wiki e flag dichiarato, skill copiate dall\'installazione corrente e variante inserita nella copia; '
                  'una sessione <code>claude -p</code> nuova per turno (<code>--resume</code> tra i turni), committente simulato Opus effort low in sessione separata senza strumenti; precondizioni registrate in <code>metrics.json</code> '
                  '(Wiki presente, skill archetipo-wiki, <code>wiki.enabled</code>, hash della skill copiata). Ordine delle celle randomizzato con seme ' + str(d["seme"]) + ', due processi in parallelo (i chiarimenti non usano porta né database).</li>'
                  '<li><strong>Giudice</strong>: <code>bench/fase-spec/giudice.py</code>, Opus effort medium senza strumenti, JSON a schema chiuso; legge dialogo e storie finali; due letture, la seconda con il prompt in cache; '
                  'per ogni tema vale la lettura più bassa; accordo = quota di temi con lo stesso valore. Indicatori di processo letti dal giudice (RF-15, bozza, fuori perimetro) e dal banco (storie, scambi, minuti, USD, operazioni Wiki).</li>'
                  '<li><strong>Statistica</strong>: mediana, min e max per cella; Δ contro V0 come differenza di mediane con IC 95 % bootstrap su 10 000 ricampionamenti dentro ciascun gruppo (repliche indipendenti, non appaiate); '
                  'SD pooled tra repliche confrontata con la SD tra le mediane delle varianti.</li></ul>'),
        h.sezione("Limiti", t("limiti")),
        h.sezione("Come interpretare i risultati e ipotesi H6", t("interpretazione")),
        h.sezione("Costo dell'esperimento", tabella_costo(d) + t("costo")),
    ])
    footer = ('Generato da bench/fase-spec/report.py (matrice-spec.json) · giudice §2.3 comune · prove in ~/repo/coaching-planner-bench-runs/fase-spec/ · '
              '<a href="../../index.html">Indice del banco</a>')
    return h.pagina("Dove si gioca la qualità: la fase spec", corpo, footer)


def main():
    d = dati()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "dati.json").write_text(json.dumps(d, ensure_ascii=False, indent=1))
    (OUT / "report.html").write_text(genera(d))
    print(OUT / "report.html", d["n_celle"], "celle,", d["n_giudicate"], "giudicate, costo", d["costo"])


if __name__ == "__main__":
    main()
