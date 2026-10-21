# Prompt: indice dei report ARchetipo e report 1, 4 e 6

Sei un agente che lavora nel repository `coaching-planner`, dove esiste già il banco di prova `bench/wiki-benchmark/` (orchestratore `run.py`, valutazione `valuta.py`, generazione `report.py`, matrici `matrice-*.json`, note `CORREZIONI.md`) e la cartella delle prove `~/repo/coaching-planner-bench-runs/`. Tre report sono già stati prodotti con questo banco:

- `report.html` (RideAtlas, 12 prove, Sol e Luna): è il riferimento di stile.
- `ARchetipo_e_Wiki__dal_requisito_vago_alla_consegna.html` (coaching-planner, 10 prove, una replica per cella).
- `Wiki_e_qualita__funzionale.html` (coaching-planner, 10 prove a storie uguali, 12 chiarimenti).

Il lavoro da fare è in quattro consegne, in questo ordine:

1. **Pagina indice** `bench/index.html`, generata da `bench/index.py` a partire da `bench/manifest.json`. Contiene l'elenco dei report (esistenti e pianificati), i **criteri di valutazione comuni** scritti per esteso, le convenzioni di stile e la legenda dei colori, il registro delle ipotesi pre-registrate e lo stato di avanzamento.
2. **Report 4, qualità tecnica delle consegne esistenti.** Nessun lancio di agenti di sviluppo: solo analisi statica, mutation testing e un giudice a checklist sulle consegne già archiviate.
3. **Report 6, fase spec.** Cinque varianti di `archetipo-spec`, due modelli, dieci repliche per cella.
4. **Report 1, pavimento di rumore.** Cinque repliche per cella di due configurazioni, due modelli, storie fisse, oracolo ripetuto tre volte.

Fai le consegne nell'ordine indicato. Dopo ciascuna, aggiorna `manifest.json`, rigenera l'indice, committa nel repository del banco e fermati a riportare costo speso e anomalie prima di passare alla successiva.

---

## 0. Vincoli che valgono per tutto

- **Isolamento delle sessioni agente**, identico ai report precedenti: ogni fase è un processo `claude -p` nuovo dentro il clone della prova, `--setting-sources project,local`, `--permission-mode bypassPermissions` nel clone, divieto di lettura e scrittura sul repository originale (che contiene il banco e il profilo nascosto del committente), `--output-format stream-json --verbose`, `--effort medium`, `--max-budget-usd` 25 per fase Sonnet e 60 per fase Opus. Il banco scarta la fase se nell'evento iniziale compaiono skill o plugin estranei.
- **Precondizioni verificate dal banco, non dall'agente.** Prima di ogni fase il banco controlla e registra in `metrics.json`: presenza o assenza di `docs/wiki/`, presenza della skill `archetipo-wiki`, valore di `wiki.enabled` letto da `archetipo config show`, versione delle skill copiate (hash della cartella). Se una fase dichiara nel transcript «non abilitato», «E_PRECONDITION» o equivalenti su una risorsa che il banco credeva disponibile, la fase è **invalida**: va scartata, annotata in `CORREZIONI.md` e rifatta. Non ripetere l'incidente del flag `wiki.enabled`.
- **Idempotenza e ripresa.** Una fase con `metrics.json` valido non si ripete. Qualunque `result` in errore termina l'orchestratore. Ogni interruzione (limite di sessione CLI, riavvio) va annotata con orario e fasi coinvolte.
- **Ordine randomizzato** delle prove entro ogni report, con seme fisso salvato nella matrice, per non confondere l'effetto cella con la deriva della macchina. Le prove restano sequenziali perché Playwright usa la porta 3000.
- **Budget per report** (tetto, oltre il quale ti fermi e riporti): report 4 ≤ 40 USD (solo giudici), report 6 ≤ 120 USD, report 1 ≤ 350 USD. Registra ogni costo, anche quello delle prove scartate e dei giudici.
- **Nessuna modifica al codice delle consegne.** Le correzioni agli adattatori dell'oracolo si applicano con lo stesso criterio a tutte le consegne e si annotano in `CORREZIONI.md`.
- **Lingua dei report: italiano.** Numeri con punto decimale nelle tabelle e virgola nel testo come nei report esistenti; USD a prezzi di listino riportati da Claude Code; token in milioni con tre decimali.
- Non fare affermazioni che i dati non sostengono. Ogni report ha una sezione «Limiti» scritta prima delle conclusioni, non dopo.

---

## 1. Pagina indice `bench/index.html`

### 1.1 Struttura

Generata da `bench/index.py` leggendo `bench/manifest.json`. Stesso CSS dei report (vedi §5). Sezioni, nell'ordine:

1. **Header**: titolo «Banco di prova ARchetipo · Coaching Planner», sottotitolo con la domanda guida: «Quali parti di ARchetipo portano un vantaggio misurabile e quali appesantiscono il processo?»
2. **Cosa stiamo verificando**: l'ipotesi generale (i modelli recenti hanno bisogno di meno harness e troppo harness li rallenta) e i tre limiti degli esperimenti già fatti: rumore tra repliche grande quanto gli effetti; oracolo saturo in alto perché il tetto lo fissa il chiarimento; compiti facili su una codebase già piena delle convenzioni di ARchetipo.
3. **Report**: una tabella con una riga per report, colonne: numero, titolo con link, domanda, disegno in una riga, stato (`fatto`, `in corso`, `pianificato`, `scartato`), costo registrato, data, risultato in una frase (vuoto se non fatto). Le righe vengono dal manifest. I tre report esistenti vanno copiati in `bench/reports/<slug>/report.html` e inseriti nel manifest come `fatto`, con il risultato in una frase preso dalla loro sezione «Cosa emerge». I report 1, 4 e 6 entrano come `pianificato` e passano a `in corso` e `fatto` man mano. Gli altri proposti (2, 3, 5, 7, 8, 9, 10) entrano come `pianificato` con solo titolo, domanda e disegno, senza link.
4. **Criteri di valutazione comuni**: il testo di §2, per esteso. Ogni report futuro deve linkare questa sezione invece di ridefinire i criteri. Se un report ha bisogno di un criterio nuovo, lo propone qui prima di usarlo.
5. **Convenzioni di stile e legenda dei colori**: il testo di §5, con la legenda renderizzata (quadratini colorati come nei report).
6. **Ipotesi pre-registrate**: per ogni report pianificato, l'ipotesi, la metrica di decisione e la soglia, scritte prima dell'esecuzione (vedi i paragrafi «Ipotesi pre-registrata» in §3, §4, §6). Quando il report è fatto, accanto alla soglia compare l'esito.
7. **Stato e registro**: data dell'ultimo aggiornamento, costo cumulato di tutti i report, link a `CORREZIONI.md`, come rigenerare (`python3 bench/index.py`).

### 1.2 `bench/manifest.json`

```json
{
  "aggiornato": "2026-10-21",
  "report": [
    {
      "numero": 4,
      "slug": "qualita-tecnica",
      "titolo": "Il codice in più del percorso completo vale qualcosa?",
      "domanda": "...",
      "disegno": "...",
      "stato": "pianificato",
      "path": "reports/qualita-tecnica/report.html",
      "costo_usd": null,
      "data": null,
      "risultato": null,
      "ipotesi": {"testo": "...", "metrica": "...", "soglia": "...", "esito": null}
    }
  ]
}
```

I report esistenti hanno `numero` 0a, 0b, 0c (RideAtlas; ARchetipo e Wiki; Wiki e qualità funzionale).

---

## 2. Criteri di valutazione comuni (da scrivere per esteso nell'indice)

Questi criteri sono la base comune: tutti i report li usano identici. Dove un report ne usa solo una parte, lo dichiara.

### 2.1 Qualità funzionale (oracolo esterno, 100 punti)

- **Che cosa misura**: la distanza tra la consegna e il **bisogno del committente**, fissato prima delle prove in un profilo nascosto agli agenti. Non misura la distanza dalle storie: un controllo può fallire anche se la consegna rispetta le storie alla lettera, e l'omissione è allora attribuita al chiarimento, non allo sviluppo.
- **Come**: copia immutabile della prima consegna (hash dell'albero verificato), database Postgres dedicati, server action invocate con sessioni firmate sintetiche, browser Chromium contro `next start` a 1440 e 390 px, gate di regressione della CI (lint con guardrail e2e, Vitest, build, e2e preesistenti, nessun test rimosso o disattivato).
- **Adattatore per consegna**, generato da un agente fisso (Opus) e conservato: collega i controlli alle interfacce prodotte senza implementare capacità mancanti. Le correzioni agli adattatori si applicano a tutte le consegne con lo stesso criterio e si annotano.
- **Punteggio**: aree con peso; punti area = peso × controlli superati / controlli eseguiti; regressioni tutto o niente; violazioni critiche (scrittura in mese chiuso, chiusura da non amministratore) riportate a parte e non assorbite dal totale. Per la funzionalità «chiusura del mese» le aree e i pesi sono quelli già usati: chiusura 12, blocco 22, autorizzazioni 12, concorrenza 10, visibilità 10, cache 6, tracciabilità 6, persistenza 8, interfaccia 6, regressioni 8; i 27 controlli con codice (C1–C5, B1–B9, A1–A3, K1–K2, V1–V4, S1, T1–T2, P1–P3, U1–U3) restano quelli della matrice principale. Riporta la tabella completa dei controlli nell'indice, copiandola dal report «Wiki e qualità funzionale».
- **Affidabilità dell'oracolo**: ogni consegna viene valutata **tre volte**; il punteggio è la mediana e l'intervallo min–max va riportato. Una differenza tra due consegne sotto l'intervallo di rivalutazione non è una differenza.

### 2.2 Qualità tecnica (100 punti, nuova, definita dal report 4)

Misurata sul diff della prima consegna rispetto alla baseline, esclusi `docs/wiki/`, `.archetipo/`, lockfile e file generati. «Coorte» = tutte le consegne che partono dalla stessa coppia di storie.

| Area | Punti | Metrica | Come si calcola |
|---|---|---|---|
| Dimensione e focalizzazione | 20 | righe nette aggiunte in `src/` (esclusi test e migrazioni) rispetto alla mediana della coorte | 20 punti se ≤ mediana, decrescita lineare fino a 0 a 2× mediana |
| Complessità | 15 | complessità ciclomatica delle funzioni nuove o modificate, via regola ESLint `complexity` con soglia 10 in modalità report | 15 × (1 − quota di funzioni oltre soglia); −3 se la massima supera 20 |
| Duplicazione | 10 | `jscpd` sui file toccati in `src/`, righe duplicate / righe toccate | 10 punti se < 3 %, 0 se ≥ 15 %, lineare in mezzo |
| Test: mutation score | 25 | StrykerJS con runner Vitest, mutanti sui soli file `src/` toccati, test unit della consegna | 25 × mutation score; se la suite non gira, 0 e nota |
| Test: copertura dei percorsi | 5 | ogni controllo dell'oracolo (esclusi gate e U*) ha almeno un test unit o e2e della consegna che lo copre, giudicato per nome e contenuto | 5 × quota coperta |
| Aderenza alle convenzioni del repo | 15 | checklist chiusa: lint e guardrail e2e puliti; factory e fixtures di `tests/e2e/support` usate invece delle entità seed; nessun `selectOption({index})`; nessun hard wait; blocco di dominio in una funzione condivisa chiamata da ogni server action; migrazione Prisma presente senza drift | 15 × voci rispettate / voci applicabili |
| Tipi e sicurezza statica | 10 | `tsc --noEmit` senza errori nuovi; nessun `any`, `as unknown as`, `@ts-ignore` o `eslint-disable` nuovo | 10 se tutto vero; −2,5 per ogni voce violata |

Le voci che richiedono lettura (copertura dei percorsi, due voci della checklist) le assegna un giudice Opus a checklist chiusa, senza strumenti, che legge il diff; il giudizio è ripetuto due volte e, se diverge, vale la mediana con nota. Tutto il resto è calcolato da script in `bench/common/tecnica.py` e deve essere riproducibile a partire dall'archivio della consegna.

### 2.3 Qualità della scoperta (fase spec, 100 punti)

- **Profilo nascosto** del committente con 11 temi (decisione precedente RF-15, chi, granularità, quali mesi, effetto su tutte le scritture, riapertura con motivazione, storico, visibilità, concorrenza, schede aperte, dati invariati). Il committente simulato risponde solo a ciò che gli viene chiesto e, in approvazione, segnala solo contraddizioni esplicite.
- **Giudice Opus a checklist chiusa**, senza strumenti, che legge il dialogo e le storie finali e assegna a ogni tema `Esplicito` (2), `Parziale` (1), `Non chiarito` (0).
- **Punteggio** = somma / 22 × 100. Il giudizio è ripetuto due volte per ogni chiarimento; si riporta l'accordo tra le due letture (quota di temi con lo stesso valore) e, in caso di disaccordo, vale la lettura più bassa.
- **Indicatori di processo**, riportati accanto al punteggio: conflitto con RF-15 sollevato (sì/no, fonte); bozza completa mostrata al committente prima del salvataggio (sì/no); temi esclusi dichiarati in un «Fuori perimetro» visibile (conteggio); numero di storie; numero di scambi; minuti; USD; operazioni Wiki.

### 2.4 Costo e tempo

- **Minuti attivi**: lavoro fino alla prima consegna, strumenti e subagenti inclusi, attese del committente simulato e pause del banco escluse e riportate a parte.
- **Token**: totale = input non in cache + cache read + cache creation + output, dal `modelUsage` di Claude Code, subagenti inclusi, verificato contro i transcript.
- **USD**: costo riportato da Claude Code a listino. Il chiarimento condiviso si aggiunge una volta a ogni percorso che lo riusa; non sommare le righe.
- **Operazioni Wiki**: chiamate `archetipo wiki …` più letture e scritture sotto `docs/wiki/`, contate dai transcript.

### 2.5 Regole statistiche

- Una cella con una sola replica è un'osservazione, non una stima. Si riportano sempre mediana, minimo e massimo per cella.
- Per ogni differenza tra celle: intervallo di confidenza al 95 % via bootstrap (10 000 ricampionamenti) sulle repliche appaiate per storia; la differenza è «osservata» solo se l'intervallo non contiene lo zero.
- Il **pavimento di rumore** (report 1) è la deviazione standard pooled tra repliche della stessa cella; dal report 1 in poi, ogni differenza sotto 2 deviazioni pooled si scrive «entro il rumore».
- Le ipotesi, le metriche di decisione e le soglie si scrivono nell'indice prima di lanciare le prove.

---

## 3. Report 4 · «Il codice in più del percorso completo vale qualcosa?»

Slug `qualita-tecnica`. Nessun agente di sviluppo: lavora sulle consegne già archiviate.

### Ipotesi pre-registrata

A parità di punteggio funzionale, il percorso completo produce da 2 a 3 volte più righe del diretto (es. sonnet-C1 4 208 contro sonnet-C2 1 473). **Ipotesi H4**: il codice in più non si traduce in qualità tecnica superiore. **Metrica di decisione**: differenza di punteggio tecnico tra «completo» e «diretto» a storie uguali. **Soglia**: se il completo supera il diretto di almeno 10 punti tecnici con intervallo bootstrap sopra zero, H4 è respinta e il costo di implement va riconsiderato; altrimenti il codice in più è zavorra da spiegare.

### Consegne da analizzare

Tutte quelle archiviate con hash verificato: le 10 della matrice principale (C1–C5 × Sonnet e Opus), le 8 nuove del report Wiki (PW-1, PW-2, PN-1, PN-2 × modello; C2 e DN sono condivise). Quando il report 1 sarà fatto, aggiungi le sue 20 consegne e rigenera: predisponi lo script per questo.

### Passi

1. Scrivi `bench/common/tecnica.py` che, dato l'archivio di una consegna e la baseline, calcola tutte le metriche di §2.2 e salva `tecnica.json` accanto a `metrics.json`. Installa `jscpd` e `@stryker-mutator/core` con `@stryker-mutator/vitest-runner` in una cartella strumenti del banco, non nel clone.
2. **Classificazione del diff**: per ogni consegna, suddividi le righe aggiunte per categoria tramite percorso e contenuto: codice applicativo (`src/` esclusi test), test unit, test e2e, migrazioni Prisma, componenti UI, mockup, `docs/wiki/`, `.archetipo/` (piani e stato), altro. Questa è la risposta diretta alla domanda «dove va il codice in più».
3. **Giudice a checklist** (Opus, senza strumenti, due letture) per le voci che richiedono lettura. Salva prompt e risposte.
4. **Analisi**: punteggio tecnico per consegna e per cella; correlazione tra tecnico e funzionale; tecnico contro righe aggiunte; mutation score contro numero di test (per capire se i test in più uccidono mutanti o no); confronto appaiato «completo vs diretto» e «con piano vs senza piano» a storie uguali.
5. **Report** secondo §5, con queste sezioni specifiche: «Cosa emerge» (4 tile: Δ punteggio tecnico completo−diretto; righe per punto funzionale; mutation score medio per cella; quota di righe in codice applicativo vs test vs Wiki/stato); tabella overview con le barre, dove per questo report la barra mostra la **composizione del diff** per categoria invece del tempo per fase (stessa grafica, legenda dedicata, e lo dichiari); tabella delle metriche per consegna; scatter SVG inline funzionale × tecnico con un punto per consegna, colore per cella; sezione «Dove va il codice in più»; metodo e limiti (in particolare: il punteggio relativo alla coorte non è confrontabile tra funzionalità diverse; il mutation score dipende dalla suite della consegna).

---

## 4. Report 6 · «Dove si gioca la qualità: la fase spec»

Slug `fase-spec`. Solo chiarimenti: 5 varianti × 2 modelli × 10 repliche = 100 chiarimenti, più committente simulato e giudici.

### Ipotesi pre-registrata

Il chiarimento spiega quasi tutta la varianza funzionale (C2 fallito in 10 prove su 10; concorrenza mai chiesta; motivazione e visibilità seguono le storie). **Ipotesi H6**: modifiche a basso costo di `archetipo-spec` alzano la copertura del profilo più di qualsiasi skill a valle. **Metrica di decisione**: qualità della scoperta (§2.3) per variante, mediana su 10 repliche. **Soglia**: una variante è «adottabile» se supera la baseline di almeno 10 punti con intervallo bootstrap sopra zero su entrambi i modelli, senza aumentare il costo oltre 2×.

### Varianti

Tutte realizzate come **copie della skill nel clone** (`archetipo-spec` originale resta intatta nel banco), come fatto per `archetipo-plan*` in RideAtlas. Documenta il diff di ogni copia nel report.

- **V0 baseline**: `archetipo-spec` così com'è, Wiki presente e `wiki.enabled: true`.
- **V1 checklist generica di scoperta**: prima di proporre le storie la skill percorre una checklist **generica per funzionalità che cambiano lo stato di un'entità**: chi può farlo; su quali istanze o periodi (presente, futuro, già in uso); effetto su ogni percorso di scrittura esistente, elencandoli dal codice; reversibilità e cosa deve accompagnarla; storico; visibilità in ogni vista che mostra l'entità, elencandole dal codice; operazioni concorrenti; client con dati obsoleti; invarianza dei dati esistenti. Ogni voce finisce in un AC o in un «Fuori perimetro» esplicito. **Attenzione**: la checklist non deve citare mesi, fatture o chiusure; scrivila in termini generici e riporta nel report il rischio che sia comunque calibrata sul profilo nascosto.
- **V2 bozza completa prima del salvataggio**: la skill mostra al committente la bozza intera (storie, AC, ipotesi, fuori perimetro) prima di scrivere nel backlog e la ripresenta dopo ogni modifica; nessun salvataggio senza approvazione dell'ultima versione.
- **V3 ricerca dei conflitti obbligatoria**: prima delle domande, ricerca esplicita in `docs/PRD.md`, `docs/wiki/decisions/` e `docs/wiki/references/` dei termini della richiesta e delle sigle `RF-`, con esito riportato nel dialogo; `wiki search` non basta.
- **V4 reviewer avversario delle storie**: dopo la bozza e prima dell'approvazione, una sessione separata (stesso modello) legge PRD, decisioni e bozza e produce un elenco di «temi non coperti e contraddizioni»; la skill li riporta al committente come domande.

### Passi

1. Matrice `matrice-spec.json`: 100 celle in ordine randomizzato con seme; stessa richiesta iniziale («Quando ho mandato le fatture di un mese vorrei poterlo chiudere, così nessuno mi cambia più le ore sotto i piedi»), stesso profilo nascosto, stesso committente simulato (Opus) in sessione separata.
2. Esegui. Per ogni chiarimento salva dialogo, storie, transcript, `metrics.json` con scambi, minuti, USD, operazioni Wiki, versione della skill copiata.
3. Giudice §2.3, due letture per chiarimento. Riporta l'accordo tra letture.
4. **Analisi**: punteggio per variante e modello (mediana, min–max, bootstrap contro V0); copertura per tema (quale variante fa emergere «quali mesi», «concorrenza», «schede aperte», oggi mai chiariti); indicatori di processo; costo per punto guadagnato; variabilità tra repliche della stessa variante confrontata con quella tra varianti.
5. **Report** secondo §5: tile in «Cosa emerge» (miglior variante per modello con Δ e intervallo; costo medio per chiarimento; temi mai chiariti rimasti; accordo del giudice); overview con una riga per cella (variante × modello) e barra di fase che qui mostra **domande, bozza, revisione avversaria, salvataggio** come fasi colorate con i minuti; matrice di copertura dei temi per variante (heatmap testuale Esp/Par/Non con conteggi su 10); tabella dei 100 chiarimenti in `<details>` per cella; diff delle skill copiate; metodo e limiti.
6. **Passo opzionale 6b**, solo se il budget residuo lo consente e dopo aver mostrato i risultati: dalle storie della miglior variante di ciascun modello, due sviluppi diretti ciascuna valutati dall'oracolo, per vedere se il tetto funzionale si alza. Non è parte dell'ipotesi H6: riportalo come osservazione.

---

## 5. Report 1 · «Qual è il pavimento di rumore?»

Slug `pavimento-rumore`. Il più costoso: lancialo per ultimo, dopo aver mostrato i risultati di 4 e 6.

### Ipotesi pre-registrata

**Ipotesi H1**: la varianza tra repliche della stessa cella è dello stesso ordine della differenza tra «diretto» e «completo», quindi gli scarti finora osservati sotto 5 punti non sono interpretabili. **Metrica di decisione**: deviazione standard pooled tra repliche e differenza minima rilevabile con 5 repliche per cella (α 0,05, potenza 0,8). **Esito atteso da registrare nell'indice**: il numero di punti sotto il quale, da qui in poi, una differenza si scrive «entro il rumore». Secondaria: differenza appaiata completo−diretto con intervallo bootstrap.

### Disegno

- **Storie fisse**: US-060 e US-061 dai chiarimenti D-sonnet-wiki e D-opus-wiki, come nel report Wiki. Clone di partenza identico per tutte le prove dello stesso modello, Wiki presente e `wiki.enabled: true` dichiarato e verificato dal banco.
- **Celle** (2 × 2 modelli): «diretto» = un unico prompt che implementa le due storie senza skill ARchetipo, Wiki presente ma non richiesta; «completo» = `archetipo-plan` → `archetipo-implement` → `archetipo-review` per storia, con rework se la review lo chiede, come in C1 della matrice principale ma con il flag Wiki corretto.
- **Repliche**: 5 nuove per cella, 20 prove, ordine randomizzato con seme. Le prove esistenti della stessa configurazione (sonnet-DN, opus-DN, sonnet-C2, opus-C2, C1) **non** entrano nel calcolo del rumore perché differiscono per flag o per Wiki: riportale in una tabella separata «prove precedenti, a titolo di confronto».
- **Oracolo**: ogni consegna valutata tre volte (mediana e min–max). Per una prova per cella, genera un **secondo adattatore indipendente** con una sessione diversa e valuta anche con quello: la differenza tra i due adattatori è la stima del rumore dell'oracolo da scrivere nell'indice.
- Dopo ogni consegna esegui anche `bench/common/tecnica.py` (§2.2) e aggiorna il report 4.

### Analisi

- Per cella: mediana, min, max, SD del punteggio funzionale; stessa cosa per minuti, USD, token, righe.
- SD pooled; differenza minima rilevabile a 5 repliche; quante repliche servirebbero per rilevare 2, 5 e 10 punti.
- Differenza completo−diretto appaiata per modello, con bootstrap.
- Quali controlli falliscono **sempre** nella cella (dipendono dalle storie), quali **a volte** (dipendono dalla replica): è la tabella più utile del report.
- Rumore dell'oracolo: differenza tra le tre valutazioni della stessa consegna e tra i due adattatori.
- Costo per punto e per consegna.

### Report

Secondo §5. Tile: SD pooled; differenza minima rilevabile; Δ completo−diretto con intervallo; rumore dell'oracolo. Overview con una riga per prova (20 righe, filtro per modello e per cella), barre di fase con i colori standard; tabella per cella; tabella «controlli sempre / a volte / mai falliti»; tabella delle valutazioni ripetute; prove precedenti a confronto; costo dell'esperimento; metodo e limiti.

---

## 6. Stile condiviso dei report

Tutti i report e l'indice usano lo stesso foglio di stile `bench/common/style.css` (contenuto in §6.3, preso da `report.html`) e lo stesso generatore di barre `bench/common/html.py`. Non reinventare lo stile: ricopialo.

### 6.1 Struttura di ogni report

1. `<header>` scuro: tag in maiuscolo con progetto, tipo di esperimento e numero di prove; `h1` con la domanda; un paragrafo con richiesta iniziale, configurazioni e modelli.
2. `<section>` «Cosa emerge»: da 3 a 5 tile (numero grande + spiegazione in `small`) e 3–5 paragrafi di sintesi. Ogni affermazione cita una cella o un controllo.
3. `<section>` «Overview delle run»: la tabella con `<select id="model">` per filtrare, colonne Percorso · Modello · Prima consegna min (con `small` «n× diretto») · Qualità /100 · Token totali M · Skill / processo eseguito (`td.skill-flow`) · Distribuzione del tempo e skill per fase (`div.bar` + `div.phase-caption`). Ogni riga ha `data-model`, `data-arm`, `data-tokens`; il nome del percorso è un link all'anchor del dettaglio in `<details>`.
4. `<section>` «Quanti token e quanto costo»: tabella Totale M · Input non cache M · Cache read M · Cache creation M · Output k · USD, con nota sul metodo di conteggio.
5. `<section>` «Tempi e consumi per skill e per singola fase»: un `<details>` per prova con riepilogo per skill, tabella delle singole fasi (fase, skill, minuti attivi, token, input non cache, cache, output, USD, operazioni Wiki, stato spec dopo), controlli falliti della prima consegna.
6. `<section>` «Come è stata verificata la qualità»: solo un richiamo a §2 dell'indice con link, più ciò che è specifico del report.
7. `<section>` «Come interpretare i risultati» e «Limiti», con `div.callout` per le avvertenze.
8. `<section>` «Costo dell'esperimento»: tabella delle voci, incluse prove scartate e giudici.
9. `<footer>`: «Generato da bench/… (matrice) · valutazione con l'oracolo comune · prove in …» e link all'indice.

### 6.2 Barre di fase e colori

La barra è un `div.bar` con uno `span` per fase, `width` in percentuale dei minuti attivi del percorso, `title` «Etichetta · skill · n.n min», seguita da `div.phase-caption` con un rigo per fase e il quadratino `<i>` colorato. Le fasi ripetute (rework) usano il colore della skill e compaiono come righe separate nella caption. I colori sono fissi per tutto il banco:

| Fase | Skill | Colore |
|---|---|---|
| Chiarimento | archetipo-spec | `#d49d32` |
| Piano | archetipo-plan (anche con design) | `#8164c6` |
| Mockup standalone | archetipo-design | `#a98ad8` |
| Implementazione | archetipo-implement (review interna inclusa) | `#3e8ac7` |
| Sviluppo diretto | nessuna skill ARchetipo | `#5aa9d6` |
| Accettazione | archetipo-review | `#3c9c85` |
| Manutenzione Wiki | archetipo-wiki refresh | `#c96a5a` |
| Revisione avversaria delle storie (report 6) | sessione separata | `#9c6b3c` |
| Valutazione, giudici, oracolo (se mostrati) | fuori dal percorso | `#8a9a9f` |

Per il report 4 la stessa barra rappresenta la composizione del diff: codice applicativo `#3e8ac7`, test unit `#3c9c85`, test e2e `#6fbfa8`, migrazioni `#8164c6`, UI `#5aa9d6`, `docs/wiki` `#c96a5a`, `.archetipo` `#d49d32`, altro `#8a9a9f`. La legenda del report lo dichiara.

La legenda (`div.legend`) va sotto la tabella overview in ogni report e nell'indice.

### 6.3 Foglio di stile (copiare integralmente in `bench/common/style.css`)

```css
:root{font-family:system-ui,sans-serif;color:#22313a;background:#f4f6f4;line-height:1.5}*{box-sizing:border-box}body{margin:0}main{max-width:1420px;margin:auto;padding:28px}header{background:#183a40;color:#fff;padding:32px;border-radius:18px}h1{font-size:clamp(27px,4vw,46px);line-height:1.12;margin:10px 0}header p{max-width:900px;color:#e1edef}.tag{letter-spacing:.08em;text-transform:uppercase;font-size:13px}section{margin:26px 0;padding:26px;background:white;border-radius:14px;box-shadow:0 2px 12px #16342c08}h2{font-size:25px;margin:0 0 15px}h3{font-size:18px}p{max-width:1100px}a{color:#165e86}table{border-collapse:collapse;width:100%;font-size:14px}th{text-align:left;color:#486069;border-bottom:2px solid #d8e1df}td,th{padding:13px 10px;vertical-align:top;border-bottom:1px solid #e5ebe8}.num{font-variant-numeric:tabular-nums;text-align:right}small{display:block;font-size:11px;color:#61747c;margin-top:4px}.scroll{overflow:auto}.bar{display:flex;min-width:180px;height:22px;border-radius:4px;overflow:hidden}.phase-caption{font-size:11px;line-height:1.45;margin-top:8px;min-width:255px;max-width:340px;overflow-wrap:anywhere}.phase-caption div{margin:5px 0}.phase-caption i{display:inline-block;width:8px;height:8px;margin-right:5px}.skill-flow{font-size:11px;line-height:1.6;min-width:185px;max-width:230px;overflow-wrap:anywhere}.legend{display:flex;gap:15px;flex-wrap:wrap;font-size:12px;margin-top:16px}.legend i{display:inline-block;width:11px;height:11px;margin-right:5px}select{font:inherit;margin:0 8px 15px;padding:6px;border-radius:6px;border:1px solid #c0ceca}details{background:white;border:1px solid #dbe4e0;border-radius:10px;margin:12px 0;scroll-margin:20px}summary{cursor:pointer;padding:17px;font-weight:650}.inside{padding:0 20px 20px;overflow-wrap:anywhere}.inside table{font-size:12px}.resource-table{min-width:900px;overflow-wrap:normal}.resource-table .num{white-space:nowrap}.resource-table small{white-space:normal}.inside li{font-size:13px;margin:9px 0}.gallery{display:flex;gap:12px;overflow:auto}.gallery img{width:260px;border:1px solid #dae0dd;border-radius:6px}li{margin-bottom:14px}.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.comparison figure{margin:0}.comparison img{width:100%;max-height:700px;object-fit:contain;object-position:top;background:#f4f6f4;border:1px solid #dae0dd}.comparison figcaption{font-size:12px;color:#61747c}.muted{color:#596e75}.callout{border-left:4px solid #d49d32;padding-left:16px}footer{padding:20px 0;font-size:12px;color:#627871}@media(max-width:650px){.comparison{grid-template-columns:1fr}main{padding:12px}section{padding:17px}header{padding:22px}td,th{padding:8px}h2{font-size:21px}}
```

Aggiungi solo: `.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}.tile{background:#f4f6f4;border-radius:10px;padding:16px}.tile b{font-size:28px;display:block}` per le tile di «Cosa emerge», e `.status-fatto{color:#3c9c85}.status-corso{color:#d49d32}.status-pianificato{color:#8a9a9f}` per l'indice.

Script minimo, identico a `report.html`: il filtro per modello sulla tabella overview e l'apertura automatica del `<details>` quando si segue un link interno. Nessuna libreria esterna; tutto inline; la pagina deve funzionare aperta da file system.

---

## 7. Consegna finale

Al termine di ogni report, prima di passare al successivo, riporta in chat:

- costo speso e budget residuo del report;
- prove scartate e perché;
- l'esito dell'ipotesi pre-registrata, nella stessa forma in cui è scritta nell'indice;
- il link locale a `bench/index.html` e al report.

L'indice è la sola porta d'ingresso: ogni report linka l'indice e l'indice linka ogni report. Se un criterio di §2 si rivela inapplicabile durante il lavoro, non adattarlo in silenzio: proponi la modifica nell'indice, annotala nel registro, e solo dopo applicala a tutti i report già fatti.
