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
    evidence_revision: 684073cbe95870736f7b37fbbe2fcccb01a7dd38
    evidence_hash: sha256:bf129c9dec5741cab6a9f22e273d3960666fea88c5a630503d8a7b50e650bcbd
    reviewed_at: "2026-07-31T15:56:35Z"
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
