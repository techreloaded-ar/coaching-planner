#!/usr/bin/env python3
"""Rimuove un vincolo aggiunto dal primo autore e completa i gate del riferimento T1."""
from pathlib import Path
from prepara import BENCH, RADICE, REPO, banco, leggi, scrivi, sessione

file=BENCH/'gradiente-difficolta/riferimento-T1.json'
info=leggi(file);repo=Path(info['repo'])
profile=(BENCH/'gradiente-difficolta/profili/T1.md').read_text()
prompt=f'''Correggi la soluzione di riferimento T1 nel clone corrente. Non è una consegna sperimentale. Il profilo è:

{profile}

L'autore precedente ha aggiunto un vincolo non richiesto: email o telefono richiedono il nome referente. Rimuovilo: nome, email e telefono sono ciascuno facoltativi, salvabili singolarmente, con validazione solo dei valori presenti. Verifica form, server action e relativi test; aggiungi casi email-only e telefono-only. Non introdurre altri requisiti. Non cambiare il backlog né usare skill ARchetipo. Non accedere a {REPO} né ad altri cloni. Non leggere/modificare .env né modificare .env.local; l'ambiente sintetico corretto è già ereditato dai processi.

Esegui lint, tutti i unit test, build e tre esecuzioni consecutive degli e2e con retries=0, fullyParallel=true e senza forzare workers=1, come richiesto dal README. Il primo autore aveva completato un solo giro dell'intera suite. Non fare commit né lasciare server attivi. Riassumi correzione ed esiti.'''
sessione(RADICE/'riferimenti/T1/phases/02-facoltativita',repo,prompt)
info.update(head=banco.git(repo,'rev-parse','HEAD'),tree=banco.git(repo,'rev-parse','HEAD^{tree}'),correzione='Facoltatività indipendente dei tre campi; gate e2e di stabilità completato')
scrivi(file,info)
(BENCH/'gradiente-difficolta/riferimento-T1.patch').write_text(banco.git(repo,'diff','--binary',info['baseline'],'HEAD'))
print('Riferimento T1 aggiornato; rigenerare sonda test e indicatori prima della conferma.',flush=True)
