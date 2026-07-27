---
type: decision
title: Ruoli combinabili derivati dal profilo collaboratore
description: Derivare il ruolo Collaboratore dalla presenza del profilo, riusando enum e relazione 1:1 esistenti senza modifiche allo schema
status: generated
decision_status: accepted
sources:
    - path: prisma/schema.prisma
      role: implementation
      symbol: Utente, Collaboratore
    - path: src/app/(back-office)/anagrafiche/utenti/actions.ts
      role: implementation
      symbol: creaUtente
    - path: src/lib/dal.ts
      role: implementation
      symbol: risolviProfiloCollaboratoreCorrente
    - path: src/app/(back-office)/anagrafiche/utenti/utenti-tabella.tsx
      role: implementation
    - path: tests/unit/utenti-actions.test.ts
      role: verification
    - path: tests/e2e/gestione-utenti.spec.ts
      role: verification
---
# Ruoli combinabili derivati dal profilo collaboratore

<!-- archetipo:wiki section=context -->
## Contesto

US-045, US-046 e US-047 richiedono che la creazione di un utente supporti ruoli combinabili Amministratore e Collaboratore, con creazione immediata del profilo collaboratore quando il ruolo operativo è attribuito. Le combinazioni ammesse sono tre: solo Amministratore, solo Collaboratore, ed entrambi. Il modello dati esistente rappresenta già l'utente con un enum `Utente.ruolo` e una relazione 1:1 opzionale verso `Collaboratore`, e il DAL consente a un amministratore dotato di profilo attivo di consuntivare nel front office. Occorre decidere come rappresentare la combinabilità dei ruoli senza introdurre due fonti di verità sullo stesso fatto.

<!-- archetipo:wiki section=decision -->
## Decisione

Derivare il ruolo di accesso "Collaboratore" dalla presenza del profilo `Collaboratore`, senza modifiche allo schema Prisma. Il modello esistente — enum `Utente.ruolo` più relazione 1:1 opzionale `Collaboratore` — rappresenta già le tre combinazioni ammesse: solo Amministratore (`ruolo = AMMINISTRATORE`, nessun profilo); solo Collaboratore (`ruolo = COLLABORATORE` con record `Collaboratore`); entrambi (`ruolo = AMMINISTRATORE` con record `Collaboratore`, combinazione già supportata dal DAL che consente a un amministratore con profilo attivo di consuntivare nel front office). `creaUtente` crea l'utente e, quando il ruolo operativo è attribuito, il profilo collaboratore corrispondente nella stessa operazione; `risolviProfiloCollaboratoreCorrente` rilegge ruolo e profilo a ogni accesso protetto, così l'abilitazione operativa resta allineata allo stato a database.

<!-- archetipo:wiki section=alternatives -->
## Alternative

**Set di ruoli persistito** (tabella ponte o array di ruoli su `Utente`): più espressivo in generale, ma richiede una migrazione dello schema e la riscrittura di DAL, guardie e policy senza aggiungere alcuna capacità, perché l'enum più il profilo copre già esattamente le tre combinazioni richieste. Scartata per costo sproporzionato rispetto al beneficio nullo nel perimetro richiesto.

**Flag booleani ridondanti su `Utente`** (ad esempio `isAmministratore`/`isCollaboratore`): duplicano un'informazione già derivabile dalla presenza del profilo operativo, introducendo il rischio di disallineamento tra due fonti di verità sullo stesso fatto. Scartata perché contraddice il principio di un'unica fonte autorevole sul ruolo.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Il ruolo di accesso "Collaboratore" resta accoppiato all'esistenza del profilo operativo: non è possibile essere Collaboratore di accesso senza un record `Collaboratore`, né viceversa. Il tradeoff è accettato perché coerente con [Autorità sul ruolo nel DAL](/decisions/autorita-ruolo-dal.md), dove il DAL rilegge ruolo e profilo a ogni accesso protetto e mantiene una sola fonte di verità. Lo schema resta invariato, evitando migrazione e riscrittura di guardie e policy.

<!-- archetipo:wiki section=verification -->
## Verifica

`tests/unit/utenti-actions.test.ts` copre in isolamento `creaUtente`, verificando che ciascuna delle tre combinazioni produca lo stato utente-profilo atteso. `tests/e2e/gestione-utenti.spec.ts` prova end-to-end che le tre combinazioni di ruolo producano gli accessi attesi al back office e alla consuntivazione nel front office, tramite utenti e collaboratori creati da factory secondo il contratto e2e del progetto.

## Concetti correlati

Questa decisione raffina [Autorità sul ruolo nel DAL](/decisions/autorita-ruolo-dal.md) e supporta i domini [Identità e accesso](/domains/identita-accesso.md) e [Collaboratori](/domains/collaboratori.md). È collegata alle specifiche US-045, US-046 e US-047 nel [Backlog](/backlog/overview.md).
