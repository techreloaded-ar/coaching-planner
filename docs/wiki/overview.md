---
id: overview
type: overview
summary: Scopo, attori, stack e perimetro della mappa codebase-first di Coaching Planner
status: reviewed
links:
    - id: architecture.context-map
      relation: introduces
    - id: engineering.code-map
      relation: maps-code
    - id: operations.development
      relation: describes-operations
sources:
    - path: prisma/schema.prisma
      role: runtime-model
    - path: src/app/page.tsx
      role: public-entry-point
    - path: src/lib/dal.ts
      role: actor-and-access-policy
    - path: src/lib/actions/righe-attivita.ts
      role: primary-use-case
    - path: src/lib/report.ts
      role: administrative-use-cases
    - path: package.json
      role: stack-manifest
review:
    content_hash: sha256:f0ba1b122cf795e72468ee0c58906ebd9a7ba0c37c865bec508cb49f406f73c9
    evidence_revision: d5a7bbe7cd96e946dce2920672fc29c1779b4e9b
    reviewed_at: "2026-07-16T17:30:56Z"
---
# Panoramica

## Sistema

Coaching Planner è un gestionale web che consente ai collaboratori di registrare attività giornaliere su clienti e offerte e agli amministratori di governare dati di riferimento, offerte, profili e report. Dal codice sono osservati calendario e dettaglio giornaliero, riepilogo mensile personale, rimborsi trasferta, avanzamento delle offerte e proiezione degli importi da fatturare ai clienti.

## Attori osservati

- **Collaboratore**: usa un profilo operativo per vedere e modificare soltanto le proprie righe attività e il proprio riepilogo.
- **Amministratore**: gestisce clienti, collaboratori, offerte e scaglioni; legge report e può usare l'area attività se possiede un profilo collaboratore attivo.
- **Google**: provider OAuth/OIDC esterno per l'autenticazione; l'applicazione ammette soltanto email verificate già censite.

I ruoli `AMMINISTRATORE` e `COLLABORATORE` sono dichiarati in Prisma e verificati da proxy e DAL. Il codice non mostra self-registration né una transizione di ruolo.

## Stack osservato

Next.js 16.2.9 App Router e React 19 con TypeScript strict; PostgreSQL con Prisma 7 e adapter `pg`; OAuth Google tramite `arctic`; JWT HS256 tramite `jose`; Tailwind CSS 4; Vitest per unit test e Playwright Chromium per E2E. Il repository è un'unica applicazione, senza workspace.

## Modello della mappa

La mappa distingue sette capability candidate:

1. Clienti.
2. Collaboratori.
3. Offerte.
4. Politiche di rimborso trasferta.
5. Attività e consuntivazione.
6. Fatturazione clienti come proiezione amministrativa.
7. Identità, sessioni e accesso.

`anagrafiche` è una macro-area UI che attraversa quattro capability; `report` contiene una proiezione di fatturazione e una proiezione di avanzamento appartenente semanticamente a Offerte. `calendario` è un supporting module di Attività. Tutte le classificazioni restano `candidate`: il bootstrap non promuove bounded context.

## Evidenza e limiti

La revisione `f24f9fc866b6c8defde750b7b93b7040da734c96` è stata inventariata con `archetipo wiki inspect`. Sono stati letti manifest, configurazioni, schema e migrazioni, entry point e file riportati per ogni candidato, seguendo dipendenze e test pertinenti. L'inspector ha escluso metadata Git, dipendenze/build e questa Wiki; ha dichiarato campionamento rappresentativo per `docs`, `src` e `tests`. I file generati Prisma e gli asset binari non sono usati come fonte semantica primaria.

## Comportamento e intento

Questa pagina descrive il comportamento osservato nell'eseguibile. Mockup, PRD e README sono fonti d'intento separate. In particolare, il README cita Auth.js, mentre il flusso runtime osservato usa `arctic`, `jose`, route Google personalizzate e un cookie JWT; `src/lib/auth.ts` è un placeholder. Non è stata inferita alcuna decisione architetturale o rationale dalla sola forma del codice.
