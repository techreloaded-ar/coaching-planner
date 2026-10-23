#!/usr/bin/env python3
"""Audit degli artefatti delle prove, senza nuove sessioni né esecuzioni dell'oracolo."""
import json
import hashlib
import re
from pathlib import Path
from prepara import BENCH, REPO, RADICE, banco, leggi, scrivi, costi
from esegui import verifica_conferma
from audit_preparazione import BUILTIN
from proteggi_fase import violazioni_diretto


def audit():
    matrix=verifica_conferma()
    adapter_audits={row['prova']:row for row in leggi(BENCH/'gradiente-difficolta/audit-adattatori.json')}
    phases=[];runs=[];sessions=set();richieste=[];review_audit=[]
    for cell in matrix['runs']:
        source=RADICE/'prove'/cell['task']/cell['id']
        for file in sorted((source/'phases').glob('*/metrics.json')):
            folder=file.parent;metrics=leggi(file);issues=[]
            if not metrics.get('model_resolved','').startswith('claude-sonnet-'):issues.append('modello di sviluppo diverso da Sonnet')
            init,result=banco.parse_stream(folder/'stream-00.jsonl')
            if not init or not result:issues.append('init/result assente')
            else:
                if result.get('is_error') or result.get('subtype')!='success':issues.append('result in errore')
                session=result['session_id']
                if session in sessions:issues.append('session ID riusato')
                sessions.add(session)
                foreign=[p for p in init.get('plugins',[]) if p.get('path')!='builtin']
                foreign += [s for s in init.get('skills',[]) if not s.startswith('archetipo') and s not in BUILTIN]
                if foreign:issues.append({'contaminazione':foreign})
                if abs(metrics['cost_usd']-(result.get('total_cost_usd') or 0))>1e-8:issues.append('costo non corrispondente al result')
                banco.verifica_prompt_sessione(folder,(folder/'prompt.txt').read_text(),session)
            pre=metrics.get('precondizioni',{})
            if not all(pre.get(k) is True for k in ['wiki_enabled','docs_wiki_presente','skill_archetipo_wiki']):issues.append('precondizioni Wiki non soddisfatte')
            if pre.get('hash_skills')!=matrix['hash_skills_base']:issues.append('hash skill diverso dal congelato')
            if cell['config']=='DIR' and violazioni_diretto(folder):issues.append('skill invocata nel diretto')
            testi=[];workflow_calls=[];github_calls=[]
            for line in (folder/'stream-00.jsonl').read_text().splitlines():
                event=json.loads(line)
                if event.get('type')!='assistant':continue
                for block in event.get('message',{}).get('content',[]):
                    if block.get('type')=='text':testi.append(block.get('text',''))
                    if block.get('type')=='tool_use':
                        tool=block.get('name');tool_input=block.get('input',{})
                        payload=json.dumps(tool_input,ensure_ascii=False)
                        target=tool_input.get('file_path','');command=tool_input.get('command','')
                        if (tool=='Read' and target.endswith('.github/workflows/ci.yml')) or (tool=='Bash' and '.github/workflows/ci.yml' in command):workflow_calls.append({'tool':tool,'input':tool_input})
                        if tool=='Bash' and re.search(r'\bgh\s+(?:run|workflow|api|pr)\b|\bcurl\b[^\n]*github',command):github_calls.append(tool_input)
                        if str(REPO)+'/' in payload:richieste.append({'prova':cell['id'],'fase':folder.name,'tool':block.get('name'),'input':block.get('input')})
                        target=block.get('input',{}).get('file_path',block.get('input',{}).get('path',''))
                        if target and Path(target).name=='.env':issues.append('accesso diretto .env')
            if banco.WIKI_NON_DISPONIBILE.search('\n'.join(testi)):issues.append('Wiki dichiarata non disponibile')
            if metrics.get('skill')=='archetipo-review':
                verdict=re.search(r'verdict:\s*(ACCEPTED|CHANGES_REQUESTED|LEFT_IN_REVIEW)',(result or {}).get('result',''))
                review_audit.append({'prova':cell['id'],'fase':folder.name,'verdetto':verdict[1] if verdict else None,'letture_workflow_ci_osservate':workflow_calls,'comandi_github_osservati':github_calls})
            phases.append({'prova':cell['id'],'fase':folder.name,'ok':not issues,'problemi':issues,'modello':metrics.get('model_resolved'),'costo_usd':metrics['cost_usd']})
        info=leggi(source/'run.json') if (source/'run.json').exists() else None
        evaluation=leggi(source/'valutazione/evaluation.json') if (source/'valutazione/evaluation.json').exists() else None
        issues=[]
        invalidazione=source/'valutazione/invalidazione-browser.json'
        if invalidazione.exists() and leggi(invalidazione).get('stato')!='corretta':issues.append('lettura browser invalidata, correzione pendente')
        if info:
            if banco.git(source/'repo','rev-parse','HEAD^{tree}')!=info['tree_hash']:issues.append('albero consegna cambiato')
            if banco.git(source/'repo','status','--porcelain','--untracked-files=no'):issues.append('consegna con modifiche tracciate non congelate')
            if evaluation:
                evaluated=source/'valutazione/repo'
                if banco.git(evaluated,'rev-parse','HEAD^{tree}')!=info['tree_hash']:issues.append('albero effettivamente valutato diverso dalla consegna')
                if banco.git(evaluated,'diff','--name-only','HEAD','--','src','tests','prisma'):issues.append('codice valutato con modifiche tracciate')
                if evaluation['tree_hash']!=info['tree_hash'] or evaluation['letture']!=1 or not evaluation['valida']:issues.append('ricevuta valutazione incoerente')
                adapter=RADICE/'adattatori'/cell['id']/'adattatore'
                hashes={file.name:hashlib.sha256(file.read_bytes()).hexdigest() for file in sorted(adapter.glob('*.ts'))}
                installed={file.name:hashlib.sha256(file.read_bytes()).hexdigest() for file in sorted((evaluated/'__oracolo__/adattatore').glob('*.ts'))}
                if adapter_audits.get(cell['id'],{}).get('sha256')!=hashes:issues.append('audit uniforme adattatore assente o hash cambiati')
                if installed!=hashes:issues.append('adattatore installato diverso da quello auditato')
        runs.append({'prova':cell['id'],'consegnata':bool(info),'valutata':bool(evaluation) and not issues,'tecnica':(source/'tecnica.json').exists(),'ok':not issues,'problemi':issues})
    ledger=costi()
    report={'protocollo':'ridotto-8','completate':sum(r['valutata'] and r['tecnica'] for r in runs),'fasi':phases,'prove':runs,'richieste_con_riferimenti_originale':richieste,
        'modelli_sviluppo_risolti':sorted({p['modello'] for p in phases}),
        'costo_usd':ledger['totale_usd'],'residuo_usd':ledger['residuo_report_usd'],'sessioni_costo_non_attestato':ledger['sessioni_costo_non_attestato'],
        'ok':all(r['ok'] for r in phases+runs) and not richieste and not ledger['sessioni_costo_non_attestato'] and ledger['residuo_report_usd']>=0}
    scrivi(BENCH/'gradiente-difficolta/audit-ridotto.json',report)
    scrivi(BENCH/'gradiente-difficolta/audit-review.json',{'ambito':'Tool call degli stream principali delle review valide; una lettura non dimostra da sola una valutazione statica completa. Nessuna review viene ripetuta per correggerne il metodo.','review':review_audit})
    print(json.dumps({k:v for k,v in report.items() if k not in ['fasi','prove','richieste_con_riferimenti_originale']},ensure_ascii=False,indent=2))
    return report


if __name__=='__main__':audit()
