# Instabilità Playwright — 29 ottobre 2026

## Metodo e confronto con CI

Baseline sul commit `6ad3ddd7c5368b1967e2be03573afaf1b3ea9df0`, in una
worktree isolata: Chromium, 5 worker (default), `fullyParallel: true`,
30 ripetizioni di ciascun file e `--retries=0 --trace=retain-on-failure`.
Il codice applicativo resta quello del commit per tutte le baseline.
Porta 3107 e database sintetico dedicato evitano interferenze con il server
esistente sulla porta 3000. Il wrapper diagnostico cambia porta, URL, database
e cattura dell'output, senza cambiare parallelismo o timeout.

La CI è stata verificata in `.github/workflows/ci.yml`: esegue `npm run build`
e poi avvia gli e2e con `PLAYWRIGHT_WEB_SERVER_COMMAND="npm run start"`.
Il default locale originale era `npm run dev`. Le misure sotto confrontano
entrambi i runtime. Log, `error-context.md` e file `.trace`/`.network` dei trace
sono stati letti e conservati prima di ricreare `test-results` nel run successivo.
Un pilot utenti interrotto dopo una modifica alla configurazione diagnostica
è escluso dai conteggi.

## 1. Logo: risposta in volo dopo clearCookies

Il flake spontaneo non è comparso nelle 30 ripetizioni del caso «schermi piccoli»
né su dev né su produzione. Il meccanismo è però dimostrato in entrambi i runtime:
una vera risposta di `GET /api/attivita/calendario`, trattenuta dal test, contiene
`Set-Cookie: cp_sessione=…`; dopo `clearCookies()` il cookie è assente, ma viene
ripristinato consegnando la risposta. La radice risulta nuovamente autenticata.

**Correzione:** front office e back office su schermi piccoli diventano test
distinti, ciascuno con il BrowserContext nuovo della fixture. Restano le
verifiche su dimensioni e sovrapposizione con Esci. Nessuna modifica al seed.
`clearCookies()` non eseguiva il logout applicativo: questa prova non dimostra
una regressione del pulsante Esci e non giustifica cambiare il protocollo di sessione.

## 2. Utenti: conflitto al commit e carico durante i redirect

Entrambe le action avevano già tre retry, ma riconoscevano soltanto `P2034`.
PrismaPg 7.8.0 può invece propagare direttamente dal COMMIT:

```text
DriverAdapterError: TransactionWriteConflict
cause.originalCode = "40001"
cause.kind = "TransactionWriteConflict"
```

Manca `code: "P2034"`, quindi il retry originale rilancia l'errore. Sono stati
osservati due HTTP 500 per questo conflitto su dev e due su produzione.

**Correzione applicativa:** helper condiviso che riconosce anche questa precisa
forma di 40001 e ritenta l'intera transazione, con gli stessi tre retry massimi.
`Serializable` resta: due amministratori concorrenti non devono poter superare
entrambi il conteggio e rimuovere l'ultimo amministratore attivo. Il retry rilegge
il conteggio; redirect e invalidazioni restano dopo il commit. Gli altri errori
non sono ritentati.

I unit test coprono formato dell'errore, limite dei tentativi, propagazione degli
altri errori e rivalutazione della protezione dopo un conflitto. Un esperimento
PostgreSQL con 30 coppie di amministratori factory, conteggio limitato a ciascuna
coppia e letture sincronizzate, completa ogni coppia con un retry e un amministratore
ancora attivo. Non sostituisce i test delle action: verifica il meccanismo reale
con l'adapter installato.

Su produzione ci sono anche cinque assertion scadute dopo POST riuscite (`303`).
Le trace residue mostrano uno stream RSC ancora incompleto quando scade la
finestra di 5 secondi dell'assertion: in un caso gli header del 303 sono già
arrivati dopo circa 800 ms. Il test stava ancora aspettando una navigazione,
mentre aveva già avviato l'assertion sul suo risultato.

**Correzione di sincronizzazione:** `attendiEsitoUtente` aspetta con `waitForURL`
la route e l'esito della Server Action, usando il budget complessivo del test
esistente; seguono le assertion originali su URL, messaggi e dati. Il helper
espone un `test.step` per misurare l'attesa. Non sono cambiati i valori configurati
di timeout, worker o retry. Un HTTP 500 continua a impedire l'esito atteso.
Il setup comune percorreva inoltre radice → landing autenticata → console
prima di ogni scenario utenti: durante un picco due soli `goto` hanno consumato
circa 6 e 9 secondi del budget di 30, prima delle verifiche di business.
`preparaSessioneE2e` prepara ora la stessa sessione tramite l'API già esistente,
in un context nuovo, e apre direttamente il back office. I percorsi dei test
dedicati all'autenticazione restano invariati. Un test su produzione ha verificato
che il cookie del client API viene applicato al BrowserContext e permette
l'accesso alla pagina protetta.

La disabilitazione del prefetch era stata valutata, ma non eliminava i ritardi:
la prop è stata rimossa dalla correzione finale. I due run interrotti durante
queste verifiche sono conservati come `utenti-prod-after-pilot-1` e
`utenti-prod-after-pilot-2` ed esclusi dai tassi finali.

Rischio residuo: un conflitto persistente oltre tre retry viene propagato.

## 3. Attività: due race del form, remount HMR non dimostrato

Il flusso originale completa 30/30 ripetizioni sia su dev sia su produzione:
il flake spontaneo non è stato riprodotto. Non è quindi dimostrato che HMR
abbia rimontato il componente nel fallimento segnalato.

Due esperimenti con risposte HTTP trattenute, senza attese fisse, dimostrano
invece difetti applicativi anche su produzione:

- Salva modifiche è abilitato prima che la lettura offerte valorizzi `offertaId`.
  Il submit incontra «Compila tutti i campi obbligatori», senza POST; la riga
  resta a `3.5 h` nonostante il valore `7,25` inserito.
- Dopo Modifica → Annulla → Modifica su un'altra riga, la prima risposta tardiva
  sovrascrive l'offerta del nuovo form, lasciandola incoerente con il cliente.

**Correzione applicativa:** salvataggio disabilitato durante la lettura offerte;
una revisione della richiesta impedisce alle risposte superate di modificare
selezione, errori o stato di caricamento del form corrente. Annulla invalida la
lettura precedente. Due nuovi e2e controllano le risposte reali tramite barriere
e verificano il salvataggio della riga corretta, usando esclusivamente factory.

## Ambiente e gate

Gli e2e locali avviano per default `npm run build && npm run start`, allineandosi
al runtime CI. L'override CI `npm run start` resta valido; `npm run dev` resta
un override diagnostico. Il contratto di idratazione del README non viene rimosso.

Il resolver installato di Next.js, `findRootDirAndLockFiles`, su due worktree
reali sotto `.archetipo/increments/worktrees` seleziona il repository padre:
l'inferenza errata della root è confermata. `turbopack.root` e
`outputFileTracingRoot` diventano esplicite e uguali alla directory del checkout.
La seconda opzione riguarda il tracing del build. Questa prova della root non
stabilisce un legame causale con il singolo remount HMR ipotizzato.

Fallimenti / esecuzioni (30 ripetizioni per scenario):

| File | Prima, next dev | Prima, produzione | Dopo, produzione |
| --- | ---: | ---: | ---: |
| `logo-intestazione.spec.ts` | 0/180 | 0/180 | **0/210** |
| `gestione-utenti.spec.ts` | 54/720 | 7/720 | **0/720** |
| `demo__inserimento-righe-attivita-flusso.spec.ts` | 0/60 | 0/60 | **0/120** |

Il logo ora ha due scenari separati per gli schermi piccoli (30 tentativi ciascuno).
Il file attività include due nuove regressioni (30 tentativi ciascuna): erano
entrambe rosse sul codice originale e passano dopo la correzione.

Focus sui due scenari utenti citati nella richiesta:

| Scenario | Prima, dev | Prima, produzione | Dopo |
| --- | ---: | ---: | ---: |
| `demo__invalida-riattiva-e-promuove-un-collaboratore` | 8/30 | 2/30 | **0/30** |
| `aggiunge il ruolo Collaboratore a un amministratore: campi obbligatori e profilo attivo` | 3/30 | 1/30 | **0/30** |

Nel run utenti finale, i redirect attesi dal helper richiedono al massimo
circa 1,5 secondi: la riduzione delle navigazioni di setup ha rimosso il carico superfluo,
mantenendo il budget originale di 30 secondi e tutte le assertion di business.

Verifiche finali:

- `npm run lint`: passato, incluso il guardrail anti-flakiness.
- Unit test: **939/939**, 62 file.
- Build di produzione: riuscita; viene eseguita dal nuovo default del web server.
- Gate completo, tre esecuzioni consecutive: **233/233**, **233/233**, **233/233**.
  Tutte con `--retries=0`, nessuno skip, `fullyParallel: true` e 5 worker.

I comandi del gate usano `sh scripts/archetipo/ambiente.sh e2e -c
playwright.diagnosi.config.ts --retries=0 --trace=retain-on-failure`;
le misure aggiungono il file e `--repeat-each=30`. I reporter `line,json`
conservano i conteggi. La configurazione temporanea di trasporto è salvata
come testo negli artefatti; il default del progetto resta la porta 3000.
Non è stata eseguita la pipeline GitHub: le misure sono locali.


Gli artefatti locali non versionati sono in
`docs/test-results/playwright-stabilita-2026-10-29/`.
Un campione di 30 ripetizioni non garantisce l'assenza assoluta di flake.
