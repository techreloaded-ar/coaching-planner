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

## Gate locale

Prima di considerare stabile una modifica e2e:

```bash
npm run lint
npx playwright test --retries=0
```

Per questa suite il gate di stabilità finale è tre esecuzioni consecutive di `npx playwright test --retries=0`, mantenendo `fullyParallel: true` e senza forzare `workers: 1`.
