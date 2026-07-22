---
type: backlog
title: Backlog
description: Delivery backlog and canonical specification index
status: generated
schema: archetipo/backlog-wiki/v1
version: 1
epics:
    - code: EP-000
      title: Fondazione del Progetto
    - code: EP-001
      title: Autenticazione e Ruoli
    - code: EP-002
      title: Anagrafiche e Configurazione
    - code: EP-003
      title: Consuntivazione Attività
    - code: EP-004
      title: Reportistica
    - code: EP-005
      title: Evoluzioni Post-MVP
order:
    - US-001
    - US-004
    - US-005
    - US-007
    - US-009
    - US-010
    - US-013
    - US-014
    - US-016
    - US-017
    - US-018
    - US-019
    - US-020
    - US-002
    - US-003
    - US-021
    - US-022
    - US-006
    - US-008
    - US-011
    - US-012
    - US-015
    - US-023
    - US-024
    - US-025
    - US-026
    - US-027
    - US-028
    - US-029
    - US-030
    - US-031
    - US-032
    - US-033
    - US-034
    - US-035
    - US-036
    - US-039
    - US-040
    - US-038
    - US-037
    - US-041
---
# Backlog

This page is the canonical delivery index managed by `archetipo`.

## EP-000: Fondazione del Progetto

- [US-001: Scaffold dell'applicazione Next.js e ambiente di sviluppo](specs/US-001.md) — **DONE**, 2 point(s).
- [US-004: Spike di validazione della connettività al Postgres SiteGround](specs/US-004.md) — **DONE**, 1 point(s).
- [US-002: Database PostgreSQL con Prisma, migrazioni e seed](specs/US-002.md) — **DONE**, 2 point(s).
- [US-003: Suite di test e pipeline di integrazione continua](specs/US-003.md) — **DONE**, 2 point(s).
- [US-023: Rendere deterministica la suite e2e Playwright](specs/US-023.md) — **DONE**, 5 point(s).
- [US-041: Bootstrap idempotente dell'amministratore iniziale al deploy](specs/US-041.md) — **REVIEW**, 2 point(s).

## EP-001: Autenticazione e Ruoli

- [US-005: Accesso con Google e sessione utente](specs/US-005.md) — **DONE**, 5 point(s).
- [US-006: Autorizzazione per ruolo e segregazione dei dati](specs/US-006.md) — **DONE**, 3 point(s).
- [US-024: Home page di accesso minimale e curata](specs/US-024.md) — **DONE**, 2 point(s).
- [US-027: Accesso diretto dalla pagina radice con brand Agile Reloaded](specs/US-027.md) — **DONE**, 3 point(s).
- [US-029: Attivazione del proxy di autenticazione con rinnovo sliding della sessione](specs/US-029.md) — **DONE**, 3 point(s).
- [US-030: Front office per tutti gli utenti e back office raggiungibile dagli admin](specs/US-030.md) — **DONE**, 5 point(s).
- [US-039: Elenco e censimento degli utenti nella console di amministrazione](specs/US-039.md) — **DONE**, 3 point(s).
- [US-040: Invalidazione, riattivazione e cambio ruolo degli utenti con auto-protezione](specs/US-040.md) — **DONE**, 3 point(s).

## EP-002: Anagrafiche e Configurazione

- [US-007: Anagrafica clienti con dati di fatturazione](specs/US-007.md) — **DONE**, 3 point(s).
- [US-009: Anagrafica collaboratori con tariffa e credenziali di accesso](specs/US-009.md) — **DONE**, 3 point(s).
- [US-010: Configurazione degli scaglioni chilometrici per i rimborsi](specs/US-010.md) — **DONE**, 2 point(s).
- [US-008: Anagrafica offerte per cliente](specs/US-008.md) — **DONE**, 3 point(s).
- [US-025: Pagina offerte trasversale con stato e avanzamento](specs/US-025.md) — **DONE**, 3 point(s).
- [US-026: Gestione delle offerte dalla pagina offerte](specs/US-026.md) — **DONE**, 3 point(s).
- [US-032: Dettaglio avanzamento espandibile nella pagina Offerte e dismissione della pagina Avanzamento Offerte](specs/US-032.md) — **DONE**, 5 point(s).
- [US-033: Dettaglio avanzamento espandibile nell'elenco offerte del cliente](specs/US-033.md) — **DONE**, 2 point(s).
- [US-035: Riga compatta nell'elenco offerte con giorni erogati aggregati e stato a indicatore](specs/US-035.md) — **DONE**, 3 point(s).
- [US-036: Matrice mensile per collaboratore nel dettaglio avanzamento offerta](specs/US-036.md) — **DONE**, 3 point(s).
- [US-038: Pagina di dettaglio del collaboratore con storico attività mensile](specs/US-038.md) — **DONE**, 3 point(s).

## EP-003: Consuntivazione Attività

- [US-013: Registrazione della trasferta con rimborso automatico](specs/US-013.md) — **DONE**, 3 point(s).
- [US-014: Riepilogo mensile del collaboratore con importo fattura](specs/US-014.md) — **DONE**, 3 point(s).
- [US-011: Calendario mensile delle proprie attività](specs/US-011.md) — **DONE**, 3 point(s).
- [US-012: Inserimento delle righe di attività giornaliere](specs/US-012.md) — **DONE**, 5 point(s).
- [US-031: Apertura di qualsiasi giorno dal calendario per registrare attività](specs/US-031.md) — **DONE**, 2 point(s).
- [US-034: Nome cliente e ore cumulate nelle celle del calendario attività](specs/US-034.md) — **DONE**, 2 point(s).

## EP-004: Reportistica

- [US-016: Vista avanzamento offerte con residuo giornate](specs/US-016.md) — **DONE**, 3 point(s).
- [US-015: Report mensile degli importi da fatturare per cliente](specs/US-015.md) — **DONE**, 3 point(s).
- [US-037: Dettaglio ore erogate per collaboratore nel report Fatturazione Clienti](specs/US-037.md) — **DONE**, 3 point(s).

## EP-005: Evoluzioni Post-MVP

- [US-017: Analisi della marginalità per cliente e offerta](specs/US-017.md) — **TODO**, 5 point(s).
- [US-018: Esportazione di report e riepiloghi](specs/US-018.md) — **TODO**, 3 point(s).
- [US-019: Promemoria automatici di compilazione per i collaboratori](specs/US-019.md) — **TODO**, 3 point(s).
- [US-020: Override della tariffa collaboratore per offerta](specs/US-020.md) — **TODO**, 3 point(s).
- [US-021: Ottimizzazione rapida della pipeline CI](specs/US-021.md) — **TODO**, 3 point(s).
- [US-022: Matrix di test end-to-end multi-browser](specs/US-022.md) — **TODO**, 3 point(s).
- [US-028: Logo Agile Reloaded nelle aree interne dell'applicazione](specs/US-028.md) — **TODO**, 2 point(s).
