---
type: operations
title: Sviluppo e operazioni
description: Sviluppo locale, build, test, CI, database e vincoli operativi
status: generated
sources:
    - path: package.json
      role: command-manifest
    - path: README.md
      role: development-guide
    - path: docker-compose.yml
      role: local-infrastructure
    - path: docker/postgres/initdb/01-crea-database-e2e.sh
      role: local-infrastructure
    - path: .github/workflows/ci.yml
      role: automation
    - path: playwright.config.ts
      role: e2e-configuration
    - path: tests/e2e/e2e-database-safety.ts
      role: e2e-configuration
    - path: vitest.config.ts
      role: unit-test-configuration
    - path: prisma.config.ts
      role: database-configuration
    - path: src/lib/session-config.ts
      role: runtime-configuration
    - path: scripts/bootstrap-amministratore-iniziale.ts
      role: deploy-bootstrap-command
---
# Sviluppo e operazioni

## Prerequisiti e stack operativo

CI usa Node.js 22. Il progetto usa npm, PostgreSQL e Prisma; Docker Compose fornisce PostgreSQL 17 Alpine in locale con volume persistente. Il servizio dichiara due nomi di database: `POSTGRES_DB: coaching_planner` per lo sviluppo e `POSTGRES_E2E_DB: coaching_planner_e2e` per gli E2E. La cartella `docker/postgres/initdb/` è montata in sola lettura su `/docker-entrypoint-initdb.d`: alla **prima** inizializzazione del volume `pgdata`, lo script `01-crea-database-e2e.sh` crea il database E2E accanto a quello di sviluppo. Su un volume già inizializzato gli script non vengono rieseguiti; in quel caso il database E2E mancante viene creato dalla suite stessa al primo `npm run test:e2e`. Il workflow CI usa PostgreSQL 16. Non è osservato un workspace o un secondo package.

## Comandi canonici

| Scopo | Comando |
|---|---|
| Sviluppo | `npm run dev` |
| Build produzione | `npm run build` |
| Avvio build | `npm run start` |
| Lint e guardrail E2E | `npm run lint` |
| Unit test | `npm test` |
| E2E | `npm run test:e2e` |
| Generare Prisma | `npm run db:generate` |
| Validare schema | `npm run db:validate` |
| Migrazione sviluppo | `npm run db:migrate` |
| Migrazione deploy | `npm run db:migrate:deploy` |
| Seed | `npm run db:seed` |
| Bootstrap amministratore iniziale | `npm run db:bootstrap-amministratore` |
| Backfill abilitazioni offerte iniziale | `npm run db:backfill-abilitazioni` |
| Database locale | `docker compose up -d` |

`dev`, `build` e `postinstall` generano il client Prisma.

## Configurazione runtime

- `DATABASE_URL`: connessione applicativa PostgreSQL.
- `E2E_DATABASE_URL`: database E2E dedicato, obbligatorio per Playwright. Non deve essere né vuoto né preesistente: la suite lo crea se manca e ne ricrea lo schema a ogni run. Deve però puntare a un database **diverso** da `DATABASE_URL` (confronto su host, porta e nome, con gli alias locali equivalenti a `localhost`); se i due coincidono la suite rifiuta di partire.
- `SESSION_SECRET`: obbligatorio, almeno 32 caratteri, non placeholder; validato da `next.config.ts` e `src/instrumentation.ts`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`: integrazione Google.
- `NEXT_PUBLIC_APP_URL`: base per redirect.
- `E2E_TEST_MODE`: abilita il seam `/api/e2e-test/sessione` soltanto negli E2E.
- `AMMINISTRATORE_INIZIALE_EMAIL`: email garantita come `Utente AMMINISTRATORE` da `scripts/bootstrap-amministratore-iniziale.ts`, eseguito nella stessa fase di `prisma migrate deploy` (vedi [guida di deploy](/operations/deploy-vercel-siteground.md)).
- `scripts/backfill-abilitazioni-iniziali.ts` popola una tantum `AbilitazioneOfferta` dalle righe attività storiche su offerte attive; a differenza del bootstrap amministratore non è agganciato al build command e va eseguito manualmente una sola volta per ambiente subito dopo `db:migrate:deploy` (vedi [guida di deploy](/operations/deploy-vercel-siteground.md) e la decisione [Abilitazioni esplicite collaboratore-offerta](/decisions/abilitazioni-offerte-esplicite.md)); è invece già agganciato in coda a `prisma/seed.ts`.

Il file autorizzato di esempio è `.env.example`; i segreti reali non fanno parte della Wiki. I cookie sono Secure solo in produzione.

## Database e migrazioni

Prisma genera il client in `src/generated/prisma`. Lo schema corrente definisce identità/account, profili, clienti, offerte, voci di rimborso trasferta, righe attività e abilitazioni collaboratore-offerta. Le migrazioni creano lo schema iniziale, aggiungono campi fiscali cliente e rendevano unica `ScaglioneKm.finoAKm` — modello poi rimosso dalla migrazione `20260731142725_voci_rimborso_trasferta_libere`, che sostituisce `ScaglioneKm` con `VoceRimborsoTrasferta` e il campo `RigaAttivita.trasfertaKm` con i campi fotografati `rimborsoTrasfertaEtichetta`/`rimborsoTrasfertaImporto`. Il seed cancella e ricrea dati dimostrativi; non va eseguito contro un database da preservare.

## Test

Vitest esegue `tests/unit/**/*.test.ts` in ambiente Node e sostituisce `server-only` con un mock. Playwright mantiene `fullyParallel: true`, Chromium, setup/teardown globali, trace al primo retry e un web server dedicato.

La preparazione del database E2E si svolge in questa sequenza:

1. **Guardia d'identità**, valutata già in `playwright.config.ts` — cioè prima del `globalSetup` e prima dell'avvio del web server, così che il rifiuto avvenga senza che alcun processo abbia toccato dati. È un confronto puramente sintattico fra `E2E_DATABASE_URL` e `DATABASE_URL` e non apre connessioni.
2. **Creazione se assente**: quando PostgreSQL risponde `3D000` (`invalid_catalog_name`), il database E2E viene creato collegandosi al database di manutenzione della stessa istanza.
3. **Ripristino dello stato pulito**: `DROP SCHEMA IF EXISTS public CASCADE` seguito da `CREATE SCHEMA public`. Ricreare lo schema, invece di svuotare le tabelle, sana anche uno stato di migrazione incompleto lasciato da un run interrotto.
4. **Migrazioni** con `npm run db:migrate:deploy` e **seed** con `npm run db:seed`, entrambi eseguiti con `DATABASE_URL` sovrascritto sul database E2E.
5. **Pulizia finale** al `globalTeardown`, che tronca le tabelle applicative.

Tutta questa logica ha un punto unico in `tests/e2e/e2e-database-safety.ts`; la motivazione del reset distruttivo subordinato alla guardia è registrata nella decisione [Reset del database E2E dedicato](/decisions/reset-database-e2e-dedicato.md).

I test mutanti devono usare factory, mesi e risorse riservate; `npm run lint` include `scripts/check-e2e-guardrails.ts`, che rifiuta hard wait, selezioni per indice e altri pattern fragili.

## CI

Su push e pull request verso `main`, `.github/workflows/ci.yml` esegue: `npm ci`, migrazione e seed del database CI, installazione Chromium, creazione database E2E, lint, unit test, build ed E2E. Il workflow continua a creare da sé `coaching_planner_e2e`: il passo resta invariato e non è stato sostituito dalla preparazione della suite. Le due cose convivono perché la preparazione della suite è idempotente rispetto a quel passo — trova il database già esistente, non lo ricrea, e ne ricrea solo lo schema. Il job ha timeout di 15 minuti. La pipeline usa `npm run start` come server Playwright dopo la build.

## Deployment e osservabilità

Non è presente una pipeline di deploy. SiteGround compare in uno script diagnostico e in documentazione di spike, ma non prova un target di produzione attivo. `scripts/siteground-connectivity-check.ts` importa `dotenv/config` senza una dipendenza diretta `dotenv` nel manifest: la sua eseguibilità dipende attualmente dalla risoluzione transitiva. Errori OAuth sono registrati su console e restituiti all'utente come redirect generico; non è osservata una piattaforma di telemetria.

## Vincoli e cautele

- Non usare il database applicativo per gli E2E. Il vincolo non è più solo una convenzione: è imposto dal codice, che rifiuta l'esecuzione con un errore esplicito prima di qualunque scrittura. Il messaggio segnala che il database «coincide con il database di sviluppo» e suggerisce di configurarne uno dedicato, per esempio `coaching_planner_e2e`.
- Un'istanza PostgreSQL locale spenta produce un fallimento immediato e azionabile («Il database locale non risponde su host:porta»), con l'indicazione di avviarla con `docker compose up -d`, invece di un errore di connessione grezzo.
- Non serializzare l'intera suite Playwright per risolvere flakiness.
- Non leggere o versionare file `.env` reali.
- Sessione e build falliscono rapidamente con `SESSION_SECRET` non valida.
- Il commento interno dell'endpoint E2E cita un vecchio path `/api/__test/sessione`; il path eseguibile è `/api/e2e-test/sessione`.

## Concetti correlati

Le operazioni supportano la [panoramica](/overview.md), la [mappa del codice](/engineering/code-map.md) e il dominio [Identità e accesso](/domains/identita-accesso.md).
