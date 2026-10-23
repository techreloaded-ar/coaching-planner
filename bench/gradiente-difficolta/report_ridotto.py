#!/usr/bin/env python3
"""Report dello studio ridotto. Nessuna inferenza H3 integrale con due compiti e un modello."""
import json
import re
import statistics
import sys
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

BENCH=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BENCH))
from common import html as h

RADICE=BENCH.parent.parent/'coaching-planner-bench-runs/gradiente-difficolta'
FOLDER=BENCH/'gradiente-difficolta'


def read(path,default=None):
    return json.loads(path.read_text()) if path.exists() else default


def numero(value,decimali=1):
    return '—' if value is None else f'{value:.{decimali}f}'


def numero_testo(value,decimali=1):
    return numero(value,decimali).replace('.',',')


def testo_errore(value):
    return h.e(re.sub(r'\x1b\[[0-9;]*m','',value))


def table(headers,rows):
    return '<div class="scroll"><table><thead><tr>'+''.join('<th>'+h.e(v)+'</th>' for v in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+str(v)+'</td>' for v in row)+'</tr>' for row in rows)+'</tbody></table></div>'


def result_text(phase):
    results=[]
    for file in sorted(phase.glob('stream-*.jsonl')):
        for line in file.read_text().splitlines():
            try:event=json.loads(line)
            except json.JSONDecodeError:continue
            if event.get('type')=='result':results.append(event.get('result',''))
    return results[-1] if results else ''


def load():
    matrix=read(BENCH/'wiki-benchmark/matrice-gradiente-ridotta.json')
    rows=[]
    for cell in matrix['runs']:
        source=RADICE/'prove'/cell['task']/cell['id']
        run=read(source/'run.json',{})
        def avvio(file):
            valore=read(file.parent/'tentativo.json',{}).get('avvio',0)
            return datetime.fromisoformat(valore).timestamp() if isinstance(valore,str) else valore
        phases=[{**read(file),'cartella':str(file.parent),'riepilogo':result_text(file.parent),'avvio':avvio(file)} for file in sorted((source/'phases').glob('*/metrics.json'),key=avvio)]
        evaluation=read(source/'valutazione/evaluation.json',{})
        invalidazione=read(source/'valutazione/invalidazione-browser.json',{})
        if invalidazione and invalidazione.get('stato')!='corretta':evaluation={}
        tech=read(source/'tecnica.json',{})
        scarti=[]
        for discarded in sorted((RADICE/'_scartati').glob(cell['id']+'--*')):
            sessioni={};durata=0;token_scartati={};componenti_scartati={}
            for stream in discarded.glob('phases/*/stream-*.jsonl'):
                for line in stream.read_text().splitlines():
                    event=json.loads(line)
                    if event.get('type')!='result':continue
                    sid=event.get('session_id',str(stream))
                    sessioni[sid]=max(sessioni.get(sid,0),event.get('total_cost_usd',0) or 0)
                    token_scartati[sid]=max(token_scartati.get(sid,0),sum(usage.get(k,0) or 0 for usage in event.get('modelUsage',{}).values() for k in ['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens']))
                    componenti_scartati[sid]={key:sum(usage.get(raw,0) or 0 for usage in event.get('modelUsage',{}).values()) for key,raw in [('input_uncached','inputTokens'),('cache_read','cacheReadInputTokens'),('cache_creation','cacheCreationInputTokens'),('output','outputTokens')]}
                    durata+=event.get('duration_ms',0)
            scarti.append({**read(discarded/'scarto.json',{}),'cartella':str(discarded),'usd':sum(sessioni.values()),'minuti':durata/60000,'token':sum(token_scartati.values()),'token_dettaglio':{key:sum(v[key] for v in componenti_scartati.values()) for key in ['input_uncached','cache_read','cache_creation','output']}})
        usd=sum(f.get('cost_usd',0) for f in phases)+sum(s['usd'] for s in scarti)
        componenti={key:sum(f.get('tokens',{}).get(key,0) for f in phases)+sum(s['token_dettaglio'][key] for s in scarti) for key in ['input_uncached','cache_read','cache_creation','output']}
        rows.append({**cell,'run':run,'fasi':phases,'valutazione':evaluation,'tecnica':tech,
            'scarti':scarti,'invalidazione_browser':invalidazione,
            'minuti':sum(f.get('duration_ms',0) for f in phases)/60000+sum(s['minuti'] for s in scarti),
            'usd_sviluppo':usd,
            'token':sum(f.get('tokens',{}).get('total',0) for f in phases)+sum(s['token'] for s in scarti),
            'token_dettaglio':componenti,
            'qualita':evaluation.get('totale'),
            'usd_sviluppo_per_punto':usd/evaluation['totale'] if evaluation.get('totale') else None})
    return matrix,rows


def graph(rows,key,title):
    values=[r[key] for r in rows if r.get(key) is not None and r['valutazione']]
    if not values:return '<p>Misure non ancora disponibili.</p>'
    massimo=100 if key=='qualita' else max(values)*1.15 or 1
    colori={'DIR':'#5aa9d6','COM':'#3c9c85'}
    out=f'<svg viewBox="0 0 760 300" role="img" aria-label="{h.e(title)}" style="width:100%;max-width:760px">'
    for i in range(6):
        y=245-i*40;v=massimo*i/5
        out+=f'<line x1="65" y1="{y}" x2="710" y2="{y}" stroke="#dce5e5"/><text x="55" y="{y+4}" text-anchor="end" font-size="12">{v:.0f}</text>'
    for task,x in [('T1',235),('T3',565)]:out+=f'<text x="{x}" y="275" text-anchor="middle" font-size="14">{task}</text>'
    for cell,color in colori.items():
        points=[]
        for task,x in [('T1',235),('T3',565)]:
            vals=[r[key] for r in rows if r['task']==task and r['config']==cell and r['valutazione'] and r.get(key) is not None]
            for index,value in enumerate(vals):
                xx=x+(index-.5)*14+(9 if cell=='COM' else -9);yy=245-200*value/massimo
                out+=f'<circle cx="{xx}" cy="{yy}" r="4" fill="{color}" opacity=".65"><title>{task} {cell}: {value:.2f}</title></circle>'
            if vals:points.append((x,245-200*statistics.median(vals)/massimo))
        tratteggio=' stroke-dasharray="7 5"' if cell=='COM' else ''
        if len(points)==2:out+=f'<polyline points="{" ".join(f"{x},{y}" for x,y in points)}" fill="none" stroke="{color}" stroke-width="3"{tratteggio}/>'
        for x,y in points:out+=f'<circle cx="{x}" cy="{y}" r="{8 if cell=="COM" else 6}" fill="{"none" if cell=="COM" else color}" stroke="{color}" stroke-width="2"/>'
    out+='</svg>'
    return '<h3>'+h.e(title)+'</h3>'+out+h.legenda([('Diretto · Sonnet',colori['DIR']),('Completo · Sonnet · linea tratteggiata',colori['COM'])])


def genera():
    matrix,rows=load();ledger=read(FOLDER/'costi.json',{})
    soglia_rumore=read(FOLDER/'fonte-rumore.json')['soglia_entro_il_rumore']
    complete=[r for r in rows if r['valutazione']]
    done=len(complete)==8
    cells={}
    for task in ['T1','T3']:
        for cell in ['DIR','COM']:
            selected=[r for r in complete if r['task']==task and r['config']==cell]
            cells[task,cell]={'n':len(selected),'q':[r['qualita'] for r in selected],
                'usd':[r['usd_sviluppo'] for r in selected],'minuti':[r['minuti'] for r in selected]}
    delta={task:(statistics.median(cells[task,'COM']['q'])-statistics.median(cells[task,'DIR']['q'])) if cells[task,'COM']['q'] and cells[task,'DIR']['q'] else None for task in ['T1','T3']}
    now=datetime.now(ZoneInfo('Europe/Rome')).isoformat()
    header='<header><div class="tag">Coaching Planner · Gradiente di difficoltà · 8 prove Sonnet</div><h1>L’harness serve quando il compito è difficile?</h1><p>Studio esplorativo ridotto: T1 «Referente del cliente» e T3 «Tariffe con validità nel tempo»; diretto contro plan → implement → review, due repliche per cella. Storie fissate da un chiarimento Opus con archetipo-spec V0.</p></header>'
    emerge=f'<p><strong>{"Il controllo originale del gradiente T1–T4 non è eseguibile nel disegno ridotto." if done else f"Studio in corso: {len(complete)} consegne valutate su 8; nessun esito definitivo."}</strong> H3 integrale resta non verificabile, perché mancano T2, T4 e Opus. I risultati si limitano a Sonnet e ai due compiti eseguiti.</p>'
    emerge+='<div class="tiles">'+h.tile(numero(delta['T3']),'Δ funzionale completo−diretto · T3')+h.tile(numero(delta['T1']),'Δ funzionale completo−diretto · T1')+h.tile(numero(ledger.get('totale_usd'),2),'USD totali, preparazione inclusa')+h.tile(numero(ledger.get('residuo_report_usd'),2),'USD residui sul tetto ridotto')+'</div>'
    emerge+='<p>Una lettura valida dell’oracolo per consegna; min/max descrivono le due repliche di sviluppo, non ripetizioni della misura. La soglia storica 2 SD = 1,550 punti viene dalla sola chiusura mese. Due repliche non dimostrano equivalenza e non permettono conclusioni robuste sul gradiente.</p>'
    if done:
        for task in ['T3','T1']:
            diretto=cells[task,'DIR'];completo=cells[task,'COM']
            costo_relativo=statistics.median(completo['usd'])/statistics.median(diretto['usd']) if statistics.median(diretto['usd']) else None
            tempo_relativo=statistics.median(completo['minuti'])/statistics.median(diretto['minuti']) if statistics.median(diretto['minuti']) else None
            selected=[r for r in complete if r['task']==task]
            lettura_rumore='entro il rumore storico' if abs(delta[task])<soglia_rumore else 'oltre la soglia storica, senza inferenza robusta con n=2'
            commento_scope=' S2 richiede il referente nell’elenco clienti, esplicitamente escluso dalle storie.' if task=='T1' else ''
            comuni=set.intersection(*[{code for code,value in r['valutazione']['controlli'].items() if not value['ok']} for r in selected])
            emerge+=f'<p><strong>{task}.</strong> Diretto {numero_testo(statistics.median(diretto["q"]))}/100 ({numero_testo(min(diretto["q"]))}–{numero_testo(max(diretto["q"]))}); completo {numero_testo(statistics.median(completo["q"]))}/100 ({numero_testo(min(completo["q"]))}–{numero_testo(max(completo["q"]))}). Δ = {numero_testo(delta[task])} punti, {lettura_rumore}; costo mediano del completo {numero_testo(costo_relativo,2)}× e tempo di sviluppo {numero_testo(tempo_relativo,2)}× il diretto. '+('Falliscono in tutte e quattro le consegne: '+h.e(', '.join(sorted(comuni)))+'.' if comuni else 'Nessun controllo fallisce in tutte e quattro le consegne.')+commento_scope+'</p>'
        calo_diretto=statistics.median(cells['T1','DIR']['q'])-statistics.median(cells['T3','DIR']['q'])
        emerge+=f'<p>Fra T1 e T3 la mediana del diretto cala di {numero_testo(calo_diretto)} punti. Questo non soddisfa il controllo preregistrato T1→T4 e risente dei diversi requisiti esclusi dalle storie: il calo non basta ad attribuire gli esiti alla sola difficoltà del codice.</p>'
        t3runs=[r for r in complete if r['task']=='T3']
        n_concorrenza=sum(all(r['valutazione']['controlli'][c]['ok'] for c in ['N1','N2']) for r in t3runs)
        n_migrazione=sum(all(r['valutazione']['controlli'][c]['ok'] for c in ['M1','M2','M3','P1','P2']) for r in t3runs)
        emerge+=f'<p>In T3 superano entrambi i controlli di concorrenza {n_concorrenza}/4 consegne; superano tutti i controlli di migrazione e persistenza {n_migrazione}/4. Il requisito di concorrenza non era chiarito nelle storie: gli esiti descrivono ciò che gli agenti hanno realizzato spontaneamente. C1/C2 e la fixture U2 richiedono cambi tariffa a metà mese, esclusi dalle storie; i loro fallimenti non dimostrano da soli un limite dello sviluppo a valle della spec. Il committente simulato ha accettato questi restringimenti: anche la sua fedeltà al profilo è un limite del chiarimento.</p>'
    summary=[]
    for task in ['T1','T3']:
        for cell in ['DIR','COM']:
            d=cells[task,cell]
            def intervallo(v):return '—' if not v else f'{numero(statistics.median(v))} ({numero(min(v))}–{numero(max(v))})'
            rapporto=statistics.median(d['usd'])/statistics.median(d['q']) if d['q'] and statistics.median(d['q']) else None
            summary.append([task,cell,d['n'],intervallo(d['q']),intervallo(d['minuti']),intervallo(d['usd']),numero(rapporto,3)])
    comparison=table(['Compito','Percorso','n','Funzionale: mediana (min–max)','Minuti sviluppo','USD sviluppo','USD / punto (rapporto mediane)'],summary)
    comparison+='<p>Costi e tempi di sviluppo includono i tentativi scartati della stessa prova, senza sceglierne il risultato. Preparazione, chiarimenti e valutazione sono contabilizzati separatamente, senza addebitarli ripetutamente a ogni replica. I tempi sommano le sessioni CLI; il wall clock complessivo comprende anche setup e diagnosi.</p>'
    consumi=[]
    for task in ['T1','T3']:
        for cell in ['DIR','COM']:
            selected=[r for r in rows if r['task']==task and r['config']==cell]
            consumi.append([task,cell,sum(bool(r['run']) for r in selected),numero(sum(r['minuti'] for r in selected)),numero(sum(r['token'] for r in selected)/1e6,3)]+[numero(sum(r['token_dettaglio'][key] for r in selected)/(1000 if key=='output' else 1e6),3) for key in ['input_uncached','cache_read','cache_creation','output']]+[numero(sum(r['usd_sviluppo'] for r in selected),3)])
    consumi=table(['Compito','Percorso','Consegne','Minuti sviluppo totali','Totale M','Input non cache M','Cache read M','Cache creation M','Output k','USD sviluppo totali'],consumi)
    consumi+='<p>Somme delle repliche, scarti inclusi. Il costo per punto è nella tabella principale come rapporto fra mediane. I costi condivisi di chiarimento e la valutazione esterna restano separati nel consuntivo finale.</p>'
    t3=[]
    for r in complete:
        if r['task']!='T3':continue
        evaluation=r['valutazione']
        t3.append([r['config'],r['replica']]+['pass' if evaluation['controlli'][code]['ok'] else 'fail' for code in ['N1','N2','M1','M2','M3','P1','P2']]+[h.e(', '.join(evaluation['violazioni_critiche']) or 'nessuna osservata')])
    concurrency=table(['Percorso','Replica','N1 offerta','N2 collaboratore','M1 backfill','M2 importi passati','M3 righe invariate','P1 deploy con dati','P2 drift','Violazioni critiche osservate'],t3)
    concurrency+='<p>N1/N2 usano decorrenze al primo del mese per isolare la concorrenza dal vincolo mensile delle storie. La data della singola riga è verificata separatamente da C1/C2/C4. M2 confronta tutti i 31 mesi popolati del dataset prima e dopo migrate deploy: un controllo non eseguibile non dimostra una violazione critica.</p>'
    condivisi=[]
    for task in ['T1','T3']:
        metrics=read(RADICE/f'chiarimenti/{task}/discovery.json')['metrics']
        condivisi.append([task,'Opus',numero(metrics.get('duration_ms',0)/60000),numero(metrics.get('cost_usd'),3),h.barra([('Chiarimento condiviso · archetipo-spec',h.FASI['spec'][2],metrics.get('duration_ms',0)/60000)])])
    overview='<details><summary>Chiarimento condiviso, una volta per compito</summary>'+table(['Compito','Modello','Minuti CLI','USD CLI','Fase'],condivisi)+'<p>Committente simulato e giudici di copertura sono contabilizzati separatamente nel costo dell’esperimento.</p></details>'
    overview+='<label>Compito <select id="task"><option value="">Tutti</option><option>T1</option><option>T3</option></select></label><label>Percorso <select id="arm"><option value="">Tutti</option><option>DIR</option><option>COM</option></select></label><div class="scroll"><table id="runs"><thead><tr><th>Prova</th><th>Stato</th><th>Funzionale</th><th>Minuti sviluppo</th><th>USD sviluppo</th><th>Token totali M</th><th>Fasi</th></tr></thead><tbody>'
    details='';review_rows=[]
    for r in rows:
        failed=[code for code,c in r['valutazione'].get('controlli',{}).items() if not c['ok']]
        phasebars=h.barra([(f['phase'],h.FASI[h.SKILL_FASE.get(f.get('skill'),'valutazione')][2],f.get('duration_ms',0)/60000) for f in r['fasi']])
        overview+=f'<tr data-task="{r["task"]}" data-arm="{r["config"]}"><td><a href="#{r["id"]}">{r["id"]}</a></td><td>{"Valutata" if r["valutazione"] else "Consegnata" if r["run"] else "In corso / da eseguire"}</td><td>{numero(r["qualita"])}</td><td>{numero(r["minuti"])}</td><td>{numero(r["usd_sviluppo"],2)}</td><td>{numero(r["token"]/1e6,3)}</td><td>{phasebars}</td></tr>'
        details+=f'<details id="{r["id"]}"><summary>{r["id"]} · {numero(r["qualita"])}/100 · controlli falliti: {h.e(", ".join(failed) or "nessuno / non valutata")}</summary>'
        details+='<p>Tree hash: <code>'+h.e(r['run'].get('tree_hash','non consegnata'))+'</code></p>'
        if r['invalidazione_browser']:
            correction=r['invalidazione_browser']
            details+='<p class="callout">Lettura browser '+('sostituita dopo diagnosi' if correction.get('stato')=='corretta' else 'invalidata, correzione pendente')+': '+h.e(correction['evidenza'])+' Il tentativo iniziale e l’adattatore originale sono conservati; non concorrono al punteggio finale. Integrazione e gate validi sono riusati, senza chiamate aggiuntive a modelli.</p>'
        details+=table(['Fase','Modello risolto','Minuti','Token M','Turni solo Wiki: token M','Turni misti: token M','USD'],[[h.e(f['phase']),h.e(f.get('model_resolved','')),numero(f.get('duration_ms',0)/60000),numero(f.get('tokens',{}).get('total',0)/1e6,3),numero(f.get('wiki',{}).get('tokens_wiki_only_calls',{}).get('total',0)/1e6,3),numero(f.get('wiki',{}).get('tokens_mixed_calls',{}).get('total',0)/1e6,3),numero(f.get('cost_usd'),3)] for f in r['fasi']])
        if r['scarti']:details+=table(['Tentativo scartato','Motivo','Minuti','Token M','USD'],[[h.e(Path(s['cartella']).name),h.e(s.get('motivo','')),numero(s['minuti']),numero(s['token']/1e6,3),numero(s['usd'],3)] for s in r['scarti']])
        if r['valutazione']:
            details+=table(['Controllo','Esito','Errore'],[[h.e(code),'pass' if c['ok'] else 'fail',testo_errore(c.get('errore',''))] for code,c in r['valutazione']['controlli'].items()])
        for f in r['fasi']:
            details+='<details><summary>'+h.e(f['phase'])+' · riepilogo del worker</summary><pre>'+h.e(f['riepilogo'])+'</pre></details>'
            if f.get('skill')=='archetipo-review':
                text=f['riepilogo'];block=text.split('ARCHETIPO_REVIEW_VERDICT:')[-1] if 'ARCHETIPO_REVIEW_VERDICT:' in text else text[-1500:]
                review_rows.append([r['task'],r['id'],h.e(f['phase']),'<pre>'+h.e(block)+'</pre>'])
        details+='</details>'
    overview+='</tbody></table></div>'
    indicators=read(FOLDER/'indicatori.json',[])
    difficulty=table(['Compito','Eseguito','Moduli','Call site','Migrazione','Concorrenza','File test cambiati / unit baseline falliti','Wiki / file unit'],[[r['task'],'sì' if r['task'] in ['T1','T3'] else 'no',r['numero_moduli'],r['numero_call_site'],r['migrazione'],'sì' if r['concorrenza_richiesta'] else 'no',f"{len(r['test_esistenti_modificati'])} / {r['test_unit_baseline_che_falliscono']}",f"{len(r['wiki_disponibile'])} / {len(r['test_unit_disponibili'])}"] for r in indicators])
    difficulty+='<p>Misure dai riferimenti Opus: directory distinte fino al secondo livello sotto src/prisma/tests; corpi AST di funzioni esistenti cambiati; Wiki per citazioni; file unit per chiamate osservate con profiler Node sulla baseline. L’ordine atteso era T1 &lt; T2 &lt; T3, con T4 di natura diversa. T1 tocca più directory di T2: questi indicatori non impongono un ordinamento. I riferimenti soddisfano i profili completi; le consegne seguono storie più strette, perciò gli indicatori non garantiscono che tutti i requisiti difficili siano stati sottoposti agli agenti. T4 richiedeva di scoprire la posizione; gli altri compiti la ricavano dalle storie.</p>'
    tech_rows=[]
    for r in complete:
        d=r['tecnica'];c=d.get('complessita',{});tipi=d.get('tipi',{})
        ref=next(v for v in indicators if v['task']==r['task']);ref_net=0
        for line in ref['diff_numstat'].splitlines():
            added,removed,path=line.split('\t',2)
            if path.startswith('src/') and added!='-':ref_net+=int(added)-int(removed)
        net=d.get('righe_nette_src');ratio=net/ref_net if ref_net and net is not None else None
        tech_rows.append([r['task'],r['config'],r['replica'],net if net is not None else '—',ref_net,numero(ratio,2),d.get('righe_aggiunte_src','—'),len(c.get('funzioni',[])),c.get('oltre_soglia','—'),c.get('massima','—'),numero(d.get('duplicazione',{}).get('percentuale')),tipi.get('tsc_nuovi','—'),d.get('numero_test',{}).get('test_unit','—'),d.get('numero_test',{}).get('test_e2e','—')])
    tech=table(['Compito','Percorso','Replica','Righe nette src','Riferimento: nette src','Rapporto sul riferimento','Righe aggiunte src','Funzioni toccate','Oltre complessità 10','Complessità massima','Duplicazione %','Nuovi errori tsc','Test unit aggiunti','Test e2e aggiunti'],tech_rows)
    if done:
        selected=[r for r in complete if r['task']=='T3']
        descrizioni=[]
        for arm,label in [('DIR','diretto'),('COM','completo')]:
            values=[r['tecnica'] for r in selected if r['config']==arm]
            descrizioni.append(f"{label}: mediana {numero_testo(statistics.median(v['righe_nette_src'] for v in values))} righe nette src e {numero_testo(statistics.median(v['duplicazione']['percentuale'] for v in values),2)} % di duplicazione")
        tech+='<p>T3, '+h.e('; '.join(descrizioni))+'. Tutte e otto le consegne hanno zero nuovi errori tsc. Queste misure descrivono il diff; la qualità dei test non è verificata con mutation testing nel set ridotto.</p>'
    tech+='<p>Nessun punteggio tecnico /100: mancano deliberatamente mutation testing e giudici del criterio comune. Le misure automatiche usano gli stessi strumenti del criterio §2.2, senza sostituire le componenti omesse con zeri o punteggi inventati. Il conteggio dei test è sintattico sulle righe aggiunte (include le suite describe), distinto dal numero di casi eseguiti dal gate.</p>'
    documenti=[]
    for r in complete:
        categorie=r['tecnica'].get('righe_per_categoria',{})
        def categoria(nome):
            value=categorie.get(nome,{})
            return f"{value.get('file',0)} file · +{value.get('ins',0)} / −{value.get('del',0)} righe"
        documenti.append([r['task'],r['config'],r['replica'],categoria('wiki'),categoria('archetipo')])
    tech+=table(['Compito','Percorso','Replica','Wiki','Piani e stato .archetipo'],documenti)
    tech+='<p>Il percorso completo produce anche manutenzione Wiki e tracciamento dei task; questi artefatti non assegnano punti funzionali. I conteggi partono dalla baseline del compito e includono le storie fissate, comuni ai due percorsi; non sono un giudizio sull’accuratezza dei documenti.</p>'
    failures=[]
    tasks=''
    for task in ['T1','T3','T2','T4']:
        controls=read(FOLDER/f'oracoli/{task}/controlli.json')
        discovery=read(RADICE/f'chiarimenti/{task}/discovery.json')
        coverage=read(RADICE/f'chiarimenti/{task}/copertura.json')
        tasks+=f'<h3>{task}{" · sola preparazione, nessuna prova" if task in ["T2","T4"] else " · eseguito"}</h3><p>Storie: {h.e(", ".join(discovery["codes"]))}. Copertura conservativa del profilo {numero_testo(coverage["punteggio"])} %, accordo letture {numero_testo(coverage["accordo"]*100)} %.</p><details><summary>Richiesta e profilo completo</summary><pre>'+h.e((FOLDER/f'profili/{task}.md').read_text())+'</pre></details><details><summary>Storie approvate, condivise fra celle</summary><pre>'+h.e((RADICE/f'chiarimenti/{task}/storie.md').read_text())+'</pre></details>'
        tasks+=table(['Codice','Area / peso','Livello','Tema','Controllo','Nelle storie'],[[c['codice'],f"{c['area']} / {controls['aree'][c['area']]}",c['livello'],h.e(c['tema']),h.e(c['verifica']),c['nelle_storie']] for c in controls['controlli']])
        if task=='T1':
            tasks+='<p class="callout">Perimetro T1: US-060 esclude esplicitamente il referente nell’elenco clienti; US-061 aggiunge la sola intestazione del report. S2 verifica comunque l’elenco, richiesto dal profilo nascosto. La classificazione congelata «Parziale» non elimina questa esclusione: un fallimento S2 misura anche il tetto delle storie condivise, non soltanto la qualità dell’implementazione.</p>'
        if task=='T3':
            tasks+='<p class="callout">Granularità T3: US-060 e US-062 escludono espressamente «tariffe diverse all’interno dello stesso mese». C1 e C2 richiedono invece un cambio il giorno 15, come il profilo nascosto; anche la fixture browser U2 presuppone quel cambio. La classificazione congelata dei giudici «Esplicito» per il tema data riga non rende esplicita questa granularità: questi controlli misurano anche un limite delle storie, non soltanto dell’implementazione. Un fallimento di setup U2 non dimostra errori JavaScript della pagina. C4 verifica il confine fra dicembre e gennaio, compatibile con le storie. Né storie né oracolo sono corretti dopo i risultati.</p>'
        if task=='T4':
            planted=read(FOLDER/'difetto-T4.json')
            tasks+='<details><summary>Manipolazione T4 preparata e poi esclusa</summary><p>'+h.e(planted['candidato'])+' in '+h.e(', '.join(planted['punti']))+'. Commit <code>'+h.e(planted['commit_difetto'])+'</code>. Due righe da 3 ore producono 0,74 giornate invece di 0,75; i gate della baseline modificata passano. Questa è preparazione, non una prova di correzione riuscita.</p><p>File rimossi:</p><pre>'+h.e('\n'.join(planted['rimossi']))+'</pre><p>'+h.e(planted['limite'])+'</p></details>'
        if task in ['T2','T4']:continue
        for c in controls['controlli']:
            for cell in ['DIR','COM']:
                selected=[r for r in complete if r['task']==task and r['config']==cell]
                n=len(selected);k=sum(not r['valutazione']['controlli'][c['codice']]['ok'] for r in selected)
                failures.append([task,cell,c['codice'],c['nelle_storie'],f'{k}/{n}',('sempre' if k==n else 'mai' if k==0 else 'a volte') if n else 'non valutato'])
    costs=table(['Voce','USD'],[['Spesa precedente alla riduzione, inclusi tutti i compiti preparati',numero(matrix['costo_al_cambio_scope_usd'],2)],['Incremento dopo la riduzione',numero(ledger.get('totale_usd',0)-matrix['costo_al_cambio_scope_usd'],2)],['Totale',numero(ledger.get('totale_usd'),2)],['Tetto autorizzato complessivo',numero(matrix['budget_usd'],2)],['Residuo',numero(ledger.get('residuo_report_usd'),2)]])
    ruoli={}
    for session in ledger.get('sessioni',{}).values():
        parts=Path(session['file']).relative_to(RADICE).parts
        role={'riferimenti':'Riferimenti Opus','chiarimenti':'Chiarimenti e committente','copertura':'Giudici delle storie','preparazione':'Oracoli e adattatori di taratura','adattatori':'Adattatori delle consegne','prove':'Sviluppo delle consegne','_scartati':'Sessioni scartate'}.get(parts[0],parts[0])
        ruoli[role]=ruoli.get(role,0)+session['usd']
    costs+=table(['Ruolo / artefatti','USD'],[[h.e(k),numero(v,3)] for k,v in sorted(ruoli.items())])
    tempi=[]
    for task in ['T1','T3']:
        discovery=read(RADICE/f'chiarimenti/{task}/discovery.json')
        metrics=discovery['metrics']
        tempi.append([task,'Condiviso','Chiarimento (una volta)',1,numero(metrics.get('duration_ms',0)/60000),numero(metrics.get('tokens',{}).get('total',0)/1e6,3),numero(metrics.get('cost_usd'),3)])
        customer_file=RADICE/f'chiarimenti/{task}/phases/01-spec/committente.jsonl'
        customer={}
        if customer_file.exists():
            for line in customer_file.read_text().splitlines():
                result=json.loads(line)
                customer[result['session_id']]=result
        tokens_customer=sum(sum(usage.get(k,0) or 0 for k in ['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens']) for result in customer.values() for usage in result.get('modelUsage',{}).values())
        tempi.append([task,'Condiviso','Committente simulato',len(customer),numero(metrics.get('committente_seconds',0)/60),numero(tokens_customer/1e6,3),numero(metrics.get('committente_cost_usd'),3)])
        for cell in ['DIR','COM']:
            selected=[r for r in rows if r['task']==task and r['config']==cell]
            for skill in ['diretto','archetipo-plan','archetipo-implement','archetipo-review']:
                phases=[f for r in selected for f in r['fasi'] if f.get('skill')==skill]
                if not phases:continue
                tempi.append([task,cell,skill,len(phases),numero(sum(f.get('duration_ms',0) for f in phases)/60000),numero(sum(f.get('tokens',{}).get('total',0) for f in phases)/1e6,3),numero(sum(f.get('cost_usd',0) for f in phases),3)])
    costs+=table(['Compito','Percorso','Fase','Sessioni','Minuti','Token M (cache inclusa)','USD'],tempi)
    costs+='<p>Nei dettagli delle fasi, i token dei turni con soli tool Wiki e quelli dei turni misti sono separati. Sono conteggi sui turni, con contesto e cache inclusi: non una misura causale del costo marginale della Wiki, né una ripartizione proporzionale degli USD.</p>'
    costs+=table(['Prova','Rework per storia','Minuti valutazione esterna'],[[r['id'],h.e(', '.join(code+': '+str(outcome['rework_cycles'])+' ('+outcome['status']+')' for code,outcome in r['run'].get('outcomes',{}).items()) or 'non applicabile / non conclusa'),numero(r['valutazione'].get('secondi_valutazione_totali',0)/60) if r['valutazione'] else '—'] for r in rows])
    avvii=[f['avvio'] for r in rows for f in r['fasi'] if f.get('avvio')]
    wall=None
    if avvii:
        fine=max(r['valutazione']['fine'] for r in complete) if done else datetime.now().timestamp()
        wall=(fine-min(avvii))/3600
        costs+=f'<p>Wall clock {"dalla prima fase all’ultima valutazione valida" if done else "finora dalla prima fase"}: <strong>{numero_testo(wall,2)} ore</strong>, inclusi setup, diagnosi e correzioni del banco. Le sessioni di sviluppo sommano {numero_testo(sum(r["minuti"] for r in rows)/60,2)} ore. La preparazione precedente al set ridotto è separata da questi tempi.</p>'
    costs+='<details><summary>Ledger completo delle sessioni, compresi scarti e adattatori</summary><pre>'+h.e(json.dumps(ledger,ensure_ascii=False,indent=2))+'</pre></details>'
    metodo='<p>Criteri funzionali comuni: <a href="../../index.html#criterio-funzionale">§2.1 dell’indice</a>, con gli oracoli specifici già congelati. Baseline '+h.e(matrix['baseline_sha'])+'. Server UTC, Chromium 1440/390, Europe/Rome it-IT. Modelli risolti conservati per fase. Ordine: sottoinsieme della matrice randomizzata originale, seme '+str(matrix['seme'])+'.</p><p>Emendamento umano del 23 ottobre prima delle prove: 8 consegne, massimo 80 USD aggiuntivi, una lettura, un rework per storia, tecnico automatico. Profili, storie e oracoli conservati. Nessuna correzione del codice consegnato da parte del banco; gli adattatori collegano interfacce, senza implementare capacità mancanti.</p>'
    metodo+='<p>Tracciabilità: <a href="../../gradiente-difficolta/audit-ridotto.json">audit delle sessioni e delle consegne</a>, <a href="../../gradiente-difficolta/audit-storie.json">storie immutate</a>, <a href="../../gradiente-difficolta/audit-adattatori.json">audit uniforme degli adattatori</a>, <a href="../../gradiente-difficolta/correzioni-adattatori.json">correzioni delle letture</a> e <a href="../../wiki-benchmark/CORREZIONI.md">registro completo del banco</a>.</p>'
    limiti='<p>Due repliche per cella, un modello, una funzionalità per estremo: confronto esplorativo, nessuna conferma o confutazione di H3 integrale. Il controllo originale T1→T4 non è disponibile. Storie da un solo chiarimento Opus V0; omissioni conservate, compresa la concorrenza T3 non chiarita, il vincolo mensile in contrasto con C1/C2 e l’esclusione dell’elenco T1 in contrasto con S2. Il committente simulato ha inoltre approvato l’esclusione dell’elenco T1 e accettato la proposta mensile T3, divergendo dal profilo nascosto: il tetto dipende anche dalla fedeltà della simulazione, non soltanto dalla skill spec (vedi <a href="../../gradiente-difficolta/diagnosi-chiarimenti.json">dialoghi e diagnosi</a>). Numero di storie diverso: T1 due, T3 quattro; aumenta anche il numero di fasi del completo.</p><p>Una sola lettura non misura la stabilità dell’oracolo. S3 T1 verifica il testo della scheda intera; l’ispezione del markup delle quattro consegne conferma che i campi sono fuori dal dettaglio collassabile, senza cambiare quel controllo. Rumore storico da un solo altro compito. I riferimenti e gli adattatori Opus possono favorire certe forme di soluzione. Il riferimento T3 ha mostrato errori dei gate UTC su percorsi preesistenti; una flakiness di gestione utenti è stata riprodotta sulla baseline. I tentativi e i trace restano conservati: non si ripete fino a ottenere il punteggio migliore. La baseline ha inoltre tre errori Wiki bootstrap preesistenti: il percorso completo può spendere rework per regolarizzarla, quindi il suo overhead non è attribuibile soltanto alla difficoltà della funzionalità.</p><p>Prima della prima valutazione sono state corrette le sole date delle fixture di concorrenza, per evitare di confonderla con la granularità mensile. Il medesimo oracolo corretto vale per tutte le consegne T3. Una review è stata scartata per un falso positivo del banco su «worktree disabilitato» e ripetuta da checkpoint con sessione nuova; il relativo costo è incluso. Correzioni e tentativi restano nel registro.</p><p>T2/T4 esclusi dopo la preparazione; il loro costo resta incluso. T4 era una manipolazione artificiale di codice, Wiki e test e non fornisce risultati sperimentali in questo studio ridotto.</p>'
    reviews=table(['Compito','Prova','Fase','Verdetto e motivazione del worker'],review_rows) if review_rows else '<p>Nessuna review completata.</p>'
    osservazioni=read(FOLDER/'osservazioni-review.json',[])
    if osservazioni:
        observed=[]
        for o in osservazioni:
            files=o.get('file_rework',o.get('file_review',[]))
            app='sì' if o.get('codice_applicativo_cambiato') else 'no' if 'codice_applicativo_cambiato' in o else 'non applicabile'
            tests='sì' if any(f.startswith('tests/') for f in files) else 'no' if files else 'non applicabile'
            evidence=h.e(o['evidenza']+'; '+o['verifica_oracolo'])
            if files:evidence+='<details><summary>File cambiati nella review o nel rework</summary><pre>'+h.e('\n'.join(files))+'</pre></details>'
            observed.append([h.e(o['prova']+' / '+o['fase']),h.e(o['problema']),app,tests,evidence])
        reviews+=table(['Prova / fase','Problema osservato','Codice applicativo cambiato','Test cambiati','Evidenza'],observed)
    if done:
        outcomes=[outcome for row in rows for outcome in row['run'].get('outcomes',{}).values()]
        reviews+=f'<p>Esiti del processo completo: {sum(o["status"]=="DONE" for o in outcomes)} storie DONE e {sum(o["status"]=="REVIEW" for o in outcomes)} in REVIEW, su {len(outcomes)}. Le due US-060 delle repliche r2 (T1 e T3) restano in REVIEW per problemi Wiki o di evidenza; il codice consegnato viene comunque valutato dall’oracolo, secondo il limite di rework fissato.</p>'
    reviews+='<p>Le review non hanno seguito sempre le istruzioni di acceptance (vedi <a href="../../gradiente-difficolta/audit-review.json">tool call e verdetti</a>): alcune omettono il CI impact assessment richiesto, la demo o la lettura semantica delle pagine Wiki. La stessa precondizione Wiki riceve esiti diversi fra worker (rework, LEFT_IN_REVIEW, oppure accettazione). Queste difformità fanno parte del percorso osservato e limitano le conclusioni sull’efficacia di una review eseguita integralmente.</p>'
    reviews+='<p>I verdetti del processo sono distinti dagli esiti dell’oracolo esterno. I riepiloghi completi e i controlli falliti di ogni consegna sono nei dettagli delle fasi; non si attribuisce automaticamente alla review il merito di un controllo superato.</p>'
    metodo+='<p>Le prime letture browser T3 COM r2 e DIR r1 sono state invalidate per attese degli adattatori sull’alert generico già presente in Next. Dopo diagnosi si attendono rispettivamente la nuova riga tariffa e i redirect dei form; il criterio è stato controllato anche negli altri adattatori, inclusi quelli con test passati. Una sostituzione su DB fresco, nessuna selezione del punteggio migliore e nessuna modifica a codice, assert o pesi; il tentativo iniziale è archiviato. Le correzioni del banco e i loro tempi restano nel consuntivo.</p>'
    body=header+h.sezione('Cosa emerge',emerge)+h.sezione('Overview delle run',overview)+h.sezione('Il confronto ridotto',comparison+difficulty+graph(rows,'qualita','Qualità funzionale')+graph(rows,'usd_sviluppo','USD di sviluppo'))+h.sezione('T3: concorrenza e migrazione',concurrency)+h.sezione('Metriche tecniche automatiche',tech)+h.sezione('Quanti token e quanto costo',consumi)+h.sezione('Quali controlli falliscono',table(['Compito','Percorso','Controllo','Nelle storie','Fallimenti','Classe'],failures))+h.sezione('Quale lavoro ha intercettato problemi',reviews)+h.sezione('Tempi e consumi per skill e per singola fase',details)+h.sezione('Compiti eseguiti e preparazione esclusa',tasks)+h.sezione('Come interpretare i risultati',metodo)+h.sezione('Limiti',limiti)+h.sezione('Costo dell’esperimento',costs)
    script='<script>for(const id of ["task","arm"])document.getElementById(id).addEventListener("change",()=>{const t=document.getElementById("task").value,a=document.getElementById("arm").value;document.querySelectorAll("#runs tbody tr").forEach(r=>r.hidden=!!((t&&r.dataset.task!==t)||(a&&r.dataset.arm!==a)));});</script>'
    dest=BENCH/'reports/gradiente-difficolta';dest.mkdir(parents=True,exist_ok=True)
    documento=h.pagina('Gradiente di difficoltà · Studio ridotto',body,'Generato da bench/gradiente-difficolta/report_ridotto.py · '+now+' · <a href="../../index.html">Indice del banco</a>')
    # Hash e riepiloghi grezzi devono restare leggibili anche a 390 px.
    documento=documento.replace('</head>','<style>p,summary,footer{overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;padding:0 16px 16px;max-width:100%}</style></head>')
    (dest/'report.html').write_text(documento.replace('</body>',script+'</body>'))
    data={'aggiornato':now,'protocollo':matrix,'prove':rows,'delta_funzionale':delta,'completate':len(complete),'costi':ledger,'ore_wall_clock':wall,'H3':'non verificabile integralmente nel disegno ridotto'}
    (dest/'dati.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(dest/'report.html')


if __name__=='__main__':genera()
