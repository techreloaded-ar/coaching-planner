---
type: domain
title: Clienti
description: Anagrafica fiscale dei clienti e loro abilitazione operativa
classification: candidate
status: generated
sources:
- path: src/app/(back-office)/anagrafiche/clienti/actions.ts
  role: inbound-commands
  symbol: creaCliente, aggiornaCliente, cambiaStatoCliente
- path: src/lib/clienti.ts
  role: application-query
- path: src/domain/anagrafiche/valida-cliente.ts
  role: domain-validation
  symbol: validaCliente
- path: prisma/schema.prisma
  role: owned-data
  symbol: Cliente
- path: tests/unit/clienti-dal-actions.test.ts
  role: verification
- path: tests/e2e/anagrafica-clienti.spec.ts
  role: verification
---
# Clienti

<!-- archetipo:wiki section=purpose -->
## Scopo

Gestisce i dati identificativi e fiscali dei clienti e decide se un cliente è disponibile per nuovi flussi operativi. L'attore che crea, modifica o abilita un cliente è l'amministratore. Le offerte e le righe attività usano il cliente come riferimento, ma non sono possedute da questa capability.

<!-- archetipo:wiki section=language -->
## Linguaggio

- **Cliente**: controparte identificata da ragione sociale e dati fiscali.
- **Attivo**: cliente selezionabile e idoneo alla creazione di nuove offerte.
- **Disattivato**: cliente conservato nello storico ma escluso dalle selezioni operative.
- **Partita IVA, codice fiscale, PEC, codice destinatario**: attributi fiscali validati dalle Server Action.

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede il record `Cliente`, i suoi dati fiscali e il flag `attivo`. Non possiede `Offerta` o `RigaAttivita`; le relazioni Prisma rendono il cliente un riferimento upstream. La disattivazione non modifica automaticamente offerte o attività esistenti.

<!-- archetipo:wiki section=contracts -->
## Contratti

Le Server Action `creaCliente`, `aggiornaCliente` e i due adapter di cambio stato sono riservati all'amministratore. `elencaClientiSelezionabili` restituisce soltanto clienti con `attivo: true`; `clientePerId` ed `elencaClienti` includono anche quelli disattivati. La creazione di un'offerta consulta `clientePerId` e rifiuta un cliente assente o disattivato.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. `creaCliente` in `src/app/(back-office)/anagrafiche/clienti/actions.ts` normalizza i campi, applica `validaCliente` e crea il record assegnando esattamente `attivo: true`.
2. `aggiornaCliente` nello stesso file aggiorna i dati fiscali senza assegnare `attivo`.
3. `cambiaStatoCliente` nello stesso file e l'adapter `cambia-stato-action.ts` assegnano direttamente a `Cliente.attivo` il booleano ricevuto dal form; non leggono né proteggono lo stato sorgente, quindi il codice non prova transizioni nominate fra stati sorgente e destinazione.
4. Le letture per selezione filtrano `attivo: true`; disattivare non cancella dati né propaga modifiche alle offerte.

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| UI e comandi | `src/app/(back-office)/anagrafiche/clienti/**` |
| Query applicative | `src/lib/clienti.ts` |
| Validazione | `src/domain/anagrafiche/valida-cliente.ts` |
| Dati | `prisma/schema.prisma` (`Cliente`) |
| Consumatori | `src/app/(back-office)/anagrafiche/clienti/[id]/offerte/actions.ts`, `src/lib/attivita.ts`, `src/lib/report.ts` |
| Test | `tests/unit/clienti-dal-actions.test.ts`, `tests/unit/valida-cliente.test.ts`, `tests/e2e/anagrafica-clienti.spec.ts` |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

Le action richiedono ragione sociale e partita IVA; validano partita IVA a 11 cifre, codice fiscale a 11 cifre o 16 caratteri, CAP, provincia, PEC e codice destinatario. Lo schema rende però `Cliente.partitaIva` nullable e non impone unicità fiscale: questi vincoli sono applicativi, non di database. La creazione di nuove offerte è impedita per un cliente disattivato; non è osservata una regola che disattivi automaticamente le sue offerte.

<!-- archetipo:wiki section=verification -->
## Verifica

I test unitari coprono guardia amministratore, normalizzazione, scritture e filtri. `tests/e2e/anagrafica-clienti.spec.ts` verifica i principali flussi browser. Confidenza alta sui comandi e sui vincoli applicativi; la classificazione resta candidata fino a revisione semantica esplicita.

## Concetti correlati

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Offerte](/domains/offerte.md) e [Attività](/domains/attivita.md).
