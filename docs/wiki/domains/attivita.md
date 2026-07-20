---
type: domain
title: Attività e consuntivazione
description: Consuntivazione giornaliera del lavoro, calendario e riepilogo mensile del collaboratore
status: reviewed
classification: candidate
sources:
    - path: src/lib/actions/righe-attivita.ts
      role: inbound-commands
      symbol: creaRiga, modificaRiga, eliminaRiga, rimuoviTrasferta
    - path: src/lib/attivita.ts
      role: application-query
      symbol: attivitaDelMese, righeDelGiorno, riepilogoMese
    - path: src/domain/calendario/index.ts
      role: supporting-domain
    - path: src/domain/consuntivi/index.ts
      role: domain-calculation
      symbol: validaOre, validaKmTrasferta, calcolaRiepilogoMese
    - path: prisma/schema.prisma
      role: owned-data
      symbol: RigaAttivita
    - path: tests/unit/righe-attivita-actions.test.ts
      role: verification
    - path: tests/e2e/calendario-segregazione.spec.ts
      role: verification
review:
    content_hash: sha256:0be683ccfbab7be7fb2594d73aad07715d32bec8b999b40bbcd01ee03a4492bb
    evidence_revision: e4e144b2fd5db8760f08f7e86a68e470f9e0a6e6
    reviewed_at: "2026-07-20T17:02:05Z"
---
# Attività e consuntivazione

<!-- archetipo:wiki section=purpose -->
## Scopo

Permette a un collaboratore con profilo operativo di registrare e consultare le proprie ore giornaliere su cliente e offerta, indicare fatturabilità e trasferta, navigare il calendario mensile e ottenere un riepilogo economico personale.

<!-- archetipo:wiki section=language -->
## Linguaggio

Riga attività, giornata, mese, ore, cliente, offerta, fatturabile, nota, trasferta km, rimborso, tariffa giornaliera, giornate equivalenti e riepilogo mensile. Il token mese è `YYYY-MM`; la data di una riga è esposta come `YYYY-MM-DD`.

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede `RigaAttivita` e decide ammissibilità, proprietà e aggregazioni personali. Consuma profilo collaboratore, cliente, offerta e politica di rimborso. Il calendario è un supporting module senza persistenza. I report amministrativi sono downstream e leggono le righe come fatti.

<!-- archetipo:wiki section=contracts -->
## Contratti

`creaRiga`, `modificaRiga`, `eliminaRiga` e `rimuoviTrasferta` restituiscono `{ success, error? }`. Le query espongono attività per giorno/mese e un `RisultatoRiepilogoMese` serializzabile. Il profilo deve essere `ATTIVO`; le offerte selezionabili devono appartenere al cliente ed essere attive.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. Le pagine e le action risolvono il profilo; solo l'esito derivato `ATTIVO` consente operazioni.
2. La creazione verifica campi, coerenza offerta-cliente, stato offerta, ore, km/scaglione e formato data, poi `src/lib/actions/righe-attivita.ts` (`creaRiga`) crea una `RigaAttivita` per il collaboratore corrente e assegna esattamente cliente, offerta, data, ore, nota, `fatturabile` e `trasfertaKm`.
3. `modificaRiga`, `eliminaRiga` e `rimuoviTrasferta` verificano prima che `RigaAttivita.collaboratoreId` coincida con il collaboratore corrente. `rimuoviTrasferta` assegna esattamente `trasfertaKm: null` nello stesso file; l'eliminazione cancella il record e non è una transizione di stato.
4. `modificaRiga` costruisce un aggiornamento parziale. Assegna `fatturabile` soltanto se il `FormData` contiene il campo; non legge uno stato sorgente né modella transizioni nominate.
5. La lettura mensile filtra sempre per `collaboratoreId` e intervallo del mese (`orderBy: data asc, createdAt asc`), poi aggrega per giorno: numero righe, ore totali e, per ciascun cliente con attività quel giorno, ragione sociale e ore cumulate su tutte le sue offerte, in ordine di prima apparizione. La cella del calendario mostra fino a due etichette cliente con le ore, oltre le quali compare un indicatore "+N" con i clienti rimanenti; il codice offerta non è più mostrato nella cella.
6. Il riepilogo somma ore, converte con 8 ore/giorno, include nell'imponibile solo ore fatturabili e aggiunge i rimborsi validi.
7. Non esiste uno stato lifecycle persistito della riga. Gli esiti del calcolo rimborso non sono transizioni.

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| UI | `src/app/(front-office)/attivita/**` |
| Comandi | `src/lib/actions/righe-attivita.ts` |
| Query | `src/lib/attivita.ts` |
| Calendario | `src/domain/calendario/index.ts` |
| Regole e riepilogo | `src/domain/consuntivi/index.ts` |
| Dati | `prisma/schema.prisma` (`RigaAttivita`) |
| Test | `tests/unit/attivita.test.ts`, `tests/unit/righe-attivita-actions.test.ts`, `tests/unit/calendario.test.ts`, `tests/unit/riepilogo-mese.test.ts`, `tests/e2e/calendario-segregazione.spec.ts` e scenari attività dedicati |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

Le ore devono essere maggiori di zero e non superiori a 24 per singola riga; non esiste un limite alla somma giornaliera. I km, se presenti, sono interi positivi coperti da uno scaglione. La proprietà è applicata da filtri e controlli applicativi. Lo schema ha tre FK separate e non impone che `RigaAttivita.clienteId` coincida con il cliente dell'offerta. La creazione verifica la coppia; `modificaRiga` la ricontrolla solo quando riceve insieme un nuovo cliente e una nuova offerta, quindi una chiamata parziale può produrre incoerenza semantica. Inoltre `dettaglio-giornata.tsx` invia `fatturabile` soltanto quando la checkbox è selezionata e `modificaRiga` ignora il campo assente: dal flusso UI osservato una riga `true` non può quindi essere salvata come `false`. La regex delle action verifica il formato data ma non la validità civile; `Date.UTC` normalizza date impossibili. Tariffa e scaglioni correnti ricalcolano retroattivamente il riepilogo.

<!-- archetipo:wiki section=verification -->
## Verifica

La suite unit copre segregazione, CRUD, validazioni, calendario, rimborso e riepilogo. Gli E2E coprono flussi browser, ma alcuni scenari storici usano seed condivisi mentre i test mutanti recenti adottano factory e risorse riservate. Confidenza alta sul comportamento descritto; i limiti server-side sono osservazioni esplicite, non invarianti presunte.

## Concetti correlati

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Collaboratori](/domains/collaboratori.md), [Clienti](/domains/clienti.md), [Offerte](/domains/offerte.md), [Politiche di rimborso](/domains/politiche-rimborso.md) e [Fatturazione clienti](/domains/fatturazione-clienti.md).
