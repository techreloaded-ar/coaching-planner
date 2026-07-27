---
type: domain
title: Offerte
description: Impegni commerciali per cliente, budget in giornate e monitoraggio dell’avanzamento
status: reviewed
classification: candidate
sources:
    - path: src/app/(back-office)/anagrafiche/clienti/[id]/offerte/actions.ts
      role: inbound-commands
      symbol: creaOfferta, aggiornaOfferta
    - path: src/app/(back-office)/offerte/actions.ts
      role: inbound-commands
      symbol: cambiaStatoOfferta, eliminaOfferta
    - path: src/lib/offerte.ts
      role: application-query
      symbol: elencaOfferteConAvanzamento, elencaOffertePerClienteConAvanzamento
    - path: src/domain/anagrafiche/valida-offerta.ts
      role: domain-validation
    - path: src/domain/consuntivi/index.ts
      role: projection-calculation
      symbol: calcolaAvanzamentoOfferte
    - path: prisma/schema.prisma
      role: owned-data
      symbol: Offerta
    - path: src/lib/abilitazioni.ts
      role: outbound-consumer
      symbol: elencaOfferteAbilitabili
    - path: tests/unit/avanzamento-offerte.test.ts
      role: verification
    - path: tests/e2e/dettaglio-avanzamento-offerta.spec.ts
      role: verification
    - path: tests/e2e/dettaglio-avanzamento-offerta-cliente.spec.ts
      role: verification
review:
    content_hash: sha256:7c13c4808b87df225f8e8ce446798d42158e75a26d68d1b49f6d462277398378
    evidence_revision: 318a1e988d27789e979ab6c847c09cd3d4a71caa
    reviewed_at: "2026-07-27T09:41:32Z"
---
# Offerte

<!-- archetipo:wiki section=purpose -->
## Scopo

Gestisce gli impegni commerciali associati a un cliente: codice, descrizione, tariffa giornaliera, giornate previste e disponibilità per nuove attività. Offre anche una proiezione amministrativa dell'avanzamento rispetto al budget.

<!-- archetipo:wiki section=language -->
## Linguaggio

- **Offerta**: impegno commerciale identificato da codice nel perimetro di un cliente.
- **Giorni previsti**: budget dell'offerta.
- **Attiva**: offerta selezionabile per nuove righe attività.
- **Giornate erogate, residuo, percentuale di utilizzo**: misure derivate dalle ore fatturabili.
- **IN_CORSO, IN_ALLERTA, ESAURITA, OLTRE_BUDGET**: classificazioni calcolate, non lifecycle persistito.
- **Matrice mensile**: ripartizione delle giornate erogate per collaboratore e mese solare, con colonna e riga di totale; è parte della stessa proiezione di avanzamento, non uno stato persistito.
- **Abilitazione esplicita**: relazione persistita e revocabile tra un collaboratore e un'offerta, posseduta dalla capability Collaboratori, che determina quali collaboratori possono registrare nuove attività sull'offerta; si veda la decisione [Abilitazioni esplicite collaboratore-offerta](/decisions/abilitazioni-offerte-esplicite.md).

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede `Offerta`, i termini commerciali, il budget e il booleano `attiva`. Riferisce un cliente posseduto da Clienti. Le ore erogate appartengono alle attività; la vista di avanzamento è una proiezione calcolata e non modifica l'offerta. L'abilitazione esplicita che regola quali collaboratori possono operare su un'offerta è posseduta dalla capability Collaboratori (`AbilitazioneOfferta`); Offerte ne è solo il riferimento passivo tramite la relazione Prisma `abilitazioniCollaboratori` e non impone invarianti propri su quella tabella.

<!-- archetipo:wiki section=contracts -->
## Contratti

Le offerte possono essere create dalle viste annidate cliente o trasversali. La creazione richiede un cliente esistente e attivo. `offertaPerId`, `elencaOfferteConAvanzamento` ed `elencaOffertePerClienteConAvanzamento` sono riservate all'amministratore; le ultime due espongono percentuale di utilizzo, ripartizione per collaboratore e matrice mensile per collaboratore. La query annidata filtra offerte e attività per cliente e le ordina per codice. Le attività consumano solo offerte attive del cliente selezionato.

`elencaOfferteAbilitabili` in `src/lib/abilitazioni.ts` filtra le offerte attive prive di un'abilitazione per il collaboratore dato, usando la relazione Prisma `abilitazioniCollaboratori`; è una query dell'ambito Collaboratori che legge `Offerta` in sola lettura, senza scrivere né validare dati di questa capability.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. `creaOfferta` in `src/app/(back-office)/anagrafiche/clienti/[id]/offerte/actions.ts` valida termini e budget, verifica il cliente e crea il record assegnando esattamente `attiva: true`.
2. `aggiornaOfferta` nello stesso file aggiorna codice, descrizione, tariffa e giorni previsti senza assegnare `attiva`; il `clienteId` del form è usato per navigazione e non viene riscritto.
3. `cambiaStatoOfferta` in `src/app/(back-office)/offerte/actions.ts` assegna direttamente a `attiva` il booleano del form, senza guardia sullo stato sorgente.
4. `eliminaOfferta` nello stesso file conta prima le righe attività e traduce anche l'errore FK da concorrenza; in presenza di righe invita a disattivare. La cancellazione non è una transizione di stato.
5. `calcolaAvanzamentoOfferte` assegna una delle quattro classificazioni in base a residuo e soglia 85%. Non esiste una colonna `stato` né una write di transizione: ogni lettura ricalcola il valore.
6. La tabella trasversale `/offerte` e quella annidata nel dettaglio cliente espandono una riga per mostrare classificazione, KPI, percentuale e ripartizione; nell'elenco cliente il link Modifica non attiva il toggle. Il toggle di attivazione della tabella trasversale conserva la riga espansa attraverso il redirect. La precedente rotta `/report/avanzamento-offerte` reindirizza a `/offerte`.
7. Il pannello espanso mostra, sotto la ripartizione per collaboratore, una matrice mensile per collaboratore (una colonna per mese solare con attività, in ordine cronologico, colonna e riga di totale); per un'offerta senza attività mostra il messaggio "Nessuna attività registrata" al posto della matrice. Il componente è condiviso tra `/offerte` e l'elenco offerte del cliente, quindi la matrice compare in entrambe le viste.

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| UI annidata | `src/app/(back-office)/anagrafiche/clienti/[id]/offerte/**`, `src/app/(back-office)/anagrafiche/clienti/[id]/offerte-cliente-tabella.tsx` |
| UI trasversale e stato | `src/app/(back-office)/offerte/**` |
| Query | `src/lib/offerte.ts` |
| Validazione | `src/domain/anagrafiche/valida-offerta.ts` |
| Avanzamento | `src/domain/consuntivi/index.ts`, `src/lib/offerte.ts`, `src/app/(back-office)/offerte/dettaglio-avanzamento-offerta.tsx` |
| Dati | `prisma/schema.prisma` (`Offerta`; relazione inversa `abilitazioniCollaboratori` verso `AbilitazioneOfferta`, posseduta da Collaboratori) |
| Test | `tests/unit/offerte-dal-actions.test.ts`, `tests/unit/elenca-offerte-con-avanzamento.test.ts`, `tests/unit/avanzamento-offerte.test.ts`, `tests/e2e/anagrafica-offerte.spec.ts`, `tests/e2e/gestione-offerte.spec.ts`, `tests/e2e/dettaglio-avanzamento-offerta.spec.ts`, `tests/e2e/dettaglio-avanzamento-offerta-cliente.spec.ts` |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

Codice e descrizione sono obbligatori; tariffa positiva con massimo due decimali e giorni previsti interi positivi. Il database garantisce unicità `(codice, clienteId)` e le FK. Solo la creazione verifica che il cliente sia attivo: `cambiaStatoOfferta` può riattivare un'offerta di un cliente disattivato, anche se il front office continuerà a escluderla perché filtra anche i clienti. L'avanzamento (ripartizione per collaboratore e matrice mensile) usa esclusivamente ore fatturabili e la conversione fissa di 8 ore per giornata; include offerte senza attività. Le classificazioni di avanzamento sono temporanee e possono cambiare quando cambiano budget o attività. Il mese di ogni riga è derivato in UTC dalla data dell'attività, indipendentemente dal fuso del server.

<!-- archetipo:wiki section=verification -->
## Verifica

Unit test coprono validazione, DAL, eliminazione, calcolo e le query di avanzamento trasversale e filtrata per cliente; E2E coprono gestione, viste annidate e trasversali, inclusi i dettagli espandibili, la navigazione a Modifica dall'elenco cliente e il redirect della rotta dismessa. Confidenza alta sui flussi osservati. L'autonomia rispetto a Clienti è candidata: ha ciclo, decisioni e contratti propri, ma condivide storage e application layer. La relazione con le abilitazioni esplicite è verificata dai test della capability Collaboratori (`tests/unit/abilitazioni-dal-actions.test.ts`, `tests/e2e/abilitazioni-collaboratore.spec.ts`), non da test propri di Offerte.

## Concetti correlati

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Clienti](/domains/clienti.md), [Attività](/domains/attivita.md), [Fatturazione clienti](/domains/fatturazione-clienti.md) e [Collaboratori](/domains/collaboratori.md), ed è coinvolta dalla decisione [Abilitazioni esplicite collaboratore-offerta](/decisions/abilitazioni-offerte-esplicite.md).
