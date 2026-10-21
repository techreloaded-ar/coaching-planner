#!/usr/bin/env python3
"""Valutazione esterna comune delle consegne (oracolo).

Uso:
  python3 valuta.py <run-id>        # es. sonnet-C3
  python3 valuta.py baseline        # tara l'oracolo sulla baseline (adattatore nullo)
  python3 valuta.py all             # tutte le prove completate
  python3 valuta.py wiki <run-id>   # qualità della Wiki (solo prove con Wiki)

Per ogni prova lavora su una copia immutabile della consegna (hash dell'albero verificato),
con database dedicati. L'adattatore viene generato una volta da un agente fisso e conservato
in valutazione/adattatore/: le rivalutazioni lo riusano. Nessun esito torna agli agenti di sviluppo.
"""
import json
import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import run as banco

ORACOLO = banco.BENCH / "oracolo"
RUBRICA = banco.CFG["rubrica"]
VALUTAZIONE = banco.CFG["valutazione"]
TITOLO = re.compile(r"\[(\w+)\]\s+([A-Z]\d+)")
CONTROLLI_GATE_PERSISTENZA = ("P1", "P2")
PERCORSI_CRITICI = re.compile(r"^(B[1-7]|A[1-3])$")

PROMPT_ADATTATORE = """Sei il valutatore esterno di un benchmark. In questo repository un team ha consegnato la funzionalità "chiusura del mese consuntivato" di Coaching Planner. Devi scrivere SOLO l'adattatore che collega l'oracolo di test alla consegna.

Il contratto è in `__oracolo__/contratto.ts`: leggilo per intero. Produci:
- `__oracolo__/adattatore/integrazione.ts` con `export const adattatoreIntegrazione: AdattatoreIntegrazione`
- `__oracolo__/adattatore/browser.ts` con `export const adattatoreBrowser: AdattatoreBrowser`

Regole:
- Collega le operazioni alle interfacce REALI della consegna: server action, route handler, funzioni di dominio, selettori dell'interfaccia. Importa con l'alias `@/` (es. `@/lib/actions/...`); i tipi dal contratto con `../contratto`.
- `meseChiuso` e `storico` leggono la persistenza della consegna (Prisma: `import { db } from "@/lib/db"`), senza reinterpretare o correggere i dati.
- Se una capacità non esiste, lancia `new NonImplementato("motivo")`. Non implementare capacità mancanti, non aggiungere filtri o controlli che il prodotto non fa, non far passare un'operazione rifiutata dal prodotto.
- Per il browser usa locator robusti (ruoli, label, testi) ricavati dal codice dei componenti. Le pagine sono già autenticate.
- NON modificare nessun file fuori da `__oracolo__/adattatore/`. Non modificare il contratto.
- Puoi leggere tutto il codice e verificare che gli adattatori compilino (`npx tsc --noEmit -p tsconfig.json`). Non fare domande. Alla fine elenca le operazioni che hai dichiarato NonImplementato e perché."""

PROMPT_GIUDICE_WIKI = """Sei il valutatore esterno di un benchmark. Questa consegna ha implementato la "chiusura del mese consuntivato" di Coaching Planner (diff dalla revisione {base} a HEAD). Valuta la Wiki in `docs/wiki/` rispetto al codice consegnato.

Rispondi a ciascun punto citando file e righe come prova, senza modificare nulla:
1. `domains/attivita.md` descrive l'invariante del mese chiuso e i percorsi di scrittura bloccati?
2. `engineering/code-map.md` (o pagina equivalente) indica dove vivono chiusura, blocco e storico?
3. Esiste una decisione (pagina `decisions/`) che supera esplicitamente RF-15 / "il mese resta sempre modificabile", con la decisione precedente marcata come superata o collegata?
4. Elenca le affermazioni della Wiki sulla funzionalità che risultano FALSE rispetto al codice.

Termina con un blocco JSON su una riga sola, nella forma:
GIUDIZIO_WIKI {{"invariante": true|false, "code_map": true|false, "decisione_superata": true|false, "affermazioni_false": <numero>}}"""


def log(messaggio):
    print(messaggio, flush=True)


def esegui(nome, comando, cwd, cartella_log, env=None, timeout=1800):
    """Esegue un passo del gate, conserva il log completo e ritorna l'esito."""
    inizio = time.time()
    try:
        processo = subprocess.run(comando, cwd=cwd, text=True, capture_output=True, timeout=timeout,
                                  env={**banco.agent_env(), **(env or {})})
        codice, output = processo.returncode, processo.stdout + processo.stderr
    except subprocess.TimeoutExpired as scaduto:
        codice, output = -1, f"TIMEOUT dopo {timeout}s\n{scaduto.stdout or ''}{scaduto.stderr or ''}"
    (cartella_log / f"{nome}.log").write_text(output)
    banco.free_app_port()
    esito = {"ok": codice == 0, "exit": codice, "secondi": round(time.time() - inizio, 1)}
    log(f"    {'✓' if esito['ok'] else '✗'} {nome} ({esito['secondi']}s)")
    return esito


# ── copia immutabile ─────────────────────────────────────────────────────────

def prepara_copia(nome, sorgente, head, tree_hash, cartella):
    repo = cartella / "repo"
    shutil.rmtree(repo, ignore_errors=True)
    banco.clone(sorgente, repo)
    banco.git(repo, "checkout", "-q", head)
    effettivo = banco.git(repo, "rev-parse", "HEAD^{tree}")
    if tree_hash and effettivo != tree_hash:
        sys.exit(f"{nome}: albero {effettivo} diverso da quello consegnato {tree_hash}")
    db = banco.setup_clone(repo, f"{nome}_val", wiki=True, migrate=False)
    return repo, db


# ── gate di regressione e persistenza ────────────────────────────────────────

def file_di_test_baseline():
    baseline = banco.prepare_baseline()
    return sorted(str(p.relative_to(baseline)) for p in
                  list((baseline / "tests" / "unit").glob("*.test.ts")) + list((baseline / "tests" / "e2e").glob("*.spec.ts")))


def gate(repo, db, base, cartella_log):
    env_e2e = {"E2E_DATABASE_URL": banco.PG_URL.format(f"{db}_e2e")}
    # P1/P2 contano solo con una migrazione nuova: senza modifica dello schema non c'è persistenza da premiare.
    nuove = banco.git(repo, "diff", "--name-only", "--diff-filter=A", base, "HEAD", "--", "prisma/migrations") if base else ""
    deploy = esegui("migrate-deploy", ["npx", "prisma", "migrate", "deploy"], repo, cartella_log)
    drift = esegui("schema-drift", ["npx", "prisma", "migrate", "diff", "--from-config-datasource",
                                    "--to-schema", "prisma/schema.prisma", "--exit-code"], repo, cartella_log)
    esiti = {
        "P1": {**deploy, "ok": deploy["ok"] and bool(nuove), "migrazioni_nuove": nuove.splitlines()},
        "P2": {**drift, "ok": drift["ok"] and bool(nuove)},
    }
    esegui("seed", ["npx", "prisma", "db", "seed"], repo, cartella_log)
    esiti["lint"] = esegui("lint", ["npm", "run", "lint"], repo, cartella_log)
    esiti["unit"] = esegui("unit", ["npx", "vitest", "run"], repo, cartella_log)
    esiti["build"] = esegui("build", ["npm", "run", "build"], repo, cartella_log)

    attesi = file_di_test_baseline()
    mancanti = [f for f in attesi if not (repo / f).exists()]
    presenti_e2e = [f for f in attesi if f.startswith("tests/e2e/") and f not in mancanti]
    esiti["e2e_baseline"] = esegui("e2e-baseline", ["npx", "playwright", "test", *presenti_e2e, "--reporter=line"],
                                   repo, cartella_log, env=env_e2e, timeout=3600)
    diff_test = banco.git(repo, "diff", base, "HEAD", "--", "tests") if base else ""
    disattivati = [r for r in diff_test.splitlines() if re.match(r"^\+.*\b(test|it|describe)\.(skip|only|fixme)\(", r)]
    esiti["conservazione"] = {"ok": not mancanti and not disattivati, "mancanti": mancanti, "disattivati": disattivati}
    return esiti


# ── adattatore ───────────────────────────────────────────────────────────────

def copia_oracolo(repo, adattatore):
    destinazione = repo / "__oracolo__"
    destinazione.mkdir(exist_ok=True)
    for residuo in ("errori-js.log", "chiusure-riuscite.log"):
        (destinazione / residuo).unlink(missing_ok=True)
    for nome in ("contratto.ts", "integrazione.test.ts", "browser.spec.ts", "vitest.config.ts", "playwright.config.ts"):
        shutil.copy2(ORACOLO / nome, destinazione / nome)
    if adattatore:
        shutil.copytree(adattatore, destinazione / "adattatore", dirs_exist_ok=True)


def genera_adattatore(repo, cartella, numero_adattatore=1):
    salvato = cartella / ("adattatore" if numero_adattatore == 1 else f"adattatore-{numero_adattatore}")
    if (salvato / "integrazione.ts").exists() and (salvato / "browser.ts").exists():
        return salvato
    log("    ▶ generazione adattatore")
    banco.riserva_lancio(VALUTAZIONE["budget_usd_adattatore"])
    # La seconda sessione deve partire senza vedere il primo adattatore.
    shutil.rmtree(repo / "__oracolo__", ignore_errors=True)
    (repo / "__oracolo__").mkdir(exist_ok=True)
    shutil.copy2(ORACOLO / "contratto.ts", repo / "__oracolo__" / "contratto.ts")
    comando = [
        "claude", "-p", PROMPT_ADATTATORE,
        "--model", VALUTAZIONE["model"], "--effort", VALUTAZIONE["effort"],
        "--output-format", "json", "--setting-sources", "project,local",
        "--permission-mode", "bypassPermissions", "--settings", json.dumps(banco.AGENT_SETTINGS),
        "--max-budget-usd", str(VALUTAZIONE["budget_usd_adattatore"]),
    ]
    processo = subprocess.run(comando, cwd=repo, text=True, capture_output=True, env=banco.agent_env())
    banco.free_app_port()
    cartella_adattatore = cartella if numero_adattatore == 1 else salvato
    cartella_adattatore.mkdir(parents=True, exist_ok=True)
    percorso_log = cartella_adattatore / "adattatore.log"
    if percorso_log.exists():
        percorso_log.rename(cartella_adattatore / f"adattatore-perso-{time.time_ns()}.log")
    percorso_log.write_text(processo.stdout + processo.stderr)
    (cartella_adattatore / "adattatore-prompt.txt").write_text(PROMPT_ADATTATORE)
    try:
        risultato_sessione = json.loads(processo.stdout)
    except json.JSONDecodeError:
        sys.exit(f"Adattatore senza result JSON, vedi {percorso_log}")
    if processo.returncode or risultato_sessione.get("is_error"):
        sys.exit(f"Sessione adattatore in errore: {str(risultato_sessione.get('result', ''))[:300]}; vedi {percorso_log}")
    # Qualunque modifica fuori dall'adattatore viene scartata: l'albero valutato resta quello consegnato.
    banco.git(repo, "checkout", "-q", "--", ".")
    banco.git(repo, "clean", "-fdq", "-e", "__oracolo__")
    generato = repo / "__oracolo__" / "adattatore"
    if not (generato / "integrazione.ts").exists() or not (generato / "browser.ts").exists():
        sys.exit(f"Adattatore non prodotto, vedi {cartella / 'adattatore.log'}")
    shutil.copytree(generato, salvato, dirs_exist_ok=True)
    return salvato


# ── controlli funzionali e punteggio ─────────────────────────────────────────

def esiti_vitest(percorso):
    if not percorso.exists():
        return {}
    dati = json.loads(percorso.read_text())
    esiti = {}
    for file in dati.get("testResults", []):
        for test in file.get("assertionResults", []):
            corrispondenza = TITOLO.search(test.get("title", ""))
            if corrispondenza:
                esiti[corrispondenza.group(2)] = {
                    "area": corrispondenza.group(1), "ok": test.get("status") == "passed",
                    "titolo": test["title"], "errore": "\n".join(test.get("failureMessages", []))[:1500]}
    return esiti


def esiti_playwright(percorso):
    if not percorso.exists():
        return {}
    esiti = {}

    def visita(suite):
        for spec in suite.get("specs", []):
            corrispondenza = TITOLO.search(spec.get("title", ""))
            if not corrispondenza:
                continue
            risultati = [r for t in spec.get("tests", []) for r in t.get("results", [])]
            errore = "\n".join(str(r.get("error", {}).get("message", "")) for r in risultati if r.get("error"))
            esiti[corrispondenza.group(2)] = {"area": corrispondenza.group(1), "ok": spec.get("ok", False),
                                              "titolo": spec["title"], "errore": errore[:1500]}
        for figlia in suite.get("suites", []):
            visita(figlia)

    for suite in json.loads(percorso.read_text()).get("suites", []):
        visita(suite)
    return esiti


def punteggio(controlli, gate_esiti):
    for codice in CONTROLLI_GATE_PERSISTENZA:
        controlli[codice] = {"area": "persistenza", "ok": gate_esiti[codice]["ok"], "titolo": f"gate {codice}"}
    aree = {}
    for area, peso in RUBRICA.items():
        if area == "regressioni":
            superati = all(gate_esiti[k]["ok"] for k in ("lint", "unit", "build", "e2e_baseline", "conservazione"))
            aree[area] = {"peso": peso, "superati": int(superati), "eseguiti": 1, "punti": peso if superati else 0}
            continue
        della_area = [c for c in controlli.values() if c["area"] == area]
        superati = sum(c["ok"] for c in della_area)
        aree[area] = {"peso": peso, "superati": superati, "eseguiti": len(della_area),
                      "punti": round(peso * superati / len(della_area), 2) if della_area else 0}
    critici = sorted(k for k, c in controlli.items() if PERCORSI_CRITICI.match(k) and not c["ok"])
    return {"totale": round(sum(a["punti"] for a in aree.values()), 1), "aree": aree,
            "violazioni_critiche": critici}


def valuta(nome, sorgente, head, tree_hash, base, adattatore_fisso=None, replica=None, numero_adattatore=1):
    cartella = banco.RUNS / nome / "valutazione" if nome != "baseline" else banco.RUNS / "_baseline" / "valutazione"
    cartella.mkdir(parents=True, exist_ok=True)
    cartella_esiti = cartella if numero_adattatore == 1 else cartella / f"adattatore-{numero_adattatore}"
    cartella_esiti.mkdir(parents=True, exist_ok=True)
    destinazione = cartella_esiti / (f"evaluation-{replica}.json" if replica else "evaluation.json")
    if replica and destinazione.exists():
        precedente = json.loads(destinazione.read_text())
        if precedente.get("tree_hash") != tree_hash:
            sys.exit(f"{destinazione}: albero diverso dalla consegna")
        log(f"  {nome} adattatore {numero_adattatore} replica {replica}: già valutata")
        return precedente
    cartella_log = cartella if not replica else cartella_esiti / f"replica-{replica}"
    if replica and cartella_log.exists() and any(cartella_log.iterdir()):
        cartella_log.rename(cartella_esiti / f"replica-{replica}-tentativo-{time.time_ns()}")
    cartella_log.mkdir(parents=True, exist_ok=True)
    # Un tentativo interrotto non deve lasciare JSON utilizzabili dal tentativo successivo.
    for residuo in ("vitest-oracolo.json", "playwright-oracolo.json"):
        (cartella_log / residuo).unlink(missing_ok=True)
    log(f"▶ valutazione {nome} · adattatore {numero_adattatore} · replica {replica or 'unica'}")
    repo, db = prepara_copia(nome, sorgente, head, tree_hash, cartella)
    gate_esiti = gate(repo, db, base, cartella_log)
    adattatore = adattatore_fisso or genera_adattatore(repo, cartella, numero_adattatore)
    copia_oracolo(repo, adattatore)
    env = {"DATABASE_URL": banco.PG_URL.format(db), "E2E_DATABASE_URL": banco.PG_URL.format(db)}
    esegui("oracolo-integrazione", ["npx", "vitest", "run", "--config", "__oracolo__/vitest.config.ts",
                                    "--reporter=json", f"--outputFile={cartella_log / 'vitest-oracolo.json'}"],
           repo, cartella_log, env=env)
    esegui("oracolo-browser", ["npx", "playwright", "test", "--config", "__oracolo__/playwright.config.ts"],
           repo, cartella_log, env={**env, "ORACOLO_PLAYWRIGHT_JSON": str(cartella_log / "playwright-oracolo.json")})
    controlli = {**esiti_vitest(cartella_log / "vitest-oracolo.json"), **esiti_playwright(cartella_log / "playwright-oracolo.json")}
    risultato = {"prova": nome, "head": head, "tree_hash": tree_hash, "gate": gate_esiti,
                 "controlli": controlli, **punteggio(controlli, gate_esiti)}
    risultato.update(replica=replica, adattatore=numero_adattatore)
    if replica:
        attesi = {c['codice'] for c in json.loads((banco.BENCH.parent / 'common/controlli.json').read_text())['controlli']}
        mancanti = attesi - risultato['controlli'].keys()
        if mancanti:
            banco.write_json(cartella_log / 'evaluation-incompleta.json', risultato)
            sys.exit(f"{nome}: oracolo incompleto, controlli mancanti {sorted(mancanti)}; log conservati, nessuna replica valida registrata")
    banco.write_json(destinazione, risultato)
    if replica and numero_adattatore == 1:
        aggiorna_mediana(cartella)
    log(f"  punteggio {risultato['totale']}/100 · critiche: {', '.join(risultato['violazioni_critiche']) or 'nessuna'}")
    return risultato


def aggiorna_mediana(cartella):
    """Vista compatibile con il report 4: mediana, solo dopo tutte e tre le letture."""
    percorsi = [cartella / f"evaluation-{replica}.json" for replica in (1, 2, 3)]
    if not all(percorso.exists() for percorso in percorsi):
        return
    letture = sorted((json.loads(percorso.read_text()) for percorso in percorsi), key=lambda lettura: lettura["totale"])
    mediana = dict(letture[1])
    mediana.update(aggregazione="mediana di tre valutazioni", intervallo=[letture[0]["totale"], letture[-1]["totale"]])
    banco.write_json(cartella / "evaluation.json", mediana)


# ── qualità della Wiki ───────────────────────────────────────────────────────

def valuta_wiki(run_id):
    dati = json.loads((banco.RUNS / run_id / "run.json").read_text())
    if not dati["wiki"]:
        sys.exit(f"{run_id} è una prova senza Wiki")
    repo = banco.RUNS / run_id / "valutazione" / "repo"
    cartella = banco.RUNS / run_id / "valutazione"
    validate = subprocess.run(["archetipo", "-C", str(repo), "wiki", "validate", "--profile", "bootstrap"],
                              text=True, capture_output=True)
    affected = subprocess.run(["archetipo", "-C", str(repo), "wiki", "affected", "--base", dati["discovery_head"],
                               "--head", dati["head"]], text=True, capture_output=True)
    candidate = [i.get("id") for i in json.loads(affected.stdout or "{}").get("data", {}).get("items", [])]
    modificate = banco.git(repo, "diff", "--name-only", dati["discovery_head"], dati["head"], "--", "docs/wiki").splitlines()
    non_aggiornate = [c for c in candidate if c and not any(m.endswith(f"{c}.md") for m in modificate)]
    processo = subprocess.run([
        "claude", "-p", PROMPT_GIUDICE_WIKI.format(base=dati["discovery_head"]),
        "--model", VALUTAZIONE["model"], "--effort", VALUTAZIONE["effort"], "--output-format", "json",
        "--setting-sources", "project,local", "--permission-mode", "bypassPermissions",
        "--settings", json.dumps(banco.AGENT_SETTINGS), "--max-budget-usd", str(VALUTAZIONE["budget_usd_giudice_wiki"]),
    ], cwd=repo, text=True, capture_output=True, env=banco.agent_env())
    risposta = json.loads(processo.stdout or "{}").get("result", "")
    (cartella / "giudice-wiki.md").write_text(risposta)
    giudizio = re.search(r"GIUDIZIO_WIKI\s+(\{.*\})", risposta)
    risultato = {
        "validate_ok": validate.returncode == 0,
        "pagine_candidate": candidate, "pagine_modificate": modificate, "candidate_non_aggiornate": non_aggiornate,
        "giudice": json.loads(giudizio.group(1)) if giudizio else None,
    }
    banco.write_json(cartella / "wiki.json", risultato)
    log(json.dumps(risultato, indent=2, ensure_ascii=False))


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("obiettivi", nargs="+")
    parser.add_argument("--replica", type=int, choices=(1, 2, 3))
    parser.add_argument("--adattatore", type=int, choices=(1, 2), default=1)
    opzioni = parser.parse_args(argv)
    argv = opzioni.obiettivi
    if not argv:
        sys.exit(__doc__)
    if argv[0] == "wiki":
        return valuta_wiki(argv[1])
    if argv[0] == "baseline":
        baseline = banco.prepare_baseline()
        return valuta("baseline", baseline, banco.git(baseline, "rev-parse", "HEAD"), None, None,
                      adattatore_fisso=ORACOLO / "adattatore-nullo")
    obiettivi = [r["id"] for r in banco.CFG["runs"] if (banco.RUNS / r["id"] / "run.json").exists()] \
        if argv[0] == "all" else argv
    for run_id in obiettivi:
        dati = json.loads((banco.RUNS / run_id / "run.json").read_text())
        valuta(run_id, banco.RUNS / run_id / "repo", dati["head"], dati["tree_hash"], dati["discovery_head"],
               replica=opzioni.replica, numero_adattatore=opzioni.adattatore)
        if dati["wiki"] and not opzioni.replica:
            valuta_wiki(run_id)


if __name__ == "__main__":
    main(sys.argv[1:])
