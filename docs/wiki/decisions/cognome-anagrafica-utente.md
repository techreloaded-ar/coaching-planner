---
type: decision
title: Cognome nella sezione anagrafica dell'utente
description: Rendere Utente autorevole per nome e cognome, mantenendo Collaboratore.nome/cognome come copie coordinate scritte dai writer transazionali
status: reviewed
decision_status: accepted
sources:
    - path: prisma/schema.prisma
      role: implementation
      symbol: Utente, Collaboratore
    - path: prisma/migrations/20260728135453_aggiungi_cognome_utente/migration.sql
      role: implementation
    - path: src/app/(back-office)/anagrafiche/utenti/actions.ts
      role: implementation
      symbol: creaUtente, aggiornaUtente
    - path: src/app/(back-office)/anagrafiche/collaboratori/actions.ts
      role: implementation
      symbol: aggiornaCollaboratore
    - path: src/domain/anagrafiche/valida-utente.ts
      role: implementation
      symbol: validaCensimentoUtente, validaModificaUtente
    - path: tests/unit/utenti-actions.test.ts
      role: verification
    - path: tests/unit/collaboratori-dal-actions.test.ts
      role: verification
    - path: tests/e2e/gestione-utenti.spec.ts
      role: verification
review:
    content_hash: sha256:c0bfdf78062e1e7a9b1ccef4d460e3488b2d376f7a96a132f7729f17fae8107c
    evidence_revision: 684073cbe95870736f7b37fbbe2fcccb01a7dd38
    evidence_hash: sha256:8737a9fc3a23309b56708499cbb530cb533fac274c1680a02a24b94a2001fc9d
    reviewed_at: "2026-07-31T15:56:35Z"
---
# Cognome nella sezione anagrafica dell'utente

<!-- archetipo:wiki section=context -->
## Contesto

US-048 richiede di introdurre il cognome come campo anagrafico distinto dell'utente, sia in creazione sia in modifica, per tutte le combinazioni di ruolo già previste da [Ruoli combinabili derivati dal profilo collaboratore](/decisions/ruoli-combinabili-profilo-derivato.md). Prima di questa spec `Utente.nome` era un campo unico composto (nome e cognome insieme), mentre `Collaboratore.nome`/`Collaboratore.cognome` esistevano già separati sul profilo operativo. Questa asimmetria non permetteva di rappresentare o validare il cognome in modo omogeneo per un Amministratore senza profilo Collaboratore, né di garantirne l'obbligatorietà indipendentemente dai ruoli selezionati. Occorreva decidere dove collocare la nuova fonte autorevole di nome e cognome e come farla convivere con le colonne già esistenti su `Collaboratore` senza introdurre disallineamenti tra le due schermate anagrafiche (utenti e collaboratori).

<!-- archetipo:wiki section=decision -->
## Decisione

`Utente` diventa la fonte autorevole di nome e cognome per ogni utente, indipendentemente dal ruolo: la colonna `Utente.cognome` è aggiunta come campo obbligatorio accanto a `Utente.nome`, validata da `validaCensimentoUtente` e `validaModificaUtente` sempre — anche quando è selezionato solo il ruolo Amministratore e non esiste alcun profilo Collaboratore. Le colonne `Collaboratore.nome`/`Collaboratore.cognome` restano al loro posto come copie coordinate, mantenute allineate dai writer transazionali invece di essere derivate a lettura: `creaUtente` scrive gli stessi valori su `Utente` e, se il ruolo Collaboratore è selezionato, sul nuovo `Collaboratore` creato nella stessa transazione; `aggiornaUtente` aggiorna sempre `Utente.nome`/`cognome` e, per ogni transizione di stato del profilo (creazione, riattivazione, disattivazione, nessuna transizione), propaga gli stessi valori al record `Collaboratore` esistente o appena creato, nella stessa transazione Serializable. Il flusso inverso è simmetrico: `aggiornaCollaboratore`, azione della schermata collaboratori, aggiorna `Collaboratore.nome`/`cognome` e propaga gli stessi valori a `Utente.nome`/`cognome` nella stessa transazione, cosicché entrambe le schermate possano modificare l'anagrafica restando reciprocamente coerenti. La migrazione `aggiungi_cognome_utente` aggiunge la colonna `Utente.cognome` nullable, la valorizza in backfill copiando `nome`/`cognome` dal profilo `Collaboratore` collegato quando esiste, effettua uno split sullo spazio del campo unico composto `Utente.nome` per gli utenti rimasti senza cognome (tipicamente un Amministratore privo di profilo), e infine rende la colonna `NOT NULL`.

<!-- archetipo:wiki section=alternatives -->
## Alternative

**Campo unico composto con parsing** (mantenere `Utente.nome` come campo unico e derivare il cognome via parsing quando serve, ad esempio dividendo sullo spazio): evita la migrazione dello schema, ma sposta su ogni consumatore l'onere di un parsing ambiguo e non invertibile per nomi composti o cognomi con più parole, e non permette di validare il cognome come campo indipendente in creazione e modifica. Scartata perché contraddice l'obiettivo della spec di avere un campo anagrafico esplicito e validato.

**Drop delle colonne `Collaboratore.nome`/`Collaboratore.cognome`** (derivare sempre nome e cognome del collaboratore da `Utente` tramite join, eliminando la duplicazione): architetturalmente più pulita, poiché elimina la doppia fonte di dati sullo stesso fatto. Scartata in questa spec per il costo di riscrivere tutte le query e le viste che oggi leggono `Collaboratore.nome`/`Collaboratore.cognome` direttamente (elenco e ordinamento collaboratori, righe attività, DAL) senza un beneficio immediato richiesto da US-048; il consolidamento resta un'evoluzione futura possibile una volta che tutti i lettori saranno stati verificati e migrati.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Nome e cognome del collaboratore restano duplicati tra `Utente` e `Collaboratore`, con `Utente` come unica fonte autorevole e `Collaboratore` come copia tenuta sincrona esclusivamente dai writer transazionali (`creaUtente`, `aggiornaUtente`, `aggiornaCollaboratore`): qualsiasi nuovo punto di scrittura di questi campi dovrà rispettare la stessa disciplina transazionale per non introdurre disallineamento. La duplicazione è controllata e accettata come costo per non aver dovuto migrare i lettori esistenti di `Collaboratore.nome`/`Collaboratore.cognome`. Il consolidamento verso una singola fonte a lettura (join da `Utente`, con eliminazione delle colonne su `Collaboratore`) resta possibile in futuro, come indicato dall'alternativa scartata.

<!-- archetipo:wiki section=verification -->
## Verifica

`tests/unit/utenti-actions.test.ts` verifica che `creaUtente` e `aggiornaUtente` richiedano il cognome indipendentemente dai ruoli selezionati (incluso il caso solo Amministratore), che lo propaghino correttamente al record `Collaboratore` in ciascuna delle transizioni di profilo (creazione, riattivazione, disattivazione, nessuna transizione con sola sincronizzazione anagrafica) e che i valori scritti su `Utente` e `Collaboratore` coincidano nella stessa operazione. `tests/unit/collaboratori-dal-actions.test.ts` verifica l'ordinamento per cognome delle liste collaboratori nel DAL e che `aggiornaCollaboratore` propaghi nome e cognome all'`Utente` associato nella stessa transazione, ignorando eventuali campi non di sua competenza come l'email. `tests/e2e/gestione-utenti.spec.ts` prova end-to-end, tramite utenti e collaboratori creati da factory secondo il contratto e2e del progetto, che il cognome sia richiesto e visibile in creazione e modifica per tutte le combinazioni di ruolo, incluso il messaggio di errore "Il cognome è obbligatorio" quando omesso e la coerenza del nome completo mostrato nelle schermate utenti e collaboratori dopo la promozione di un utente a ruolo Collaboratore.

## Concetti correlati

Questa decisione raffina il modello dati discusso in [Ruoli combinabili derivati dal profilo collaboratore](/decisions/ruoli-combinabili-profilo-derivato.md) e supporta i domini [Identità, sessioni e accesso](/domains/identita-accesso.md) e [Collaboratori](/domains/collaboratori.md). È collegata alla specifica US-048 del backlog di delivery (`.archetipo/backlog.yaml`).
