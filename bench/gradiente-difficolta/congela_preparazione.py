#!/usr/bin/env python3
"""Attesta evidenze già prodotte; non lancia modelli né prove sperimentali."""
import hashlib
import json
from prepara import BENCH, RADICE, MATRICE, leggi, scrivi, costi

COMPITI=('T1','T2','T3','T4')


def hash_oracoli():
    directory=BENCH/'gradiente-difficolta/oracoli'
    digest=hashlib.sha256()
    for file in sorted(directory.rglob('*')):
        if file.is_file() and '__pycache__' not in file.parts:
            digest.update(str(file.relative_to(directory)).encode())
            digest.update(file.read_bytes())
    return digest.hexdigest()


def congela():
    ridotta=BENCH/'wiki-benchmark/matrice-gradiente-ridotta.json'
    if ridotta.exists() and leggi(ridotta).get('conferma_8_prove'):
        raise SystemExit('Preparazione già congelata e set ridotto autorizzato: non riscrivere attestazioni durante le prove')
    matrix=leggi(MATRICE)
    if matrix['conferma_40_prove']:raise SystemExit('Congelamento iniziale soltanto prima delle prove')
    evidenze={}
    for task in COMPITI:
        riferimento=leggi(BENCH/f'gradiente-difficolta/riferimento-{task}.json')
        taratura=leggi(RADICE/f'preparazione/taratura/{task}/esiti.json')
        adattatore=leggi(RADICE/f'preparazione/adattatori-riferimento/{task}/adattatore.json')
        scoperta=leggi(RADICE/f'chiarimenti/{task}/discovery.json')
        copertura=leggi(RADICE/f'chiarimenti/{task}/copertura.json')
        if not taratura['ok'] or not adattatore['typecheck_ok'] or adattatore['eseguito']:
            raise SystemExit('Evidenza di taratura non valida: '+task)
        if adattatore['source_tree']!=riferimento['tree']:raise SystemExit('Riferimento diverso da quello tarato: '+task)
        controlli=leggi(BENCH/f'gradiente-difficolta/oracoli/{task}/controlli.json')['controlli']
        if any(c['nelle_storie'] is None for c in controlli):raise SystemExit('Copertura storie incompleta: '+task)
        evidenze[task]={'riferimento':riferimento,'taratura':taratura,'adattatore':adattatore,
            'chiarimento':{'codes':scoperta['codes'],'head':scoperta['head'],'copertura':copertura}}
    sana=leggi(RADICE/'preparazione/taratura/T4-sana/esiti.json')
    gate=leggi(RADICE/'preparazione/taratura/gate-regressione/esiti.json')
    if not sana['ok'] or not gate['ok']:raise SystemExit('Controlli positivi T4 non validi')
    ledger=costi()
    if ledger['sessioni_costo_non_attestato']:raise SystemExit('Sessioni con costo da riconciliare')
    if ledger['preparazione_usd']>120 or ledger['totale_usd']>750:raise SystemExit('Budget superato')
    data={'ok':True,'esperimenti_avviati':0,'hash_oracoli':hash_oracoli(),'evidenze':evidenze,
        'T4_baseline_sana':sana,'gate_regressione_sintetico':gate,
        'migrazione_baseline':{task:leggi(RADICE/f'preparazione/taratura/{task}/migrazione/gate-migrazione.json') for task in ['T1','T3']},
        'limiti':['I riferimenti servono per indicatori e taratura statica: nessun adattatore eseguito sui riferimenti.',
          'Nessun punteggio delle 40 consegne è ancora disponibile.',
          'Stabilità dei gate UTC T3 non dimostrata: due tentativi falliti e conservati, anche su percorsi preesistenti.'],
        'costi':{k:v for k,v in ledger.items() if k!='sessioni'}}
    scrivi(BENCH/'gradiente-difficolta/calibrazione.json',data)
    print('Preparazione attestata. La conferma umana resta false.')


if __name__=='__main__':congela()
