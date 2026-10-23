#!/usr/bin/env python3
"""Controlli positivi/negativi sulle sole baseline; mai sui riferimenti."""
import importlib.util
import json
import subprocess
import sys
from prepara import BENCH, RADICE, banco, baseline, setup, ambiente_clone, scrivi, leggi

ORACOLI=BENCH/'gradiente-difficolta/oracoli'
spec=importlib.util.spec_from_file_location('punteggio_oracoli',ORACOLI/'shared/punteggio.py')
punteggio=importlib.util.module_from_spec(spec);spec.loader.exec_module(punteggio)


def tara(task, integra=True):
    nome=task if integra else 'T4-sana'
    directory=RADICE/'preparazione/taratura'/nome
    repo=directory/'repo'
    output=directory/'esiti.json'
    if output.exists():return leggi(output)
    if not repo.exists():
        banco.clone(baseline(task if integra else 'T1'),repo)
        setup(repo,'tara_'+nome.lower().replace('-','_'))
    env={**ambiente_clone(repo),'E2E_TEST_MODE':'true','NODE_ENV':'test'}
    env['E2E_DATABASE_URL']=env['DATABASE_URL']
    comandi={
      'build':['npm','run','build'],
      'installa':['python3',str(ORACOLI/'shared/installa_oracolo.py'),'--compito',task,'--consegna',str(repo),'--adattatore-nullo'],
      'typecheck':['npx','tsc','-p','__oracolo__/shared/tsconfig.oracolo.json'],
      'integrazione':['npx','vitest','run','--config','__oracolo__/vitest.config.ts','--reporter=json',f'--outputFile={directory}/vitest.json'],
      'browser':['npx','playwright','test','--config','__oracolo__/playwright.config.ts'],
    }
    passi={}
    env['ORACOLO_PLAYWRIGHT_JSON']=str(directory/'playwright.json')
    for nome_passo,comando in comandi.items():
        print(f'{nome}: {nome_passo}',flush=True)
        result=subprocess.run(comando,cwd=repo,env=env,text=True,capture_output=True)
        (directory/f'{nome_passo}.log').write_text(result.stdout+result.stderr)
        passi[nome_passo]=result.returncode
        if result.returncode and nome_passo not in ('integrazione','browser'):
            scrivi(directory/'errore.json',passi);raise SystemExit(f'Errore infrastrutturale {nome}/{nome_passo}')
    esiti={**punteggio.da_vitest(directory/'vitest.json'),**punteggio.da_playwright(directory/'playwright.json')}
    checklist=leggi(ORACOLI/task/'controlli.json')['controlli']
    codici={c['codice'] for c in checklist if c['livello'] in ('browser','integrazione') and c['area']!='migrazione'}
    if task=='T4':
        fallimenti_attesi=set('S1 S2 S4 S5 F1 F2 F3 F4 U1 U2'.split()) if integra else set()
    else:fallimenti_attesi=codici
    falliti={c for c,v in esiti.items() if not v['ok']}
    data={'task':task,'baseline':'difettosa' if task=='T4' and integra else 'main','passi':passi,
      'controlli':esiti,'codici_attesi':sorted(codici),'fallimenti_attesi':sorted(fallimenti_attesi),
      'fallimenti_osservati':sorted(falliti),'mancanti':sorted(codici-set(esiti)),
      'ok':set(esiti)==codici and falliti==fallimenti_attesi}
    scrivi(output,data)
    if not data['ok']:raise SystemExit(f'Taratura incoerente: {output}')
    return data


if __name__=='__main__':
    for task in sys.argv[1:] or ['T1','T2','T3','T4','T4-sana']:
        tara('T4' if task=='T4-sana' else task,task!='T4-sana')
