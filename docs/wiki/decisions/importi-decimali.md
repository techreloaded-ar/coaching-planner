---
type: decision
title: Importi monetari decimali
description: Persistire gli importi monetari come Decimal per evitare errori contabili
status: reviewed
decision_status: accepted
sources:
    - path: docs/PRD.md
      role: decision-source
    - path: prisma/schema.prisma
      role: implementation
    - path: src/domain/anagrafiche/valida-offerta.ts
      role: implementation
    - path: src/domain/consuntivi/index.ts
      role: implementation-status
    - path: tests/unit/report-fatturazione-clienti.test.ts
      role: verification
review:
    content_hash: sha256:ba7516fcff1874e0ec3801f504ae59afdf44a78308b01de23de3b16dba765b32
    evidence_revision: 3dc77a95eced5c2786ed7caf027913af75352ed4
    evidence_hash: sha256:e8813c34a5238db331b90ff9c825d272428b9655b1565a319727131e7ef7dad0
    reviewed_at: "2026-07-29T06:10:15Z"
---
# Importi monetari decimali

<!-- archetipo:wiki section=context -->
## Contesto

Tariffe, rimborsi e totali richiedono precisione contabile. Il PRD, ADR-005, dichiara l'obiettivo di usare Decimal in database e applicazione invece di floating point.

<!-- archetipo:wiki section=decision -->
## Decisione

Rappresentare e persistere gli importi monetari con precisione decimale e normalizzare gli input a due cifre decimali.

<!-- archetipo:wiki section=alternatives -->
## Alternative

Usare `number`/floating point direttamente oppure memorizzare centesimi interi. Il PRD scarta il float per il rischio di arrotondamento; non seleziona il modello a centesimi.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Il database conserva tariffe e importi con scala due. I confini client devono serializzare i valori. L'obiettivo richiede disciplina anche nei calcoli intermedi; convertire a `number` riduce la garanzia end-to-end dichiarata.

<!-- archetipo:wiki section=verification -->
## Verifica

Prisma usa `Decimal(10,2)` per tariffa collaboratore, tariffa offerta e importo scaglione; i validatori normalizzano stringhe decimali. Tuttavia `src/domain/consuntivi/index.ts` converte vari importi in `number`/`parseFloat` per somme e moltiplicazioni prima di formattare a due decimali. La decisione è adottata nello storage ma non integralmente nella catena applicativa; i test verificano gli output correnti, non precisione arbitraria.

## Concetti correlati

La decisione deriva dal [PRD originale](/references/prd.md) e influenza [Collaboratori](/domains/collaboratori.md), [Offerte](/domains/offerte.md), [Politiche di rimborso](/domains/politiche-rimborso.md) e [Fatturazione clienti](/domains/fatturazione-clienti.md).
