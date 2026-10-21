#!/usr/bin/env python3
"""Report 6 · fase spec: 100 chiarimenti con 5 varianti di archetipo-spec (matrice-spec.json).

Uso (dalla radice del repository):
  python3 bench/fase-spec/run.py preflight
  python3 bench/fase-spec/run.py cella S-V1-sonnet-r03      # un chiarimento
  python3 bench/fase-spec/run.py all [--paralleli N]        # tutte le celle nell'ordine della matrice (N processi, lock per cella)
  python3 bench/fase-spec/run.py status

Riusa l'harness di bench/wiki-benchmark/run.py (clone isolato, skill copiate, sessioni `claude -p` nuove per turno,
committente simulato in sessione separata, telemetria). Ogni cella vive in $BENCH_RUNS/fase-spec/<id>/:
repo/, phases/01-spec/ (prompt, stream-NN.jsonl, transcript/, dialogo.md, committente.jsonl, metrics.json), storie.md, skill.diff, discovery.json.
Precondizioni verificate dal banco e registrate in metrics.json; una fase che dichiara «non abilitato» o E_PRECONDITION è invalida.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

BENCH = Path(__file__).resolve().parent.parent
os.environ.setdefault("BENCH_MATRICE", "matrice-spec.json")
sys.path.insert(0, str(BENCH / "wiki-benchmark"))
import run as banco  # noqa: E402

CFG = banco.CFG
RUNS = banco.RUNS / "fase-spec"
VARIANTI = BENCH / "fase-spec" / "varianti"
# «offerta non abilitata» è un termine di dominio: contano solo le dichiarazioni sulla Wiki o sulle precondizioni.
PATTERN_INVALIDA = re.compile(r"wiki[^.\n]{0,40}(non abilitat|disabilit|non attiv)|non abilitat[^.\n]{0,30}wiki|E_PRECONDITION|wiki\.enabled[^.\n]{0,20}false", re.I)
MARCATORE_INSERIMENTO = "## Output Boundaries"


def cella_di(id_):
    c = next((c for c in CFG["celle"] if c["id"] == id_), None)
    if c is None:
        sys.exit(f"Cella sconosciuta: {id_}")
    return c


def hash_cartella(cartella):
    h = hashlib.sha256()
    for p in sorted(cartella.rglob("*")):
        if p.is_file():
            h.update(str(p.relative_to(cartella)).encode())
            h.update(p.read_bytes())
    return h.hexdigest()[:16]


def applica_variante(repo, variante):
    """Copia della skill nel clone con il blocco della variante inserito prima di «Output Boundaries». Ritorna il diff."""
    file = CFG["varianti"][variante]["file"]
    if not file:
        return ""
    blocco = (VARIANTI / file).read_text().rstrip("\n") + "\n\n"
    diff = ""
    for skills in (".claude/skills", ".agents/skills"):
        skill = repo / skills / "archetipo-spec" / "SKILL.md"
        if not skill.exists() or skill.is_symlink():
            continue
        prima = skill.read_text()
        assert MARCATORE_INSERIMENTO in prima, "SKILL.md senza il marcatore di inserimento"
        dopo = prima.replace(MARCATORE_INSERIMENTO, blocco + MARCATORE_INSERIMENTO, 1)
        skill.write_text(dopo)
        if not diff:
            out = subprocess.run(["diff", "-u", "--label", "a/SKILL.md", "--label", f"b/SKILL.md ({variante})", "-", str(skill)],
                                 input=prima, capture_output=True, text=True)
            diff = out.stdout
    return diff


def setup_leggero(repo, nome):
    """Come banco.setup_clone ma senza database e migrazioni: il chiarimento non avvia l'app."""
    banco.enable_wiki(repo)
    for skills in (".claude/skills", ".agents/skills"):
        shutil.rmtree(repo / skills, ignore_errors=True)
        shutil.copytree(banco.REPO / skills, repo / skills)
    if (banco.REPO / "node_modules").exists() and not (repo / "node_modules").exists():
        banco.sh(["cp", "-cR", str(banco.REPO / "node_modules"), str(repo / "node_modules")])
    (repo / ".env").write_text('DATABASE_URL="postgresql://bench:bench@localhost:5432/non_usato"\nE2E_TEST_MODE=false\n'
                               'AUTH_SECRET="bench"\nSESSION_SECRET="bench"\nGOOGLE_CLIENT_ID="bench"\nGOOGLE_CLIENT_SECRET="bench"\n'
                               f'GOOGLE_REDIRECT_URI="http://localhost:{banco.APP_PORT}/api/auth/google/callback"\nAMMINISTRATORE_INIZIALE_EMAIL=\n')


def precondizioni(repo):
    out = banco.sh(["archetipo", "config", "show"], cwd=repo, check=False)
    try:
        wiki_enabled = json.loads(out.stdout)["data"]["wiki"]["enabled"]
    except (json.JSONDecodeError, KeyError):
        wiki_enabled = None
    return {
        "docs_wiki_presente": (repo / "docs" / "wiki" / "index.md").exists(),
        "skill_archetipo_wiki": (repo / ".claude" / "skills" / "archetipo-wiki" / "SKILL.md").exists(),
        "wiki_enabled": wiki_enabled,
        "hash_skill_spec": hash_cartella(repo / ".claude" / "skills" / "archetipo-spec"),
        "hash_skills": hash_cartella(repo / ".claude" / "skills"),
    }


def testo_storie(repo, codes):
    parti = []
    for code in codes:
        out = banco.sh(["archetipo", "spec", "show", code], cwd=repo, check=False)
        try:
            spec = json.loads(out.stdout)["data"]["spec"]
            corpo = spec.get("body", "")
            parti.append(corpo if corpo.lstrip().startswith("####") else f"#### {spec['code']}: {spec['title']}\n\n{corpo}")
        except (json.JSONDecodeError, KeyError, TypeError):
            parti.append(f"#### {code}\n\n(non leggibile: {out.stderr[:200]})")
    return "\n\n---\n\n".join(parti)


def span_subagenti(transcript_dir):
    """Per ogni transcript di subagente (file con «--» nel nome): (inizio UTC, secondi coperti), per attribuire la revisione avversaria."""
    spans = []
    for path in transcript_dir.glob("*--*.jsonl"):
        stamps = [banco.parse_time(json.loads(l).get("timestamp")) for l in path.read_text().splitlines() if l.strip()]
        stamps = [s for s in stamps if s]
        if len(stamps) > 1:
            spans.append((min(stamps).timestamp(), (max(stamps) - min(stamps)).total_seconds()))
    return spans


def fasi_del_dialogo(turni, dialog_team, codici_per_turno, spans_subagenti):
    """Minuti per fase: domande (turni senza bozza), bozza (turni in cui compare AC-1), revisione avversaria (subagenti, sottratta
    al turno in cui sono partiti), salvataggio (turno in cui compaiono le storie). Euristica dichiarata nel report."""
    fasi = {"domande": 0.0, "bozza": 0.0, "revisione_avversaria": 0.0, "salvataggio": 0.0}
    for i, (turno, testo) in enumerate(zip(turni, dialog_team)):
        minuti = turno["minuti"]
        for inizio, secondi in spans_subagenti:
            if turno["inizio_ts"] <= inizio <= turno["fine_ts"]:
                tolto = min(minuti, secondi / 60)
                fasi["revisione_avversaria"] += tolto
                minuti -= tolto
        if codici_per_turno[i]:
            fase = "salvataggio"
        elif re.search(r"\bAC-1\b", testo):
            fase = "bozza"
        else:
            fase = "domande"
        fasi[fase] += minuti
    return {k: round(v, 2) for k, v in fasi.items()}


def chiarimento(cella):
    run_dir = RUNS / cella["id"]
    summary_path = run_dir / "discovery.json"
    if summary_path.exists():
        return json.loads(summary_path.read_text())
    lock = run_dir / ".lock"
    try:
        lock.mkdir(parents=True)
    except FileExistsError:
        print(f"  {cella['id']}: in corso in un altro processo (lock), salto", flush=True)
        return None
    try:
        return _chiarimento(cella, run_dir, summary_path)
    finally:
        shutil.rmtree(lock, ignore_errors=True)


def _chiarimento(cella, run_dir, summary_path):
    model, variante = cella["model"], cella["variante"]
    repo = run_dir / "repo"
    if not (repo / ".git").exists():
        shutil.rmtree(repo, ignore_errors=True)
        banco.clone(banco.prepare_baseline(), repo)
        setup_leggero(repo, cella["id"])
        (run_dir / "skill.diff").write_text(applica_variante(repo, variante))
    print(f"▶ chiarimento {cella['id']} ({CFG['varianti'][variante]['label']}, {model})", flush=True)
    pre = precondizioni(repo)
    if not (pre["docs_wiki_presente"] and pre["skill_archetipo_wiki"] and pre["wiki_enabled"] is True):
        sys.exit(f"{cella['id']}: precondizioni non soddisfatte {pre}")
    phase_dir = run_dir / "phases" / "01-spec"
    shutil.rmtree(phase_dir, ignore_errors=True)
    phase_dir.mkdir(parents=True)
    banco.git(repo, "reset", "-q", "--hard")
    banco.git(repo, "clean", "-fdq")
    before = banco.spec_codes(repo)
    avvio = datetime.now().isoformat(timespec="seconds")

    dialog, results, session, init, codici_per_turno = [], [], None, None, []
    committente_seconds = committente_cost = 0.0
    prompt = f"/archetipo-spec {banco.RICHIESTA}"
    (phase_dir / "prompt.txt").write_text(prompt)
    new_codes = []
    turni = []
    for turn in range(CFG["max_discovery_turns"]):
        inizio_ts = time.time()
        result, init = banco.run_claude(phase_dir, turn, prompt, model, repo, resume=session)
        turni.append({"minuti": round(result.get("duration_ms", 0) / 60000, 2), "usd_cumulato": result.get("total_cost_usd"),
                      "inizio_ts": inizio_ts, "fine_ts": time.time()})
        results.append(result)
        session = result["session_id"]
        dialog.append(("team", str(result.get("result", ""))))
        new_codes = sorted(banco.spec_codes(repo) - before)
        codici_per_turno.append(bool(new_codes))
        if new_codes:
            break
        started = time.time()
        answer, cost = banco.ask_committente(dialog, phase_dir)
        committente_seconds += time.time() - started
        committente_cost += cost
        dialog.append(("committente", answer))
        prompt = answer
    else:
        sys.exit(f"{cella['id']}: nessuna storia scritta dopo {CFG['max_discovery_turns']} scambi")

    (phase_dir / "dialogo.md").write_text("\n\n".join(
        f"### {'Team' if who == 'team' else 'Committente'}\n\n{text}" for who, text in dialog))
    metrics = banco.collect(phase_dir, results, init)
    banco.commit_if_dirty(repo, "bench: chiarimento")
    testi = "\n".join(t for _, t in dialog) + "\n" + "".join(p.read_text() for p in (phase_dir / "transcript").glob("*.jsonl"))
    invalida = [m.group(0) for m in PATTERN_INVALIDA.finditer(testi)][:5]
    metrics.update(phase="01-spec", skill=f"archetipo-spec {variante}", variante=variante, exchanges=len(dialog) // 2,
                   committente_seconds=round(committente_seconds, 1), committente_cost_usd=committente_cost,
                   precondizioni=pre, avvio=avvio, fine=datetime.now().isoformat(timespec="seconds"),
                   fasi_minuti=fasi_del_dialogo(turni, [t for w, t in dialog if w == "team"], codici_per_turno,
                                                span_subagenti(phase_dir / "transcript")),
                   turni=turni, invalida=invalida)
    banco.write_json(phase_dir / "metrics.json", metrics)
    (run_dir / "storie.md").write_text(testo_storie(repo, new_codes))
    if invalida:
        (run_dir / "INVALIDA.txt").write_text("\n".join(invalida))
        sys.exit(f"{cella['id']}: fase invalida, dichiara una risorsa non disponibile: {invalida}. Spostare in _scartati e rifare.")
    summary = {"id": cella["id"], "variante": variante, "model": model, "replica": cella["replica"], "codes": new_codes,
               "head": banco.git(repo, "rev-parse", "HEAD"), "metrics": metrics}
    banco.write_json(summary_path, summary)
    print(f"  {cella['id']}: storie {', '.join(new_codes)} · {len(dialog) // 2} scambi · {metrics['duration_ms'] / 60000:.1f} min · "
          f"{metrics['cost_usd'] + committente_cost:.2f} USD (committente {committente_cost:.2f})", flush=True)
    return summary


def convalida(id_):
    """Dopo una correzione del pattern di invalidità: ricontrolla i testi salvati, rigenera storie.md e scrive discovery.json."""
    cella = cella_di(id_)
    run_dir = RUNS / id_
    phase_dir = run_dir / "phases" / "01-spec"
    metrics = json.loads((phase_dir / "metrics.json").read_text())
    testi = (phase_dir / "dialogo.md").read_text() + "".join(p.read_text() for p in (phase_dir / "transcript").glob("*.jsonl"))
    invalida = [m.group(0) for m in PATTERN_INVALIDA.finditer(testi)][:5]
    metrics["invalida"] = invalida
    banco.write_json(phase_dir / "metrics.json", metrics)
    repo = run_dir / "repo"
    before = set(banco.archetipo(banco.prepare_baseline(), "spec", "list")["summary"]["codes"])
    codes = sorted(banco.spec_codes(repo) - before)
    (run_dir / "storie.md").write_text(testo_storie(repo, codes))
    if invalida:
        (run_dir / "INVALIDA.txt").write_text("\n".join(invalida))
        return print(f"{id_}: ancora invalida: {invalida}")
    (run_dir / "INVALIDA.txt").unlink(missing_ok=True)
    banco.write_json(run_dir / "discovery.json", {"id": id_, "variante": cella["variante"], "model": cella["model"], "replica": cella["replica"],
                                                  "codes": codes, "head": banco.git(repo, "rev-parse", "HEAD"), "metrics": metrics})
    print(f"{id_}: convalidata, storie {codes}")


def status():
    fatte = [c for c in CFG["celle"] if (RUNS / c["id"] / "discovery.json").exists()]
    print(f"{len(fatte)}/{len(CFG['celle'])} chiarimenti fatti")
    for c in CFG["celle"]:
        s = banco.json.loads((RUNS / c["id"] / "discovery.json").read_text()) if (RUNS / c["id"] / "discovery.json").exists() else None
        stato = (f"{len(s['codes'])} storie · {s['metrics']['exchanges']} scambi · {s['metrics']['duration_ms'] / 60000:.1f} min · "
                 f"{s['metrics']['cost_usd'] + s['metrics']['committente_cost_usd']:.2f} USD") if s else ("INVALIDA" if (RUNS / c["id"] / "INVALIDA.txt").exists() else "—")
        print(f"  {c['id']:<22} {stato}")


def main(argv):
    comando = argv[0] if argv else "status"
    if comando == "preflight":
        banco.preflight()
    elif comando == "cella":
        chiarimento(cella_di(argv[1]))
    elif comando == "all":
        paralleli = int(argv[argv.index("--paralleli") + 1]) if "--paralleli" in argv else 1
        if paralleli > 1:
            procs = [subprocess.Popen([sys.executable, "-u", __file__, "all"], cwd=banco.REPO) for _ in range(paralleli)]
            codici = [p.wait() for p in procs]
            sys.exit(max(codici))
        for c in CFG["celle"]:
            chiarimento(c)
    elif comando == "convalida":
        for id_ in argv[1:]:
            convalida(id_)
    elif comando == "status":
        status()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
