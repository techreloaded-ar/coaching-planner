#!/usr/bin/env python3
"""Qualità tecnica di una consegna del banco (criteri §2.2 dell'indice, bench/index.html#criterio-tecnico).

Uso (dalla radice del repository):
  python3 bench/common/tecnica.py misura <prova-id|all> [--senza-mutanti]   misure grezze → <prova>/tecnica.json, artefatti in <prova>/tecnica/
  python3 bench/common/tecnica.py giudice <prova-id|all>                    giudice Opus a checklist chiusa, due letture → <prova>/tecnica/giudice-N.json
  python3 bench/common/tecnica.py punteggi                                  punteggi per consegna (relativi alla coorte) → tecnica.json e $BENCH_RUNS/tecnica-tutti.json

Lavora sulla copia immutabile della consegna in <prova>/valutazione/repo (hash dell'albero verificato contro run.json).
Non modifica la copia: Stryker usa una sandbox in <prova>/tecnica/, jscpd ed ESLint leggono soltanto.
Strumenti in bench/strumenti/node_modules (jscpd, StrykerJS + vitest-runner), ESLint, TypeScript e Vitest da node_modules della consegna.
"""
import json
import os
import re
import statistics
import subprocess
import sys
from pathlib import Path

BENCH = Path(__file__).resolve().parent.parent
sys.path[0] = str(BENCH)  # evita che bench/common ombreggi il modulo stdlib html
REPO = BENCH.parent
RUNS = Path(os.environ.get("BENCH_RUNS", REPO.parent / "coaching-planner-bench-runs"))
STRUMENTI = BENCH / "strumenti" / "node_modules"
CONTROLLI = json.loads((BENCH / "common" / "controlli.json").read_text())
CODICI_PERCORSI = [c["codice"] for c in CONTROLLI["controlli"] if c["livello"] != "gate" and not c["codice"].startswith("U")]
ESCLUSI = ("docs/wiki/", ".archetipo/", "package-lock.json")
SOGLIA_COMPLESSITA, SOGLIA_COMPLESSITA_MASSIMA = 10, 20
MODELLO_GIUDICE, EFFORT_GIUDICE, BUDGET_GIUDICE_USD = "opus", "medium", 5
CONSEGNA = "HEAD"  # commit della consegna nella copia valutata, impostato da repo_di()


def sh(cmd, cwd, check=False, timeout=1800, env=None):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=check, timeout=timeout, env=env)


def git(repo, *args):
    return sh(["git", *args], repo, check=True).stdout


def leggi(p, predefinito=None):
    return json.loads(p.read_text()) if p.exists() else predefinito


def scrivi(p, dati):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(dati, ensure_ascii=False, indent=1))


# ── classificazione del diff ─────────────────────────────────────────────────

def categoria(path):
    if path.startswith(".archetipo/"):
        return "archetipo"
    if path.startswith("docs/wiki/"):
        return "wiki"
    if path.startswith("docs/mockups/"):
        return "mockup"
    if path.startswith("prisma/"):
        return "migrazioni"
    if path.startswith("tests/e2e/"):
        return "test_e2e"
    if path.startswith("tests/unit/") or re.search(r"\.test\.tsx?$", path):
        return "test_unit"
    if path.startswith("src/") and path.endswith(".tsx"):
        return "ui"
    if path.startswith("src/"):
        return "applicativo"
    return "altro"


def e_src_applicativo(path):
    return categoria(path) in ("applicativo", "ui")


def numstat(repo, root):
    righe = []
    for r in git(repo, "diff", "--numstat", root, CONSEGNA).splitlines():
        ins, dele, path = r.split("\t", 2)
        if path.endswith("package-lock.json"):
            continue
        righe.append({"path": path, "ins": 0 if ins == "-" else int(ins), "del": 0 if dele == "-" else int(dele), "categoria": categoria(path)})
    return righe


def righe_aggiunte(repo, root, path):
    """Numeri di riga (nel file della consegna) aggiunti o modificati rispetto alla baseline."""
    out = sh(["git", "diff", "-U0", root, CONSEGNA, "--", path], repo).stdout
    righe = set()
    for m in re.finditer(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", out, re.M):
        inizio, n = int(m.group(1)), int(m.group(2) if m.group(2) is not None else 1)
        righe.update(range(inizio, inizio + n))
    return righe


def testo_aggiunto(repo, root, paths):
    """Solo le righe aggiunte (prefisso +) del diff dei path dati."""
    if not paths:
        return ""
    out = sh(["git", "diff", "-U0", root, CONSEGNA, "--", *paths], repo).stdout
    return "\n".join(r[1:] for r in out.splitlines() if r.startswith("+") and not r.startswith("+++"))


# ── complessità (ESLint complexity, max 0 per riportare ogni funzione) ───────

def funzioni(repo, path):
    out = sh(["node", str(BENCH / "common" / "funzioni.js"), str(repo), path], repo, check=True).stdout
    return json.loads(out)


def complessita(repo, root, files):
    if not files:
        return {"funzioni": [], "nota": "nessun file src toccato"}
    regola = json.dumps({"complexity": ["warn", {"max": 0}]})
    out = sh([str(repo / "node_modules" / ".bin" / "eslint"), "--format", "json", "--rule", regola, "--no-warn-ignored", *files], repo)
    try:
        risultati = json.loads(out.stdout)
    except json.JSONDecodeError:
        return {"funzioni": [], "nota": f"eslint non eseguibile: {out.stderr[:300]}"}
    elenco = []
    for r in risultati:
        path = os.path.relpath(r["filePath"], repo)
        aggiunte = righe_aggiunte(repo, root, path)
        ranges = funzioni(repo, path)
        for m in r["messages"]:
            if m.get("ruleId") != "complexity":
                continue
            valore = int(re.search(r"complexity of (\d+)", m["message"]).group(1))
            riga = m["line"]
            contenitori = [f for f in ranges if f["inizio"] <= riga <= f["fine"]]
            f = min(contenitori, key=lambda f: f["fine"] - f["inizio"]) if contenitori else {"nome": "?", "inizio": riga, "fine": riga}
            toccata = any(f["inizio"] <= a <= f["fine"] for a in aggiunte)
            elenco.append({"file": path, "nome": f["nome"], "riga": riga, "fine": f["fine"], "complessita": valore, "toccata": toccata})
    toccate = [f for f in elenco if f["toccata"]]
    return {"funzioni": toccate, "totale_funzioni_nei_file": len(elenco),
            "oltre_soglia": sum(1 for f in toccate if f["complessita"] > SOGLIA_COMPLESSITA),
            "massima": max((f["complessita"] for f in toccate), default=0)}


# ── duplicazione (jscpd sui file toccati) ────────────────────────────────────

def duplicazione(repo, files, cartella):
    if not files:
        return {"righe": 0, "duplicate": 0, "percentuale": 0.0, "nota": "nessun file src toccato"}
    out_dir = cartella / "jscpd"
    out_dir.mkdir(parents=True, exist_ok=True)
    sh([str(STRUMENTI / ".bin" / "jscpd"), "--reporters", "json", "--output", str(out_dir), "--silent", "--min-lines", "5",
        "--min-tokens", "50", "--format", "typescript,tsx", *files], repo)
    rapporto = leggi(out_dir / "jscpd-report.json", {})
    tot = rapporto.get("statistics", {}).get("total", {})
    righe, dup = tot.get("lines", 0), tot.get("duplicatedLines", 0)
    return {"righe": righe, "duplicate": dup, "percentuale": round(100 * dup / righe, 2) if righe else 0.0,
            "cloni": len(rapporto.get("duplicates", []))}


# ── mutation testing (StrykerJS + vitest-runner, sandbox fuori dalla copia) ──

def glob_letterale(path):
    return re.sub(r"[()\[\]]", lambda m: f"[{m.group(0)}]", path)


def mutanti(repo, files, cartella):
    if not files:
        return {"score": None, "nota": "nessun file src toccato"}
    tmp = cartella / "stryker-tmp"
    rapporto = cartella / "stryker.json"
    cfg = {"mutate": [glob_letterale(f) for f in files], "testRunner": "vitest", "vitest": {"configFile": "vitest.config.ts"},
           "coverageAnalysis": "perTest", "reporters": ["json", "progress-append-only"], "jsonReporter": {"fileName": str(rapporto)},
           "tempDirName": str(tmp), "cleanTempDir": True, "timeoutMS": 20000, "allowConsoleColors": False, "logLevel": "info",
           "plugins": [str(STRUMENTI / "@stryker-mutator" / "vitest-runner" / "dist" / "src" / "index.js")]}
    conf = cartella / "stryker.conf.json"
    scrivi(conf, cfg)
    out = sh([str(STRUMENTI / ".bin" / "stryker"), "run", str(conf)], repo, timeout=3600)
    (cartella / "stryker.log").write_text(out.stdout + out.stderr)
    dati = leggi(rapporto)
    if not dati:
        return {"score": None, "nota": f"Stryker non ha prodotto il rapporto (exit {out.returncode}); vedi stryker.log"}
    conteggi, per_file = {}, {}
    for nome, f in dati["files"].items():
        voce = per_file.setdefault(os.path.relpath(nome, repo) if os.path.isabs(nome) else nome, {})
        for m in f["mutants"]:
            conteggi[m["status"]] = conteggi.get(m["status"], 0) + 1
            voce[m["status"]] = voce.get(m["status"], 0) + 1
    rilevati = conteggi.get("Killed", 0) + conteggi.get("Timeout", 0)
    non_rilevati = conteggi.get("Survived", 0) + conteggi.get("NoCoverage", 0)
    validi = rilevati + non_rilevati
    return {"score": round(rilevati / validi, 4) if validi else None, "conteggi": conteggi, "validi": validi,
            "file_mutati": len(dati["files"]), "per_file": per_file, "nota": None if validi else "nessun mutante valido"}


# ── tipi e sicurezza statica ─────────────────────────────────────────────────

def errori_tsc(repo):
    """Errori tsc fuori da __oracolo__ (l'oracolo copiato da valuta.py non fa parte della consegna)."""
    out = sh([str(repo / "node_modules" / ".bin" / "tsc"), "--noEmit", "-p", "tsconfig.json"], repo, timeout=900)
    return len([r for r in out.stdout.splitlines() if re.search(r"error TS\d+", r) and not r.startswith("__oracolo__/")])


def errori_tsc_baseline():
    """tsc sul repository principale alla baseline (stesso albero src della baseline del banco), calcolato una volta e conservato."""
    cache = RUNS / "_baseline" / "tsc-baseline.json"
    if cache.exists():
        return leggi(cache)["errori"]
    sha = git(REPO, "rev-parse", "HEAD").strip()
    n = errori_tsc(REPO)
    scrivi(cache, {"errori": n, "sha": sha, "repo": str(REPO)})
    return n


PATTERN_TIPI = {"any": r"(?<![\w\"'`])any\b(?!\s*[:,]?\s*[\"'`])", "as_unknown_as": r"\bas unknown as\b",
                "ts_ignore": r"@ts-(ignore|expect-error)", "eslint_disable": r"eslint-disable"}


def tipi(repo, root, files_src):
    testo = testo_aggiunto(repo, root, files_src)
    righe_codice = [r for r in testo.splitlines() if not r.strip().startswith(("//", "*", "/*"))]
    violazioni = {}
    for nome, p in PATTERN_TIPI.items():
        if nome == "any":
            trovate = [r.strip() for r in righe_codice if re.search(r"(:\s*any\b|<any>|as any\b|any\[\])", r)]
        else:
            trovate = [r.strip() for r in righe_codice if re.search(p, r)]
        violazioni[nome] = trovate[:5]
    nuovi = errori_tsc(repo)
    base = errori_tsc_baseline()
    return {"tsc_errori": nuovi, "tsc_errori_baseline": base, "tsc_nuovi": max(0, nuovi - base), "violazioni": violazioni}


# ── convenzioni verificabili da script ───────────────────────────────────────

def convenzioni_script(repo, root, righe, valutazione):
    e2e = [r["path"] for r in righe if r["categoria"] == "test_e2e" and r["ins"] > 0]
    testo = testo_aggiunto(repo, root, e2e)
    gate = valutazione.get("gate", {})
    return {
        "lint_e_guardrail": gate.get("lint", {}).get("ok"),
        "select_option_index": {"applicabile": bool(e2e), "violazioni": re.findall(r"selectOption\(\s*\{\s*index[^)]*\)", testo)[:5]},
        # test.setTimeout(...) di Playwright è un limite di tempo, non un'attesa: contano waitForTimeout e setTimeout non preceduti da un punto.
        "hard_wait": {"applicabile": bool(e2e), "violazioni": re.findall(r"((?:waitForTimeout|(?<![.\w])setTimeout)\([^)]*\))", testo)[:5]},
        "migrazione_senza_drift": bool(gate.get("P1", {}).get("ok")) and bool(gate.get("P2", {}).get("ok")),
        "test_e2e_aggiunti": e2e,
        "test_unit_aggiunti": [r["path"] for r in righe if r["categoria"] == "test_unit" and r["ins"] > 0],
    }


# ── misura di una consegna ───────────────────────────────────────────────────

def repo_di(prova):
    """Copia valutata della consegna e commit che corrisponde all'albero registrato in run.json.

    valuta.py può aggiungere alla copia un commit del banco dopo la consegna (es. «bench: wiki abilitata», solo .archetipo/):
    in quel caso il commit della consegna è cercato nella storia e si verifica che la differenza con HEAD stia fuori da src, tests e prisma.
    """
    global CONSEGNA
    cartella = RUNS / prova
    info = leggi(cartella / "run.json")
    repo = cartella / "valutazione" / "repo"
    if not info or not repo.exists():
        raise SystemExit(f"{prova}: run.json o valutazione/repo mancanti")
    CONSEGNA = "HEAD"
    for commit in git(repo, "rev-list", "HEAD").split():
        if git(repo, "rev-parse", f"{commit}^{{tree}}").strip() == info["tree_hash"]:
            CONSEGNA = commit
            break
    else:
        raise SystemExit(f"{prova}: nessun commit con l'albero {info['tree_hash']} di run.json")
    if CONSEGNA != "HEAD":
        extra = git(repo, "diff", "--name-only", CONSEGNA, "HEAD").split()
        if any(f.startswith(("src/", "tests/", "prisma/")) for f in extra):
            raise SystemExit(f"{prova}: la copia valutata differisce dalla consegna in {extra}")
    root = git(repo, "rev-list", "--max-parents=0", "HEAD").strip()
    return cartella, info, repo, root


def misura(prova, con_mutanti=True):
    cartella, info, repo, root = repo_di(prova)
    out = cartella / "tecnica"
    out.mkdir(exist_ok=True)
    righe = numstat(repo, root)
    files_src = [r["path"] for r in righe if e_src_applicativo(r["path"]) and (repo / r["path"]).exists()]
    per_categoria = {}
    for r in righe:
        v = per_categoria.setdefault(r["categoria"], {"ins": 0, "del": 0, "file": 0})
        v["ins"] += r["ins"]; v["del"] += r["del"]; v["file"] += 1
    valutazione = leggi(cartella / "valutazione" / "evaluation.json", {})
    precedente = leggi(cartella / "tecnica.json", {})
    dati = {
        "prova": prova, "model": info["model"], "config": info["config"], "discovery": info["discovery"], "codes": info["codes"],
        "tree_hash": info["tree_hash"], "root": root, "commit_consegna": git(repo, "rev-parse", CONSEGNA).strip(),
        "righe_per_categoria": per_categoria, "file": righe,
        "righe_nette_src": sum(r["ins"] - r["del"] for r in righe if e_src_applicativo(r["path"])),
        "righe_aggiunte_src": sum(r["ins"] for r in righe if e_src_applicativo(r["path"])),
        "righe_aggiunte_totali": sum(r["ins"] for r in righe if not r["path"].startswith(ESCLUSI)),
        "file_src": files_src,
        "complessita": complessita(repo, root, files_src),
        "duplicazione": duplicazione(repo, files_src, out),
        "tipi": tipi(repo, root, files_src),
        "convenzioni_script": convenzioni_script(repo, root, righe, valutazione),
        "qualita_funzionale": valutazione.get("totale"),
        "controlli_falliti": sorted(k for k, c in valutazione.get("controlli", {}).items() if not c["ok"]),
        "numero_test": conta_test(repo, root, righe),
    }
    dati["mutanti"] = mutanti(repo, files_src, out) if con_mutanti else precedente.get("mutanti", {"score": None, "nota": "non eseguito"})
    if "punteggio" in precedente:
        dati["punteggio"] = precedente["punteggio"]
    scrivi(cartella / "tecnica.json", dati)
    print(f"{prova}: src +{dati['righe_aggiunte_src']} netto {dati['righe_nette_src']} · funzioni toccate {len(dati['complessita'].get('funzioni', []))} "
          f"(oltre {dati['complessita'].get('oltre_soglia')}) · dup {dati['duplicazione']['percentuale']}% · mutation {dati['mutanti'].get('score')} "
          f"· tsc nuovi {dati['tipi']['tsc_nuovi']} · test {dati['numero_test']}")
    return dati


def conta_test(repo, root, righe):
    """Casi di test aggiunti (it/test( nelle righe aggiunte dei file di test)."""
    conteggio = {}
    for cat in ("test_unit", "test_e2e"):
        paths = [r["path"] for r in righe if r["categoria"] == cat and r["ins"] > 0]
        testo = testo_aggiunto(repo, root, paths)
        conteggio[cat] = len(re.findall(r"^\s*(?:it|test)(?:\.(?:only|skip|each|describe))?\s*\(", testo, re.M))
    return conteggio


# ── giudice a checklist chiusa (Opus, senza strumenti, due letture) ──────────

SCHEMA_GIUDICE = {
    "type": "object", "additionalProperties": False,
    "required": ["copertura", "factory_fixtures", "blocco_condiviso"],
    "properties": {
        "copertura": {"type": "object", "additionalProperties": False,
                      "required": CODICI_PERCORSI,
                      "properties": {c: {"type": "object", "additionalProperties": False, "required": ["coperto", "test"],
                                         "properties": {"coperto": {"type": "boolean"}, "test": {"type": "string"}}} for c in CODICI_PERCORSI}},
        "factory_fixtures": {"type": "object", "additionalProperties": False, "required": ["valore", "evidenza"],
                             "properties": {"valore": {"type": "string", "enum": ["si", "no", "non applicabile"]}, "evidenza": {"type": "string"}}},
        "blocco_condiviso": {"type": "object", "additionalProperties": False, "required": ["valore", "evidenza"],
                             "properties": {"valore": {"type": "string", "enum": ["si", "no"]}, "evidenza": {"type": "string"}}},
    },
}


def prompt_giudice(prova, diff):
    controlli = "\n".join(f"- {c['codice']}: {c['verifica']}" for c in CONTROLLI["controlli"] if c["codice"] in CODICI_PERCORSI)
    return f"""Sei un revisore di codice che applica una checklist chiusa. Leggi il diff della consegna «{prova}» di Coaching Planner (Next.js, Prisma, Vitest, Playwright), rispetto alla baseline del repository. La funzionalità richiesta è la chiusura del mese consuntivato: l'amministratore chiude un mese, le righe di attività di quel mese non sono più modificabili, il mese può essere riaperto.

Per contenere la lettura, il diff esclude i componenti React (file .tsx) e le migrazioni SQL: contiene i file .ts di src/ (server action, dominio, lib), i test in tests/ e prisma/schema.prisma.

Rispondi SOLO con il JSON richiesto. Non proporre modifiche, non valutare la qualità in generale: rispondi alle tre domande seguenti sulla base del diff e di nulla altro.

1. COPERTURA DEI PERCORSI. Per ciascuno dei controlli dell'oracolo elencati sotto, indica se nel diff esiste almeno un test (unit in tests/unit o e2e in tests/e2e) che verifica quel comportamento, giudicando per nome e contenuto del test. Un test copre un controllo solo se esercita proprio quel caso (es. per B5 serve un test che duplica da un mese aperto verso uno chiuso e verifica il rifiuto; un test generico «mese chiuso» non basta). Riporta il nome del test (la stringa di it/test) o una stringa vuota.
{controlli}

2. FACTORY E FIXTURES. Se il diff aggiunge test e2e: usano le factory e le fixtures di tests/e2e/support (fixtures.ts, date.ts, reserved-resources.ts) per creare collaboratori, clienti, offerte, mesi riservati, invece di mutare le entità del seed (Giulia Conti, TechSolutions, DataFlow, scaglioni seed)? Rispondi «si» se tutti i test e2e aggiunti lo fanno, «no» se almeno uno muta entità seed o inventa dati fissi senza factory, «non applicabile» se il diff non aggiunge test e2e. Cita il file e la riga come evidenza.

3. BLOCCO DI DOMINIO CONDIVISO. Il blocco del mese chiuso è realizzato in una funzione condivisa (una sola, o una famiglia in un solo modulo) chiamata da ogni server action che scrive righe di attività (creazione, modifica, eliminazione, rimozione rimborso, duplicazione, spostamento) e dall'area attività dell'amministratore? Rispondi «si» solo se tutte le scritture passano dalla stessa funzione; «no» se il controllo è ripetuto inline in più punti o manca in qualche percorso di scrittura visibile nel diff. Cita la funzione e i chiamanti come evidenza.

Diff:
```diff
{diff}
```"""


def giudice(prova, letture=(1, 2)):
    cartella, info, repo, root = repo_di(prova)
    out = cartella / "tecnica"
    out.mkdir(exist_ok=True)
    diff = sh(["git", "diff", root, CONSEGNA, "--", "src", "tests", "prisma", ":!package-lock.json", ":!*.tsx", ":!prisma/migrations"], repo).stdout
    prompt = prompt_giudice(prova, diff)
    (out / "giudice-prompt.txt").write_text(prompt)
    schema = json.dumps(SCHEMA_GIUDICE)
    env = {k: v for k, v in os.environ.items() if not k.startswith("CLAUDECODE")}
    for n in letture:
        destinazione = out / f"giudice-{n}.json"
        if destinazione.exists() and leggi(destinazione).get("risposta"):
            print(f"{prova}: lettura {n} già presente")
            continue
        res = subprocess.run(["claude", "-p", "--model", MODELLO_GIUDICE, "--effort", EFFORT_GIUDICE, "--tools", "", "--setting-sources", "",
                              "--output-format", "json", "--json-schema", schema, "--max-budget-usd", str(BUDGET_GIUDICE_USD)],
                             input=prompt, capture_output=True, text=True, cwd=out, env=env, timeout=1800)
        try:
            esito = json.loads(res.stdout)
        except json.JSONDecodeError:
            (out / f"giudice-{n}.err").write_text(res.stdout + res.stderr)
            raise SystemExit(f"{prova}: lettura {n} senza JSON (exit {res.returncode}); vedi giudice-{n}.err")
        risposta = esito.get("structured_output")
        if not risposta and esito.get("result"):
            try:
                risposta = json.loads(re.sub(r"^```(?:json)?|```$", "", esito["result"].strip(), flags=re.M))
            except json.JSONDecodeError:
                risposta = None
        scrivi(destinazione, {"prova": prova, "lettura": n, "modello": MODELLO_GIUDICE, "effort": EFFORT_GIUDICE,
                              "cost_usd": esito.get("total_cost_usd"), "usage": esito.get("usage"), "duration_ms": esito.get("duration_ms"),
                              "is_error": esito.get("is_error"), "risposta": risposta, "grezzo": None if risposta else esito})
        if esito.get("is_error") or not risposta:
            raise SystemExit(f"{prova}: lettura {n} in errore o senza risposta strutturata: {str(esito)[:300]}")
        print(f"{prova}: lettura {n} · {esito.get('total_cost_usd', 0):.2f} USD · coperti {sum(1 for v in risposta['copertura'].values() if v['coperto'])}/{len(CODICI_PERCORSI)} "
              f"· factory {risposta['factory_fixtures']['valore']} · blocco {risposta['blocco_condiviso']['valore']}")


# ── punteggi relativi alla coorte ────────────────────────────────────────────

def lineare(valore, pieno, zero, punti):
    """punti se valore ≤ pieno, 0 se valore ≥ zero, lineare in mezzo."""
    if valore <= pieno:
        return punti
    if valore >= zero:
        return 0.0
    return punti * (zero - valore) / (zero - pieno)


def letture_giudice(cartella):
    return [leggi(cartella / "tecnica" / f"giudice-{n}.json", {}).get("risposta") for n in (1, 2)]


def punteggio(d, mediana_coorte, giudizi):
    note = []
    dimensione = lineare(d["righe_nette_src"], mediana_coorte, 2 * mediana_coorte, 20) if mediana_coorte else 20
    c = d["complessita"]
    n_funzioni = len(c.get("funzioni", []))
    quota_oltre = c.get("oltre_soglia", 0) / n_funzioni if n_funzioni else 0
    complessita_punti = max(0.0, 15 * (1 - quota_oltre) - (3 if c.get("massima", 0) > SOGLIA_COMPLESSITA_MASSIMA else 0))
    duplicazione_punti = lineare(d["duplicazione"]["percentuale"], 3, 15, 10)
    ms = d["mutanti"].get("score")
    if ms is None:
        note.append("mutation score non disponibile: " + str(d["mutanti"].get("nota")))
    mutation_punti = 25 * (ms or 0)
    validi = [g for g in giudizi if g]
    if len(validi) < 2:
        note.append(f"giudice: {len(validi)} letture su 2")
    quote = [sum(1 for v in g["copertura"].values() if v["coperto"]) / len(CODICI_PERCORSI) for g in validi]
    copertura_quota = statistics.mean(quote) if quote else 0
    if len(quote) == 2 and quote[0] != quote[1]:
        note.append(f"copertura: letture divergenti ({quote[0]:.2f} e {quote[1]:.2f}), vale la media")
    cs = d["convenzioni_script"]
    voci = {"lint_e_guardrail": (True, 1.0 if cs["lint_e_guardrail"] else 0.0),
            "select_option_index": (cs["select_option_index"]["applicabile"], 0.0 if cs["select_option_index"]["violazioni"] else 1.0),
            "hard_wait": (cs["hard_wait"]["applicabile"], 0.0 if cs["hard_wait"]["violazioni"] else 1.0),
            "migrazione_senza_drift": (True, 1.0 if cs["migrazione_senza_drift"] else 0.0)}
    for voce in ("factory_fixtures", "blocco_condiviso"):
        valori = [g[voce]["valore"] for g in validi]
        if not valori or all(v == "non applicabile" for v in valori):
            voci[voce] = (False, 0.0)
        else:
            punti = [1.0 if v == "si" else 0.0 for v in valori if v != "non applicabile"]
            voci[voce] = (True, statistics.mean(punti))
            if len(set(valori)) > 1:
                note.append(f"{voce}: letture divergenti {valori}, vale la media")
    applicabili = [p for a, p in voci.values() if a]
    convenzioni_punti = 15 * sum(applicabili) / len(applicabili) if applicabili else 0
    t = d["tipi"]
    violate = (1 if t["tsc_nuovi"] else 0) + sum(1 for v in t["violazioni"].values() if v)
    tipi_punti = max(0.0, 10 - 2.5 * violate)
    aree = {"dimensione": round(dimensione, 2), "complessita": round(complessita_punti, 2), "duplicazione": round(duplicazione_punti, 2),
            "mutation": round(mutation_punti, 2), "copertura_percorsi": round(5 * copertura_quota, 2),
            "convenzioni": round(convenzioni_punti, 2), "tipi": round(tipi_punti, 2)}
    return {"aree": aree, "totale": round(sum(aree.values()), 1), "mediana_coorte_righe": mediana_coorte, "quota_oltre_soglia": round(quota_oltre, 3),
            "copertura_quota": round(copertura_quota, 3), "copertura_per_lettura": quote, "convenzioni_voci": {k: {"applicabile": a, "punti": p} for k, (a, p) in voci.items()},
            "tipi_voci_violate": violate, "note": note}


def punteggi():
    consegne = {}
    for cartella in sorted(RUNS.glob("*/tecnica.json")):
        d = leggi(cartella)
        consegne[d["prova"]] = d
    coorti = {}
    for d in consegne.values():
        coorti.setdefault(d["discovery"], []).append(d["righe_nette_src"])
    mediane = {k: statistics.median(v) for k, v in coorti.items()}
    riepilogo = []
    for prova, d in consegne.items():
        giudizi = letture_giudice(RUNS / prova)
        d["punteggio"] = punteggio(d, mediane[d["discovery"]], giudizi)
        d["giudizi"] = giudizi
        scrivi(RUNS / prova / "tecnica.json", d)
        riepilogo.append({k: d[k] for k in ("prova", "model", "config", "discovery", "codes", "righe_nette_src", "righe_aggiunte_totali", "righe_per_categoria",
                                              "qualita_funzionale", "controlli_falliti", "numero_test", "punteggio", "giudizi", "file_src")}
                         | {"mutation_score": d["mutanti"].get("score"), "mutanti": d["mutanti"].get("conteggi"), "mutanti_per_file": d["mutanti"].get("per_file"), "complessita": {k: v for k, v in d["complessita"].items() if k != "funzioni"},
                            "funzioni_oltre_soglia": [f for f in d["complessita"].get("funzioni", []) if f["complessita"] > SOGLIA_COMPLESSITA],
                            "funzioni_toccate": len(d["complessita"].get("funzioni", [])),
                            "duplicazione": d["duplicazione"], "tipi": d["tipi"], "convenzioni_script": d["convenzioni_script"]})
        print(f"{prova}: tecnico {d['punteggio']['totale']} · funzionale {d['qualita_funzionale']} · {d['punteggio']['aree']}")
    scrivi(RUNS / "tecnica-tutti.json", {"mediane_coorte": mediane, "consegne": riepilogo})
    print(RUNS / "tecnica-tutti.json")


def elenco_prove():
    return sorted(p.parent.parent.name for p in RUNS.glob("*/valutazione/repo") if not p.parent.parent.name.startswith("_"))


def main(argv):
    comando = argv[0] if argv else "punteggi"
    prove = elenco_prove() if len(argv) > 1 and argv[1] == "all" else argv[1:2]
    if comando == "punteggi":
        return punteggi()
    for p in prove:
        try:
            if comando == "misura":
                if "--rifai" not in argv and (RUNS / p / "tecnica.json").exists() and leggi(RUNS / p / "tecnica.json").get("mutanti", {}).get("score") is not None:
                    print(f"{p}: tecnica.json già presente (usa --rifai per ricalcolare)")
                    continue
                misura(p, con_mutanti="--senza-mutanti" not in argv)
            elif comando == "giudice":
                giudice(p)
            else:
                raise SystemExit(__doc__)
        except SystemExit as errore:
            print(f"ERRORE {p}: {errore}")
            if len(prove) == 1:
                raise


if __name__ == "__main__":
    main(sys.argv[1:])
