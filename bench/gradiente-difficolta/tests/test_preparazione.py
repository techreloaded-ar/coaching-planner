import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import prepara


class ContabilitaTest(unittest.TestCase):
    def test_sessioni_cumulative_scarti_ed_errori_non_scompaiono(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);bench=root/'bench';runs=root/'runs';bench.mkdir()
            (bench/'manifest.json').write_text(json.dumps({'report':[{'numero':3}]}))
            events=[('ref/stream-00.jsonl','a',1.5,False),('ref/stream-01.jsonl','a',2.0,False),('_scartati/ref/stream-00.jsonl','b',.5,True)]
            for name,session,cost,error in events:
                path=runs/name;path.parent.mkdir(parents=True,exist_ok=True)
                path.write_text(json.dumps({'type':'result','session_id':session,'total_cost_usd':cost,'is_error':error})+'\n')
            incomplete=runs/'incompleta/stream-00.jsonl';incomplete.parent.mkdir()
            incomplete.write_text(json.dumps({'type':'system','subtype':'init','session_id':'senza-result'})+'\n')
            customer=runs/'incompleta/committente-stream-00.jsonl'
            customer.write_text(json.dumps({'type':'system','subtype':'init','session_id':'committente-senza-result'})+'\n')
            with patch.object(prepara,'BENCH',bench),patch.object(prepara,'RADICE',runs):
                data=prepara.costi()
            self.assertEqual(data['totale_usd'],2.5)
            self.assertIn('senza-result',data['sessioni_costo_non_attestato'])
            self.assertIn('committente-senza-result',data['sessioni_costo_non_attestato'])
            self.assertEqual(json.loads((bench/'manifest.json').read_text())['report'][0]['costo_usd'],2.5)

    def test_giudici_json_e_adattatori_contati_una_volta_senza_attraversare_i_cloni(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);bench=root/'bench';runs=root/'runs';bench.mkdir()
            (bench/'manifest.json').write_text(json.dumps({'report':[{'numero':3}]}))
            judge=runs/'prove/G-T1-DIR-opus-r1/tecnica/giudice-1.json';judge.parent.mkdir(parents=True)
            judge.write_text(json.dumps({'cost_usd':1.25}))
            adapter=runs/'prove/G-T1-DIR-opus-r1/valutazione/adattatore.log';adapter.parent.mkdir()
            adapter.write_text(json.dumps({'session_id':'adapter','total_cost_usd':.75}))
            stream=runs/'adattatori/T1/phases/stream-00.jsonl';stream.parent.mkdir(parents=True)
            stream.write_text(json.dumps({'type':'result','session_id':'adapter','total_cost_usd':.75})+'\n')
            fake=runs/'prove/G-T1-DIR-opus-r1/repo/node_modules/stream-00.jsonl';fake.parent.mkdir(parents=True)
            fake.write_text(json.dumps({'type':'result','session_id':'non-un-esperimento','total_cost_usd':999})+'\n')
            with patch.object(prepara,'BENCH',bench),patch.object(prepara,'RADICE',runs):data=prepara.costi()
            self.assertEqual(data['totale_usd'],2)
            self.assertEqual(data['preparazione_usd'],.75)

    def test_matrice_fissa_con_repliche_e_ordine_riproducibili(self):
        data=json.loads(prepara.MATRICE.read_text());runs=data['runs']
        self.assertEqual(len(runs),40)
        self.assertEqual(len({r['id'] for r in runs}),40)
        self.assertEqual(list(dict.fromkeys(r['task'] for r in runs)),['T3','T1','T4','T2'])
        for task in ('T1','T2','T3','T4'):
            for cell in ('DIR','COM'):
                for model,count in (('sonnet',3),('opus',2)):
                    self.assertEqual(len([r for r in runs if r['task']==task and r['config']==cell and r['model']==model]),count)

    def test_metriche_valide_impediscono_di_ripetere_una_fase(self):
        with tempfile.TemporaryDirectory() as directory:
            phase=Path(directory);(phase/'metrics.json').write_text(json.dumps({'is_error':False,'cost_usd':3}))
            with patch.object(prepara.subprocess,'Popen') as launch:
                result=prepara.sessione(phase,phase/'repo','prompt')
            launch.assert_not_called()
            self.assertEqual(result['cost_usd'],3)

    def test_fase_in_errore_non_viene_ripetuta_ne_riusata(self):
        with tempfile.TemporaryDirectory() as directory:
            phase=Path(directory);(phase/'metrics.json').write_text(json.dumps({'is_error':True}))
            with patch.object(prepara.subprocess,'Popen') as launch, self.assertRaises(SystemExit):
                prepara.sessione(phase,phase/'repo','prompt')
            launch.assert_not_called()

    def test_prove_bloccate_senza_conferma_anche_con_artifatti_presenti(self):
        import esegui
        with tempfile.TemporaryDirectory() as directory:
            matrix=Path(directory)/'matrix.json';matrix.write_text(json.dumps({'conferma_40_prove':False}))
            with patch.object(esegui,'MATRICE',matrix),patch.object(esegui.banco,'clone') as clone:
                with self.assertRaisesRegex(SystemExit,'conferma umana'):
                    esegui.prova('G-T3-DIR-sonnet-r1')
            clone.assert_not_called()


if __name__=='__main__':unittest.main()
