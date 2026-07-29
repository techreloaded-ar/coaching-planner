---
type: domain
title: Attività e consuntivazione
description: Consuntivazione giornaliera del lavoro, calendario e riepilogo mensile del collaboratore
status: reviewed
classification: candidate
sources:
    - path: src/lib/actions/righe-attivita.ts
      role: inbound-commands
      symbol: creaRiga, modificaRiga, eliminaRiga, rimuoviTrasferta, verificaAbilitazioneOfferta, caricaRigaDelCollaboratore
    - path: src/lib/attivita.ts
      role: application-query
      symbol: attivitaDelMese, righeDelGiorno, riepilogoMese, offerteAbilitatePerCliente, datiCalendarioMesePerCollaboratoreAutorizzato
    - path: src/lib/attivita-contract.ts
      role: application-query
      symbol: DatiCalendarioMese, SintesiGiorno
    - path: src/app/api/attivita/calendario/route.ts
      role: inbound-query
      symbol: GET
    - path: src/app/(front-office)/attivita/calendario-cache.ts
      role: read-model-cache
      symbol: CacheCalendarioMesi
    - path: src/app/(front-office)/attivita/calendario-cache-provider.tsx
      role: read-model-cache
      symbol: CalendarioCacheProvider
    - path: src/domain/calendario/index.ts
      role: supporting-domain
    - path: src/domain/consuntivi/index.ts
      role: domain-calculation
      symbol: validaOre, validaKmTrasferta, calcolaRiepilogoMese
    - path: prisma/schema.prisma
      role: owned-data
      symbol: RigaAttivita
    - path: tests/unit/righe-attivita-actions.test.ts
      role: verification
    - path: tests/unit/attivita.test.ts
      role: verification
    - path: tests/e2e/calendario-segregazione.spec.ts
      role: verification
    - path: tests/e2e/offerte-abilitate-inserimento.spec.ts
      role: verification
    - path: tests/e2e/calendario-navigazione-reattiva.spec.ts
      role: verification
    - path: tests/e2e/calendario-cache-mesi.spec.ts
      role: verification
    - path: tests/unit/calendario-cache-provider.test.ts
      role: verification
    - path: tests/unit/attivita-calendario-route.test.ts
      role: verification
review:
    content_hash: sha256:97df2858c7e1faa2bdf5e60735ccef682d2cb25ce722194cc6613d5f15fd2c1c
    evidence_revision: 3dc77a95eced5c2786ed7caf027913af75352ed4
    evidence_hash: sha256:9fc80a1cc491b6833d2b0238553f44423b5ab46a1fb70cb3b90ece038275bd25
    reviewed_at: "2026-07-29T06:10:05Z"
---
# Attività e consuntivazione

<!-- archetipo:wiki section=purpose -->
## Scopo

Permette a un collaboratore con profilo operativo di registrare e consultare le proprie ore giornaliere su cliente e offerta, indicare fatturabilità e trasferta, navigare il calendario mensile e ottenere un riepilogo economico personale.

<!-- archetipo:wiki section=language -->
## Linguaggio

Riga attività, giornata, mese, ore, cliente, offerta, fatturabile, nota, trasferta km, rimborso, tariffa giornaliera, giornate equivalenti e riepilogo mensile. Il token mese è `YYYY-MM`; la data di una riga è esposta come `YYYY-MM-DD`.

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede `RigaAttivita` e decide ammissibilità, proprietà e aggregazioni personali. Consuma profilo collaboratore, cliente, offerta e politica di rimborso. Il calendario è un supporting module senza persistenza. I report amministrativi sono downstream e leggono le righe come fatti.

<!-- archetipo:wiki section=contracts -->
## Contratti

`creaRiga`, `modificaRiga`, `eliminaRiga` e `rimuoviTrasferta` restituiscono `{ success, error? }`. Le query espongono attività per giorno/mese e un `RisultatoRiepilogoMese` serializzabile. Il profilo deve essere `ATTIVO`; le offerte selezionabili devono appartenere al cliente, essere attive ed essere abilitate per il collaboratore corrente tramite `AbilitazioneOfferta` (si veda la decisione [Abilitazioni esplicite collaboratore-offerta](/decisions/abilitazioni-offerte-esplicite.md)). `creaRiga` rifiuta con errore visibile la creazione su un'offerta non abilitata, senza scrivere alcuna riga. `modificaRiga` richiede l'abilitazione solo quando la riga cambia offerta; a parità di offerta non la ricontrolla, così una riga storica su un'offerta nel frattempo non più abilitata resta modificabile ed eliminabile dal proprietario.

Il calendario mensile ha inoltre un contratto dati proprio. `datiCalendarioMesePerCollaboratoreAutorizzato(token, collaboratoreId)` restituisce `DatiCalendarioMese` (`{ token, collaboratoreId, sintesiPerGiorno }`), serializzabile e privo di griglia: riceve un collaboratore **già autorizzato** dal chiamante e non è una guardia. Lo stesso DTO è esposto da `GET /api/attivita/calendario?mese=YYYY-MM`, che deriva sempre il collaboratore dalla sessione server, non accetta alcun identificativo dal browser e risponde `400` su token assente o malformato, `401` senza sessione, `403` con profilo non operativo. Le risposte portano `Cache-Control: private, no-store` e `Vary: Cookie`, quindi la staleness è governata soltanto dalla cache client. Etichetta del mese e griglia delle 42 celle non fanno parte del contratto: il client le deriva dalle funzioni pure di `src/domain/calendario`.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. Le pagine e le action risolvono il profilo; solo l'esito derivato `ATTIVO` consente operazioni.
2. La creazione verifica campi, coerenza offerta-cliente, stato offerta, abilitazione del collaboratore sull'offerta, ore, km/scaglione e formato data, poi `src/lib/actions/righe-attivita.ts` (`creaRiga`) crea una `RigaAttivita` per il collaboratore corrente e assegna esattamente cliente, offerta, data, ore, nota, `fatturabile` e `trasfertaKm`.
3. `modificaRiga`, `eliminaRiga` e `rimuoviTrasferta` caricano prima la riga corrente e verificano che `RigaAttivita.collaboratoreId` coincida con il collaboratore corrente (`caricaRigaDelCollaboratore`). `rimuoviTrasferta` assegna esattamente `trasfertaKm: null` nello stesso file; l'eliminazione cancella il record e non è una transizione di stato.
4. `modificaRiga` costruisce un aggiornamento parziale. Assegna `fatturabile` soltanto se il `FormData` contiene il campo; non legge uno stato sorgente né modella transizioni nominate. Quando il form invia un'`offertaId` diversa da quella della riga, `modificaRiga` riverifica coerenza offerta-cliente (usando il cliente del form o, in assenza, quello della riga) e abilitazione sulla nuova offerta, rifiutando l'aggiornamento con errore visibile in caso contrario; a parità di offerta nessuna delle due verifiche viene ripetuta.
5. La lettura mensile filtra sempre per `collaboratoreId` e intervallo del mese (`orderBy: data asc, createdAt asc`), poi aggrega per giorno: numero righe, ore totali e, per ciascun cliente con attività quel giorno, ragione sociale e ore cumulate su tutte le sue offerte, in ordine di prima apparizione. La cella del calendario mostra fino a due etichette cliente con le ore, oltre le quali compare un indicatore "+N" con i clienti rimanenti; il codice offerta non è più mostrato nella cella.
6. Il calendario è un'isola client sopra un rendering server autorevole. Primo ingresso, URL diretto e reload passano da `page.tsx`, che ora riusa la sessione già verificata per risolvere il profilo e passa l'id del collaboratore autorizzato alla lettura specializzata: cinque statement SQL per rendering invece di undici, perché sessione e profilo non vengono più risolti tre e due volte. Dopo l'idratazione, un provider montato dal layout `/attivita` conserva i DTO mensili nella sola memoria della scheda (nessuno storage persistente), con finestra fresca di 300 secondi e limite LRU di 12 mesi, e prefetcha i due mesi adiacenti dopo ogni commit. Un mese fresco viene mostrato con un commit sincrono e la History API nativa (`window.history.pushState`, integrata nel router di Next e quindi senza navigazione RSC): nessuna richiesta né alla pagina né all'endpoint. `popstate` gestisce Back e Forward dalla stessa cache, senza creare nuove entry. Il contratto URL `?mese=YYYY-MM` resta invariato e condivisibile, e il pulsante «Mese corrente» continua a portare su `/attivita` senza query.
7. Sul mese non ancora disponibile (miss) la griglia precedente resta visibile, l'area calendario espone `aria-busy=true` con l'indicatore di caricamento e parte una sola lettura deduplicata; il dato e l'URL vengono committati solo se quella destinazione è ancora l'ultima richiesta dall'utente, così una risposta tardiva non sovrascrive il mese che l'utente sta guardando. Una lettura fallita mantiene la griglia precedente e mostra un errore `role="alert"` con «Riprova»; una sessione decaduta svuota la cache e provoca una navigazione completa. Il DTO dichiara il collaboratore a cui appartiene: se una risposta ne indica un altro — caso di un accesso con un altro account nella stessa finestra, che non produce alcun `401` — la cache si svuota interamente e l'isola client viene abbandonata, così un *fresh hit* non può mostrare i mesi del collaboratore precedente.
8. La staleness è delimitata da mitigazioni effettive, non dalla sola navigazione successiva: una entry scaduta viene mostrata subito e provoca **una sola** rivalidazione in background, un timer scatta alla scadenza del mese attivo, e al ritorno sulla scheda (`focus`/`visibilitychange`) la rivalidazione del mese visualizzato è forzata anche se la entry è ancora fresca — altrimenti quel ritorno non delimiterebbe alcuna staleness. Le quattro action aggiungono `revalidatePath('/attivita')` alle invalidazioni di giorno e riepilogo, mentre il dettaglio giornata invalida nel provider il token del mese prima di `router.refresh()`: la prima protegge il rendering SSR/RSC, la seconda la cache client, e nessuna sostituisce l'altra. Un'invalidazione neutralizza anche le risposte già in volo. Una modifica proveniente da un'altra scheda può restare invisibile per al massimo 300 secondi; un reload distrugge la cache e rilegge dal server. Le scelte e i loro limiti sono registrati in [Cache client dei mesi del calendario collaboratore](/decisions/cache-client-calendario-collaboratore.md).
9. Come ottimizzazione del percorso freddo, la lettura del calendario seleziona soltanto `data`, `ore`, `createdAt` e `cliente { id, ragioneSociale }` su un intervallo half-open, e `RigaAttivita` ha un indice composto `@@index([collaboratoreId, data, createdAt])` che sostiene filtro e ordinamento. Riguarda il costo di ogni singola lettura, non l'assenza di richieste sul ritorno: quella dipende dalla cache client. I 42 link giorno usano `prefetch={false}`, perché su rotta dinamica il loro prefetch non trasporta i dati della giornata.
10. Il riepilogo somma ore, converte con 8 ore/giorno, include nell'imponibile solo ore fatturabili e aggiunge i rimborsi validi.
11. Non esiste uno stato lifecycle persistito della riga. Gli esiti del calcolo rimborso non sono transizioni.
12. Un lettore amministrativo downstream, `storicoAttivitaCollaboratore` in `src/lib/collaboratori.ts`, legge tutte le righe di un collaboratore con cliente e offerta (`orderBy: data asc, createdAt asc`) per la pagina di dettaglio del collaboratore, che le raggruppa per mese solare decrescente con la funzione pura `raggruppaAttivitaPerMese` di `src/domain/consuntivi/index.ts` (totali ore e giornate equivalenti a 8 ore/giornata).

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| UI | `src/app/(front-office)/attivita/**` |
| Comandi | `src/lib/actions/righe-attivita.ts` |
| Query | `src/lib/attivita.ts`, contratto condiviso `src/lib/attivita-contract.ts` |
| Calendario | `src/domain/calendario/index.ts` |
| Confine dati calendario | `src/app/api/attivita/calendario/route.ts` |
| Cache client dei mesi | `src/app/(front-office)/attivita/calendario-cache.ts`, `calendario-cache-provider.tsx`, `layout.tsx` |
| Regole e riepilogo | `src/domain/consuntivi/index.ts` |
| Dati | `prisma/schema.prisma` (`RigaAttivita`, indice `RigaAttivita_collaboratore_data_createdAt_idx` dalla migrazione `20260728201452_indice_calendario_collaboratore`) |
| Test | `tests/unit/attivita.test.ts`, `tests/unit/righe-attivita-actions.test.ts`, `tests/unit/calendario.test.ts`, `tests/unit/riepilogo-mese.test.ts`, `tests/unit/storico-attivita-mensile.test.ts`, `tests/e2e/calendario-segregazione.spec.ts`, `tests/e2e/offerte-abilitate-inserimento.spec.ts`, `tests/e2e/calendario-navigazione-reattiva.spec.ts`, `tests/unit/calendario-cache-provider.test.ts`, `tests/unit/attivita-calendario-route.test.ts`, `tests/e2e/calendario-cache-mesi.spec.ts` e scenari attività dedicati |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

Le ore devono essere maggiori di zero e non superiori a 24 per singola riga; non esiste un limite alla somma giornaliera. I km, se presenti, sono interi positivi coperti da uno scaglione. La proprietà è applicata da filtri e controlli applicativi. Lo schema ha tre FK separate e non impone che `RigaAttivita.clienteId` coincida con il cliente dell'offerta. La creazione verifica sempre la coppia offerta-cliente e l'abilitazione; `modificaRiga` le ricontrolla entrambe non appena il form invia un'offerta diversa da quella corrente, usando il cliente del form o, in assenza, quello della riga — una modifica che lascia l'offerta invariata non le rivaluta. Inoltre `dettaglio-giornata.tsx` invia `fatturabile` soltanto quando la checkbox è selezionata e `modificaRiga` ignora il campo assente: dal flusso UI osservato una riga `true` non può quindi essere salvata come `false`. La regex delle action verifica il formato data ma non la validità civile; `Date.UTC` normalizza date impossibili. Tariffa e scaglioni correnti ricalcolano retroattivamente il riepilogo.

<!-- archetipo:wiki section=verification -->
## Verifica

La suite unit copre segregazione, CRUD, validazioni, calendario, rimborso, riepilogo e l'enforcement dell'abilitazione offerta in `creaRiga`/`modificaRiga` (`tests/unit/righe-attivita-actions.test.ts`) e il filtro della query `offerteAbilitatePerCliente` (`tests/unit/attivita.test.ts`). Gli E2E coprono flussi browser, ma alcuni scenari storici usano seed condivisi mentre i test mutanti recenti adottano factory e risorse riservate; `tests/e2e/offerte-abilitate-inserimento.spec.ts` copre la select filtrata, il messaggio di assenza offerte abilitate e la modifica/eliminazione di una riga storica su offerta non abilitata. La reattività della navigazione mensile è coperta da `tests/e2e/calendario-navigazione-reattiva.spec.ts`, che trattiene la lettura dati del mese di destinazione per osservare l'indicatore di caricamento. L'assenza di round-trip sul ritorno a un mese già visitato è provata da `tests/e2e/calendario-cache-mesi.spec.ts` con un gate che conta **e** aborta sia le navigazioni RSC verso `/attivita` sia le GET verso `/api/attivita/calendario`, così spostare i dati su un endpoint nuovo non può generare un falso positivo; lo stesso file copre miss con griglia precedente, race con risposte invertite, Back/Forward, reload e invalidazione dopo una mutazione. Le semantiche della cache — bordo esatto dei 300 000 ms, singola rivalidazione, deduplica, espulsione LRU, invalidazione di una risposta in volo e svuotamento — sono provate con orologio iniettato in `tests/unit/calendario-cache-provider.test.ts`, senza timer reali. Il confine dati è coperto da `tests/unit/attivita-calendario-route.test.ts` per validazione, 401/403 e header, dai casi sulla guardia d'identità in `tests/unit/calendario-cache-provider.test.ts`, e da `tests/e2e/calendario-segregazione.spec.ts`, che con due collaboratori factory prova sul browser che la risposta non contiene dati altrui. Confidenza alta sul comportamento descritto; i limiti server-side sono osservazioni esplicite, non invarianti presunte.

## Concetti correlati

La lettura mensile del calendario segue [Cache client dei mesi del calendario collaboratore](/decisions/cache-client-calendario-collaboratore.md).

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Collaboratori](/domains/collaboratori.md), [Clienti](/domains/clienti.md), [Offerte](/domains/offerte.md), [Politiche di rimborso](/domains/politiche-rimborso.md) e [Fatturazione clienti](/domains/fatturazione-clienti.md).
