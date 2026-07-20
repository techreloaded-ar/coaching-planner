---
type: domain
title: Identità, sessioni e accesso
description: Accesso Google, sessione JWT, ruoli, policy di rotta e segregazione dei dati
classification: candidate
status: generated
sources:
- path: src/app/api/auth/google/route.ts
  role: inbound-api
  symbol: GET
- path: src/app/api/auth/google/callback/route.ts
  role: inbound-api
  symbol: GET
- path: src/lib/session-token.ts
  role: session-domain
- path: src/proxy.ts
  role: access-policy-adapter
  symbol: proxy
- path: src/lib/dal.ts
  role: authorization
- path: prisma/schema.prisma
  role: identity-data
  symbol: Utente, Account, Ruolo
- path: tests/unit/dal-guards.test.ts
  role: verification
- path: tests/e2e/autorizzazione-ruoli.spec.ts
  role: verification
---
# Identità, sessioni e accesso

<!-- archetipo:wiki section=purpose -->
## Scopo

Autentica tramite Google persone già censite, emette una sessione stateless, protegge le rotte in base a sessione e ruolo e riconcilia l'identità con il database prima delle operazioni applicative.

<!-- archetipo:wiki section=language -->
## Linguaggio

Utente censito, account Google, email verificata, state, PKCE code verifier, sessione, cookie `cp_sessione`, token JWT, rinnovo sliding, ruolo `AMMINISTRATORE` o `COLLABORATORE`, profilo operativo, 401, 403 e segregazione.

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede integrazione Google, `Account`, token/cookie, validità della sessione, policy di rotta e guardie. Consulta `Utente` e `Collaboratore.attivo`; la transizione del profilo operativo appartiene a Collaboratori. `Utente` è oggi storage condiviso perché viene anche creato e aggiornato dalle action collaboratori.

<!-- archetipo:wiki section=contracts -->
## Contratti

`GET /api/auth/google` avvia OAuth; il callback accetta `code`, `state` e cookie temporanei. Il JWT contiene `utenteId`, ruolo, nome, email ed `expiresAt`. Il proxy classifica root, OAuth, seam E2E e rotte protette. Il DAL espone guardie con redirect per RSC e `ErroreAutorizzazione(401|403)` per API/action.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. L'avvio genera `state` e code verifier e li scrive in cookie HttpOnly per 10 minuti.
2. Il callback verifica cookie, query, state, scambio Google, email verificata e presenza dell'utente; rifiuta un collaboratore censito con profilo esplicitamente disattivato.
3. `src/app/api/auth/google/callback/route.ts` esegue `db.account.upsert`: il ramo create assegna `userId`, provider, subject e access token; il ramo update assegna soltanto l'access token. `createSession` in `src/lib/session.ts` scrive poi il cookie JWT e il callback reindirizza a `/attivita`.
4. `verificaERinnovaTokenSessione` in `src/lib/session-token.ts` assegna nel nuovo token `expiresAt = now + 8h`; `src/proxy.ts` riscrive il cookie sulle richieste previste. Non esiste una write alla tabella Prisma `Session` nel flusso osservato.
5. Logout e pulizia token in `src/lib/session.ts` impostano il cookie vuoto con `maxAge: 0`.
6. Il proxy usa il ruolo firmato per la prima decisione; il DAL rilegge `Utente` e stato profilo dal database prima dei dati protetti.
7. Non è osservata alcuna write di cambio ruolo. `creaCollaboratore` assegna `COLLABORATORE` soltanto quando crea un nuovo utente; un amministratore riusato mantiene il suo ruolo.

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| OAuth | `src/app/api/auth/google/**`, `src/lib/google-oauth.ts` |
| Sessione | `src/lib/session-config.ts`, `src/lib/session-token.ts`, `src/lib/session.ts` |
| Policy anticipata | `src/proxy.ts`, `src/lib/policy-rotte.ts` |
| Identità autorevole e guardie | `src/lib/dal.ts` |
| Fail-fast | `src/instrumentation.ts`, `next.config.ts` |
| Dati | `prisma/schema.prisma` (`Utente`, `Account`; `Session` e `VerificationToken` dichiarati ma non usati dal flusso corrente) |
| Test | test unit `session*`, `proxy`, `policy-rotte`, `dal-guards`; E2E auth, ruoli, root e sessione proxy |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

JWT firmato HS256, payload validato, `exp === expiresAt`, durata sliding 8 ore. `SESSION_SECRET` deve avere almeno 32 caratteri e non essere il placeholder. Cookie HttpOnly, SameSite=Lax, Secure in produzione. Google non autocrea utenti: richiede email verificata e già censita. `Utente.email`, account provider e profilo utente sono unici a database. Il callback risolve l'utente per email verificata ma l'upsert per subject Google, quando trova un `Account` esistente, aggiorna soltanto l'access token e non verifica che `Account.userId` coincida con l'utente risolto: il binding fra subject ed email non è quindi imposto esplicitamente dall'applicazione. Il proxy non consulta il database: revoca del profilo e cambiamenti al ruolo diventano autorevoli quando il consumer invoca il DAL. L'endpoint `/api/e2e-test/sessione` è escluso dalle guardie proxy ma risponde 403 salvo `E2E_TEST_MODE=true`. `src/lib/auth.ts` è un placeholder; Auth.js non è una dipendenza runtime osservata.

<!-- archetipo:wiki section=verification -->
## Verifica

Test unitari coprono secret, token, rinnovo, proxy, policy e guardie DAL; E2E coprono ruoli, root, logout e revoca integrata. Le route Google reali non hanno test unitari diretti: `auth-helpers.test.ts` replica parte delle decisioni e gli E2E usano un seam. Confidenza alta su sessione e autorizzazione, media sul callback reale. La classificazione resta candidata fino a revisione dell'ownership condivisa di `Utente`.

## Concetti correlati

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Collaboratori](/domains/collaboratori.md) e [operazioni di sviluppo](/operations/development.md).
