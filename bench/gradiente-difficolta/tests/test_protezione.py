import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import proteggi_fase as protezione


class ProtezioneTest(unittest.TestCase):
    def test_wiki_non_confonde_il_worktree_disabilitato(self):
        self.assertIsNone(protezione.banco.WIKI_NON_DISPONIBILE.search('Faccio il commit del Wiki e porto lo spec a DONE (il worktree è disabilitato).'))
        for frase in ['Wiki non abilitata','La Wiki è disabilitata','wiki.enabled: false','E_PRECONDITION: Wiki non disponibile']:
            with self.subTest(frase=frase):self.assertIsNotNone(protezione.banco.WIKI_NON_DISPONIBILE.search(frase))

    def test_rifiuta_database_fuori_namespace(self):
        ambiente={'DATABASE_URL':'postgresql://localhost/database_reale','E2E_DATABASE_URL':'postgresql://localhost/cpb_grad_test_e2e'}
        with patch.object(protezione,'ambiente_clone',return_value=ambiente):
            with self.assertRaisesRegex(SystemExit,'namespace'):protezione.database_clone(Path('/clone'))

    def test_distingue_una_skill_invocata_da_una_citazione(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)
            evento={'type':'assistant','message':{'content':[{'type':'text','text':'Non usare archetipo-implement'},{'type':'tool_use','name':'Skill','input':{'skill':'archetipo-plan'}}]}}
            (folder/'stream-00.jsonl').write_text(json.dumps(evento)+'\n')
            self.assertEqual(protezione.violazioni_diretto(folder),['archetipo-plan'])

    def test_errore_ferma_la_fase_senza_retry_e_ripristina_il_runner(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)
            with patch.object(protezione,'snapshot',return_value={}),patch.object(protezione.banco,'run_claude',side_effect=SystemExit('errore API')) as originale,patch.object(protezione,'scarta',side_effect=SystemExit('scartata')) as scarta:
                with self.assertRaisesRegex(SystemExit,'scartata'):
                    with protezione.proteggi_fase(folder):protezione.banco.run_claude(folder,0,'prompt','opus',folder)
                self.assertIs(protezione.banco.run_claude,originale)
                self.assertEqual(originale.call_count,1)
                # Il mock non sposta la cartella: può essere richiamato dalla protezione esterna,
                # ma non rilancia mai il processo modello.
                self.assertGreaterEqual(scarta.call_count,1)

    def test_un_result_di_budget_non_success_non_diventa_una_fase_valida(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)
            result={'is_error':False,'subtype':'error_max_budget_usd'}
            with patch.object(protezione,'snapshot',return_value={}),patch.object(protezione.banco,'run_claude',return_value=(result,{'plugins':[],'skills':[]})) as originale,patch.object(protezione,'scarta',side_effect=SystemExit('scartata')):
                with self.assertRaisesRegex(SystemExit,'scartata'):
                    with protezione.proteggi_fase(folder):protezione.banco.run_claude(folder,0,'prompt','opus',folder)
                self.assertEqual(originale.call_count,1)

    def test_diretto_non_puo_cambiare_lo_stato_delle_storie(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)
            result={'is_error':False,'subtype':'success'}
            with patch.object(protezione,'snapshot',return_value={}),patch.object(protezione.banco,'run_claude',return_value=(result,{'plugins':[],'skills':[]})),patch.object(protezione.banco,'spec_status',side_effect=['TODO','DONE']),patch.object(protezione,'scarta',side_effect=SystemExit('stato modificato')):
                with self.assertRaisesRegex(SystemExit,'stato modificato'):
                    with protezione.proteggi_fase(folder,diretto=True,codes=['US-060']):protezione.banco.run_claude(folder,0,'prompt','sonnet',folder)


if __name__=='__main__':unittest.main()
