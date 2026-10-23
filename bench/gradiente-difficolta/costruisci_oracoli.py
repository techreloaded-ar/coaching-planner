#!/usr/bin/env python3
"""Costruisce gli oracoli dal profilo, senza accesso ai riferimenti."""
import shutil
from prepara import BENCH, REPO, RADICE, banco, baseline, setup, sessione

cartella=RADICE/'preparazione/oracoli'
repo=cartella/'repo'
if not repo.exists():
    banco.clone(baseline('T1'),repo);setup(repo,'oracoli')
    destination=repo/'__preparazione__';destination.mkdir()
    shutil.copytree(BENCH/'gradiente-difficolta/profili',destination/'profili')
    shutil.copytree(BENCH/'gradiente-difficolta/oracoli',destination/'oracoli')
    shutil.copytree(BENCH/'wiki-benchmark/oracolo',destination/'esempio-precedente')
    shutil.copy2(BENCH/'wiki-benchmark/valuta.py',destination/'valutatore-precedente.py')
    banco.commit_if_dirty(repo,'bench: profili e checklist congelati per autore oracoli')
prompt=f'''Sei autore degli oracoli esterni per quattro compiti di un benchmark su Coaching Planner. Lavori esclusivamente nel clone corrente. Non accedere al repository originale {REPO}, ad altri cloni o a soluzioni di riferimento. Non leggere o modificare .env. Leggi AGENTS.md, tests/e2e/README.md e le guide rilevanti node_modules/next/dist/docs prima di scrivere codice.

I quattro profili nascosti completi sono in __preparazione__/profili/T1.md ... T4.md. Le checklist di 24 controlli (25 per T4) e le aree/pesi per ciascuno sono fissate in __preparazione__/oracoli/T*/controlli.json: NON modificare questi file. Realizza ora gli oracoli eseguibili, indipendenti dalle implementazioni, secondo queste checklist. Esempio precedente in __preparazione__/esempio-precedente/ e valutatore-precedente.py; leggilo e riusa l'approccio per Postgres reale dedicato, sessioni firmate, server action reali, browser Chromium a 1440 e 390 px.

Scrivi SOLO sotto __preparazione__/oracoli/ (anche shared/ se opportuno):
- per compito contratto.ts, integrazione.test.ts, browser.spec.ts, vitest.config.ts, playwright.config.ts;
- un adattatore-nullo/ che dichiara capacità mancanti con NonImplementato, senza implementarle;
- una guida ADATTATORI.md con istruzioni precise per Opus, che poi collegherà ciascuna consegna alle interfacce reali. L'adattatore traduce solo firme/nome campi/locator: nessun calcolo di importi o controllo di autorizzazione mancante può stare nell'adattatore;
- eventuali script per gate speciali T3 (migrare database CON DATI e confrontare tutti i mesi prima/dopo, concorrenza su connessioni distinte) e T4 (test aggiunti che devono fallire applicati sulla baseline col difetto; giudice diagnosi a checklist chiusa).

Ogni test ha titolo '[area] CODICE descrizione' per il punteggio; non duplicare gli stessi controlli per gonfiare il totale. Le assert e i risultati attesi devono vivere nei test, mai nell'adattatore. Niente test.todo/skip/fixme, niente finti pass, niente fallback che riimplementino capacità mancanti, niente test che interrogano solo il testo del sorgente al posto del comportamento reale. Se una verifica richiede una fase esterna (migrazione, gate o giudice), specifica un contratto JSON dello script che il banco eseguirà. 24 controlli per compito (25 per T4) inclusi gate e giudici, più gate CI regressioni tutto-o-niente.

Il server gira con TZ=UTC, come la CI; nel browser configura timezoneId='Europe/Rome' e locale='it-IT' per i casi di cambio ora. Questa condizione è fissata prima delle prove. Le rappresentazioni arrotondate della UI baseline sono legittime (T4 avanzamento: 0,75 giornate appare 0,8 gg); le assert esatte sui calcoli restano nell’integrazione.

Usa factory/fixtures e helper mesi riservati di tests/e2e/support. fullyParallel:true anche nell'oracolo Playwright, senza workers:1 o hard waits. Ogni test mutante ha dati propri; il controllo concorrente può eseguire operazioni simultanee nello stesso test. Non mutare seed. Nessun tema è ancora assegnato alle storie: nelle_storie resta null fino al chiarimento e ai due giudici.

Per T3 il contratto deve consentire la costruzione dei dati fixture compatibile con la schema reale della consegna, anche se le tariffe sono state spostate su nuove tabelle. La preparazione sintetica dei dati tramite ORM/SQL è ammessa nel setup dell’adattatore; non deve implementare operazioni di prodotto mancanti né fare controlli di autorizzazione o calcoli che il prodotto non fa. Una factory della consegna incompatibile con la nuova schema non deve rendere impossibile la valutazione del comportamento reale: il gate di regressione ne conserverà separatamente il fallimento.

Gli script devono essere riproducibili: documenta come il banco copia la cartella Tn in __oracolo__ della copia immutabile, il contratto env (DATABASE_URL/E2E_DATABASE_URL), e il comando di ogni livello. Non avviare alcun server e non eseguire test browser: la porta 3000 è riservata ai gate di verifica dei riferimenti. Sono consentiti typecheck, parsing e discovery dei test senza server. Non modificare src/, prisma/, tests/ o la checklist. Alla fine verifica sintassi e compatibilità delle factory; non tentare di far passare capacità non implementate sulla baseline. Non fare commit. Riassumi limiti reali e file prodotti.'''
sessione(cartella/'phases/01-oracoli',repo,prompt,massimo=20)
source=repo/'__preparazione__/oracoli'
shutil.copytree(source,BENCH/'gradiente-difficolta/oracoli',dirs_exist_ok=True)
print('Oracoli copiati nel banco; verificare prima delle prove.',flush=True)
