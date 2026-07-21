---
type: context-map
title: Mappa dei contesti candidati
description: Relazioni tra capability candidate, infrastruttura condivisa e confini ancora da revisionare
status: reviewed
sources:
    - path: src/lib/actions/righe-attivita.ts
      role: cross-capability-flow
    - path: src/lib/report.ts
      role: downstream-projections
    - path: src/lib/dal.ts
      role: shared-access-boundary
    - path: prisma/schema.prisma
      role: shared-storage
review:
    content_hash: sha256:e9040ed550e9b951ec404c6dd0c754350c1e7f191bbd22b624b7b035a116bc4f
    evidence_revision: 748954aeba137b973f082bfa1d04963eaf46083c
    reviewed_at: "2026-07-21T07:43:18Z"
---
# Mappa dei contesti candidati

<!-- archetipo:wiki section=contexts -->
## Contesti candidati

| Candidato | Responsabilità osservata | Dati/decisioni principali |
|---|---|---|
| Clienti | Identità fiscale e abilitazione del cliente | `Cliente`, dati fiscali, `attivo` |
| Collaboratori | Profilo professionale e operatività | `Collaboratore`, tariffa, `attivo` |
| Offerte | Termini commerciali, budget e avanzamento derivato | `Offerta`, tariffa, giorni previsti, `attiva` |
| Politiche di rimborso | Configurazione e selezione fascia chilometrica | `ScaglioneKm`, calcolo rimborso |
| Attività | Registrazione, proprietà e riepilogo personale | `RigaAttivita`, ore, fatturabilità, trasferta |
| Fatturazione clienti | Proiezione mensile amministrativa | Regole di aggregazione; nessun dato persistito proprio |
| Identità e accesso | Google OAuth, sessione, ruoli e guardie | `Account`, cookie JWT, policy e accesso a `Utente` |

<!-- archetipo:wiki section=relationships -->
## Relazioni osservate

- Attività consulta Collaboratori per il profilo operativo, Clienti e Offerte per i riferimenti selezionabili e Politiche di rimborso per validare la trasferta.
- Offerte riferisce Clienti; la creazione richiede un cliente attivo. Le attività fatturabili sono input della proiezione di avanzamento dell'offerta.
- Fatturazione clienti legge fatti da Attività, tariffa e metadati da Offerte, ragione sociale da Clienti e fasce da Politiche di rimborso.
- Identità e accesso consulta `Collaboratore.attivo` per la revoca operativa; Collaboratori crea o sincronizza anche `Utente`, oggi condiviso nello stesso database.
- Tutti i flussi amministrativi e operativi dipendono dalle guardie di Identità e accesso.

Il codice mostra dipendenze dirette e storage condiviso, ma non fornisce evidenza sufficiente per assegnare nomi DDD specializzati alle relazioni o per dichiarare governance autonoma.

<!-- archetipo:wiki section=shared -->
## Infrastruttura condivisa

`src/lib/db.ts` espone il singleton Prisma; `prisma/schema.prisma` contiene tutte le tabelle nello stesso schema PostgreSQL. `src/lib/dal.ts` centralizza identità, ruolo e segregazione. `src/domain/consuntivi/index.ts` è un kernel fisico condiviso tra Attività, Offerte, Politiche di rimborso e Fatturazione, pur contenendo regole con attori e scopi distinti. `src/domain/calendario/index.ts` è un modulo puro di supporto. Next App Router, Server Action, revalidation e redirect sono infrastruttura applicativa comune.

<!-- archetipo:wiki section=uncertainties -->
## Confini e incertezze

- `Utente` è scritto da Collaboratori e letto da Identità e accesso; l'ownership logica richiede review.
- La macro-area fisica `anagrafiche` non ha ciclo o decisioni proprie e viene mappata su quattro capability.
- Il candidato fisico `report` combina fatturazione clienti e avanzamento offerte; quest'ultimo riusa la stessa proiezione anche nella lista Offerte.
- `RigaAttivita` conserva sia `clienteId` sia `offertaId` con FK indipendenti. La creazione verifica coerenza, ma una modifica parziale può eluderla.
- Tariffe e scaglioni non sono snapshot: riepiloghi e report storici sono ricalcolati con configurazione corrente.
- Le capability condividono processo, database e application layer; la classificazione `candidate` descrive una mappa semantica, non isolamento di deploy.

## Concetti correlati

La vista logica completa la [panoramica](/overview.md) e la [mappa fisica del codice](/engineering/code-map.md). Collega [Clienti](/domains/clienti.md), [Collaboratori](/domains/collaboratori.md), [Offerte](/domains/offerte.md), [Politiche di rimborso](/domains/politiche-rimborso.md), [Attività](/domains/attivita.md), [Fatturazione clienti](/domains/fatturazione-clienti.md) e [Identità e accesso](/domains/identita-accesso.md).
