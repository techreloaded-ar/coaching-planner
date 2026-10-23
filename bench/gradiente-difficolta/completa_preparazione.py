#!/usr/bin/env python3
"""Fasi seriali dopo i riferimenti e l'autore oracoli; mai avvio delle 40 prove."""
from scoperta import chiarisci
from giudica_scoperta import giudica
from adatta import genera
from prepara import RADICE


if __name__=='__main__':
    for task in ['T3','T1','T4','T2']:
        print('CHIARIMENTO '+task,flush=True)
        chiarisci(task)
    for task in ['T3','T1','T4','T2']:
        print('GIUDICI SCOPERTA '+task,flush=True)
        giudica(task)
    for task in ['T3','T1','T4','T2']:
        print('TARATURA STATICA ADATTATORE '+task,flush=True)
        genera(task,RADICE/f'riferimenti/{task}/repo',RADICE/f'preparazione/adattatori-riferimento/{task}',taratura=True)
    print('Sequenza conclusa. Le 40 prove restano bloccate.',flush=True)
