---
type: decision
title: PostgreSQL con target SiteGround
description: Usare PostgreSQL con target dichiarato SiteGround e sviluppo locale equivalente
status: reviewed
decision_status: accepted
sources:
    - path: docs/PRD.md
      role: decision-source
    - path: prisma/schema.prisma
      role: implementation
    - path: docker-compose.yml
      role: implementation
    - path: scripts/siteground-connectivity-check.ts
      role: verification-tool
    - path: docs/siteground-postgres-connectivity-spike.md
      role: verification-record
review:
    content_hash: sha256:fc728a3031b08293b9e8ef7a26d08a3b98fa69bdf126061e169fce902be2fadd
    evidence_revision: 3dc77a95eced5c2786ed7caf027913af75352ed4
    evidence_hash: sha256:44d50f650cb4058c7216b55ba2a5234e49513b057251360dbb597c6590b4c6a6
    reviewed_at: "2026-07-29T06:10:15Z"
---
# PostgreSQL con target SiteGround

<!-- archetipo:wiki section=context -->
## Contesto

Il PRD, ADR-004, attribuisce al committente il vincolo di PostgreSQL su SiteGround e richiede sviluppo locale indipendente più verifica anticipata di connettività remota e TLS.

<!-- archetipo:wiki section=decision -->
## Decisione

Usare PostgreSQL come database relazionale, un'istanza locale equivalente per sviluppo e SiteGround come target dichiarato da validare.

<!-- archetipo:wiki section=alternatives -->
## Alternative

Usare un database differente o un PostgreSQL gestito insieme alla piattaforma applicativa. Il PRD non seleziona queste alternative perché SiteGround è un vincolo del committente.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Prisma e l'applicazione dipendono da PostgreSQL, mentre sviluppo ed E2E usano database separati. Il deploy richiede rete, credenziali e TLS compatibili con il provider. La decisione sul target introduce un rischio operativo finché non esiste automazione di deploy osservabile.

<!-- archetipo:wiki section=verification -->
## Verifica

Schema Prisma, migrazioni, Docker Compose e CI adottano PostgreSQL. Esistono uno spike documentato e uno script di connettività SiteGround, ma non una pipeline di deploy o evidenza runtime di produzione. Quindi l'adozione di PostgreSQL è provata; il target SiteGround resta intento esplicito con verifica operativa parziale.

## Concetti correlati

La decisione deriva dal [PRD originale](/references/prd.md) e influenza [operazioni di sviluppo](/operations/development.md).
