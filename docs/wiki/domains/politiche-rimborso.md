---
type: domain
title: Politiche di rimborso trasferta
description: Configurazione globale delle fasce chilometriche e calcolo del rimborso trasferta
status: generated
classification: candidate
sources:
    - path: src/app/(back-office)/anagrafiche/scaglioni/actions.ts
      role: inbound-commands
      symbol: creaScaglione, aggiornaScaglione, eliminaScaglione
    - path: src/domain/anagrafiche/valida-scaglione.ts
      role: domain-validation
    - path: src/domain/consuntivi/index.ts
      role: policy-calculation
      symbol: calcolaRimborsoTrasferta
    - path: src/lib/scaglioni.ts
      role: application-query
    - path: prisma/schema.prisma
      role: owned-data
      symbol: ScaglioneKm
    - path: tests/unit/rimborso-trasferta.test.ts
      role: verification
---
# Politiche di rimborso trasferta

<!-- archetipo:wiki section=purpose -->
## Scopo

Consente all'amministratore di configurare fasce chilometriche globali e importi forfettari, poi seleziona la prima fascia che copre la distanza di una trasferta. La collocazione UI sotto Anagrafiche è fisica; semanticamente il dato governa rimborsi usati in attività e fatturazione.

<!-- archetipo:wiki section=language -->
## Linguaggio

- **Scaglione chilometrico**: coppia soglia massima/importo.
- **Fino a km**: limite inclusivo della fascia.
- **Importo forfettario**: rimborso della fascia.
- **OK, NESSUNO_SCAGLIONE, OLTRE_SOGLIA**: esiti del calcolo, non stati persistiti.

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede la configurazione globale `ScaglioneKm` e l'algoritmo di selezione della fascia. Non possiede la distanza registrata sulla riga attività né i report che consumano il rimborso.

<!-- archetipo:wiki section=contracts -->
## Contratti

Le Server Action amministrative creano, aggiornano ed eliminano scaglioni. `elencaScaglioni` restituisce le soglie ordinate. `calcolaRimborsoTrasferta(km, scaglioni)` accetta una distanza e una lista serializzabile e restituisce un esito con importo e fascia quando applicabile.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. Creazione e modifica validano soglia/importo, controllano duplicati in memoria e si appoggiano anche al vincolo unico del database.
2. Il calcolo ordina una copia delle soglie, assegna `NESSUNO_SCAGLIONE` con lista vuota, `OLTRE_SOGLIA` oltre il massimo, oppure `OK` con la prima soglia `>= km`.
3. Questi valori sono rami di risultato di una funzione pura; non dimostrano transizioni di un'entità.
4. L'eliminazione è fisica e non ha FK verso attività, che conservano soltanto i chilometri.

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| UI e comandi | `src/app/(back-office)/anagrafiche/scaglioni/**` |
| Query | `src/lib/scaglioni.ts`, `src/lib/attivita.ts` |
| Validazione | `src/domain/anagrafiche/valida-scaglione.ts` |
| Calcolo | `src/domain/consuntivi/index.ts` |
| Dati | `prisma/schema.prisma` (`ScaglioneKm`) |
| Test | `tests/unit/valida-scaglione.test.ts`, `tests/unit/rimborso-trasferta.test.ts`, `tests/e2e/anagrafica-scaglioni.spec.ts`, `tests/e2e/trasferta-rimborso-validazione.spec.ts` |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

Soglia e importo devono essere positivi; la soglia è un intero e l'importo ha massimo due decimali. `finoAKm` è unico a database. Il messaggio applicativo parla di soglie che non si sovrappongono, ma l'enforcement osservato impedisce solo soglie massime uguali; gli intervalli sono impliciti nell'ordinamento. Se una configurazione cambia, riepiloghi e report storici vengono ricalcolati con i valori correnti perché non esiste uno snapshot del rimborso.

<!-- archetipo:wiki section=verification -->
## Verifica

Test unitari coprono validazioni e rami del calcolo; test E2E coprono gestione e rifiuto di distanze non rimborsabili. Confidenza alta. La capability resta candidata perché condivide moduli e storage con le altre slice.

## Concetti correlati

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Attività](/domains/attivita.md) e [Fatturazione clienti](/domains/fatturazione-clienti.md).
