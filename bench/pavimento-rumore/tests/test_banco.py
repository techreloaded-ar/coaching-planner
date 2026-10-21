"""Controlli senza sessioni a pagamento: integrità delle repliche, ripresa e costi."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

BENCH = Path(__file__).resolve().parents[2]
os.environ['BENCH_MATRICE'] = 'matrice-rumore.json'
sys.path.insert(0, str(BENCH / 'wiki-benchmark'))
import run as banco
import valuta as oracolo


class BancoRumoreTest(unittest.TestCase):
    def test_matrice_cinque_repliche_e_primo_secondo_adattatore(self):
        for configurazione in ('DIR', 'COM'):
            for modello in ('sonnet', 'opus'):
                cella = [r for r in banco.CFG['runs'] if (r['config'], r['model']) == (configurazione, modello)]
                self.assertEqual(sorted(r['replica'] for r in cella), [1, 2, 3, 4, 5])
                self.assertEqual([r['secondo_adattatore'] for r in cella], [True, False, False, False, False])

    def test_un_result_in_errore_invalida_tutto_lo_stream(self):
        with tempfile.TemporaryDirectory() as cartella:
            stream = Path(cartella) / 'stream.jsonl'
            stream.write_text('\n'.join(json.dumps(r) for r in [
                {'type': 'result', 'is_error': True, 'duration_ms': 10, 'total_cost_usd': 2},
                {'type': 'result', 'is_error': False, 'duration_ms': 20, 'total_cost_usd': 3}]))
            _, risultato = banco.parse_stream(stream)
            self.assertTrue(risultato['is_error'])
            self.assertEqual(risultato['duration_ms'], 30)
            self.assertEqual(risultato['total_cost_usd'], 3)

    def test_mediana_non_pubblicata_con_una_replica_sola(self):
        with tempfile.TemporaryDirectory() as cartella:
            destinazione = Path(cartella)
            (destinazione / 'evaluation-1.json').write_text(json.dumps({'totale': 90}))
            oracolo.aggiorna_mediana(destinazione)
            self.assertFalse((destinazione / 'evaluation.json').exists())
            for replica, punteggio in [(2, 82), (3, 88)]:
                (destinazione / f'evaluation-{replica}.json').write_text(json.dumps({'totale': punteggio}))
            oracolo.aggiorna_mediana(destinazione)
            risultato = json.loads((destinazione / 'evaluation.json').read_text())
            self.assertEqual(risultato['totale'], 88)
            self.assertEqual(risultato['intervallo'], [82, 90])

    def test_costi_cumulativi_non_sommati_due_volte(self):
        with tempfile.TemporaryDirectory() as cartella, patch.object(banco, 'RUNS', Path(cartella)):
            prova = banco.CFG['runs'][0]['id']
            fase = Path(cartella) / prova / 'phases/01-diretto'
            fase.mkdir(parents=True)
            (fase / 'metrics.json').write_text('{}')
            for numero, costo in [(0, 2), (1, 3)]:
                (fase / f'stream-{numero}.jsonl').write_text(json.dumps({'type': 'result', 'session_id': 'identica', 'total_cost_usd': costo}))
            self.assertEqual(banco.costi_esperimento()['prove'], 3)
            (fase / 'metrics.json').unlink()
            self.assertEqual(banco.costi_esperimento()['turni_persi'], 3)

    def test_replica_salvata_non_rilancia_gate_o_sessione(self):
        with tempfile.TemporaryDirectory() as cartella, patch.object(banco, 'RUNS', Path(cartella)):
            destinazione = Path(cartella) / 'prova/valutazione'
            destinazione.mkdir(parents=True)
            (destinazione / 'evaluation-1.json').write_text(json.dumps({'tree_hash': 'albero', 'totale': 88}))
            with patch.object(oracolo, 'prepara_copia', side_effect=AssertionError('non deve clonare')):
                self.assertEqual(oracolo.valuta('prova', None, 'head', 'albero', 'base', replica=1)['totale'], 88)
                with self.assertRaises(SystemExit):
                    oracolo.valuta('prova', None, 'head', 'altro albero', 'base', replica=1)

    def test_rifiuta_stdin_accodato_al_prompt(self):
        with tempfile.TemporaryDirectory() as cartella:
            fase = Path(cartella)
            (fase / 'transcript').mkdir()
            transcript = fase / 'transcript/sessione.jsonl'
            transcript.write_text(json.dumps({'type': 'user', 'message': {'content': 'prompt congelato\\nscript estraneo'}}))
            with self.assertRaises(SystemExit):
                banco.verifica_prompt_sessione(fase, 'prompt congelato', 'sessione')
            transcript.write_text(json.dumps({'type': 'user', 'message': {'content': 'prompt congelato'}}))
            banco.verifica_prompt_sessione(fase, 'prompt congelato', 'sessione')

    def test_accetta_la_forma_cli_delle_slash_command(self):
        with tempfile.TemporaryDirectory() as cartella:
            fase = Path(cartella)
            (fase / 'transcript').mkdir()
            contenuto = '<command-message>archetipo-plan</command-message>\n<command-name>/archetipo-plan</command-name>\n<command-args>US-060</command-args>'
            (fase / 'transcript/sessione.jsonl').write_text(json.dumps({'type': 'user', 'message': {'content': contenuto}}))
            banco.verifica_prompt_sessione(fase, '/archetipo-plan US-060', 'sessione')

    def test_dominio_non_abilitato_non_invalida_la_wiki(self):
        self.assertIsNone(banco.WIKI_NON_DISPONIBILE.search('offerta non abilitata'))
        self.assertIsNotNone(banco.WIKI_NON_DISPONIBILE.search('Wiki non abilitata'))


if __name__ == '__main__':
    unittest.main()
