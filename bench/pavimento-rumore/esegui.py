#!/usr/bin/env python3
"""Report 1: pilota, valutazioni sequenziali e completamento idempotente.

BENCH_MATRICE=matrice-rumore.json python3 -u bench/pavimento-rumore/esegui.py pilota
BENCH_MATRICE=matrice-rumore.json python3 -u bench/wiki-benchmark/run.py all
BENCH_MATRICE=matrice-rumore.json python3 -u bench/pavimento-rumore/esegui.py finalizza

Il comando all dell'harness richiama valuta dopo ogni consegna, prima della successiva.
Qualunque errore ferma il processo; nessun retry automatico dei result in errore.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

BENCH = Path(__file__).resolve().parent.parent
os.environ.setdefault('BENCH_MATRICE', 'matrice-rumore.json')
sys.path.insert(0, str(BENCH / 'wiki-benchmark'))
import run as banco


def comando(*argomenti):
    subprocess.run([sys.executable, '-u', *map(str, argomenti)], cwd=banco.REPO,
                   stdin=subprocess.DEVNULL, check=True)


def valuta(prova, secondo=False):
    import valuta as oracolo
    dati = json.loads((banco.RUNS / prova / 'run.json').read_text())
    for adattatore in ([2] if secondo else [1]):
        for replica in (1, 2, 3):
            oracolo.valuta(prova, banco.RUNS / prova / 'repo', dati['head'], dati['tree_hash'],
                           dati['discovery_head'], replica=replica, numero_adattatore=adattatore)
    if not secondo:
        comando(BENCH / 'common/tecnica.py', 'misura', prova)
        riepilogo = json.loads((banco.RUNS / prova / 'valutazione/evaluation.json').read_text())
        print(f"CONSEGNA VERIFICATA {prova}: {riepilogo['totale']}/100, "
              f"intervallo {riepilogo['intervallo']}, costi esperimento {banco.costi_esperimento()['totale']:.2f} USD", flush=True)


def proiezione():
    piloti = [next(r for r in banco.CFG['runs'] if r['model'] == 'sonnet' and r['config'] == config)
              for config in ('DIR', 'COM')]
    misure = {r['config']: banco.run_totals(banco.RUNS / r['id']) for r in piloti}
    # Opus: rapporto storico C1/C2, dichiarato come stima e non come misura.
    costo_prove = 5 * (misure['DIR']['usd'] * (1 + 9.2 / 2.2) + misure['COM']['usd'] * (1 + 30.6 / 8.4))
    minuti = 10 * sum(m['minutes'] for m in misure.values())
    risultato = {'piloti': misure, 'costo_prove_stimato_usd': costo_prove,
                 'adattatori_stimati_usd': 24 * .8, 'ore_sviluppo_stimate': minuti / 60,
                 'ore_valutazione_stimate_intervallo': [6, 8], 'costi_registrati': banco.costi_esperimento(),
                 'metodo': 'Sonnet dai piloti; rapporto di costo Opus/Sonnet storico (DIR 9.2/2.2, COM 30.6/8.4); tempo Opus assunto uguale a Sonnet, esclusi reset CLI e misure tecniche.'}
    banco.write_json(BENCH / 'pavimento-rumore/proiezione.json', risultato)
    print(json.dumps(risultato, ensure_ascii=False, indent=2), flush=True)


def processa_rivalutazioni():
    """Correzioni documentate dell'adattatore: ripetizioni solo fra due consegne, in sequenza."""
    percorso = BENCH / 'pavimento-rumore/rivalutazioni-pendenti.json'
    while percorso.exists():
        pendenti = json.loads(percorso.read_text())
        if not pendenti:
            return
        prova = pendenti[0]['prova']
        print(f'RIVALUTAZIONE DOCUMENTATA {prova}: {pendenti[0]["motivo"]}', flush=True)
        valuta(prova)
        # Il sorgente non cambia: conserva i mutanti e aggiorna qualità e gate dalla nuova mediana.
        comando(BENCH / 'common/tecnica.py', 'misura', prova, '--rifai', '--senza-mutanti')
        # Il monitor può aver accodato altre correzioni mentre erano in corso i test.
        aggiornati = json.loads(percorso.read_text())
        banco.write_json(percorso, [voce for voce in aggiornati if voce != pendenti[0]])


def finalizza():
    processa_rivalutazioni()
    mancanti = [r['id'] for r in banco.CFG['runs'] if not (banco.RUNS / r['id'] / 'run.json').exists()]
    if mancanti:
        sys.exit(f'Consegne mancanti: {mancanti}')
    for prova in banco.CFG['runs']:
        if prova['secondo_adattatore']:
            valuta(prova['id'], secondo=True)
    comando(BENCH / 'common/tecnica.py', 'misura', 'all')
    # Una sessione alla volta, con riserva del massimo e controllo del costo prima di ciascuna.
    sys.path.insert(0, str(BENCH))
    from common import tecnica
    for prova in banco.CFG['runs']:
        for lettura in (1, 2):
            banco.riserva_lancio(tecnica.BUDGET_GIUDICE_USD)
            tecnica.giudice(prova['id'], letture=(lettura,))
    comando(BENCH / 'common/tecnica.py', 'punteggi')
    print('Misure e giudici completati: rivedere narrativa report 4 e report 1 prima della pubblicazione.', flush=True)


def main():
    azione = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if azione == 'pilota':
        for configurazione in ('DIR', 'COM'):
            prova = next(r for r in banco.CFG['runs'] if r['config'] == configurazione and r['model'] == 'sonnet')
            comando(BENCH / 'wiki-benchmark/run.py', 'run', prova['id'])
        proiezione()
    elif azione == 'valuta':
        valuta(sys.argv[2])
        processa_rivalutazioni()
    elif azione == 'finalizza':
        finalizza()
    elif azione == 'proiezione':
        proiezione()
    else:
        print(json.dumps(banco.costi_esperimento(), indent=2))


if __name__ == '__main__':
    main()
