# Oracoli esterni T1–T4 · procedura del banco

Oracoli eseguibili e indipendenti dalle implementazioni per i quattro compiti. Le checklist
`Tn/controlli.json` sono congelate (24 controlli; 25 per T4) e non vanno modificate; `nelle_storie`
resta `null`. Ogni test ha titolo `[area] CODICE descrizione`; il punteggio per area si calcola
con `shared/punteggio.py`. L'area `regressioni` è il gate CI tutto-o-niente (`shared/gate_ci.py`).

## Struttura

```
oracoli/
  ADATTATORI.md               istruzioni per la sessione Opus che scrive l'adattatore
  shared/                     codice comune, copiato in __oracolo__/shared/
    contratto-comune.ts       NonImplementato, tipi comuni (importi fatturazione, riepilogo, avanzamento)
    setup-integrazione.ts     mock di next/headers|cache|navigation, sessione firmata per chiamata
    integrazione.ts           come/conSessione/tenta, impronte DB, foto righe
    browser.ts                contesti 1440/390 Europe/Rome it-IT, overflow, regex importi
    date-oracolo.ts           aritmetica date/mesi UTC
    proiezioni-baseline.ts    mappatura delle funzioni della baseline sui tipi comuni
    tsconfig.oracolo.json     typecheck dell'oracolo installato
    installa_oracolo.py       installazione in <consegna>/__oracolo__
    gate_ci.py                gate regressioni (CI) tutto-o-niente
    gate_migrazione.py        P1/P2 con dati preesistenti (T1, T3) + M1–M3 (T3)
    migrazione/               fase «prima» (dataset + foto con la baseline), impronte, azzeramento
    punteggio.py              punteggio per area da tutti i risultati
    verifica_copertura.py     verifica statica: ogni codice della checklist coperto una volta
  T1 … T4/
    controlli.json            checklist congelata (non modificare)
    contratto.ts              interfacce che l'adattatore deve implementare
    integrazione.test.ts      livello integrazione (Vitest, Postgres reale, server action reali)
    browser.spec.ts           livello browser (Playwright, Chromium, next start)
    vitest.config.ts / playwright.config.ts
    adattatore-nullo/         baseline: capacità mancanti = NonImplementato (T3/T4 mappano le letture esistenti)
  T3/migrazione/              M1–M3 (migrazione.test.ts) + vitest.migrazione.config.ts
  T3/migrazione_con_dati.py   scorciatoia di gate_migrazione.py --compito T3
  T4/gate_test_regressione.py G1/G2: test aggiunti contro la baseline difettosa e varianti a un solo punto
  T4/giudice.py + giudice-checklist.md   D1, D2, C4 a checklist chiusa
```

## Installazione nella copia immutabile

```bash
python3 oracoli/shared/installa_oracolo.py --compito Tn --consegna <copia> --adattatore <cartella-adattatore>
# taratura della baseline:
python3 oracoli/shared/installa_oracolo.py --compito Tn --consegna <copia> --adattatore-nullo
```
Ricrea `<copia>/__oracolo__/` = contenuto di `oracoli/Tn/` + `shared/` + `ADATTATORI.md` +
`adattatore/` (consegna o nullo). Gli import dei test sono relativi a questa posizione
(`../tests/e2e/support/...`, `./shared/...`, alias `@/` → `src/`). L'adattatore della consegna è
generato una volta da Opus (prompt in `ADATTATORI.md` §7) in `__oracolo__/adattatore/`, conservato
fuori dalla copia e riusato per le rivalutazioni; ogni modifica fuori da `__oracolo__/adattatore/`
fatta da quella sessione va scartata (`git checkout -- . && git clean -fd -e __oracolo__`).

## Contratto env

| Variabile | Valore |
|---|---|
| `DATABASE_URL` | Postgres dedicato alla prova (`oracolo_<prova>`); per integrazione e browser **uguale** a `E2E_DATABASE_URL` |
| `E2E_DATABASE_URL` | come sopra per i livelli dell'oracolo; nel gate CI un database distinto (`oracolo_<prova>_e2e`) |
| `SESSION_SECRET` | facoltativa (≥ 32 caratteri); se assente le config usano una chiave fissa di test |
| `TZ` | `UTC` (forzato dalle config e dagli script, come la CI) |
| `ORACOLO_PLAYWRIGHT_JSON` | percorso del report JSON Playwright (default `playwright-oracolo.json`) |
| `ORACOLO_PORTA` | porta di `next start` del livello browser (default 3000) |

Il browser usa `timezoneId: "Europe/Rome"` e `locale: "it-IT"` (fissati nelle config, prima delle prove).

## Ordine delle fasi per una consegna (comandi dalla radice della copia)

1. **Gate CI regressioni** (prima di installare l'oracolo: lint e build non devono vedere `__oracolo__`):
   `python3 oracoli/shared/gate_ci.py --consegna . --base <baseline> --database-url $DB --e2e-database-url $DB_E2E --uscita <log>`
   → `gate-ci.json` (`ok` tutto-o-niente). La build prodotta qui è quella usata da `next start` al punto 5.
2. **Installazione oracolo** con l'adattatore (vedi sopra).
3. **Solo T1 e T3 · migrazione con dati** su un database DEDICATO e azzerabile (`oracolo_<prova>_migrazione`):
   `python3 oracoli/shared/gate_migrazione.py --compito T1|T3 --consegna . --base <baseline> --database-url $DB_MIGRAZIONE --uscita <log>`
   → `gate-migrazione.json` con P1, P2 e (T3) i controlli M1–M3. Usa un worktree temporaneo della
   baseline: migrate + seed + dataset deterministico di 31 mesi (frazioni, non fatturabili, rimborsi,
   cambi ora, confini di mese) e foto dei report con il codice baseline; poi `migrate deploy` della
   consegna sugli stessi dati e confronto.
4. **Integrazione** (database del punto 1, già migrato e con seed):
   `DATABASE_URL=$DB E2E_DATABASE_URL=$DB npx vitest run --config __oracolo__/vitest.config.ts --reporter=json --outputFile=<log>/vitest-oracolo.json`
5. **Browser** (porta 3000, `next start` della build del punto 1, `fullyParallel: true`, nessun `workers: 1`, `retries: 0`):
   `DATABASE_URL=$DB E2E_DATABASE_URL=$DB ORACOLO_PLAYWRIGHT_JSON=<log>/playwright-oracolo.json npx playwright test --config __oracolo__/playwright.config.ts`
   Prima di avviarlo esegui `npx playwright install chromium` se il browser manca.
6. **Solo T4**:
   - `python3 __oracolo__/gate_test_regressione.py --consegna . --base <baseline-difettosa> --uscita <log> [--database-url $DB]` → `gate-test-regressione.json` (G1, G2);
   - `python3 __oracolo__/giudice.py --consegna . --base <baseline-difettosa> --riepilogo-finale <riepilogo.txt> --riferimento <riferimento.patch> --uscita <log>` → `giudice-t4.json` (D1, D2, C4). `--solo-preparazione` scrive il prompt senza invocare il modello.
7. **Punteggio**:
   `python3 oracoli/shared/punteggio.py --compito Tn --gate-ci <log>/gate-ci.json --vitest <log>/vitest-oracolo.json --playwright <log>/playwright-oracolo.json [--gate-migrazione …] [--gate-t4 …] [--giudice-t4 …] --uscita <log>/evaluation.json`

Ogni test mutante crea i propri dati con la factory e2e (namespace per test/processo) e usa i mesi
riservati di `tests/e2e/support/date.ts`; nessun test muta entità seed. I controlli concorrenti
(T3 N1/N2) eseguono le operazioni simultanee nello stesso test.

## Contratti JSON delle fasi esterne
I contratti completi sono nella docstring di ogni script; in sintesi:
- `gate-ci.json`: `{ok, passi: {migrate, seed, lint, unit, build, e2e_baseline, conservazione}}`.
- `gate-migrazione.json`: `{esito: ok|incerto, P1: {ok, deploy_ok, migrazioni_nuove, additiva}, P2: {ok, drift_ok}, controlli: {M1, M2, M3}}`. P1/P2 richiedono almeno una migrazione nuova; per T1 P1 richiede anche additività (nessuna colonna baseline rimossa, righe preesistenti identiche sulle colonne baseline). `incerto` = baseline non preparabile: risultati non validi, ripetere.
- `gate-test-regressione.json`: `{esito, G1: {ok, casi}, G2: {ok, solo_riepilogo, solo_avanzamento}, varianti, difetto_localizzato}`. Un caso conta se è NUOVO, passa sulla consegna e sulla baseline neutralizzata e fallisce (per asserzione) sulla variante difettosa.
- `giudice-t4.json`: `{esito, D1: {ok, motivazione}, D2: {…}, C4: {ok, file_fuori_riferimento, giudicati}}`.

## Taratura attesa con l'adattatore nullo
- **T1, T2**: tutti i controlli di integrazione e browser falliscono con `NonImplementato`; P1/P2 falsi (nessuna migrazione nuova). Regressioni ok.
- **T3**: i 19 controlli di integrazione/browser falliscono (`adattatoreDati` assente); P1/P2 falsi, M1 fallisce su `validita()`, M2/M3 passano perché la baseline conserva importi e righe.
- **T4** (l'adattatore della baseline collega le funzioni reali): sulla baseline **difettosa** falliscono S1, S2, S4, S5, F1–F4, U1, U2 e passano S3, S6, C1, C2, C3, P1, U3–U6; sulla baseline senza difetto (questo clone) passano tutti i 20 controlli dei livelli integrazione e browser. G1/G2 falsi senza test aggiunti.

## Verifiche statiche disponibili (senza server né database)
```bash
python3 oracoli/shared/verifica_copertura.py                       # copertura delle checklist
npx tsc -p __oracolo__/shared/tsconfig.oracolo.json               # dopo l'installazione
DATABASE_URL=postgresql://x@127.0.0.1:1/x E2E_DATABASE_URL=postgresql://x@127.0.0.1:1/x \
  npx vitest list --config __oracolo__/vitest.config.ts           # discovery integrazione
DATABASE_URL=… E2E_DATABASE_URL=… npx playwright test --list --config __oracolo__/playwright.config.ts
```
`--list` di Playwright non avvia `webServer` né global setup.

## Limiti reali
- L’autore indipendente ha eseguito soltanto typecheck, discovery e verifica statica. Successivamente il banco ha eseguito la taratura runtime sulle sole baseline: controlli negativi T1–T3, T4 difettosa/sana, migrazione con dati, gate T4 sintetico positivo/negativo. Evidenze in `../calibrazione.json`. Gli adattatori tarati sui riferimenti sono stati soltanto tipizzati e non eseguiti.
- T3 N1/N2 eseguono la concorrenza nel processo dell'app: il client Prisma usa un pool `pg`, quindi le operazioni viaggiano su connessioni Postgres distinte e si intercalano come richieste parallele; non c'è concorrenza tra processi Node distinti.
- G1/G2 considerano solo test Vitest aggiunti/modificati; gli e2e Playwright aggiunti sono elencati ma non eseguiti sulle varianti. Un test che importa simboli nuovi (assenti nella baseline) non conta come causale: compare in `informativo`.
- La neutralizzazione delle varianti T4 riconosce `Math.floor((X) * 100) / 100` dentro `calcolaRiepilogoMese` e `calcolaAvanzamentoOfferte`; una forma diversa del difetto produce esito `incerto` (codice 2), non un falso esito.
- Il «cliente» (T1 A3, T2 A2) non esiste come ruolo nella baseline: è un utente autenticato senza ruolo amministrativo e senza profilo Collaboratore, salvo ruolo dedicato dichiarato dall'adattatore.
- I controlli browser leggono importi nel formato it-IT (`640,00`, con o senza separatore delle migliaia) e giornate come le mostra la UI: T4 U2 accetta `0,75` o `0,8` (decimale unico della UI baseline); i valori esatti sono verificati in integrazione.
- T3 M2 confronta importi al centesimo e giornate a 1e-9 su tutti i mesi popolati; il dataset usa tariffe intere e ore multiple di 0,25, quindi un'implementazione fedele non introduce rumore.
- Il giudice T4 usa la CLI `claude` in processo nuovo, effort medium, strumenti vuoti, setting project/local e stream JSON verbose; stream e costo restano conservati. Il banco verifica budget e precondizioni prima di invocarlo.
- `tsconfig.json` della radice include `**/*.ts`: una build lanciata su un albero che contiene `__preparazione__/` tipizza anche questi file (e già l'`esempio-precedente`, che non si risolve fuori da `__oracolo__`). Le copie delle consegne non devono contenere `__preparazione__/`, oppure va escluso.
