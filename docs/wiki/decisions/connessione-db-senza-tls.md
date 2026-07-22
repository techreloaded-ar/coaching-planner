---
type: decision
title: Connessione al database senza TLS (rischio accettato)
description: Accettazione consapevole del rischio di connessione in chiaro tra Vercel e il PostgreSQL SiteGround, in attesa del supporto TLS del provider
status: reviewed
decision_status: accepted
sources:
    - path: docs/siteground-postgres-connectivity-spike.md
      role: verification-record
    - path: scripts/siteground-connectivity-check.ts
      role: verification-tool
    - path: docs/wiki/operations/deploy-vercel-siteground.md
      role: operational-guide
review:
    content_hash: sha256:1081c97e341df8d699f7d55d05507086680dc422f582794e6d96f65e92dbac03
    evidence_revision: 19b1bddd8d9e7f9dfce3aeedcb035802dc877dd7
    reviewed_at: "2026-07-22T09:22:27Z"
---
# Connessione al database senza TLS (rischio accettato)

<!-- archetipo:wiki section=context -->
## Contesto

Lo spike di connettività (US-004, giugno 2026) ha rilevato che il PostgreSQL SiteGround rifiuta le connessioni SSL/TLS (`The server does not support SSL connections`), mentre la connessione in chiaro funziona. Il tratto Vercel → SiteGround attraversa Internet pubblico e non è coperto dall'HTTPS applicativo, che protegge solo il tratto browser → Vercel. I dati applicativi (anagrafiche, tariffe, partite IVA) transiterebbero quindi non cifrati a ogni query.

<!-- archetipo:wiki section=decision -->
## Decisione

Il committente accetta consapevolmente il rischio (decisione del 2026-07-21) e procede al deploy di staging e produzione con `sslmode=disable` nelle stringhe di connessione, senza attendere l'abilitazione del TLS da parte di SiteGround.

<!-- archetipo:wiki section=alternatives -->
## Alternative

Attendere l'attivazione del TLS da parte del supporto SiteGround (tempi incerti, bloccante per il rilascio). Migrare a un provider PostgreSQL con TLS nativo (Neon, Supabase, Railway), scartato perché SiteGround è un vincolo del committente già pagato. Interporre un tunnel SSH o un proxy TLS, scartato per la complessità operativa aggiuntiva su un'infrastruttura serverless.

<!-- archetipo:wiki section=consequences -->
## Consequenze

La probabilità di intercettazione è bassa (richiede una posizione privilegiata sulla rete di transito), ma l'esposizione è permanente e riguarda ogni query. In ottica GDPR (art. 32) la cifratura in transito è una misura attesa per dati personali: in caso di data breach questa scelta andrebbe motivata. La password del database non transita in chiaro (SCRAM-SHA-256), ma i dati applicativi sì. Resta aperto il follow-up di richiedere a SiteGround l'abilitazione del TLS e, appena disponibile, passare a `sslmode=require` aggiornando le variabili d'ambiente su Vercel.

<!-- archetipo:wiki section=verification -->
## Verifica

Lo spike di connettività (`docs/siteground-postgres-connectivity-spike.md`) ha verificato che il PostgreSQL SiteGround rifiuta SSL/TLS e accetta solo connessioni in chiaro. Lo script `scripts/siteground-connectivity-check.ts` (referenziato anche nella guida di deploy) verifica a runtime la raggiungibilità con `sslmode=disable` prima di ogni deploy. Le stringhe di connessione su Vercel (Production/Preview) usano `sslmode=disable` come da guida di deploy.

## Concetti correlati

La decisione discende dal vincolo [PostgreSQL con target SiteGround](/decisions/postgres-siteground.md) e si applica alla [guida di deploy Vercel + SiteGround](/operations/deploy-vercel-siteground.md).
