#!/usr/bin/env python3
"""Audit delle sessioni di riferimento, senza nuove chiamate ai modelli."""
import json
from pathlib import Path
from prepara import BENCH, REPO, RADICE, banco, leggi, scrivi

BUILTIN={'deep-research','design','design-sync','dataviz','update-config','verify','debug','code-review','simplify','batch','fewer-permission-prompts','doctor','loop','schedule','claude-api','workflow-authoring','run','run-skill-generator','plugin-authoring'}


def verifica(task,fase='01-riferimento'):
    folder=RADICE/f'riferimenti/{task}/phases'/fase
    metriche=folder/'metrics.json'
    if not metriche.exists():return {'task':task,'fase':fase,'completo':False}
    metrics=leggi(metriche)
    init,result=banco.parse_stream(folder/'stream-00.jsonl')
    problemi=[];da_verificare=[]
    if result is None or result.get('is_error') or result.get('subtype')!='success':problemi.append('result non valido')
    if init is None:problemi.append('init assente')
    else:
        foreign=[p for p in init.get('plugins',[]) if p.get('path')!='builtin']
        foreign += [s for s in init.get('skills',[]) if not s.startswith('archetipo') and s not in BUILTIN]
        if foreign:problemi.append({'contaminazione':foreign})
    pre=metrics.get('precondizioni',{})
    if not all(pre.get(key) is True for key in ('docs_wiki_presente','skill_archetipo_wiki','wiki_enabled')):problemi.append('precondizioni Wiki incomplete')
    if not pre.get('hash_skills'):problemi.append('hash skill assenti')
    testi=[]
    for line in (folder/'stream-00.jsonl').read_text().splitlines():
        evento=json.loads(line)
        if evento.get('type')!='assistant':continue
        for blocco in evento.get('message',{}).get('content',[]):
            if blocco.get('type')=='text':testi.append(blocco.get('text',''))
            if blocco.get('type')=='tool_use':
                dati=blocco.get('input',{})
                payload=json.dumps(dati,ensure_ascii=False)
                if str(REPO)+'/' in payload:da_verificare.append({'tool':blocco.get('name'),'input':dati})
                target=dati.get('file_path',dati.get('path',''))
                if target and Path(target).name=='.env':problemi.append('accesso diretto .env')
    unavailable=banco.WIKI_NON_DISPONIBILE.findall('\n'.join(testi))
    if unavailable:problemi.append({'Wiki_dichiarata_non_disponibile':unavailable})
    if result and abs(metrics['cost_usd']-(result.get('total_cost_usd') or 0))>1e-8:problemi.append('costo metriche/result diverso')
    if result:banco.verifica_prompt_sessione(folder,(folder/'prompt.txt').read_text(),result['session_id'])
    info=leggi(BENCH/f'gradiente-difficolta/riferimento-{task}.json')
    if banco.git(Path(info['repo']),'rev-parse','HEAD^{tree}')!=info['tree']:problemi.append('albero riferimento modificato')
    return {'task':task,'fase':fase,'completo':True,'ok':not problemi and not da_verificare,'problemi':problemi,'richieste_con_riferimenti_originale':da_verificare,'costo_usd':metrics['cost_usd'],'model_resolved':metrics.get('model_resolved'),'skills_hash':pre.get('hash_skills')}


if __name__=='__main__':
    report=[]
    for task in ('T1','T2','T3','T4'):
        phases=sorted((RADICE/f'riferimenti/{task}/phases').glob('*/metrics.json'))
        report.extend(verifica(task,file.parent.name) for file in phases) if phases else report.append(verifica(task))
    scrivi(BENCH/'gradiente-difficolta/audit-riferimenti.json',report)
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if any(r.get('completo') and not r.get('ok') for r in report):raise SystemExit('Audit da risolvere prima di usare i riferimenti')
