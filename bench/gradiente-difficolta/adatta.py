#!/usr/bin/env python3
"""Adattatore Opus per consegna; taratura statica separata sui riferimenti."""
import shutil
import subprocess
import sys
from prepara import BENCH, RADICE, banco, setup, sessione, leggi, scrivi, ambiente_clone

ORACOLI=BENCH/'gradiente-difficolta/oracoli'


def genera(task,source,directory,taratura=False):
    repo=directory/'repo';dest=directory/'adattatore';receipt=directory/'adattatore.json'
    if receipt.exists():
        data=leggi(receipt)
        if data['source_tree']!=banco.git(source,'rev-parse','HEAD^{tree}'):raise SystemExit('Sorgente cambiata dopo generazione adattatore')
        return dest
    if not repo.exists():
        banco.clone(source,repo);setup(repo,'adatta_'+directory.name.lower().replace('-','_'),migrate=False)
        subprocess.run(['python3',str(ORACOLI/'shared/installa_oracolo.py'),'--compito',task,'--consegna',str(repo),'--adattatore-nullo'],check=True,capture_output=True)
        banco.commit_if_dirty(repo,'bench: contratto esterno prima dell’adattatore')
    prima=banco.git(repo,'rev-parse','HEAD')
    prompt=f'''Sei valutatore esterno del compito {task}. Lavora soltanto nel clone corrente. Non leggere o modificare .env e non accedere al repository originale, ad altri cloni, profili, benchmark o soluzioni esterne.
Leggi AGENTS.md e __oracolo__/ADATTATORI.md, contratto.ts e shared/contratto-comune.ts. Scrivi SOLO __oracolo__/adattatore/, collegando le firme, proprietà e locator reali: niente logica di prodotto né calcoli né autorizzazioni nell'adattatore. Per capacità mancanti usa NonImplementato. Non modificare altro. Non avviare server e non eseguire test né query SQL: puoi fare soltanto typecheck e discovery dei test. Non fare domande. Elenca ogni collegamento e capacità mancante.
Questa è {'taratura STATICA sulle interfacce del riferimento: l’adattatore NON sarà eseguito' if taratura else 'generazione dell’adattatore di una consegna; i risultati dei test non sono disponibili'}.'''
    sessione(directory/'phases/01-adattatore',repo,prompt,massimo=5)
    esterni=[p for p in banco.git(repo,'diff','--name-only',prima,'HEAD').splitlines() if not p.startswith('__oracolo__/adattatore/')]
    if esterni:
        scrivi(directory/'scarto.json',{'motivo':'Modifiche fuori adattatore','file':esterni})
        raise SystemExit('Adattatore invalido: modifica della consegna')
    env=ambiente_clone(repo)
    esito=subprocess.run(['npx','tsc','-p','__oracolo__/shared/tsconfig.oracolo.json'],cwd=repo,env=env,capture_output=True,text=True)
    (directory/'typecheck.log').write_text(esito.stdout+esito.stderr)
    if esito.returncode:raise SystemExit('Typecheck adattatore fallito: preservato, nessun test eseguito')
    shutil.copytree(repo/'__oracolo__/adattatore',dest,dirs_exist_ok=True)
    scrivi(receipt,{'task':task,'taratura_statica':taratura,'source_tree':banco.git(source,'rev-parse','HEAD^{tree}'),
      'source_head':banco.git(source,'rev-parse','HEAD'),'adattatore':str(dest),'typecheck_ok':True,'eseguito':False})
    return dest


if __name__=='__main__':
    task=sys.argv[1]
    source=RADICE/f'riferimenti/{task}/repo'
    print(genera(task,source,RADICE/f'preparazione/adattatori-riferimento/{task}',taratura=True))
