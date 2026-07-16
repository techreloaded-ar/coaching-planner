---
id: decisions.importi-decimali
type: decision
decision_status: accepted
summary: Persistire gli importi monetari come Decimal per evitare errori contabili
status: generated
links:
  - id: domains.collaboratori
    relation: affects
  - id: domains.offerte
    relation: affects
  - id: domains.politiche-rimborso
    relation: affects
  - id: domains.fatturazione-clienti
    relation: affects
sources:
  - path: "docs/wiki/sources/prd.md"
    role: decision-source
  - path: "prisma/schema.prisma"
    role: implementation
  - path: "src/domain/anagrafiche/valida-offerta.ts"
    role: implementation
  - path: "src/domain/consuntivi/index.ts"
    role: implementation-status
  - path: "tests/unit/report-fatturazione-clienti.test.ts"
    role: verification
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
