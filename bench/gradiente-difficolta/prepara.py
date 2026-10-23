#!/usr/bin/env python3
"""Preparazione isolata report 3; nessun lancio delle 40 prove da questo comando."""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

BENCH = Path(__file__).resolve().parents[1]
REPO = BENCH.parent
RADICE = Path(os.environ.get('BENCH_RUNS', REPO.parent / 'coaching-planner-bench-runs')) / 'gradiente-difficolta'
MATRICE = BENCH / 'wiki-benchmark/matrice-gradiente.json'
sys.path.insert(0, str(BENCH / 'wiki-benchmark'))
import run as banco
BASE_AGENT_ENV = banco.agent_env

# Una dichiarazione deve riferire l'indisponibilità alla Wiki, non a un'altra
# risorsa nella stessa frase (per esempio «Wiki ... worktree disabilitato»).
# Limitato al report 3: i protocolli e i risultati storici restano immutati.
banco.WIKI_NON_DISPONIBILE = re.compile(
    r"\bwiki\b\s*(?:[`*:]\s*)*(?:(?:è|risulta|non è|is)\s+)?"
    r"(?:(?:stata|attualmente|ancora)\s+)*(?:non\s+(?:abilitat|attiv|disponibil)|disabilitat|disabled|not\s+enabled)"
    r"|\bnon\s+abilitat\w*\s+(?:la\s+)?wiki\b"
    r"|wiki\.enabled\s*[`*:= ]+false"
    r"|\bE_PRECONDITION\b[^\n.]{0,80}\bwiki\b"
    r"|\bwiki\b[^\n.]{0,80}\bE_PRECONDITION\b", re.I)


def leggi(path):
    return json.loads(path.read_text())


def scrivi(path, data, indent=2):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporaneo=path.with_name(path.name+f'.tmp-{os.getpid()}')
    temporaneo.write_text(json.dumps(data, ensure_ascii=False, indent=indent) + '\n')
    temporaneo.replace(path)


def protocollo_attivo():
    ridotta=BENCH/'wiki-benchmark/matrice-gradiente-ridotta.json'
    return leggi(ridotta) if ridotta.exists() else {'budget_usd':750,'budget_preparazione_usd':120}


def costi():
    sessioni = {}
    non_attestati = {}
    files = []
    for directory, cartelle, nomi in os.walk(RADICE):
        cartelle[:] = sorted(nome for nome in cartelle if nome not in ('repo','node_modules','.git','transcript','__pycache__'))
        files.extend(Path(directory)/nome for nome in sorted(nomi))
    def registra(key, costo, file):
        if key not in sessioni or costo >= sessioni[key]['usd']:
            sessioni[key] = {'usd': costo, 'file': str(file)}
    for stream in (p for p in files if p.name.startswith(('stream-','committente-stream-')) and p.suffix == '.jsonl'):
        init, result = banco.parse_stream(stream)
        if init and not result:
            non_attestati[init['session_id']] = str(stream)
        if result:
            registra(result.get('session_id', str(stream)), result.get('total_cost_usd', 0) or 0, stream)
    for file in (p for p in files if p.name == 'committente.jsonl'):
        for indice, line in enumerate(file.read_text().splitlines()):
            result = json.loads(line)
            if isinstance(result, dict):
                registra(result.get('session_id', str(file)+':'+str(indice)), result.get('total_cost_usd',0) or 0, file)
    # Il giudice tecnico condiviso salva JSON, non stream: non perderne i costi.
    for file in (p for p in files if p.parent.name == 'tecnica' and p.name.startswith('giudice-') and p.suffix == '.json'):
        result = leggi(file)
        if result.get('cost_usd') is not None:
            registra('giudice-tecnico:'+str(file), result['cost_usd'], file)
        else:
            non_attestati['giudice-tecnico:'+str(file)] = str(file)
    # Compatibilità con gli adattatori del valutatore precedente, se riusati.
    for file in (p for p in files if p.name.startswith('adattatore') and p.suffix == '.log'):
        try:
            result = leggi(file)
        except json.JSONDecodeError:
            continue
        if isinstance(result, dict) and 'total_cost_usd' in result:
            registra(result.get('session_id',str(file)),result['total_cost_usd'] or 0,file)
    totale = sum(s['usd'] for s in sessioni.values())
    def e_preparazione(voce):
        path = Path(voce['file'])
        return any(parte in path.parts for parte in ('riferimenti','preparazione','adattatori','G-ref-T3-init-builtin')) or path.name.startswith('adattatore')
    preparazione = sum(s['usd'] for s in sessioni.values() if e_preparazione(s))
    non_attestati = {key:value for key,value in non_attestati.items() if key not in sessioni}
    protocollo=protocollo_attivo()
    data = {'sessioni_costo_non_attestato':non_attestati,'totale_usd':totale,'preparazione_usd':preparazione,'residuo_preparazione_usd':protocollo.get('budget_preparazione_usd',120)-preparazione,'residuo_report_usd':protocollo['budget_usd']-totale,'budget_usd':protocollo['budget_usd'],'sessioni':sessioni}
    scrivi(BENCH/'gradiente-difficolta/costi.json',data)
    manifest = leggi(BENCH/'manifest.json')
    manifest['aggiornato'] = datetime.now(ZoneInfo('Europe/Rome')).date().isoformat()
    next(r for r in manifest['report'] if r['numero']==3)['costo_usd'] = totale
    scrivi(BENCH/'manifest.json',manifest,indent=1)
    return data


def hash_cartella(cartella):
    digest=hashlib.sha256()
    for file in sorted(cartella.rglob('*')):
        if file.is_file():
            digest.update(str(file.relative_to(cartella)).encode())
            digest.update(file.read_bytes())
    return digest.hexdigest()


def congela_skills():
    snapshot=RADICE/'_skills'
    for directory in ('.claude/skills','.agents/skills'):
        target=snapshot/directory
        if not target.exists():
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copytree(REPO/directory,target)
    hashes={directory:hash_cartella(snapshot/directory) for directory in ('.claude/skills','.agents/skills')}
    precedente=RADICE/'riferimenti/T3/phases/01-riferimento/tentativo.json'
    if precedente.exists() and leggi(precedente)['precondizioni']['hash_skills']!=hashes:
        raise SystemExit('Skill correnti diverse dal primo riferimento: risolvere prima di congelare il protocollo')
    matrix=leggi(MATRICE)
    if matrix.get('hash_skills_base') and matrix['hash_skills_base']!=hashes:
        raise SystemExit('Snapshot skill modificato: nessuna fase avviata')
    matrix['hash_skills_base']=hashes
    scrivi(MATRICE,matrix)
    return snapshot


def setup(repo, nome, migrate=True):
    """Usa solo .env.local sintetico; non legge né scrive .env."""
    banco.enable_wiki(repo)
    snapshot=congela_skills()
    for skills in ('.claude/skills', '.agents/skills'):
        shutil.rmtree(repo / skills, ignore_errors=True)
        shutil.copytree(snapshot / skills, repo / skills)
    database = 'cpb_grad_' + nome.lower().replace('-', '_')
    if not (repo / 'node_modules').exists():
        stesso_lock=(REPO/'package-lock.json').read_bytes()==(repo/'package-lock.json').read_bytes()
        if stesso_lock:
            banco.sh(['cp', '-cR', str(REPO / 'node_modules'), str(repo / 'node_modules')])
        else:
            banco.sh(['npm','ci','--no-audit','--no-fund'],cwd=repo,env={**BASE_AGENT_ENV(),'DATABASE_URL':banco.PG_URL.format(database),'TZ':'UTC'})
    for db in (database, database + '_e2e'):
        banco.psql(f'CREATE DATABASE "{db}"') if not banco.sh(['docker','exec',banco.PG_CONTAINER,'psql','-U','user','-d','postgres','-tAc',f"SELECT 1 FROM pg_database WHERE datname='{db}'"]).stdout.strip() else None
    env = {'DATABASE_URL': banco.PG_URL.format(database), 'E2E_DATABASE_URL': banco.PG_URL.format(database+'_e2e'), 'E2E_TEST_MODE':'false', 'AUTH_SECRET':'gradiente-bench-auth-secret-dedicato-2026', 'SESSION_SECRET':'gradiente-bench-session-secret-dedicato-2026', 'GOOGLE_CLIENT_ID':'bench', 'GOOGLE_CLIENT_SECRET':'bench', 'GOOGLE_REDIRECT_URI':'http://localhost:3000/api/auth/google/callback', 'AMMINISTRATORE_INIZIALE_EMAIL':'','TZ':'UTC'}
    (repo / '.env.local').write_text('\n'.join(f'{key}={json.dumps(value)}' for key,value in env.items())+'\n')
    comandi=[['npx','prisma','generate']]
    if migrate:comandi += [['npx','prisma','migrate','deploy'],['npx','prisma','db','seed']]
    for cmd in comandi:
        result=banco.sh(cmd, cwd=repo, check=False, env={**banco.agent_env(), **env})
        if result.returncode:
            raise SystemExit(result.stderr[-2500:])
    return env


def baseline(task):
    repo = RADICE / 'baseline' / task / 'repo'
    if (repo / '.git').exists():
        return repo
    repo.mkdir(parents=True)
    archive = subprocess.check_output(['git','archive',leggi(MATRICE)['baseline_sha']], cwd=REPO)
    subprocess.run(['tar','-x','-C',str(repo)],input=archive,check=True)
    for leak in ('bench','docs/benchmark'):
        shutil.rmtree(repo / leak, ignore_errors=True)
    for file in (repo/'docs').glob('PROMPT*'):
        file.unlink()
    configuration=repo/'.archetipo/config.yaml'
    configuration.write_text(configuration.read_text().replace('worktree:\n    enabled: true','worktree:\n    enabled: false'))
    banco.git(repo,'init','-q','-b','main')
    banco.git(repo,'config','user.name','bench')
    banco.git(repo,'config','user.email','bench@localhost')
    banco.commit_if_dirty(repo, 'baseline main ' + leggi(MATRICE)['baseline_sha'])
    banco.enable_wiki(repo)
    return repo


def ambiente_clone(repo):
    # File creato esclusivamente da setup(), con valori sintetici. Non accede a .env.
    ambiente=BASE_AGENT_ENV()
    configurazione=repo/'.env.local'
    if configurazione.exists():
        for linea in configurazione.read_text().splitlines():
            chiave,separatore,valore=linea.partition('=')
            if separatore:
                ambiente[chiave]=json.loads(valore)
    ambiente['TZ']='UTC'
    return ambiente


def sessione(cartella, repo, prompt, massimo=60):
    metriche = cartella / 'metrics.json'
    if metriche.exists():
        data=leggi(metriche)
        if data.get('is_error') or data.get('invalida'):
            raise SystemExit('Metriche invalide: '+str(metriche))
        return data
    if list(cartella.glob('stream-*.jsonl')):
        raise SystemExit('Tentativo precedente presente: verificare/scartare esplicitamente prima della ripresa: '+str(cartella))
    ledger=costi()
    costo=ledger['preparazione_usd']
    if ledger['totale_usd'] + massimo > protocollo_attivo()['budget_usd']:
        raise SystemExit('STOP: riserva della sessione oltre il tetto report autorizzato')
    if costo + massimo > 120:
        raise SystemExit(f'STOP: {costo:.2f} USD spesi; riserva {massimo} supera 120 USD di preparazione')
    cartella.mkdir(parents=True,exist_ok=True)
    pre=banco.precondizioni(repo)
    if not all(pre[k] is True for k in ('docs_wiki_presente','skill_archetipo_wiki','wiki_enabled')):
        raise SystemExit(f'Precondizioni non soddisfatte: {pre}')
    (cartella/'prompt.txt').write_text(prompt)
    deny={"permissions":{"deny":[f'Read(/{REPO}/**)',f'Edit(/{REPO}/**)', 'Read(./.env)', 'Edit(./.env)']}}
    deny['permissions']['deny']=[x.strip() for x in deny['permissions']['deny']]
    cmd=['claude','-p',prompt,'--model','opus','--effort','medium','--output-format','stream-json','--verbose','--setting-sources','project,local','--permission-mode','bypassPermissions','--settings',json.dumps(deny),'--max-budget-usd',str(massimo)]
    scrivi(cartella/'tentativo.json',{'precondizioni':pre,'head_before':banco.git(repo,'rev-parse','HEAD'),'max_budget_usd':massimo,'avvio':time.time()})
    print('Avvio Opus: '+str(cartella),flush=True)
    with (cartella/'stream-00.jsonl').open('w') as out, (cartella/'stderr.txt').open('w') as err:
        process=subprocess.Popen(cmd,cwd=repo,env=ambiente_clone(repo),stdin=subprocess.DEVNULL,stdout=out,stderr=err)
        while process.poll() is None:
            time.sleep(1)
            # Controlla l'evento init mentre il worker è ancora in corso.
            init,_=banco.parse_stream(cartella/'stream-00.jsonl')
            if init:
                foreign=[p for p in init.get('plugins',[]) if p.get('path')!='builtin']
                builtin = {'deep-research','design','design-sync','dataviz','update-config','verify','debug','code-review','simplify','batch','fewer-permission-prompts','doctor','loop','schedule','claude-api','workflow-authoring','run','run-skill-generator','plugin-authoring'}
                foreign += [s for s in init.get('skills',[]) if not s.startswith('archetipo') and s not in builtin]
                if foreign:
                    process.terminate();process.wait()
                    scrivi(cartella/'scarto.json',{'motivo':'skill/plugin estranei','elementi':foreign})
                    costi();raise SystemExit('Sessione contaminata, scartata')
    banco.free_app_port()
    init,result=banco.parse_stream(cartella/'stream-00.jsonl')
    costi()
    if result is None or init is None or result.get('is_error') or result.get('subtype')!='success':
        raise SystemExit('STOP result in errore o incompleto: '+str(result and result.get('result',result.get('subtype'))))
    data=banco.collect(cartella,[result],init)
    banco.verifica_prompt_sessione(cartella,prompt,result['session_id'])
    testi_assistente = []
    for line in (cartella/'stream-00.jsonl').read_text().splitlines():
        evento = json.loads(line)
        if evento.get('type') == 'assistant':
            testi_assistente.extend(blocco.get('text','') for blocco in evento.get('message',{}).get('content',[]) if blocco.get('type') == 'text')
    if banco.WIKI_NON_DISPONIBILE.search('\n'.join(testi_assistente)):
        scrivi(cartella/'scarto.json',{'motivo':'precondizione dichiarata non disponibile'})
        raise SystemExit('Fase invalida: vedere scarto.json')
    banco.commit_if_dirty(repo,'bench: soluzione di riferimento')
    data.update(precondizioni=pre,head=banco.git(repo,'rev-parse','HEAD'))
    scrivi(metriche,data)
    costi()
    print(f"Concluso: {data['cost_usd']:.2f} USD",flush=True)
    return data


def riferimento(task):
    source=baseline(task)
    cartella=RADICE/'riferimenti'/task
    repo=cartella/'repo'
    if not repo.exists():
        banco.clone(source,repo)
    if not (repo/'node_modules').exists():
        if banco.sh(['git','remote'],cwd=repo).stdout.strip():
            banco.git(repo,'remote','remove','origin')
        banco.git(repo,'config','user.name','bench')
        banco.git(repo,'config','user.email','bench@localhost')
        setup(repo,'ref_'+task)
    profile=(BENCH/f'gradiente-difficolta/profili/{task}.md').read_text()
    prompt=f'''Scrivi una soluzione di riferimento completa per questo requisito di Coaching Planner, nel solo clone corrente. Non è una prova sperimentale. Implementa modello, migrazioni/backfill, DAL, dominio, form e report, autorizzazioni e test di regressione necessari. Copri integralmente il profilo seguente, senza domande. Non usare skill ARchetipo, non cambiare backlog. Leggi AGENTS.md e le guide rilevanti in node_modules/next/dist/docs prima di scrivere codice. Segui tests/e2e/README.md per i test.

{profile}

Vincoli: non accedere MAI al repository originale {REPO}, né agli altri cloni, né al banco; non leggere né modificare .env. Sono disponibili node_modules e .env.local con valori sintetici e Postgres dedicato. Non modificare .env.local. Alla fine esegui lint, unit test e build e riporta gli esiti. Non avviare server persistenti. Scrivi un riepilogo finale con funzioni esistenti cambiate, migrazioni e test modificati. Non fare commit, li registra il banco.'''
    sessione(cartella/'phases/01-riferimento',repo,prompt)
    diff=banco.sh(['git','diff','--binary',banco.git(source,'rev-parse','HEAD'),'HEAD'],cwd=repo).stdout
    (BENCH/f'gradiente-difficolta/riferimento-{task}.patch').write_text(diff)
    scrivi(BENCH/f'gradiente-difficolta/riferimento-{task}.json',{'repo':str(repo),'baseline':banco.git(source,'rev-parse','HEAD'),'head':banco.git(repo,'rev-parse','HEAD'),'tree':banco.git(repo,'rev-parse','HEAD^{tree}')})


if __name__=='__main__':
    azione=sys.argv[1] if len(sys.argv)>1 else 'status'
    if azione=='riferimento': riferimento(sys.argv[2])
    elif azione=='baseline': print(baseline(sys.argv[2]))
    else: print(json.dumps(costi(),ensure_ascii=False,indent=2))
