#!/usr/bin/env python3
"""Conta i test unit della baseline che falliscono contro il riferimento, in una copia separata."""
import json
import shutil
import subprocess
import sys
from pathlib import Path
from prepara import BENCH, RADICE, REPO, banco, leggi, scrivi, setup


def misura(task):
    info=leggi(BENCH/f'gradiente-difficolta/riferimento-{task}.json')
    source=Path(info['repo']);folder=RADICE/f'riferimenti/{task}/sonda-test-baseline'/info['head'][:12];repo=folder/'repo';output=folder/'esiti.json'
    if output.exists():return leggi(output)
    if not repo.exists():
        banco.clone(source,repo)
        # Il riferimento rimane immutabile: si sostituiscono i soli test di questa copia.
        shutil.rmtree(repo/'tests/unit')
        archive=subprocess.check_output(['git','archive',info['baseline'],'tests/unit'],cwd=source)
        subprocess.run(['tar','-x','-C',str(repo)],input=archive,check=True)
    ambiente=setup(repo,'sonda_test_'+task+'_'+info['head'][:12])
    risultato=folder/'vitest.json'
    with (folder/'vitest.log').open('w') as log:
        process=subprocess.run(['npx','vitest','run','--reporter=json','--outputFile='+str(risultato)],cwd=repo,env={**banco.agent_env(),**ambiente},stdout=log,stderr=subprocess.STDOUT,timeout=600)
    if not risultato.exists():raise SystemExit('Sonda senza JSON: controllare il log, non assegnare conteggi')
    data=leggi(risultato)
    failed=[];suites=[]
    for suite in data.get('testResults',[]):
        for assertion in suite.get('assertionResults',[]):
            if assertion.get('status')=='failed':failed.append({'file':str(Path(suite['name']).relative_to(repo)),'test':assertion.get('fullName',assertion.get('title'))})
        if suite.get('status')=='failed':suites.append(str(Path(suite['name']).relative_to(repo)))
    result={'task':task,'head_riferimento':info['head'],'exit_code_atteso_nonzero_se_regressioni':process.returncode,'test_unit_baseline_totali':data.get('numTotalTests'),'test_unit_baseline_falliti':data.get('numFailedTests'),'suite_unit_baseline_fallite':data.get('numFailedTestSuites'),'casi_falliti':failed,'file_falliti':suites,'metodo':'Unit test originali della baseline eseguiti contro codice del riferimento, in clone e Postgres dedicati. Non è un oracolo funzionale e non determina punteggi.'}
    scrivi(output,result);scrivi(BENCH/f'gradiente-difficolta/sonda-test-{task}.json',result)
    return result


if __name__=='__main__':
    result=misura(sys.argv[1]);print(json.dumps({k:v for k,v in result.items() if k not in ('casi_falliti','file_falliti')},ensure_ascii=False,indent=2))
