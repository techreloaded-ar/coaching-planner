#!/usr/bin/env python3
"""Gate finali dei riferimenti nell'ambiente congelato, senza chiamate ai modelli."""
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path
from prepara import BENCH, RADICE, banco, ambiente_clone, leggi, scrivi


def verifica(task):
    info=leggi(BENCH/f'gradiente-difficolta/riferimento-{task}.json')
    repo=Path(info['repo']);folder=RADICE/f'riferimenti/{task}/gate-finale'/info['head'][:12]
    prova_conservata=BENCH/f'gradiente-difficolta/gate-riferimento-{task}.json'
    if prova_conservata.exists():
        precedente=leggi(prova_conservata)
        if precedente.get('ok') and precedente.get('head')==info['head'] and precedente.get('timezone')=='UTC':return precedente
    risultato=folder/'esiti.json'
    if risultato.exists():
        numero=2
        while (folder/f'tentativo-{numero}').exists():numero+=1
        folder=folder/f'tentativo-{numero}'
        risultato=folder/'esiti.json'
    folder.mkdir(parents=True,exist_ok=True)
    ambiente=ambiente_clone(repo)
    ambiente['PLAYWRIGHT_WEB_SERVER_COMMAND']='npm run start'
    esiti={'task':task,'head':info['head'],'tree':info['tree'],'timezone':'UTC','passi':{},'ok':False}
    comandi=[('lint',['npm','run','lint']),('unit',['npx','vitest','run','--reporter=json','--outputFile='+str(folder/'vitest.json')]),('build',['npm','run','build'])]
    comandi += [(f'e2e-{numero}',['npx','playwright','test','--retries=0','--trace=retain-on-failure','--reporter=json']) for numero in (1,2,3)]
    for nome,comando in comandi:
        started=time.time();print(task+' · '+nome,flush=True)
        with (folder/(nome+'.log')).open('w') as log:
            process=subprocess.run(comando,cwd=repo,env=ambiente,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,timeout=1800)
        if nome.startswith('e2e-') and (repo/'test-results').exists():
            shutil.copytree(repo/'test-results',folder/(nome+'-artefatti'),dirs_exist_ok=True)
        esiti['passi'][nome]={'ok':process.returncode==0,'exit':process.returncode,'secondi':round(time.time()-started,1),'log':str(folder/(nome+'.log'))}
        scrivi(risultato,esiti)
        if process.returncode:raise SystemExit(f'{task}: gate {nome} fallito; nessun retry automatico')
    if banco.git(repo,'rev-parse','HEAD^{tree}')!=info['tree']:raise SystemExit('Albero del riferimento cambiato durante i gate')
    esiti['ok']=True;scrivi(risultato,esiti)
    scrivi(BENCH/f'gradiente-difficolta/gate-riferimento-{task}.json',esiti)
    print(task+' · gate finali passati, tre e2e completi senza retry',flush=True)
    return esiti


if __name__=='__main__':
    for task in sys.argv[1:]:verifica(task)
