#!/usr/bin/env python3
"""Controllo sintetico del gate T4: nessuna soluzione di riferimento utilizzata."""
import importlib.util
import subprocess
from prepara import BENCH, RADICE, banco, baseline, setup, ambiente_clone, scrivi, leggi

SCRIPT=BENCH/'gradiente-difficolta/oracoli/T4/gate_test_regressione.py'
spec=importlib.util.spec_from_file_location('gate_t4',SCRIPT)
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
TEST='''import { expect, test } from "vitest";
import { calcolaRiepilogoMese, calcolaAvanzamentoOfferte } from "@/domain/consuntivi";
test("taratura indipendente riepilogo 3+3", () => {
 const riga = {offertaId:"o",offertaCodice:"O",offertaDescrizione:"O",clienteRagioneSociale:"C",ore:3,fatturabile:true,rimborsoTrasfertaImporto:null};
 expect(calcolaRiepilogoMese([riga,riga],400).totali.giornateFatturabili).toBe(0.75);
});
test("taratura indipendente avanzamento 3+3", () => {
 const offerta = {offertaId:"o",offertaCodice:"O",offertaDescrizione:"O",clienteId:"c",clienteRagioneSociale:"C",giorniPrevisti:10};
 const riga = {offertaId:"o",collaboratoreId:"u",collaboratoreNome:"U",ore:3,fatturabile:true,mese:"2026-03"};
 expect(calcolaAvanzamentoOfferte([offerta],[riga,riga]).perOfferta[0].giornateErogate).toBe(0.75);
});
'''


def main():
    directory=RADICE/'preparazione/taratura/gate-regressione'
    if (directory/'esiti.json').exists():return
    repo=directory/'repo'
    if not repo.exists():
        banco.clone(baseline('T4'),repo);setup(repo,'tara_regressione',migrate=False)
    base=banco.git(baseline('T4'),'rev-parse','HEAD')
    env={**ambiente_clone(repo),'NODE_ENV':'test'}
    esiti={}
    for nome in ['negativo','positivo']:
        if nome=='positivo' and not (repo/'tests/unit/taratura-gate.test.ts').exists():
            source=repo/gate.FILE_DOMINIO
            testo,conteggi=gate.neutralizza(source.read_text(),gate.FUNZIONI)
            if not all(conteggi.get(f,0)>0 for f in gate.FUNZIONI):raise SystemExit('Difetto non neutralizzato')
            source.write_text(testo)
            (repo/'tests/unit/taratura-gate.test.ts').write_text(TEST)
            banco.commit_if_dirty(repo,'test: fixture sintetica per taratura del gate esterno')
        out=directory/nome
        sorgente=baseline('T4') if nome=='negativo' else repo
        result=subprocess.run(['python3',str(SCRIPT),'--consegna',str(sorgente),'--base',base,'--uscita',str(out)],env=env,capture_output=True,text=True)
        (directory/f'{nome}.log').write_text(result.stdout+result.stderr)
        if result.returncode:raise SystemExit(f'Gate di taratura in errore: {nome}')
        esiti[nome]=leggi(out/'gate-test-regressione.json')
        for codice in ['G1','G2']:
            if esiti[nome][codice]['ok']!=(nome=='positivo'):raise SystemExit(f'Taratura incoerente {nome}/{codice}')
    scrivi(directory/'esiti.json',{'ok':True,'riferimenti_usati':False,'controlli':esiti})


if __name__=='__main__':main()
