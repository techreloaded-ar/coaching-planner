#!/usr/bin/env python3
"""Indicatori ricavati esclusivamente dai diff dei riferimenti completati."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from prepara import BENCH, RADICE, banco, leggi, scrivi

AST = r'''
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ts = require(path.join(process.argv[1], 'node_modules/typescript'));
const text = fs.readFileSync(0, 'utf8');
const source = ts.createSourceFile('file.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = {};
function visit(node) {
 if ((ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isArrowFunction(node)||ts.isMethodDeclaration(node)) && node.body) {
  const name = node.name?.getText(source) || (ts.isVariableDeclaration(node.parent) ? node.parent.name.getText(source) : null);
  if(name) functions[name] = crypto.createHash('sha256').update(node.body.getText(source).replace(/\s+/g,' ')).digest('hex');
 }
 ts.forEachChild(node, visit);
}
visit(source);process.stdout.write(JSON.stringify(functions));
'''


def funzioni(repo, testo):
    return json.loads(subprocess.check_output(['node','-e',AST,str(repo)],input=testo,text=True))


def misura(task):
    info=leggi(BENCH/f'gradiente-difficolta/riferimento-{task}.json')
    repo=Path(info['repo']);base=info['baseline'];head=info['head']
    files=banco.git(repo,'diff','--name-only',base,head).splitlines()
    percorsi=[p for p in files if p.startswith(('src/','tests/','prisma/'))]
    moduli=sorted({'/'.join(p.split('/')[:3]) if len(p.split('/'))>3 else '/'.join(p.split('/')[:-1]) for p in percorsi})
    esistenti=[];nuove=[]
    for path in percorsi:
        if not path.endswith(('.ts','.tsx')) or not (repo/path).exists():continue
        old=banco.sh(['git','show',base+':'+path],cwd=repo,check=False)
        before=funzioni(repo,old.stdout) if old.returncode==0 else {}
        after=funzioni(repo,(repo/path).read_text())
        esistenti.extend({'file':path,'funzione':name} for name,digest in after.items() if name in before and digest!=before[name])
        nuove.extend({'file':path,'funzione':name} for name in after if name not in before)
    test_modificati=[p for p in files if p.startswith('tests/') and banco.sh(['git','cat-file','-e',base+':'+p],cwd=repo,check=False).returncode==0]
    wiki=[];tests=[]
    for path in banco.git(repo,'ls-tree','-r','--name-only',base,'--','docs/wiki','tests/unit').splitlines():
        text=banco.git(repo,'show',base+':'+path)
        if any(p in text for p in percorsi if p.startswith('src/')) or any(f['funzione'] in text for f in esistenti if f['file'].startswith('src/')):
            (wiki if path.startswith('docs/wiki') else tests).append(path)
    sonda_path=BENCH/f'gradiente-difficolta/sonda-test-{task}.json'
    sonda=leggi(sonda_path) if sonda_path.exists() else {}
    if sonda.get('head_riferimento')!=head:sonda={}
    migration='con backfill' if task=='T3' else 'additiva' if task=='T1' else 'nessuna'
    copertura_path=BENCH/'gradiente-difficolta/copertura-unit-baseline.json'
    if copertura_path.exists():
        copertura=leggi(copertura_path)['T4' if task=='T4' else 'main']
        toccate={(f['file'],f['funzione']) for f in esistenti+nuove if f['file'].startswith('src/')}
        tests=[file for file,chiamate in copertura['file_test'].items() if any((f['file'],f['funzione']) in toccate for f in chiamate)]
    return {'task':task,'moduli_toccati':moduli,'numero_moduli':len(moduli),'funzioni_esistenti_modificate':esistenti,'numero_call_site':len([f for f in esistenti if f['file'].startswith('src/')]),'nuove_funzioni':nuove,'migrazione':migration,'concorrenza_richiesta':task=='T3','test_unit_baseline_che_falliscono':sonda.get('test_unit_baseline_falliti'),'test_unit_baseline_totali':sonda.get('test_unit_baseline_totali'),'test_esistenti_modificati':test_modificati,'wiki_disponibile':wiki,'test_unit_disponibili':tests,'informazione_nascosta':'posizione da scoprire' if task=='T4' else 'posizione indicata dalle storie','diff_numstat':banco.git(repo,'diff','--numstat',base,head),'baseline':base,'head':head}


if __name__=='__main__':
    rows=[]
    for task in ('T1','T2','T3','T4'):
        if (BENCH/f'gradiente-difficolta/riferimento-{task}.json').exists():rows.append(misura(task))
    scrivi(BENCH/'gradiente-difficolta/indicatori.json',rows)
    lines=['| Compito | Moduli | Call site esistenti | Migrazione | Concorrenza | File test cambiati; unit baseline che falliscono | Pagine Wiki | File test unit | Informazione |','|---|---:|---:|---|---|---:|---:|---:|---|']
    for r in rows:
        lines.append(f"| {r['task']} | {r['numero_moduli']} | {r['numero_call_site']} | {r['migrazione']} | {'sì' if r['concorrenza_richiesta'] else 'no'} | {len(r['test_esistenti_modificati'])} file; {r['test_unit_baseline_che_falliscono'] if r['test_unit_baseline_che_falliscono'] is not None else 'sonda da eseguire'} unit | {len(r['wiki_disponibile'])} | {len(r['test_unit_disponibili'])} | {r['informazione_nascosta']} |")
    lines.extend(['','Difficoltà attesa: T1 < T2 < T3; T4 è di natura diversa. Il controllo di manipolazione stabilirà se il gradiente ha retto. Wiki: citazioni testuali di moduli/funzioni. File unit: chiamate alle funzioni toccate osservate con Profiler Node, un file Vitest per processo sulla baseline. Call site: funzioni applicative esistenti con corpo AST diverso (spazi normalizzati). Moduli: directory di primo e secondo livello sotto src/, prisma/, tests/.'])
    (BENCH/'gradiente-difficolta/indicatori.md').write_text('\n'.join(lines)+'\n')
    print('\n'.join(lines))
