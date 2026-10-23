#!/usr/bin/env python3
"""Una valutazione del protocollo ridotto, su copia immutabile e DB dedicati."""
import importlib.util
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse
from prepara import BENCH, RADICE, banco, leggi, scrivi, setup, ambiente_clone, baseline, costi
from esegui import verifica_conferma
from adatta import genera

ORACOLI=BENCH/'gradiente-difficolta/oracoli'


def comando(nome,cmd,repo,logs,env,timeout=1800):
    start=time.time()
    try:
        result=subprocess.run(cmd,cwd=repo,env=env,capture_output=True,text=True,timeout=timeout)
        codice=result.returncode;output=result.stdout+result.stderr
    except subprocess.TimeoutExpired as exc:
        codice=-1;output='TIMEOUT '+str(exc)
    (logs/f'{nome}.log').write_text(output)
    print(f'    {nome}: exit {codice}, {time.time()-start:.1f}s',flush=True)
    return codice


def tecnica(task,id_,directory):
    spec=importlib.util.spec_from_file_location('tecnica_comune',BENCH/'common/tecnica.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    module.RUNS=RADICE/'prove'/task
    cache=module.RUNS/'_baseline/tsc-baseline.json'
    if not cache.exists():
        repo=module.RUNS/'_baseline/repo'
        if not repo.exists():
            banco.clone(baseline(task),repo);setup(repo,'tsc_base_'+task.lower(),migrate=False)
        scrivi(cache,{'errori':module.errori_tsc(repo),'repo':str(repo),'sha':banco.git(repo,'rev-parse','HEAD')})
    module.errori_tsc_baseline=lambda:leggi(cache)['errori']
    oracle=directory/'repo/__oracolo__';saved=directory/'oracolo-fuori-tipo'
    if oracle.exists():shutil.move(str(oracle),saved)
    try:
        data=module.misura(id_,con_mutanti=False)
    finally:
        if saved.exists():shutil.move(str(saved),oracle)
    data.pop('punteggio',None)
    data.update(protocollo='ridotto-8',punteggio_tecnico=None,nota_tecnica='Sole metriche automatiche; nessun punteggio tecnico comune /100, mutation testing o giudice tecnico.')
    scrivi(directory.parent/'tecnica.json',data)
    return data


def valuta(id_):
    matrix=verifica_conferma()
    cell=next(r for r in matrix['runs'] if r['id']==id_);task=cell['task']
    source=RADICE/'prove'/task/id_;info=leggi(source/'run.json')
    folder=source/'valutazione';repo=folder/'repo';receipt=folder/'evaluation.json'
    pending=folder/'invalidazione-browser.json'
    if pending.exists() and leggi(pending).get('stato')!='corretta':
        raise SystemExit('Lettura browser invalidata: completare la correzione documentata prima di riusare la ricevuta')
    if receipt.exists():
        data=leggi(receipt)
        if data['tree_hash']!=info['tree_hash']:raise SystemExit('Valutazione salvata su albero diverso')
        if not (source/'tecnica.json').exists():tecnica(task,id_,folder)
        return data
    if (folder/'avvio.json').exists():raise SystemExit('Valutazione precedente incompleta: diagnosticare senza sovrascrivere i log')
    folder.mkdir(parents=True,exist_ok=True)
    scrivi(folder/'avvio.json',{'inizio':time.time(),'tree_hash':info['tree_hash']})
    if banco.git(source/'repo','rev-parse','HEAD^{tree}')!=info['tree_hash']:raise SystemExit('Consegna cambiata prima della valutazione')
    adapter=genera(task,source/'repo',RADICE/'adattatori'/id_)
    banco.clone(source/'repo',repo)
    setup(repo,'val_'+id_,migrate=False)
    if banco.git(repo,'rev-parse','HEAD^{tree}')!=info['tree_hash']:raise SystemExit('Copia diversa dalla consegna')
    env={**ambiente_clone(repo),'NODE_ENV':'test','E2E_TEST_MODE':'true','TZ':'UTC'}
    before=time.time()
    comando('gate-ci',['python3',str(ORACOLI/'shared/gate_ci.py'),'--consegna',str(repo),'--base',info['baseline_tecnica'],'--database-url',env['DATABASE_URL'],'--e2e-database-url',env['E2E_DATABASE_URL'],'--uscita',str(folder)],repo,folder,env,timeout=5400)
    ci=leggi(folder/'gate-ci.json')
    comando('installa',['python3',str(ORACOLI/'shared/installa_oracolo.py'),'--compito',task,'--consegna',str(repo),'--adattatore',str(adapter)],repo,folder,env)
    database=urlparse(env['DATABASE_URL']).path.lstrip('/')+'_migrazione'
    banco.psql(f'CREATE DATABASE "{database}"')
    migrazione=comando('gate-migrazione',['python3',str(ORACOLI/'shared/gate_migrazione.py'),'--compito',task,'--consegna',str(repo),'--base',info['baseline_tecnica'],'--database-url',banco.PG_URL.format(database),'--uscita',str(folder/'migrazione')],repo,folder,env)
    if migrazione:raise SystemExit('Gate migrazione non valido: preservare e diagnosticare')
    env['E2E_DATABASE_URL']=env['DATABASE_URL']
    comando('integrazione',['npx','vitest','run','--config','__oracolo__/vitest.config.ts','--reporter=json',f'--outputFile={folder}/vitest-oracolo.json'],repo,folder,env)
    env['ORACOLO_PLAYWRIGHT_JSON']=str(folder/'playwright-oracolo.json')
    comando('browser',['npx','playwright','test','--config','__oracolo__/playwright.config.ts'],repo,folder,env)
    banco.free_app_port()
    comando('punteggio',['python3',str(ORACOLI/'shared/punteggio.py'),'--compito',task,'--gate-ci',str(folder/'gate-ci.json'),'--gate-migrazione',str(folder/'migrazione/gate-migrazione.json'),'--vitest',str(folder/'vitest-oracolo.json'),'--playwright',str(folder/'playwright-oracolo.json'),'--uscita',str(folder/'punteggio-grezzo.json')],repo,folder,env)
    score=leggi(folder/'punteggio-grezzo.json')
    if not score['valida']:raise SystemExit('Oracolo incompleto o aree incoerenti: nessuna valutazione valida registrata')
    if banco.git(repo,'diff','--name-only','HEAD','--','src','tests','prisma'):raise SystemExit('La valutazione ha modificato codice tracciato')
    mig=leggi(folder/'migrazione/gate-migrazione.json')
    data={**score,'prova':id_,'protocollo':'ridotto-8','head':info['head'],'tree_hash':info['tree_hash'],'letture':1,'gate':{**ci['passi'],'P1':mig['P1'],'P2':mig['P2'],'migrazione_applicabile':True},'secondi_valutazione':time.time()-before,'secondi_valutazione_totali':time.time()-leggi(folder/'avvio.json')['inizio'],'fine':time.time(),'intervallo':None}
    scrivi(receipt,data)
    tecnica(task,id_,folder)
    costi();print(f"  {id_}: {data['totale']}/100",flush=True)
    return data


if __name__=='__main__':valuta(sys.argv[1])
