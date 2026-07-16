---
id: domains.offerte
type: domain
summary: Impegni commerciali per cliente, budget in giornate e monitoraggio dell'avanzamento
status: reviewed
classification: candidate
links:
    - id: architecture.context-map
      relation: participates-in
    - id: domains.clienti
      relation: references-client
    - id: domains.attivita
      relation: supplies-engagement-reference
    - id: domains.fatturazione-clienti
      relation: supplies-commercial-rates
sources:
    - path: src/app/(back-office)/anagrafiche/clienti/[id]/offerte/actions.ts
      role: inbound-commands
      symbol: creaOfferta, aggiornaOfferta
    - path: src/app/(back-office)/offerte/actions.ts
      role: inbound-commands
      symbol: cambiaStatoOfferta, eliminaOfferta
    - path: src/lib/offerte.ts
      role: application-query
      symbol: elencaOfferteConAvanzamento
    - path: src/domain/anagrafiche/valida-offerta.ts
      role: domain-validation
    - path: src/domain/consuntivi/index.ts
      role: projection-calculation
      symbol: calcolaAvanzamentoOfferte
    - path: prisma/schema.prisma
      role: owned-data
      symbol: Offerta
    - path: tests/unit/avanzamento-offerte.test.ts
      role: verification
    - path: tests/e2e/dettaglio-avanzamento-offerta.spec.ts
      role: verification
review:
    content_hash: sha256:86dd469fc172f3ee0e69a2b114c2da94decd9b3ead4b2705e50a12efa72582ce
    evidence_revision: d5a7bbe7cd96e946dce2920672fc29c1779b4e9b
    reviewed_at: "2026-07-16T17:30:56Z"
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

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede `Offerta`, i termini commerciali, il budget e il booleano `attiva`. Riferisce un cliente posseduto da Clienti. Le ore erogate appartengono alle attività; la vista di avanzamento è una proiezione calcolata e non modifica l'offerta.

<!-- archetipo:wiki section=contracts -->
## Contratti

Le offerte possono essere create dalle viste annidate cliente o trasversali. La creazione richiede un cliente esistente e attivo. `elencaOffertePerCliente`, `offertaPerId` ed `elencaOfferteConAvanzamento` sono riservate all'amministratore; quest'ultima espone anche percentuale di utilizzo e ripartizione per collaboratore, per mostrare l'avanzamento direttamente nella tabella Offerte. Le attività consumano solo offerte attive del cliente selezionato.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. La creazione valida termini e budget, verifica il cliente e scrive `Offerta.attiva = true`.
2. La modifica aggiorna codice, descrizione, tariffa e giorni previsti; il `clienteId` del form è usato per navigazione, non viene riscritto.
3. Il comando di stato assegna direttamente a `attiva` il booleano del form, senza guardia sullo stato sorgente.
4. L'eliminazione conta prima le righe attività e traduce anche l'errore FK da concorrenza; in presenza di righe invita a disattivare.
5. `calcolaAvanzamentoOfferte` assegna una delle quattro classificazioni in base a residuo e soglia 85%. Non esiste una colonna `stato` né una write di transizione: ogni lettura ricalcola il valore.
6. La tabella trasversale `/offerte` espande una riga per mostrare classificazione, KPI, percentuale e ripartizione; il toggle di attivazione conserva la riga espansa attraverso il redirect. La precedente rotta `/report/avanzamento-offerte` reindirizza a `/offerte`.

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| UI annidata | `src/app/(back-office)/anagrafiche/clienti/[id]/offerte/**` |
| UI trasversale e stato | `src/app/(back-office)/offerte/**` |
| Query | `src/lib/offerte.ts` |
| Validazione | `src/domain/anagrafiche/valida-offerta.ts` |
| Avanzamento | `src/domain/consuntivi/index.ts`, `src/lib/offerte.ts`, `src/app/(back-office)/offerte/dettaglio-avanzamento-offerta.tsx` |
| Dati | `prisma/schema.prisma` (`Offerta`) |
| Test | `tests/unit/offerte-dal-actions.test.ts`, `tests/unit/avanzamento-offerte.test.ts`, `tests/e2e/anagrafica-offerte.spec.ts`, `tests/e2e/gestione-offerte.spec.ts` |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

Codice e descrizione sono obbligatori; tariffa positiva con massimo due decimali e giorni previsti interi positivi. Il database garantisce unicità `(codice, clienteId)` e le FK. Solo la creazione verifica che il cliente sia attivo. L'avanzamento usa esclusivamente ore fatturabili e la conversione fissa di 8 ore per giornata; include offerte senza attività. Le classificazioni di avanzamento sono temporanee e possono cambiare quando cambiano budget o attività.

<!-- archetipo:wiki section=verification -->
## Verifica

Unit test coprono validazione, DAL, eliminazione, calcolo ed esposizione dell'avanzamento; E2E coprono gestione, viste annidate e trasversali, incluso il dettaglio espandibile e il redirect della rotta dismessa. Confidenza alta sui flussi osservati. L'autonomia rispetto a Clienti è candidata: ha ciclo, decisioni e contratti propri, ma condivide storage e application layer.
