#!/usr/bin/env python3
"""Confronta i requisiti iniziali e finali, distinguendo il feedback del rework."""
import hashlib
import re
import yaml
from prepara import BENCH, RADICE, banco, leggi, scrivi
from esegui import verifica_conferma


def normalizza_requisiti(testo):
    requisiti=testo.split('\n## Rework Feedback',1)[0]
    return re.sub(r'\[[xX ]\]','[ ]',requisiti).strip()


def audit():
    records=[]
    for cell in verifica_conferma()['runs']:
        folder=RADICE/'prove'/cell['task']/cell['id'];repo=folder/'repo'
        if not (folder/'run.json').exists():continue
        info=leggi(folder/'run.json')
        for code in info['codes']:
            path=f'.archetipo/specs/{code}.yaml'
            def body(ref):return yaml.safe_load(banco.git(repo,'show',f'{ref}:{path}')).get('body','')
            initial=body(info['discovery_head']);final=body(info['head'])
            a=normalizza_requisiti(initial);b=normalizza_requisiti(final)
            records.append({'prova':info['id'],'storia':code,'ok':a==b,'feedback_aggiunto':'\n## Rework Feedback' in final,
                'sha256_requisiti_iniziali':hashlib.sha256(a.encode()).hexdigest(),
                'sha256_requisiti_finali':hashlib.sha256(b.encode()).hexdigest()})
    report={'criterio':'Confronto dei body a discovery_head e head: normalizzati checkbox e spazi esterni; esclusa solo la sezione Rework Feedback aggiunta dal CLI. Nessun requisito riscritto dal banco.',
        'storie':records,'ok':all(r['ok'] for r in records)}
    scrivi(BENCH/'gradiente-difficolta/audit-storie.json',report)
    print(f"Storie verificate: {len(records)}; requisiti invariati: {report['ok']}")
    return report


if __name__=='__main__':audit()
