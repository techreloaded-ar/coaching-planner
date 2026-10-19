# Piano di lavoro — Benchmark ARchetipo × Wiki su Coaching Planner

Obiettivo: replicare il report "ARchetipo: dal requisito vago alla consegna" (RideAtlas, 12 prove Sol/Luna) su **Coaching Planner**, con modelli Claude e con un asse sperimentale nuovo: **l'incidenza della Wiki** (lettura come contesto + skill che la mantengono) su tempi, token, costo e qualità della consegna.

Il piano è scritto per essere eseguito da Claude in modo automatico: un harness lancia ogni fase come sessione `claude -p` isolata, raccoglie la telemetria, valuta le consegne con un oracolo esterno comune e genera il report HTML finale.

---

## 1. Domande a cui il report deve rispondere

1. Quale percorso offre il miglior compromesso tempo/token/costo/qualità con Sonnet e con Opus?
2. Quanto costa la Wiki (minuti, token, USD) dentro ogni percorso: lettura, manutenzione, validazione, approvazione?
3. La Wiki migliora la scoperta dei requisiti (es. far emergere il conflitto con una decisione già presa) e la qualità del codice (es. trovare tutti i percorsi di scrittura)?
4. In che stato resta la Wiki a fine consegna (valida, aggiornata, decisione superata documentata) rispetto al costo pagato?

---

## 2. Funzionalità di benchmark: "Chiusura del mese consuntivato"

### Perché questa

- **Contraddice una decisione documentata**: il PRD (`docs/PRD.md:109`, RF-15 a `docs/PRD.md:280`) e la Wiki (`docs/wiki/references/prd.md:123`, `:294`) dicono esplicitamente che il mese resta sempre modificabile. Un buon chiarimento deve far emergere il conflitto e trattarlo come decisione superata (ADR). È il punto in cui la Wiki dovrebbe fare la differenza.
- **Invariante trasversale**: il blocco deve valere su *tutti* i percorsi di scrittura di `RigaAttivita` in `src/lib/actions/righe-attivita.ts` — `creaRiga`, `modificaRiga`, `eliminaRiga`, `rimuoviRimborsoTrasferta`, `duplicaRigaSuGiorni` (trappola: origine in mese aperto, destinazione in mese chiuso) — più l'area attività dell'amministratore. La code map della Wiki li elenca; senza Wiki vanno trovati leggendo il codice.
- **Complessità media, simile a RideAtlas**: nuovo modello e migrazione Prisma, ruoli, ciclo di vita (chiuso/riaperto), concorrenza, UI calendario con cache client (300 s, `docs/wiki/domains/attivita.md`), report.
- Non esiste nel backlog (59 spec, nessuna sovrapposizione).

### Richiesta vaga iniziale (identica per tutte le prove)

> «Quando ho mandato le fatture di un mese vorrei poterlo chiudere, così nessuno mi cambia più le ore sotto i piedi.»

### Profilo del committente (fissato prima delle prove, nascosto agli agenti)

Il committente simulato risponde **solo ai temi sollevati**, senza fornire la rubrica né suggerire requisiti dimenticati.

| Tema | Bisogno reale |
|---|---|
| Decisione precedente | Sa che RF-15 diceva "nessun blocco"; ora cambia idea perché le divergenze con le fatture emesse sono diventate un problema. Accetta di superare la decisione. |
| Chi | Solo l'amministratore chiude e riapre. I collaboratori vedono lo stato, non lo cambiano. |
| Granularità | Mese globale (tutti i collaboratori, tutti i clienti). Non per cliente né per collaboratore. |
| Quali mesi | Solo mesi conclusi: non si può chiudere il mese corrente né un mese futuro. |
| Effetto | Nessuno può creare, modificare, eliminare righe, rimuovere rimborsi o duplicare righe *verso* giorni di un mese chiuso. Vale anche per l'amministratore: per correggere deve riaprire. |
| Riapertura | Consentita all'amministratore con motivazione obbligatoria. |
| Tracciabilità | Si vuole sapere chi ha chiuso/riaperto e quando (storico, non solo l'ultimo stato). |
| Visibilità | Calendario e dettaglio giornata mostrano chiaramente "mese chiuso" e non offrono azioni di modifica; i report indicano se il mese è chiuso. |
| Concorrenza | Una modifica in corso mentre l'amministratore chiude deve finire prima della chiusura o essere rifiutata: nessuna scrittura dopo la chiusura. |
| Schede aperte | Chi ha il calendario aperto da prima della chiusura deve ricevere un errore chiaro al salvataggio, non un falso successo. |
| Dati | Chiudere non altera né cancella righe; i report fatturazione restano identici. |

---

## 3. Matrice sperimentale

10 prove = 5 configurazioni × 2 modelli (`claude-sonnet-5-5`, `claude-opus-5-5`), stesso `--effort` per tutte (default `medium`, registrato nel manifest).

| ID | Configurazione | Wiki | Fasi (per ogni storia prodotta dal chiarimento) |
|---|---|---|---|
| C1 | ARchetipo completo | sì | `archetipo-spec` → `archetipo-plan` → `archetipo-implement` → `archetipo-review` (autonoma, max 3 rework) |
| C2 | Solo storie → diretto | sì | `archetipo-spec` → sviluppo diretto (tutte le storie insieme) → `archetipo-wiki refresh` |
| C3 | Solo storie → diretto | no | `archetipo-spec` → sviluppo diretto (tutte le storie insieme) |
| C4 | Senza piano | sì | `archetipo-spec` → sviluppo diretto → `archetipo-wiki refresh` → `archetipo-review` (autonoma, max 3 rework) |
| C5 | Senza piano | no | `archetipo-spec` → sviluppo diretto → `archetipo-review` (autonoma, max 3 rework) |

Coppie che isolano la Wiki: **C2↔C3** e **C4↔C5**. C1 mostra il costo della Wiki nel processo completo, misurato *dentro* le fasi (vedi §6).

### Scelte di disegno

- **Chiarimento condiviso, ma separato per Wiki**: `archetipo-spec` legge la Wiki, quindi per ogni modello si eseguono **due** chiarimenti: `D-W` (con Wiki, riusato da C1, C2, C4) e `D-noW` (senza Wiki, riusato da C3, C5). Totale 4 chiarimenti fisici. Come nel report originale, il costo del chiarimento è aggiunto una volta a ogni percorso che lo riusa e i totali non vanno sommati tra righe.
- **"Senza Wiki"** significa: `docs/wiki/` rimossa con un commit nel clone di prova, skill `archetipo-wiki` rimossa da `.claude/skills/` e `.agents/skills/`. Il PRD resta: l'alternativa realistica alla Wiki è PRD + codice. Le skill gestiscono già l'assenza (`E_PRECONDITION`, fallback al PRD).
- **Manutenzione Wiki nei percorsi diretti** (C2, C4): fase dedicata `archetipo-wiki refresh` dopo lo sviluppo, così il suo costo è misurato esattamente e non confuso con lo sviluppo. Il prompt dello sviluppo diretto non nomina la Wiki: se l'agente la legge spontaneamente, lo misuriamo.
- **Review autonoma**: il controller attiva `archetipo-review` con le tre righe letterali richieste dalla skill (`.claude/skills/archetipo-autopilot/references/acceptance-loop.md`), come fa l'autopilot. In C4/C5 il rework è uno sviluppo diretto sul feedback persistito.
- **Niente mockup forzati**: `archetipo-design` resta solo dove la decide `archetipo-plan` (C1). Il focus è la Wiki; la sezione mockup del report compare solo se ci sono mockup prodotti.
- **Worktree ARchetipo disabilitato** nei cloni (`worktree.enabled: false`): ogni prova ha già il suo clone; tenerlo uniforme tra le configurazioni.
- **Esecuzione sequenziale, ordine fisso** e registrato: Playwright usa la porta 3000 fissa (`playwright.config.ts:57`) e la sequenzialità rende i tempi confrontabili.
- **Opzionali** (da confermare, non inclusi nel conteggio): C6 = completo senza Wiki (chiude la coppia per C1, +2 prove); C0 = diretto dal vago (baseline del report originale, +2 prove).

---

## 4. Isolamento e ambiente di ogni prova

- **Baseline**: commit `157ea55` (o quello fissato al via). Il clone si crea con `git archive <sha> | tar -x` + `git init` + commit "baseline": nessuna storia Git, quindi nessuna fuga di questo piano o del profilo committente. Le skill (`.claude/skills`, `.agents/skills`) sono gitignored: l'harness le copia dall'installazione corrente in ogni clone. I modelli si passano come alias (`sonnet`, `opus`) e il modello risolto viene registrato dall'evento `init`.
- **Directory**: harness in `bench/wiki-benchmark/` nel repo; prove in `~/repo/coaching-planner-bench-runs/<run-id>/` fuori dal repo. Permesso negato in lettura verso il repo originale tramite `--settings` (`deny: Read(/Users/smarello/repo/coaching-planner/**)`).
- **Database dedicati** sul Postgres docker esistente: `cp_bench_<run>` e `cp_bench_<run>_e2e`, creati, migrati e seminati prima della prova; `.env` di prova generato da `.env.example` con `DATABASE_URL`/`E2E_DATABASE_URL` dedicati e segreti sintetici. Il `.env` di sviluppo non viene letto né toccato.
- **Contaminazione della configurazione Claude**: le sessioni girano con `--setting-sources project,local` così non caricano plugin e hook utente (ponytail, graphify) né memoria. Il controller verifica l'evento `system/init` dello stream (modello, skill, plugin, MCP) e **scarta la fase** se trova elementi estranei. Da verificare in calibrazione anche il caricamento di `~/.claude/CLAUDE.md`; se non è escludibile, usare un `CLAUDE_CONFIG_DIR` dedicato.
- **Permessi**: `--permission-mode bypassPermissions` nel clone isolato, `--max-budget-usd` per fase come rete di sicurezza.
- **Hash**: a fine prova si archiviano diff, `git log` del clone e hash dei sorgenti consegnati prima di qualsiasi valutazione.

---

## 5. Committente simulato

- Sessione `claude -p` separata, modello fisso per tutte le prove (`claude-sonnet-5-5`, effort low), con il profilo §2 come system prompt e la regola "rispondi solo a ciò che ti viene chiesto, non anticipare temi".
- Loop del controller: `archetipo-spec` produce una domanda → il committente risponde → `claude --resume <session-id>` della sessione spec con la risposta. Termina quando le storie sono scritte nel backlog o dopo 20 scambi.
- Le richieste di approvazione delle storie le gestisce il committente con lo stesso profilo (approva, o chiede una correzione solo se una storia contraddice esplicitamente il profilo).
- I tempi di risposta del committente sono esclusi dai minuti attivi e conservati a parte. Le domande di supporto tecnico vanno registrate separatamente da quelle sui requisiti.

---

## 6. Telemetria

Per ogni fase si conserva lo stream `--output-format stream-json --verbose` completo e il transcript JSONL della sessione (inclusi quelli dei subagenti/worker).

**Misure per fase** (dall'evento finale `result`): `duration_ms` (minuti attivi), `duration_api_ms`, `num_turns`, `usage` (input non cache, cache read, cache creation, output), `modelUsage` per modello, `total_cost_usd`. In calibrazione verificare che `modelUsage` e costo includano i subagenti; se no, sommarli dai transcript dei sidechain.

Rispetto al report originale si aggiunge il **costo in USD** reale riportato da Claude Code.

**Incidenza della Wiki** (nuova sezione), su tre livelli:

1. **Fasi dedicate** (esatto): `archetipo-wiki refresh` in C2/C4.
2. **Operazioni Wiki dentro le fasi** (stima dichiarata come tale): dai transcript si classificano come "wiki" i tool call `Bash` con `archetipo wiki …` e i `Read/Edit/Write/Grep/Glob` su `docs/wiki/**`. Per ognuno: numero di chiamate, byte letti/scritti, durata tool_use→tool_result; token attribuiti = usage dei turni dell'assistente i cui tool call sono solo wiki (i turni misti si riportano a parte, non ripartiti).
3. **Delta di coppia** (osservato): C2−C3 e C4−C5 su minuti, token, USD e qualità, con l'avvertenza che una sola replica non stima un effetto causale.

---

## 7. Valutazione esterna della qualità

Oracolo comune applicato alla **prima consegna** di ogni prova, dopo la fine di tutto lo sviluppo cronometrato. Nessun agente riceve gli esiti.

**Infrastruttura**: Postgres reale (DB di valutazione per prova), due processi Next sulla consegna, sessioni sintetiche firmate con `SESSION_SECRET` per collaboratore A, collaboratore B, amministratore, visitatore. Due livelli:

- **Integrazione** (Vitest): invoca le server action reali con sessione sintetica e verifica lo stato nel DB.
- **Browser** (Playwright Chromium): flussi UI, 390 px, nessuna eccezione JS non gestita.

Le implementazioni scelgono liberamente nomi, modelli e route: un **adattatore per consegna** collega i controlli alle interfacce prodotte, senza implementare capacità mancanti né correggere il codice.

### Rubrica (100 punti, pesi fissati ora e non modificabili dopo gli esiti)

| Area | Punti | Controlli principali |
|---|---|---|
| Chiusura e riapertura | 12 | chiusura mese concluso; rifiuto mese corrente/futuro; riapertura con motivazione obbligatoria |
| Blocco su tutti i percorsi di scrittura | 22 | crea, modifica, elimina, rimuovi rimborso, duplica verso mese chiuso (anche da mese aperto), area attività amministratore; righe di mesi aperti restano modificabili |
| Autorizzazioni | 12 | collaboratore non può chiudere/riaprire né via UI né invocando l'action; visitatore respinto |
| Concorrenza | 10 | 10 round di scritture contemporanee alla chiusura su due processi: nessuna riga scritta dopo il timestamp di chiusura |
| Visibilità dello stato | 10 | calendario e dettaglio mostrano "chiuso" e non offrono modifica; report indica lo stato |
| Scheda con cache obsoleta | 6 | salvataggio da calendario aperto prima della chiusura → errore chiaro, nessun falso successo |
| Tracciabilità | 6 | storico di chi/quando ha chiuso e riaperto |
| Persistenza e migrazione | 8 | migrazione Prisma versionata presente e applicabile con `migrate deploy`; stato sopravvive al riavvio; report fatturazione invariati |
| Interfaccia e flussi | 6 | flussi completi a 1440 e 390 px, nessuna eccezione JS |
| Regressioni | 8 | step della CI (`.github/workflows/ci.yml`): lint con guardrail e2e, Vitest, build, e2e preesistenti conservati |

Punti area = peso × controlli superati / controlli eseguiti. Le violazioni critiche (scrittura in mese chiuso, collaboratore che chiude) sono segnalate a parte dal punteggio.

### Qualità della Wiki (punteggio separato, solo C1, C2, C4)

| Controllo | Tipo |
|---|---|
| `archetipo wiki validate --profile bootstrap` senza errori | automatico |
| `archetipo wiki affected` sul diff finale: ogni pagina candidata aggiornata o motivatamente invariata | automatico |
| ADR che supera RF-15 (`decision_status: superseded` sulla decisione precedente o nuova `decisions/<slug>` collegata) | automatico + verifica |
| `domains/attivita.md` e `engineering/code-map.md` descrivono invariante e percorsi bloccati | giudice |
| Accuratezza: nessuna affermazione falsa rispetto al codice consegnato | giudice |

Il giudice è un agente Opus fisso con checklist chiusa, che deve citare `file:line` per ogni verdetto; il suo esito è etichettato come giudizio, non come test.

### Cosa è stato chiarito

Matrice per i 4 chiarimenti (Sonnet/Opus × con/senza Wiki) sui temi del profilo: Esplicito / Parziale / Non chiarito. In più: il conflitto con RF-15 è stato sollevato? da quale fonte (Wiki, PRD, codice)?

---

## 8. Struttura dell'harness

```
bench/wiki-benchmark/
  richiesta.txt          # richiesta vaga §2
  committente.md         # profilo nascosto §2
  matrice.json           # prove, fasi, modelli, effort, ordine, budget
  run.py                 # orchestratore (stdlib Python)
  oracolo/               # test di integrazione e browser + adattatori per consegna
  report.py              # aggrega metrics.json → report.html
  template.html          # stessa struttura e stile del report RideAtlas
runs/<run-id>/           # fuori dal repo: repo/, phases/<fase>/{stream.jsonl,transcript/,metrics.json}, diff.patch, hashes.txt
```

`run.py` è **idempotente per fase**: una fase con `metrics.json` valido non viene rieseguita, così una interruzione riprende dal punto giusto (`python3 run.py --resume`). Comandi: `prepare`, `discover`, `run <run-id|all>`, `evaluate`, `report`.

Esempio di invocazione di una fase:

```bash
claude -p "/archetipo-plan US-060" --model claude-opus-5-5 --effort medium --output-format stream-json --verbose --setting-sources project,local --permission-mode bypassPermissions --max-budget-usd 40
```

---

## 9. Fasi di lavoro

| # | Fase | Output | Criterio di completamento |
|---|---|---|---|
| 1 | Congelare baseline, richiesta, profilo, rubrica | `richiesta.txt`, `committente.md`, rubrica in `matrice.json` | file committati prima di qualsiasi prova |
| 2 | Harness: clone isolato, DB dedicati, lancio fasi, raccolta stream | `run.py prepare/run` | un clone di prova parte con DB propri e senza leggere il repo originale |
| 3 | Committente simulato e loop `archetipo-spec` | `run.py discover` | chiarimento completo end-to-end su un clone di prova |
| 4 | Calibrazione (esclusa dai risultati) | `runs/calibrazione-*` | verificati: init pulito (niente plugin utente), subagenti nel costo, rimozione Wiki efficace, review autonoma attivata |
| 5 | Oracolo esterno + adattatore sulla baseline | `oracolo/` | sulla baseline: funzionalità ~0 punti, regressioni 8/8; deterministico su due esecuzioni |
| 6 | Chiarimenti D-W e D-noW per Sonnet e Opus | 4 backlog di storie congelati | storie scritte, transcript conservati |
| 7 | Le 10 prove in ordine fisso | `runs/*/` | ogni prova consegnata o terminata per budget/limite rework, con hash |
| 8 | Valutazione: oracolo, qualità Wiki, matrice chiarimenti | `evaluation.json` per prova | stesso oracolo su tutte le consegne immutate (hash verificati) |
| 9 | Report | `report.html` | stessa struttura del report RideAtlas + sezione Wiki (§10) |

Stima: 4 chiarimenti + 10 prove sequenziali, ordine di grandezza 10–16 ore macchina (il completo RideAtlas con Sol ha richiesto 92 minuti). Il controller può girare in background; la fase 9 la scrive una sessione Opus a partire solo da `metrics.json`, `evaluation.json` e dalle prove.

---

## 10. Struttura del report finale

Stessa impaginazione e stile del report RideAtlas, con queste sezioni:

1. Intestazione: Coaching Planner · 10 prove · richiesta iniziale.
2. **Cosa emerge** (3–4 paragrafi, numeri con limiti).
3. **Overview delle run**: modello, percorso, minuti, ×diretto, qualità /100, token M, **USD**, skill eseguite, barra delle fasi colorata per skill.
4. Token per percorso (non cache / cache read / cache creation / output) e come sono stati ricostruiti.
5. Tempi e consumi per skill e per singola fase (dettagli espandibili per prova, worker come sottoinsieme).
6. **Incidenza della Wiki** (nuova): costo delle fasi dedicate; operazioni Wiki dentro le fasi per skill; delta C2↔C3 e C4↔C5; stato della Wiki a fine consegna; il conflitto RF-15 è emerso con e senza Wiki?
7. Come è stata verificata la qualità: profilo, controlli, rubrica, errori del banco.
8. Come interpretare i risultati e come leggere i confronti.
9. Che cosa è stato chiarito prima dello sviluppo (matrice 4 chiarimenti).
10. Quale lavoro ha intercettato problemi (review interne, accettazioni, test).
11. Quando usare più profondità / quando conviene la Wiki.
12. Cosa cambiare in ARchetipo (con riferimenti `file:line` alle skill).
13. Metodo e limiti; prove ispezionabili (link a stream, diff, esiti).

---

## 11. Limiti da dichiarare già ora

- Una funzionalità, una replica per combinazione: risultati esplorativi, non stime statistiche.
- **Il beneficio della manutenzione Wiki si vede soprattutto sulla funzionalità successiva**: questa prova misura il costo di mantenere e il beneficio di leggere una Wiki già buona, non il ritorno di una Wiki tenuta aggiornata. Possibile secondo round: una seconda funzionalità sopra ogni consegna C2/C3 e C4/C5.
- Committente simulato; login OAuth non verificato (sessioni sintetiche).
- La Wiki di partenza è matura e revisionata: su un progetto con Wiki scarsa l'effetto sarebbe diverso.
- La stima delle operazioni Wiki dentro le fasi è un'attribuzione per turni, non una misura esatta.

---

## 12. Decisioni da confermare prima del via

1. Aggiungere C6 (completo senza Wiki) per chiudere la coppia su C1? (+2 prove)
2. Aggiungere C0 (diretto dal vago) come baseline del report originale? (+2 prove)
3. Effort: `medium` per tutte le prove, come nel report originale?
4. Budget massimo per prova (proposta: 60 USD Sonnet, 150 USD Opus, solo come rete di sicurezza).
