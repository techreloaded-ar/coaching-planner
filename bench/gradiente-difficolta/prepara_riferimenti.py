#!/usr/bin/env python3
"""Sequenza dei riferimenti, senza prove sperimentali o retry automatici."""
import subprocess
import sys
from prepara import BENCH, REPO, leggi

for task in ('T3','T1','T4','T2'):
    if task=='T4':
        info=leggi(BENCH/'gradiente-difficolta/difetto-T4.json')
        if not all(info.get('gate',{}).get(nome,{}).get('ok') for nome in ('lint','unit','build','e2e')):
            raise SystemExit('T4: gate baseline difettosa incompleti o falliti; nessun lancio del riferimento')
    subprocess.run([sys.executable,'-u',str(BENCH/'gradiente-difficolta/prepara.py'),'riferimento',task],cwd=REPO,stdin=subprocess.DEVNULL,check=True)
subprocess.run([sys.executable,str(BENCH/'gradiente-difficolta/misura_indicatori.py')],cwd=REPO,stdin=subprocess.DEVNULL,check=True)
print('Quattro riferimenti completati. Restano oracoli, chiarimenti e taratura prima della conferma umana.',flush=True)
