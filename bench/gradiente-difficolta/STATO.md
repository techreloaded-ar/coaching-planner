# Report 3 · concluso

8/8 consegne Sonnet T1/T3, due repliche per percorso, una lettura funzionale valida per consegna. Audit finale positivo: 52 fasi valide con sessioni fresche, hash skill congelati, costi riconciliati, codice immutabile e adattatori installati identici a quelli auditati. Tutte le 24 storie conservano i requisiti originali.

Spesa aggiuntiva: 51,7322563 USD su 80 autorizzati; totale 92,8518091 USD inclusi 41,1195528 già spesi. Residuo 28,2677437 USD sul tetto complessivo 121,1195528. Nessuna sessione a costo non attestato. Wall clock prima fase→ultima valutazione valida: 4,5742 ore, inclusi setup, diagnosi e correzioni del banco; preparazione precedente esclusa da questo tempo.

T1: 95,5/100 in tutte le quattro consegne. T3: 90,4/100 in tutte le quattro. Δ zero, entro il rumore storico, senza prova di equivalenza. Costo mediano di sviluppo completo/diretto: 5,18× T1, 5,54× T3; tempo 6,29× e 4,69×. T3: migrazione con dati, persistenza e concorrenza passano 4/4. Nessuna violazione critica osservata. Tutti gli otto gate CI passano e non ci sono nuovi errori tsc.

I fallimenti comuni sono S2 T1 (elenco escluso dalle storie) e C1/C2/U2 T3 (decorrenza al giorno 15 incompatibile con il vincolo mensile). Il committente simulato ha approvato questi restringimenti del profilo: diagnosi e dialoghi conservati, nessuna modifica post hoc di storie, giudizi o pesi. H3 originale non verificabile integralmente: T2/T4/Opus e controllo T1→T4 esclusi dallo scope autorizzato.

Due letture browser invalide (T3 COM r2 e DIR r1) sostituite ciascuna una sola volta su DB nuovo dopo diagnosi dell’alert globale Next; vecchie ricevute, trace e adattatori conservati. Gate e integrazione validi riusati; nessuna chiamata aggiuntiva a modelli e nessun cambio applicativo. Entrambe le ricevute finali sono 90,4. Una fase T3 scartata per falso positivo «worktree disabilitato», poi ripetuta da checkpoint: costo e tempo inclusi. Registro completo in CORREZIONI.md e correzioni-adattatori.json.

Il completo termina 10 storie DONE e 2 REVIEW. I rework T3 correggono Wiki/demo, senza cambi applicativi. Le review reagiscono diversamente ai tre errori Wiki preesistenti; alcune omettono CI impact assessment/demo/lettura semantica. Osservazioni e tool call conservati. Il gate esterno non sana omissioni del metodo di acceptance.

Verifiche: 20 test del banco e 16 storici passati; lint root passato dopo le modifiche e2e; py_compile passato; diff check del codice e dei documenti passato escludendo le patch archiviate e trattando la riga vuota finale del helper oracolo congelato come non bloccante. Log integrale conservato, byte degli artefatti invariati. QA del report finale a 1440/390: filtri 8→4→2, nessun errore JavaScript o overflow anche aprendo tutti i dettagli. Grafici con linee distinguibili anche quando coincidono. Evidenze visive nella cartella esterna qa/.

Report e dati in bench/reports/gradiente-difficolta/; manifest fatto e indice rigenerato. Artefatti CLI/DB/trace in /Users/smarello/repo/coaching-planner-bench-runs/gradiente-difficolta/. Nessuna modifica al codice applicativo originale, nessun accesso a .env. Nessuna prova aggiuntiva autorizzata o eseguita. Il checkpoint storico è conservato in STATO-preparazione.md.
