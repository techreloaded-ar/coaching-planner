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
        - domains/identita-accesso
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
      path: calendario
      status: mapped
      pages:
        - domains/attivita
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
      path: voci-rimborso
      status: mapped
      pages:
        - domains/politiche-rimborso
    - kind: capability
      path: utenti
      status: mapped
      pages:
        - domains/identita-accesso
review:
    content_hash: sha256:6d553593a8d0fd4ac4743761d6fb1f6370c1c393d057ca0efb2439151223ce01
    evidence_revision: 8c555e4e212062e4ae73e66ea4b1b049cd082901
    evidence_hash: sha256:02b59f69b7a90fcd12fa46797a25d92bbc3ded48cc2deca4f6dee0f89fbb8076
    reviewed_at: "2026-08-05T07:29:39Z"
---
# Mappa del codice

<!-- archetipo:wiki section=domain-code -->
## Capability → codice

| Capability | UI / ingresso | Applicazione e dominio | Dati | Integrazioni | Test principali | Wiki |
|---|---|---|---|---|---|---|
| Clienti | `src/app/(back-office)/anagrafiche/clienti/**` | `src/lib/clienti.ts`, `src/domain/anagrafiche/valida-cliente.ts` | `Cliente` | Offerte, Attività, report | unit clienti/validazione; E2E anagrafica clienti | `domains.clienti` |
| Collaboratori | `src/app/(back-office)/anagrafiche/collaboratori/**`, inclusa la sezione `[id]/abilitazioni-offerte.tsx` con dialog di ricerca e selezione multipla | `src/lib/collaboratori.ts`, validatore, parti di `dal.ts`; la lifecycle action utenti sincronizza il profilo; `src/lib/abilitazioni.ts` e `[id]/abilitazioni-actions.ts` per l'abilitazione esplicita su offerte; `scripts/backfill-abilitazioni-iniziali.ts` (pre-popolamento una tantum, esposto da `npm run db:backfill-abilitazioni` e agganciato anche a `prisma/seed.ts`) | `Collaboratore`, sincronizzazione coordinata con `Utente.attivo`; `AbilitazioneOfferta` | Identità, Attività, Offerte | unit collaboratori/DAL, cambio stato utente, abilitazioni/DAL e backfill abilitazioni; E2E collaboratori, gestione utenti e abilitazioni | `domains.collaboratori` |
| Offerte | UI annidata cliente, compresa `offerte-cliente-tabella.tsx`, e `src/app/(back-office)/offerte/**`, entrambe con dettaglio avanzamento espandibile | `src/lib/offerte.ts`, inclusa query filtrata per cliente, validatore offerta, `calcolaAvanzamentoOfferte` | `Offerta`, relazione inversa `abilitazioniCollaboratori` verso `AbilitazioneOfferta` (posseduta da Collaboratori) | Clienti, Attività, Collaboratori | unit offerte/avanzamento; E2E offerte e dettaglio avanzamento nelle viste trasversale e cliente | `domains.offerte` |
| Politiche rimborso | `src/app/(back-office)/anagrafiche/voci-rimborso/**` | `src/lib/voci-rimborso.ts`, `src/domain/anagrafiche/valida-voce-rimborso.ts` | `VoceRimborsoTrasferta` | Attività (sola fotografia al salvataggio, nessuna FK) | unit voci-rimborso DAL/action/validazione; E2E anagrafica voci di rimborso e selezione/fotografia | `domains.politiche-rimborso` |
| Attività | `src/app/(front-office)/attivita/**`, inclusa l'isola client `[data]/isola-giornata.tsx` che governa il cambio giorno nella stessa scheda | `src/lib/actions/righe-attivita.ts`, `src/lib/attivita.ts`, `src/lib/attivita-contract.ts`, calendario e consuntivi; cache in sola memoria della scheda (`cache-dati-scheda.ts` con la guardia d'identità condivisa, `calendario-cache.ts`, `giornata-cache.ts`, provider `attivita-cache-provider.tsx`) e le route GET sotto `src/app/api/attivita/**`, che condividono le intestazioni di `src/lib/risposta-dati-privati.ts` | `RigaAttivita`, inclusi i campi fotografati `rimborsoTrasfertaEtichetta`/`rimborsoTrasfertaImporto` | tutte le anagrafiche operative | unit attività/action/calendario/riepilogo e `tests/unit/calendario-cache-provider.test.ts`, più `tests/unit/attivita-calendario-route.test.ts`, `tests/unit/attivita-giornata-routes.test.ts` (giornata, contesto di inserimento e offerte per cliente) e `tests/unit/cache-dati-scheda.test.ts` (guardia condivisa, cache di giornata e di contesto); E2E attività, rimborso trasferta selezionato, `tests/e2e/calendario-cache-mesi.spec.ts`, `tests/e2e/cambio-rapido-giorno-dettaglio.spec.ts` e `tests/e2e/giornata-cache-cambio-giorno.spec.ts` | `domains.attivita` |
| Fatturazione clienti | `src/app/(back-office)/report/fatturazione-clienti/**` | `src/lib/report.ts`, `calcolaReportFatturazioneClienti` | sola lettura di attività/offerte/clienti, rimborsi già fotografati sulle righe | nessuna esterna | unit ed E2E report fatturazione | `domains.fatturazione-clienti` |
| Identità e accesso | route Google, root, proxy e `src/app/(back-office)/anagrafiche/utenti/**` | OAuth adapter, session token/cookie, proxy di sola autenticazione e DAL autorevole; `src/lib/utenti.ts`, action, validatore, protezione ultimo amministratore e `scripts/bootstrap-amministratore-iniziale.ts` (bootstrap idempotente al deploy) | `Utente` con stato `attivo` e ruolo, `Account`; tabella `Session` non usata dal flusso | Google OIDC, Collaboratori per la sincronizzazione del profilo | unit session/proxy/DAL, callback, action utenti e bootstrap amministratore; E2E auth/ruoli e gestione utenti | `domains.identita-accesso` |

<!-- archetipo:wiki section=shared -->
## Codice condiviso

- `src/lib/db.ts` e `src/generated/prisma/**`: accesso e client generato; infrastruttura, non dominio autonomo.
- `src/lib/dal.ts`: guardie comuni e risoluzione profilo.
- `src/lib/formattazione.ts`: formattatore euro e iniziali cliente condivisi, usati dalle viste di Clienti, Collaboratori, Offerte, Politiche rimborso e Fatturazione clienti.
- `src/domain/consuntivi/index.ts`: validazioni e calcoli usati da più capability.
- `src/domain/calendario/index.ts`: value object e griglia mensile per Attività.
- `src/app/layout.tsx`, layout front/back office, `globals.css` e sidebar: shell UI condivisa. `globals.css` ospita anche la regola `@layer base` che dà il cursore a manina a tutti i pulsanti abilitati e il keyframe `comparsa-caricamento` riusato da overlay e rotelline.
- `src/components/**`: componenti UI condivisi, esposti dal barrel `src/components/index.ts` e riusati sia dal front office sia dal back office. `PulsanteAttesa` (`pulsante-attesa.tsx`) è il pulsante con feedback di attesa uniforme basato su `useFormStatus`, adottato dai form e dai modali di entrambe le aree; `useIdratata` (`use-idratata.ts`) segnala al client l'avvenuta idratazione. Si veda [Feedback di attesa e cursore uniformi](/decisions/feedback-attesa-uniforme.md).
- `prisma/schema.prisma`: storage condiviso per tutte le capability.

<!-- archetipo:wiki section=unmapped -->
## Codice non mappato semanticamente

- `docs/mockups/**` sono prototipi isolati e fonti d'intento, non runtime.
- `src/generated/prisma/**` è codice generato.
- `scripts/check-e2e-guardrails.ts`, `scripts/siteground-connectivity-check.ts`, `scripts/bootstrap-amministratore-iniziale.ts` e `scripts/backfill-abilitazioni-iniziali.ts` sono tooling operativo.
- Asset binari, favicon, `.DS_Store`, output Playwright e directory build/dependency non rappresentano capability.
- I modelli Prisma `Session` e `VerificationToken` e `src/lib/auth.ts` sono dichiarati/placeholder ma non partecipano al flusso di sessione osservato.

<!-- archetipo:wiki section=coverage -->
## Copertura dell'ispezione

Tutti i sei boundary e i dieci candidati restituiti da `archetipo wiki inspect` sono rappresentati nel frontmatter `coverage`. Root, Prisma e script sono mappati. `docs`, `src` e `tests` restano `partial` perché l'inspector li dichiara campionati; per i candidati sono stati comunque letti tutti i file riportati e le dipendenze/test pertinenti. `anagrafiche` è distribuito sulle pagine di Clienti, Collaboratori, Offerte, Politiche rimborso e Identità/accesso; il candidato `utenti`, introdotto dalla UI `/anagrafiche/utenti`, è assegnato a Identità/accesso. Il dettaglio di avanzamento appartiene a Offerte, mentre `report` mappa solo Fatturazione clienti. Il candidato `calendario`, comparso con la route dati `src/app/api/attivita/calendario/route.ts` introdotta dalla cache client dei mesi, è assegnato ad Attività: non è una capability autonoma, è un confine dati di quella capability. Quella route non è però più l'unico confine dati dell'area: sotto `src/app/api/attivita/` ne convivono oggi quattro — `calendario/route.ts` (parametro `mese`), `giornata/route.ts` (parametro `data`), `contesto-inserimento/route.ts` (senza parametri) e `offerte-cliente/route.ts` (parametro `cliente`, subentrata alla server action del cascade cliente → offerta perché la risposta di una server action riconcilia l'albero RSC con l'URL e azzererebbe il form dopo un cambio giorno scritto con la History API). Sono tutte confini dati della **stessa** capability Attività e nessuna è una capability autonoma: derivano sempre il collaboratore dalla sessione e rispondono con le intestazioni condivise `Cache-Control: private, no-store` e `Vary: Cookie` di `src/lib/risposta-dati-privati.ts`. L'ispezione continua infatti a restituire dieci candidati, senza candidati nuovi per le route aggiunte.

## Concetti correlati

La mappa fisica dettaglia la [panoramica](/overview.md), implementa la [mappa dei contesti](/architecture/context-map.md) e rimanda alle [operazioni di sviluppo](/operations/development.md).
