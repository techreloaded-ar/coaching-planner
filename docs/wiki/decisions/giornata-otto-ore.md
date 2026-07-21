---
type: decision
title: Giornata equivalente a otto ore
description: Convertire ore e giornate con la costante fissa di otto ore per giornata
status: reviewed
decision_status: accepted
sources:
    - path: docs/PRD.md
      role: decision-source
    - path: src/domain/types.ts
      role: implementation
      symbol: ORE_PER_GIORNATA
    - path: src/domain/consuntivi/index.ts
      role: implementation
    - path: tests/unit/riepilogo-mese.test.ts
      role: verification
    - path: tests/unit/avanzamento-offerte.test.ts
      role: verification
review:
    content_hash: sha256:af115e4647d4ca91950930b6f8744e1b292b8fc5831625568b90b0c84ff54be9
    evidence_revision: 748954aeba137b973f082bfa1d04963eaf46083c
    reviewed_at: "2026-07-21T07:43:18Z"
---
# Giornata equivalente a otto ore

<!-- archetipo:wiki section=context -->
## Contesto

Il prodotto acquisisce ore ma tariffe, budget e consuntivi sono espressi in giornate. Il PRD, ADR-002, registra la conferma del committente della conversione fissa.

<!-- archetipo:wiki section=decision -->
## Decisione

Definire una giornata equivalente a 8 ore e centralizzare la costante per tutti i calcoli.

<!-- archetipo:wiki section=alternatives -->
## Alternative

Configurare ore per giornata per azienda, collaboratore o offerta. Il PRD non la seleziona per mantenere il modello MVP semplice e perché la regola fissa è stata confermata.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Riepilogo personale, fatturazione cliente e avanzamento offerta sono coerenti e semplici da verificare. Una futura configurabilità richiederà di definire snapshot e compatibilità storica invece di cambiare soltanto una formula.

<!-- archetipo:wiki section=verification -->
## Verifica

`src/domain/types.ts` esporta `ORE_PER_GIORNATA = 8`; `src/domain/consuntivi/index.ts` la usa nei tre calcoli. I test unitari verificano, fra gli altri casi, che 8 ore corrispondano a una giornata. La decisione è adottata.

## Concetti correlati

La decisione deriva dal [PRD originale](/references/prd.md) e influenza [Attività](/domains/attivita.md), [Offerte](/domains/offerte.md) e [Fatturazione clienti](/domains/fatturazione-clienti.md).
