# Project Wiki

## Architecture

* [Mappa dei contesti candidati](architecture/context-map.md) - Relazioni tra capability candidate, infrastruttura condivisa e confini ancora da revisionare. _State: generated._

## Decisions

* [Abilitazioni esplicite collaboratore-offerta](decisions/abilitazioni-offerte-esplicite.md) - Persistere l'ingaggio collaboratore-offerta in una tabella dedicata, revocabile, con pre-popolamento una tantum. _State: evidence-changed._
* [Autorità sul ruolo nel DAL](decisions/autorita-ruolo-dal.md) - Il proxy garantisce la sola autenticazione; il ruolo autorevole è quello a database letto dal DAL a ogni accesso protetto. _State: reviewed._
* [Cache client dei mesi del calendario collaboratore](decisions/cache-client-calendario-collaboratore.md) - Isola SPA sul calendario con GET autenticato e cache in memoria della scheda, TTL 300 s e LRU 12, invece del runtime prefetching non stabile. _State: evidence-changed._
* [Calcoli di dominio in funzioni pure](decisions/calcoli-puri.md) - Isolare validazioni e calcoli di consuntivazione in funzioni pure testabili. _State: evidence-changed._
* [Cognome nella sezione anagrafica dell'utente](decisions/cognome-anagrafica-utente.md) - Rendere Utente autorevole per nome e cognome, mantenendo Collaboratore.nome/cognome come copie coordinate scritte dai writer transazionali. _State: evidence-changed._
* [Connessione al database senza TLS (rischio accettato)](decisions/connessione-db-senza-tls.md) - Accettazione consapevole del rischio di connessione in chiaro tra Vercel e il PostgreSQL SiteGround, in attesa del supporto TLS del provider. _State: reviewed._
* [Feedback di attesa e cursore uniformi](decisions/feedback-attesa-uniforme.md) - Cursore dal base layer e un unico PulsanteAttesa basato su useFormStatus, invece di classi e wiring pending ad hoc su ogni pulsante. _State: generated._
* [Fotografia del rimborso trasferta sulla riga attività](decisions/fotografia-rimborso-trasferta.md) - Congelare etichetta e importo della voce di rimborso sulla riga al salvataggio, senza chiave esterna né versioning delle voci. _State: generated._
* [Giornata equivalente a otto ore](decisions/giornata-otto-ore.md) - Convertire ore e giornate con la costante fissa di otto ore per giornata. _State: evidence-changed._
* [Importi monetari decimali](decisions/importi-decimali.md) - Persistire gli importi monetari come Decimal per evitare errori contabili. _State: generated._
* [PostgreSQL con target SiteGround](decisions/postgres-siteground.md) - Usare PostgreSQL con target dichiarato SiteGround e sviluppo locale equivalente. _State: evidence-changed._
* [Ruoli combinabili derivati dal profilo collaboratore](decisions/ruoli-combinabili-profilo-derivato.md) - Derivare il ruolo Collaboratore dalla presenza del profilo, riusando enum e relazione 1:1 esistenti senza modifiche allo schema. _State: evidence-changed._
* [Tariffa unica per collaboratore](decisions/tariffa-unica-collaboratore.md) - Mantenere una sola tariffa giornaliera per ogni collaboratore nel MVP. _State: evidence-changed._
* [Unica applicazione con aree a ruolo](decisions/unica-app-ruoli.md) - Servire front office e back office da un’unica applicazione con ruoli distinti. _State: reviewed._

## Domains

* [Attività e consuntivazione](domains/attivita.md) - Consuntivazione giornaliera del lavoro, calendario e riepilogo mensile del collaboratore. _State: generated._
* [Clienti](domains/clienti.md) - Anagrafica fiscale dei clienti e loro abilitazione operativa. _State: evidence-changed._
* [Collaboratori](domains/collaboratori.md) - Profili professionali dei collaboratori, tariffa e abilitazione operativa. _State: evidence-changed._
* [Fatturazione clienti](domains/fatturazione-clienti.md) - Proiezione amministrativa mensile degli importi da fatturare ai clienti. _State: generated._
* [Identità, sessioni e accesso](domains/identita-accesso.md) - Censimento utenti, accesso Google, sessione JWT, ruoli, policy di rotta e segregazione dei dati. _State: evidence-changed._
* [Offerte](domains/offerte.md) - Impegni commerciali per cliente, budget in giornate e monitoraggio dell’avanzamento. _State: evidence-changed._
* [Politiche di rimborso trasferta](domains/politiche-rimborso.md) - Configurazione globale delle voci di rimborso trasferta a etichetta libera e importo forfettario. _State: generated._

## Engineering

* [Mappa del codice](engineering/code-map.md) - Matrice fisica fra capability candidate, codice, dati e test. _State: generated._

## Operations

* [Deploy — Vercel + PostgreSQL SiteGround](operations/deploy-vercel-siteground.md) - Guida operativa per portare Coaching Planner in staging e produzione su Vercel, con database PostgreSQL ospitato su SiteGround. _State: reviewed._
* [Sviluppo e operazioni](operations/development.md) - Sviluppo locale, build, test, CI, database e vincoli operativi. _State: generated._

## Project

* [Panoramica](overview.md) - Scopo, attori, stack e perimetro della mappa codebase-first di Coaching Planner. _State: generated._

## References

* [Documento dei Requisiti di Prodotto](references/prd.md) - PRD originale di Coaching Planner, conservato come fonte di intento e decisioni attribuite. _State: reviewed._
