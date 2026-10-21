# Report 1 · prosecuzione autonoma

Richiesta autorizzata: eseguire `docs/benchmark/PROMPT-report-1.md` fino al report finale, riprendendo dopo i reset CLI, prove e valutazioni sequenziali, tetto 350 USD. Comunicare in italiano. Non leggere/modificare `.env` del progetto né correggere le consegne nei cloni. Non cambiare prompt, modelli, rubrica o matrice durante l'esperimento.

## Stato

- Branch `chore/test-models`; primo commit `888299f` (banco e matrice). Preesistevano modifiche a `run.py` pertinenti alla richiesta, incluse nel commit; due transcript non tracciati in `bench/wiki-benchmark/.claude/transcripts/` appartengono all'utente e vanno lasciati fuori.
- Matrice congelata `bench/wiki-benchmark/matrice-rumore.json`, seme `2026102101`, quattro celle da cinque repliche. H1 invariata nel manifest, report «in corso».
- Piloti avviati il 2026-10-21 alle 20:53 Europe/Rome, con:
  `BENCH_MATRICE=matrice-rumore.json python3 -u bench/pavimento-rumore/esegui.py pilota`
  log: `/Users/smarello/repo/coaching-planner-bench-runs/pilota-rumore.log`.
  Ordine piloti: `R-DIR-sonnet-r1`, `R-COM-sonnet-r1`; ogni prova è seguita da tre valutazioni e misura tecnica. Il processo termina dopo `proiezione.json`.
- Non avviare il resto finché non sono terminati i piloti e la proiezione non è stata comunicata in chat. Il prompt richiede di riportarla, non di chiedere approvazione.
- 10 test del banco passati. Generatore del report 1 già pronto, pagina esplicitamente provvisoria. Nessuna inferenza finché mancano repliche. Prima di usare i dati per le conclusioni, verificare anche le voci del report e i calcoli.

Automazione heartbeat attiva ogni 15 minuti: `completa-il-report-1-sul-pavimento-di-rumore`, collegata a questo thread. Usa `automation_update` per disattivarla a fine lavoro o stop per budget.

## Monitor e ripresa

1. Controllare con `ps` i processi `esegui.py`, `wiki-benchmark/run.py`, `wiki-benchmark/valuta.py`, `claude -p`, `tecnica.py`. Non avviare un secondo processo finché il primo è vivo. Il log cresce per fasi, non continuamente: leggere lo stream senza output non significa blocco. Evitare polling ravvicinato.
2. Leggere le nuove righe del log. Comunicare solo ogni nuova prova completata (riga `CONSEGNA VERIFICATA`), interruzione, proiezione o necessità di intervento. Restare silenziosi se nessuna novità.
3. Ai result in errore fermare l'orchestrazione; annotare l'orario Europe/Rome, fase, testo del limite/reset e costo in `CORREZIONI.md` prima di riprendere. I result degli stream contengono il costo; `banco.costi_esperimento()` lo include anche se non c'è `metrics.json`. Non rilanciare prima dell'orario di reset se il motivo è un limite di sessione. Rilanciare poi lo stesso comando. `phase()` archivia il tentativo in `_scartati` e resetta il clone al commit salvato prima della fase.
4. Comando costi:
   `BENCH_MATRICE=matrice-rumore.json python3 bench/pavimento-rumore/esegui.py status`.
   Il guardrail ferma a costo + adattatori residui ≥ 345 USD e prima di sessioni il cui massimo può superare 350. Stop per budget = riportare incompleto, non aggirare il tetto.
5. Dopo i piloti leggere `bench/pavimento-rumore/proiezione.json` e comunicarne stima, costo effettivo e limitazioni. Avviare in background, con `subprocess.Popen(..., start_new_session=True)` e log aperto in append:
   `BENCH_MATRICE=matrice-rumore.json python3 -u bench/wiki-benchmark/run.py all`
   log richiesto `/Users/smarello/repo/coaching-planner-bench-runs/run-rumore.log`.
   Il comando richiama `esegui.py valuta <id>` dopo ogni consegna: tre letture, poi `tecnica.py misura`. Le prove già complete saltano lo sviluppo e riusano le valutazioni. Nessuna fase `02-wiki-refresh` nella cella DIR.
6. Quando `all` termina senza errori, lanciare in sequenza:
   `BENCH_MATRICE=matrice-rumore.json python3 -u bench/pavimento-rumore/esegui.py finalizza`
   in un log separato `finalizza-rumore.log`. Genera e valuta tre volte il secondo adattatore per le quattro prove designate, poi misura all, 40 letture dei giudici tecnici e punteggi. I costi dei nuovi giudici sono imputati al report 1, evitare doppio conteggio nel totale del manifest.

## Verifiche ancora da eseguire sui dati

- Per ogni adattatore leggere `adattatore.log` e i due file TS: controllare i `NonImplementato` contro il codice effettivo. Applicare solo correzioni dell'adattatore con criterio uniforme annotato (vedere CORREZIONI: avviso di mese chiuso al posto del form, storico già persistito, networkidle dopo chiusura/riapertura). Nessuna modifica alle consegne.
- Se un adattatore va corretto dopo le letture, conservare le vecchie valutazioni e log sotto una cartella scartata, annotare la ragione, rimuovere la vista mediana e rifare TUTTE e tre le letture con l'adattatore corretto; le repliche devono usare lo stesso adattatore. Valutare a macchina scarica, senza altri processi AI/giudici in parallelo.
- `valuta.py` usa `--replica 1|2|3`, `--adattatore 1|2`; le letture sono in `valutazione/evaluation-N.json`, seconda serie in `valutazione/adattatore-2/evaluation-N.json`. La vista `evaluation.json` serve a tecnica/report 4, mediana dopo tre letture.
- Rigenerare `python3 bench/pavimento-rumore/report.py` per avere `bench/reports/pavimento-rumore/dati.json`. Le narrative vanno scritte a mano SOLO con numeri nei dati, senza deduzioni causali non sostenute.
- Report 4: aggiunto supporto DIR/COM a etichette, colori e flussi; i confronti storici restano separati. `python3 bench/qualita-tecnica/report.py` dopo punteggi; rivedere TUTTA `bench/qualita-tecnica/narrativa.json` e le affermazioni numeriche che cambiano con le mediane di coorte e le nuove consegne. Aggiornare manifest report 4 risultato/esito se cambiano i numeri. Registrare rigenerazione nell'indice, senza addebitare due volte i nuovi giudici.
- Generatore report 1: SD pooled su quattro celle; test t bilaterale di pari n, potenza con t non centrale (scipy 1.17.1 già disponibile); bootstrap appaiato k contro k, stratificato per modello nel confronto aggregato, seme `2026102102`; controllo per consegna deciso dalla maggioranza delle tre letture. Dati grezzi delle letture visibili.
- Il browser integrato non ha raggiunto il server locale 8765 (`ERR_CONNECTION_TIMED_OUT`), benché `curl` dia HTTP 200. Safari via CUA è andato in timeout. Non affermare che la verifica visiva sia completata. `open_in_codex` del report HTML è stato accodato. Ritentare verifica nel browser disponibile alla fine, con filtri combinati e anchor dettagli.

## Chiusura

1. Verificare 20 consegne, 60 letture primarie e 12 secondarie, 20 misure tecniche nuove e due letture valide di giudice ciascuna; controllare precondizioni e tree hash.
2. Scrivere narrativa report 1 e rivedere report 4 dai dati; sezione Limiti prima delle conclusioni. Test: `python3 -m unittest discover -s bench/pavimento-rumore/tests -v`; `python3 bench/pavimento-rumore/report.py --definitivo`; `git diff --check`.
3. Manifest report 1: solo stato, costo, data, risultato ed esito H1; non riscrivere ipotesi. H1 = SD pooled, MDE e soglia 2 SD sotto la quale scrivere «entro il rumore».
4. Registro in `bench/index.py`: rumore dell'oracolo entro le tre letture e tra i due adattatori; report 4 rigenerato. Rigenerare indice. Commit in italiano senza attribuzioni, includendo solo file pertinenti; non includere `__pycache__` o transcript dell'utente.
5. Consegna: costo e residuo, scarti/motivi, H1 nella forma dell'indice, link assoluti a indice/report, interruzioni con orari. Disattivare l'automazione di prosecuzione quando il lavoro è finito o fermato per budget/necessità di decisione umana.

## Aggiornamento 21:18 Europe/Rome

`R-DIR-sonnet-r1` consegnata (12,3 min, 2,02 USD) e valutata tre volte a 84,7, ma audit ha trovato il noto errore adattatore S1. Letture e log iniziali sono archiviati e rimossi dalla serie valida; adattatore corretto con criterio uniforme. `rivalutazioni-pendenti.json` elenca la prova. **A pilota COM terminato e PRIMA di comunicare la proiezione/avviare il resto, eseguire tre nuove letture DIR**, con `BENCH_MATRICE=matrice-rumore.json python3 -u bench/pavimento-rumore/esegui.py valuta R-DIR-sonnet-r1`; poi aggiornare misure tecniche senza rifare i mutanti: `python3 bench/common/tecnica.py misura R-DIR-sonnet-r1 --rifai --senza-mutanti`. Rimuovere la voce pendente dopo verifica. Non farlo in parallelo al pilota COM (processi attuali: esegui.py pilota 77860, run.py 88828). Prima lettura tecnica è conservata nell’archivio.

Osservazioni qualitative da riesaminare a fine esperimento: `bench/pavimento-rumore/osservazioni.json`. In COM Sonnet, la terza review di US-060 accetta dichiarando esplicitamente di non aver letto il workflow CI, in contrasto con AGENTS.md. Non cambiare il prompt o il codice per correggere il comportamento osservato; distinguere le dichiarazioni della review dai gate esterni realmente eseguiti.

## Aggiornamento 22:15 Europe/Rome

Pilota COM concluso: 51,0 minuti, 10,19 USD di sviluppo; tre letture identiche 88,2/100; mutation score 0,3495. Entrambi i processi pilota terminati. Avviata rivalutazione DIR corretta (PID 55565) in `~/repo/coaching-planner-bench-runs/rivalutazione-pilota-dir.log`. Alla fine aggiornare tecnica con `--rifai --senza-mutanti`, rimuovere la voce pendente e avviare `run.py all` (non duplicare processi).

Proiezione comunicata in chat: prove 288,94 USD + adattatori 19,20 USD = 308,14 USD; con giudici tecnici stimati dal report 4 (~17,49 USD per 20 consegne) totale ~325,63 USD. Sono stime con rapporto storico Opus/Sonnet, non un nuovo budget. Tempo ~10,6 ore sviluppo + 6–8 ore valutazione, esclusi reset e misure tecniche. Costo consolidato attuale 13,55 USD; budget residuo 336,45 USD. Prima di lanciare il resto verificare l’esito effettivo delle nuove letture DIR.

## Aggiornamento 22:30 Europe/Rome

Rivalutazione DIR completa e verificata: 90,7/100 × 3, tree hash conforme; tecnica aggiornata senza ripetere mutanti (score 0,3695). Coda rivalutazioni vuota. Pilota COM: 88,2 × 3. Proiezione già comunicata nel heartbeat precedente. **Avviato run.py all, PID 61372, log run-rumore.log**, primo run nell’ordine congelato R-DIR-opus-r1. Nessuna sessione parallela. Il vecchio pilota-rumore.log non è più il log attivo.
