#!/usr/bin/env python3
"""Harness del benchmark ARchetipo × Wiki su Coaching Planner.

Uso:
  python3 run.py preflight              # controlli d'ambiente, nessun costo
  python3 run.py baseline               # crea il clone baseline isolato
  python3 run.py discover <model> <wiki|nowiki>
  python3 run.py run <run-id>           # es. sonnet-C1 (esegue anche il chiarimento se manca)
  python3 run.py all                    # 4 chiarimenti + 10 prove nell'ordine di matrice.json
  python3 run.py status                 # tabella riassuntiva
  python3 run.py analyze <phase-dir>    # ricalcola la telemetria di una fase

Ogni fase è idempotente: se esiste phases/<fase>/metrics.json non viene rieseguita,
quindi dopo un'interruzione basta rilanciare lo stesso comando.
Le prove vivono in $BENCH_RUNS (default: ../coaching-planner-bench-runs accanto al repo).
"""
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

BENCH = Path(__file__).resolve().parent
REPO = BENCH.parents[1]
CFG = json.loads((BENCH / os.environ.get("BENCH_MATRICE", "matrice.json")).read_text())  # es. matrice-wiki.json
RICHIESTA = (BENCH / "richiesta.txt").read_text().strip()
PROFILO_COMMITTENTE = (BENCH / "committente.md").read_text()
RUNS = Path(os.environ.get("BENCH_RUNS", REPO.parent / "coaching-planner-bench-runs"))
CLAUDE_PROJECTS = Path.home() / ".claude" / "projects"
PG_CONTAINER = "coaching-planner-db"
PG_URL = "postgresql://user:password@localhost:5432/{}"
APP_PORT = 3000  # fissa in playwright.config.ts: le prove sono sequenziali

# Gli agenti non devono leggere il repo originale (contiene questo banco e il profilo nascosto).
AGENT_SETTINGS = {"permissions": {"deny": [f"Read(/{REPO}/**)", f"Edit(/{REPO}/**)"]}}
CONTAMINAZIONI = re.compile(r"ponytail|graphify", re.I)
WIKI_PATTERN = re.compile(r"archetipo\b.*\bwiki\b|docs/wiki|archetipo-wiki")
WIKI_NON_DISPONIBILE = re.compile(r"wiki[^.\n]{0,40}(non abilitat|disabilit|non attiv)|non abilitat[^.\n]{0,30}wiki|E_PRECONDITION|wiki\.enabled[^.\n]{0,20}false", re.I)

PROMPT_DIRETTO = """Implementa in Coaching Planner {oggetto}. Leggi le storie con `archetipo spec show <codice>`.

Lavora direttamente sul codice, senza usare le skill ARchetipo (archetipo-*) e senza cambiare lo stato delle storie nel backlog. Copri modello dati con migrazione Prisma, logica, interfaccia e test (unit ed e2e, seguendo AGENTS.md e tests/e2e/README.md). Prima di chiudere esegui lint e unit test e verifica il comportamento reale. Non fare domande: per ogni ambiguità scegli l'opzione più ragionevole e annotala nel riepilogo finale."""

PROMPT_DIRETTO_FIX = """La user story {code} di Coaching Planner è stata rimandata indietro dall'accettazione: il feedback di rework strutturato è nella spec (`archetipo spec show {code}`). Correggi l'implementazione finché ogni punto del feedback è risolto.

Lavora direttamente sul codice, senza usare le skill ARchetipo (archetipo-*) e senza cambiare lo stato delle storie nel backlog. Mantieni test unit ed e2e coerenti (AGENTS.md, tests/e2e/README.md). Prima di chiudere esegui lint e unit test. Non fare domande: annota le assunzioni nel riepilogo finale."""

PROMPT_WIKI_REFRESH = """/archetipo-wiki refresh

Aggiorna la Wiki in base alle modifiche introdotte tra la revisione {base} e HEAD (`archetipo wiki affected --base {base} --head HEAD`). Non approvare le pagine: l'approvazione è un'operazione separata. Non fare domande: annota le assunzioni nel riepilogo finale."""

# Testo letterale di .claude/skills/archetipo-autopilot/references/acceptance-loop.md
PROMPT_REVIEW = """Working directory: {workdir}
Spec: {code}
Phase skill: archetipo-review
Autonomous acceptance mode: enabled by archetipo-autopilot
Iteration: {n} of {max}
Request-changes allowed: {allowed}
Expected terminal state: DONE (accepted),
TODO (changes requested), or
REVIEW (left in review)

Load the installed archetipo-review skill and execute it for {code} in its
Autonomous acceptance mode. Read the spec, the increment, the Wiki dossier, and
the current repository state yourself. Do not assume any knowledge from planning,
implementation, or earlier specs. Decide and execute the verdict in this worker,
ask no questions, and end your output with the ARCHETIPO_REVIEW_VERDICT block."""


# ── utilità ──────────────────────────────────────────────────────────────────

def sh(cmd, cwd=None, check=True, **kw):
    return subprocess.run(cmd, cwd=cwd, check=check, text=True, capture_output=True, **kw)


def git(repo, *args):
    return sh(["git", *args], cwd=repo).stdout.strip()


def commit_if_dirty(repo, message):
    git(repo, "add", "-A")
    if sh(["git", "diff", "--cached", "--quiet"], cwd=repo, check=False).returncode:
        git(repo, "commit", "-q", "-m", message)


def archetipo(repo, *args):
    return json.loads(sh(["archetipo", "-C", str(repo), *args]).stdout)["data"]


def spec_codes(repo):
    return set(archetipo(repo, "spec", "list")["summary"]["codes"])


def spec_status(repo, code):
    return archetipo(repo, "spec", "show", code)["spec"]["status"]


def move_spec(repo, code, column):
    archetipo(repo, "spec", "move", code, "--to", column)
    commit_if_dirty(repo, f"bench: {code} → {column}")


def psql(sql):
    sh(["docker", "exec", PG_CONTAINER, "psql", "-U", "user", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql])


def free_app_port():
    """Termina server lasciati attivi da un agente sulla porta dell'app."""
    pids = sh(["lsof", "-ti", f"tcp:{APP_PORT}"], check=False).stdout.split()
    for pid in pids:
        subprocess.run(["kill", pid], check=False)


def agent_env():
    """Ambiente senza le variabili della sessione Claude che lancia il banco (desktop, SDK, sessione padre)."""
    inherited = ("CLAUDECODE", "CLAUDE_CODE_", "CLAUDE_AGENT_SDK", "CLAUDE_PID", "CLAUDE_EFFORT", "AI_AGENT", "ANTHROPIC_BASE_URL")
    return {k: v for k, v in os.environ.items() if not k.startswith(inherited)}


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def precondizioni(repo):
    """Fotografia del clone prima della fase, senza leggere segreti."""
    def hash_cartella(cartella):
        digest = hashlib.sha256()
        for file in sorted(cartella.rglob("*")):
            if file.is_file():
                digest.update(str(file.relative_to(cartella)).encode())
                digest.update(file.read_bytes())
        return digest.hexdigest()

    return {
        "docs_wiki_presente": (repo / "docs/wiki/index.md").exists(),
        "skill_archetipo_wiki": (repo / ".claude/skills/archetipo-wiki/SKILL.md").exists(),
        "wiki_enabled": archetipo(repo, "config", "show")["wiki"]["enabled"],
        "hash_skills": {directory: hash_cartella(repo / directory)
                        for directory in (".claude/skills", ".agents/skills")},
    }


def costi_esperimento():
    """Solo nuove spese della matrice corrente, compresi tentativi interrotti e scartati."""
    cartelle = [RUNS / prova["id"] for prova in CFG["runs"]]
    ids = [prova["id"] for prova in CFG["runs"]]
    cartelle += [p for p in (RUNS / "_scartati").glob("*") if any(p.name.startswith(id_ + "--") for id_ in ids)]
    voci = {"prove": 0.0, "scartate": 0.0, "turni_persi": 0.0, "adattatori": 0.0, "giudici_tecnici": 0.0}
    for cartella in cartelle:
        for fase in (cartella / "phases").glob("*"):
            sessioni = {}
            for stream in sorted(fase.glob("stream-*.jsonl")):
                _, risultato = parse_stream(stream)
                if risultato:
                    sessioni[risultato.get("session_id", stream.name)] = risultato
            costo = sum(r.get("total_cost_usd", 0) or 0 for r in sessioni.values())
            categoria = ("scartate" if cartella.parent.name == "_scartati" else
                         "prove" if (fase / "metrics.json").exists() else "turni_persi")
            voci[categoria] += costo
        for file in (cartella / "valutazione").glob("**/adattatore*.log"):
            try:
                voci["adattatori"] += json.loads(file.read_text()).get("total_cost_usd", 0) or 0
            except json.JSONDecodeError:
                pass
        for file in (cartella / "tecnica").glob("giudice-*.json"):
            voci["giudici_tecnici"] += json.loads(file.read_text()).get("cost_usd", 0) or 0
    return {**voci, "totale": sum(voci.values())}


def controlla_budget():
    controllo = CFG.get("controllo_budget")
    if not controllo:
        return
    costo = costi_esperimento()["totale"]
    adattatori_mancanti = sum(
        not (RUNS / prova["id"] / "valutazione" / directory / "browser.ts").exists()
        for prova in CFG["runs"] for directory in
        (["adattatore", "adattatore-2"] if prova.get("secondo_adattatore") else ["adattatore"]))
    riserva = adattatori_mancanti * controllo["riserva_usd_adattatore"]
    if costo + riserva >= controllo["stop_nuovi_lanci_usd"]:
        sys.exit(f"STOP budget: registrati {costo:.2f} USD + riserva adattatori {riserva:.2f} USD")


def riserva_lancio(costo_massimo):
    """Non avvia una sessione che potrebbe superare il tetto prima del prossimo result."""
    controlla_budget()
    controllo = CFG.get("controllo_budget")
    if controllo and costi_esperimento()["totale"] + costo_massimo > controllo["tetto_usd"]:
        sys.exit(f"STOP budget: margine insufficiente per il massimo della sessione ({costo_massimo} USD)")


def scarta_fase(run_dir, phase_dir, motivo):
    """Conserva evidenze e costo prima della ripresa; la consegna non viene corretta."""
    ora = datetime.now(ZoneInfo("Europe/Rome"))
    destinazione = RUNS / "_scartati" / f"{run_dir.name}--{phase_dir.name}--{ora.strftime('%Y%m%dT%H%M%S%f')}"
    (destinazione / "phases").mkdir(parents=True)
    shutil.move(str(phase_dir), destinazione / "phases" / phase_dir.name)
    write_json(destinazione / "scarto.json", {"motivo": motivo, "orario": ora.isoformat()})
    with (BENCH / "CORREZIONI.md").open("a") as registro:
        registro.write(f"\n\n## {ora.strftime('%Y-%m-%d %H:%M %Z')} · {run_dir.name} / {phase_dir.name}\n\n"
                       f"- Interruzione/scarto: {motivo}. Evidenze e costo conservati in `{destinazione}`; "
                       "nessuna metrica valida acquisita, ripresa dal commit precedente alla fase.\n")


# ── preparazione dei cloni ───────────────────────────────────────────────────

def prepare_baseline():
    repo = RUNS / "_baseline" / "repo"
    if (repo / ".git").exists():
        return repo
    repo.mkdir(parents=True)
    archive = subprocess.run(["git", "archive", CFG["baseline_sha"]], cwd=REPO, check=True, capture_output=True).stdout
    subprocess.run(["tar", "-x", "-C", str(repo)], input=archive, check=True)
    # Nessuna storia Git e nessun materiale del banco nel clone: niente fughe del profilo nascosto.
    for leak in ("bench", "docs/benchmark"):
        shutil.rmtree(repo / leak, ignore_errors=True)
    config = repo / ".archetipo" / "config.yaml"
    config.write_text(re.sub(r"(worktree:\n\s+enabled:) true", r"\1 false", config.read_text()))
    git(repo, "init", "-q", "-b", "main")
    git(repo, "config", "user.name", "bench")
    git(repo, "config", "user.email", "bench@localhost")
    commit_if_dirty(repo, "baseline")
    return repo


def clone(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    sh(["git", "clone", "-q", str(source), str(target)])
    git(target, "remote", "remove", "origin")
    git(target, "config", "user.name", "bench")
    git(target, "config", "user.email", "bench@localhost")


def remove_wiki(repo):
    git(repo, "rm", "-rq", "docs/wiki")
    commit_if_dirty(repo, "bench: rimozione Wiki")


def restore_wiki(repo):
    """Riporta la Wiki della baseline in un clone che ne è privo (storie da un chiarimento senza Wiki)."""
    shutil.copytree(prepare_baseline() / "docs" / "wiki", repo / "docs" / "wiki")
    commit_if_dirty(repo, "bench: ripristino Wiki")


def enable_wiki(repo):
    """Dichiara la Wiki abilitata nel config: il progetto non ha la chiave e la CLI la riporta false, così alcuni
    agenti saltano le operazioni Wiki anche quando docs/wiki esiste (osservato in sonnet-PW-1)."""
    config = repo / ".archetipo" / "config.yaml"
    if "enabled: true" not in config.read_text().split("wiki:")[-1][:40]:
        config.write_text(config.read_text().rstrip("\n") + "\nwiki:\n    enabled: true\n")
        commit_if_dirty(repo, "bench: wiki abilitata")


def setup_clone(repo, name, wiki, migrate=True):
    """Skill, dipendenze, database e .env dedicati. Escluso dai tempi delle prove."""
    if wiki:
        enable_wiki(repo)
    # Le skill sono gitignored: copiate dall'installazione corrente, senza archetipo-wiki se la prova è senza Wiki.
    for skills in (".claude/skills", ".agents/skills"):
        shutil.rmtree(repo / skills, ignore_errors=True)
        ignore = None if wiki else shutil.ignore_patterns("archetipo-wiki")
        shutil.copytree(REPO / skills, repo / skills, ignore=ignore)

    same_lock = (REPO / "package-lock.json").read_bytes() == (repo / "package-lock.json").read_bytes()
    if same_lock and (REPO / "node_modules").exists():
        sh(["cp", "-cR", str(REPO / "node_modules"), str(repo / "node_modules")])  # clone APFS, istantaneo
    else:
        sh(["npm", "ci", "--no-audit", "--no-fund"], cwd=repo)

    db = "cpb_" + re.sub(r"\W", "_", name.lower())
    for database in (db, f"{db}_e2e"):
        psql(f'DROP DATABASE IF EXISTS "{database}" WITH (FORCE)')
        psql(f'CREATE DATABASE "{database}"')
    (repo / ".env").write_text("\n".join([
        f'DATABASE_URL="{PG_URL.format(db)}"',
        f'E2E_DATABASE_URL="{PG_URL.format(db + "_e2e")}"',
        "E2E_TEST_MODE=false",
        f'AUTH_SECRET="{secrets.token_urlsafe(32)}"',
        f'SESSION_SECRET="{secrets.token_urlsafe(32)}"',
        'GOOGLE_CLIENT_ID="bench.apps.googleusercontent.com"',
        'GOOGLE_CLIENT_SECRET="bench"',
        f'GOOGLE_REDIRECT_URI="http://localhost:{APP_PORT}/api/auth/google/callback"',
        "AMMINISTRATORE_INIZIALE_EMAIL=",
        "",
    ]))
    sh(["npx", "prisma", "generate"], cwd=repo)
    if migrate:
        sh(["npx", "prisma", "migrate", "deploy"], cwd=repo)
        sh(["npx", "prisma", "db", "seed"], cwd=repo)
    return db


# ── esecuzione di Claude e telemetria ────────────────────────────────────────

def run_claude(phase_dir, turn, prompt, model, cwd, resume=None):
    cmd = [
        "claude", "-p", prompt,
        "--model", CFG["models"][model],
        "--effort", CFG["effort"],
        "--output-format", "stream-json", "--verbose",
        "--setting-sources", "project,local",
        "--permission-mode", "bypassPermissions",
        "--settings", json.dumps(AGENT_SETTINGS),
        "--max-budget-usd", str(CFG["budget_usd_per_phase"][model]),
    ]
    if resume:
        cmd += ["--resume", resume]
    stream = phase_dir / f"stream-{turn:02d}.jsonl"
    with open(stream, "w") as out, open(phase_dir / "stderr.txt", "a") as err:
        subprocess.run(cmd, cwd=cwd, stdout=out, stderr=err, text=True, check=False, env=agent_env())
    free_app_port()

    init, result = parse_stream(stream)
    if init is None or result is None:
        sys.exit(f"Fase {phase_dir.name}: stream senza init o result, vedi {stream}")
    foreign = [p["name"] for p in init.get("plugins", []) if p.get("path") != "builtin"]
    foreign += [s for s in init.get("skills", []) if CONTAMINAZIONI.search(s)]
    if foreign:
        sys.exit(f"Fase {phase_dir.name}: configurazione contaminata da {foreign}. Scartare la fase.")
    if result.get("is_error"):
        # Autenticazione, limite di sessione, errore API: la fase non va registrata come completata.
        sys.exit(f"Fase {phase_dir.name}: sessione Claude in errore, rilanciare lo stesso comando quando risolto: "
                 f"{str(result.get('result', ''))[:200]}")
    return result, init


def parse_stream(stream):
    """Primo init e result complessivo dello stream.

    Se un task in background termina dopo la fine del turno, il CLI riapre la sessione nello stesso
    processo e lo stream contiene più coppie init/result: costo, duration_api_ms e modelUsage sono
    cumulativi nell'ultimo result, mentre duration_ms e num_turns vanno sommati.
    """
    init, results = None, []
    righe = stream.read_text().splitlines()
    for indice, line in enumerate(righe):
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            if indice == len(righe) - 1:
                break  # status/costi possono leggere uno stream mentre il CLI ne scrive l'ultima riga
            raise
        if event.get("type") == "system" and event.get("subtype") == "init":
            init = init or event
        elif event.get("type") == "result":
            results.append(event)
    if not results:
        return init, None
    result = dict(results[-1])
    result["duration_ms"] = sum(r.get("duration_ms", 0) for r in results)
    result["num_turns"] = sum(r.get("num_turns", 0) for r in results)
    result["result_events"] = len(results)
    result["is_error"] = any(r.get("is_error") for r in results)
    return init, result


def tokens_of(usage):
    out = {
        "input_uncached": usage.get("input_tokens", usage.get("inputTokens", 0)) or 0,
        "cache_read": usage.get("cache_read_input_tokens", usage.get("cacheReadInputTokens", 0)) or 0,
        "cache_creation": usage.get("cache_creation_input_tokens", usage.get("cacheCreationInputTokens", 0)) or 0,
        "output": usage.get("output_tokens", usage.get("outputTokens", 0)) or 0,
    }
    out["total"] = sum(out.values())
    return out


def add_tokens(a, b):
    return {k: a.get(k, 0) + b.get(k, 0) for k in set(a) | set(b)}


def copy_transcripts(phase_dir, session_ids):
    target = phase_dir / "transcript"
    target.mkdir(exist_ok=True)
    for sid in session_ids:
        for path in list(CLAUDE_PROJECTS.glob(f"*/{sid}.jsonl")) + list(CLAUDE_PROJECTS.glob(f"*/{sid}/**/*.jsonl")):
            relative = path.name if path.name == f"{sid}.jsonl" else f"{sid}--{path.parent.name}--{path.name}"
            shutil.copy2(path, target / relative)


def is_wiki_tool(block):
    payload = block.get("input") or {}
    text = " ".join(str(payload.get(k, "")) for k in ("command", "file_path", "path", "pattern", "skill", "notebook_path"))
    return bool(WIKI_PATTERN.search(text))


def parse_time(stamp):
    return datetime.fromisoformat(stamp.replace("Z", "+00:00")) if stamp else None


def analyze_transcripts(transcript_dir):
    """Token totali dai transcript (cross-check) e attribuzione delle operazioni Wiki.

    Token Wiki = usage delle chiamate al modello i cui tool call sono tutti operazioni Wiki;
    le chiamate miste sono riportate a parte e non ripartite. È una stima per turni.
    """
    messages, tool_started, tool_finished, tool_bytes = {}, {}, {}, {}
    for path in sorted(transcript_dir.glob("*.jsonl")):
        for line in path.read_text().splitlines():
            if not line.strip():
                continue
            event = json.loads(line)
            message = event.get("message") or {}
            if event.get("type") == "assistant":
                key = message.get("id") or event.get("uuid")
                record = messages.setdefault(key, {"usage": {}, "tools": {}, "sidechain": event.get("isSidechain", False)})
                record["usage"] = message.get("usage") or record["usage"]
                for block in message.get("content") or []:
                    if block.get("type") == "tool_use":
                        record["tools"][block["id"]] = block
                        tool_started.setdefault(block["id"], parse_time(event.get("timestamp")))
            elif event.get("type") == "user" and isinstance(message.get("content"), list):
                for block in message["content"]:
                    if block.get("type") == "tool_result":
                        tool_finished.setdefault(block["tool_use_id"], parse_time(event.get("timestamp")))
                        tool_bytes[block["tool_use_id"]] = len(json.dumps(block.get("content"), ensure_ascii=False))

    total, wiki_only, mixed, subagents = {}, {}, {}, {}
    wiki_calls = {"count": 0, "seconds": 0.0, "result_bytes": 0, "by_tool": {}}
    for record in messages.values():
        tokens = tokens_of(record["usage"])
        total = add_tokens(total, tokens)
        if record["sidechain"]:
            subagents = add_tokens(subagents, tokens)
        tools = list(record["tools"].values())
        wiki = [t for t in tools if is_wiki_tool(t)]
        if wiki and len(wiki) == len(tools):
            wiki_only = add_tokens(wiki_only, tokens)
        elif wiki:
            mixed = add_tokens(mixed, tokens)
        for tool in wiki:
            wiki_calls["count"] += 1
            wiki_calls["by_tool"][tool["name"]] = wiki_calls["by_tool"].get(tool["name"], 0) + 1
            start, end = tool_started.get(tool["id"]), tool_finished.get(tool["id"])
            if start and end:
                wiki_calls["seconds"] += (end - start).total_seconds()
            wiki_calls["result_bytes"] += tool_bytes.get(tool["id"], 0)
    return {
        "model_calls": len(messages),
        "tokens_transcript": total,
        "tokens_subagents": subagents,
        "wiki": {"tokens_wiki_only_calls": wiki_only, "tokens_mixed_calls": mixed, **wiki_calls},
    }


def collect(phase_dir, results, init):
    tokens, model_usage = {}, {}
    # Con --resume costo e modelUsage del result sono cumulativi per sessione: vale l'ultimo di ognuna.
    last_per_session = {r["session_id"]: r for r in results}.values()
    for result in last_per_session:
        for model, usage in (result.get("modelUsage") or {}).items():
            model_usage[model] = add_tokens(model_usage.get(model, {}), tokens_of(usage))
            model_usage[model]["cost_usd"] = model_usage[model].get("cost_usd", 0) + (usage.get("costUSD") or 0)
            tokens = add_tokens(tokens, tokens_of(usage))
    copy_transcripts(phase_dir, {r["session_id"] for r in results})
    last = results[-1]
    (phase_dir / "result.txt").write_text(str(last.get("result", "")))
    return {
        "model_resolved": init.get("model"),
        "skills_available": [s for s in init.get("skills", []) if s.startswith("archetipo")],
        "duration_ms": sum(r.get("duration_ms", 0) for r in results),
        "duration_api_ms": sum(r.get("duration_api_ms", 0) for r in results),
        "num_turns": sum(r.get("num_turns", 0) for r in results),
        "cost_usd": sum(r.get("total_cost_usd", 0) or 0 for r in last_per_session),
        "tokens": tokens,
        "model_usage": model_usage,
        "result_subtypes": [r.get("subtype") for r in results],
        "is_error": any(r.get("is_error") for r in results),
        **analyze_transcripts(phase_dir / "transcript"),
    }


def phase_done(run_dir, phase_id):
    return (run_dir / "phases" / phase_id / "metrics.json").exists()


def phase(run_dir, phase_id, model, repo, prompt, skill, after=None):
    """Una fase = una sessione claude -p nuova e isolata, seguita da un commit del banco."""
    metrics_path = run_dir / "phases" / phase_id / "metrics.json"
    if metrics_path.exists():
        metrics = json.loads(metrics_path.read_text())
        if metrics.get("is_error") or metrics.get("invalida"):
            sys.exit(f"{metrics_path}: metriche invalide, scartare prima di riprendere")
        return metrics
    riserva_lancio(CFG["budget_usd_per_phase"][model])
    phase_dir = metrics_path.parent
    tentativo = phase_dir / "tentativo.json"
    if tentativo.exists():
        precedente = json.loads(tentativo.read_text())
        scarta_fase(run_dir, phase_dir, "tentativo interrotto, ripresa")
        git(repo, "reset", "-q", "--hard", precedente["head_before"])
    shutil.rmtree(phase_dir, ignore_errors=True)
    phase_dir.mkdir(parents=True)
    git(repo, "reset", "-q", "--hard")  # ripresa dopo un'interruzione: si riparte dall'ultimo commit
    git(repo, "clean", "-fdq")
    (phase_dir / "prompt.txt").write_text(prompt)
    head_before = git(repo, "rev-parse", "HEAD")
    pre = precondizioni(repo)
    if CFG.get("precondizioni_wiki_obbligatorie") and not all(
            pre[k] is True for k in ("docs_wiki_presente", "skill_archetipo_wiki", "wiki_enabled")):
        sys.exit(f"{run_dir.name}/{phase_id}: precondizioni Wiki non soddisfatte: {pre}")
    write_json(tentativo, {"head_before": head_before, "precondizioni": pre,
                           "avvio": datetime.now(ZoneInfo("Europe/Rome")).isoformat()})
    started = time.time()
    print(f"  ▶ {run_dir.name} / {phase_id}", flush=True)
    result, init = run_claude(phase_dir, 0, prompt, model, repo)
    metrics = collect(phase_dir, [result], init)
    testi = [str(result.get("result", ""))]
    for transcript in (phase_dir / "transcript").glob("*.jsonl"):
        for riga in transcript.read_text().splitlines():
            evento = json.loads(riga)
            if evento.get("type") == "assistant":
                testi.extend(blocco.get("text", "") for blocco in evento.get("message", {}).get("content", [])
                             if isinstance(blocco, dict) and blocco.get("type") == "text")
    invalida = [m.group(0) for m in WIKI_NON_DISPONIBILE.finditer("\n".join(testi))]
    if CFG.get("precondizioni_wiki_obbligatorie") and invalida:
        scarta_fase(run_dir, phase_dir, f"Wiki dichiarata non disponibile: {invalida[:5]}")
        git(repo, "reset", "-q", "--hard", head_before)
        sys.exit(f"{run_dir.name}/{phase_id}: fase invalida scartata; rilanciare")
    commit_if_dirty(repo, f"bench: {phase_id}")
    metrics.update(phase=phase_id, skill=skill, wall_seconds=round(time.time() - started, 1),
                   head_before=head_before, head=git(repo, "rev-parse", "HEAD"), precondizioni=pre)
    if after:
        metrics.update(after())
    write_json(metrics_path, metrics)
    print(f"    {metrics['duration_ms'] / 60000:.1f} min · {metrics['tokens'].get('total', 0) / 1e6:.2f} M token · {metrics['cost_usd']:.2f} USD", flush=True)
    return metrics


# ── committente simulato e chiarimento ───────────────────────────────────────

def ask_committente(dialog, log_dir):
    conversation = "\n\n".join(
        f"[{'TEAM DI SVILUPPO' if who == 'team' else 'TU, COMMITTENTE'}]\n{text}" for who, text in dialog
    )
    prompt = (f"Conversazione finora:\n\n{conversation}\n\n"
              "Rispondi all'ultimo messaggio del team di sviluppo come committente. Scrivi solo la risposta.")
    neutral = RUNS / "_committente"
    neutral.mkdir(parents=True, exist_ok=True)
    out = sh([
        "claude", "-p", prompt,
        "--model", CFG["committente"]["model"], "--effort", CFG["committente"]["effort"],
        "--system-prompt", PROFILO_COMMITTENTE,
        "--tools", "", "--setting-sources", "project", "--strict-mcp-config",
        "--no-session-persistence", "--output-format", "json",
    ], cwd=neutral, env=agent_env())
    result = json.loads(out.stdout)
    with open(log_dir / "committente.jsonl", "a") as log:
        log.write(json.dumps(result, ensure_ascii=False) + "\n")
    return result["result"].strip(), result.get("total_cost_usd", 0) or 0


def discovery_id(model, wiki, replica=None):
    return f"D-{model}-{'wiki' if wiki else 'nowiki'}" + (f"-r{replica}" if replica else "")


def discover(model, wiki, replica=None):
    """Chiarimento condiviso; `replica` > 1 ne esegue una copia indipendente (D-<modello>-<wiki>-r<N>)."""
    run_dir = RUNS / discovery_id(model, wiki, replica)
    summary_path = run_dir / "discovery.json"
    if summary_path.exists():
        return json.loads(summary_path.read_text())
    repo = run_dir / "repo"
    if not repo.exists():
        clone(prepare_baseline(), repo)
        if not wiki:
            remove_wiki(repo)
        setup_clone(repo, run_dir.name, wiki)
    print(f"▶ chiarimento {run_dir.name}", flush=True)
    phase_dir = run_dir / "phases" / "01-spec"
    shutil.rmtree(phase_dir, ignore_errors=True)
    phase_dir.mkdir(parents=True)
    git(repo, "reset", "-q", "--hard")
    git(repo, "clean", "-fdq")
    before = spec_codes(repo)

    dialog, results, session, init = [], [], None, None
    committente_seconds = committente_cost = 0.0
    prompt = f"/archetipo-spec {RICHIESTA}"
    new_codes = []
    for turn in range(CFG["max_discovery_turns"]):
        result, init = run_claude(phase_dir, turn, prompt, model, repo, resume=session)
        results.append(result)
        session = result["session_id"]
        dialog.append(("team", str(result.get("result", ""))))
        new_codes = sorted(spec_codes(repo) - before)
        if new_codes:
            break
        started = time.time()
        answer, cost = ask_committente(dialog, phase_dir)
        committente_seconds += time.time() - started
        committente_cost += cost
        dialog.append(("committente", answer))
        prompt = answer
    else:
        sys.exit(f"{run_dir.name}: nessuna storia scritta dopo {CFG['max_discovery_turns']} scambi")

    (phase_dir / "dialogo.md").write_text("\n\n".join(
        f"### {'Team' if who == 'team' else 'Committente'}\n\n{text}" for who, text in dialog))
    metrics = collect(phase_dir, results, init)
    commit_if_dirty(repo, "bench: chiarimento")
    metrics.update(phase="01-spec", skill="archetipo-spec", exchanges=len(dialog) // 2,
                   committente_seconds=round(committente_seconds, 1), committente_cost_usd=committente_cost)
    write_json(phase_dir / "metrics.json", metrics)
    summary = {"id": run_dir.name, "model": model, "wiki": wiki, "codes": new_codes,
               "head": git(repo, "rev-parse", "HEAD"), "metrics": metrics}
    write_json(summary_path, summary)
    print(f"  storie: {', '.join(new_codes)} · {len(dialog) // 2} scambi", flush=True)
    return summary


# ── percorsi ─────────────────────────────────────────────────────────────────

def run(run_id):
    spec = next((r for r in CFG["runs"] if r["id"] == run_id), None)
    if spec is None:
        sys.exit(f"Prova sconosciuta: {run_id}")
    if (RUNS / run_id / "run.json").exists():
        print(f"  ✓ {run_id} già completata", flush=True)
        return
    config = CFG["configs"][spec["config"]]
    model, wiki, pipeline = spec["model"], config["wiki"], config["pipeline"]
    # `storie_da_wiki` (opzionale) prende le storie dal chiarimento dell'altra variante: stesse storie, Wiki diversa.
    storie_da_wiki = spec.get("storie_da_wiki", wiki)
    discovery = discover(model, storie_da_wiki)
    run_dir = RUNS / run_id
    repo = run_dir / "repo"
    if not repo.exists():
        clone(RUNS / discovery["id"] / "repo", repo)
        if storie_da_wiki and not wiki:
            remove_wiki(repo)
        elif wiki and not storie_da_wiki:
            restore_wiki(repo)
        setup_clone(repo, run_id, wiki)
    print(f"▶ prova {run_id} · {config['label']} · Wiki {'sì' if wiki else 'no'}", flush=True)
    codes = discovery["codes"]
    max_iterations = CFG["max_review_iterations"]
    outcomes = {}

    def step(phase_id, prompt, skill, after=None):
        return phase(run_dir, phase_id, model, repo, prompt, skill, after)

    if pipeline in ("storie-diretto", "diretto"):
        step("01-diretto", PROMPT_DIRETTO.format(oggetto="le user story " + ", ".join(codes)), "diretto")
        if wiki and pipeline == "storie-diretto":
            step("02-wiki-refresh", PROMPT_WIKI_REFRESH.format(base=discovery["head"]), "archetipo-wiki")
    else:
        for code in codes:
            rework = 0
            while True:
                n = rework + 1
                if pipeline in ("completo", "piano"):
                    step(f"{code}-plan-{n}", f"/archetipo-plan {code}", "archetipo-plan")
                    implement = step(f"{code}-implement-{n}", f"/archetipo-implement {code}", "archetipo-implement")
                    if pipeline == "piano":  # piano e implementazione senza accettazione: la qualità la misura l'oracolo
                        outcomes[code] = {"status": spec_status(repo, code), "rework_cycles": 0, "head": implement["head"]}
                        break
                else:
                    direct_id = f"{code}-diretto-{n}"
                    if not phase_done(run_dir, direct_id):
                        move_spec(repo, code, "in_progress")
                    prompt = (PROMPT_DIRETTO.format(oggetto=f"la user story {code}") if rework == 0
                              else PROMPT_DIRETTO_FIX.format(code=code))
                    direct = step(direct_id, prompt, "diretto")
                    if not phase_done(run_dir, f"{code}-review-{n}"):
                        move_spec(repo, code, "review")
                    if wiki:
                        step(f"{code}-wiki-refresh-{n}", PROMPT_WIKI_REFRESH.format(base=direct["head_before"]),
                             "archetipo-wiki")
                review = step(
                    f"{code}-review-{n}",
                    PROMPT_REVIEW.format(workdir=repo, code=code, n=n, max=max_iterations,
                                         allowed="yes" if rework < max_iterations else "no"),
                    "archetipo-review",
                    after=lambda: {"spec_status_after": spec_status(repo, code)},
                )
                status = review["spec_status_after"]
                if status == "TODO" and rework < max_iterations:
                    rework += 1
                    continue
                outcomes[code] = {"status": status, "rework_cycles": rework}
                break

    discovery_head = discovery["head"]
    (run_dir / "diff.patch").write_text(git(repo, "diff", discovery_head, "HEAD"))
    phases = sorted((run_dir / "phases").glob("*/metrics.json"), key=lambda p: p.stat().st_mtime)
    write_json(run_dir / "run.json", {
        "id": run_id, "model": model, "config": spec["config"], "label": config["label"], "wiki": wiki,
        "discovery": discovery["id"], "codes": codes, "outcomes": outcomes,
        "discovery_head": discovery_head, "head": git(repo, "rev-parse", "HEAD"),
        "tree_hash": git(repo, "rev-parse", "HEAD^{tree}"),
        "diffstat": git(repo, "diff", "--shortstat", discovery_head, "HEAD"),
        "phases": [json.loads(p.read_text())["phase"] for p in phases],
    })
    print(f"  ✓ {run_id} completata", flush=True)


# ── comandi ──────────────────────────────────────────────────────────────────

def preflight():
    problems = []
    for tool in ("claude", "archetipo", "docker", "git", "lsof", "npx"):
        if not shutil.which(tool):
            problems.append(f"comando mancante: {tool}")
    if sh(["docker", "exec", PG_CONTAINER, "pg_isready", "-U", "user"], check=False).returncode:
        problems.append(f"Postgres non raggiungibile nel container {PG_CONTAINER} (docker compose up -d)")
    if sh(["lsof", "-ti", f"tcp:{APP_PORT}"], check=False).stdout.strip():
        problems.append(f"porta {APP_PORT} occupata: fermare il dev server prima delle prove")
    auth = sh(["claude", "auth", "status"], check=False, env=agent_env()).stdout
    if '"loggedIn": true' not in auth:
        problems.append("claude CLI non autenticato: eseguire `claude auth login` in un terminale")
    if sh(["git", "cat-file", "-e", CFG["baseline_sha"]], cwd=REPO, check=False).returncode:
        problems.append(f"baseline {CFG['baseline_sha']} non trovata")
    print("\n".join(problems) or f"ok · prove in {RUNS}")
    return not problems


def run_totals(run_dir):
    phases = [json.loads(p.read_text()) for p in run_dir.glob("phases/*/metrics.json")]
    tokens = {}
    for m in phases:
        tokens = add_tokens(tokens, m.get("tokens", {}))
    wiki_tokens = sum(m["wiki"]["tokens_wiki_only_calls"].get("total", 0) for m in phases)
    wiki_phases = [m for m in phases if m.get("skill") == "archetipo-wiki"]
    return {
        "minutes": sum(m["duration_ms"] for m in phases) / 60000,
        "tokens_m": tokens.get("total", 0) / 1e6,
        "usd": sum(m["cost_usd"] for m in phases),
        "wiki_calls": sum(m["wiki"]["count"] for m in phases),
        "wiki_tokens_m": wiki_tokens / 1e6,
        "wiki_phase_minutes": sum(m["duration_ms"] for m in wiki_phases) / 60000,
    }


def status():
    print(f"{'prova':<18}{'min':>7}{'token M':>9}{'USD':>8}{'wiki call':>11}{'wiki tok M':>12}{'fase wiki min':>15}")
    for directory in sorted(RUNS.glob("D-*")) + [RUNS / r["id"] for r in CFG["runs"]]:
        if not (directory / "phases").exists():
            continue
        t = run_totals(directory)
        print(f"{directory.name:<18}{t['minutes']:>7.1f}{t['tokens_m']:>9.2f}{t['usd']:>8.2f}"
              f"{t['wiki_calls']:>11}{t['wiki_tokens_m']:>12.2f}{t['wiki_phase_minutes']:>15.1f}")
    print("Le prove non includono il chiarimento (righe D-*): il report lo aggiunge una volta per percorso.")


def main(argv):
    if not argv:
        sys.exit(__doc__)
    command, args = argv[0], argv[1:]
    if command == "preflight":
        sys.exit(0 if preflight() else 1)
    if command == "status":
        return status()
    if command == "analyze":
        return print(json.dumps(analyze_transcripts(Path(args[0]) / "transcript"), indent=2))
    if not preflight():
        sys.exit(1)
    if command == "baseline":
        print(prepare_baseline())
    elif command == "discover":
        discover(args[0], args[1] == "wiki", int(args[2]) if len(args) > 2 else None)
    elif command == "run":
        run(args[0])
        dopo_consegna(args[0])
    elif command == "all":
        for model in CFG["models"]:
            for wiki in (True, False):
                discover(model, wiki)
        for extra in CFG.get("chiarimenti_extra", []):
            discover(extra["model"], extra["wiki"], extra["replica"])
        for r in CFG["runs"]:
            run(r["id"])
            dopo_consegna(r["id"])
        status()
    else:
        sys.exit(__doc__)


def dopo_consegna(run_id):
    comando = CFG.get("dopo_consegna")
    if comando:
        subprocess.run([*comando, run_id], cwd=REPO, check=True, env=agent_env())


if __name__ == "__main__":
    main(sys.argv[1:])
