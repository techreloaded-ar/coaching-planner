#!/usr/bin/env python3
"""Driver seriale delle otto prove autorizzate; ogni errore ferma la sequenza."""
import fcntl
import json
import sys
import time
from prepara import BENCH, RADICE, costi, scrivi
from esegui import verifica_conferma, prova
from valuta_ridotto import valuta


def main():
    matrix=verifica_conferma()
    lock=(RADICE/'esecuzione-ridotta.lock').open('w')
    try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:raise SystemExit('Un driver ridotto è già attivo')
    state={'protocollo':'ridotto-8','inizio':time.time(),'stato':'in corso','completate':[]}
    try:
        for cell in matrix['runs']:
            id_=cell['id'];state.update(prova_corrente=id_,fase='sviluppo')
            scrivi(BENCH/'gradiente-difficolta/progresso.json',state)
            print('\nPROVA '+id_,flush=True)
            prova(id_)
            state['fase']='valutazione';scrivi(BENCH/'gradiente-difficolta/progresso.json',state)
            result=valuta(id_)
            state['completate'].append({'id':id_,'task':cell['task'],'punteggio':result['totale']})
            ledger=costi()
            state.update(costo_usd=ledger['totale_usd'],residuo_usd=ledger['residuo_report_usd'])
            scrivi(BENCH/'gradiente-difficolta/progresso.json',state)
            print(f"CONCLUSA {id_}: {result['totale']}/100; spesi {ledger['totale_usd']:.2f}, residuo {ledger['residuo_report_usd']:.2f} USD",flush=True)
    except BaseException as error:
        state.update(stato='fermo',errore=str(error),fine=time.time())
        scrivi(BENCH/'gradiente-difficolta/progresso.json',state)
        costi();raise
    state.update(stato='prove concluse',fine=time.time(),fase='report')
    scrivi(BENCH/'gradiente-difficolta/progresso.json',state)
    print('OTTO PROVE CONCLUSE. Restano report, verifica e commit.',flush=True)


if __name__=='__main__':main()
