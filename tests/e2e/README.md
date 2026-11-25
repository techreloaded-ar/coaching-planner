# Regole per la suite e2e Playwright

Questa suite gira con `fullyParallel: true`. I test devono quindi essere deterministici anche quando file diversi scrivono dati nello stesso database e2e.

## Setup, seed e teardown

- `global-setup.ts` verifica che `E2E_DATABASE_URL` non coincida con `DATABASE_URL`, crea il database e2e se non esiste, ne ricrea lo schema `public` da zero, applica le migrazioni e carica il seed.
- Ogni run parte quindi da uno schema ricreato: nessun test può contare su dati residui del run precedente, e un run interrotto non blocca quelli successivi. Se l'istanza PostgreSQL non risponde, la suite lo dice esplicitamente e indica `docker compose up -d` come rimedio.
- Il seed è una baseline **read-only/smoke**: utenti come Giulia Conti, clienti come TechSolutions/DataFlow e scaglioni km sotto 1000 km non devono essere mutati da test che scrivono.
- `global-teardown.ts` pulisce i dati applicativi una sola volta a fine suite.
- Non fare cleanup concorrente per-test: con worker paralleli una cancellazione locale può rompere un altro test. L'isolamento si ottiene con namespace e risorse riservate.

## Fixture e factory per test mutanti

I test che creano, modificano o cancellano dati devono importare da `tests/e2e/support/fixtures.ts` e usare `factory`, `collaboratore` e/o `clienteConOfferta`.

Regole pratiche:

- accedi con `accediComeCollaboratore(page, collaboratore.utente.email)` quando il test scrive righe front-office;
- seleziona clienti/offerte per `label` o `value` generati dalla factory, mai con `selectOption({ index: ... })`;
- usa note, codici e ragioni sociali univoci per localizzare righe e card;
- non usare `DATABASE_URL` negli helper e2e: il layer support legge solo `E2E_DATABASE_URL`.

Nota tecnica: il support DB e2e è incapsulato in `support/prisma.ts`; attualmente usa `pg` dietro lo stesso confine perché il client Prisma TS generato non è caricabile dal transform Node di Playwright. I test non devono dipendere da questa scelta interna.

## Mesi riservati

I report e gli scenari che aggregano per mese non devono asserire sul mese corrente globale o sul “mese precedente vuoto” condiviso.

Usa gli helper in `support/date.ts`:

- `meseRiservato(codiceSpec)` / `dataNelMeseRiservato(...)` per mesi stabili;
- `mesePassatoRiservato(codiceSpec)` / `dataNelMesePassatoRiservato(...)` per report e casi su date passate.

Attenzione: i mesi riservati "normali" sono assegnati con un hash su una
finestra di 120 mesi, quindi due chiavi diverse possono cadere nello stesso
mese. Va bene finché il test asserisce solo su entità proprie (cliente,
offerta, collaboratore creati dalla factory), perché le righe estranee non
compaiono nelle sue asserzioni.

Un test che asserisce **valori globali del mese** — totali di pagina del
report fatturazione (`report-total-*`), oppure che un mese sia vuoto — non
tollera nessuna riga estranea nel mese: la sua chiave va registrata in
`SLOT_MESI_RISERVATI_ESCLUSIVI` in `support/date.ts` con uno slot libero.
Gli slot espliciti garantiscono l'unicità del mese per costruzione, in una
banda (360+ mesi indietro) fuori dalla portata delle chiavi hash.

Se il test **crea dati** nello slot esclusivo, passa come offset
`mesiIndietroPerTentativo(test.info())` (ad esempio nell'opzione `mesiIndietro`
di `creaDatasetReportFatturazioneClienti`): ogni retry e ogni ripetizione
`--repeat-each` usa un mese diverso dello slot (8 mesi), così i dati lasciati
da un tentativo precedente non raddoppiano i totali del successivo.

## Scaglioni km

`ScaglioneKm.finoAKm` è una risorsa globale con vincolo di unicità, quindi non è namespaceabile per relazione come clienti/offerte.

Il registro vive in `support/reserved-resources.ts`:

- seed e dati base: sotto 1000 km;
- `anagrafica-scaglioni.spec.ts`: 9000-9999;
- `demo__anagrafica-scaglioni.spec.ts`: 6000-6999;
- nuovi test: intervalli espliciti da 10000 km in su.

Non usare `Date.now() % 900` e non creare scaglioni sotto 1000 km nei test.

## Aggregati globali futuri

Per report aggregati globali, come avanzamento offerte, non asserire conteggi o totali dell'intero portafoglio se altri worker possono creare righe nello stesso periodo. Crea una tua offerta/cliente/collaboratore, naviga sul periodo riservato e verifica riga-per-riga i valori della tua offerta.

## Selettori e sincronizzazione

- Preferisci ruoli, label, heading, testo esatto o `data-testid` minimi.
- Non usare classi Tailwind come contratto primario del test.
- Non usare `waitForTimeout` per sincronizzare logica funzionale: usa `expect`, `waitForURL`, locator web-first o polling su stato osservabile.
- `slowMo` e una pausa finale `waitForTimeout(1500)` sono ammessi solo nei demo video come ritmo di registrazione, con commento esplicito.

### Idratazione e click su handler client

L'HTML server-rendered supera gli actionability check di Playwright prima che React abbia agganciato gli handler: un click in quella finestra è un no-op e produce flake (visto sulla US-032, amplificato da `npm run dev` con route fredde e worker paralleli).

Le tabelle offerte espongono il contratto osservabile `data-idratata` (hook `useIdratata` in `src/components/use-idratata.ts`): vale `"false"` nell'HTML SSR e passa a `"true"` solo a idratazione avvenuta.

Regola: ogni click su handler client (espansione riga, "Elimina") che è la **prima interazione client dopo una navigazione documentale** (goto, reload, redirect post-server-action; il click da menu è invece una navigazione client, ma gli helper restano innocui) va preceduto dagli helper di `support/offerte.ts` — `apriPaginaOfferte` o `attendiTabellaOfferteIdratata`/`attendiTabellaOfferteClienteIdratata`. Non servono per: submit di form server-action (progressive enhancement), link `<a>`, o click successivi a interazioni client già riuscite nella stessa pagina.

La suite avvia per default `npm run build && npm run start`, anche in locale:
la build di produzione elimina HMR e compilazione on-demand delle route dal gate.
La CI esegue già il build in uno step precedente e mantiene l'override
`PLAYWRIGHT_WEB_SERVER_COMMAND="npm run start"`.

Per diagnosticare problemi specifici di sviluppo si può usare
`PLAYWRIGHT_WEB_SERVER_COMMAND="npm run dev"`; questa misura va tenuta distinta
dal gate su produzione. Il contratto di idratazione resta necessario anche in
produzione.

### Sessioni indipendenti

Per verificare utenti o ruoli diversi usa test distinti (ognuno ha il proprio
BrowserContext) o context separati. `context.clearCookies()` non è un logout e
non impedisce a una risposta protetta già in volo di ripristinare il cookie di
sessione tramite `Set-Cookie`. I test del logout devono usare il pulsante Esci.

Per il setup di scenari di business è disponibile `preparaSessioneE2e` in
`support/auth.ts`: su un BrowserContext nuovo usa la stessa API del login
simulato e condivide il cookie jar della pagina. Lo scenario apre poi la propria
destinazione protetta. I test che verificano il percorso di accesso continuano a
usare `accediCome` e i suoi wrapper.

Dopo una Server Action con redirect, attendi la destinazione osservabile con
`waitForURL` prima delle assertion su messaggi e righe: gli header `303` possono
precedere la fine dello stream RSC. `attendiEsitoUtente` in
`gestione-utenti.spec.ts` applica questa sincronizzazione usando il budget del
test già configurato, senza attese fisse o retry dell'azione.


## Verifica locale: e2e mirati

La verifica locale di un checkout (`archetipo execution environment check verifica`, cioè `sh scripts/archetipo/ambiente.sh verifica`) non esegue tutta la suite: dopo lint, test unitari e build esegue solo le spec che toccano ciò che è cambiato rispetto al ramo base. **La suite completa gira in CI sulla pull request**, ed è quella a dire se la modifica può essere unita.

Le spec le sceglie `scripts/archetipo/selezione-e2e-mirati.ts`, e il registro del check elenca ogni spec scelta con il motivo:

- una spec modificata viene eseguita, e un helper modificato (`support/…`) porta con sé tutte le spec che lo importano;
- un sorgente modificato porta con sé le spec con il suo stesso nome (`src/lib/esportazione-fatturazione.ts` → `esportazione-fatturazione.spec.ts`) e quelle che citano le rotte che lo usano;
- ogni spec scelta porta con sé la gemella `demo__…`, e viceversa;
- `home-page.spec.ts` e `auth-flows.spec.ts` girano sempre;
- un modulo condiviso da più di dieci rotte non viene espanso (selezionerebbe quasi tutto): il registro lo segnala e l'impatto ampio lo verifica la CI;
- schema e migrazioni Prisma, configurazione di Playwright e di Next, dipendenze, proxy, layout radice e setup e2e richiedono la suite completa anche in locale, fermandosi al primo fallimento.

Perché la selezione funzioni, le spec devono rispettare due convenzioni:

- la demo di `nome.spec.ts` si chiama `demo__nome.spec.ts`;
- una spec che esercita una pagina ne cita il percorso (`page.goto("/report/fatturazione-clienti")`, `toHaveURL(/\/offerte/)`), anche quando poi ci arriva con un clic.

`E2E_SUITE_COMPLETA=1` forza la suite completa; `E2E_MIRATI_BASE=<ramo o commit>` cambia il termine di confronto (predefinito `origin/main`, poi `main`).

## Gate di stabilità della suite

Prima di considerare stabile una modifica alle spec o all'infrastruttura e2e:

```bash
npm run lint
npx playwright test --retries=0
```

Per questa suite il gate di stabilità finale è tre esecuzioni consecutive di `npx playwright test --retries=0`, mantenendo `fullyParallel: true` e senza forzare `workers: 1`.
