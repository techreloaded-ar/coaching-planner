#!/usr/bin/env python3
"""Report 1: dati misurati, bootstrap appaiato e potenza t non centrale.

python3 bench/pavimento-rumore/report.py [--definitivo]
Richiede scipy (nell'ambiente del banco: 1.17.1); nessuna sessione agente.
La modalità definitiva rifiuta consegne, valutazioni o misure mancanti.
"""
import json
import math
import os
import random
import statistics
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from scipy.optimize import brentq
from scipy.stats import nct, t

BENCH = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BENCH))
from common import html
sys.path.insert(0, str(BENCH / 'wiki-benchmark'))
os.environ.setdefault('BENCH_MATRICE', 'matrice-rumore.json')
import run as banco

OUT = BENCH / 'reports/pavimento-rumore'
NARRATIVA = Path(__file__).parent / 'narrativa.json'
SEME_BOOTSTRAP = 2026102102
ETICHETTE = {'DIR': 'Diretto', 'COM': 'ARchetipo completo'}
METRICHE = {'qualita': 'Funzionale /100', 'minuti': 'Minuti attivi', 'usd': 'USD per percorso',
            'token': 'Token totali M', 'righe_nette_src': 'Righe nette src',
            'righe_totali': 'Righe aggiunte totali', 'usd_per_punto': 'USD per punto'}


def leggi(percorso, default=None):
    return json.loads(percorso.read_text()) if percorso.exists() else default


def statistiche(valori):
    valori = [v for v in valori if v is not None]
    return {'n': len(valori), 'mediana': statistics.median(valori) if valori else None,
            'min': min(valori) if valori else None, 'max': max(valori) if valori else None,
            'sd': statistics.stdev(valori) if len(valori) > 1 else None}


def pooled(celle):
    gruppi = [c for c in celle if len(c) > 1]
    gradi = sum(len(c) - 1 for c in gruppi)
    return math.sqrt(sum((len(c) - 1) * statistics.variance(c) for c in gruppi) / gradi) if gradi else None


def potenza_t(delta, deviazione, repliche, alfa=.05):
    gradi = 2 * repliche - 2
    soglia = t.ppf(1 - alfa / 2, gradi)
    non_centralita = delta / (deviazione * math.sqrt(2 / repliche))
    return float(nct.cdf(-soglia, gradi, non_centralita) + nct.sf(soglia, gradi, non_centralita))


def potenza(deviazione):
    if deviazione is None or deviazione == 0:
        return {'mde': None, 'repliche_per_effetto': None,
                'nota': 'SD non stimabile o nulla nel campione: nessuna stima affidabile della potenza.'}
    mde = brentq(lambda effetto: potenza_t(effetto, deviazione, 5) - .8, 0, deviazione * 20)
    repliche = {}
    for effetto in (2, 5, 10):
        numero = 2
        while potenza_t(effetto, deviazione, numero) < .8 and numero < 100000:
            numero += 1
        repliche[str(effetto)] = numero if numero < 100000 else None
    return {'mde': mde, 'repliche_per_effetto': repliche, 'alfa': .05, 'potenza': .8,
            'metodo': 'Test t bilaterale a due gruppi indipendenti di pari numerosità e varianza comune; potenza con t non centrale, df=2n−2. Stima condizionata alla SD pooled osservata.'}


def bootstrap_appaiato(gruppi, soglia):
    if not gruppi or any(len(gruppo) < 2 for gruppo in gruppi):
        return None
    casuale = random.Random(SEME_BOOTSTRAP)
    differenze = [v for gruppo in gruppi for v in gruppo]
    simulazioni = sorted(statistics.mean(v for gruppo in gruppi for v in casuale.choices(gruppo, k=len(gruppo)))
                         for _ in range(10000))
    delta = statistics.mean(differenze)
    intervallo = [simulazioni[249], simulazioni[9749]]
    return {'delta': delta, 'ic95': intervallo, 'coppie': len(differenze),
            'osservata': intervallo[0] > 0 or intervallo[1] < 0,
            'entro_il_rumore': abs(delta) < soglia if soglia is not None else None,
            'differenze_appaiate': differenze}


def consegna(prova):
    directory = banco.RUNS / prova['id']
    run = leggi(directory / 'run.json')
    letture = [leggi(directory / f'valutazione/evaluation-{i}.json') for i in (1, 2, 3)]
    letture2 = [leggi(directory / f'valutazione/adattatore-2/evaluation-{i}.json') for i in (1, 2, 3)]
    tecnica = leggi(directory / 'tecnica.json', {})
    fasi = [leggi(directory / f'phases/{fase}/metrics.json') for fase in run['phases']] if run else []
    scoperta = leggi(banco.RUNS / f"D-{prova['model']}-wiki/discovery.json", {})
    chiarimento = scoperta.get('metrics')
    percorso = ([chiarimento] if chiarimento else []) + fasi
    letture_valide = all(letture) and run and all(l['tree_hash'] == run['tree_hash'] for l in letture)
    voti = [l['totale'] for l in letture] if letture_valide else []
    qualita = statistics.median(voti) if voti else None
    usd = sum(f['cost_usd'] for f in percorso) if run else None
    controlli = {}
    if letture_valide:
        codici = set.intersection(*(set(l['controlli']) for l in letture))
        controlli = {codice: sum(l['controlli'][codice]['ok'] for l in letture) >= 2 for codice in codici}
    return {**prova, 'consegnata': bool(run), 'tree_hash': run['tree_hash'] if run else None,
            'qualita': qualita, 'valutazioni': voti, 'intervallo': [min(voti), max(voti)] if voti else None,
            'valutazioni_secondo_adattatore': [l['totale'] for l in letture2] if all(letture2) else [],
            'minuti': sum(f['duration_ms'] for f in percorso) / 60000 if run else None,
            'usd': usd, 'usd_sviluppo': sum(f['cost_usd'] for f in fasi) if run else None,
            'token': sum(f.get('tokens', {}).get('total', 0) for f in percorso) / 1e6 if run else None,
            'token_dettaglio': {k: sum(f.get('tokens', {}).get(k, 0) for f in percorso)
                               for k in ('total', 'input_uncached', 'cache_read', 'cache_creation', 'output')},
            'righe_nette_src': tecnica.get('righe_nette_src'), 'righe_totali': tecnica.get('righe_aggiunte_totali'),
            'usd_per_punto': usd / qualita if qualita else None, 'controlli': controlli,
            'fasi': percorso, 'tecnica_presente': bool(tecnica),
            'violazioni_critiche': sorted(set(c for lettura in letture if lettura for c in lettura['violazioni_critiche']))}


def raccogli():
    prove = [consegna(prova) for prova in banco.CFG['runs']]
    celle = []
    for modello in banco.CFG['models']:
        for configurazione in ('DIR', 'COM'):
            gruppo = [p for p in prove if p['model'] == modello and p['config'] == configurazione]
            controlli = {}
            complete = [p for p in gruppo if p['valutazioni']]
            if complete:
                codici = set.intersection(*(set(p['controlli']) for p in complete))
                for codice in sorted(codici):
                    fallimenti = sum(not p['controlli'][codice] for p in complete)
                    controlli[codice] = {'fallimenti': fallimenti, 'consegne': len(complete),
                                        'classe': 'sempre' if fallimenti == len(complete) else 'mai' if fallimenti == 0 else 'a volte'}
            celle.append({'model': modello, 'config': configurazione,
                          'metriche': {metrica: statistiche(p[metrica] for p in gruppo) for metrica in METRICHE},
                          'controlli': controlli})
    complete = all(p['valutazioni'] for p in prove)
    sd = pooled([[p['qualita'] for p in prove if p['model'] == c['model'] and p['config'] == c['config']]
                 for c in celle]) if complete else None
    confronti, differenze = {}, []
    if complete:
        for modello in banco.CFG['models']:
            per_replica = {(p['config'], p['replica']): p for p in prove if p['model'] == modello}
            delta = [per_replica[('COM', replica)]['qualita'] - per_replica[('DIR', replica)]['qualita'] for replica in range(1, 6)]
            differenze.append(delta)
            confronti[modello] = bootstrap_appaiato([delta], 2 * sd)
        confronti['entrambi'] = bootstrap_appaiato(differenze, 2 * sd)
    rumore_stesso = [{'prova': p['id'], 'range': max(p['valutazioni']) - min(p['valutazioni'])} for p in prove if p['valutazioni']]
    rumore_due = [{'prova': p['id'], 'delta': statistics.median(p['valutazioni_secondo_adattatore']) - p['qualita'],
                   'range_secondo': max(p['valutazioni_secondo_adattatore']) - min(p['valutazioni_secondo_adattatore'])}
                  for p in prove if p['valutazioni'] and p['valutazioni_secondo_adattatore']]
    precedenti = []
    for modello in banco.CFG['models']:
        for configurazione in ('C1', 'C2', 'DN'):
            id_ = f'{modello}-{configurazione}'
            lettura = leggi(banco.RUNS / id_ / 'valutazione/evaluation.json')
            if lettura:
                precedenti.append({'id': id_, 'qualita': lettura['totale'], 'falliti': sorted(k for k, c in lettura['controlli'].items() if not c['ok'])})
    return {'aggiornato': datetime.now(ZoneInfo('Europe/Rome')).isoformat(), 'prove': prove, 'celle': celle,
            'completo': complete and all(p['tecnica_presente'] for p in prove) and len(rumore_due) == 4,
            'sd_pooled': sd, 'soglia_entro_il_rumore': 2 * sd if sd is not None else None,
            'potenza': potenza(sd), 'confronti': confronti, 'rumore_stesso_adattatore': rumore_stesso,
            'rumore_due_adattatori': rumore_due, 'costi': banco.costi_esperimento(),
            'prove_precedenti': precedenti, 'seme_bootstrap': SEME_BOOTSTRAP,
            'seme_matrice': banco.CFG['seme'], 'ricampionamenti': 10000}


def fmt(valore, decimali=1):
    return 'n.d.' if valore is None else f'{valore:.{decimali}f}'


def tabella(colonne, righe, id_=None):
    identificatore = f' id="{id_}"' if id_ else ''
    return f'<div class="scroll"><table{identificatore}><thead><tr>' + ''.join(f'<th>{c}</th>' for c in colonne) + '</tr></thead><tbody>' + ''.join(righe) + '</tbody></table></div>'


def riga(valori, attributi=''):
    return f'<tr {attributi}>' + ''.join(f'<td>{v}</td>' for v in valori) + '</tr>'


def flusso(prova):
    return 'archetipo-spec (condiviso) → ' + ('sviluppo diretto' if prova['config'] == 'DIR' else 'archetipo-plan → archetipo-implement → archetipo-review per storia, con eventuale rework')


def barra(prova):
    return html.barra([(f"{fase['phase']} · {fase['skill']}", html.FASI[html.SKILL_FASE[fase['skill']]][2], fase['duration_ms'] / 60000)
                       for fase in prova['fasi']])


def overview(dati):
    righe = []
    for p in dati['prove']:
        diretti = next(c for c in dati['celle'] if c['model'] == p['model'] and c['config'] == 'DIR')['metriche']['minuti']['mediana']
        rapporto = p['minuti'] / diretti if p['minuti'] is not None and diretti else None
        righe.append(riga([f'<a href="#{p["id"]}">{ETICHETTE[p["config"]]}</a><small>{p["id"]}</small>',
                           p['model'].capitalize(), fmt(p['minuti']) + f'<small>{fmt(rapporto)}× diretto</small>',
                           fmt(p['qualita']) + ('<small>' + '–'.join(fmt(v) for v in p['intervallo']) + '</small>' if p['intervallo'] else '<small>in attesa</small>'),
                           fmt(p['token'], 3), f'<span class="skill-flow">{flusso(p)}</span>', barra(p)],
                          f'data-model="{p["model"]}" data-arm="{p["config"]}" data-tokens="{p["token"] or 0}"'))
    return ('<label>Modello<select id="model"><option value="">Entrambi</option><option value="sonnet">Sonnet</option><option value="opus">Opus</option></select></label>'
            '<label>Cella<select id="cella"><option value="">Tutte</option><option value="DIR">Diretto</option><option value="COM">ARchetipo completo</option></select></label>'
            + tabella(['Percorso', 'Modello', 'Prima consegna min', 'Qualità /100', 'Token totali M', 'Skill / processo eseguito', 'Tempo per fase'], righe, 'results')
            + html.legenda_fasi()
            + '<p class="muted">Il chiarimento condiviso già esistente è aggiunto una volta a ciascun percorso, compreso costo e token; il costo dell’esperimento conta soltanto le nuove sessioni. Il diretto termina alla fine di 01-diretto, senza refresh Wiki.</p>')


def riepilogo_celle(dati):
    righe = []
    for c in dati['celle']:
        for metrica, etichetta in METRICHE.items():
            s = c['metriche'][metrica]
            decimali = 3 if metrica in ('token', 'usd_per_punto') else 1
            righe.append(riga([c['model'].capitalize(), ETICHETTE[c['config']], etichetta, s['n'],
                               fmt(s['mediana'], decimali), fmt(s['min'], decimali), fmt(s['max'], decimali), fmt(s['sd'], decimali)]))
    return tabella(['Modello', 'Cella', 'Metrica', 'n', 'Mediana', 'Min', 'Max', 'SD'], righe)


def tabella_controlli(dati):
    righe = []
    for c in dati['celle']:
        righe.append(riga([c['model'].capitalize(), ETICHETTE[c['config']], *[
            ', '.join(f'{k} ({v["fallimenti"]}/{v["consegne"]})' for k, v in c['controlli'].items() if v['classe'] == classe) or '—'
            for classe in ('sempre', 'a volte', 'mai')]]))
    return tabella(['Modello', 'Cella', 'Sempre falliti', 'A volte falliti', 'Mai falliti'], righe) + '<p class="muted">Esito per consegna: maggioranza delle tre letture dello stesso controllo. «Sempre» descrive il campione; da solo non prova che la causa sia nelle storie. Le tre letture restano esposte separatamente.</p>'


def ripetizioni(dati):
    return tabella(['Prova', 'Adattatore 1: tre letture', 'Mediana · min–max', 'Adattatore 2: tre letture', 'Δ mediana 2−1', 'Violazioni critiche in almeno una lettura'], [
        riga([p['id'], ' · '.join(fmt(v) for v in p['valutazioni']) or 'in attesa',
              fmt(p['qualita']) + (' · ' + '–'.join(fmt(v) for v in p['intervallo']) if p['intervallo'] else ''),
              ' · '.join(fmt(v) for v in p['valutazioni_secondo_adattatore']) or ('in attesa' if p['secondo_adattatore'] else 'non prevista'),
              fmt(statistics.median(p['valutazioni_secondo_adattatore']) - p['qualita']) if p['valutazioni_secondo_adattatore'] and p['qualita'] is not None else '—',
              ', '.join(p['violazioni_critiche']) or '—']) for p in dati['prove']])


def risorse(dati):
    return tabella(['Prova', 'Totale M', 'Input non cache M', 'Cache read M', 'Cache creation M', 'Output M', 'USD'], [
        riga([p['id'], *[html.mln(p['token_dettaglio'][k]) for k in ('total', 'input_uncached', 'cache_read', 'cache_creation', 'output')], fmt(p['usd'], 2)]) for p in dati['prove']])


def dettagli(dati):
    result = []
    for p in dati['prove']:
        righe = [riga([f['phase'], f['skill'], fmt(f['duration_ms'] / 60000), html.mln(f.get('tokens', {}).get('total', 0)),
                       html.mln(f.get('tokens', {}).get('input_uncached', 0)), html.mln(f.get('tokens', {}).get('cache_read', 0)),
                       html.mln(f.get('tokens', {}).get('cache_creation', 0)), html.mln(f.get('tokens', {}).get('output', 0)),
                       fmt(f['cost_usd'], 2), f.get('wiki', {}).get('count', 0), f.get('spec_status_after', '—')]) for f in p['fasi']]
        falliti = ', '.join(k for k, ok in p['controlli'].items() if not ok) or ('nessuno' if p['valutazioni'] else 'non ancora valutati')
        riepilogo_skill = {}
        for fase in p['fasi']:
            riepilogo_skill.setdefault(fase['skill'], []).append(fase)
        sintesi = tabella(['Skill', 'Minuti attivi', 'USD', 'Token M'], [riga([skill,
            fmt(sum(f['duration_ms'] for f in fasi) / 60000), fmt(sum(f['cost_usd'] for f in fasi), 2),
            html.mln(sum(f.get('tokens', {}).get('total', 0) for f in fasi))]) for skill, fasi in riepilogo_skill.items()])
        result.append(f'<details id="{p["id"]}"><summary>{p["id"]} · {fmt(p["qualita"])}/100</summary><div class="inside">'
                      + sintesi + tabella(['Fase', 'Skill', 'Min', 'Token M', 'Input M', 'Cache read M', 'Cache creation M', 'Output M', 'USD', 'Wiki', 'Stato spec dopo'], righe)
                      + f'<p>Controlli falliti: {falliti}. Tree hash: <code>{p["tree_hash"] or "in attesa"}</code>.</p></div></details>')
    return ''.join(result)


def inferenza(dati):
    righe = [riga([modello.capitalize(), fmt(c['delta']), f'{fmt(c["ic95"][0])} … {fmt(c["ic95"][1])}', c['coppie'],
                   'sì' if c['osservata'] else 'no', 'entro il rumore' if c['entro_il_rumore'] else 'sopra la soglia'])
             for modello, c in dati['confronti'].items()]
    p = dati['potenza']
    repliche = p.get('repliche_per_effetto') or {}
    return (f'<p>SD pooled: {fmt(dati["sd_pooled"], 3)}; soglia «entro il rumore»: {fmt(dati["soglia_entro_il_rumore"], 3)} punti. '
            f'Differenza minima rilevabile con cinque repliche per cella: {fmt(p["mde"], 3)} punti (α 0.05, potenza 0.8).</p>'
            + tabella(['Modello', 'Δ completo−diretto', 'IC 95 %', 'Coppie', 'IC esclude zero', 'Lettura rispetto al rumore'], righe)
            + '<p>Repliche per cella per rilevare 2 / 5 / 10 punti: ' + ' / '.join(str(repliche.get(str(v), 'n.d.')) for v in (2, 5, 10)) + '.</p>'
            + f'<p class="muted">{html.e(p.get("metodo", p.get("nota", "")))} Bootstrap percentile della differenza media appaiata per replica k, 10 000 ricampionamenti, seme {SEME_BOOTSTRAP}; il confronto combinato ricampiona separatamente entro modello, con pari peso dei due modelli. La soglia 2 SD e l’esclusione dello zero sono criteri distinti.</p>')


def genera(dati):
    narrativa = leggi(NARRATIVA, {})
    c = dati['confronti'].get('entrambi')
    range_oracolo = statistiche(p['range'] for p in dati['rumore_stesso_adattatore'])
    tiles = '<div class="tiles">' + ''.join([
        html.tile(fmt(dati['sd_pooled'], 3), 'SD pooled tra repliche della stessa cella'),
        html.tile(fmt(dati['potenza']['mde']), 'Differenza minima rilevabile, cinque repliche per cella'),
        html.tile(fmt(c['delta']) if c else 'n.d.', 'Δ completo − diretto, IC ' + (' … '.join(fmt(v) for v in c['ic95']) if c else 'in attesa')),
        html.tile(fmt(range_oracolo['max']), 'Massima escursione tra tre letture con lo stesso adattatore')]) + '</div>'
    costi = dati['costi']
    stato = '' if dati['completo'] else '<p class="callout"><strong>Esperimento in corso.</strong> Le righe in attesa non sono osservazioni. H1 non ha ancora un esito definitivo.</p>'
    corpo = (f'<header><div class="tag">Coaching Planner · Report 1 · 20 prove a storie fisse</div><h1>Qual è il pavimento di rumore?</h1>'
             '<p>US-060 e US-061 dai chiarimenti D-sonnet-wiki e D-opus-wiki. Diretto e ARchetipo completo, Sonnet e Opus, cinque repliche per cella; Wiki presente con flag esplicito. Tre letture dell’oracolo e quattro adattatori indipendenti aggiuntivi.</p></header>'
             + html.sezione('Cosa emerge', stato + tiles + narrativa.get('cosa_emerge', ''))
             + html.sezione('Overview delle run', overview(dati))
             + html.sezione('Per cella: mediana, min, max e SD', riepilogo_celle(dati))
             + html.sezione('Differenze appaiate e potenza', inferenza(dati))
             + html.sezione('Controlli sempre / a volte / mai falliti', tabella_controlli(dati))
             + html.sezione('Valutazioni ripetute e rumore dell’oracolo', ripetizioni(dati))
             + html.sezione('Quanti token e quanto costo', risorse(dati))
             + html.sezione('Tempi e consumi per skill e per singola fase', dettagli(dati))
             + html.sezione('Prove precedenti, a titolo di confronto', tabella(['Prova', 'Qualità /100', 'Controlli falliti'], [riga([p['id'], fmt(p['qualita']), ', '.join(p['falliti'])]) for p in dati['prove_precedenti']]) + '<p>Queste prove differiscono per disponibilità o flag Wiki e per refresh del diretto: non entrano nel calcolo del rumore.</p>')
             + html.sezione('Costo dell’esperimento', tabella(['Voce', 'USD'], [riga([html.e(k.replace('_', ' ')), fmt(v, 2)]) for k, v in costi.items()]) + f'<p>Budget residuo: {fmt(350 - costi["totale"], 2)} USD. Costo per consegna verificata: {fmt(costi["totale"] / sum(bool(p["valutazioni"]) for p in dati["prove"]), 2) if any(p["valutazioni"] for p in dati["prove"]) else "n.d."} USD; include le spese del banco già registrate. I costi per punto nella tabella per cella includono il chiarimento condiviso per percorso.</p>')
             + html.sezione('Come è stata verificata la qualità', '<p>Si applicano i <a href="../../index.html#criterio-funzionale">criteri comuni §2.1</a> e le misure tecniche §2.2. Ogni lettura riparte da una copia immutabile con tree hash verificato e database ricreati, ripete gate e oracolo senza sessioni concorrenti. Adattatore Opus conservato; sulla prima prova di ogni cella nell’ordine randomizzato un secondo adattatore usa una nuova sessione e lo stesso prompt, senza vedere il primo. Mediana delle tre letture per il punteggio della consegna. Ordine randomizzato con seme ' + str(dati['seme_matrice']) + ' dopo i due piloti Sonnet, eseguiti prima come previsto dal protocollo. Le precondizioni sono registrate prima di ogni fase e gli scarti conservati.</p>')
             + html.sezione('Limiti', narrativa.get('limiti', '<div class="callout"><p>Cinque repliche per cella danno una stima incerta della varianza; il bootstrap resta descrittivo del campione. Le storie differiscono tra modelli, perciò i confronti sono appaiati entro modello. Il test t per la potenza assume normalità e varianza comune su un punteggio limitato a 100. La ripetizione dell’oracolo include il rumore dei gate; due adattatori su quattro sole consegne non esauriscono la variabilità dei valutatori. I piloti anticipano due prove Sonnet rispetto all’ordine randomizzato.</p></div>'))
             + html.sezione('Come interpretare i risultati e ipotesi H1', narrativa.get('interpretazione', '<p>Esito in attesa del completamento della matrice e delle valutazioni.</p>')))
    footer = f'Generato da bench/pavimento-rumore/report.py · matrice-rumore.json · {html.e(dati["aggiornato"])} · oracolo comune · prove in {html.e(banco.RUNS)} · <a href="../../index.html">Indice dei report</a>'
    pagina = html.pagina('Qual è il pavimento di rumore?', corpo, footer)
    # Un solo listener composto: cambiare un filtro conserva anche l’altro.
    pagina = pagina.replace(html.SCRIPT, html.SCRIPT.replace("var f=document.getElementById('model');if(f){f.addEventListener('change',function(){var v=this.value;document.querySelectorAll('#results tbody tr').forEach(function(r){r.hidden=!!v&&r.dataset.model!==v;});});}",
        "var m=document.getElementById('model'),c=document.getElementById('cella');function filtra(){document.querySelectorAll('#results tbody tr').forEach(function(r){r.hidden=!!((m.value&&r.dataset.model!==m.value)||(c.value&&r.dataset.arm!==c.value));});}m.addEventListener('change',filtra);c.addEventListener('change',filtra);"))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'dati.json').write_text(json.dumps(dati, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'report.html').write_text(pagina)
    print(OUT / 'report.html')


if __name__ == '__main__':
    dati = raccogli()
    if '--definitivo' in sys.argv and not dati['completo']:
        sys.exit('Report incompleto: mancano consegne, letture o misure tecniche.')
    genera(dati)
