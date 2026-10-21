import importlib.util
import math
import sys
import unittest
from pathlib import Path

PERCORSO = Path(__file__).resolve().parents[1] / 'report.py'
spec = importlib.util.spec_from_file_location('report_rumore', PERCORSO)
report = importlib.util.module_from_spec(spec)
spec.loader.exec_module(report)


class StatisticaRumoreTest(unittest.TestCase):
    def test_pooled_ignora_la_differenza_fra_medie_delle_celle(self):
        self.assertAlmostEqual(report.pooled([[1, 2, 3], [101, 102, 103]]), 1)

    def test_bootstrap_rispetta_le_coppie_e_riproduce_il_seme(self):
        primo = report.bootstrap_appaiato([[2, 2, 2, 2, 2], [4, 4, 4, 4, 4]], 7)
        self.assertEqual(primo['delta'], 3)
        self.assertEqual(primo['ic95'], [3, 3])
        self.assertTrue(primo['entro_il_rumore'])
        self.assertTrue(primo['osservata'])
        self.assertEqual(primo, report.bootstrap_appaiato([[2]*5, [4]*5], 7))

    def test_mde_raggiunge_la_potenza_e_n_e_minimo(self):
        risultato = report.potenza(3)
        self.assertAlmostEqual(report.potenza_t(risultato['mde'], 3, 5), .8)
        for effetto, repliche in risultato['repliche_per_effetto'].items():
            self.assertGreaterEqual(report.potenza_t(int(effetto), 3, repliche), .8)
            if repliche > 2:
                self.assertLess(report.potenza_t(int(effetto), 3, repliche - 1), .8)

    def test_varianza_zero_non_dichiara_potenza_certa(self):
        self.assertIsNone(report.potenza(0)['mde'])


if __name__ == '__main__':
    unittest.main()
