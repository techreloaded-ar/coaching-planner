---
type: domain
title: Fatturazione clienti
description: Proiezione amministrativa mensile degli importi da fatturare ai clienti
status: reviewed
classification: candidate
sources:
    - path: src/lib/report.ts
      role: application-query
      symbol: reportFatturazioneClientiMese
    - path: src/domain/consuntivi/index.ts
      role: domain-calculation
      symbol: calcolaReportFatturazioneClienti
    - path: src/app/(back-office)/report/fatturazione-clienti/page.tsx
      role: inbound-ui
    - path: tests/unit/report-fatturazione-clienti.test.ts
      role: verification
    - path: tests/e2e/report-fatturazione-clienti.spec.ts
      role: verification
review:
    content_hash: sha256:1d5fb5ab4ada03c115bffd68b4c5a0e0900511a87607718be912599843956b4f
    evidence_revision: c7040852fffe26742e09689568666762e3d4ed82
    reviewed_at: "2026-07-21T06:12:34Z"
---
# Fatturazione clienti

<!-- archetipo:wiki section=purpose -->
## Scopo

Fornisce all'amministratore una proiezione mensile per cliente e offerta degli importi da fatturare: imponibile di manodopera, rimborsi trasferta e totale. È una capability di lettura con decisioni di calcolo proprie, non un documento fiscale persistito.

<!-- archetipo:wiki section=language -->
## Linguaggio

Mese, cliente, offerta, tariffa giornaliera dell'offerta, ore fatturabili, giornate fatturabili, imponibile manodopera, rimborso trasferta e importo totale.

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede il contratto e le regole della proiezione, ma nessun aggregate persistito. Consuma righe attività, metadati cliente/offerta e scaglioni correnti. Non possiede la tariffa commerciale o la distanza registrata.

<!-- archetipo:wiki section=contracts -->
## Contratti

`reportFatturazioneClientiMese(token)` richiede ruolo amministratore e restituisce un risultato serializzabile con `perCliente` e totali. L'input dominio `RigaReportFatturazione` isola il calcolo puro da Prisma. Un token mese non valido restituisce un report vuoto nel service; la pagina UI lo normalizza al mese corrente.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. Il service filtra tutte le righe nel mese, senza filtro collaboratore, e carica offerta e cliente.
2. Mappa Decimal e relazioni in input serializzabili, carica gli scaglioni e invoca `calcolaReportFatturazioneClienti`.
3. Solo le ore con `fatturabile = true` incrementano l'imponibile; le giornate sono ore/8 e usano la tariffa dell'offerta.
4. Una trasferta con rimborso `OK` viene ribaltata al cliente anche su riga non fatturabile.
5. Clienti senza imponibile e senza rimborsi sono omessi; risultati e totali sono formattati a due decimali.
6. Non esiste stato né write del report: ogni richiesta ricostruisce la proiezione.

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| UI | `src/app/(back-office)/report/fatturazione-clienti/**` |
| Query e mapping | `src/lib/report.ts` |
| Calcolo puro | `src/domain/consuntivi/index.ts` |
| Dati letti | `prisma/schema.prisma` (`RigaAttivita`, `Offerta`, `Cliente`, `ScaglioneKm`) |
| Test | `tests/unit/report-fatturazione-clienti.test.ts`, `tests/e2e/report-fatturazione-clienti.spec.ts`, scenari demo dedicati |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

Accesso solo amministratore. La tariffa è quella corrente dell'offerta e gli scaglioni sono quelli correnti; modifiche successive ricalcolano mesi storici, quindi il risultato non è una fattura immutabile. Lo schema non garantisce coerenza fra cliente diretto della riga e cliente dell'offerta: la proiezione usa il cliente della riga per il raggruppamento e la tariffa dell'offerta per il calcolo. Le distanze oltre soglia o senza fascia non producono rimborso nel report.

<!-- archetipo:wiki section=verification -->
## Verifica

I test unitari coprono aggregazione, righe non fatturabili, rimborsi, ordinamento e formattazione. L'E2E usa factory e mese riservato per verificare risultati e stato vuoto. Confidenza alta sulla proiezione; l'indipendenza resta candidata perché il calcolo condivide il modulo fisico `consuntivi` con Attività e Offerte.

## Concetti correlati

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Attività](/domains/attivita.md), [Offerte](/domains/offerte.md) e [Politiche di rimborso](/domains/politiche-rimborso.md).
