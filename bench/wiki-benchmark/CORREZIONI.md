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


## 2026-10-22 04:54 CEST · report 1 · esito delle valutazioni durante le pause Mac

- R-COM-sonnet-r3: tutte e tre le letture danno 88,2/100, tutti i gate passano. I tempi wall e2e sono 2 806,8, 1 956,6 e 311,2 secondi a causa delle sospensioni: non sono prestazioni della consegna. Nessun timeout o esito da invalidare, nessuna rivalutazione aggiunta. caffeinate resta attivo fino alla fine dell’orchestratore.


## 2026-10-22 06:40 CEST · report 1 · R-DIR-sonnet-r3, adattatore S1

- Consegna in 9,9 minuti, 1,91 USD. Tre letture iniziali 88,2 / 82,2 / 82,2: la differenza è S1, locator limitato al form che dopo il rifiuto è sostituito dall’avviso di mese chiuso. Snapshot: status visibile, zero righe scritte.
- Stesso criterio dei precedenti adattatori: ricerca del messaggio in tutta la pagina e networkidle dopo chiusura/riapertura. Nessun codice della consegna modificato. Tre letture, log e adattatore precedente conservati in `/Users/smarello/repo/coaching-planner-bench-runs/R-DIR-sonnet-r3/valutazione/scartate/adattatore-S1-20261022T064029`; non entrano nel calcolo del rumore.
- Coda di rivalutazioni documentate elaborata sequenzialmente dall’hook dopo la consegna corrente, prima di avviare altri worker. Conservato il mutation score; aggiornare qualità e gate tecnici dalla nuova mediana.


## 2026-10-22 07:26 CEST · report 1 · R-COM-sonnet-r2, adattatore S1

- Tre letture iniziali 82,2/100: S1 cerca l’alert solo dentro il form, mentre lo snapshot mostra il banner di mese chiuso e zero righe scritte. Applicato lo stesso criterio di DIR-r1 e DIR-r3: include `mese-chiuso-banner` e attende networkidle dopo chiusura/riapertura. Nessuna consegna modificata.
- Conservate le tre letture e i log in `/Users/smarello/repo/coaching-planner-bench-runs/R-COM-sonnet-r2/valutazione/scartate/adattatore-S1-20261022T072605`. Rivalutazione da eseguire in sequenza; l’hook attuale sta già rivalutando DIR-r3, perciò un helper attende la sua uscita prima di accodare COM-r2, evitando di perdere la nuova voce quando il vecchio processo scrive la coda. Le nuove invocazioni rileggono la coda prima di rimuovere una voce completata. Test di concorrenza della coda aggiunto: quindici test del banco passati.


## 2026-10-22 08:40 CEST · report 1 · R-COM-sonnet-r4, adattatore S1 e U1

- Tre letture iniziali 82,6. S1: il locator attende aria-busy=false sul pulsante del form, che viene rimosso e sostituito dall’avviso dopo il rifiuto (snapshot: avviso visibile, zero righe). Correzione uniforme: attendere fine richieste e accettare l’avviso al posto del form.
- U1: il form di riapertura e il suo esito locale sono renderizzati soltanto finché il mese è chiuso (`page.tsx`, condizione statoMese.chiuso). La riapertura aggiorna la riga ad Aperto e rimuove il form, quindi attendere il suo esito locale non misura l’operazione. Adattatore ora attende `rigaMese` con testo Aperto, esattamente come il test della consegna `chiusura-mese-riapertura.spec.ts:135`, poi networkidle. Nessuna logica aggiunta al prodotto.
- Letture, log e adattatore precedenti conservati in `/Users/smarello/repo/coaching-planner-bench-runs/R-COM-sonnet-r4/valutazione/scartate/adattatore-S1-U1-20261022T084037`; nuova serie accodata dietro COM-r2 attualmente in rivalutazione, in sequenza.


## 2026-10-22 08:54 CEST · report 1 · esito delle rivalutazioni COM Sonnet

- R-COM-sonnet-r2: tre nuove letture a 88,2 (S1 corretto). R-COM-sonnet-r4: tre nuove letture a 90,6 (S1 e U1 corretti). Gate tutti superati, nessuna violazione critica. Letture precedenti conservate ed escluse dalla stima del rumore; misure tecniche aggiornate senza ripetere i mutanti. Coda completata prima di avviare DIR Opus r2.


## 2026-10-22 11:25 CEST · report 1 · R-COM-opus-r1, adattatore S1

- Consegna conclusa in 88,7320 minuti e 27,445537 USD. Tre letture originali 87,8 / 81,8 / 81,8: S1 cerca il messaggio dentro `#form-riga`, mentre lo snapshot mostra il medesimo messaggio nell’avviso `avviso-mese-chiuso` e zero righe scritte.
- Applicato il criterio comune: aggiunto il locator dell’avviso e networkidle dopo chiusura/riapertura. Nessuna modifica al prodotto. Conservati adattatore originale, tutte e tre le letture, log e snapshot tecnico in `/Users/smarello/repo/coaching-planner-bench-runs/R-COM-opus-r1/valutazione/scartate/adattatore-S1-20261022T112536`. Letture escluse dalla stima del rumore.
- Rivalutazione accodata dopo R-DIR-opus-r5 già avviata; non avviare sessioni concorrenti. Conservare il mutation score 0,3169 e aggiornare tecnica dopo le nuove letture. Costi consolidati 168,7305933 USD, residuo 181,2694067. Nessun limite Claude o stop budget.


## 2026-10-22 12:26 CEST · report 1 · esito rivalutazione COM Opus r1

- Tre nuove letture identiche a 87,8 con adattatore S1 corretto; gate passati, nessuna violazione critica. Tecnica aggiornata senza ripetere i mutanti (0,3169). Coda completata prima di DIR Opus r3; originali 87,8/81,8/81,8 conservate ed escluse dal rumore.


## 2026-10-22 14:30 CEST · report 1 · R-DIR-sonnet-r2, adattatore S1

- Consegna in 10,0570 minuti e 1,6309366 USD. Tre letture iniziali 82,2. S1 attende aria-busy sul pulsante del form che scompare dopo il rifiuto. Snapshot: avviso «Il mese è chiuso: le attività non sono modificabili», zero righe scritte.
- Correzione uniforme: networkidle al posto dell’attesa sul pulsante, messaggio accetta `avviso-mese-chiuso`, networkidle dopo chiusura/riapertura. Nessuna modifica alla consegna. V1 e V4 restano mancanze del prodotto, senza correggerle.
- Tutte le letture, log, adattatore precedente e tecnica conservati in `/Users/smarello/repo/coaching-planner-bench-runs/R-DIR-sonnet-r2/valutazione/scartate/adattatore-S1-20261022T143118`; esclusi dal rumore. Rivalutazione accodata dopo COM Opus r2 attualmente in corso, mantenendo mutation 0,3791.


## 2026-10-22 16:27 CEST · report 1 · esito rivalutazione DIR Sonnet r2

- Tre nuove letture identiche a 88,2 dopo correzione S1; gate passati, nessuna violazione critica. Tecnica aggiornata conservando mutation 0,3791. Originali 82,2 × 3 archiviate ed escluse dal rumore. Coda completata prima di DIR Sonnet r4.


## 2026-10-22 20:39 CEST · report 1 · secondo adattatore DIR Sonnet r1, S1

- Quattro secondi adattatori generati indipendentemente e auditati. DIR Sonnet r1: tre letture 84,7, errore S1 perché il messaggio è cercato solo nel form sostituito dal banner. Stessa correzione del primario: messaggio in pagina e networkidle dopo chiusura/riapertura. Nessuna consegna modificata.
- Tutte e tre le letture, log e adattatore originale conservati in `/Users/smarello/repo/coaching-planner-bench-runs/R-DIR-sonnet-r1/valutazione/adattatore-2/scartate/adattatore-S1-20261022T204038` ed esclusi dal rumore. Rivalutazione secondaria pendente, da eseguire solo dopo fine finalizza PID 798. Gli altri tre secondi adattatori concordano col primario: 87,8 DIR Opus, 88,2 COM Sonnet, 87,8 COM Opus (tre letture ciascuno).


## 2026-10-22 20:52:51 CEST · report 1 · limite sessione Claude

- Fase: giudice tecnico R-DIR-opus-r4, lettura 2 (ultima delle 40). Risposta API 429 `usage_limit_reached`, reset dichiarato alle 21:10 Europe/Rome; tentativo 0 USD. Evidenza conservata in tecnica/giudice-2.json, da archiviare automaticamente prima della ripresa. Le altre 39 letture tecniche sono complete.
- Alle 21:39, dopo il reset, ripreso lo stesso comando `BENCH_MATRICE=matrice-rumore.json python3 -u bench/pavimento-rumore/esegui.py finalizza`, PID 22977, caffeinate 22978, stdin DEVNULL, stesso log finalizza-rumore.log. Il comando ripete anche le tre letture del secondo adattatore DIR Sonnet r1 già corretto, poi riusa i 39 giudici validi e completa il mancante.
- Costo registrato prima della ripresa 296,6215977 USD; residuo 53,3784023. Nessuna modifica a matrice, prompt, modelli, rubrica o budget.


## 2026-10-22 22:43 CEST · report 1 · finalizzazione scientifica e audit costi

- Ripresa conclusa: secondo adattatore DIR Sonnet r1 90,7 × 3, concorde col primario; ultimo giudice valido. Complete 20 consegne, 60 letture primarie + 12 secondarie, 40 letture tecniche, 127 fasi con precondizioni valide, 24 adattatori con SHA256 conforme. Sedici test del banco passati, inclusi calcoli statistici e ripresa.
- Audit contabile: il secondo adattatore conserva il proprio log nella sua directory, copiata anche dentro il clone di valutazione. Quattro sessioni comparivano due volte nel glob dei costi: 3,2247136 USD duplicati. Conteggio ora per session_id (massimo cumulativo), mantenendo i tentativi distinti; aggiunto test che conserva anche una sessione interrotta diversa. Nessun budget o guardrail modificato, nessuna sessione aggiuntiva avviata grazie alla correzione.
- Spesa effettiva 293,9197681 USD: sviluppo valido 247,250378; sviluppo scartato 10,1774461; adattatori 18,1926802; giudici tecnici 18,2992638; turni persi 0. Residuo 56,0802319 USD. Scarti sviluppo + adattatore della prova contaminata 10,8753101 USD, inclusi nel totale. Sette serie di tre letture funzionali archiviate per errori di adattamento (21 letture uniche, escluse le copie nel clone), poi ripetute interamente.
- SD pooled 0,7749193506; soglia 2 SD 1,5498387013; MDE 1,5687772183; Δ completo−diretto −0,01 (IC −0,75…+0,72). Range ripetizioni e differenze tra adattatori tutti zero dopo audit. Report 4 rigenerato su 40 consegne, narrative/H4 ricalcolate; costi dei nuovi giudici assegnati solo al report 1.
- Verifica HTML statica: link locali validi, ID univoci, overview 20/40 righe, script JavaScript sintatticamente validi. La verifica visiva/interattiva resta bloccata: Browser Use ha rifiutato l’URL file:// per policy di protocollo e vieta workaround. Nessuna verifica browser dichiarata. Report 1 lasciato «in corso» nel manifest con unica attività residua esplicita; automazione da disattivare in attesa della verifica manuale o indicazioni dell’utente.


## 2026-10-22 · Report 3 · preflight isolamento

Il nuovo controllo init ha classificato per errore come estranee le skill builtin di Claude Code 2.1.303. Tentativo T3-riferimento fermato subito dopo init, senza result e senza metriche valide; stream conservato in `gradiente-difficolta/_scartati/G-ref-T3-init-builtin`. Costo non ancora attestabile dal result (nessun result disponibile), da riconciliare con transcript/usage prima della chiusura contabile. Aggiunta whitelist esplicita dei builtin osservati; plugin non builtin e skill diverse da ARchetipo o dalla whitelist continuano a invalidare la fase. Nessuna consegna sperimentale avviata o modificata.


## 2026-10-22 · Report 3 · applicabilità del criterio tecnico

Proposta preregistrata nell’indice prima di qualsiasi valutazione: passare al giudice tecnico descrizione, checklist e invariante del compito corrente; leggere il diff dalla baseline effettiva del compito. Escludere dalla copertura dei percorsi i controlli di diagnosi sul riepilogo finale (giudice, non comportamento eseguibile). Valutare migrazione e blocco di stato soltanto quando applicabili, come già previsto dalla formula «voci rispettate / voci applicabili». Nessuna modifica a pesi o formule.

Applicazione: parametri opzionali in `bench/common/tecnica.py`, con default storici invariati; criteri e giudizi storici restano validi. In T4, eventuale mediana delle righe nette non positiva sarà dichiarata come limite senza sostituire il punteggio.


## 2026-10-22 · Report 3 · lint dello strumento AST

`npm run lint` nel repository del banco rilevava tre errori preesistenti no-require-imports in `bench/common/funzioni.js`. Convertiti gli import a ESM e mantenuto il caricamento del TypeScript della consegna con createRequire. Verifica sul dominio Consuntivi: output JSON valido, 25 funzioni, presenti i tre calcoli attesi. Nessuna modifica ai cloni o alle consegne. Node segnala soltanto la rilevazione automatica del formato ESM per il file .js, senza effetti sull’output JSON.


## 2026-10-23 · Report 3 · emendamento della variante spec prima dei chiarimenti

La prima preregistrazione indicava V1. Rilettura della narrativa completa del report 6 e della skill installata: V1 risulta «adottabile», non adottata; non esiste una registrazione di adozione e la skill non contiene la checklist V1. Applicato il fallback baseline V0 previsto esplicitamente dal prompt §4.1. Aggiornati matrice, manifest, indice, protocollo e runner. Nessun chiarimento e nessuna prova sperimentale erano stati avviati: nessun risultato escluso e nessun costo aggiuntivo. Riferimenti e autore degli oracoli lavorano senza skill ARchetipo e restano invariati.


## 2026-10-23 · Report 3 · riconciliazione dello scarto init

La sessione 102b7319-dd88-48ef-bb41-d09fd93619cf è stata chiusa con un messaggio senza strumenti, solo per ottenere il result cumulativo. Costo attestato di tentativo scartato e riconciliazione: 0,0834738 USD, incluso nella preparazione e nel totale; nessun codice applicativo toccato. Non restano sessioni senza costo attestato al termine della riconciliazione.

Le skill sono state congelate in uno snapshot esterno ai cloni; i due hash coincidono con quelli registrati prima del primo riferimento T3. Tutti i cloni successivi useranno questa stessa copia, evitando aggiornamenti accidentali della skill durante il report. L’audit del riferimento T3 non ha rilevato accessi al repository originale, plugin estranei o dichiarazioni di Wiki non disponibile.


## 2026-10-23 · Report 3 · setup clone T1

La prima clonazione Git del riferimento T1 è terminata con exit 128 prima di qualsiasi sessione modello. Il controller si è fermato. Verificato il source baseline e il suo commit; la ripetizione isolata dello stesso comando Git è terminata con exit 0. Completati configurazione del clone e setup prima della fase. Nessun costo modello o risultato sperimentale; non è stato eseguito un retry automatico di una fase. Il setup ora completa esplicitamente anche un clone presente ma ancora senza dipendenze.


## 2026-10-23 · Report 3 · ambiente sintetico dei processi test

Il riferimento T3 ha rilevato che Vitest con NODE_ENV=test non carica `.env.local`: due file unit della baseline falliscono senza DATABASE_URL, ma passano con la variabile valorizzata come in CI. Il setup usa `.env.local` per rispettare il divieto di accesso a `.env`. I worker successivi ricevono esplicitamente lo stesso ambiente sintetico dedicato; le 40 prove e le valutazioni useranno tutte questa regola. T3 ha già verificato 793 unit con l’ambiente corretto; nessun cambiamento del suo codice né del punteggio. Il riferimento T1 era già avviato: la sua verifica userà lo stesso ambiente esplicito.


## 2026-10-23 · Report 3 · completamento del riferimento T1

La prima soluzione T1 (2,6290746 USD) ha aggiunto un vincolo non nel profilo: email o telefono rendevano obbligatorio il nome referente. È prevista una fase Opus nuova e isolata per rimuoverlo e verificare i tre campi facoltativi indipendenti. Il primo autore ha inoltre eseguito un solo giro e2e; la fase di correzione deve completare i tre richiesti. Non si tratta di una consegna sperimentale e non si modifica alcuna storia. Il primo riferimento e la prima sonda unit restano nella storia Git e negli artefatti; la tabella degli indicatori userà soltanto la versione finale. Le sonde sono ora indicizzate per hash del riferimento per evitare riuso di misure obsolete.


## 2026-10-23 · Report 3 · precisione UI del controllo T4 U2

La UI baseline dell’avanzamento espone le giornate con un solo decimale: 0,75 viene mostrato come 0,8 gg (8%). Prima della costruzione degli oracoli e di qualunque prova, chiarito U2 perché accetti il valore corretto con quella precisione oppure con precisione maggiore, invece di richiedere una modifica del formatter estranea al difetto. F1 continua a richiedere esattamente 0,75 nel calcolo; nessun peso, requisito o formula cambiato. La correzione sarà identica per tutte le consegne.


## 2026-10-23 · Report 3 · fuso del server fissato prima delle prove

I riferimenti hanno evidenziato che le query mensili della baseline dipendono dal fuso del server. Il banco fissa ora TZ=UTC per tutti i processi applicativi e test, come nell’ambiente CI; i browser degli oracoli useranno Europe/Rome e it-IT per i casi di cambio ora. Nessuna delle 40 prove e nessun chiarimento erano stati avviati. Non vengono modificati i calcoli delle consegne né i criteri; le verifiche finali dei riferimenti useranno questo ambiente. Limite dichiarato: il confronto non misura robustezza del server in altri fusi; il report 1 non fissava esplicitamente questa variabile.


## 2026-10-23 · Report 3 · dimensione tecnica con mediana netta non positiva

Proposta e preregistrazione nell’indice prima delle prove: nei bug fix la mediana delle righe nette può essere negativa; il suo doppio è minore, quindi l’intervallo della normalizzazione non è ordinato. Solo per coorti con mediana netta ≤ 0 si usano righe aggiunte + eliminate src e la loro mediana; restano peso 20 e formula mediana/2×mediana. Regola generale, anche per coorti storiche; sulle 40 consegne precedenti la mediana netta delle coorti è positiva. La misura usata viene registrata nei punteggi. Nessun risultato delle 40 prove era disponibile al momento della scelta.


## 2026-10-23 · Report 3 · isolamento delle sonde per hash

La sonda della seconda versione T1 ha incontrato P2003 nel seed perché riusava il database della prima sonda. Il processo si è fermato prima di misurare test. Il namespace del database ora include l’hash del riferimento, come già quello degli artefatti: niente riuso di stato tra versioni. La sonda viene rifatta solo per la versione finale, in database nuovo; nessun costo modello, nessuna consegna o storia modificata.


## 2026-10-23 · Report 3 · isolamento delle fasi e delle celle

Prima delle prove, aggiunto snapshot Postgres dei due database dedicati prima di ogni fase. Un result in errore, contaminazione init o dichiarazione di Wiki non disponibile ferma la fase, conserva stream/costo/patch e ripristina codice e database; nessun retry automatico. La cella diretto viene controllata per invocazioni di Skill ARchetipo e cambi di stato delle storie, vietati dal suo prompt. La fase spec non può modificare src/, prisma/ o tests/: eventuale codice anticipato invalida il chiarimento e non passa a nessuna cella. È applicazione dei vincoli già fissati, non un filtro basato sui punteggi.


## 2026-10-23 · Report 3 · conflitto preesistente nel gate utenti

Nel secondo giro aggiuntivo UTC del riferimento T3 è fallito gestione-utenti, caso riattivazione utente, su codice invariato dalla baseline. La trace mostra un POST HTTP 500. Ripetizioni diagnostiche, tutte fullyParallel e retries=0: T3 5/6 e 8/8; baseline 8/8 e 23/24. Il server della baseline registra DriverAdapterError TransactionWriteConflict (conflitto di serializzazione). Evidenze in `diagnosi-ci.json`, log e trace conservati; nessun caso rimosso, nessun worker ridotto, nessun retry aumentato e nessun codice applicativo modificato. È un limite preesistente da dichiarare nell’analisi dei gate e degli intervalli delle tre valutazioni. Dopo la diagnosi si esegue una nuova verifica completa conservando separatamente il primo tentativo fallito.


### Report 3 · taratura oracoli prima delle 40 prove (23 ottobre 2026)

L’autore Opus indipendente ha prodotto i quattro oracoli dal profilo e dalle checklist già fissate, senza accesso ai riferimenti (10,6649808 USD). Verifica statica: 24/24/24/25 controlli coperti. I controlli runtime vengono tarati soltanto sulle baseline, mai sui riferimenti: capacità mancanti con adattatore nullo per T1–T3; per T4 dieci fallimenti attesi sulla baseline difettosa e venti pass sulla baseline sana. Migrazione baseline con dati: T1 P1/P2 falsi perché manca una nuova migrazione; T3 M1 falso perché manca la storia, M2/M3 veri perché gli importi e le righe sono invariati. Questo non assegna punteggi a consegne sperimentali.

Prima delle prove, il banco distingue le violazioni critiche osservate dai controlli critici non verificati. Un `NonImplementato`, un errore infrastrutturale o l’assenza di risultato non dimostrano esposizione dei dati o variazione di un importo passato. T2 A1 emette un marcatore solo quando il collaboratore vede effettivamente i dati della fixture di un altro; T3 M2 lo emette quando un importo numerico differisce di almeno mezzo centesimo. I controlli ordinari continuano a fallire se manca la capacità. Checklist, pesi e profili invariati.

Il gate CI usa `CI=true` e i retry già dichiarati dal progetto, senza override; gli oracoli browser conservano `retries:0`. L’autore aveva imposto zero retry anche al gate: correzione prima delle prove per rispettare la CI effettiva, già dichiarata nella diagnosi della flakiness. Nessun worker ridotto e nessuna modifica ai test applicativi.

Il controllo positivo sintetico del gate T4 ha scoperto che i percorsi macOS `/var` e `/private/var` rendevano diverse le chiavi dei medesimi casi nei worktree temporanei. Ora entrambi i percorsi vengono risolti prima del confronto. Conservato `positivo-prima-correzione-percorsi/`. La prima ripresa della fixture di taratura riusava inoltre il suo HEAD positivo per il controllo negativo: tentativo conservato in `negativo-fixture-ripresa-errata/`; il controllo negativo usa ora esplicitamente la baseline difettosa. Nessuna consegna o riferimento corretto dal banco.

Il secondo tentativo di verifica UTC del riferimento T3 passa lint/unit/build e la prima suite e2e, ma fallisce la seconda sul test preesistente di scadenza sessione (`sessione-proxy`). Conservati tutti i log e trace. Non si continua a ripetere fino al verde. Le tre suite iniziali del riferimento erano passate nel fuso locale; la stabilità dei gate UTC resta un limite dichiarato, oltre alla flakiness `TransactionWriteConflict` riprodotta sulla baseline.


### Report 3 · misura diretta dei test disponibili

Prima delle 40 prove il conteggio testuale dei file unit disponibili è stato sostituito con chiamate osservate alle funzioni toccate. Il commento italiano «Dato l’utente» in `auth-helpers.test.ts` corrispondeva al nome del componente `Dato` e produceva un falso positivo. Il profiler Node esegue ogni file Vitest separatamente sulle copie delle due baseline, senza nuove dipendenze né modifiche applicative. T1 passa da 4 a 3 file unit; T3 da 11 a 9; T2 resta 0 e T4 resta 1. La Wiki conserva il conteggio di citazioni testuali. Le sonde dei test baseline sui riferimenti e il numero di file test modificati restano separati e invariati. Dati in `copertura-unit-baseline.json`.

Il ripristino di una fase sperimentale invalida ora reinstalla anche le dipendenze dal lockfile ripristinato (`npm ci`, incluso `prisma generate`): evita di riusare node_modules o un client Prisma generato dal tentativo scartato. Nessuna fase sperimentale è ancora partita.


## 23 ottobre 2026 · Report 3 ridotto su richiesta umana

Prima di qualsiasi consegna sperimentale, l’utente approva 8 prove Sonnet T1/T3 (2 repliche diretto/completo), budget aggiuntivo massimo 80 USD, totale 121,1195528 USD inclusi 41,1195528 già spesi. Una lettura funzionale per consegna, tecnico automatico senza mutation o doppio giudice, un solo rework. Matrice originale conservata non autorizzata; matrice ridotta con messaggio e timestamp di conferma. Dettagli in `bench/gradiente-difficolta/PROTOCOLLO-RIDOTTO.md`. H3 integrale non verificabile: nessuna sostituzione post hoc delle soglie.


### Set ridotto · baseline Wiki validata durante la prima review

La review US-060 di G-T3-COM-sonnet-r2 richiede rework per tre `WIKI_CORE_PAGE_UNANCHORED`. Il banco ha verificato separatamente la baseline congelata: `wiki validate --profile bootstrap` restituisce gli stessi errori su overview, architecture/context-map e operations/development. Evidenza conservata in `diagnosi-wiki-baseline.json`. Nessuna baseline o consegna corretta dal banco: l’eventuale riparazione è lavoro del percorso completo e resta nel suo costo. Questo limite può confondere l’attribuzione dell’overhead alla difficoltà della funzionalità.


### Set ridotto · isolamento della concorrenza prima della prima valutazione

Revisione statica di N1/N2: le decorrenze a multipli di 30 giorni includevano giorni diversi dal primo del mese. Su una gestione mensile il rifiuto della data maschererebbe il controllo di concorrenza. Il test ora usa sei primi del mese consecutivi e due primi del mese distinti successivi. Validi sia per implementazioni giornaliere sia mensili; le asserzioni su catena e cardinalità, i pesi e i controlli C1/C2/C4 sulla tariffa alla data della riga restano invariati. Applicazione uniforme alle quattro consegne T3, prima di qualsiasi valutazione (zero evaluation.json presenti). Patch e calibrazione precedente conservate; hash aggiornato con motivazione. Nessuna modifica al codice delle consegne o feedback agli agenti.


## 2026-10-23T09:34:50.025251+02:00 · Report 3 · fase scartata

Wiki dichiarata non disponibile nonostante precondizioni valide. Artefatti, patch e costo conservati in `/Users/smarello/repo/coaching-planner-bench-runs/gradiente-difficolta/_scartati/G-T3-COM-sonnet-r2--US-062-review-1--1792740881417874000`. Ripristinati codice e database dal punto precedente alla fase; nessun retry automatico.


## 2026-10-23T09:41:34.532009+02:00 · Report 3 · falso positivo Wiki e ripresa

La fase `G-T3-COM-sonnet-r2/US-062-review-1` è stata scartata perché il vecchio pattern ha associato «Wiki» a «worktree è disabilitato» nella medesima frase. La Wiki era disponibile, usata e validata: non era una dichiarazione di indisponibilità. Corretto il classificatore del solo report 3 per richiedere un riferimento alla risorsa; aggiunto test con la frase reale. Conservati patch, stream, costo 0,4095319 USD e ripristino del tentativo. Ripetizione esplicita della sola fase da sessione nuova, dopo diagnosi; nessuna modifica manuale alla consegna. Le fasi valide non sono ripetute.

Corretto anche il resume del runner: lo stato storico dopo una review si registra nelle metriche; per le prime review si ricostruisce dal verdetto salvato nel result, anziché leggere lo stato attuale del clone già avanzato. Nessuna modifica ai risultati né ai prompt. Verifica effettiva: 20 test del banco passati.


## Report 3 · Attesa browser dell’adattatore, dopo la prima lettura

La prima lettura S3 di G-T3-COM-sonnet-r2 è invalida: il Promise.race dell’adattatore poteva completarsi sull’alert generico già presente in Next. La pagina finale del trace contiene la tariffa 435,00 corretta, mentre il controllo SQL precedente vede ancora nessuna validità futura. Corretto solo il locator di attesa dell’adattatore: si attende la nuova riga. Nessuna modifica a codice, assert, fixture o pesi. Conservati l’adattatore originale e la ricevuta iniziale; la sola lettura browser verrà sostituita su DB fresco, mantenendo integra l’integrazione e i gate già validi. Il risultato iniziale non concorre al report finale.

Criterio uniforme applicato prima di leggere le valutazioni successive: esaminare tutti gli adattatori e invalidare attese su alert globali già presenti anche se un test fosse passato. Correzione meccanica del banco, nessun retry per ottenere il verde e nessuna nuova chiamata a modelli. Registrazione in correzioni-adattatori.json.


### Report 3 · medesimo errore di attesa nel diretto T3 r1

L’audit uniforme degli adattatori, inclusi i controlli passati, trova lo stesso race sull’alert globale in `attendiEsito` di G-T3-DIR-sonnet-r1. Il trace S2 mostra la risoluzione sul `__next-route-announcer__` a 2050,7 ms, seguita dall’assert SQL a 2055 ms prima della conclusione del submit. Corretta soltanto l’attesa dei tre form esistenti sul redirect già previsto; il race della sezione Tariffe è limitato al form e non intercetta l’alert globale. Lettura browser invalidata e da sostituire a driver fermo su DB nuovo, con precedente conservata. Stesso criterio di COM r2, nessun intervento sulla consegna. I due adattatori T1 diretti non hanno questo errore: S2 mostra la riga cliente corretta senza referente, coerente con l’esclusione dell’elenco nelle storie; non si corregge quel risultato.


## 23 ottobre 2026 · Chiusura del report 3 ridotto

Concluse e valutate tutte le 8 consegne autorizzate. Le due letture browser invalide sono state sostituite ciascuna una sola volta a driver fermo, su DB nuovi e senza modelli: T3 COM r2 da 88,8 invalido a 90,4 valido; T3 DIR r1 da 87,2 invalido a 90,4 valido. Entrambi i tentativi iniziali restano conservati in browser-invalido; gate e integrazione validi riusati. Audit uniforme di tutti gli 8 adattatori (anche controlli passati), hash degli adattatori installati coincidenti, nessun codice consegnato corretto dal banco. Nessuna nuova lettura per ottenere un punteggio migliore.

Audit finale positivo: 52 fasi valide, 8 valutazioni, 24 storie con requisiti invariati, costi integralmente attestati. Tutte le consegne T1 ottengono 95,5 e tutte le T3 90,4; Δ zero in entrambi, entro il rumore storico. Costo totale 92,8518091 USD; incremento 51,7322563 su 80 massimi. Wall clock prima fase→ultima valutazione valida 4,5742 ore. H3 integrale non verificabile nel disegno ridotto; nessuna equivalenza inferita.

Diagnosi dei chiarimenti: il committente simulato approva l’esclusione dell’elenco T1 e accetta la proposta mensile T3, restringendo il profilo nascosto. È un limite anche della sua fedeltà al profilo. Storie, giudizi e pesi restano congelati; evidenze in diagnosi-chiarimenti.json. Le difformità delle review (Wiki, CI impact assessment e demo) sono conservate come risultati di processo, senza ripetizioni per renderle conformi. Il completo termina 10 storie DONE e 2 REVIEW.

QA finale indice/report a 1440 e 390: nessun errore JS o overflow, filtri report 8→4→2. L’indice ha un override locale overflow-wrap per l’hash lungo della baseline; nessuna modifica ai criteri. Whitespace del codice/documenti verificato escludendo le patch archiviate e non bloccando sulla riga vuota finale del helper oracolo congelato; log integrale ed eccezioni conservati, nessun byte degli oracoli riformattato dopo i risultati.


## 23 ottobre 2026 · Chiusura report 1 dopo verifica umana

L’utente conferma: «Verificato: tutto leggibile e filtri funzionanti». Registrata la verifica visiva/interattiva come umana in pavimento-rumore/verifica-finale.json, mantenendo il precedente rifiuto della policy browser come evidenza storica. Nessuna verifica automatica dichiarata e nessun workaround. Report 1 portato da in corso a fatto nel manifest; indice rigenerato e nota di attesa sostituita con l’esito di chiusura.

Dati e report HTML invariati, hash conservati nella ricevuta. Controlli statici conclusi; nessuna nuova prova o sessione Claude. Costo invariato 293,9197681 USD.
