#!/usr/bin/env python3
"""Ottiene il result cumulativo del tentativo abortito, senza strumenti o scritture applicative."""
import json
import subprocess
from prepara import RADICE, banco, costi

folder=RADICE/'_scartati/G-ref-T3-init-builtin'
stream=folder/'stream-riconciliazione.jsonl'
if stream.exists():
    _,result=banco.parse_stream(stream)
    if result is None or result.get('is_error'):raise SystemExit('Riconciliazione precedente incompleta: verificare prima di ripetere')
else:
    if costi()['preparazione_usd']+1>120:raise SystemExit('STOP budget riconciliazione')
    init,_=banco.parse_stream(folder/'stream-00.jsonl')
    prompt='Il precedente tentativo è stato annullato dal banco prima di una consegna. Non svolgere il requisito precedente. Non usare strumenti. Rispondi soltanto OK, per chiudere la sessione e acquisire il result cumulativo del costo.'
    cmd=['claude','-p',prompt,'--resume',init['session_id'],'--model','opus','--effort','medium','--tools','','--setting-sources','project,local','--permission-mode','bypassPermissions','--output-format','stream-json','--verbose','--max-budget-usd','1']
    with stream.open('w') as out,(folder/'stderr-riconciliazione.txt').open('w') as err:
        subprocess.run(cmd,cwd=RADICE/'riferimenti/T3/repo',env=banco.agent_env(),stdin=subprocess.DEVNULL,stdout=out,stderr=err)
    _,result=banco.parse_stream(stream)
    if result is None or result.get('is_error'):raise SystemExit('STOP riconciliazione in errore; costo conservato')
print(json.dumps(costi(),ensure_ascii=False,indent=2))
