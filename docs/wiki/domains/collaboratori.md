---
type: domain
title: Collaboratori
description: Profili professionali dei collaboratori, tariffa e abilitazione operativa
classification: candidate
status: generated
sources:
- path: src/app/(back-office)/anagrafiche/collaboratori/actions.ts
  role: inbound-commands
  symbol: creaCollaboratore, aggiornaCollaboratore, cambiaStatoCollaboratore
- path: src/lib/collaboratori.ts
  role: application-query
- path: src/domain/anagrafiche/valida-collaboratore.ts
  role: domain-validation
  symbol: validaCollaboratore
- path: src/lib/dal.ts
  role: outbound-consumer
  symbol: risolviProfiloCollaboratoreCorrente
- path: prisma/schema.prisma
  role: owned-data
  symbol: Collaboratore
- path: tests/e2e/anagrafica-collaboratori.spec.ts
  role: verification
---
# Collaboratori

<!-- archetipo:wiki section=purpose -->
## Scopo

Gestisce il profilo professionale usato per consuntivare: identità anagrafica, partita IVA, tariffa giornaliera e abilitazione operativa. L'amministratore governa il profilo; il collaboratore lo usa indirettamente per accedere alle proprie attività e al riepilogo.

<!-- archetipo:wiki section=language -->
## Linguaggio

- **Collaboratore**: profilo professionale collegato uno-a-uno a un `Utente`.
- **Tariffa giornaliera**: valore usato nel riepilogo economico personale.
- **Attivo / disattivato**: disponibilità del profilo per attività e, per utenti di ruolo collaboratore, validità operativa dell'accesso.
- **Profilo assente**: utente autenticato privo di record `Collaboratore`.

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede `Collaboratore`, la tariffa e il booleano `attivo`. Coordina la creazione e la sincronizzazione di nome/email sul record `Utente`, ma ruolo, account provider e sessione sono decisioni della capability Identità e accesso. Le righe attività dipendono dall'identificativo collaboratore.

<!-- archetipo:wiki section=contracts -->
## Contratti

`creaCollaboratore` crea in transazione il profilo e un nuovo utente di ruolo `COLLABORATORE`, oppure riusa un utente amministratore privo di profilo. `aggiornaCollaboratore` sincronizza profilo e nome/email utente. Il DAL espone `ATTIVO`, `ASSENTE` o `DISATTIVATO` come esiti derivati dalla presenza del profilo e dal booleano.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. `creaCollaboratore` in `src/app/(back-office)/anagrafiche/collaboratori/actions.ts` valida i dati e, nella transazione, crea `Collaboratore` assegnando esattamente `attivo: true`; quando crea anche `Utente`, assegna esattamente `ruolo: \"COLLABORATORE\"`.
2. Se esiste un amministratore senza profilo, la stessa transazione lo riusa senza assegnare un nuovo ruolo.
3. `aggiornaCollaboratore` nello stesso file aggiorna profilo e utente nella stessa transazione senza cambiare `attivo` o `ruolo`.
4. `cambiaStatoCollaboratore` nello stesso file e l'adapter `cambia-stato-action.ts` assegnano direttamente il booleano richiesto a `Collaboratore.attivo` senza guardia sul valore sorgente; non è provata una macchina a stati più ricca.
5. `risolviProfiloCollaboratoreCorrente` in `src/lib/dal.ts` produce `ASSENTE`, `DISATTIVATO` o `ATTIVO` mediante branch di lettura: sono esiti derivati, non stati persistiti separatamente.

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| UI e comandi | `src/app/(back-office)/anagrafiche/collaboratori/**` |
| Query | `src/lib/collaboratori.ts` |
| Validazione | `src/domain/anagrafiche/valida-collaboratore.ts` |
| Dati | `prisma/schema.prisma` (`Collaboratore`, relazione con `Utente`) |
| Policy consumatrici | `src/lib/dal.ts`, `src/lib/attivita.ts` |
| Test | `tests/unit/collaboratori-dal-actions.test.ts`, `tests/unit/valida-collaboratore.test.ts`, `tests/e2e/anagrafica-collaboratori.spec.ts` |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

Nome, cognome, email, partita IVA e tariffa sono obbligatori lato applicazione; email e partita IVA hanno controllo di formato e la tariffa deve essere positiva con massimo due decimali. `Utente.email` e `Collaboratore.userId` sono unici a database. La disattivazione è reversibile e non cancella attività. Per un utente di ruolo `COLLABORATORE`, un profilo presente ma disattivato rende la sessione non risolvibile dal DAL; un amministratore conserva la sessione ma non può usare quel profilo per consuntivare.

<!-- archetipo:wiki section=verification -->
## Verifica

Test unitari coprono transazioni, duplicati e guardie; gli E2E coprono gestione e revoca dopo disattivazione. Confidenza alta sul comportamento osservato; ownership condivisa di `Utente` resta una boundary candidata da sottoporre a review.

## Concetti correlati

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Identità e accesso](/domains/identita-accesso.md) e [Attività](/domains/attivita.md).
