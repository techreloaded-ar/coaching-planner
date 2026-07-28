---
type: domain
title: Collaboratori
description: Profili professionali dei collaboratori, tariffa e abilitazione operativa
status: reviewed
classification: candidate
sources:
    - path: src/app/(back-office)/anagrafiche/collaboratori/actions.ts
      role: inbound-commands
      symbol: aggiornaCollaboratore
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
      symbol: creaUtente, aggiornaUtente
    - path: src/app/(back-office)/anagrafiche/utenti/utenti-tabella.tsx
      role: coordinated-administration-ui
    - path: src/app/(back-office)/anagrafiche/utenti/utente-form.tsx
      role: coordinated-administration-ui
    - path: prisma/schema.prisma
      role: owned-data
      symbol: Collaboratore
    - path: src/lib/abilitazioni.ts
      role: application-query
      symbol: elencaOfferteAbilitate, elencaOfferteAbilitabili, elencaCollaboratoriIngaggiati, elencaCollaboratoriIngaggiabili
    - path: src/app/(back-office)/anagrafiche/collaboratori/[id]/abilitazioni-actions.ts
      role: inbound-commands
      symbol: abilitaCollaboratoreSuOfferte, revocaAbilitazioneCollaboratore
    - path: src/app/(back-office)/offerte/[offertaId]/collaboratori/ingaggi-actions.ts
      role: inbound-commands
      symbol: ingaggiaCollaboratoriSuOfferta, revocaIngaggioCollaboratore
    - path: src/app/(back-office)/offerte/[offertaId]/collaboratori/page.tsx
      role: coordinated-administration-ui
    - path: src/app/(back-office)/offerte/[offertaId]/collaboratori/ingaggi-collaboratori.tsx
      role: coordinated-administration-ui
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
    - path: tests/unit/ingaggi-offerta-dal-actions.test.ts
      role: verification
    - path: tests/unit/backfill-abilitazioni-iniziali.test.ts
      role: verification
    - path: tests/unit/utenti-actions.test.ts
      role: verification
    - path: tests/unit/valida-utente.test.ts
      role: verification
    - path: tests/e2e/anagrafica-collaboratori.spec.ts
      role: verification
    - path: tests/e2e/gestione-utenti.spec.ts
      role: verification
    - path: tests/e2e/dettaglio-collaboratore.spec.ts
      role: verification
    - path: tests/e2e/abilitazioni-collaboratore.spec.ts
      role: verification
    - path: tests/e2e/ingaggi-offerta.spec.ts
      role: verification
review:
    content_hash: sha256:bbd30cd1f49858c31fde59fca3d3b5320001a604d9fd794c82073b6448034265
    evidence_revision: 1f92c244a79521a211e262f8d001137fded516b8
    evidence_hash: sha256:78df9091051e59aa2d1d2c1eca9043df43bc7ea9a35dd20da225b0809b70c723
    reviewed_at: "2026-07-28T10:45:24Z"
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

Possiede `Collaboratore`, la tariffa e il booleano `attivo`. Coordina la sincronizzazione del solo nome sul record `Utente` (da US-047 non tocca più l'email); ruolo, account provider, sessione ed email sono decisioni della capability Identità e accesso. L'invalidazione o riattivazione dell'utente è un comando di Identità e accesso che sincronizza nello stesso writer lo stato del profilo collegato. Le righe attività dipendono dall'identificativo collaboratore. Possiede anche `AbilitazioneOfferta`, l'abilitazione esplicita e revocabile che stabilisce su quali offerte il collaboratore può operare; riferisce le offerte possedute dalla capability Offerte senza modificarle.

`creaUtente` e `aggiornaUtente` (capability Identità e accesso) sono, da US-047, gli unici writer di creazione e cambio-stato di `Collaboratore`: l'anagrafica collaboratori non censisce né disattiva/riattiva più profili, ed espone solo `aggiornaCollaboratore` come writer dei dati di profilo (nome, cognome, partita IVA, tariffa). `creaUtente`, quando l'amministratore seleziona il ruolo Collaboratore nel censimento di un nuovo utente, crea il profilo con `attivo: true` nella stessa transazione dell'utente, riusando gli identici helper di validazione di partita IVA e tariffa (`validaCampoPartitaIva`, `validaCampoTariffaGiornaliera`, ora esportati da questo modulo). `aggiornaUtente` estende la stessa derivazione al ciclo di vita di un utente già censito: aggiungere il ruolo Collaboratore crea il profilo (se assente) o lo riattiva conservando partita IVA e tariffa (se disattivato); toglierlo lo disattiva, senza mai cancellarlo — vedi la decisione [Ruoli combinabili derivati dal profilo collaboratore](/decisions/ruoli-combinabili-profilo-derivato.md). Il ruolo di accesso "Collaboratore" resta comunque derivato dalla presenza e dallo stato del profilo, non da un flag distinto.

<!-- archetipo:wiki section=contracts -->
## Contratti

L'anagrafica collaboratori (`src/app/(back-office)/anagrafiche/collaboratori/`) non censisce più profili né ne cambia lo stato: da US-047 espone solo `aggiornaCollaboratore`, che sincronizza in transazione i dati di profilo (nome, cognome, partita IVA, tariffa) e il solo `Utente.nome` derivato, senza mai leggere né scrivere `Utente.email` — un valore email eventualmente presente nel FormData viene ignorato. Censimento, cambio di stato e modifica dell'email restano esclusivamente sotto la capability Identità e accesso, tramite `creaUtente`/`aggiornaUtente` e `cambiaStatoUtenteAction`. `creaUtente`, quando il ruolo Collaboratore è selezionato nel censimento utenti, crea nella stessa transazione utente e profilo (`attivo: true`) senza tentare alcun riuso: un'email già presente è sempre un errore di duplicato. `aggiornaUtente`, in modifica, calcola dai due checkbox di ruolo il nuovo ruolo e applica nella stessa transazione esattamente una delle quattro transizioni sul profilo esistente: crea (`attivo: true`, con i dati profilo raccolti dal form) se il ruolo Collaboratore viene aggiunto e il profilo è assente; riattiva (solo `attivo: true`, senza richiedere nuovamente i dati) se viene aggiunto e il profilo esiste disattivato; disattiva (`attivo: false`, mai una delete) se il ruolo Collaboratore viene tolto e il profilo è attivo; nessuna scrittura sul profilo negli altri casi. `cambiaStatoUtenteAction`, riservata all'amministratore, sincronizza il booleano richiesto sul profilo collegato nella stessa transazione dell'invalidazione o riattivazione di `Utente`. Il DAL espone `ATTIVO`, `ASSENTE` o `DISATTIVATO` come esiti derivati dalla presenza del profilo e dal booleano. `storicoAttivitaCollaboratore` in `src/lib/collaboratori.ts` è una query riservata all'amministratore che restituisce tutte le righe attività del collaboratore con cliente e offerta inclusi, ordinate per data crescente, senza filtro temporale.

`elencaOfferteAbilitate` ed `elencaOfferteAbilitabili` in `src/lib/abilitazioni.ts`, riservate all'amministratore, restituiscono rispettivamente le offerte già abilitate per il collaboratore (incluse quelle nel frattempo disattivate, con `offertaAttiva: false`) e le offerte attive non ancora abilitate, entrambe ordinate per ragione sociale del cliente e poi per codice offerta. `abilitaCollaboratoreSuOfferte` crea in blocco le coppie `(collaboratoreId, offertaId)` mancanti verificando prima che ciascuna offerta selezionata sia attiva, ignorando i duplicati grazie al vincolo unico; `revocaAbilitazioneCollaboratore` elimina la singola coppia bersaglio. Entrambe le action sono riservate all'amministratore e rivalidano la pagina di dettaglio del collaboratore.

`elencaCollaboratoriIngaggiati` ed `elencaCollaboratoriIngaggiabili`, nello stesso modulo, sono la vista speculare dal lato offerta sulla stessa tabella `AbilitazioneOfferta`: restituiscono rispettivamente i collaboratori già ingaggiati sull'offerta data, con nome, cognome ed email (inclusi quelli il cui profilo è nel frattempo disattivato, con `collaboratoreAttivo: false`), e i collaboratori attivi non ancora ingaggiati, entrambe ordinate per cognome e poi per nome. `ingaggiaCollaboratoriSuOfferta`, in `src/app/(back-office)/offerte/[offertaId]/collaboratori/ingaggi-actions.ts`, verifica prima che l'offerta esista e sia attiva, poi crea in blocco le coppie mancanti verificando che ciascun collaboratore selezionato sia attivo, ignorando i duplicati grazie allo stesso vincolo unico; `revocaIngaggioCollaboratore` elimina la singola coppia bersaglio. Entrambe le action sono riservate all'amministratore e rivalidano sia la pagina offerta sia il dettaglio di ogni collaboratore toccato, cosicché le due viste sulla stessa relazione restano coerenti per costruzione.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. `creaUtente` in `src/app/(back-office)/anagrafiche/utenti/actions.ts` è l'unico percorso di censimento: quando l'amministratore seleziona il ruolo Collaboratore nel censimento, la transazione crea `Utente` (ruolo `AMMINISTRATORE` o `COLLABORATORE` secondo i checkbox selezionati) e, in aggiunta, `Collaboratore` con `attivo: true`, componendo `Utente.nome` come `"{nome} {cognome}"`. Non riusa mai un utente esistente: un'email già presente produce sempre l'esito di duplicato senza scritture.
2. `aggiornaUtente` nello stesso file, in modifica, legge utente e profilo fuori transazione per decidere se i campi profilo sono richiesti (`validaModificaUtente` con `profiloPresente`), poi nella transazione aggiorna `Utente` (incluso l'unico punto di scrittura di `Utente.email`) e applica sul profilo esattamente una transizione: crea (`attivo: true`, componendo `Utente.nome` come in creazione) se il ruolo Collaboratore è aggiunto senza profilo preesistente; riattiva (solo `attivo: true`) se il profilo esiste disattivato; disattiva (`attivo: false`) se il ruolo Collaboratore è tolto e il profilo era attivo; nessuna scrittura sul profilo se lo stato richiesto coincide con quello attuale. La protezione dell'ultimo amministratore attivo si applica al ruolo derivato dai checkbox esattamente come prima di US-046. Rivalida l'anagrafica utenti sempre e quella collaboratori solo quando il profilo è stato toccato.
3. `aggiornaCollaboratore` in `src/app/(back-office)/anagrafiche/collaboratori/actions.ts` — unica action esposta da questo modulo da US-047 — aggiorna nella stessa transazione profilo (nome, cognome, partita IVA, tariffa) e il solo `Utente.nome` derivato, senza mai leggere né scrivere `Utente.email`, senza cambiare `attivo` o `ruolo`. Un valore `email` eventualmente presente nel FormData viene ignorato, non validato: la validazione email non esiste più in questo modulo (`RE_EMAIL` e il campo `email` sono stati rimossi da `valida-collaboratore.ts`). Censimento (`creaCollaboratore`) e cambio di stato (`cambiaStatoCollaboratore`, con l'adapter `cambia-stato-action.ts`) sono stati rimossi da US-047: l'UI dell'anagrafica collaboratori non offre più un percorso per crearli o disattivarli/riattivarli — `/anagrafiche/collaboratori/nuovo` reindirizza l'amministratore a `/anagrafiche/utenti`, e l'elenco/la modifica mostrano lo stato attivo/disattivato in sola lettura.
4. L'invalidazione di `Utente` scrive `false` anche in `Collaboratore.attivo` se il profilo è presente; la riattivazione scrive `true` su entrambi. Senza profilo non viene tentata la cascata. Il comando rivalida elenco utenti e collaboratori e non elimina attività o record.
5. `risolviProfiloCollaboratoreCorrente` in `src/lib/dal.ts` produce `ASSENTE`, `DISATTIVATO` o `ATTIVO` mediante branch di lettura: sono esiti derivati, non stati persistiti separatamente.
6. La pagina di dettaglio `src/app/(back-office)/anagrafiche/collaboratori/[id]/page.tsx`, riservata all'amministratore e raggiungibile dal click sulla riga dell'elenco, mostra il profilo e lo storico completo delle attività: legge le righe via `storicoAttivitaCollaboratore` e le raggruppa per mese solare decrescente con la funzione pura `raggruppaAttivitaPerMese` di `src/domain/consuntivi/index.ts`, esponendo per ogni mese totale ore e giornate equivalenti (8 ore/giornata); senza righe mostra un messaggio esplicito di assenza di attività.
7. Nella stessa pagina di dettaglio, la sezione "Offerte abilitate" (`abilitazioni-offerte.tsx`) elenca le abilitazioni correnti del collaboratore e apre un dialog di ricerca e selezione multipla sulle offerte abilitabili; la conferma invoca `abilitaCollaboratoreSuOfferte`, che assegna esattamente le coppie mancanti in `AbilitazioneOfferta`, mentre la revoca di una singola riga invoca `revocaAbilitazioneCollaboratore`, che elimina esattamente la coppia bersaglio. Nessuna delle due action modifica le righe attività già registrate.
8. `scripts/backfill-abilitazioni-iniziali.ts` pre-popola una tantum `AbilitazioneOfferta` dalle coppie `(collaboratoreId, offertaId)` distinte già presenti in `RigaAttivita` su offerte attive, dietro una guardia che salta la scrittura se la tabella contiene già almeno una riga. È invocabile manualmente con `npm run db:backfill-abilitazioni` e viene eseguito automaticamente da `prisma/seed.ts` negli ambienti di sviluppo/test (vedi la decisione [Abilitazioni esplicite collaboratore-offerta](/decisions/abilitazioni-offerte-esplicite.md)).
9. La pagina `/offerte/{offertaId}/collaboratori`, fisicamente sotto la rotta Offerte ma di proprietà di questa capability perché opera su `AbilitazioneOfferta`, mostra la tabella "Collaboratori ingaggiati" (nome, cognome, pill di stato Attivo/Disattivato dal profilo) e un dialog di ricerca e selezione multipla sui collaboratori ingaggiabili; è raggiunta da un link "Collaboratori" aggiunto alla colonna Azioni di `offerte-tabella.tsx`. È la vista speculare della sezione "Offerte abilitate" del dettaglio collaboratore (stessa tabella, stesso modello di autorizzazione): ingaggio e revoca da questa pagina rivalidano anche il dettaglio di ogni collaboratore toccato, così le due viste restano coerenti.

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| UI e comandi | `src/app/(back-office)/anagrafiche/collaboratori/**`, inclusa la pagina di dettaglio `[id]/page.tsx` con storico attività mensile e la sezione `[id]/abilitazioni-offerte.tsx` con dialog di ricerca e selezione multipla; `utenti/cambia-stato-utente-action.ts` per la cascata da utente; `utenti/actions.ts` (`creaUtente`, `aggiornaUtente`), `utenti/utente-form.tsx` (fieldset a checkbox condiviso fra creazione e modifica) e `utenti/utenti-tabella.tsx` (badge multipli) per la creazione e modifica combinate e la loro rappresentazione nell'elenco utenti; `src/app/(back-office)/offerte/[offertaId]/collaboratori/page.tsx` e `ingaggi-collaboratori.tsx`, vista speculare dal lato offerta, fisicamente ospitata sotto la rotta Offerte |
| Query | `src/lib/collaboratori.ts` (inclusa `storicoAttivitaCollaboratore`), `src/lib/abilitazioni.ts` (`elencaOfferteAbilitate`, `elencaOfferteAbilitabili`, `elencaCollaboratoriIngaggiati`, `elencaCollaboratoriIngaggiabili`) |
| Action abilitazioni | `[id]/abilitazioni-actions.ts` (`abilitaCollaboratoreSuOfferte`, `revocaAbilitazioneCollaboratore`); `offerte/[offertaId]/collaboratori/ingaggi-actions.ts` (`ingaggiaCollaboratoriSuOfferta`, `revocaIngaggioCollaboratore`), vista speculare dal lato offerta sulla stessa tabella |
| Validazione | `src/domain/anagrafiche/valida-collaboratore.ts`, `src/domain/anagrafiche/valida-utente.ts` (`validaCensimentoUtente`, `validaModificaUtente`, obbligo condizionale dei campi profilo) |
| Dati | `prisma/schema.prisma` (`Collaboratore`, relazione con `Utente`; `AbilitazioneOfferta`, coppia unica `collaboratoreId`/`offertaId` con `Offerta`) |
| Pre-popolamento una tantum | `scripts/backfill-abilitazioni-iniziali.ts`, esposto da `npm run db:backfill-abilitazioni` e agganciato a `prisma/seed.ts` |
| Policy consumatrici | `src/lib/dal.ts`, `src/lib/attivita.ts` |
| Test | `tests/unit/collaboratori-dal-actions.test.ts`, `tests/unit/cambia-stato-utente.test.ts`, `tests/unit/valida-collaboratore.test.ts`, `tests/unit/storico-attivita-mensile.test.ts`, `tests/unit/abilitazioni-dal-actions.test.ts`, `tests/unit/ingaggi-offerta-dal-actions.test.ts`, `tests/unit/backfill-abilitazioni-iniziali.test.ts`, `tests/unit/utenti-actions.test.ts`, `tests/unit/valida-utente.test.ts`, `tests/e2e/anagrafica-collaboratori.spec.ts`, `tests/e2e/dettaglio-collaboratore.spec.ts`, `tests/e2e/abilitazioni-collaboratore.spec.ts`, `tests/e2e/ingaggi-offerta.spec.ts`, `tests/e2e/gestione-utenti.spec.ts` |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

Nome, cognome, partita IVA e tariffa sono obbligatori lato applicazione in `aggiornaCollaboratore`; partita IVA ha controllo di formato e la tariffa deve essere positiva con massimo due decimali. L'email non è più un campo di questo modulo: `validaCollaboratore` non la valida né la richiede (rimossa da `DatiCollaboratoreInput` insieme a `RE_EMAIL`), e `aggiornaCollaboratore` non la legge né la scrive, anche se presente nel FormData inviato. `Utente.email`, obbligatoria e con controllo di formato, resta un invariante della capability Identità e accesso, unica insieme a `Collaboratore.userId` a database. La disattivazione è reversibile e non cancella attività. L'invalidazione e la riattivazione dell'utente mantengono allineato il profilo esistente nella stessa transazione, rispettivamente con `false` e `true`; non viene registrata l'origine della disattivazione del profilo. Per un utente di ruolo `COLLABORATORE`, un profilo presente ma disattivato rende la sessione non risolvibile dal DAL; un amministratore conserva la sessione ma non può usare quel profilo per consuntivare. La coppia `(collaboratoreId, offertaId)` è unica a database su `AbilitazioneOfferta`: creazione e revoca sono entrambe idempotenti. Un'offerta abilitata resta elencata anche se successivamente disattivata, ma solo le offerte attive compaiono tra quelle abilitabili nel dialog di ricerca. La revoca non cancella né altera le righe attività già registrate su quell'offerta.

<!-- archetipo:wiki section=verification -->
## Verifica

Test unitari coprono transazioni, duplicati e guardie. `collaboratori-dal-actions.test.ts` copre ora solo `aggiornaCollaboratore` (censimento e cambio stato sono stati rimossi dal modulo con i relativi describe): il payload esatto di `utente.update` con `{ nome }` e nessuna chiave `email`, incluso il caso in cui il FormData contiene comunque un valore email — deve essere ignorato senza propagarsi alla scrittura. `valida-collaboratore.test.ts` non copre più il campo email, rimosso dal contratto di validazione. `cambia-stato-utente.test.ts` verifica la cascata atomica da invalidazione/riattivazione utente al profilo, incluso il caso senza profilo. `abilitazioni-dal-actions.test.ts` copre le query e le action di abilitazione/revoca, inclusi idempotenza e rifiuto di offerte non attive; `backfill-abilitazioni-iniziali.test.ts` copre la logica di pre-popolamento e la guardia tabella-vuota. `utenti-actions.test.ts` copre ora anche `creaUtente` e `aggiornaUtente` come secondo e terzo writer di `Collaboratore`: le tre combinazioni di ruoli con i payload esatti di `utente.create`/`collaboratore.create` in creazione; le quattro transizioni di profilo (creazione, riattivazione, disattivazione, nessuna scrittura) con i payload esatti di `collaboratore.create`/`collaboratore.update` in modifica, la revalidate condizionale dell'anagrafica collaboratori e la protezione dell'ultimo amministratore applicata al ruolo derivato dai checkbox; l'assenza di scritture sugli esiti di rifiuto (nessun ruolo, partita IVA invalida, email duplicata) in entrambi i flussi. `valida-utente.test.ts` copre `validaCensimentoUtente` e `validaModificaUtente`, incluso l'obbligo condizionale dei campi profilo. Gli E2E di gestione utenti verificano che invalidazione e riattivazione risultino nell'anagrafica collaboratori, che l'accesso segua lo stato, che il censimento con ruolo Collaboratore produca una riga coerente nell'anagrafica collaboratori più il primo accesso al calendario delle attività, e che aggiungere o togliere il ruolo Collaboratore su un utente esistente crei, riattivi o disattivi il profilo conservando lo storico attività e senza richiedere nuovamente i dati già noti alla riattivazione; `abilitazioni-collaboratore.spec.ts` verifica end-to-end abilitazione e revoca con collaboratori e offerte creati da factory. `ingaggi-offerta-dal-actions.test.ts` copre, con lo stesso stile di mock, i contratti esatti delle query e delle action speculari dal lato offerta (filtri, ordinamenti, payload di `createMany`/`deleteMany`, assenza di scritture sugli esiti di rifiuto, guardia di ruolo, revalidate di entrambe le pagine); `ingaggi-offerta.spec.ts` verifica end-to-end il flusso di ingaggio e revoca dalla pagina offerta e la sua ricaduta coerente sul dettaglio dei due collaboratori coinvolti. Confidenza alta sul comportamento osservato; ownership condivisa di `Utente` resta una boundary candidata da sottoporre a review.

## Concetti correlati

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Identità e accesso](/domains/identita-accesso.md), [Attività](/domains/attivita.md) e [Offerte](/domains/offerte.md), ed è disciplinata dalle decisioni [Abilitazioni esplicite collaboratore-offerta](/decisions/abilitazioni-offerte-esplicite.md) e [Ruoli combinabili derivati dal profilo collaboratore](/decisions/ruoli-combinabili-profilo-derivato.md).
