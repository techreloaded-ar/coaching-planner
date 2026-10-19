# Prompt di lancio della matrice completa

Da incollare in una nuova sessione Claude Code aperta su `coaching-planner`, con la modalità "ignora autorizzazioni" attiva e `claude auth login` già eseguito.

---

Esegui in autonomia il benchmark ARchetipo × Wiki descritto in `docs/benchmark/piano-benchmark-wiki.md`, usando l'harness in `bench/wiki-benchmark/` (leggi prima `bench/wiki-benchmark/README.md`). Le prove vanno in `~/repo/coaching-planner-bench-runs/`: non usare la cartella di calibrazione.

Fasi, in ordine:

1. **Preflight**: `python3 bench/wiki-benchmark/run.py preflight`. Se Docker o Postgres non rispondono, avviali (`open -a Docker`, poi `docker compose up -d`). Se la porta 3000 è occupata da un mio dev server, chiedimi prima di fermarlo. Se manca il login di `claude`, fermati e dimmelo.
2. **Matrice**: lancia in background `python3 -u bench/wiki-benchmark/run.py all`, con l'output su `~/repo/coaching-planner-bench-runs/run-all.log` (fuori dal sandbox). Segui il log con un monitor che segnali avvio e fine di ogni fase ed errori o tracce Python. Sono 4 chiarimenti e 10 prove sequenziali: ore di lavoro. Non usare polling ravvicinato.
3. **Errori**: ogni fase è idempotente. Se il processo si ferma, leggi il log e lo `stderr.txt` della fase e capisci la causa:
   - errore transitorio (rete, rate limit, crash del CLI) → rilancia lo stesso comando, riprende dalla fase interrotta;
   - bug dell'harness → correggilo con la modifica minima, annota la correzione in `bench/wiki-benchmark/CORREZIONI.md` (data, fase, causa, modifica) e rilancia. Non cambiare mai prompt, profilo del committente, rubrica, modelli o budget a matrice avviata: se servisse, fermati e chiedimi;
   - fase scartata per "configurazione contaminata" o budget esaurito → non forzarla, annotala e chiedimi come procedere.
   Non correggere mai il codice prodotto dagli agenti nei cloni delle prove.
4. **Valutazione**: a matrice completata, `python3 bench/wiki-benchmark/valuta.py all` (in background, con monitor). Per ogni prova controlla in `valutazione/adattatore.log` che l'adattatore non abbia dichiarato NonImplementato capacità che la consegna ha davvero. Se un adattatore è sbagliato (errore del banco, non della consegna), correggilo a mano in `valutazione/adattatore/`, annota la correzione in `CORREZIONI.md` e rivaluta solo quella prova con `valuta.py <run-id>`. Applica lo stesso criterio a tutte le prove.
5. **Report**: `python3 bench/wiki-benchmark/report.py`. Leggi `report.html` e verifica che i numeri della narrativa coincidano con `report-dati.json`. Se la narrativa contiene numeri assenti dai dati, rigenera con `report.py html` dopo aver corretto `narrativa.json`.
6. **Consegna**: pubblica `report.html` come artifact privato (deve essere autonomo, senza link a file locali: sostituisci i link alle cartelle delle prove con il percorso in testo). Poi dammi in chat: link, tabella riassuntiva (`run.py status` + punteggi), costo totale, correzioni del banco applicate, anomalie.

Regole: non leggere né modificare `.env` del progetto; non fare commit nel repository principale; tienimi aggiornato con una riga a ogni prova completata.
