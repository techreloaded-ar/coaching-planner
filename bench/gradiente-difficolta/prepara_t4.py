#!/usr/bin/env python3
"""Difetto candidato (a): troncamento ai centesimi di giornata per riga in due funzioni."""
import json
import subprocess
import time
from pathlib import Path
from prepara import BENCH, RADICE, banco, baseline, setup, scrivi

repo = baseline('T4')
registro = BENCH / 'gradiente-difficolta/difetto-T4.json'
if registro.exists():
    raise SystemExit('Difetto già preparato; niente nuova mutazione automatica')
base = banco.git(repo, 'rev-parse', 'HEAD')
file = repo / 'src/domain/consuntivi/index.ts'
testo = file.read_text()
inizio = testo.index('export function calcolaRiepilogoMese(')
fine = testo.index('// ── Report fatturazione clienti')
parte = testo[inizio:fine]
parte = parte.replace('const giornateTotali = oreTotali / ORE_PER_GIORNATA;', 'const giornateTotali = righe.reduce(\n    (totale, riga) => totale + Math.floor((riga.ore / ORE_PER_GIORNATA) * 100) / 100, 0,\n  );')
parte = parte.replace('const giornateFatturabili = oreFatturabili / ORE_PER_GIORNATA;', 'const giornateFatturabili = righe.filter((riga) => riga.fatturabile).reduce(\n    (totale, riga) => totale + Math.floor((riga.ore / ORE_PER_GIORNATA) * 100) / 100, 0,\n  );')
for attributo, filtro in [('giornateTotali','riga.offertaId === voce.offertaId'),('giornateFatturabili','riga.offertaId === voce.offertaId && riga.fatturabile')]:
    vecchio = f'{attributo}: voce.'+('oreTotali' if attributo=='giornateTotali' else 'oreFatturabili')+' / ORE_PER_GIORNATA,'
    parte = parte.replace(vecchio, f'{attributo}: righe.filter((riga) => {filtro}).reduce(\n      (totale, riga) => totale + Math.floor((riga.ore / ORE_PER_GIORNATA) * 100) / 100, 0,\n    ),')
testo = testo[:inizio] + parte + testo[fine:]
vecchio = 'const giornateErogate = oreErogate / ORE_PER_GIORNATA;'
assert testo.count(vecchio) == 1
testo = testo.replace(vecchio, 'const giornateErogate = righe\n      .filter((riga) => riga.offertaId === offerta.offertaId && riga.fatturabile)\n      .reduce((totale, riga) => totale + Math.floor((riga.ore / ORE_PER_GIORNATA) * 100) / 100, 0);')
# La variabile serve ancora per altre proiezioni? Se non usata dopo la modifica va rimossa.
testo = testo.replace('    const oreErogate = accumulatoreOfferta?.oreErogateTotali ?? 0;\n', '')
file.write_text(testo)
rimossi = []
for pagina in sorted((repo/'docs/wiki').rglob('*.md')):
    if pagina.name != 'index.md' and any(termine in pagina.read_text() for termine in ('src/domain/consuntivi', 'calcolaRiepilogoMese', 'calcolaAvanzamentoOfferte')):
        rimossi.append(str(pagina.relative_to(repo)))
for test in ('tests/unit/riepilogo-mese.test.ts', 'tests/unit/avanzamento-offerte.test.ts'):
    rimossi.append(test)
for path in rimossi:
    (repo/path).unlink()
banco.commit_if_dirty(repo, 'refactor: estrazione del calcolo delle giornate')
head = banco.git(repo, 'rev-parse', 'HEAD')
scrivi(registro, {'baseline_pre_difetto':base,'commit_difetto':head,'candidato':'a: troncamento per riga ai centesimi di giornata','punti':['calcolaRiepilogoMese','calcolaAvanzamentoOfferte'],'rimossi':rimossi,'esempio':{'ore':[3,3],'giornate_corrette':0.75,'giornate_errate':0.74,'tariffa':400,'imponibile_corretto':300,'imponibile_errato':296},'gate':'da verificare','limite':'Manipolazione artificiale; T4 non è codice legacy reale.'})
(BENCH/'gradiente-difficolta/difetto-T4.patch').write_text(banco.sh(['git','diff','--binary',base,head],cwd=repo).stdout)
env=setup(repo,'baseline_T4')
logs=RADICE/'baseline/T4/gate';logs.mkdir(parents=True,exist_ok=True)
esiti={}
for nome,comando in [('lint',['npm','run','lint']),('unit',['npm','test']),('build',['npm','run','build']),('e2e',['npx','playwright','test','--reporter=line'])]:
    started=time.time()
    print('T4 gate: '+nome,flush=True)
    with (logs/(nome+'.log')).open('w') as out:
        result=subprocess.run(comando,cwd=repo,env={**banco.agent_env(),**env,'PLAYWRIGHT_WEB_SERVER_COMMAND':'npm run start'},stdout=out,stderr=subprocess.STDOUT)
    esiti[nome]={'ok':result.returncode==0,'exit_code':result.returncode,'secondi':time.time()-started,'log':str(logs/(nome+'.log'))}
    scrivi(logs/'esiti.json',esiti)
    print(esiti[nome],flush=True)
    if result.returncode: break
info=json.loads(registro.read_text());info['gate']=esiti;scrivi(registro,info)
