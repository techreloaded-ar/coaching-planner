# Emendamento prima delle prove · 23 ottobre 2026

Autorizzazione umana: «ok, direi di proseguire con il set ridotto, quello composto da solo 8 prove».

Il disegno originale di 40 prove resta conservato in `bench/wiki-benchmark/matrice-gradiente.json`, con conferma false. La matrice attiva è `matrice-gradiente-ridotta.json`: T3 poi T1; diretto/completo; Sonnet; repliche 1 e 2. L’ordine è il sottoinsieme della matrice randomizzata originale, selezionato prima di qualsiasi risultato.

- Budget incrementale massimo 80 USD dal costo attestato 41,1195528: tetto complessivo 121,1195528 USD, scarti e adattatori compresi. Nessuna estensione automatica, nessuna prova opzionale. Il costo di ogni nuova sessione è riservato prima del lancio.
- Stesse storie, profili, baseline, skill V0, oracoli e pesi già congelati. Nessuna nuova fase di scoperta o riferimento. Le capacità mancanti nelle storie non vengono aggiunte dal banco.
- Completo: plan → implement → review per storia, massimo **un** ciclo di rework; diretto invariato. Sessioni fresche, effort medium, precondizioni Wiki e hash, impostazioni project/local, stream JSON verbose, isolamento dall’originale.
- Una lettura funzionale per consegna, mantenendo tutti i controlli dei due oracoli, gate CI, migrazione con dati, concorrenza e autorizzazione. Nessuna stima del rumore tra letture. Un errore del banco conserva costo e tentativo, e viene corretto con lo stesso criterio su tutte le consegne interessate; non si sceglie il punteggio migliore tra tentativi.
- Tecnico: metriche automatiche del diff, complessità, duplicazione, tipi e test; niente mutation testing né giudici tecnici. Non si pubblica un punteggio tecnico /100 che fingerebbe di essere quello comune completo.
- Confronto esplorativo: punteggi di ogni replica, mediana/min/max e differenze per T1/T3. Con n=2 non si usano gli intervalli come prova forte di un vantaggio e non si conclude equivalenza dal silenzio dei dati.
- H3 originale **non verificabile integralmente**: T2, T4 e Opus non vengono eseguiti e il controllo T1→T4 non è disponibile. Il report conserva l’ipotesi originale, esplicita l’emendamento e limita le conclusioni a Sonnet/T1/T3.

Tutto il lavoro preparatorio già sostenuto resta nel costo complessivo, anche per T2/T4 esclusi. I costi dei percorsi sono riportati anche separatamente dalla preparazione, senza dividere silenziosamente i costi condivisi per prova.
