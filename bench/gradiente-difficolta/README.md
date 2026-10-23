# Report 3 · Gradiente di difficoltà

**Concluso il 23 ottobre 2026:** 8/8 consegne valutate, audit valido e 24 storie invariate. [Report finale](../reports/gradiente-difficolta/report.html). Spesa aggiuntiva 51,73 USD (massimo 80), totale 92,85 USD. Wall clock delle prove e delle verifiche 4,57 ore. Δ funzionale 0,0 su T1/T3; H3 integrale non verificabile nel disegno ridotto.

**Protocollo attivo dal 23 ottobre 2026:** set ridotto autorizzato di 8 prove Sonnet su T3/T1, due repliche diretto/completo, massimo un rework, una lettura funzionale e metriche tecniche automatiche. Budget aggiuntivo massimo 80 USD, totale massimo 121,1195528 USD. Dettagli in `PROTOCOLLO-RIDOTTO.md`; matrice attiva `bench/wiki-benchmark/matrice-gradiente-ridotta.json`. La matrice originale di 40 prove resta archiviata e non autorizzata. Le sezioni di preparazione che seguono descrivono il checkpoint storico.

Il driver seriale è `python3 -u bench/gradiente-difficolta/esegui_ridotto.py`: esegue e valuta in sequenza, riusa le metriche già valide, si ferma a qualsiasi errore e usa un lock per non lanciare due driver. Non avviarlo mentre è ancora attivo un comando singolo `esegui.py prova`. `progresso.json` e `costi.json` conservano stato e consuntivo. Il report ridotto si genera con `python3 bench/gradiente-difficolta/report_ridotto.py`; non produce un punteggio tecnico /100 o un verdetto integrale su H3.

Protocollo: `docs/PROMPT-report-3-gradiente-difficolta.md`. Criteri e stile: `bench/index.html#criteri` e `#stile`.

L’ipotesi H3 è preregistrata nel manifest e in `PREREGISTRAZIONE.md`. La matrice congelata è `bench/wiki-benchmark/matrice-gradiente.json`: 40 prove, ordine T3 → T1 → T4 → T2, ordine interno randomizzato con seme 2026102203. **Le prove sono bloccate fino alla conferma umana dopo la preparazione completa e la tabella degli indicatori.**

Le prove sono raggruppate in `prove/T1/` … `prove/T4/`: ogni invocazione di `bench/common/tecnica.py` riceve `BENCH_RUNS` della sola coorte e `BENCH_CONTROLLI` del compito, così il denominatore della copertura non si mescola tra compiti.

Gli artefatti delle sessioni sono in `~/repo/coaching-planner-bench-runs/gradiente-difficolta/`, separati dai report precedenti. Ogni clone nasce dal medesimo `main` registrato nella matrice. Nel clone vengono rimossi il banco e i prompt del banco; i profili, gli oracoli e i riferimenti non entrano nei cloni sperimentali. Non accedere a `.env`: l’ambiente sintetico dedicato usa `.env.local`. Nessun codice applicativo originale viene modificato dalla preparazione. Server e processi test usano esplicitamente `TZ=UTC`, come in CI; i browser dell’oracolo useranno `Europe/Rome` e locale `it-IT`. I riferimenti iniziali hanno girato sul fuso locale prima di questa uniformazione: le verifiche finali useranno l’ambiente congelato. La robustezza del server in altri fusi non è oggetto del confronto.

## Preparazione riprendibile

```sh
python3 -u bench/gradiente-difficolta/prepara.py riferimento T3
python3 -u bench/gradiente-difficolta/prepara.py riferimento T1
python3 -u bench/gradiente-difficolta/prepara_t4.py
python3 -u bench/gradiente-difficolta/prepara.py riferimento T4
python3 -u bench/gradiente-difficolta/prepara.py riferimento T2
python3 -u bench/gradiente-difficolta/costruisci_oracoli.py
python3 -u bench/gradiente-difficolta/scoperta.py T3
python3 -u bench/gradiente-difficolta/scoperta.py T1
python3 -u bench/gradiente-difficolta/scoperta.py T4
python3 -u bench/gradiente-difficolta/scoperta.py T2
python3 -u bench/gradiente-difficolta/completa_preparazione.py
python3 -u bench/gradiente-difficolta/tara_oracoli.py
python3 -u bench/gradiente-difficolta/tara_regressione.py
python3 bench/gradiente-difficolta/congela_preparazione.py
python3 bench/gradiente-difficolta/misura_copertura_baseline.py
python3 bench/gradiente-difficolta/misura_indicatori.py
python3 bench/gradiente-difficolta/prepara.py status
```

Eseguire una sessione alla volta. Una fase con `metrics.json` valido non si ripete; un tentativo incompleto o in errore ferma il comando e richiede diagnosi e scarto documentato, senza cancellarne stream e costo. La baseline T4 viene modificata una sola volta da `prepara_t4.py`, che non è idempotente sulle mutazioni: un secondo lancio si ferma esplicitamente. I riferimenti restano nascosti e servono per indicatori e taratura degli adattatori, non per decidere gli esiti funzionali.

Le skill sono congelate in `_skills/` esterno ai cloni; gli hash coincidono con quelli del primo riferimento e sono registrati nella matrice.

Per ogni fase: Opus, effort medium, `claude -p`, `--setting-sources project,local`, `--permission-mode bypassPermissions`, stream JSON verbose e budget massimo per fase. I builtin di Claude Code 2.1.303 sono elencati esplicitamente nel controllo init; plugin esterni o altre skill invalidano la fase. Il chiarimento usa baseline V0: V1 è dichiarata adottabile dal report 6, ma nessuna adozione è registrata e la skill installata è baseline. La scelta iniziale V1 è stata corretta il 23 ottobre prima dei chiarimenti e delle prove. Il committente è Opus in processo separato, senza strumenti e con il solo profilo nascosto. Le storie non vengono corrette dal banco.

## Evidenze T4

`difetto-T4.json` registra commit, rimozioni e gate. `difetto-T4.patch` conserva il diff e `riproduzione-T4.json` mostra il sintomo: due righe da 3 ore producono 0,74 giornate nel riepilogo e nell’avanzamento, mentre il report fatturazione conserva 0,75. Il candidato (a) tronca ai centesimi di giornata per riga; non usa il troncamento a giornate intere, che gli e2e esistenti intercetterebbero. Le 11 pagine Wiki e i due file unit rimossi sono elencati nel registro. La rimozione lascia warning di link interrotti: `wiki validate` restituisce comunque `ok: true`. Questa è una manipolazione artificiale, non codice legacy reale.

## Contabilità e limiti del checkpoint originale

Il tetto originale era 750 USD; è stato sostituito prima delle prove dal tetto complessivo **121,1195528 USD** (80 USD aggiuntivi), non cumulabile con il precedente. Costruzione di profili, riferimenti, oracoli e adattatori: limite originale 120 USD, subordinato al nuovo tetto totale. Ogni lancio riserva il proprio massimo; il costo deriva dai result Claude Code, non da stime sui token. Sessioni riprese: vale il costo cumulativo massimo per session ID. Scarti ed errori sono inclusi; una sessione senza result resta esplicitamente da riconciliare. `costi.json` separa preparazione, totale osservato e residui. I chiarimenti sono costo sperimentale e non costruzione degli oracoli.

Il rumore deriva da un solo compito, la chiusura mese: SD pooled 0,7749193506423736 e soglia 2 SD 1,5498387012847472. `potenza.json` usa il test t non centrale del report 1 come indicatore: potenza circa 46% con tre repliche Sonnet e 22% con due Opus per un effetto 2 SD. Non è la potenza esatta della mediana o del bootstrap. Non si aumentano le repliche.

Il criterio tecnico comune accetta la checklist del compito con `BENCH_CONTROLLI`. I pesi e le formule restano comuni; migrazione e blocco di stato hanno applicabilità esplicita. `baseline_tecnica` identifica la baseline effettiva del compito, già difettosa per T4. Se una coorte ha mediana netta non positiva, la dimensione usa righe aggiunte + eliminate src, con la stessa formula e lo stesso peso; la misura è dichiarata nei punteggi. La regola è preregistrata prima delle prove e vale per qualsiasi coorte.

## Verifica del banco

```sh
python3 -m unittest discover -s bench/gradiente-difficolta/tests -v
python3 -m unittest discover -s bench/pavimento-rumore/tests -v
```

L’autore degli oracoli produce codice da verificare e tarare prima della conferma. La presenza di una checklist non costituisce da sola un oracolo validato. `calibrazione.json` deve attestare le verifiche; l’orchestratore non avvia prove se manca o non è valida.


## Taratura degli oracoli

`tara_oracoli.py` usa esclusivamente copie delle baseline: controlli negativi con capacità mancanti T1–T3, confronto T4 difettosa/sana. `tara_regressione.py` prova il gate causale G1/G2 con una fixture sintetica e un controllo negativo. `adatta.py Tn` genera, con Opus, il collegamento alle firme del riferimento e lo tipizza; non lo esegue. Le esecuzioni future degli adattatori avverranno solo sulle consegne. `audit_oracoli.py` verifica init, precondizioni e comandi delle cinque fasi.

`misura_copertura_baseline.py` usa il profiler Node con un file Vitest per processo nelle copie delle baseline, senza nuove dipendenze o modifiche al codice applicativo. Registra quali funzioni vengono chiamate, distinguendo il test che esercita un percorso da una semplice citazione in un commento. Le sonde dei test originali sui riferimenti restano una misura separata della manutenzione.

Il riferimento T3 ha superato tre suite e2e nel fuso locale. I due tentativi aggiuntivi UTC hanno mostrato errori su percorsi preesistenti (gestione utenti e scadenza sessione), conservati in `diagnosi-ci.json`: la stabilità dei gate UTC non è dimostrata. Nessun test o codice applicativo corretto dal banco per ottenere il verde.

## Audit e correzioni durante le prove ridotte

`audit_ridotto.py` controlla ricevute, session ID freschi, init, precondizioni, hash, prompt, costi e immutabilità. `audit-adattatori.json` conserva l’ispezione delle attese, con lo stesso criterio anche quando un controllo passa. Una lettura invalidata da un errore del banco resta separata e non concorre alle mediane: `correggi_lettura_browser.py <id>` sostituisce il solo livello browser su DB fresco, con integrazione e gate validi conservati. Il comando richiede il lock libero, conserva il tentativo originale e non esegue chiamate a modelli. Non è un comando per ripetere controlli falliti della consegna.

`audit_storie.py` confronta i body al commit del chiarimento e della consegna, normalizzando solo checkbox, spazi esterni e la sezione di feedback aggiunta dal CLI. Richiede PyYAML (6.0.3 nell’ambiente del benchmark); non modifica i cloni e non chiama modelli.

Le comparazioni di costo e tempo includono le fasi scartate della stessa prova. Il ledger contiene anche i riferimenti e la preparazione dei compiti esclusi. Una sola lettura valida non misura il rumore tra letture; eventuali tentativi invalidi del banco sono elencati separatamente.

Il controllo whitespace di consegna esclude il contenuto delle patch archiviate e non blocca sulla riga vuota finale di `oracoli/shared/date-oracolo.ts`: entrambi sono conservati byte per byte per rispettare il congelamento. Comando ed eccezioni in `verifica-finale.json`, log integrale nella cartella esterna `qa/`.
