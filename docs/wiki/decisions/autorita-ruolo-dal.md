---
type: decision
title: Autorità sul ruolo nel DAL
description: Il proxy garantisce la sola autenticazione; il ruolo autorevole è quello a database letto dal DAL a ogni accesso protetto
status: reviewed
decision_status: accepted
sources:
    - path: src/proxy.ts
      role: implementation
    - path: src/lib/dal.ts
      role: implementation
      symbol: richiediRuolo, richiediRuoloApi
    - path: src/app/(back-office)/layout.tsx
      role: implementation
    - path: tests/unit/proxy.test.ts
      role: verification
    - path: tests/e2e/gestione-utenti.spec.ts
      role: verification
review:
    content_hash: sha256:7597ce9a1366beb8220402c1498902944e8ec6732e703330c2a9a745d7de3f1c
    evidence_revision: 3dc77a95eced5c2786ed7caf027913af75352ed4
    evidence_hash: sha256:b59c74595600d070d03c79d680f46e31eb249170d905cf06e9a861f23b94fe5a
    reviewed_at: "2026-07-29T06:10:15Z"
---
# Autorità sul ruolo nel DAL

<!-- archetipo:wiki section=context -->
## Contesto

Il ruolo incluso nel JWT può diventare stantio dopo un cambio ruolo. AC-7 di US-040 richiede invece che una sessione già aperta applichi il nuovo ruolo al primo accesso protetto successivo: un promosso raggiunge il back office e un retrocesso ne viene escluso.

<!-- archetipo:wiki section=decision -->
## Decisione

Il proxy verifica soltanto l'autenticazione e rinnova il token, senza decidere il ruolo della rotta. Il DAL rilegge `Utente.ruolo` dal database durante la risoluzione della sessione e `richiediRuolo`/`richiediRuoloApi` applicano quel valore autorevole; il layout del gruppo back office impone strutturalmente la guardia amministrativa.

<!-- archetipo:wiki section=alternatives -->
## Alternative

Richiedere un nuovo login rimanderebbe l'effetto del cambio ruolo e non soddisferebbe AC-7 per le sessioni aperte. Leggere il database nel proxy introdurrebbe dipendenza dal database nel filtro anticipato e duplicazione della policy già necessaria vicino ai dati. Una rotta che risincronizza il JWT aggiungerebbe un flusso e una finestra di incoerenza, senza eliminare il bisogno di una guardia autorevole per pagine, action e API.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Si rinuncia al filtro anticipato per ruolo nel proxy: una richiesta con JWT valido ma ruolo non più coerente raggiunge il rendering protetto. Il layout del gruppo back office e le guardie DAL la fermano prima dell'accesso ai dati, mantenendo una sola fonte di verità sul ruolo. Il costo accettato è una lettura del database a ogni accesso protetto che risolve la sessione.

<!-- archetipo:wiki section=verification -->
## Verifica

I test unitari di `src/proxy.ts` verificano che un collaboratore con JWT valido attraversi la rotta amministrativa senza una decisione di ruolo del proxy. Gli E2E invariati di autorizzazione per ruoli continuano a coprire la segregazione, mentre `tests/e2e/gestione-utenti.spec.ts` prova promozione e retrocessione su sessioni già aperte: il nuovo ruolo letto dal DAL consente o nega il back office al successivo accesso protetto.

## Concetti correlati

Questa decisione raffina, senza sostituirla, [Unica applicazione con aree a ruolo](/decisions/unica-app-ruoli.md).
