# Project Wiki

## Architecture

* [Mappa dei contesti candidati](architecture/context-map.md) - Relazioni tra capability candidate, infrastruttura condivisa e confini ancora da revisionare. _State: generated._

## Decisions

* [Calcoli di dominio in funzioni pure](decisions/calcoli-puri.md) - Isolare validazioni e calcoli di consuntivazione in funzioni pure testabili. _State: generated._
* [Giornata equivalente a otto ore](decisions/giornata-otto-ore.md) - Convertire ore e giornate con la costante fissa di otto ore per giornata. _State: generated._
* [Importi monetari decimali](decisions/importi-decimali.md) - Persistire gli importi monetari come Decimal per evitare errori contabili. _State: generated._
* [PostgreSQL con target SiteGround](decisions/postgres-siteground.md) - Usare PostgreSQL con target dichiarato SiteGround e sviluppo locale equivalente. _State: generated._
* [Tariffa unica per collaboratore](decisions/tariffa-unica-collaboratore.md) - Mantenere una sola tariffa giornaliera per ogni collaboratore nel MVP. _State: generated._
* [Unica applicazione con aree a ruolo](decisions/unica-app-ruoli.md) - Servire front office e back office da un’unica applicazione con ruoli distinti. _State: generated._

## Domains

* [Attività e consuntivazione](domains/attivita.md) - Consuntivazione giornaliera del lavoro, calendario e riepilogo mensile del collaboratore. _State: generated._
* [Clienti](domains/clienti.md) - Anagrafica fiscale dei clienti e loro abilitazione operativa. _State: generated._
* [Collaboratori](domains/collaboratori.md) - Profili professionali dei collaboratori, tariffa e abilitazione operativa. _State: generated._
* [Fatturazione clienti](domains/fatturazione-clienti.md) - Proiezione amministrativa mensile degli importi da fatturare ai clienti. _State: generated._
* [Identità, sessioni e accesso](domains/identita-accesso.md) - Accesso Google, sessione JWT, ruoli, policy di rotta e segregazione dei dati. _State: generated._
* [Offerte](domains/offerte.md) - Impegni commerciali per cliente, budget in giornate e monitoraggio dell’avanzamento. _State: generated._
* [Politiche di rimborso trasferta](domains/politiche-rimborso.md) - Configurazione globale delle fasce chilometriche e calcolo del rimborso trasferta. _State: generated._

## Engineering

* [Mappa del codice](engineering/code-map.md) - Matrice fisica fra capability candidate, codice, dati e test. _State: generated._

## Operations

* [Sviluppo e operazioni](operations/development.md) - Sviluppo locale, build, test, CI, database e vincoli operativi. _State: generated._

## Project

* [Panoramica](overview.md) - Scopo, attori, stack e perimetro della mappa codebase-first di Coaching Planner. _State: generated._

## References

* [Documento dei Requisiti di Prodotto](references/prd.md) - PRD originale di Coaching Planner, conservato come fonte di intento e decisioni attribuite. _State: generated._
