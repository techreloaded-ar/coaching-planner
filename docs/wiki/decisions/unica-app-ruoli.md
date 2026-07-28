---
type: decision
title: Unica applicazione con aree a ruolo
description: Servire front office e back office da un’unica applicazione con ruoli distinti
status: reviewed
decision_status: accepted
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
review:
    content_hash: sha256:9047dcf13653556982dd0e9e75f4806ceb235cf5fd60f185184d907bb0f268a1
    evidence_revision: 8ebeb2c8bb63227feb4d26fece4766baa9b086de
    evidence_hash: sha256:8e6a5409a9b28f500e36fe42729b898e1cbcf4c5e50eeb7aadb5e91811b5704c
    reviewed_at: "2026-07-28T10:51:15Z"
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
