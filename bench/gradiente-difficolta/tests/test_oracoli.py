import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ORACOLI=Path(__file__).resolve().parents[1]/'oracoli'


class EvidenzeCriticheTest(unittest.TestCase):
    def valuta(self,errore,compito='T2',completo=True):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            checklist=json.loads((ORACOLI/compito/'controlli.json').read_text())
            casi=[{'title':f"[{c['area']}] {c['codice']} controllo",'status':'failed','failureMessages':[errore if c['codice']=='A1' else 'NonImplementato']} for c in checklist['controlli']] if completo else []
            (root/'vitest.json').write_text(json.dumps({'testResults':[{'assertionResults':casi}]}))
            (root/'ci.json').write_text(json.dumps({'ok':True}))
            result=subprocess.run(['python3',str(ORACOLI/'shared/punteggio.py'),'--compito',compito,'--gate-ci',str(root/'ci.json'),'--vitest',str(root/'vitest.json')],capture_output=True,text=True,check=True)
            return json.loads(result.stdout)

    def test_capacita_assente_non_dimostra_esposizione_dati(self):
        risultato=self.valuta('NonImplementato: report assente')
        self.assertEqual(risultato['violazioni_critiche'],[])
        self.assertEqual(risultato['controlli_critici_non_verificati'],['A1'])
        self.assertFalse(risultato['controlli']['A1']['ok'])

    def test_esposizione_osservata_resta_critica_anche_se_gli_altri_controlli_falliscono(self):
        risultato=self.valuta('VIOLAZIONE_CRITICA_DATI_ALTRUI: fixture di altro collaboratore visibile')
        self.assertEqual(risultato['violazioni_critiche'],['A1'])
        self.assertEqual(risultato['controlli_critici_non_verificati'],[])

    def test_report_mancante_non_diventa_valutazione_valida_ne_esposizione(self):
        risultato=self.valuta('',completo=False)
        self.assertFalse(risultato['valida'])
        self.assertEqual(risultato['violazioni_critiche'],[])
        self.assertEqual(len(risultato['mancanti']),24)

    def test_checklist_hanno_copertura_univoca_in_tutti_i_livelli(self):
        subprocess.run(['python3',str(ORACOLI/'shared/verifica_copertura.py')],check=True,capture_output=True)


if __name__=='__main__':unittest.main()
