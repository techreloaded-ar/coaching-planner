---
type: decision
title: Ruoli combinabili derivati dal profilo collaboratore
description: Derivare il ruolo Collaboratore dalla presenza del profilo, riusando enum e relazione 1:1 esistenti senza modifiche allo schema
status: reviewed
decision_status: accepted
sources:
    - path: prisma/schema.prisma
      role: implementation
      symbol: Utente, Collaboratore
    - path: src/app/(back-office)/anagrafiche/utenti/actions.ts
      role: implementation
      symbol: creaUtente, aggiornaUtente
    - path: src/domain/anagrafiche/valida-utente.ts
      role: implementation
      symbol: validaCensimentoUtente, validaModificaUtente
    - path: src/lib/dal.ts
      role: implementation
      symbol: risolviProfiloCollaboratoreCorrente
    - path: src/app/(back-office)/anagrafiche/utenti/utenti-tabella.tsx
      role: implementation
    - path: src/app/(back-office)/anagrafiche/utenti/utente-form.tsx
      role: implementation
    - path: tests/unit/utenti-actions.test.ts
      role: verification
    - path: tests/unit/valida-utente.test.ts
      role: verification
    - path: tests/e2e/gestione-utenti.spec.ts
      role: verification
review:
    content_hash: sha256:edb36260a709fab3ad9dd2f5d1ae2f455988829842c108c90a81de60d49ea24d
    evidence_revision: 8ebeb2c8bb63227feb4d26fece4766baa9b086de
    evidence_hash: sha256:105ff9f7a5c4a2eb46a2a898cef3a45893d4b2977edfa04334de8ad8acaaf594
    reviewed_at: "2026-07-28T10:51:15Z"
---
# Ruoli combinabili derivati dal profilo collaboratore

<!-- archetipo:wiki section=context -->
## Contesto

US-045, US-046 e US-047 richiedono che sia la creazione sia la modifica di un utente supportino ruoli combinabili Amministratore e Collaboratore, con creazione, riattivazione o disattivazione del profilo collaboratore in risposta al cambio di ruolo. Le combinazioni ammesse sono tre: solo Amministratore, solo Collaboratore, ed entrambi. Il modello dati esistente rappresenta già l'utente con un enum `Utente.ruolo` e una relazione 1:1 opzionale verso `Collaboratore`, e il DAL consente a un amministratore dotato di profilo attivo di consuntivare nel front office. Occorre decidere come rappresentare la combinabilità dei ruoli, in creazione e nell'intero ciclo di vita successivo, senza introdurre due fonti di verità sullo stesso fatto.

<!-- archetipo:wiki section=decision -->
## Decisione

Derivare il ruolo di accesso "Collaboratore" dalla presenza e dallo stato del profilo `Collaboratore`, senza modifiche allo schema Prisma. Il modello esistente — enum `Utente.ruolo` più relazione 1:1 opzionale `Collaboratore` — rappresenta già le tre combinazioni ammesse: solo Amministratore (`ruolo = AMMINISTRATORE`, nessun profilo o profilo disattivato); solo Collaboratore (`ruolo = COLLABORATORE` con record `Collaboratore` attivo); entrambi (`ruolo = AMMINISTRATORE` con record `Collaboratore` attivo, combinazione già supportata dal DAL che consente a un amministratore con profilo attivo di consuntivare nel front office). `creaUtente` crea l'utente e, quando il ruolo operativo è attribuito, il profilo collaboratore corrispondente nella stessa operazione. US-046 estende la stessa derivazione al ciclo di vita di un utente già censito: `aggiornaUtente` (form a checkbox anche in modifica, come in creazione) calcola il nuovo ruolo dai due checkbox e applica la transizione di profilo coerente nella stessa transazione — crea il profilo (attivo, con i dati raccolti) se il ruolo Collaboratore viene aggiunto e il profilo non esiste; lo riattiva conservando partita IVA e tariffa se esiste già disattivato; lo disattiva, senza mai cancellarlo, se il ruolo Collaboratore viene tolto. La disattivazione reversibile — già in uso per l'invalidazione utente — è quindi il meccanismo unico anche per la rimozione del ruolo. `risolviProfiloCollaboratoreCorrente` rilegge ruolo e profilo a ogni accesso protetto, così l'abilitazione operativa resta allineata allo stato a database in entrambi i flussi.

<!-- archetipo:wiki section=alternatives -->
## Alternative

**Set di ruoli persistito** (tabella ponte o array di ruoli su `Utente`): più espressivo in generale, ma richiede una migrazione dello schema e la riscrittura di DAL, guardie e policy senza aggiungere alcuna capacità, perché l'enum più il profilo copre già esattamente le tre combinazioni richieste. Scartata per costo sproporzionato rispetto al beneficio nullo nel perimetro richiesto.

**Flag booleani ridondanti su `Utente`** (ad esempio `isAmministratore`/`isCollaboratore`): duplicano un'informazione già derivabile dalla presenza del profilo operativo, introducendo il rischio di disallineamento tra due fonti di verità sullo stesso fatto. Scartata perché contraddice il principio di un'unica fonte autorevole sul ruolo.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Il ruolo di accesso "Collaboratore" resta accoppiato all'esistenza del profilo operativo: non è possibile essere Collaboratore di accesso senza un record `Collaboratore`, né viceversa. Il tradeoff è accettato perché coerente con [Autorità sul ruolo nel DAL](/decisions/autorita-ruolo-dal.md), dove il DAL rilegge ruolo e profilo a ogni accesso protetto e mantiene una sola fonte di verità. Lo schema resta invariato, evitando migrazione e riscrittura di guardie e policy.

<!-- archetipo:wiki section=verification -->
## Verifica

`tests/unit/utenti-actions.test.ts` copre in isolamento sia `creaUtente` sia `aggiornaUtente`, verificando che ciascuna delle tre combinazioni produca lo stato utente-profilo atteso in creazione e che le quattro transizioni di profilo (creazione, riattivazione, disattivazione, nessuna scrittura) producano i payload Prisma esatti in modifica, protezione dell'ultimo amministratore inclusa. `tests/unit/valida-utente.test.ts` copre `validaCensimentoUtente` e `validaModificaUtente`, incluso l'obbligo condizionale dei campi profilo. `tests/e2e/gestione-utenti.spec.ts` prova end-to-end che le tre combinazioni di ruolo producano gli accessi attesi al back office e alla consuntivazione nel front office sia in creazione sia in modifica, incluse la disattivazione con storico attività conservato, il messaggio di profilo disattivato al front office e la riattivazione senza richiesta dei dati già noti, tramite utenti e collaboratori creati da factory secondo il contratto e2e del progetto.

## Concetti correlati

Questa decisione raffina [Autorità sul ruolo nel DAL](/decisions/autorita-ruolo-dal.md) e supporta i domini [Identità e accesso](/domains/identita-accesso.md) e [Collaboratori](/domains/collaboratori.md). È collegata alle specifiche US-045, US-046 e US-047 del backlog di delivery (`.archetipo/backlog.yaml`).
