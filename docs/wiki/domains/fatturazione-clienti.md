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
    content_hash: sha256:66ac8f75541003ccba3017afd97bcfb1eb6ebb947f369d079bcca541104253a7
    evidence_revision: a6643836528ddb3d9cdc13e1c9c39eca2c09262d
    reviewed_at: "2026-07-21T09:35:02Z"
---
# Fatturazione clienti

<!-- archetipo:wiki section=purpose -->
## Scopo

Fornisce all'amministratore una proiezione mensile per cliente e offerta degli importi da fatturare: imponibile di manodopera, rimborsi trasferta e totale. Per ogni offerta del cliente, un dettaglio opzionale espone anche la ripartizione per singolo collaboratore. È una capability di lettura con decisioni di calcolo proprie, non un documento fiscale persistito.

<!-- archetipo:wiki section=language -->
## Linguaggio

Mese, cliente, offerta, tariffa giornaliera dell'offerta, ore fatturabili, giornate fatturabili, imponibile manodopera, rimborso trasferta, importo totale e dettaglio per collaboratore (ore fatturabili, giornate equivalenti e imponibile allocato).

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede il contratto e le regole della proiezione, ma nessun aggregate persistito. Consuma righe attività, metadati cliente/offerta e scaglioni correnti. Non possiede la tariffa commerciale o la distanza registrata.

<!-- archetipo:wiki section=contracts -->
## Contratti

`reportFatturazioneClientiMese(token)` richiede ruolo amministratore e restituisce un risultato serializzabile con `perCliente` e totali; ogni voce `perOfferta` include ora `perCollaboratore`, il dettaglio fatturabile per collaboratore su quell'offerta. L'input dominio `RigaReportFatturazione` isola il calcolo puro da Prisma. Un token mese non valido restituisce un report vuoto nel service; la pagina UI lo normalizza al mese corrente.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. Il service filtra tutte le righe nel mese, senza filtro collaboratore, e carica offerta, cliente e collaboratore.
2. Mappa Decimal e relazioni in input serializzabili, carica gli scaglioni e invoca `calcolaReportFatturazioneClienti`.
3. Solo le ore con `fatturabile = true` incrementano l'imponibile e alimentano il dettaglio `perCollaboratore`; le giornate sono ore/8 e usano la tariffa dell'offerta.
4. Per ogni offerta, le voci `perCollaboratore` sono ordinate per ore fatturabili decrescenti (pareggio per nome) e i loro imponibili sono allocati a resto massimo in centesimi interi, ancorati al valore visualizzato di `imponibileManodopera` del cliente: la somma delle stringhe coincide sempre esattamente col totale, senza scostamenti di arrotondamento.
5. Una trasferta con rimborso `OK` viene ribaltata al cliente anche su riga non fatturabile; questi clienti "solo rimborsi" hanno `perOfferta` vuoto, e la UI lo segnala esplicitamente nel dettaglio.
6. Clienti senza imponibile e senza rimborsi sono omessi; risultati e totali sono formattati a due decimali.
7. Non esiste stato né write del report: ogni richiesta ricostruisce la proiezione, incluso il dettaglio per collaboratore; l'espansione del dettaglio in UI è stato locale non persistito, esclusivo per una sola scheda cliente alla volta.

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

I test unitari coprono aggregazione, righe non fatturabili, rimborsi, ordinamento, formattazione e la ripartizione per collaboratore (raggruppamento, esclusione ore non fatturabili, ordinamento e quadratura esatta dell'allocazione a resto massimo, incluso il caso limite di arrotondamento). L'E2E usa factory e mese riservato per verificare risultati, stato vuoto, l'espansione esclusiva del dettaglio collaboratori e il messaggio per i clienti solo-rimborsi. Confidenza alta sulla proiezione; l'indipendenza resta candidata perché il calcolo condivide il modulo fisico `consuntivi` con Attività e Offerte.

## Concetti correlati

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Attività](/domains/attivita.md), [Offerte](/domains/offerte.md) e [Politiche di rimborso](/domains/politiche-rimborso.md).
