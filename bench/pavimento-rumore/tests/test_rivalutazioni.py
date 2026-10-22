import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

PERCORSO = Path(__file__).resolve().parents[1] / 'esegui.py'
spec = importlib.util.spec_from_file_location('esegui_rumore', PERCORSO)
esegui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(esegui)


class RivalutazioniTest(unittest.TestCase):
    def prepara_coda(self, cartella):
        percorso = Path(cartella) / 'pavimento-rumore/rivalutazioni-pendenti.json'
        percorso.parent.mkdir()
        percorso.write_text(json.dumps([{'prova': 'esempio', 'motivo': 'correzione documentata'}]))
        return percorso

    def test_rimuove_solo_dopo_valutazione_e_misura_riuscite(self):
        with tempfile.TemporaryDirectory() as cartella:
            percorso = self.prepara_coda(cartella)
            with patch.object(esegui, 'BENCH', Path(cartella)), patch.object(esegui, 'valuta') as valuta, patch.object(esegui, 'comando') as comando:
                esegui.processa_rivalutazioni()
                valuta.assert_called_once_with('esempio')
                self.assertEqual(comando.call_args.args[-2:], ('--rifai', '--senza-mutanti'))
                self.assertEqual(json.loads(percorso.read_text()), [])
                esegui.processa_rivalutazioni()
                self.assertEqual(valuta.call_count, 1)

    def test_non_perde_voci_accodate_durante_i_test(self):
        with tempfile.TemporaryDirectory() as cartella:
            percorso = self.prepara_coda(cartella)
            def aggiungi(prova):
                if prova == 'esempio':
                    coda = json.loads(percorso.read_text())
                    coda.append({'prova': 'seconda', 'motivo': 'altra correzione'})
                    percorso.write_text(json.dumps(coda))
            with patch.object(esegui, 'BENCH', Path(cartella)), patch.object(esegui, 'valuta', side_effect=aggiungi) as valuta, patch.object(esegui, 'comando'):
                esegui.processa_rivalutazioni()
                self.assertEqual([chiamata.args[0] for chiamata in valuta.call_args_list], ['esempio', 'seconda'])
                self.assertEqual(json.loads(percorso.read_text()), [])

    def test_errore_non_perde_la_rivalutazione_pendente(self):
        with tempfile.TemporaryDirectory() as cartella:
            percorso = self.prepara_coda(cartella)
            with patch.object(esegui, 'BENCH', Path(cartella)), patch.object(esegui, 'valuta', side_effect=SystemExit('sessione in errore')):
                with self.assertRaises(SystemExit):
                    esegui.processa_rivalutazioni()
                self.assertEqual(json.loads(percorso.read_text())[0]['prova'], 'esempio')
