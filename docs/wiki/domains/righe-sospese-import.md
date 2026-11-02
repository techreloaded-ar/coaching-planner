---
type: domain
title: Righe sospese dell'import Excel
description: Righe di pianificazione che l'import Excel non ha abbinato alle anagrafiche, conservate grezze e marcate come risolte dall'amministratore
status: generated
classification: candidate
sources:
    - path: src/app/(back-office)/righe-sospese/actions.ts
      role: inbound-commands
      symbol: cambiaRisoluzioneRigheSospeseAction
    - path: src/lib/righe-sospese.ts
      role: application-query
      symbol: elencaRigheSospese
    - path: src/domain/righe-sospese/index.ts
      role: supporting-domain
      symbol: DESCRIZIONE_MOTIVO_SOSPENSIONE, leggiFiltroRigheSospese, parametriFiltroRigheSospese
    - path: src/app/(back-office)/righe-sospese/righe-sospese-tabella.tsx
      role: inbound-ui
    - path: prisma/schema.prisma
      role: owned-data
      symbol: RigaAttivitaSospesa, MotivoSospensione
    - path: tests/unit/righe-sospese-actions.test.ts
      role: verification
    - path: tests/unit/righe-sospese.test.ts
      role: verification
    - path: tests/e2e/righe-sospese.spec.ts
      role: verification
---
# Righe sospese dell'import Excel

<!-- archetipo:wiki section=purpose -->
## Scopo

Un import iniziale da Excel ricarica utenti, clienti, offerte e righe attività su un database vuoto, ma il foglio di pianificazione cita collaboratori, clienti e codici offerta che i fogli anagrafici non contengono. L'import non prende decisioni sulle anagrafiche e non si ferma: una riga che combacia con collaboratore, cliente e offerta censiti diventa `RigaAttivita`, le altre restano così come sono nell'Excel in `RigaAttivitaSospesa`, con il motivo. L'amministratore le consulta dal back-office, le sistema fuori dall'applicazione (censimento manuale, correzione dell'Excel, reimport) e le marca come risolte.

<!-- archetipo:wiki section=language -->
## Linguaggio

- **Riga sospesa**: riga del foglio di pianificazione non importata, con i valori grezzi dell'Excel.
- **Motivo di sospensione**: il primo problema riscontrato, nell'ordine `COLLABORATORE_SCONOSCIUTO`, `CLIENTE_SCONOSCIUTO`, `OFFERTA_SCONOSCIUTA`, `OFFERTA_ALTRO_CLIENTE`, `DATI_NON_VALIDI`. Risolto quello, un reimport fa emergere l'eventuale successivo.
- **Aperta / risolta**: `risoltaIl` nullo o valorizzato; è l'unico dato che l'amministratore modifica.

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede `RigaAttivitaSospesa` e l'enum `MotivoSospensione`. I campi descrittivi (`collaboratore`, `data`, `cliente`, `codiceOfferta`, `ore`, `tipologiaFatturazione`) sono stringhe facoltative senza foreign key: devono poter contenere qualsiasi valore dell'Excel. `data` è normalizzata in `YYYY-MM-DD` quando leggibile, altrimenti grezza. La `nota` (ad esempio il cliente su cui esiste il codice offerta, per `OFFERTA_ALTRO_CLIENTE`) è scritta dall'import e per ora non è mostrata. Non possiede le anagrafiche né `RigaAttivita`.

<!-- archetipo:wiki section=contracts -->
## Contratti

`elencaRigheSospese({ pagina, filtro })` restituisce una pagina di righe (senza `nota`) filtrate per stato (`aperte` predefinito, `risolte`, `tutte`) e motivo, più il conteggio delle righe aperte indipendente dai filtri. `cambiaRisoluzioneRigheSospeseAction` riceve un campo `id` per riga e `risolta` (`"true"`/`"false"`): valorizza `risoltaIl` solo sulle righe ancora aperte (una riga già risolta conserva la data originale) oppure lo azzera sulle righe risolte. Entrambi richiedono `AMMINISTRATORE`; la rotta `/righe-sospese` è nei prefissi di back-office della policy di rotta. Le descrizioni leggibili dei motivi stanno in `DESCRIZIONE_MOTIVO_SOSPENSIONE`, un `Record<MotivoSospensione, string>` sul tipo generato da Prisma: la build fallisce se un nuovo motivo resta senza descrizione.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. La pagina `Righe sospese` (menu Gestione) mostra in testa il numero di righe aperte e, nella tabella paginata, collaboratore, data, cliente, codice offerta, ore, tipologia di fatturazione e motivo; le righe risolte hanno il chip «Risolta il …».
2. Con una o più righe selezionate la barra contestuale di `ElencoSelezionabile` offre «Segna come risolte» per le aperte e «Segna come da risolvere» per le risolte; dopo l'azione la pagina si aggiorna e la selezione si azzera.
3. Ordinamento: righe più recenti per prime; dentro un import (stesso `createdAt`, una sola transazione) per data, collaboratore e cliente grezzi.

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| UI e comandi | `src/app/(back-office)/righe-sospese/**`, `src/components/elenco-selezionabile.tsx` (`risoluzione`) |
| Query | `src/lib/righe-sospese.ts` |
| Dominio | `src/domain/righe-sospese/index.ts` |
| Dati | `prisma/schema.prisma` (`RigaAttivitaSospesa`, `MotivoSospensione`), migrazione `20261102140000_righe_attivita_sospese`, righe di esempio in `prisma/seed.ts` |
| Test | `tests/unit/righe-sospese-actions.test.ts`, `tests/unit/righe-sospese.test.ts`, `tests/e2e/righe-sospese.spec.ts` |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

Motivo e dati di una riga sospesa non cambiano mai dall'applicazione; non esistono inserimento, modifica o eliminazione manuali. Lo script di import non esiste ancora. Quando verrà scritto, il contratto concordato prevede: `--reset` svuota le tabelle applicative, compresa `RigaAttivitaSospesa`, e senza `--reset` lo script rifiuta un database non vuoto; `--dry-run` produce solo il report; scrittura in un'unica transazione; conteggio finale di righe importate e sospese per motivo; confronto su valori normalizzati (trim e maiuscolo); logica di abbinamento in un modulo riusabile. Entrano comunque come `RigaAttivita`: righe con cliente censito e codice offerta vuoto (offerta da definire), righe con ore vuote o zero (ore 0 e nota), righe duplicate (segnalate nel report). Le azioni guidate (censisci e importa, sposta su altro cliente) sono un'evoluzione futura che non richiede di cambiare lo schema.

<!-- archetipo:wiki section=verification -->
## Verifica

I test unitari coprono la server action (guardia di ruolo, deduplica degli id, condizione sullo stato corrente) e la lettura dei filtri dall'URL; il test E2E `tests/e2e/righe-sospese.spec.ts` copre filtro per motivo e stato, segna come risolte e riporta da risolvere su righe create dalla factory.

## Concetti correlati

Alimenta [Attività e consuntivazione](/domains/attivita.md) tramite il futuro import e dipende dalle anagrafiche [Clienti](/domains/clienti.md), [Offerte](/domains/offerte.md) e [Collaboratori](/domains/collaboratori.md).
