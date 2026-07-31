---
type: domain
title: Politiche di rimborso trasferta
description: Configurazione globale delle voci di rimborso trasferta a etichetta libera e importo forfettario
status: generated
classification: candidate
sources:
    - path: src/app/(back-office)/anagrafiche/voci-rimborso/actions.ts
      role: inbound-commands
      symbol: creaVoceRimborso, aggiornaVoceRimborso, eliminaVoceRimborso
    - path: src/domain/anagrafiche/valida-voce-rimborso.ts
      role: domain-validation
      symbol: validaVoceRimborso
    - path: src/lib/voci-rimborso.ts
      role: application-query
      symbol: elencaVociRimborso, vocePerId
    - path: prisma/schema.prisma
      role: owned-data
      symbol: VoceRimborsoTrasferta
    - path: tests/unit/valida-voce-rimborso.test.ts
      role: verification
    - path: tests/unit/voci-rimborso-dal-actions.test.ts
      role: verification
    - path: tests/e2e/anagrafica-voci-rimborso.spec.ts
      role: verification
---
# Politiche di rimborso trasferta

<!-- archetipo:wiki section=purpose -->
## Scopo

Consente all'amministratore di configurare l'elenco globale delle voci di rimborso trasferta riconosciute, ciascuna con un'etichetta libera e un importo forfettario. Non esiste alcun criterio di applicabilità automatica: la voce viene scelta manualmente dal collaboratore quando compila la riga attività. La collocazione UI sotto Anagrafiche è fisica; semanticamente il dato governa i rimborsi usati in attività e fatturazione.

<!-- archetipo:wiki section=language -->
## Linguaggio

- **Voce di rimborso trasferta**: coppia etichetta/importo, configurata globalmente e proposta in scelta al collaboratore.
- **Etichetta**: testo libero che descrive la voce, unico riferimento leggibile per chi la seleziona.
- **Importo forfettario**: valore riconosciuto dalla voce, indipendente da qualsiasi grandezza misurata sulla trasferta.

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede la configurazione globale `VoceRimborsoTrasferta`. Non possiede alcun algoritmo di selezione, perché la voce è scelta dal collaboratore e non calcolata dal sistema. Non possiede la riga attività né i report che consumano il rimborso.

<!-- archetipo:wiki section=contracts -->
## Contratti

Le Server Action amministrative `creaVoceRimborso`, `aggiornaVoceRimborso` ed `eliminaVoceRimborso` creano, aggiornano ed eliminano voci; sono tutte protette da `richiediRuoloApi("AMMINISTRATORE")`. `elencaVociRimborso()` restituisce le voci ordinate per data di creazione crescente e `vocePerId(id)` restituisce la singola voce, entrambe con la stessa guardia di ruolo. Non esiste alcuna funzione di calcolo del rimborso: al salvataggio la riga attività fotografa etichetta e importo della voce scelta nei propri campi `rimborsoTrasfertaEtichetta` e `rimborsoTrasfertaImporto`, come descritto in [Fotografia del rimborso trasferta](/decisions/fotografia-rimborso-trasferta.md).

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. Creazione e modifica validano soltanto etichetta e importo con `validaVoceRimborso`; non esiste alcun controllo di sovrapposizione o di unicità, né applicativo né a database, quindi due voci possono avere la stessa etichetta o lo stesso importo.
2. Le due action, superata la validazione, normalizzano l'importo e scrivono su `VoceRimborsoTrasferta`, poi invalidano `/anagrafiche/voci-rimborso` e reindirizzano con un esito in query string.
3. La validazione è una funzione pura che restituisce una mappa campo → messaggio; una mappa vuota significa dati accettati. Non descrive stati di un'entità.
4. L'eliminazione è fisica ed è sempre consentita, senza alcun controllo preventivo: le righe attività non referenziano la voce con una foreign key, quindi la rimozione non lascia riferimenti pendenti e non altera nulla di già registrato.

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| UI e comandi | `src/app/(back-office)/anagrafiche/voci-rimborso/**` |
| Query | `src/lib/voci-rimborso.ts` |
| Validazione | `src/domain/anagrafiche/valida-voce-rimborso.ts` |
| Dati | `prisma/schema.prisma` (`VoceRimborsoTrasferta`) |
| Test | `tests/unit/valida-voce-rimborso.test.ts`, `tests/unit/voci-rimborso-dal-actions.test.ts`, `tests/e2e/anagrafica-voci-rimborso.spec.ts` |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

L'etichetta è obbligatoria e non può essere composta di soli spazi; l'importo è obbligatorio, deve essere maggiore di zero e ammette al massimo due decimali. Non esiste alcun vincolo di unicità: la configurazione è un elenco piatto, e l'ordine mostrato è quello di creazione. Una modifica o un'eliminazione della configurazione non altera più riepiloghi e report storici, perché ogni riga attività conserva la propria copia di etichetta e importo al momento del salvataggio; la configurazione influenza solo le righe salvate da quel momento in poi.

<!-- archetipo:wiki section=verification -->
## Verifica

Test unitari coprono la validazione pura (`tests/unit/valida-voce-rimborso.test.ts`) e le Server Action con le loro guardie di ruolo (`tests/unit/voci-rimborso-dal-actions.test.ts`); il test E2E `tests/e2e/anagrafica-voci-rimborso.spec.ts` copre la gestione amministrativa delle voci. Confidenza alta. La capability resta candidata perché condivide moduli e storage con le altre slice.

## Concetti correlati

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Attività](/domains/attivita.md) e [Fatturazione clienti](/domains/fatturazione-clienti.md). La conservazione del rimborso sulla riga attività è motivata in [Fotografia del rimborso trasferta](/decisions/fotografia-rimborso-trasferta.md).
