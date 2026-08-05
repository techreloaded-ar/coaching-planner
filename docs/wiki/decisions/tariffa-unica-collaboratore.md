---
type: decision
title: Tariffa unica per collaboratore
description: Mantenere una sola tariffa giornaliera per ogni collaboratore nel MVP
status: reviewed
decision_status: accepted
sources:
    - path: docs/PRD.md
      role: decision-source
    - path: prisma/schema.prisma
      role: implementation
      symbol: Collaboratore.tariffaGiornaliera
    - path: src/lib/attivita.ts
      role: implementation
      symbol: riepilogoMese
    - path: src/domain/consuntivi/index.ts
      role: implementation
      symbol: calcolaRiepilogoMese
    - path: tests/unit/riepilogo-mese.test.ts
      role: verification
review:
    content_hash: sha256:a6b5ee38c45859ea9be515dbab7f8dac4d31b0290c605e91aa87db485fe69de3
    evidence_revision: 8c555e4e212062e4ae73e66ea4b1b049cd082901
    evidence_hash: sha256:0f29620edea1bda892c515fadbac061787f49aa50c246597f9a89735e0605958
    reviewed_at: "2026-08-05T07:29:49Z"
---
# Tariffa unica per collaboratore

<!-- archetipo:wiki section=context -->
## Contesto

Il riepilogo personale deve stimare la fattura del collaboratore. Il PRD, ADR-003, registra che il committente ha confermato una tariffa unica per collaboratore per l'MVP.

<!-- archetipo:wiki section=decision -->
## Decisione

Memorizzare una sola `tariffaGiornaliera` sul profilo Collaboratore e usarla per tutte le sue ore fatturabili.

<!-- archetipo:wiki section=alternatives -->
## Alternative

Consentire override della tariffa per cliente o offerta. Il PRD la rimanda alla crescita perché il bisogno non era emerso e avrebbe ampliato modello e configurazione.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Il calcolo della fattura personale è uniforme e la gestione anagrafica è semplice. Non è possibile rappresentare accordi diversi per singolo incarico; un'evoluzione dovrà stabilire precedenza e storicizzazione degli override.

<!-- archetipo:wiki section=verification -->
## Verifica

`Collaboratore` possiede un solo campo `tariffaGiornaliera`. `riepilogoMese` passa quella tariffa a `calcolaRiepilogoMese`; non esiste una tariffa collaboratore per offerta. I test coprono il calcolo. La tariffa dell'offerta esiste separatamente per la fatturazione cliente e non contraddice questa decisione.

## Concetti correlati

La decisione deriva dal [PRD originale](/references/prd.md) e influenza [Collaboratori](/domains/collaboratori.md) e [Attività](/domains/attivita.md).
