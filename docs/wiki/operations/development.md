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
- path: .github/workflows/ci.yml
  role: automation
- path: playwright.config.ts
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

CI usa Node.js 22. Il progetto usa npm, PostgreSQL e Prisma; Docker Compose fornisce PostgreSQL 17 Alpine in locale con volume persistente. Il workflow CI usa PostgreSQL 16. Non è osservato un workspace o un secondo package.

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
| Database locale | `docker compose up -d` |

`dev`, `build` e `postinstall` generano il client Prisma.

## Configurazione runtime

- `DATABASE_URL`: connessione applicativa PostgreSQL.
- `E2E_DATABASE_URL`: database E2E dedicato, obbligatorio per Playwright.
- `SESSION_SECRET`: obbligatorio, almeno 32 caratteri, non placeholder; validato da `next.config.ts` e `src/instrumentation.ts`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`: integrazione Google.
- `NEXT_PUBLIC_APP_URL`: base per redirect.
- `E2E_TEST_MODE`: abilita il seam `/api/e2e-test/sessione` soltanto negli E2E.
- `AMMINISTRATORE_INIZIALE_EMAIL`: email garantita come `Utente AMMINISTRATORE` da `scripts/bootstrap-amministratore-iniziale.ts`, eseguito nella stessa fase di `prisma migrate deploy` (vedi [guida di deploy](/operations/deploy-vercel-siteground.md)).

Il file autorizzato di esempio è `.env.example`; i segreti reali non fanno parte della Wiki. I cookie sono Secure solo in produzione.

## Database e migrazioni

Prisma genera il client in `src/generated/prisma`. Lo schema corrente definisce identità/account, profili, clienti, offerte, scaglioni e righe attività. Le migrazioni creano lo schema iniziale, aggiungono campi fiscali cliente e rendono unica `ScaglioneKm.finoAKm`. Il seed cancella e ricrea dati dimostrativi; non va eseguito contro un database da preservare.

## Test

Vitest esegue `tests/unit/**/*.test.ts` in ambiente Node e sostituisce `server-only` con un mock. Playwright mantiene `fullyParallel: true`, Chromium, setup/teardown globali, trace al primo retry e un web server dedicato. Il database E2E viene migrato, popolato e ripulito. I test mutanti devono usare factory, mesi e risorse riservate; `npm run lint` include `scripts/check-e2e-guardrails.ts`, che rifiuta hard wait, selezioni per indice e altri pattern fragili.

## CI

Su push e pull request verso `main`, `.github/workflows/ci.yml` esegue: `npm ci`, migrazione e seed del database CI, installazione Chromium, creazione database E2E, lint, unit test, build ed E2E. Il job ha timeout di 15 minuti. La pipeline usa `npm run start` come server Playwright dopo la build.

## Deployment e osservabilità

Non è presente una pipeline di deploy. SiteGround compare in uno script diagnostico e in documentazione di spike, ma non prova un target di produzione attivo. `scripts/siteground-connectivity-check.ts` importa `dotenv/config` senza una dipendenza diretta `dotenv` nel manifest: la sua eseguibilità dipende attualmente dalla risoluzione transitiva. Errori OAuth sono registrati su console e restituiti all'utente come redirect generico; non è osservata una piattaforma di telemetria.

## Vincoli e cautele

- Non usare il database applicativo per gli E2E.
- Non serializzare l'intera suite Playwright per risolvere flakiness.
- Non leggere o versionare file `.env` reali.
- Sessione e build falliscono rapidamente con `SESSION_SECRET` non valida.
- Il commento interno dell'endpoint E2E cita un vecchio path `/api/__test/sessione`; il path eseguibile è `/api/e2e-test/sessione`.

## Concetti correlati

Le operazioni supportano la [panoramica](/overview.md), la [mappa del codice](/engineering/code-map.md) e il dominio [Identità e accesso](/domains/identita-accesso.md).
