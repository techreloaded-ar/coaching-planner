#!/usr/bin/env python3
"""Conta file unit che eseguono le funzioni toccate, con il profiler Node della baseline."""
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlparse
from prepara import BENCH, RADICE, banco, ambiente_clone, leggi, scrivi

SETUP='''import { Session } from "node:inspector";
import { writeFileSync } from "node:fs";
import { afterAll } from "vitest";
const session = new Session(); session.connect();
const post = (method: string, params = {}) => new Promise<unknown>((resolve,reject) => session.post(method as never,params,(error,result) => error ? reject(error) : resolve(result)));
await post("Profiler.enable"); await post("Profiler.startPreciseCoverage",{callCount:true,detailed:true});
afterAll(async () => { const result = await post("Profiler.takePreciseCoverage"); writeFileSync(process.env.INDICATORI_OUTPUT!,JSON.stringify(result)); await post("Profiler.stopPreciseCoverage"); session.disconnect(); });
'''
CONFIG='''import base from "./vitest.config";
export default {...base,test:{...base.test,include:[process.env.INDICATORI_TEST!],setupFiles:["__indicatori__/setup.ts"]}};
'''


def misura(nome,task):
    directory=RADICE/f'preparazione/copertura-unit/{nome}'
    output=directory/'esiti.json'
    if output.exists():return leggi(output)
    repo=RADICE/f'preparazione/taratura/{task}/repo'
    directory.mkdir(parents=True,exist_ok=True)
    strumenti=repo/'__indicatori__';strumenti.mkdir(exist_ok=True)
    (strumenti/'setup.ts').write_text(SETUP)
    (repo/'vitest.indicatori.config.ts').write_text(CONFIG)
    records={}
    test_files=banco.git(repo,'ls-tree','-r','--name-only','HEAD','--','tests/unit').splitlines()
    try:
        for file in test_files:
            if not file.endswith('.test.ts'):continue
            report=directory/(Path(file).stem+'.json')
            env={**ambiente_clone(repo),'NODE_ENV':'test','INDICATORI_TEST':file,'INDICATORI_OUTPUT':str(report)}
            result=subprocess.run(['npx','vitest','run','--config','vitest.indicatori.config.ts'],cwd=repo,env=env,capture_output=True,text=True)
            (directory/(Path(file).stem+'.log')).write_text(result.stdout+result.stderr)
            if result.returncode or not report.exists():raise SystemExit('Copertura baseline fallita: '+file)
            calls=[]
            for script in leggi(report)['result']:
                url=urlparse(script['url'])
                if url.scheme!='file':continue
                path=Path(unquote(url.path)).resolve()
                if not path.is_relative_to(repo.resolve()):continue
                relative=str(path.relative_to(repo.resolve()))
                if not relative.startswith('src/'):continue
                for function in script['functions']:
                    if function['functionName'] and function['ranges'][0]['count']>0:
                        calls.append({'file':relative,'funzione':function['functionName'],'chiamate':function['ranges'][0]['count']})
            records[file]=calls
            print(nome,Path(file).name,len(calls),flush=True)
    finally:
        (repo/'vitest.indicatori.config.ts').unlink(missing_ok=True)
        import shutil
        shutil.rmtree(strumenti,ignore_errors=True)
    data={'baseline':banco.git(repo,'rev-parse','HEAD'),'file_test':records,'metodo':'Profiler.startPreciseCoverage Node, ogni file Vitest in un processo separato, conteggio chiamate > 0; codice baseline invariato'}
    scrivi(output,data);return data


if __name__=='__main__':
    main=misura('main','T1');t4=misura('T4-difettosa','T4')
    scrivi(BENCH/'gradiente-difficolta/copertura-unit-baseline.json',{'main':main,'T4':t4})
