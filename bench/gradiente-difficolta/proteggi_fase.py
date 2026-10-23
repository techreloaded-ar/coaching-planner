"""Isolamento delle fasi sperimentali: scarto esplicito e ripristino di codice e Postgres."""
from contextlib import contextmanager
from datetime import datetime
import json
from pathlib import Path
import re
import shutil
import subprocess
import time
from urllib.parse import urlparse
from zoneinfo import ZoneInfo
from prepara import BENCH, RADICE, banco, ambiente_clone, leggi, scrivi


def database_clone(repo):
    ambiente=ambiente_clone(repo)
    nomi=[]
    for chiave in ('DATABASE_URL','E2E_DATABASE_URL'):
        nome=urlparse(ambiente[chiave]).path.lstrip('/')
        if not re.fullmatch(r'cpb_grad_[a-z0-9_]+',nome):
            raise SystemExit('Database fuori dal namespace dedicato: nessuna operazione eseguita')
        nomi.append(nome)
    if len(set(nomi))!=2:raise SystemExit('Database applicativo ed e2e devono essere distinti')
    return nomi


def snapshot(repo,phase_dir):
    copie={}
    for nome in database_clone(repo):
        file=phase_dir/(nome+'.dump')
        with file.open('wb') as out:
            subprocess.run(['docker','exec',banco.PG_CONTAINER,'pg_dump','-U','user','-Fc',nome],stdout=out,stderr=subprocess.PIPE,check=True)
        copie[nome]=file.name
    scrivi(phase_dir/'snapshot-database.json',copie)
    return copie


def scarta(repo,phase_dir,motivo,copie):
    tentativo=leggi(phase_dir/'tentativo.json')
    head_before=tentativo['head_before']
    # Conserva il lavoro invalido prima del reset, senza modificare una consegna valutata.
    banco.commit_if_dirty(repo,'bench: archivio tentativo invalido')
    invalido=banco.git(repo,'rev-parse','HEAD')
    (phase_dir/'tentativo-invalido.patch').write_text(banco.git(repo,'diff','--binary',head_before,invalido))
    destination=RADICE/'_scartati'/f'{phase_dir.parents[1].name}--{phase_dir.name}--{time.time_ns()}'
    (destination/'phases').mkdir(parents=True)
    saved=destination/'phases'/phase_dir.name
    shutil.move(str(phase_dir),saved)
    scrivi(destination/'scarto.json',{'motivo':motivo,'head_before':head_before,'head_invalido':invalido,'ripristino':'in corso'})
    banco.git(repo,'reset','--hard',head_before)
    banco.git(repo,'clean','-fdq')
    for nome,file in copie.items():
        banco.psql(f'DROP DATABASE "{nome}" WITH (FORCE)')
        banco.psql(f'CREATE DATABASE "{nome}"')
        with (saved/file).open('rb') as stdin:
            subprocess.run(['docker','exec','-i',banco.PG_CONTAINER,'pg_restore','-U','user','-d',nome],stdin=stdin,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True)
    # Anche dipendenze e client Prisma generato possono essere stati cambiati dal tentativo.
    with (saved/'ripristino-dipendenze.log').open('w') as out:
        subprocess.run(['npm','ci','--no-audit','--no-fund'],cwd=repo,env=ambiente_clone(repo),stdout=out,stderr=subprocess.STDOUT,check=True)
    scrivi(destination/'scarto.json',{'motivo':motivo,'head_before':head_before,'head_invalido':invalido,'ripristino':'codice e database ripristinati'})
    now=datetime.now(ZoneInfo('Europe/Rome')).isoformat()
    with (BENCH/'wiki-benchmark/CORREZIONI.md').open('a') as registro:
        registro.write(f'\n\n## {now} · Report 3 · fase scartata\n\n{motivo}. Artefatti, patch e costo conservati in `{destination}`. Ripristinati codice e database dal punto precedente alla fase; nessun retry automatico.\n')
    raise SystemExit(motivo+'; fase scartata, codice e database ripristinati')


def violazioni_diretto(phase_dir):
    trovate=[]
    for file in phase_dir.glob('stream-*.jsonl'):
        for line in file.read_text().splitlines():
            evento=json.loads(line)
            if evento.get('type')!='assistant':continue
            for blocco in evento.get('message',{}).get('content',[]):
                if blocco.get('type')=='tool_use' and blocco.get('name')=='Skill':
                    nome=blocco.get('input',{}).get('skill','')
                    if nome.startswith('archetipo'):trovate.append(nome)
    return trovate


@contextmanager
def proteggi_fase(repo,diretto=False,codes=()):
    originale=banco.run_claude
    attiva={}
    def esegui(phase_dir,turn,prompt,model,cwd,resume=None):
        if resume:raise SystemExit('Una fase sperimentale deve iniziare con una sessione nuova')
        copie=snapshot(repo,phase_dir)
        attiva.update(phase_dir=phase_dir,copie=copie)
        stati={code:banco.spec_status(repo,code) for code in codes} if diretto else {}
        try:
            result,init=originale(phase_dir,turn,prompt,model,cwd,resume=None)
        except SystemExit as errore:
            scarta(repo,phase_dir,str(errore),copie)
        foreign=[p for p in init.get('plugins',[]) if p.get('path')!='builtin']
        from audit_preparazione import BUILTIN
        foreign += [s for s in init.get('skills',[]) if not s.startswith('archetipo') and s not in BUILTIN]
        if foreign:scarta(repo,phase_dir,'Contaminazione init: '+str(foreign),copie)
        if result.get('is_error') or result.get('subtype')!='success':scarta(repo,phase_dir,'Result in errore o non success',copie)
        testi=[]
        for file in phase_dir.glob('stream-*.jsonl'):
            for line in file.read_text().splitlines():
                evento=json.loads(line)
                if evento.get('type')=='assistant':
                    testi.extend(b.get('text','') for b in evento.get('message',{}).get('content',[]) if b.get('type')=='text')
        if banco.WIKI_NON_DISPONIBILE.search('\n'.join(testi)):
            scarta(repo,phase_dir,'Wiki dichiarata non disponibile nonostante precondizioni valide',copie)
        if diretto:
            skill=violazioni_diretto(phase_dir)
            modificati=[code for code in codes if banco.spec_status(repo,code)!=stati[code]]
            if skill or modificati:scarta(repo,phase_dir,f'Violazione cella diretto: skill {skill}, stati modificati {modificati}',copie)
        return result,init
    banco.run_claude=esegui
    try:
        yield
    except SystemExit as errore:
        phase_dir=attiva.get('phase_dir')
        if phase_dir and phase_dir.exists() and not (phase_dir/'metrics.json').exists():
            scarta(repo,phase_dir,str(errore),attiva['copie'])
        raise
    finally:
        banco.run_claude=originale
