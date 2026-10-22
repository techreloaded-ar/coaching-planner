# Correzioni al banco applicate durante la matrice

## 2026-10-19 · opus-C2 / 01-diretto · più eventi `result` nello stesso stream

- **Causa.** L'agente ha lanciato la suite e2e in background e ha chiuso il turno; quando la notifica di fine
  task è arrivata, il CLI ha riaperto la sessione nello stesso processo `claude -p`, producendo una seconda
  coppia `init`/`result` nello stream. `run_claude` teneva solo l'ultimo `result`, in cui costo, `duration_api_ms`
  e `modelUsage` sono cumulativi ma `duration_ms` e `num_turns` no: la fase risultava 0.4 min e 3 turni a fronte
  di 12.5 min reali (wall 13.8 min) e 94 turni.
- **Modifica.** `run.py`: nuova `parse_stream()` che somma `duration_ms` e `num_turns` di tutti i `result` dello
  stream, tiene l'ultimo per i valori cumulativi e registra `result_events`. Nessun prompt, modello o budget toccato.
- **Dati.** `metrics.json` di `opus-C2/phases/01-diretto` ricalcolato dallo stream già salvato, senza rilanciare
  l'agente. A fine matrice tutti gli stream sono stati ricontrollati (il processo in corso usava ancora il codice
  precedente); vedi la nota in coda.

## 2026-10-20 · valutazione sonnet-C1 · adattatore browser, `messaggioErrore` troppo stretto (S1)

- **Causa.** L'adattatore generato cercava il testo del rifiuto solo dentro il form della nuova riga. La consegna,
  dopo il rifiuto del salvataggio da scheda obsoleta, ricarica la giornata e sostituisce il form con l'avviso
  `avviso-mese-chiuso` (stesso testo "Il mese è chiuso: le attività non sono modificabili"); lo snapshot
  `error-context.md` di S1 mostra l'avviso visibile e zero righe scritte. Il controllo falliva per il locator,
  non per la consegna.
- **Modifica.** `sonnet-C1/valutazione/adattatore/browser.ts`: `messaggioErrore` cerca il testo in tutta la pagina.
  Nessun'altra modifica all'adattatore; la consegna non è stata toccata.
- **Rivalutazione.** `valuta.py sonnet-C1` dopo la fine di `valuta.py all` (porta 3000 condivisa).

## 2026-10-20 · oracolo · P3 confrontava anche il campo di stato aggiunto al report

- **Causa.** `oracolo/integrazione.test.ts`, controllo P3 ("chiudere non altera righe né report di fatturazione"):
  il commento dichiara che un campo di stato aggiunto dalla consegna va ignorato, ma il confronto usava le chiavi
  del report *prima* della chiusura. Una consegna che espone sempre `meseChiuso` nel report (sonnet-C3, US-062)
  aveva la chiave già presente con `false`, poi `true`: il controllo falliva pur con importi identici.
- **Modifica.** Il confronto usa solo i campi della baseline (`token`, `perCliente`, `totali`, da
  `src/lib/report.ts` al commit baseline). Rubrica e pesi invariati. Il cambiamento può solo trasformare un
  fallimento in successo, quindi le prove già valutate che avevano P3 superato (sonnet-C1, sonnet-C2) restano valide.
- **Rivalutazione.** `valuta.py sonnet-C3` a fine `valuta.py all`; le prove successive ricevono la copia corretta
  dell'oracolo al momento della loro valutazione (verificato sul file copiato in `valutazione/repo/__oracolo__/`).

## 2026-10-20 · valutazione sonnet-C3 · adattatore browser, `messaggioErrore` (S1)

- **Causa.** Stesso caso di sonnet-C1: l'adattatore cercava il box `errore-salvataggio-riga` nel form, ma la
  consegna dopo il rifiuto ricarica la giornata e mostra l'avviso `avviso-mese-chiuso` ("Il mese è chiuso: non è
  possibile modificare attività e rimborsi") al posto del form; nessuna riga scritta (snapshot `error-context.md`).
- **Criterio applicato a tutte le prove.** L'avviso di mese chiuso che sostituisce il form dopo il rifiuto vale
  come "errore chiaro, nessun falso successo"; un salvataggio silenziosamente ignorato o un falso successo no.
- **Modifica.** `sonnet-C3/valutazione/adattatore/browser.ts`: `messaggioErrore` accetta anche `avviso-mese-chiuso`.

## 2026-10-20 · valutazione sonnet-C4 · adattatore browser, `messaggioErrore` (S1)

- **Causa.** Come sonnet-C1 e sonnet-C3: dopo il rifiuto la consegna mostra lo status `mese-chiuso`
  ("Il mese è chiuso: le attività non sono modificabili") al posto del form; nessuna riga scritta.
- **Modifica.** `sonnet-C4/valutazione/adattatore/browser.ts`: `messaggioErrore` accetta anche `mese-chiuso`.
  Rivalutazione a fine `valuta.py all`.

## 2026-10-20 · valutazione sonnet-C5 · adattatore browser, `messaggioErrore` (S1)

- **Causa.** Come le prove precedenti: dopo il rifiuto la consegna mostra lo status `indicazione-mese-chiuso`
  ("Mese chiuso — le attività e i rimborsi non sono modificabili.") al posto del form `#form-riga`.
- **Modifica.** `sonnet-C5/valutazione/adattatore/browser.ts`: `messaggioErrore` accetta anche l'indicazione.
  Rivalutazione a fine `valuta.py all`.

## 2026-10-20 · valutazione opus-C3 · adattatore integrazione, `storico` dichiarato NonImplementato per intero

- **Causa.** La consegna ha il solo modello `ChiusuraMese` (mese unico, `chiusoIl`, `chiusoDaUtenteId`) e la
  riapertura cancella la riga: non esiste uno storico, ma autore e momento della chiusura in vigore sono
  registrati (controllo T1). L'adattatore lanciava `NonImplementato` su tutto `storico`, facendo fallire anche
  T1 e K2, che la consegna soddisfa.
- **Modifica.** `opus-C3/valutazione/adattatore/integrazione.ts`: `storico` legge la riga `ChiusuraMese` così
  com'è (un evento di chiusura se presente, nessuno altrimenti, motivazione `null`). Nessuna capacità aggiunta:
  T2 (tre eventi con motivazione) continua a fallire perché le riaperture non sono registrate.
- **Criterio.** Stesso delle altre prove: NonImplementato solo per ciò che la consegna non ha davvero; i dati
  presenti si leggono senza reinterpretarli.

## 2026-10-20 · valutazione opus-C3 · adattatore browser, `messaggioErrore` (S1)

- Come le prove precedenti: lo status `avviso-mese-chiuso` ("Mese chiuso: le attività non sono più
  modificabili") sostituisce il form dopo il rifiuto. `messaggioErrore` lo accetta. Rivalutazione a fine ciclo.

## 2026-10-20 · valutazione opus-C5 · adattatore integrazione, `storico` dichiarato NonImplementato per intero

- Stesso caso di opus-C3: `ChiusuraMese` (anno, mese, `chiusoIl`, `chiusoDaUtenteId`), riapertura che elimina la
  riga, nessuna motivazione. `storico` ora legge la riga così com'è (un evento di chiusura o nessuno).
  T2 continua a fallire legittimamente. Rivalutazione a fine ciclo.

## 2026-10-20 · nota di chiusura della valutazione

- `valuta.py all` è stato lanciato due volte: il primo lancio si è interrotto su sonnet-C2 per il limite di sessione
  del CLI durante la generazione dell'adattatore (errore transitorio, 0.49 USD); il secondo ha completato le 10 prove
  e ha rivalutato sonnet-C1 con l'adattatore corretto.
- Rivalutate con `valuta.py <run-id>` dopo le correzioni degli adattatori: sonnet-C3, sonnet-C4, sonnet-C5, opus-C3,
  opus-C5. Le altre prove (sonnet-C1 già rivalutata, sonnet-C2, opus-C1, opus-C2, opus-C4) non avevano errori del banco.
- Il controllo P3 corretto è stato applicato a tutte le prove valutate dopo la correzione; per le precedenti
  (sonnet-C1, sonnet-C2) P3 era già superato e la correzione non può cambiare un esito positivo.

## 2026-10-20 · esperimento Wiki (matrice-wiki.json) · `wiki.enabled` assente nel config

- **Causa.** `.archetipo/config.yaml` del progetto non ha la chiave `wiki.enabled`; `archetipo config show` la
  riporta `false` anche quando `docs/wiki/` esiste. I comandi `archetipo wiki …` funzionano comunque, ma gli agenti
  leggono il flag: in `sonnet-PW-1` plan e implement hanno fatto 0 operazioni Wiki ("Wiki: non abilitato, quindi
  nessun impatto"), mentre in sonnet-C1 le stesse skill ne facevano 5–11. La cella "con Wiki" non era controllata.
- **Modifica.** `run.py`, `setup_clone`: nei cloni con Wiki aggiunge `wiki: enabled: true` al config (commit
  "bench: wiki abilitata"). Vale per chiarimenti e prove dell'esperimento.
- **Dati.** `sonnet-PW-1` (US-060 completata, US-061 plan interrotto, ~4 USD) e i chiarimenti replicati con Wiki
  (`D-*-wiki-r2/r3`) eseguiti col flag false sono stati spostati in `_scartati/*-wikidisabled` e rifatti.
- **Nota per la matrice principale.** Tutte le prove della matrice principale hanno girato con il flag false:
  la condizione "con Wiki" significava "pagine presenti, flag non dichiarato". Gli agenti hanno comunque usato la
  Wiki nelle pipeline ARchetipo (C1: 74 e 119 operazioni) e nelle fasi `archetipo-wiki refresh`, ma in sonnet-C4 la
  review ha saltato il gate Wiki proprio per il flag. Il report pubblicato lo riporta tra le osservazioni.

## 2026-10-20 · esperimento Wiki · fasi vuote registrate come completate dopo il limite di sessione

- **Causa.** `run_claude` interrompeva la matrice solo se il `result` in errore conteneva "authenticate". Al
  limite di sessione del CLI ("You've hit your session limit · resets 1:20pm") il `result` ha `is_error: true` ma
  la fase veniva comunque registrata (0 turni, 0 USD) e la matrice proseguiva: 14 fasi vuote da `opus-PW-1`
  US-061-implement-1 fino a `opus-DN`.
- **Modifica.** `run.py`: qualunque `result` con `is_error` termina il processo senza scrivere `metrics.json`.
- **Dati.** Fasi vuote eliminate (le fasi valide di `opus-PW-1` restano), `run.json` delle prove coinvolte rimossi;
  rilancio dello stesso comando dopo il reset del limite. Nessun costo perso.
- **Addendum.** Anche `opus-PW-1` / US-061-plan-1 era in errore per il limite (interrotta a metà, 2.11 USD, piano
  non salvato ma commit parziale); l'implement successivo ha rifiutato perché la spec era ancora TODO. Fasi US-061
  rimosse, clone riportato al commit di US-060-implement-1, prova completata con un nuovo lancio di `run.py all`.
  Costo perso: 2.11 USD (plan) più l'implement a vuoto (4 turni, metriche non conservate).

## 2026-10-20 · esperimento Wiki · adattatori browser, `messaggioErrore` (S1)

Stesso criterio della matrice principale: dopo il rifiuto del salvataggio da scheda obsoleta la consegna ricarica
la giornata e mostra l'avviso di mese chiuso al posto del form; l'avviso vale come messaggio chiaro. Prove corrette
e rivalutate a fine `valuta.py all`:
- sonnet-PW-1: `messaggioErrore` accetta anche `mese-chiuso-avviso`.
- sonnet-PW-2: `messaggioErrore` accetta anche lo status con il testo di mese chiuso.
- opus-PW-1: `messaggioErrore` accetta anche lo status "Mese chiuso: le attività non sono più modificabili".
- opus-PW-2: `messaggioErrore` accetta anche lo status "Mese chiuso: le attività non sono più modificabili".

## 2026-10-20 · esperimento Wiki · sonnet-PW-1, U1 in timeout alla rivalutazione

- Alla prima valutazione U1 ("riapertura dall'interfaccia") era superato; alla rivalutazione (stesso adattatore,
  stessa consegna) è andato in timeout a 90 s in attesa del campo "Motivazione" nella pagina di riapertura, mentre
  in parallelo giravano le sessioni del giudice delle scelte funzionali. Esito ambientale, non della consegna:
  la prova viene rivalutata una terza volta a macchina scarica e si riportano entrambi gli esiti.
- **Esito.** Terza e quarta valutazione di sonnet-PW-1: U1 ancora in timeout (nella terza anche un e2e della
  baseline in timeout per carico macchina: Spotlight e app utente dopo il riavvio). In isolamento, dopo aver
  riaperto il mese, U1 passa in 1,8 s: il prodotto è corretto. Causa: `chiudiMese` dell'adattatore tornava appena
  visibile il badge "Chiuso" mentre la server action poteva essere ancora in volo, e il `goto` successivo trovava il
  mese ancora aperto. Adattatore corretto con `waitForLoadState("networkidle")` dopo l'esito di chiusura e
  riapertura; quinta valutazione. Esiti registrati: 84.7 (S1 adattatore), 88.7 (U1 timeout), 80.7 (U1 + e2e timeout),
  88.7 (U1 timeout), poi il definitivo.
- **Definitivo.** Quinta valutazione di sonnet-PW-1 con l'adattatore corretto: 90.7/100 (U1 e S1 superati).

## 2026-10-21 · report 4 (qualità tecnica) · copia valutata con un commit del banco dopo la consegna

- **Causa.** In alcune prove (`opus-DN` e le altre con `storie_da_wiki`) `valuta.py` ha aggiunto alla copia
  `valutazione/repo` il commit «bench: wiki abilitata» (solo `.archetipo/config.yaml`) dopo il commit della consegna:
  l'albero di HEAD non coincide con `tree_hash` di `run.json` e `tecnica.py misura all` si fermava.
- **Modifica.** `bench/common/tecnica.py`, `repo_di()`: cerca nella storia il commit con l'albero registrato in
  `run.json`, lo usa come riferimento del diff e verifica che la differenza con HEAD stia fuori da `src/`, `tests/`
  e `prisma/`. Gli strumenti (ESLint, jscpd, Stryker, tsc) leggono il working tree, identico alla consegna fuori da
  `.archetipo/`. Nessuna consegna toccata. `misura all` e `giudice all` proseguono dopo l'errore di una prova.

## 2026-10-21 · report 4 · giudice a checklist: diff ristretto dopo la prima lettura

- **Causa.** La prima lettura del giudice Opus su `sonnet-C1` con il diff completo (src, tests, prisma: 108 kB) è
  costata 1,34 USD; la stima per 20 consegne × 2 letture superava il budget di 40 USD.
- **Modifica.** Il giudice legge il diff di `src/**/*.ts`, `tests/` e `prisma/schema.prisma`: componenti React
  (`.tsx`) e migrazioni SQL esclusi, dichiarato nel prompt e nel report. Le tre domande (copertura dei percorsi,
  factory e fixtures nei test e2e, blocco di dominio in una funzione condivisa chiamata dalle server action)
  non riguardano i componenti. Stesso diff per tutte le consegne; la seconda lettura riusa il prompt in cache.
- **Dati.** La lettura con il diff completo è conservata in `sonnet-C1/tecnica/giudice-1-scartato-diff-completo.json`
  e conteggiata tra le prove scartate (1,34 USD).

## 2026-10-21 · report 4 · tsc sulla baseline e categoria «mockup»

- `tsc --noEmit` sulla copia valutata segnala 2 errori in `__oracolo__/` (file dell'oracolo copiati da `valuta.py`,
  non della consegna): esclusi. La baseline è il repository principale (0 errori, sha registrato in
  `_baseline/tsc-baseline.json`), non `git archive` della radice, che non ha il client Prisma generato (117 errori).
- La classificazione del diff prevede la categoria «mockup» (`docs/mockups/`), assente dalla legenda §6.2: aggiunta
  a `bench/common/html.py` con il colore di archetipo-design e dichiarata nell'indice.

## 2026-10-21 · report 6 (fase spec) · pattern di invalidità troppo largo nel pilota

- **Causa.** Il controllo che scarta una fase se dichiara una risorsa «non abilitata» cercava `non abilitat` ovunque nel
  dialogo e nei transcript; «offerta non abilitata» e «cliente non abilitato» sono termini di dominio di Coaching Planner
  (abilitazioni esplicite) e il pilota `S-V4-opus-r04` è stato marcato invalido per cinque citazioni di quel tipo.
- **Modifica.** `bench/fase-spec/run.py`: il pattern richiede la vicinanza di «wiki» (o `E_PRECONDITION`,
  `wiki.enabled … false`). Comando `convalida <id>` che ricontrolla i testi salvati e scrive `discovery.json` senza
  rilanciare l'agente. Il pilota è stato convalidato (precondizioni tutte vere, 4 storie, 22 punti dal revisore avversario).
- **Dati.** Nessun costo perso. Nei due piloti (`S-V4-opus-r04`, `S-V0-sonnet-r01`) la ripartizione dei minuti per fase
  usa la prima euristica (subagente sottratto alla fase più lunga) perché i turni non avevano ancora le finestre temporali;
  nelle altre 98 celle la revisione avversaria è sottratta al turno in cui il subagente è partito.
- **Nota di disegno.** Il committente simulato è Opus effort low (la matrice principale usava Sonnet low); il clone non ha
  database né migrazioni (il chiarimento non avvia l'app); due celle girano in parallelo con lock per cella.

## 2026-10-21 · report 6 · limite di sessione del CLI alle 12:58 (reset 15:00)

- **Fasi coinvolte.** `S-V1-opus-r07` (turno 1 in corso) e `S-V4-opus-r08` (turno 2 in corso): `result` in errore
  («You've hit your session limit · resets 3pm»), orchestratore fermato come previsto, nessun `metrics.json` scritto.
  Il giudice ha registrato tre letture vuote su `S-V2-sonnet-r02` (costo 0), rifatte al rilancio.
- **Ripresa alle 15:02.** Stesso comando (`run.py all --paralleli 2`): le due celle ripartono dall'inizio sul clone
  riportato alla baseline (`git reset --hard`); il costo dei turni persi è annotato nel report tra le voci scartate.

## 2026-10-21 · report 6 · secondo limite di sessione del CLI alle 16:08 (reset 20:00)

- **Fasi coinvolte.** `S-V4-opus-r05` (turno 2) e `S-V4-sonnet-r09` (turno 3), `result` in errore, nessun `metrics.json`.
  Ripresa alle 20:13 con lo stesso comando; costo dei turni persi in `fase-spec/costi-persi.json`, riportato nel report.

## 2026-10-21 · report 6 · stop per budget alle 20:31 a 98 celle su 100

- Il controllo del budget (proiezione = costo registrato + giudice residuo + margine) ha fermato l'orchestratore a
  119,86 USD: `S-V2-sonnet-r10` e `S-V3-sonnet-r10` erano in corso (0,63 USD persi) e non sono state rieseguite.
  Totale registrato 121,54 USD contro un tetto di 120: lo sforamento viene dai 4,18 USD di turni persi nelle
  interruzioni. Le due celle mancanti restano nella matrice e possono essere eseguite con `run.py cella <id>`.

## 2026-10-21 · report 1 · preparazione del disegno e del banco

- Matrice `matrice-rumore.json`: 20 nuove prove (DIR/COM × Sonnet/Opus × 5), ordine randomizzato con seme `2026102101`; secondo adattatore sulla prima prova di ogni cella. H1 nel manifest invariata; stato «in corso».
- `run.py`: completate e verificate le modifiche locali già presenti all'avvio. Pipeline `diretto` con la sola `01-diretto`, senza refresh; precondizioni prima di ogni fase (Wiki, skill, flag da CLI, SHA-256 delle cartelle delle skill); invalidità limitata alle dichiarazioni sulla Wiki o a `E_PRECONDITION`. Le storie vengono dai chiarimenti `D-<modello>-wiki`, riusati senza nuove sessioni. Fasi valide e consegne complete non si ripetono.
- Ripresa: un tentativo interrotto viene conservato in `_scartati`, con stream, costo, orario e commit precedente; il clone riparte da quel commit, anche se l'agente aveva fatto commit parziali. Qualunque result in errore invalida la sessione e ferma l'orchestratore.
- Budget: costi nuovi della sola matrice (incluse sessioni interrotte, scarti, adattatori e giudici tecnici); stop dei nuovi lanci a costo registrato + 0.80 USD per adattatore residuo ≥ 345 USD. Inoltre non si lancia una sessione il cui budget massimo potrebbe superare il tetto di 350 USD. Budget per fase invariati (25/60 USD, adattatori 15 USD).
- `valuta.py`: opzioni `--replica 1|2|3` e `--adattatore 1|2`; ogni replica ha `evaluation-N.json` e log distinti. `evaluation.json` è la vista compatibile della mediana solo dopo tre letture. Secondo adattatore in `valutazione/adattatore-2/`, sessione Opus nuova con identico prompt, senza accesso al primo adattatore. Nessuna modifica a contratto, controlli, pesi o prompt di generazione. Un result in errore ferma anche la generazione degli adattatori; i log dei tentativi sono conservati.
- `pavimento-rumore/esegui.py`: due piloti Sonnet (prima DIR e prima COM nell'ordine della matrice), poi proiezione; hook dopo ogni consegna per tre valutazioni sequenziali e misura tecnica. `finalizza` esegue i quattro adattatori indipendenti, misure e giudici tecnici, tutti in sequenza; le narrative restano da rivedere sui dati effettivi.
- Verifica senza spesa: preflight passato (Docker/Postgres, porta 3000, autenticazione CLI); sei test del banco passati (matrice, result multipli, mediana, conteggio costi, idempotenza e falso positivo di dominio). Non letto né modificato `.env` del progetto; nessuna modifica al codice delle consegne.

## 2026-10-21 · report 1 · generatore, integrità delle letture e report 4

- Generatore `bench/pavimento-rumore/report.py`: dati grezzi, quattro celle, SD pooled entro cella, potenza tramite distribuzione t non centrale (scipy 1.17.1 disponibile nel banco), MDE a n=5 e numerosità per 2/5/10 punti; bootstrap appaiato k contro k a 10 000 ricampionamenti, seme `2026102102`, stratificato per modello nell'aggregato. Nessuna inferenza definitiva finché mancano le repliche. La vista HTML provvisoria espone tutte le 20 righe, indicando quelle in attesa, con filtri combinati per modello e cella.
- La tabella sempre/a volte/mai usa la maggioranza delle tre letture per il singolo controllo nella singola consegna; non cambia il punteggio (che resta mediana dei tre totali). I controlli mancanti, per esempio per crash del runner, invalidano la lettura invece di ridurre il denominatore della rubrica. Ogni tentativo incompleto conserva i suoi log prima della ripresa.
- `parse_stream` ignora soltanto un'ultima riga JSON incompleta mentre lo stream è in scrittura, per consentire il monitor dei costi; errori nelle righe precedenti restano errori. Gli stream di una sessione ripresa sono letti in ordine per evitare doppi conteggi cumulativi.
- `tecnica.py giudice` conserva ora il JSON e il costo di una lettura incompleta prima del nuovo tentativo. Criteri, prompt, pesi e budget del giudice invariati.
- Il generatore del report 4 riconosce le nuove configurazioni DIR e COM; i confronti storici restano separati, mentre le mediane di coorte includeranno tutte le nuove consegne. La sua narrativa e la registrazione nell'indice saranno aggiornate solo sui dati finali.
- Dieci test del banco passati, compresi SD pooled, bootstrap appaiato e potenza. La verifica visiva del report provvisorio è ancora da completare: browser integrato in timeout sul server locale (HTTP 200 da curl), Safari via CUA in timeout; apertura del file nel pannello Codex accodata.


## 2026-10-21 21:16 CEST · report 1 · pilota R-DIR-sonnet-r1, adattatore S1

- Prima consegna in 12,3 minuti, 2,02 USD; adattatore 0,66 USD. Tre letture iniziali identiche a 84,7/100. Audit: nessun NonImplementato; S1 fallisce perché il form viene sostituito dall’avviso `mese-chiuso`, visibile nello snapshot con zero righe salvate.
- Applicato il criterio già registrato per i report precedenti: `messaggioErrore` accetta anche l’avviso; attesa `networkidle` dopo chiusura/riapertura per completare la server action. Nessun codice della consegna modificato.
- Archiviate tutte e tre le letture e i log originali in `/Users/smarello/repo/coaching-planner-bench-runs/R-DIR-sonnet-r1/valutazione/scartate/adattatore-S1-20261021T2118`; da rifare in sequenza a macchina scarica dopo il pilota COM, già in corso. Le letture originali non entrano nel calcolo del rumore. C2/C3, V1 e U2 restano fallimenti da verificare sulla consegna, senza correggerla.


## 2026-10-21 22:31 CEST · report 1 · piloti verificati e matrice avviata

- Rivalutazione completa del pilota DIR con adattatore corretto: 90,7/100 in tutte e tre le letture, nessuna violazione critica. Misura tecnica aggiornata conservando il mutation score 0,3695. Le letture a 84,7 rimangono archiviate e sono escluse dal rumore.
- Pilota COM: 51,0 minuti, 10,19 USD di sviluppo, tre letture a 88,2/100, nessuna violazione critica. Audit dell’adattatore: storico letto dalla persistenza, NonImplementato su V4 perché i report non mostrano lo stato; S1 usa già il messaggio sia nel form sia nel banner.
- Proiezione comunicata prima del lancio restante: prove 288,94 USD, adattatori 19,20, giudici tecnici stimati circa 17,49: totale stimato 325,63 USD. Tempo 10,6 ore sviluppo + 6–8 ore valutazione, esclusi reset e misure tecniche; costo consolidato 13,55 USD.
- Ripresa con `BENCH_MATRICE=matrice-rumore.json python3 -u bench/wiki-benchmark/run.py all`, log `~/repo/coaching-planner-bench-runs/run-rumore.log`; piloti riusati idempotentemente. Nessuna modifica al disegno congelato.


## 2026-10-21 23:03 CEST · report 1 · contaminazione dello stdin nel lancio in background

- Causa: il lancio Python tramite heredoc non chiudeva stdin dei processi figli. Claude CLI ha accodato al prompt anche 2 903 caratteri dello script di avvio (primo messaggio del transcript: 3 451 caratteri anziché 548). Confermato per `R-DIR-opus-r1` e `R-DIR-sonnet-r5`; entrambe sono invalide e vanno rifatte. La prima ha speso 7,17 USD di sviluppo più 0,70 USD di adattatore; la seconda è ancora in corso.
- I piloti sono verificati: diretto coincide esattamente con prompt.txt; plan/implement hanno soltanto il normale wrapper slash-command della CLI; tutte le review coincidono con i prompt attesi. Restano validi.
- Il banco ha sospeso l’orchestratore 61372 per impedire altri lanci. Lascia terminare solo il worker già attivo per conservarne il result e il costo; poi un recovery locale archivia le due prove e rilancia lo stesso comando.
- Correzione: stdin=subprocess.DEVNULL per worker, adattatori, giudice Wiki e committente che ricevono il prompt come argomento; il giudice tecnico continua a ricevere il suo prompt previsto via input. Nuovo controllo del messaggio iniziale nel transcript principale, con riconoscimento della slash-command. Prompt scientifici, matrice, modelli e budget invariati. Dodici test del banco passati.


## 2026-10-21 23:34 CEST · report 1 · ripresa dopo contaminazione stdin

- Orchestratore precedente terminato dopo la conclusione della sessione già attiva, senza avviare altre fasi. Archiviate integralmente `R-DIR-opus-r1` e `R-DIR-sonnet-r5` sotto `_scartati/*--stdin--*`, inclusi stream, adattatore e valutazioni; i piloti Sonnet restano validi.
- Costi consolidati al rilancio: 24.4208 USD, di cui prove scartate 10.1774 USD. I costi degli adattatori scartati sono conservati nella voce adattatori.
- Rilanciato lo stesso `run.py all` con stdin nullo; nessun prompt, modello, rubrica o budget modificato.


## 2026-10-22 04:38 CEST · report 1 · pause di sospensione del Mac

- `pmset -g log` conferma Idle Sleep dalle 02:47:31, successive finestre DarkWake e nuova sospensione 03:12:59–03:28:26 e 03:29:03–03:42:46. Il gate e2e della replica 1 di R-COM-sonnet-r3, iniziato alle 03:12:33, ha attraversato tali pause. Il wall time è quindi ambientale; non attribuirlo alla consegna.
- Attivato `caffeinate -i -s -w 86336` (PID 42633) soltanto per la durata dell’orchestratore, senza modificare impostazioni persistenti o tenere acceso il display. A ogni eventuale rilancio dell’orchestratore rinnovare l’assertion per il nuovo PID.
- Verificare gli esiti del gate a fine replica, conservare i log e rivalutare le letture colpite da timeout di sospensione; non correggere il codice della consegna.
