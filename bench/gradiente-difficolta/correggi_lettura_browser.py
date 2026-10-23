#!/usr/bin/env python3
"""Sostituisce una lettura browser invalida dopo diagnosi, senza chiamate ai modelli.

Usare a driver fermo. Riusa integrazione/gate validi e il codice immutabile; una
lettura corretta su DB fresco, senza scegliere fra punteggi. Conserva il tentativo.
"""
import fcntl
import shutil
import sys
import time
from pathlib import Path
from prepara import BENCH, RADICE, banco, leggi, scrivi, ambiente_clone
from esegui import verifica_conferma
from valuta_ridotto import ORACOLI, comando


def correggi(id_):
    matrix=verifica_conferma()
    lock=(RADICE/'esecuzione-ridotta.lock').open('a')
    try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:raise SystemExit('Driver ancora attivo: nessun browser avviato')
    cell=next(c for c in matrix['runs'] if c['id']==id_)
    source=RADICE/'prove'/cell['task']/id_;folder=source/'valutazione';repo=folder/'repo'
    pending=folder/'invalidazione-browser.json';correction=leggi(pending)
    if correction['stato']=='corretta':return leggi(folder/'evaluation.json')
    info=leggi(source/'run.json');originale=leggi(folder/'evaluation.json')
    if banco.git(repo,'rev-parse','HEAD^{tree}')!=info['tree_hash']:raise SystemExit('Codice valutato cambiato')
    dest=folder/'browser-corretto'
    if dest.exists():raise SystemExit('Tentativo di correzione già avviato: diagnosticare, nessun retry automatico')
    dest.mkdir();start=time.time();scrivi(dest/'avvio.json',{'inizio':start,'tree_hash':info['tree_hash'],'motivo':correction})
    archived=folder/'browser-invalido';archived.mkdir()
    for name in ['evaluation.json','punteggio-grezzo.json','playwright-oracolo.json','browser.log']:
        shutil.copy2(folder/name,archived/name)
    if (repo/'test-results').exists():shutil.move(str(repo/'test-results'),archived/'test-results')
    shutil.copytree(RADICE/'adattatori'/id_/'adattatore',repo/'__oracolo__/adattatore',dirs_exist_ok=True)
    database='cpb_grad_browser_corretto_'+id_.lower().replace('-','_')
    env={**ambiente_clone(repo),'DATABASE_URL':banco.PG_URL.format(database),'E2E_DATABASE_URL':banco.PG_URL.format(database),'NODE_ENV':'test','E2E_TEST_MODE':'true','TZ':'UTC','ORACOLO_PLAYWRIGHT_JSON':str(dest/'playwright-oracolo.json')}
    if comando('typecheck',['npx','tsc','-p','__oracolo__/shared/tsconfig.oracolo.json'],repo,dest,env):raise SystemExit('Typecheck adattatore corretto fallito')
    banco.psql(f'CREATE DATABASE "{database}"')
    for name,cmd in [('migrate',['npx','prisma','migrate','deploy']),('seed',['npx','prisma','db','seed'])]:
        if comando(name,cmd,repo,dest,env):raise SystemExit('Setup browser corretto fallito: '+name)
    comando('browser',['npx','playwright','test','--config','__oracolo__/playwright.config.ts'],repo,dest,env)
    banco.free_app_port()
    comando('punteggio',['python3',str(ORACOLI/'shared/punteggio.py'),'--compito',cell['task'],'--gate-ci',str(folder/'gate-ci.json'),'--gate-migrazione',str(folder/'migrazione/gate-migrazione.json'),'--vitest',str(folder/'vitest-oracolo.json'),'--playwright',str(dest/'playwright-oracolo.json'),'--uscita',str(dest/'punteggio-grezzo.json')],repo,dest,env)
    score=leggi(dest/'punteggio-grezzo.json')
    if not score['valida']:raise SystemExit('Lettura browser corretta incompleta: nessuna nuova ricevuta')
    if banco.git(repo,'diff','--name-only','HEAD','--','src','tests','prisma'):raise SystemExit('Codice tracciato modificato dalla valutazione')
    correction.update(stato='corretta',fine=time.time(),ricevuta='browser-corretto/punteggio-grezzo.json',
        punteggio_invalido=originale['totale'],punteggio_corretto=score['totale'],archivio_invalido='browser-invalido/')
    data={**originale,**score,'letture':1,'tentativi_browser':2,'letture_browser_valide':1,'correzioni_banco':[correction],
        'secondi_valutazione_totali':originale['secondi_valutazione_totali']+time.time()-start,'fine':time.time()}
    scrivi(folder/'evaluation.json',data)
    tech=leggi(source/'tecnica.json');tech.update(qualita_funzionale=data['totale'],controlli_falliti=sorted(c for c,v in data['controlli'].items() if not v['ok']));scrivi(source/'tecnica.json',tech)
    scrivi(pending,correction)
    notes=BENCH/'gradiente-difficolta/correzioni-adattatori.json'
    scrivi(notes,[correction if c['prova']==id_ else c for c in leggi(notes)])
    print(f"Lettura corretta {id_}: {data['totale']}/100; precedente invalida conservata",flush=True)
    return data


if __name__=='__main__':correggi(sys.argv[1])
