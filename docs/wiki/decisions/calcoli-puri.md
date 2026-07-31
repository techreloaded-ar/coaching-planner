---
type: decision
title: Calcoli di dominio in funzioni pure
description: Isolare validazioni e calcoli di consuntivazione in funzioni pure testabili
status: reviewed
decision_status: accepted
sources:
    - path: docs/PRD.md
      role: decision-source
    - path: src/domain/consuntivi/index.ts
      role: implementation
    - path: src/domain/calendario/index.ts
      role: implementation
    - path: src/domain/anagrafiche/valida-cliente.ts
      role: implementation
    - path: tests/unit/riepilogo-mese.test.ts
      role: verification
    - path: tests/unit/avanzamento-offerte.test.ts
      role: verification
review:
    content_hash: sha256:4d9a909dc2f03a0d5d51d3e302423fb4e31f61e263d4342a66c2455a1f8bd71a
    evidence_revision: 684073cbe95870736f7b37fbbe2fcccb01a7dd38
    evidence_hash: sha256:7379b77972cdfb4cacf145f9cafbe5cd284079313e31f6ed0f04757f854ea22d
    reviewed_at: "2026-07-31T15:56:35Z"
---
# Calcoli di dominio in funzioni pure

<!-- archetipo:wiki section=context -->
## Contesto

Conversioni, rimborsi, riepiloghi e avanzamento devono essere verificabili senza framework o database. Il PRD, ADR-006, registra questa scelta per ridurre accoppiamento e rendere i calcoli testabili.

<!-- archetipo:wiki section=decision -->
## Decisione

Collocare validazioni e calcoli deterministici in moduli TypeScript puri, passando input serializzabili e lasciando query, sessione e persistenza agli adapter applicativi.

<!-- archetipo:wiki section=alternatives -->
## Alternative

Implementare i calcoli direttamente nelle pagine, Server Action o query Prisma. Il PRD la scarta perché aumenterebbe duplicazione e renderebbe più difficile il test in isolamento.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Le stesse regole possono essere riusate da UI, report e lista offerte e sono coperte da unit test veloci. Il modulo fisico `consuntivi` raccoglie però regole di più capability e richiede attenzione per non confondere riuso tecnico con un unico confine di dominio.

<!-- archetipo:wiki section=verification -->
## Verifica

`src/domain/consuntivi/index.ts` non importa Next o Prisma e implementa validazione, rimborsi, riepilogo, fatturazione e avanzamento. Calendario e validatori anagrafici sono anch'essi puri. Le suite unitarie importano direttamente queste funzioni. La decisione è adottata, mentre orchestrazione e scritture restano correttamente nei moduli `lib` e nelle Server Action.

## Concetti correlati

La decisione deriva dal [PRD originale](/references/prd.md) e influenza [Attività](/domains/attivita.md), [Offerte](/domains/offerte.md), [Fatturazione clienti](/domains/fatturazione-clienti.md) e la [mappa del codice](/engineering/code-map.md).
