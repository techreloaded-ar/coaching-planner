#!/usr/bin/env python3
"""Audit delle chiamate dell'autore oracoli e degli adattatori statici."""
import json
from pathlib import Path
from prepara import BENCH, REPO, RADICE, banco, leggi, scrivi
from audit_preparazione import BUILTIN


def controlla(directory):
    init,result=banco.parse_stream(directory/'stream-00.jsonl')
    problemi=[];comandi=[]
    if not init or not result or result.get('is_error') or result.get('subtype')!='success':problemi.append('init/result non valido')
    if init:
        foreign=[p for p in init.get('plugins',[]) if p.get('path')!='builtin']
        foreign += [s for s in init.get('skills',[]) if not s.startswith('archetipo') and s not in BUILTIN]
        if foreign:problemi.append({'contaminazione':foreign})
    metrics=leggi(directory/'metrics.json')
    if not all(metrics['precondizioni'].get(k) for k in ['docs_wiki_presente','skill_archetipo_wiki','wiki_enabled']):problemi.append('precondizioni incomplete')
    for line in (directory/'stream-00.jsonl').read_text().splitlines():
        event=json.loads(line)
        if event.get('type')!='assistant':continue
        for block in event.get('message',{}).get('content',[]):
            if block.get('type')!='tool_use':continue
            data=block.get('input',{});payload=json.dumps(data,ensure_ascii=False)
            if str(REPO)+'/' in payload:problemi.append({'riferimento_originale':data})
            path=data.get('file_path',data.get('path',''))
            if path and Path(path).name=='.env':problemi.append('accesso .env')
            command=data.get('command','')
            if command:comandi.append(command)
            if any(word in command for word in ['vitest run','playwright test','next start','npm run start','prisma db execute','psql ']):
                if '--list' not in command and 'vitest list' not in command:problemi.append({'comando_da_verificare':command})
    return {'fase':str(directory.relative_to(RADICE)),'ok':not problemi,'problemi':problemi,'comandi':comandi,'costo_usd':metrics['cost_usd']}


if __name__=='__main__':
    phases=[RADICE/'preparazione/oracoli/phases/01-oracoli']
    phases += [RADICE/f'preparazione/adattatori-riferimento/{task}/phases/01-adattatore' for task in ['T1','T2','T3','T4']]
    data=[controlla(p) for p in phases]
    scrivi(BENCH/'gradiente-difficolta/audit-oracoli-adattatori.json',data)
    print(json.dumps([{k:v for k,v in d.items() if k!='comandi'} for d in data],ensure_ascii=False,indent=2))
    if any(not d['ok'] for d in data):raise SystemExit('Audit da risolvere prima del congelamento')
