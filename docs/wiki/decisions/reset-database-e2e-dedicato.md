---
type: decision
title: Reset per costruzione del database e2e dedicato
description: La suite e2e azzera e ricostruisce a ogni run il proprio database dedicato, creandolo se assente, subordinando l'operazione distruttiva a una guardia sintattica d'identità verso il database applicativo
status: generated
decision_status: accepted
sources:
    - path: tests/e2e/e2e-database-safety.ts
      role: implementation
      symbol: assertDatabaseE2eDistintoDaDatabaseApplicativo, ripristinaSchemaPulitoDatabaseE2e, garantisciDatabaseE2eEsistente
    - path: tests/e2e/global-setup.ts
      role: implementation
    - path: playwright.config.ts
      role: implementation
    - path: docker/postgres/initdb/01-crea-database-e2e.sh
      role: local-infrastructure
    - path: tests/unit/e2e-database-safety.test.ts
      role: verification
---
# Reset per costruzione del database e2e dedicato

<!-- archetipo:wiki section=context -->
## Contesto

La preparazione della suite e2e era **assertiva**: il global setup verificava che il database indicato da `E2E_DATABASE_URL` non contenesse righe applicative e, se ne trovava anche una sola, interrompeva il run chiedendo implicitamente allo sviluppatore di ripulire a mano. Il database dedicato, inoltre, non esisteva finché qualcuno non lo creava: `docker-compose.yml` creava solo il database di sviluppo e in CI la creazione era uno step del workflow. Bastava quindi un run interrotto — righe residue, oppure una migrazione lasciata a metà — per bloccare tutti i run successivi finché non intervenivano le mani di una persona.

Il punto è che il controllo di vuoto presidiava il rischio sbagliato. La preparazione e2e esegue migrazioni e seed **distruttivi**: il danno grave non è trovare un database sporco, è puntare quelle operazioni al database **sbagliato**, cioè al database applicativo di sviluppo. Un database vuoto non è una garanzia di identità, e un database sporco non è di per sé un pericolo. La protezione andava quindi spostata dal contenuto al confine: «il database e2e non deve essere il database applicativo».

<!-- archetipo:wiki section=decision -->
## Decisione

A ogni run la suite porta da sé il proprio database allo stato voluto, invece di pretenderlo già pulito.

- **Reset per costruzione.** `ripristinaSchemaPulitoDatabaseE2e` esegue `DROP SCHEMA IF EXISTS public CASCADE` seguito da `CREATE SCHEMA public` sul database indicato da `E2E_DATABASE_URL`, poi il global setup lancia `npm run db:migrate:deploy` e `npm run db:seed`. Lo stato di partenza è quindi **indipendente da qualsiasi residuo**: ripartendo dallo schema vuoto, anche uno stato di migrazione fallito o disallineato lasciato da un run interrotto viene sanato insieme ai dati.
- **Creazione automatica del database.** Alla prima inizializzazione del volume, `docker/postgres/initdb/01-crea-database-e2e.sh` crea il database e2e accanto a quello di sviluppo. Gli script di init però non vengono rieseguiti su un volume già inizializzato — il caso di ogni sviluppatore che ha già lavorato sul progetto — quindi c'è una seconda rete di sicurezza a runtime: `garantisciDatabaseE2eEsistente` prova la connessione e, se PostgreSQL risponde `3D000` (`invalid_catalog_name`), si ricollega al database di manutenzione sulla stessa istanza e crea il database mancante. Nessuna creazione manuale è più necessaria, con o senza volume nuovo.
- **L'operazione distruttiva è subordinata a una guardia d'identità.** `assertDatabaseE2eDistintoDaDatabaseApplicativo` confronta host, porta e nome del database di `E2E_DATABASE_URL` e `DATABASE_URL` — normalizzando `localhost`/`127.0.0.1`/`::1` su un unico host e la porta assente su `5432` — e se coincidono interrompe il run con un errore che nomina i tre valori e indica il rimedio. È **puramente sintattica**: non apre alcuna connessione, quindi il rifiuto precede qualunque accesso ai dati.
- **La guardia è valutata due volte, in due punti diversi.** In `playwright.config.ts`, che è il primo codice valutato da Playwright, prima del global setup e prima dell'avvio del web server; e di nuovo in `tests/e2e/global-setup.ts`, che è il punto in cui la distruzione avviene davvero. Le due chiamate non si sostituiscono a vicenda: la prima ferma il run prima che qualsiasi processo parta, la seconda protegge il codice distruttivo nel punto in cui sta per essere eseguito.

La sequenza completa del global setup è quindi: guardia d'identità → `garantisciDatabaseE2eEsistente` → `ripristinaSchemaPulitoDatabaseE2e` → migrazioni → seed, con i due comandi finali eseguiti nell'ambiente costruito da `costruisciAmbienteE2e`, che riscrive **sempre** `DATABASE_URL` sull'URL e2e per i processi figli.

<!-- archetipo:wiki section=alternatives -->
## Alternative

**Mantenere il controllo di database vuoto e lasciare la pulizia allo sviluppatore.** Scartata: è esattamente il problema da risolvere. Il controllo trasforma ogni run interrotto in un intervento manuale, e non protegge dal rischio reale, perché un database vuoto non dice nulla sulla propria identità.

**`TRUNCATE` di tutte le tabelle applicative.** Scartata perché ripulisce i dati ma non lo schema: non sana una migrazione fallita a metà né un disallineamento dello stato di migrazione, cioè proprio il residuo tipico di un run interrotto. Sarebbe una pulizia che copre il caso facile e lascia scoperto quello che blocca davvero.

**Creare un database effimero per run (`coaching_planner_e2e_<pid>`).** Scartata perché moltiplica i database orfani sull'istanza locale a ogni run interrotto e rende opaco l'URL configurato: `E2E_DATABASE_URL` smetterebbe di indicare il database realmente usato, che è invece l'ancoraggio su cui poggia la guardia d'identità.

**Un secondo container PostgreSQL dedicato ai test.** Esplicitamente fuori perimetro nella spec. Isolerebbe per infrastruttura invece che per configurazione, ma è una scelta di ambiente locale con costi propri (porta, volume, tempi di avvio) che questa storia non ha valutato.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

- Ogni run paga la ricostruzione dello schema da zero: le migrazioni ripartono tutte a ogni avvio. Sul numero attuale di migrazioni il costo è di frazioni di secondo, ma cresce con esse ed è il prezzo dichiarato per l'indipendenza dai residui.
- **Nessun test può dipendere da dati residui del run precedente.** Non è un effetto collaterale ma una regola di progetto: ogni spec e2e deve procurarsi i propri dati tramite seed o factory. Il vecchio controllo di vuoto lo suggeriva; il reset per costruzione lo rende strutturale.
- L'utente di connessione deve poter eseguire `DROP SCHEMA public` sul database e2e, cioè esserne proprietario. È vero sia in locale, dove lo script di init crea il database con l'owner del servizio, sia in CI. Un ambiente con un utente meno privilegiato non potrebbe eseguire questa preparazione.
- Una connessione esterna aperta sul database e2e — un client grafico, una shell `psql` dimenticata — può mettere il `DROP SCHEMA` in attesa di lock e far apparire il setup bloccato. È il costo di un'operazione a livello di schema anziché di righe.
- La CI resta invariata: continua a creare il database e2e con il proprio step, che diventa ridondante ma innocuo, perché `garantisciDatabaseE2eEsistente` lo trova già presente e il reset agisce su un database appena creato. Le variabili CI puntano a nomi di database diversi, quindi la guardia d'identità passa.

<!-- archetipo:wiki section=verification -->
## Verifica

**Unit test del seam.** `tests/unit/e2e-database-safety.test.ts` copre con 33 test la descrizione dell'identità di una stringa di connessione (normalizzazione di host e porta, errore esplicito su stringa non parsabile), il confronto di identità e il messaggio d'errore della guardia, la traduzione degli errori di rete in un messaggio che nomina host, porta e il comando di avvio del container, e la costruzione dell'ambiente passato ai processi figli.

**Scenari di integrazione su PostgreSQL reale.** Su Docker e PostgreSQL effettivi: da un database e2e **sporco** la suite completa (184 test) è passata verde senza alcun intervento manuale; il database di **sviluppo** è rimasto invariato, con la riga sentinella inserita apposta prima del run ancora presente al termine; su database e2e e applicativo **coincidenti** il run è stato rifiutato con exit code 1 e **nessun web server avviato**; con il container **spento** il rifiuto è arrivato in pochi secondi con un messaggio che nomina `localhost:5432` e `docker compose up -d`; un database e2e **cancellato a mano** è stato ricreato dalla suite senza intervento.

**Suite Playwright completa.** Verde con `fullyParallel: true`, cioè il reset per costruzione non ha richiesto di serializzare l'esecuzione.

## Concetti correlati

La preparazione e i comandi quotidiani sono descritti in [Sviluppo e operazioni](/operations/development.md); il database sottostante e la separazione fra sviluppo ed E2E discendono da [PostgreSQL con target SiteGround](/decisions/postgres-siteground.md).
