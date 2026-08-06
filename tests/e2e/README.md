# Regole per la suite e2e Playwright

Questa suite gira con `fullyParallel: true`. I test devono quindi essere deterministici anche quando file diversi scrivono dati nello stesso database e2e.

## Setup, seed e teardown

- `global-setup.ts` verifica che `E2E_DATABASE_URL` punti a un database e2e dedicato e vuoto, applica le migrazioni e carica il seed.
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

Regola: ogni click su handler client (espansione riga, "Elimina") che è la **prima interazione client dopo una navigazione documentale** (goto, click da menu, redirect post-server-action) va preceduto dagli helper di `support/offerte.ts` — `apriPaginaOfferte` o `attendiTabellaOfferteIdratata`/`attendiTabellaOfferteClienteIdratata`. Non servono per: submit di form server-action (progressive enhancement), link `<a>`, o click successivi a interazioni client già riuscite nella stessa pagina.

Misura complementare (non sostitutiva) per CI: lanciare la suite contro una build di produzione con `PLAYWRIGHT_WEB_SERVER_COMMAND="npm run build && npm run start"`, che elimina la compilazione on-demand delle route.

## Gate locale

Prima di considerare stabile una modifica e2e:

```bash
npm run lint
npx playwright test --retries=0
```

Per questa suite il gate di stabilità finale è tre esecuzioni consecutive di `npx playwright test --retries=0`, mantenendo `fullyParallel: true` e senza forzare `workers: 1`.
