---
type: decision
title: Unica applicazione con aree a ruolo
description: Servire front office e back office da un’unica applicazione con ruoli distinti
decision_status: accepted
status: generated
sources:
- path: docs/PRD.md
  role: decision-source
- path: src/app/(front-office)/layout.tsx
  role: implementation
- path: src/app/(back-office)/layout.tsx
  role: implementation
- path: src/lib/policy-rotte.ts
  role: implementation
- path: tests/e2e/autorizzazione-ruoli.spec.ts
  role: verification
---
# Unica applicazione con aree a ruolo

<!-- archetipo:wiki section=context -->
## Contesto

Il PRD, ADR-001, attribuisce al committente il bisogno percepito di due aree ma registra la scelta di evitare due applicazioni e due deploy, mantenendo una sola base dati.

<!-- archetipo:wiki section=decision -->
## Decisione

Usare un'unica applicazione Next.js con area front office e back office separate tramite route group e autorizzazione per ruolo.

<!-- archetipo:wiki section=alternatives -->
## Alternative

Due applicazioni web separate con deploy e boundary distinti. Il PRD la scarta perché duplicherebbe infrastruttura e renderebbe meno semplice condividere dati ed esperienza.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Un solo processo, repository e database semplificano sviluppo e deploy. In cambio, le capability non sono isolate a runtime e proxy/DAL devono applicare correttamente le policy su ogni percorso e operazione.

<!-- archetipo:wiki section=verification -->
## Verifica

`src/app/(front-office)` e `src/app/(back-office)` convivono nello stesso App Router. `src/lib/policy-rotte.ts` classifica il back office come amministrativo e `/attivita` come area autenticata; gli E2E verificano redirect e segregazione dei ruoli. La decisione è adottata nel codice corrente.

## Concetti correlati

La decisione deriva dal [PRD originale](/references/prd.md) e influenza [mappa dei contesti](/architecture/context-map.md) e [Identità e accesso](/domains/identita-accesso.md).
