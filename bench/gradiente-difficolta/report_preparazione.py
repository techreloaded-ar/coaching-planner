#!/usr/bin/env python3
"""Pagina di preparazione verificabile; non è il report dei risultati."""
import json
import sys
from pathlib import Path

BENCH=Path(__file__).resolve().parents[1]
RADICE=BENCH.parent.parent/'coaching-planner-bench-runs/gradiente-difficolta'
sys.path.insert(0,str(BENCH))
from common import html as h


def leggi(path,default=None):
    return json.loads(path.read_text()) if path.exists() else default


def genera():
    folder=BENCH/'gradiente-difficolta'
    matrix=leggi(BENCH/'wiki-benchmark/matrice-gradiente.json')
    manifest=leggi(BENCH/'manifest.json')
    record=next(r for r in manifest['report'] if r['numero']==3)
    hypothesis=record['ipotesi'];noise=matrix['pavimento_rumore']
    rows=leggi(folder/'indicatori.json',[])
    header='<header><div class="tag">Coaching Planner · Gradiente di difficoltà · Preparazione</div><h1>L’harness serve quando il compito è difficile?</h1><p>Protocollo preregistrato. Questa pagina mostra gli artefatti di preparazione; le 40 prove richiedono conferma umana e non hanno ancora risultati.</p></header>'
    metodo=''.join(f'<p><strong>{label}</strong> {h.e(hypothesis[key])}</p>' for label,key in [('Ipotesi','testo'),('Metrica','metrica'),('Soglie','soglia')])
    metodo+=f'<p>Baseline main: <code>{h.e(matrix["baseline_sha"])}</code>. Variante spec baseline V0 (nessuna adozione di V1 registrata). Server TZ=UTC come in CI; browser Europe/Rome e it-IT. Criteri: <a href="../../index.html#criteri">§2 dell’indice</a>. SD pooled {noise["sd_pooled"]:.6f}; soglia 2 SD {noise["soglia_due_sd"]:.6f}, misurate soltanto sulla chiusura mese.</p>'
    indicators='<p>Indicatori misurati dai quattro riferimenti completati, secondo le definizioni del protocollo.</p><div class="scroll"><table><thead><tr><th>Compito</th><th>Moduli</th><th>Call site</th><th>Migrazione</th><th>Concorrenza</th><th>File test modificati; unit baseline che falliscono</th><th>Pagine Wiki</th><th>File unit disponibili</th><th>Informazione</th></tr></thead><tbody>'
    for r in rows:
        values=[r['task'],r['numero_moduli'],r['numero_call_site'],r['migrazione'],'sì' if r['concorrenza_richiesta'] else 'no',str(len(r['test_esistenti_modificati']))+' file; '+str(r.get('test_unit_baseline_che_falliscono','da misurare'))+' unit',len(r['wiki_disponibile']),len(r['test_unit_disponibili']),r['informazione_nascosta']]
        indicators+='<tr>'+''.join('<td>'+h.e(v)+'</td>' for v in values)+'</tr>'
    indicators+='</tbody></table></div><p>Difficoltà attesa T1 &lt; T2 &lt; T3; T4 è di natura diversa. Il controllo di manipolazione dovrà verificare l’ordinamento sui risultati. T1 tocca più directory di T2: gli indicatori descrivono queste soluzioni, senza imporre il gradiente atteso. Le pagine Wiki sono contate per citazioni testuali; i file unit sono contati tramite chiamate osservate alle funzioni toccate, con il profiler Node sulla baseline.</p>'
    chiarimenti='<p>Un solo chiarimento Opus per compito, committente Opus separato, variante V0. Storie identiche fra tutte le celle del compito; nessuna correzione dal profilo. Il numero di storie varia fra compiti (T1: 2, T2: 3, T3: 4, T4: 1), con effetto sul numero di fasi del percorso completo e quindi sul costo.</p>'
    tasks=''
    for task in ('T1','T2','T3','T4'):
        data=leggi(folder/f'oracoli/{task}/controlli.json')
        tasks+=f'<h3>{task}</h3><details><summary>Profilo nascosto completo (non accessibile ai worker sperimentali)</summary><pre>{h.e((folder/f"profili/{task}.md").read_text())}</pre></details>'
        tasks+='<div class="scroll"><table><thead><tr><th>Codice</th><th>Area (peso)</th><th>Livello</th><th>Tema</th><th>Controllo</th><th>Nelle storie</th></tr></thead><tbody>'
        for c in data['controlli']:
            values=[c['codice'],f"{c['area']} ({data['aree'][c['area']]})",c['livello'],c['tema'],c['verifica'],c['nelle_storie'] or 'Da valutare dopo il chiarimento']
            tasks+='<tr>'+''.join('<td>'+h.e(v)+'</td>' for v in values)+'</tr>'
        tasks+='</tbody></table></div><p>Regressioni: 8 punti, gate CI tutto-o-niente.</p>'
        source=RADICE/f'chiarimenti/{task}'
        discovery=leggi(source/'discovery.json',{})
        copertura=leggi(source/'copertura.json',{})
        chiarimenti+=f'<h3>{task}</h3><p>Storie: {h.e(", ".join(discovery.get("codes",[])) or "in preparazione")}. Copertura del profilo: {h.e(str(round(copertura["punteggio"],1))+"/100" if copertura else "da giudicare")}. Accordo fra letture: {h.e(str(round(100*copertura["accordo"],1))+" %" if copertura else "da giudicare")}.</p>'
        if (source/'storie.md').exists():chiarimenti+='<details><summary>Storie approvate e congelate</summary><pre>'+h.e((source/'storie.md').read_text())+'</pre></details>'
    defect=leggi(folder/'difetto-T4.json',{})
    t4=f'<p>Commit difetto: <code>{h.e(defect.get("commit_difetto","non disponibile"))}</code>. '+h.e(defect.get('candidato',''))+'</p><p>Baseline difettosa: lint, 698 unit test, build e 184 e2e passati. Due righe da 3 ore mostrano 0,74 giornate invece di 0,75 in due punti. Report fatturazione invariato.</p><details><summary>Pagine Wiki e test rimossi</summary><ul>'+''.join('<li><code>'+h.e(p)+'</code></li>' for p in defect.get('rimossi',[]))+'</ul></details>'
    ledger=leggi(folder/'costi.json',{})
    budget=f'<p>Spesa totale {ledger.get("totale_usd",0):.2f} USD su 750; preparazione {ledger.get("preparazione_usd",0):.2f} USD su 120; residuo report {ledger.get("residuo_report_usd",750):.2f} USD. Inclusi scarti, correzioni e giudici. Sessioni senza costo attestato: {len(ledger.get("sessioni_costo_non_attestato",{}))}.</p><details><summary>Ledger completo</summary><pre>'+h.e(json.dumps(ledger,ensure_ascii=False,indent=2))+'</pre></details>'
    calibrazione=leggi(folder/'calibrazione.json',{})
    verifiche='<p>Preparazione attestata: '+('sì' if calibrazione.get('ok') else 'in corso')+'. Oracoli indipendenti: 24/24/24/25 controlli; verifiche runtime solo sulle baseline. Adattatori dei riferimenti: solo collegamenti e typecheck, nessuna esecuzione. T4: dieci fallimenti attesi sulla baseline difettosa, venti pass sulla baseline sana; gate di regressione provato con controllo positivo e negativo sintetici.</p><p>Limite: il riferimento T3 aveva tre suite e2e verdi nel fuso locale; i due tentativi aggiuntivi UTC hanno mostrato errori intermittenti su percorsi preesistenti. Tutti i log e trace sono conservati. Nessun test applicativo modificato per ottenere il verde.</p><p>Ulteriori limiti preregistrati: una funzionalità per livello; un solo chiarimento condiviso per compito; T4 è una manipolazione di documentazione e test, non un caso legacy reale; riferimenti e adattatori scritti da Opus con possibile bias; due repliche Opus danno una potenza indicativa del 22 % per rilevare 2 SD, senza aumento delle repliche.</p>'
    body=header+h.sezione('Ipotesi e soglie',metodo)+h.sezione('Indicatori di difficoltà',indicators)+h.sezione('Verifiche e limiti della preparazione',verifiche)+h.sezione('Chiarimenti condivisi',chiarimenti)+h.sezione('I quattro oracoli',tasks)+h.sezione('Manipolazione T4',t4)+h.sezione('Contabilità',budget)
    dest=BENCH/'reports/gradiente-difficolta/preparazione.html';dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(h.pagina('Report 3 · Preparazione',body,'Generato da bench/gradiente-difficolta/report_preparazione.py · <a href="../../index.html">Indice del banco</a>'))
    print(dest)


if __name__=='__main__':genera()
