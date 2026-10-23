#!/usr/bin/env python3
"""Un chiarimento Opus per compito, baseline V0 salvo adozione documentata; nessuna correzione delle storie dal profilo."""
import json
import subprocess
import sys
import time
from pathlib import Path
from prepara import BENCH, REPO, RADICE, banco, baseline, costi, leggi, scrivi, setup, MATRICE, ambiente_clone


banco.RUNS=RADICE

def chiarisci(task):
    variante=leggi(MATRICE)['variante_spec']
    cartella=RADICE/'chiarimenti'/task;repo=cartella/'repo';summary=cartella/'discovery.json'
    if summary.exists():
        existing=leggi(summary)
        if existing.get('variante')!=variante:raise SystemExit('Chiarimento congelato con una variante diversa: non riusare')
        return existing
    phase=cartella/'phases/01-spec'
    if list(phase.glob('stream-*.jsonl')):
        raise SystemExit('Chiarimento precedente incompleto: conservare/scartare prima della ripresa')
    if not repo.exists():
        banco.clone(baseline(task),repo);setup(repo,'spec_'+task)
        if variante=='V1':
            blocco=(BENCH/'fase-spec/varianti/V1.md').read_text().rstrip()+'\n\n'
            for skills in ('.claude/skills','.agents/skills'):
                skill=repo/skills/'archetipo-spec/SKILL.md';testo=skill.read_text()
                assert '## Output Boundaries' in testo
                skill.write_text(testo.replace('## Output Boundaries',blocco+'## Output Boundaries',1))
        elif variante!='V0':
            raise SystemExit('Variante non prevista dal protocollo congelato: '+variante)
    pre=banco.precondizioni(repo)
    if not all(pre[k] is True for k in ('docs_wiki_presente','skill_archetipo_wiki','wiki_enabled')):raise SystemExit(str(pre))
    # Il prompt contiene la sola richiesta iniziale, senza il perimetro nascosto.
    profile=(BENCH/f'gradiente-difficolta/profili/{task}.md').read_text()
    richiesta=profile.split('Richiesta iniziale')[1].split('«',1)[1].split('»',1)[0]
    prompt='/archetipo-spec '+richiesta
    if task=='T4':
        prompt+='\n\nScrivi una storia di difetto con sintomi, passi di riproduzione del committente e comportamento atteso, senza indicare causa o posizione del difetto.'
    phase.mkdir(parents=True,exist_ok=True);(phase/'prompt.txt').write_text(prompt)
    head_before=banco.git(repo,'rev-parse','HEAD')
    before=banco.spec_codes(repo);results=[];dialog=[];session=None;committente_cost=0;committente_seconds=0
    banco.agent_env=lambda: ambiente_clone(repo)
    banco.CFG.update(models={'opus':'opus','sonnet':'sonnet'},effort='medium',budget_usd_per_phase={'opus':60,'sonnet':25})
    banco.AGENT_SETTINGS={'permissions':{'deny':[f'Read(/{REPO}/**)',f'Edit(/{REPO}/**)','Read(./.env)','Edit(./.env)']}}
    for turno in range(20):
        cumulato=results[-1].get('total_cost_usd',0) if results else 0
        massimo_residuo=60-cumulato
        if costi()['totale_usd']+massimo_residuo>750:raise SystemExit('STOP budget report prima di nuovo turno spec')
        result,init=banco.run_claude(phase,turno,prompt,'opus',repo,resume=session)
        from audit_preparazione import BUILTIN
        estranei=[plugin for plugin in init.get('plugins',[]) if plugin.get('path')!='builtin']
        estranei += [skill for skill in init.get('skills',[]) if not skill.startswith('archetipo') and skill not in BUILTIN]
        if estranei or result.get('subtype')!='success':
            scrivi(phase/'scarto.json',{'motivo':'Contaminazione init o result non success','estranei':estranei,'subtype':result.get('subtype')})
            costi();raise SystemExit('Chiarimento invalido: fermato prima del committente')
        results.append(result);session=result['session_id'];costi()
        testo=result.get('result','');dialog.append(('team',testo))
        codes=sorted(banco.spec_codes(repo)-before)
        if codes:
            nuovi=set(codes)
            items=banco.archetipo(repo,'spec','list')['items']
            codes=[item['code'] for item in items if item['code'] in nuovi]
            if set(codes)!=nuovi:raise SystemExit('Ordine backlog non ricostruibile dal connector')
            break
        conversazione='\n\n'.join(f'[{who}]\n{text}' for who,text in dialog)
        neutral=RADICE/'_committente';neutral.mkdir(exist_ok=True,parents=True)
        if costi()['totale_usd']+2>750:raise SystemExit('STOP budget prima del committente')
        iniziato=time.time()
        risposta=banco.sh(['claude','-p','Rispondi come committente al team nella conversazione seguente. Solo risposta.\n\n'+conversazione,'--model','opus','--effort','medium','--system-prompt',profile,'--tools','','--setting-sources','project,local','--strict-mcp-config','--permission-mode','bypassPermissions','--no-session-persistence','--output-format','stream-json','--verbose','--max-budget-usd','2'],cwd=neutral,env=banco.agent_env())
        file=phase/f'committente-stream-{turno:02d}.jsonl';file.write_text(risposta.stdout)
        _,esito=banco.parse_stream(file)
        # Stesso formato contabile dei precedenti report, anche per risultati in errore.
        with (phase/'committente.jsonl').open('a') as log:log.write(json.dumps(esito,ensure_ascii=False)+'\n')
        costi()
        if esito is None or esito.get('is_error') or esito.get('subtype')!='success':raise SystemExit('STOP committente in errore')
        committente_cost+=esito.get('total_cost_usd',0);committente_seconds+=time.time()-iniziato
        prompt=esito.get('result','');dialog.append(('committente',prompt))
    else:raise SystemExit('Nessuna storia dopo 20 scambi')
    modifiche_codice=banco.git(repo,'diff','--name-only',head_before,'--','src','prisma','tests','docs/wiki','docs/PRD.md').splitlines()
    modifiche_codice+=banco.git(repo,'ls-files','--others','--exclude-standard','--','src','prisma','tests','docs/wiki','docs/PRD.md').splitlines()
    if modifiche_codice:
        scrivi(phase/'scarto.json',{'motivo':'La fase spec ha modificato codice o conoscenza della baseline','file':modifiche_codice,'head_before':head_before})
        raise SystemExit('Chiarimento invalido: baseline modificata prima delle celle; conservare e rifare senza riusare storie')
    (phase/'dialogo.md').write_text('\n\n'.join(f'### {who}\n\n{text}' for who,text in dialog))
    metrics=banco.collect(phase,results,init)
    testi='\n'.join(text for _,text in dialog)
    if banco.WIKI_NON_DISPONIBILE.search(testi):
        scrivi(phase/'scarto.json',{'motivo':'Wiki dichiarata non disponibile'});raise SystemExit('Chiarimento invalido')
    banco.commit_if_dirty(repo,'bench: chiarimento '+task+' Opus '+variante)
    metrics.update(precondizioni=pre,committente_cost_usd=committente_cost,committente_seconds=committente_seconds,skill='archetipo-spec '+variante,phase='01-spec')
    scrivi(phase/'metrics.json',metrics)
    storie=[]
    for code in codes:
        spec=banco.archetipo(repo,'spec','show',code)['spec']
        storie.append(f"# {code} · {spec['title']}\n\n{spec.get('body','')}")
    (cartella/'storie.md').write_text('\n\n---\n\n'.join(storie))
    result={'id':'G-D-'+task,'task':task,'model':'opus','variante':variante,'codes':codes,'head':banco.git(repo,'rev-parse','HEAD'),'metrics':metrics}
    scrivi(summary,result);costi();return result


if __name__=='__main__':print(json.dumps(chiarisci(sys.argv[1]),ensure_ascii=False,indent=2))
