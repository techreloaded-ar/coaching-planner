---
id: architecture.context-map
type: context-map
summary: Relazioni tra capability candidate, infrastruttura condivisa e confini ancora da revisionare
status: reviewed
links:
    - id: overview
      relation: detailed-by
    - id: engineering.code-map
      relation: implemented-by
    - id: domains.clienti
      relation: includes-candidate
    - id: domains.collaboratori
      relation: includes-candidate
    - id: domains.offerte
      relation: includes-candidate
    - id: domains.politiche-rimborso
      relation: includes-candidate
    - id: domains.attivita
      relation: includes-candidate
    - id: domains.fatturazione-clienti
      relation: includes-candidate
    - id: domains.identita-accesso
      relation: includes-candidate
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
    content_hash: sha256:c732db3187b8aee5286bde89c0af3c1644c1d34c6e076721adbe60d8f68d1d56
    evidence_revision: d5a7bbe7cd96e946dce2920672fc29c1779b4e9b
    reviewed_at: "2026-07-16T17:30:56Z"
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
