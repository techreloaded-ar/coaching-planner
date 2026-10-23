import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import esegui
import prepara


class ProtocolloRidottoTest(unittest.TestCase):
    def test_ripresa_usa_stato_storico_e_non_stato_corrente(self):
        with patch.object(esegui.banco,'parse_stream',return_value=({}, {'result':'ARCHETIPO_REVIEW_VERDICT:\n  verdict: CHANGES_REQUESTED'})):
            self.assertEqual(esegui.stato_dopo_review(Path('/prova'),'US-060-review-1',{}),'TODO')
        self.assertEqual(esegui.stato_dopo_review(Path('/prova'),'review',{'spec_status_after':'DONE'}),'DONE')

    def test_otto_prove_senza_autorizzare_la_matrice_originale(self):
        matrix=prepara.leggi(esegui.MATRICE)
        self.assertTrue(matrix['conferma_8_prove'])
        self.assertFalse(matrix['conferma_40_prove'])
        self.assertFalse(prepara.leggi(prepara.MATRICE)['conferma_40_prove'])
        self.assertEqual(len(matrix['runs']),8)
        self.assertEqual({r['model'] for r in matrix['runs']},{'sonnet'})
        for task in ['T1','T3']:
            for cell in ['DIR','COM']:
                self.assertEqual(len([r for r in matrix['runs'] if r['task']==task and r['config']==cell]),2)
        self.assertAlmostEqual(matrix['budget_usd']-matrix['costo_al_cambio_scope_usd'],80)

    def test_riserva_si_ferma_al_nuovo_tetto_anche_se_sotto_750(self):
        matrix=prepara.leggi(esegui.MATRICE)
        with patch.object(esegui,'costi',return_value={'totale_usd':matrix['budget_usd']-2,'preparazione_usd':40}):
            with self.assertRaisesRegex(SystemExit,'tetto ridotto'):esegui.riserva(3)

    def test_oracoli_modificati_non_possono_usare_una_taratura_precedente(self):
        import congela_preparazione
        with patch.object(congela_preparazione,'hash_oracoli',return_value='diverso'):
            with self.assertRaisesRegex(SystemExit,'Oracoli cambiati'):esegui.verifica_conferma()


if __name__=='__main__':unittest.main()
