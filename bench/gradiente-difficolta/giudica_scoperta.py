#!/usr/bin/env python3
"""Due letture Opus a checklist chiusa, temi fissati prima del chiarimento."""
import json
import subprocess
import sys
from prepara import BENCH, RADICE, banco, costi, leggi, scrivi

TEMI={
'T1':{
'campi_facoltativi':'Tre campi referente facoltativi, salvabili anche singolarmente.',
'nome':'Nome referente valido quando presente, spazi non sono un nome.',
'email':'Email validata quando presente.',
'telefono':'Telefono validato quando presente.',
'dettaglio':'Referente visibile nel dettaglio cliente.',
'elenco':'Referente visibile nell’elenco clienti.',
'fatturazione':'Referente nell’intestazione cliente del report Fatturazione Clienti.',
'ruoli':'Solo amministratore può modificare i campi.',
'modifica':'Inserimento, modifica e rimozione del referente.',
'calcoli':'Nessun impatto sui calcoli dei report.',
'compatibilita':'Clienti esistenti senza referente validi, migrazione additiva.'},
'T2':{
'decisione_prd':'Superamento consapevole della marginalità posticipata dopo MVP nel PRD, ora richiesta.',
'ricavi':'Ricavi = giornate fatturabili × tariffa offerta.',
'costi':'Costi = giornate × tariffa del collaboratore che ha lavorato.',
'non_fatturabili':'Le righe non fatturabili producono costo anche senza ricavo.',
'trasferte':'Rimborsi trasferta esclusi da ricavi e costi perché passanti.',
'margini':'Margine assoluto e percentuale, anche perdita/ricavo zero senza infinito.',
'periodo':'Periodo da mese a mese, estremi inclusi.',
'dettaglio':'Aggregazione per cliente, dettaglio per offerta e collaboratore.',
'conversione':'1 giornata = 8 ore, frazioni mantenute.',
'ruoli_scritture':'Solo amministratore, funzionalità in sola lettura, nessuna scrittura né schema nuovo.',
'coerenza':'Ricavi coerenti con manodopera del report Fatturazione Clienti sul medesimo periodo.'},
'T3':{
'offerte':'Storicizzazione delle tariffe giornaliere Offerta con data inizio validità.',
'collaboratori':'Storicizzazione delle tariffe giornaliere Collaboratore con data inizio validità.',
'data_riga':'Ogni importo usa la tariffa vigente alla data della riga, non alla data corrente o inserimento.',
'calcoli':'Riepilogo, Fatturazione Clienti, avanzamento offerte e marginalità se presente nella baseline.',
'future':'Inserimento anticipato di tariffe future.',
'correzione':'Correzione dell’ultima tariffa senza alterare quelle precedenti.',
'sovrapposizioni':'Divieto di validità sovrapposte, compresa stessa decorrenza.',
'buchi':'Divieto di buchi tra validità consecutive.',
'concorrenza':'Due inserimenti concorrenti sulla stessa entità non producono sovrapposizioni.',
'migrazione':'Backfill tariffa attuale in validità aperta, nessun importo di mesi passati cambia.',
'compatibilita_ruoli':'Form esistenti funzionanti, righe attività invariate, solo amministratore modifica tariffe.'},
'T4':{
'sintomi':'Discrepanza solo per alcuni collaboratori, distinzione giornate e importi a tariffe differenti.',
'riproduzione':'Esempio concreto con collaboratore, mese, righe e numeri attesi riproducibili.',
'conversione':'1 giornata = 8 ore, mantenendo le frazioni.',
'frazioni':'Due righe da 3 ore devono dare 0,75 giornate; tariffa 400 produce 300 EUR.',
'riepilogo':'Riepilogo mensile corretto anche nei totali per offerta.',
'avanzamento':'Verificare anche avanzamento offerte, se il committente segnala lo stesso sintomo.',
'fatturazione':'Report fatturazione corretto da preservare, non allineare a un valore errato.',
'dati':'Nessuna riscrittura di ore, date o tariffe per correggere il sintomo.',
'non_fatturabili_rimborsi':'Preservare righe non fatturabili e relativi rimborsi.',
'date':'Comportamento corretto anche nei mesi con cambio ora.',
'regressione_spiegazione':'Verifica riproducibile di regressione e spiegazione comprensibile della correzione.'}}
VALORI=['Esplicito','Parziale','Non chiarito']


def schema(task,codes):
    voce={'type':'object','additionalProperties':False,'required':['valore','evidenza'],'properties':{'valore':{'type':'string','enum':VALORI},'evidenza':{'type':'string'}}}
    def mapping(keys):return {'type':'object','additionalProperties':False,'required':list(keys),'properties':{key:voce for key in keys}}
    return {'type':'object','additionalProperties':False,'required':['temi','controlli','bozza_completa_mostrata','decisione_prd_sollevata','note'],'properties':{'temi':mapping(TEMI[task]),'controlli':mapping(codes),'bozza_completa_mostrata':{'type':'boolean'},'decisione_prd_sollevata':{'type':'boolean'},'note':{'type':'string'}}}


def giudica(task):
    source=RADICE/f'chiarimenti/{task}'
    if not (source/'discovery.json').exists():raise SystemExit('Chiarimento mancante')
    controls=leggi(BENCH/f'gradiente-difficolta/oracoli/{task}/controlli.json')['controlli']
    codici=[c['codice'] for c in controls]
    specifica=schema(task,codici)
    prompt='''Sei un giudice a checklist chiusa della scoperta dei requisiti, senza strumenti. Usa solo dialogo e storie. Assegna Esplicito (2) se il bisogno è scritto nelle storie finali senza ambiguità; Parziale (1) se incompleto/ambiguo o chiarito nel dialogo ma assente nelle storie; Non chiarito (0) se assente o contrario al bisogno. Fuori perimetro dichiarato al committente: Parziale, altrimenti Non chiarito. Cita evidenze concrete, non supplire con buon senso. Per T4 le storie devono descrivere il comportamento corretto senza rivelare causa o posizione: questo non è un’omissione. Valuta sia gli 11 temi, sia quanto ciascun controllo era reso esplicito dalle storie. Non valutare implementazioni. Il punteggio di scoperta usa soltanto i temi; le etichette dei controlli servono alle tabelle, non aggiungono punti.\n\n'''
    prompt+='TEMI:\n'+json.dumps(TEMI[task],ensure_ascii=False)+'\n\nCONTROLLI:\n'+json.dumps(controls,ensure_ascii=False)
    prompt+='\n\nDIALOGO:\n'+(source/'phases/01-spec/dialogo.md').read_text()+'\n\nSTORIE:\n'+(source/'storie.md').read_text()
    cartella=RADICE/f'giudici-scoperta/{task}';cartella.mkdir(parents=True,exist_ok=True)
    (cartella/'prompt.txt').write_text(prompt)
    risposte=[]
    for n in (1,2):
        dest=cartella/f'giudizio-{n}.json'
        if dest.exists():
            risposte.append(leggi(dest)['risposta']);continue
        if costi()['totale_usd']+3>750:raise SystemExit('STOP budget prima del giudice')
        stream=cartella/f'stream-{n:02d}.jsonl'
        if stream.exists():raise SystemExit('Lettura precedente incompleta: conservare/scartare esplicitamente')
        neutral=RADICE/'_giudice';neutral.mkdir(exist_ok=True)
        cmd=['claude','-p',prompt,'--model','opus','--effort','medium','--tools','','--setting-sources','project,local','--strict-mcp-config','--permission-mode','bypassPermissions','--output-format','stream-json','--verbose','--json-schema',json.dumps(specifica),'--max-budget-usd','3']
        with stream.open('w') as out,(cartella/f'stderr-{n}.txt').open('w') as err:
            process=subprocess.run(cmd,cwd=neutral,env=banco.agent_env(),stdin=subprocess.DEVNULL,stdout=out,stderr=err)
        _,esito=banco.parse_stream(stream);costi()
        if esito is None or esito.get('is_error'):raise SystemExit('STOP giudice in errore')
        risposta=esito.get('structured_output')
        if not risposta:raise SystemExit('Risposta strutturata mancante: non assegnare punteggi')
        scrivi(dest,{'lettura':n,'cost_usd':esito.get('total_cost_usd'),'risposta':risposta});risposte.append(risposta)
    scala={'Esplicito':2,'Parziale':1,'Non chiarito':0}
    temi={key:min(scala[r['temi'][key]['valore']] for r in risposte) for key in TEMI[task]}
    copertura={key:min(scala[r['controlli'][key]['valore']] for r in risposte) for key in codici}
    accordo=sum(risposte[0]['temi'][key]['valore']==risposte[1]['temi'][key]['valore'] for key in temi)/len(temi)
    scrivi(source/'copertura.json',{'temi':temi,'punteggio':sum(temi.values())/22*100,'accordo':accordo,'controlli':copertura})
    file=BENCH/f'gradiente-difficolta/oracoli/{task}/controlli.json';d=leggi(file)
    for controllo in d['controlli']:controllo['nelle_storie']={2:'Esplicito',1:'Parziale',0:'Non chiarito'}[copertura[controllo['codice']]]
    scrivi(file,d)


if __name__=='__main__':giudica(sys.argv[1])
