#!/usr/bin/env python3
"""Prove report 3, bloccate fino alla conferma umana registrata nella matrice."""
import json
import re
import subprocess
import sys
from pathlib import Path
from prepara import BENCH, REPO, RADICE, MATRICE, banco, leggi, scrivi, setup, costi, ambiente_clone


from proteggi_fase import proteggi_fase
MATRICE=BENCH/'wiki-benchmark/matrice-gradiente-ridotta.json'

banco.RUNS=RADICE


def stato_dopo_review(directory,phase,metrics):
    """Lo stato storico della review non va letto dal clone già progredito."""
    if 'spec_status_after' in metrics:return metrics['spec_status_after']
    # Compatibilità con le prime review, registrate prima dell'interruzione:
    # il verdetto congelato permette di ricostruire il relativo stato CLI.
    _,result=banco.parse_stream(directory/'phases'/phase/'stream-00.jsonl')
    match=re.search(r'verdict:\s*(ACCEPTED|CHANGES_REQUESTED|LEFT_IN_REVIEW)\b',result.get('result',''))
    if not match:raise SystemExit('Stato storico della review non ricostruibile: '+phase)
    return {'ACCEPTED':'DONE','CHANGES_REQUESTED':'TODO','LEFT_IN_REVIEW':'REVIEW'}[match[1]]

def verifica_conferma():
    matrix=leggi(MATRICE)
    if matrix.get('conferma_8_prove') is not True:
        raise SystemExit('STOP: manca la conferma umana per il set ridotto. Nessuna prova avviata.')
    required=[BENCH/'gradiente-difficolta/indicatori.json']
    required += [BENCH/f'gradiente-difficolta/riferimento-{task}.json' for task in ('T1','T2','T3','T4')]
    required += [RADICE/f'chiarimenti/{task}/discovery.json' for task in ('T1','T2','T3','T4')]
    required += [BENCH/f'gradiente-difficolta/oracoli/{task}/integrazione.test.ts' for task in ('T1','T2','T3','T4')]
    required += [BENCH/'gradiente-difficolta/calibrazione.json']
    missing=[str(path) for path in required if not path.exists()]
    if missing:raise SystemExit('Preparazione incompleta: '+', '.join(missing))
    if not leggi(BENCH/'gradiente-difficolta/calibrazione.json').get('ok'):
        raise SystemExit('Calibrazione oracoli/adattatori non validata')
    from congela_preparazione import hash_oracoli
    if leggi(BENCH/'gradiente-difficolta/calibrazione.json')['hash_oracoli']!=hash_oracoli():
        raise SystemExit('Oracoli cambiati dopo il congelamento: diagnosticare prima delle prove')
    return matrix


def riserva(massimo,preparazione=False):
    ledger=costi()
    if ledger['totale_usd']+massimo>leggi(MATRICE)['budget_usd']:raise SystemExit('STOP tetto ridotto autorizzato')
    if preparazione and ledger['preparazione_usd']+massimo>120:raise SystemExit('STOP tetto preparazione 120 USD')


def prova(id_):
    matrix=verifica_conferma()
    cell=next((r for r in matrix['runs'] if r['id']==id_),None)
    if cell is None:raise SystemExit('Prova sconosciuta: '+id_)
    directory=RADICE/'prove'/cell['task']/id_;repo=directory/'repo'
    if (directory/'run.json').exists():return leggi(directory/'run.json')
    task=cell['task'];discovery=leggi(RADICE/f'chiarimenti/{task}/discovery.json')
    if not repo.exists():
        banco.clone(RADICE/f'chiarimenti/{task}/repo',repo);setup(repo,id_)
    banco.agent_env=lambda: ambiente_clone(repo)
    banco.CFG.update(matrix)
    banco.CFG['precondizioni_wiki_obbligatorie']=True
    banco.riserva_lancio=riserva
    banco.AGENT_SETTINGS={'permissions':{'deny':[f'Read(/{REPO}/**)',f'Edit(/{REPO}/**)','Read(./.env)','Edit(./.env)']}}
    outcomes={}
    def step(phase,prompt,skill,after=None):
        cached=directory/'phases'/phase/'metrics.json'
        if cached.exists():return banco.phase(directory,phase,cell['model'],repo,prompt,skill)
        remaining=leggi(MATRICE)['budget_usd']-costi()['totale_usd']
        if remaining<=2:raise SystemExit('STOP budget residuo insufficiente per una nuova fase e la valutazione')
        banco.CFG['budget_usd_per_phase']['sonnet']=min(25,remaining-1)
        with proteggi_fase(repo,diretto=cell['config']=='DIR',codes=discovery['codes']):
            result=banco.phase(directory,phase,cell['model'],repo,prompt,skill,after=after)
        costi();return result
    if cell['config']=='DIR':
        step('01-diretto',banco.PROMPT_DIRETTO.format(oggetto='le user story '+', '.join(discovery['codes'])),'diretto')
    else:
        for code in discovery['codes']:
            massimo_cicli=matrix['max_rework_per_storia']+1
            for ciclo in range(massimo_cicli):
                iteration=ciclo+1
                step(f'{code}-plan-{iteration}',f'/archetipo-plan {code}','archetipo-plan')
                step(f'{code}-implement-{iteration}',f'/archetipo-implement {code}','archetipo-implement')
                phase=f'{code}-review-{iteration}'
                metrics=step(phase,banco.PROMPT_REVIEW.format(workdir=repo,code=code,n=iteration,max=massimo_cicli,allowed='yes' if iteration<massimo_cicli else 'no'),'archetipo-review',after=lambda:{'spec_status_after':banco.spec_status(repo,code)})
                status=stato_dopo_review(directory,phase,metrics)
                if status not in ('DONE','TODO','REVIEW'):raise SystemExit(f'Verdetto non terminale {status}')
                if status!='TODO' or iteration==massimo_cicli:
                    outcomes[code]={'status':status,'rework_cycles':ciclo};break
    head=banco.git(repo,'rev-parse','HEAD')
    result={**cell,'wiki':True,'discovery':discovery['id'],'codes':discovery['codes'],'discovery_head':discovery['head'],'baseline_tecnica':leggi(BENCH/f'gradiente-difficolta/riferimento-{task}.json')['baseline'],'head':head,'tree_hash':banco.git(repo,'rev-parse','HEAD^{tree}'),'outcomes':outcomes}
    (directory/'diff.patch').write_text(banco.git(repo,'diff',discovery['head'],head))
    scrivi(directory/'run.json',result)
    return result


if __name__=='__main__':
    if len(sys.argv)>2 and sys.argv[1]=='prova':prova(sys.argv[2])
    else:verifica_conferma()
