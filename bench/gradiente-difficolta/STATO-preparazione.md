# Report 3 · Checkpoint del 23 ottobre 2026

Preparazione prevista dal §7 completata. **Nessuna delle 40 prove è stata avviata.** `conferma_40_prove` resta false; l’orchestratore si ferma prima di creare i cloni delle prove. Il prossimo passo richiede la conferma umana esplicita dopo la tabella degli indicatori. Il codice applicativo originale non è stato modificato; `.env` non è stato letto o modificato.

## Artefatti congelati

- H3 e soglie nell’indice e nel manifest, matrice di 40 prove con seme 2026102203 e ordine T3 → T1 → T4 → T2.
- Baseline main `157ea55367ec940b464d9ad2c64789b73535b463`.
- Variante spec V0: nessuna adozione documentata di V1. Skill congelate con gli hash del primo riferimento.
- Quattro profili nascosti, quattro riferimenti Opus completi, cinque fasi di riferimento auditate (T1 include correzione della facoltatività). Patch e metadati nel banco; sorgenti e sessioni nei cloni esterni.
- T4: difetto ai centesimi per riga in riepilogo e avanzamento; 11 pagine Wiki e 2 file unit rimossi. Baseline difettosa passa lint, 698 unit, build, 184 e2e. Dettagli in `difetto-T4.json` e riproduzione.
- Oracoli indipendenti: 24/24/24/25 controlli, copertura statica univoca. Runtime sulle sole baseline: T1–T3 rilevano capacità mancanti; T4 difettosa fallisce dieci controlli attesi, T4 sana supera tutti i venti controlli runtime.
- Migrazione con dati tarata sulle baseline: P1/P2 falsi senza nuova migrazione; T3 M1 falso, M2/M3 veri. Gate T4 G1/G2 provato con fixture positiva sintetica e controllo negativo. Primo bug del gate macOS e ripresa della fixture conservati nel registro.
- Quattro adattatori Opus tarati sulle firme dei riferimenti e tipizzati, **mai eseguiti sui riferimenti**. Audit comandi superato.
- Un chiarimento Opus V0 per compito con committente Opus separato: 2 storie T1, 3 T2, 4 T3, 1 T4. Storie congelate e non corrette dal banco. Due giudici Opus per compito: copertura 86,4 % / 81,8 % / 81,8 % / 63,6 % per T1/T2/T3/T4.
- Indicatori in `indicatori.json` e `.md`: conteggio file unit tramite profiler Node sulla baseline, oltre alle sonde dei test originali sui riferimenti. Queste sonde misurano manutenzione, non punteggi funzionali.
- `calibrazione.json` attesta evidenze e hash degli oracoli. Il runner controlla anche che non siano cambiati dopo il congelamento.
- 15 test del banco e 16 del report 1 passati; lint e guardrail e2e passati con warning preesistenti. Ricalcolo in memoria delle 40 consegne storiche con criterio tecnico parametrizzato: nessuna differenza.
- Pagina `bench/reports/gradiente-difficolta/preparazione.html` verificata a 1440 e 390 px, senza overflow della pagina. È una pagina di preparazione, non il report dei risultati.

## Budget attestato

Totale 41.11955280 USD su 750; preparazione e adattatori 35.87120280 USD su 120. Residui: 708.88044720 USD complessivi, 84.12879720 USD di preparazione. Sessioni con costo non attestato: 0. Inclusi scarti, correzione T1 e giudici.

## Limiti già noti

T1 tocca più directory di T2: gli indicatori non dimostrano l’ordinamento atteso. Sarà il controllo di manipolazione sui risultati di Sonnet diretto a stabilire se il gradiente ha retto. Rumore proveniente solo dalla chiusura mese; due repliche Opus hanno potenza indicativa del 22 % per rilevare 2 SD. T4 è manipolazione artificiale. Numero di storie diverso fra compiti, con effetto sul costo del completo. Possibile bias Opus nei riferimenti e negli adattatori.

Il riferimento T3 aveva tre suite e2e verdi nel fuso locale. I due tentativi aggiuntivi UTC falliscono su percorsi preesistenti (gestione utenti, scadenza sessione). Il primo sintomo è stato riprodotto anche sulla baseline con `TransactionWriteConflict`. Conservati tutti i log e trace; non si continua a ripetere fino al verde. La stabilità dei gate UTC non è dimostrata. Nessuna modifica applicativa o di test per nascondere gli errori. Vedi `diagnosi-ci.json`.

## Dopo la conferma

Registrare la conferma umana nella matrice con data e messaggio, senza cambiarne ordine o storie. Completare il cablaggio della valutazione su tre copie immutabili per consegna, usando gli script degli oracoli e `bench/common/tecnica.py` per coorte Tn; includere tutti i costi di adattatori e giudici e applicare i guardrail già presenti. L’attuale `esegui.py` avvia una singola prova protetta, non contiene ancora il driver completo di valutazione/analisi/report.

Poi eseguire le 40 prove nell’ordine congelato, fermandosi a qualunque result in errore o al tetto di budget; aggiornare costo e controllo di manipolazione dopo ogni compito. Solo dopo: eventuale T3 piano→diretto se resta budget, report finale, manifest `fatto` con esito H3, indice e commit del banco. Non creare risultati fittizi e non usare il riferimento come oracolo. Nessun commit finale prima della conclusione del report.

Tutti gli artefatti delle sessioni sono in `/Users/smarello/repo/coaching-planner-bench-runs/gradiente-difficolta/`. Nessun modello o server del banco è lasciato attivo al checkpoint.
