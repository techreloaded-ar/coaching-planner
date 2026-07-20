---
type: code-map
title: Mappa del codice
description: Matrice fisica fra capability candidate, codice, dati e test
status: reviewed
sources:
    - path: package.json
      role: manifest
    - path: src
      role: runtime-boundary
    - path: prisma/schema.prisma
      role: data-boundary
    - path: tests
      role: verification-boundary
coverage:
    - kind: boundary
      path: .
      status: mapped
      pages:
        - engineering/code-map
        - operations/development
    - kind: boundary
      path: docs
      status: partial
      note: L'inspector dichiara un campione rappresentativo; mockup e fonti di intento sono mappati fisicamente ma non letti come runtime.
    - kind: boundary
      path: prisma
      status: mapped
      pages:
        - engineering/code-map
        - operations/development
    - kind: boundary
      path: scripts
      status: mapped
      pages:
        - operations/development
    - kind: boundary
      path: src
      status: partial
      note: Letti entry point, candidati e dipendenze pertinenti; l'inspector segnala il boundary complessivo come campione rappresentativo.
    - kind: boundary
      path: tests
      status: partial
      note: Letti test pertinenti ai candidati e rappresentanti; l'inspector segnala il boundary complessivo come campione rappresentativo.
    - kind: capability
      path: anagrafiche
      status: mapped
      pages:
        - domains/clienti
        - domains/collaboratori
        - domains/offerte
        - domains/politiche-rimborso
    - kind: capability
      path: attivita
      status: mapped
      pages:
        - domains/attivita
    - kind: capability
      path: auth
      status: mapped
      pages:
        - domains/identita-accesso
    - kind: capability
      path: clienti
      status: mapped
      pages:
        - domains/clienti
    - kind: capability
      path: collaboratori
      status: mapped
      pages:
        - domains/collaboratori
    - kind: capability
      path: offerte
      status: mapped
      pages:
        - domains/offerte
    - kind: capability
      path: report
      status: mapped
      pages:
        - domains/fatturazione-clienti
    - kind: capability
      path: scaglioni
      status: mapped
      pages:
        - domains/politiche-rimborso
review:
    content_hash: sha256:1a1bf1dde3b2737e42ca545980311bc331abdb6dbc9dcad13acc6162a7c2a785
    evidence_revision: 874f95f1f65926f1d837a345964ce90c654a449b
    reviewed_at: "2026-07-20T14:00:41Z"
---
# Mappa del codice

<!-- archetipo:wiki section=domain-code -->
## Capability → codice

| Capability | UI / ingresso | Applicazione e dominio | Dati | Integrazioni | Test principali | Wiki |
|---|---|---|---|---|---|---|
| Clienti | `src/app/(back-office)/anagrafiche/clienti/**` | `src/lib/clienti.ts`, `src/domain/anagrafiche/valida-cliente.ts` | `Cliente` | Offerte, Attività, report | unit clienti/validazione; E2E anagrafica clienti | `domains.clienti` |
| Collaboratori | `src/app/(back-office)/anagrafiche/collaboratori/**` | `src/lib/collaboratori.ts`, validatore, parti di `dal.ts` | `Collaboratore`, scritture coordinate su `Utente` | Identità, Attività | unit collaboratori/DAL; E2E collaboratori | `domains.collaboratori` |
| Offerte | UI annidata cliente, compresa `offerte-cliente-tabella.tsx`, e `src/app/(back-office)/offerte/**`, entrambe con dettaglio avanzamento espandibile | `src/lib/offerte.ts`, inclusa query filtrata per cliente, validatore offerta, `calcolaAvanzamentoOfferte` | `Offerta` | Clienti, Attività | unit offerte/avanzamento; E2E offerte e dettaglio avanzamento nelle viste trasversale e cliente | `domains.offerte` |
| Politiche rimborso | `src/app/(back-office)/anagrafiche/scaglioni/**` | `src/lib/scaglioni.ts`, validatore, `calcolaRimborsoTrasferta` | `ScaglioneKm` | Attività, Fatturazione | unit scaglioni/rimborso; E2E scaglioni/trasferta | `domains.politiche-rimborso` |
| Attività | `src/app/(front-office)/attivita/**` | `src/lib/actions/righe-attivita.ts`, `src/lib/attivita.ts`, calendario e consuntivi | `RigaAttivita` | tutte le anagrafiche operative | unit attività/action/calendario/riepilogo; E2E attività | `domains.attivita` |
| Fatturazione clienti | `src/app/(back-office)/report/fatturazione-clienti/**` | `src/lib/report.ts`, `calcolaReportFatturazioneClienti` | sola lettura di attività/offerte/clienti/scaglioni | nessuna esterna | unit ed E2E report fatturazione | `domains.fatturazione-clienti` |
| Identità e accesso | route Google, root, proxy | OAuth adapter, session token/cookie, policy e DAL | `Utente`, `Account`; tabella `Session` non usata dal flusso | Google OIDC | unit session/proxy/DAL; E2E auth/ruoli | `domains.identita-accesso` |

<!-- archetipo:wiki section=shared -->
## Codice condiviso

- `src/lib/db.ts` e `src/generated/prisma/**`: accesso e client generato; infrastruttura, non dominio autonomo.
- `src/lib/dal.ts`: guardie comuni e risoluzione profilo.
- `src/domain/consuntivi/index.ts`: validazioni e calcoli usati da più capability.
- `src/domain/calendario/index.ts`: value object e griglia mensile per Attività.
- `src/app/layout.tsx`, layout front/back office, `globals.css`, sidebar e `src/components/index.ts`: shell UI condivisa; il barrel componenti è vuoto.
- `prisma/schema.prisma`: storage condiviso per tutte le capability.

<!-- archetipo:wiki section=unmapped -->
## Codice non mappato semanticamente

- `docs/mockups/**` sono prototipi isolati e fonti d'intento, non runtime.
- `src/generated/prisma/**` è codice generato.
- `scripts/check-e2e-guardrails.ts` e `scripts/siteground-connectivity-check.ts` sono tooling operativo.
- Asset binari, favicon, `.DS_Store`, output Playwright e directory build/dependency non rappresentano capability.
- I modelli Prisma `Session` e `VerificationToken` e `src/lib/auth.ts` sono dichiarati/placeholder ma non partecipano al flusso di sessione osservato.

<!-- archetipo:wiki section=coverage -->
## Copertura dell'ispezione

Tutti i sei boundary e gli otto candidati restituiti da `archetipo wiki inspect` sono rappresentati nel frontmatter `coverage`. Root, Prisma e script sono mappati. `docs`, `src` e `tests` restano `partial` perché l'inspector li dichiara campionati; per i candidati sono stati comunque letti tutti i file riportati e le dipendenze/test pertinenti. `anagrafiche` è distribuito su quattro pagine; il dettaglio di avanzamento appartiene ora a Offerte, mentre `report` mappa solo Fatturazione clienti.

## Concetti correlati

La mappa fisica dettaglia la [panoramica](/overview.md), implementa la [mappa dei contesti](/architecture/context-map.md) e rimanda alle [operazioni di sviluppo](/operations/development.md).
