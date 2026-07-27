---
type: domain
title: Collaboratori
description: Profili professionali dei collaboratori, tariffa e abilitazione operativa
status: generated
classification: candidate
sources:
    - path: src/app/(back-office)/anagrafiche/collaboratori/actions.ts
      role: inbound-commands
      symbol: creaCollaboratore, aggiornaCollaboratore, cambiaStatoCollaboratore
    - path: src/lib/collaboratori.ts
      role: application-query
      symbol: collaboratorePerId, storicoAttivitaCollaboratore
    - path: src/domain/anagrafiche/valida-collaboratore.ts
      role: domain-validation
      symbol: validaCollaboratore, validaCampoPartitaIva, validaCampoTariffaGiornaliera
    - path: src/lib/dal.ts
      role: outbound-consumer
      symbol: risolviProfiloCollaboratoreCorrente
    - path: src/app/(back-office)/anagrafiche/utenti/cambia-stato-utente-action.ts
      role: coordinated-lifecycle-command
      symbol: cambiaStatoUtenteAction
    - path: src/app/(back-office)/anagrafiche/utenti/actions.ts
      role: coordinated-creation-command
      symbol: creaUtente
    - path: src/app/(back-office)/anagrafiche/utenti/utenti-tabella.tsx
      role: coordinated-administration-ui
    - path: prisma/schema.prisma
      role: owned-data
      symbol: Collaboratore
    - path: src/lib/abilitazioni.ts
      role: application-query
      symbol: elencaOfferteAbilitate, elencaOfferteAbilitabili
    - path: src/app/(back-office)/anagrafiche/collaboratori/[id]/abilitazioni-actions.ts
      role: inbound-commands
      symbol: abilitaCollaboratoreSuOfferte, revocaAbilitazioneCollaboratore
    - path: prisma/schema.prisma
      role: owned-data
      symbol: AbilitazioneOfferta
    - path: scripts/backfill-abilitazioni-iniziali.ts
      role: one-time-bootstrap-command
      symbol: eseguiBackfillAbilitazioniIniziali
    - path: tests/unit/cambia-stato-utente.test.ts
      role: verification
    - path: tests/unit/abilitazioni-dal-actions.test.ts
      role: verification
    - path: tests/unit/backfill-abilitazioni-iniziali.test.ts
      role: verification
    - path: tests/unit/utenti-actions.test.ts
      role: verification
    - path: tests/e2e/anagrafica-collaboratori.spec.ts
      role: verification
    - path: tests/e2e/gestione-utenti.spec.ts
      role: verification
    - path: tests/e2e/dettaglio-collaboratore.spec.ts
      role: verification
    - path: tests/e2e/abilitazioni-collaboratore.spec.ts
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
- **Abilitazione esplicita**: relazione persistita e revocabile tra un collaboratore e un'offerta, che stabilisce su quali offerte il collaboratore può registrare nuove attività; è indipendente dallo storico delle righe attività già registrate (vedi la decisione [Abilitazioni esplicite collaboratore-offerta](/decisions/abilitazioni-offerte-esplicite.md)).

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede `Collaboratore`, la tariffa e il booleano `attivo`. Coordina la creazione e la sincronizzazione di nome/email sul record `Utente`, ma ruolo, account provider e sessione sono decisioni della capability Identità e accesso. L'invalidazione o riattivazione dell'utente è un comando di Identità e accesso che sincronizza nello stesso writer lo stato del profilo collegato. Le righe attività dipendono dall'identificativo collaboratore. Possiede anche `AbilitazioneOfferta`, l'abilitazione esplicita e revocabile che stabilisce su quali offerte il collaboratore può operare; riferisce le offerte possedute dalla capability Offerte senza modificarle.

`creaUtente` (capability Identità e accesso) è un secondo writer coordinato di `Collaboratore`: quando l'amministratore seleziona il ruolo Collaboratore nel censimento di un nuovo utente, crea il profilo con `attivo: true` nella stessa transazione dell'utente, riusando gli identici helper di validazione di partita IVA e tariffa (`validaCampoPartitaIva`, `validaCampoTariffaGiornaliera`, ora esportati da questo modulo) ma senza la logica di riuso di un amministratore esistente propria di `creaCollaboratore` — vedi la decisione [Ruoli combinabili derivati dal profilo collaboratore](/decisions/ruoli-combinabili-profilo-derivato.md). Il ruolo di accesso "Collaboratore" resta comunque derivato dalla presenza del profilo, non da un flag distinto.

<!-- archetipo:wiki section=contracts -->
## Contratti

`creaCollaboratore` crea in transazione il profilo e un nuovo utente di ruolo `COLLABORATORE`, oppure riusa un utente amministratore privo di profilo. `aggiornaCollaboratore` sincronizza profilo e nome/email utente. `creaUtente`, quando il ruolo Collaboratore è selezionato nel censimento utenti, crea nella stessa transazione utente e profilo (`attivo: true`) senza tentare alcun riuso: un'email già presente è sempre un errore di duplicato. `cambiaStatoUtenteAction`, riservata all'amministratore, sincronizza il booleano richiesto sul profilo collegato nella stessa transazione dell'invalidazione o riattivazione di `Utente`. Il DAL espone `ATTIVO`, `ASSENTE` o `DISATTIVATO` come esiti derivati dalla presenza del profilo e dal booleano. `storicoAttivitaCollaboratore` in `src/lib/collaboratori.ts` è una query riservata all'amministratore che restituisce tutte le righe attività del collaboratore con cliente e offerta inclusi, ordinate per data crescente, senza filtro temporale.

`elencaOfferteAbilitate` ed `elencaOfferteAbilitabili` in `src/lib/abilitazioni.ts`, riservate all'amministratore, restituiscono rispettivamente le offerte già abilitate per il collaboratore (incluse quelle nel frattempo disattivate, con `offertaAttiva: false`) e le offerte attive non ancora abilitate, entrambe ordinate per ragione sociale del cliente e poi per codice offerta. `abilitaCollaboratoreSuOfferte` crea in blocco le coppie `(collaboratoreId, offertaId)` mancanti verificando prima che ciascuna offerta selezionata sia attiva, ignorando i duplicati grazie al vincolo unico; `revocaAbilitazioneCollaboratore` elimina la singola coppia bersaglio. Entrambe le action sono riservate all'amministratore e rivalidano la pagina di dettaglio del collaboratore.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. `creaCollaboratore` in `src/app/(back-office)/anagrafiche/collaboratori/actions.ts` valida i dati e, nella transazione, crea `Collaboratore` assegnando esattamente `attivo: true`; quando crea anche `Utente`, assegna esattamente `ruolo: \"COLLABORATORE\"`.
2. Se esiste un amministratore senza profilo, la stessa transazione lo riusa senza assegnare un nuovo ruolo.
3. `creaUtente` in `src/app/(back-office)/anagrafiche/utenti/actions.ts` offre un secondo percorso di creazione: quando l'amministratore seleziona il ruolo Collaboratore nel censimento, la transazione crea `Utente` (ruolo `AMMINISTRATORE` o `COLLABORATORE` secondo i checkbox selezionati) e, in aggiunta, `Collaboratore` con `attivo: true`, componendo `Utente.nome` come `"{nome} {cognome}"`. Non riusa mai un utente esistente: un'email già presente produce sempre l'esito di duplicato senza scritture.
4. `aggiornaCollaboratore` nello stesso file aggiorna profilo e utente nella stessa transazione senza cambiare `attivo` o `ruolo`.
5. `cambiaStatoCollaboratore` nello stesso file e l'adapter `cambia-stato-action.ts` assegnano direttamente il booleano richiesto a `Collaboratore.attivo` senza guardia sul valore sorgente; non è provata una macchina a stati più ricca.
6. L'invalidazione di `Utente` scrive `false` anche in `Collaboratore.attivo` se il profilo è presente; la riattivazione scrive `true` su entrambi. Senza profilo non viene tentata la cascata. Il comando rivalida elenco utenti e collaboratori e non elimina attività o record.
7. `risolviProfiloCollaboratoreCorrente` in `src/lib/dal.ts` produce `ASSENTE`, `DISATTIVATO` o `ATTIVO` mediante branch di lettura: sono esiti derivati, non stati persistiti separatamente.
8. La pagina di dettaglio `src/app/(back-office)/anagrafiche/collaboratori/[id]/page.tsx`, riservata all'amministratore e raggiungibile dal click sulla riga dell'elenco, mostra il profilo e lo storico completo delle attività: legge le righe via `storicoAttivitaCollaboratore` e le raggruppa per mese solare decrescente con la funzione pura `raggruppaAttivitaPerMese` di `src/domain/consuntivi/index.ts`, esponendo per ogni mese totale ore e giornate equivalenti (8 ore/giornata); senza righe mostra un messaggio esplicito di assenza di attività.
9. Nella stessa pagina di dettaglio, la sezione "Offerte abilitate" (`abilitazioni-offerte.tsx`) elenca le abilitazioni correnti del collaboratore e apre un dialog di ricerca e selezione multipla sulle offerte abilitabili; la conferma invoca `abilitaCollaboratoreSuOfferte`, che assegna esattamente le coppie mancanti in `AbilitazioneOfferta`, mentre la revoca di una singola riga invoca `revocaAbilitazioneCollaboratore`, che elimina esattamente la coppia bersaglio. Nessuna delle due action modifica le righe attività già registrate.
10. `scripts/backfill-abilitazioni-iniziali.ts` pre-popola una tantum `AbilitazioneOfferta` dalle coppie `(collaboratoreId, offertaId)` distinte già presenti in `RigaAttivita` su offerte attive, dietro una guardia che salta la scrittura se la tabella contiene già almeno una riga. È invocabile manualmente con `npm run db:backfill-abilitazioni` e viene eseguito automaticamente da `prisma/seed.ts` negli ambienti di sviluppo/test (vedi la decisione [Abilitazioni esplicite collaboratore-offerta](/decisions/abilitazioni-offerte-esplicite.md)).

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| UI e comandi | `src/app/(back-office)/anagrafiche/collaboratori/**`, inclusa la pagina di dettaglio `[id]/page.tsx` con storico attività mensile e la sezione `[id]/abilitazioni-offerte.tsx` con dialog di ricerca e selezione multipla; `utenti/cambia-stato-utente-action.ts` per la cascata da utente; `utenti/actions.ts` (`creaUtente`) e `utenti/utenti-tabella.tsx` (badge multipli) per la creazione combinata e la sua rappresentazione nell'elenco utenti |
| Query | `src/lib/collaboratori.ts` (inclusa `storicoAttivitaCollaboratore`), `src/lib/abilitazioni.ts` (`elencaOfferteAbilitate`, `elencaOfferteAbilitabili`) |
| Action abilitazioni | `[id]/abilitazioni-actions.ts` (`abilitaCollaboratoreSuOfferte`, `revocaAbilitazioneCollaboratore`) |
| Validazione | `src/domain/anagrafiche/valida-collaboratore.ts` |
| Dati | `prisma/schema.prisma` (`Collaboratore`, relazione con `Utente`; `AbilitazioneOfferta`, coppia unica `collaboratoreId`/`offertaId` con `Offerta`) |
| Pre-popolamento una tantum | `scripts/backfill-abilitazioni-iniziali.ts`, esposto da `npm run db:backfill-abilitazioni` e agganciato a `prisma/seed.ts` |
| Policy consumatrici | `src/lib/dal.ts`, `src/lib/attivita.ts` |
| Test | `tests/unit/collaboratori-dal-actions.test.ts`, `tests/unit/cambia-stato-utente.test.ts`, `tests/unit/valida-collaboratore.test.ts`, `tests/unit/storico-attivita-mensile.test.ts`, `tests/unit/abilitazioni-dal-actions.test.ts`, `tests/unit/backfill-abilitazioni-iniziali.test.ts`, `tests/unit/utenti-actions.test.ts`, `tests/e2e/anagrafica-collaboratori.spec.ts`, `tests/e2e/dettaglio-collaboratore.spec.ts`, `tests/e2e/abilitazioni-collaboratore.spec.ts`, `tests/e2e/gestione-utenti.spec.ts` |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

Nome, cognome, email, partita IVA e tariffa sono obbligatori lato applicazione; email e partita IVA hanno controllo di formato e la tariffa deve essere positiva con massimo due decimali. `Utente.email` e `Collaboratore.userId` sono unici a database. La disattivazione è reversibile e non cancella attività. L'invalidazione e la riattivazione dell'utente mantengono allineato il profilo esistente nella stessa transazione, rispettivamente con `false` e `true`; non viene registrata l'origine della disattivazione del profilo. Per un utente di ruolo `COLLABORATORE`, un profilo presente ma disattivato rende la sessione non risolvibile dal DAL; un amministratore conserva la sessione ma non può usare quel profilo per consuntivare. La coppia `(collaboratoreId, offertaId)` è unica a database su `AbilitazioneOfferta`: creazione e revoca sono entrambe idempotenti. Un'offerta abilitata resta elencata anche se successivamente disattivata, ma solo le offerte attive compaiono tra quelle abilitabili nel dialog di ricerca. La revoca non cancella né altera le righe attività già registrate su quell'offerta.

<!-- archetipo:wiki section=verification -->
## Verifica

Test unitari coprono transazioni, duplicati e guardie; `cambia-stato-utente.test.ts` verifica la cascata atomica da invalidazione/riattivazione utente al profilo, incluso il caso senza profilo. `abilitazioni-dal-actions.test.ts` copre le query e le action di abilitazione/revoca, inclusi idempotenza e rifiuto di offerte non attive; `backfill-abilitazioni-iniziali.test.ts` copre la logica di pre-popolamento e la guardia tabella-vuota. `utenti-actions.test.ts` copre ora anche `creaUtente` come secondo writer di `Collaboratore`: le tre combinazioni di ruoli con i payload esatti di `utente.create`/`collaboratore.create`, l'assenza di scritture sugli esiti di rifiuto (nessun ruolo, partita IVA invalida, email duplicata) e la revalidate di entrambe le anagrafiche. Gli E2E di gestione utenti verificano che invalidazione e riattivazione risultino nell'anagrafica collaboratori, che l'accesso segua lo stato, e che il censimento con ruolo Collaboratore produca una riga coerente nell'anagrafica collaboratori più il primo accesso al calendario delle attività; `abilitazioni-collaboratore.spec.ts` verifica end-to-end abilitazione e revoca con collaboratori e offerte creati da factory. Confidenza alta sul comportamento osservato; ownership condivisa di `Utente` resta una boundary candidata da sottoporre a review.

## Concetti correlati

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Identità e accesso](/domains/identita-accesso.md), [Attività](/domains/attivita.md) e [Offerte](/domains/offerte.md), ed è disciplinata dalle decisioni [Abilitazioni esplicite collaboratore-offerta](/decisions/abilitazioni-offerte-esplicite.md) e [Ruoli combinabili derivati dal profilo collaboratore](/decisions/ruoli-combinabili-profilo-derivato.md).
