---
id: decisions.postgres-siteground
type: decision
decision_status: accepted
summary: Usare PostgreSQL con target dichiarato SiteGround e sviluppo locale equivalente
status: generated
links:
  - id: operations.development
    relation: affects
sources:
  - path: "docs/wiki/sources/prd.md"
    role: decision-source
  - path: "prisma/schema.prisma"
    role: implementation
  - path: "docker-compose.yml"
    role: implementation
  - path: "scripts/siteground-connectivity-check.ts"
    role: verification-tool
  - path: "docs/siteground-postgres-connectivity-spike.md"
    role: verification-record
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
