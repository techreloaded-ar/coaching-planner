# Prompt: report 3 · «L'harness serve quando il compito è difficile?»

Sei un agente che lavora nel repository `coaching-planner`, dove esistono il banco di prova `bench/` (orchestratore, `valuta.py`, `report.py`, `CORREZIONI.md`), la cartella delle prove `~/repo/coaching-planner-bench-runs/`, la pagina indice `bench/index.html` generata da `bench/index.py` e `bench/manifest.json`, e i report già fatti: 0a, 0b, 0c (i tre originali), 4 (qualità tecnica), 6 (fase spec) e 1 (pavimento di rumore). Leggi l'indice prima di iniziare: i **criteri di valutazione comuni** (§2 dell'indice), lo **stile condiviso** (§6, `bench/common/style.css`, `bench/common/html.py`), lo script `bench/common/tecnica.py` del report 4, il **pavimento di rumore** fissato dal report 1 e l'eventuale variante di `archetipo-spec` adottata dal report 6. Questo report li usa tutti e non ne ridefinisce nessuno.

Il report 3 è registrato nel manifest come `pianificato` con slug `gradiente-difficolta`. Portalo a `in corso`, poi a `fatto`.

---

## 0. Vincoli che valgono per tutto il report

Valgono i vincoli generali del banco, qui in breve:

- Ogni fase è un processo `claude -p` nuovo dentro il clone della prova: `--setting-sources project,local`, `--permission-mode bypassPermissions` nel clone, divieto di lettura e scrittura sul repository originale (contiene banco, profili nascosti, soluzioni di riferimento), `--output-format stream-json --verbose`, `--effort medium`, `--max-budget-usd` 25 per fase Sonnet e 60 per fase Opus. Fase scartata se nell'evento iniziale compaiono skill o plugin estranei.
- Precondizioni verificate dal banco prima di ogni fase e registrate in `metrics.json`: `docs/wiki/` presente, skill `archetipo-wiki` presente, `wiki.enabled: true` letto da `archetipo config show`, hash della cartella skill. Una fase che dichiara «non abilitato» o `E_PRECONDITION` su una risorsa che il banco credeva disponibile è invalida: scartata, annotata, rifatta.
- Idempotenza: fase con `metrics.json` valido non si ripete; qualunque `result` in errore ferma l'orchestratore.
- Ordine randomizzato delle prove con seme salvato nella matrice `matrice-gradiente.json`; esecuzione sequenziale (porta 3000).
- **Budget del report: 750 USD**, di cui al massimo 120 per la costruzione di profili, soluzioni di riferimento, oracoli e adattatori. Oltre il tetto ti fermi e riporti. Registra ogni costo, prove scartate e giudici inclusi.
- Nessuna modifica al codice delle consegne. Correzioni agli adattatori applicate a tutte le consegne con lo stesso criterio e annotate in `CORREZIONI.md`.
- Lingua italiana, stesse convenzioni numeriche dei report precedenti.

---

## 1. Ipotesi pre-registrata (da scrivere nell'indice prima di lanciare)

**Contesto.** Nei report 0a–0c il percorso completo costa da 3 a 9 volte il diretto senza guadagno misurabile, ma tutti i compiti erano funzionalità CRUD su una codebase già piena delle convenzioni di ARchetipo, e tutte le consegne stavano tra 88 e 90 con il tetto fissato dal chiarimento. Il dato di Luna in RideAtlas (60 → 77 con la sola spec) è l'unico in cui l'harness fa differenza, e lì il guadagno viene dalla spec, non da plan e implement.

**Ipotesi H3.** Il vantaggio di plan → implement → review sul diretto, a storie uguali, cresce con la difficoltà del compito: nullo sui compiti locali, misurabile su quelli trasversali e con migrazione di dati.

**Metriche di decisione.** Per ogni compito T1–T4 e per ogni modello: Δ = mediana(completo) − mediana(diretto) sul punteggio funzionale (§2.1 dell'indice) e sul punteggio tecnico (§2.2), con intervallo bootstrap al 95 % sulle repliche; il pavimento di rumore è la deviazione standard pooled fissata dal report 1 (se il report 1 l'ha misurata solo su un compito, scrivilo come limite).

**Soglie, scritte prima.**

- **H3 confermata**: su T3 e T4 Δ funzionale ≥ 2 SD pooled con intervallo sopra zero per almeno un modello, e su T1 Δ entro il rumore. Conseguenza: l'harness a valle della spec va reso adattivo alla difficoltà, non eliminato.
- **H3 respinta**: Δ entro il rumore su tutti e quattro i compiti per entrambi i modelli. Conseguenza: plan e implement non si giustificano a nessuna delle difficoltà provate; resta aperto solo il valore della review come rete di sicurezza (vedi §6, cosa ha intercettato).
- **Esito ambiguo**: Δ sopra il rumore solo sul tecnico, o solo per un modello, o non monotono nella difficoltà. Si riporta così, senza forzare la lettura.
- **Controllo di manipolazione** (obbligatorio, prima di leggere Δ): la mediana di «Sonnet diretto» deve decrescere da T1 a T4 di almeno 2 SD pooled tra T1 e T4. Se non decresce, il gradiente di difficoltà non ha funzionato e H3 non è verificabile con questi compiti: il report lo dice in «Cosa emerge» e le conclusioni si limitano al confronto per compito.

**Secondarie, dichiarate ma non decisive**: costo per punto funzionale per compito e cella; cicli di rework per compito; cosa ha intercettato la review (per compito); dimensione del diff rispetto alla soluzione di riferimento; punteggio tecnico per compito.

---

## 2. I quattro compiti

Tutti sulla stessa baseline (ultimo commit di `main` del progetto al momento del lancio, hash registrato), stessa Wiki, stesso PRD. La difficoltà non va asserita: va **misurata** con gli indicatori di §3 e riportata in tabella prima dei risultati.

### T1 · locale · «Referente del cliente»

Richiesta iniziale del committente: «Per ogni cliente vorrei segnarmi chi è la persona con cui parlo, con email e telefono, e vederla quando apro il cliente e nel report di fatturazione.»

Perimetro atteso dal profilo nascosto (da scrivere per esteso prima delle prove, nascosto agli agenti): campi referente su `Cliente` (nome, email, telefono) facoltativi ma con validazione quando presenti; visibili in dettaglio cliente, in elenco e nell'intestazione del cliente nel report Fatturazione Clienti; modificabili solo dall'amministratore; nessun impatto sui calcoli; clienti esistenti senza referente restano validi; migrazione additiva.

Indicatori attesi: 1 modulo (`anagrafiche/clienti`) più un punto di visualizzazione nel report; migrazione additiva senza backfill; nessuna concorrenza; area ben documentata e ben coperta da test.

### T2 · trasversale, sola lettura · «Analisi della marginalità»

Richiesta iniziale: «Voglio vedere, per un periodo che scelgo io, quanto incasso da ogni cliente e offerta e quanto mi costano i collaboratori che ci hanno lavorato, con il margine.»

Nota: il PRD registra la marginalità come «posticipata dopo il rilascio iniziale» (riga 154): è una decisione documentata che il chiarimento deve far emergere, come RF-15 nei report precedenti. Il profilo nascosto stabilisce che il committente conferma di volerla ora.

Perimetro atteso dal profilo: ricavi = giornate fatturabili × tariffa offerta; costi = giornate × tariffa del collaboratore, **comprese le righe non fatturabili** (sono costo senza ricavo: tema che il chiarimento deve scoprire); rimborsi trasferta esclusi da entrambi i lati perché passanti; margine assoluto e percentuale; periodo da mese a mese; per cliente, con dettaglio per offerta e per collaboratore; conversione 1 giornata = 8 ore; solo amministratore; nessuna scrittura; coerenza con gli importi del report Fatturazione Clienti sullo stesso periodo; nessun cambio di schema.

Indicatori attesi: 4–5 moduli (dominio `consuntivi`, DAL, nuova pagina report, navigazione back-office, autorizzazioni); nessuna migrazione; nessuna concorrenza; area documentata.

### T3 · migrazione con dati esistenti e concorrenza · «Tariffe con validità nel tempo»

Richiesta iniziale: «Le tariffe cambiano a inizio anno, sia quelle che faccio ai clienti sia quelle dei collaboratori. Vorrei inserire la tariffa nuova in anticipo e che i conti dei mesi vecchi restino quelli vecchi.»

Perimetro atteso dal profilo: tariffe giornaliere di `Offerta` e `Collaboratore` storicizzate con data di inizio validità; ogni calcolo (riepilogo mese, report Fatturazione Clienti, avanzamento offerte, e la marginalità se presente nella baseline) usa la tariffa vigente alla **data della riga**, non quella corrente; migrazione che converte le tariffe attuali in una validità aperta senza alterare nessun importo già calcolabile (i report di tutti i mesi passati devono restituire gli stessi numeri prima e dopo); back-office per inserire tariffe future, correggere l'ultima, vietare sovrapposizioni e buchi; due inserimenti concorrenti sulla stessa entità non producono due validità sovrapposte; i form esistenti continuano a funzionare; le righe attività non cambiano; solo amministratore.

Indicatori attesi: 7–9 moduli (schema, migrazione con backfill, DAL anagrafiche, due form, tre funzioni di calcolo, report); migrazione con dati; concorrenza; i test esistenti sulle tariffe devono cambiare.

### T4 · difetto in codice poco documentato · «I totali non tornano»

Qui l'input non è una funzionalità ma una **segnalazione**: «Da qualche mese i totali del riepilogo mensile di alcuni collaboratori non coincidono con quello che vedo nel report di fatturazione per lo stesso mese. Non capisco da cosa dipenda, succede solo ad alcuni.»

Preparazione, da fare prima delle prove e da documentare nel report:

1. **Pianta un difetto** nella baseline del clone con un commit dal messaggio plausibile (es. «refactor: estrazione del calcolo delle giornate»). Scegli tra questi candidati, verificando prima il comportamento attuale per piantare una deviazione reale:
   - (a) in `calcolaRiepilogoMese` le giornate vengono arrotondate **per riga** (`Math.floor(ore / 8)` o simile) invece che sul totale delle ore, mentre `calcolaReportFatturazioneClienti` continua a sommare le ore: la discrepanza compare solo per chi registra righe sotto le 8 ore;
   - (b) in `duplicaRigaSuGiorni` la data di destinazione è calcolata in ora locale e scivola di un giorno nelle notti di cambio ora, per cui alcune righe finiscono nel mese adiacente solo in alcuni mesi;
   - (c) nel riepilogo i rimborsi trasferta delle righe non fatturabili vengono esclusi mentre nel report al cliente vengono ribaltati (o viceversa, in contrasto con RF-14).
   Pianta lo **stesso errore in due punti** (per (a): riepilogo e avanzamento offerte), così da misurare se la correzione trova la famiglia del difetto o solo il sintomo.
2. **Rendi l'area poco documentata**: nel clone rimuovi le pagine Wiki che descrivono il dominio toccato e i test unit che coprirebbero il difetto; elenca nel report cosa è stato rimosso. Dichiara nei limiti che questa è una manipolazione e non un codice legacy reale.
3. Verifica che con il difetto piantato lint, Vitest, build e e2e della baseline passino: il difetto non deve essere intercettato dai gate.
4. Profilo nascosto: comportamento corretto atteso, posizione del difetto (entrambi i punti), causa, e quali spiegazioni sono accettabili dal committente quando interrogato (sa descrivere i sintomi con esempi concreti di collaboratori e mesi, non la causa).

Oracolo di T4, oltre ai gate: sintomo risolto su un dataset con casi sotto le 8 ore e cambio ora; **entrambi** i punti corretti; correzione nella causa e non nel consumatore (il report non viene «allineato» al riepilogo sbagliato); test di regressione aggiunto che fallisce sulla baseline col difetto e passa dopo; nessuna modifica fuori dall'area (dimensione del diff rispetto alla soluzione di riferimento); diagnosi corretta scritta nel riepilogo finale dell'agente (giudice a checklist).

Indicatori attesi: 1–2 moduli ma individuati, non dati; nessuna migrazione; documentazione rimossa; test rimossi.

---

## 3. Indicatori di difficoltà (misurati, tabella nel report)

Per ogni compito, prima delle prove, scrivi una **soluzione di riferimento** con una sessione Opus senza limiti di budget, nascosta agli agenti, non usata come oracolo ma solo per misurare gli indicatori e tarare gli adattatori. Dalla soluzione e dalla baseline ricava:

| Indicatore | Come si misura |
|---|---|
| Moduli toccati | cartelle distinte di primo e secondo livello sotto `src/`, `prisma/`, `tests/` modificate dalla soluzione di riferimento |
| Call site da modificare | funzioni esistenti il cui corpo cambia nella soluzione di riferimento |
| Migrazione | nessuna / additiva / con backfill su dati esistenti |
| Concorrenza | il profilo richiede un controllo esplicito (sì/no) |
| Test esistenti da cambiare | test della baseline che la soluzione di riferimento modifica o che fallirebbero |
| Documentazione disponibile | pagine Wiki che citano i moduli toccati; test unit che coprono le funzioni toccate (conteggi) |
| Informazione nascosta | la posizione del lavoro è data dalle storie (T1–T3) o va scoperta (T4) |

La tabella va nel report con la nota: la difficoltà attesa è l'ordinamento T1 < T2 < T3, con T4 di natura diversa; il controllo di manipolazione di §1 dice se l'ordinamento ha retto.

---

## 4. Disegno delle prove

### 4.1 Storie fisse, condivise tra celle e tra modelli

Per ogni compito **un solo chiarimento** con Opus, usando la variante di `archetipo-spec` adottata dal report 6 (baseline se nessuna adottata), con il committente simulato (Opus, sessione separata) che risponde dal profilo nascosto. Le storie approvate sono le stesse per tutte le celle e per entrambi i modelli del compito: così il confronto isola ciò che sta a valle della spec. Riporta per ogni chiarimento la copertura del profilo (§2.3 dell'indice) e, se un tema decisivo non è emerso (per T2 le righe non fatturabili, per T3 la data della riga), **non correggere le storie**: il tetto che ne deriva fa parte dell'esperimento e va dichiarato.

Per T4 la storia è una storia di difetto con sintomi, passi di riproduzione forniti dal committente e criteri di accettazione sul comportamento corretto, senza indicare la causa.

### 4.2 Celle

- **Diretto**: un unico prompt che chiede di implementare le storie del compito (o di risolvere la storia di difetto) senza skill ARchetipo; Wiki presente e `wiki.enabled: true`, ma non richiesta; stesso testo di prompt dei report precedenti.
- **Completo**: `archetipo-plan` → `archetipo-implement` → `archetipo-review` per storia, nell'ordine del backlog, con rework se la review lo chiede, al massimo 2 cicli per storia; Wiki presente e abilitata, flag verificato dal banco. Per T4 il piano parte dalla storia di difetto.

Nessun'altra cella. Se, finiti i quattro compiti, resta budget, aggiungi solo su T3 la cella «piano → diretto» (piano con `archetipo-plan`, poi sviluppo diretto dato il piano), 2 repliche per modello, riportata come osservazione a margine del report 2.

### 4.3 Repliche e ordine

- Sonnet: 3 repliche per cella. Opus: 2 repliche per cella. Totale 4 compiti × 2 celle × (3 + 2) = 40 prove. Se il pavimento di rumore del report 1 implica che 2 repliche Opus non bastano a rilevare 2 SD, dillo nel report e non aumentare: il budget è il vincolo.
- **Ordine dei compiti per valore informativo**: T3, T1, T4, T2. Così, se il budget finisce, restano gli estremi. Entro ciascun compito, ordine randomizzato delle 10 prove con seme.
- Prima di ogni compito il banco crea i cloni dalla stessa baseline (per T4 dalla baseline con il difetto piantato), applica la Wiki, il flag e, per T4, le rimozioni di §2.

### 4.4 Oracoli

Un oracolo per compito, costruito **prima delle prove** dal profilo nascosto, con la stessa struttura di §2.1 dell'indice: aree con peso per 100 punti, 20–30 controlli di integrazione (server action reali su Postgres dedicato) e browser (Chromium a 1440 e 390 px), gate di persistenza e regressione, violazioni critiche a parte (per T3: importo di un mese passato cambiato dopo la migrazione; per T2: dati di un collaboratore visibili a un altro). Adattatore per consegna generato da Opus e conservato, tarato sulla soluzione di riferimento ma eseguito solo sulle consegne. Ogni consegna valutata tre volte, mediana e intervallo. Punteggio tecnico con `bench/common/tecnica.py`, coorte = consegne dello stesso compito.

Riporta le tabelle complete dei controlli dei quattro oracoli nel report, con per ogni controllo il tema del profilo e se le storie lo rendevano esplicito, parziale o non chiarito, come nel report 0c.

---

## 5. Analisi

1. **Controllo di manipolazione** (§1): mediana di Sonnet diretto per compito; esito.
2. **Tabella principale**: per compito × modello, mediana, min, max di punteggio funzionale e tecnico in ciascuna cella; Δ completo−diretto con intervallo bootstrap; esito rispetto al pavimento di rumore.
3. **Grafico del gradiente**: SVG inline, asse x i quattro compiti nell'ordine T1, T2, T3, T4, asse y il punteggio funzionale, una linea per cella e modello (quattro linee), punti per replica, mediana evidenziata. Stesso grafico per il tecnico e per USD.
4. **Controlli sempre / a volte / mai falliti** per compito e cella, come nel report 1: separa ciò che dipende dalle storie da ciò che dipende dalla replica e dalla cella.
5. **Cosa ha intercettato la review**, per compito: tabella con problema, come è emerso, se il rework ha cambiato il codice o solo la Wiki, se l'oracolo poi lo conferma. Per T4: quante consegne per cella hanno corretto entrambi i punti, una sola, nessuno; quante hanno corretto il consumatore invece della causa.
6. **Costo**: minuti, token, USD per compito e cella; costo per punto funzionale; cicli di rework per compito.
7. **Dimensione del diff** rispetto alla soluzione di riferimento, per cella.
8. **Per T3**, in più: esito del controllo di concorrenza e della migrazione (importi passati invariati) per cella, perché sono i controlli che motivano l'ipotesi.

---

## 6. Report

Secondo lo stile condiviso dell'indice (§6), slug `gradiente-difficolta`, file `bench/reports/gradiente-difficolta/report.html`. Sezioni nell'ordine:

1. **Header**: tag «Coaching Planner · Gradiente di difficoltà · 40 prove», titolo «L'harness serve quando il compito è difficile?», paragrafo con i quattro compiti in una riga ciascuno e i modelli.
2. **Cosa emerge**: tile (esito del controllo di manipolazione; Δ funzionale su T3 con intervallo; Δ su T1 con intervallo; costo per punto nel compito più difficile; esito di H3 nella forma pre-registrata) e 4–6 paragrafi che citano celle e controlli. La prima frase dice se il gradiente ha retto.
3. **Overview delle run**: una riga per prova (40), filtro per modello e per compito, barre di fase con i colori standard (chiarimento condiviso incluso una volta per compito), controlli falliti nel `<details>`.
4. **Il gradiente**: tabella degli indicatori di difficoltà (§3), grafici SVG (§5.3), tabella principale (§5.2).
5. **Quanti token e quanto costo**, per compito e cella.
6. **Quali controlli falliscono**, per compito (§5.4).
7. **Quale lavoro ha intercettato problemi** (§5.5).
8. **Tempi e consumi per skill e per singola fase**, un `<details>` per prova.
9. **I quattro compiti**: richiesta iniziale, storie approvate, copertura del profilo del chiarimento, tabella dei controlli dell'oracolo; per T4 il difetto piantato, il commit, cosa è stato rimosso.
10. **Come interpretare i risultati** e **Limiti**: una funzionalità per livello di difficoltà; storie fisse da un solo chiarimento per compito; T4 è una manipolazione; repliche Opus poche; i compiti T2 e T3 sono scelti da chi conosce la codebase; soluzione di riferimento scritta da Opus e quindi possibile bias verso Opus negli adattatori.
11. **Costo dell'esperimento**: preparazione (profili, soluzioni di riferimento, oracoli, adattatori), prove per compito, prove scartate, valutazioni, giudici.
12. **Footer** con link all'indice.

Il report linka §2 dell'indice per i criteri e non li ridefinisce.

---

## 7. Consegna

- Prima delle prove: scrivi nell'indice l'ipotesi di §1 con soglie, i quattro profili nascosti nel repository del banco (non nei cloni), le soluzioni di riferimento, gli oracoli, la matrice. Mostra in chat la tabella degli indicatori di difficoltà e fermati per conferma prima di lanciare le 40 prove.
- Dopo ogni compito: costo speso e residuo, prove scartate, esito parziale del controllo di manipolazione.
- Alla fine: esito di H3 nella forma pre-registrata scritto anche nel manifest (`ipotesi.esito`), stato `fatto`, indice rigenerato, commit nel repository del banco, link locali a indice e report.
- Se un criterio dell'indice si rivela inapplicabile a un compito (es. la coorte del punteggio tecnico per T4), proponi la modifica nell'indice, annotala nel registro, e solo dopo applicala.
