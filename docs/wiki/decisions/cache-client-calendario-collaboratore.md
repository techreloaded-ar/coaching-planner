---
type: decision
title: Cache client dei mesi del calendario collaboratore
description: Isola SPA sul calendario con GET autenticato e cache in memoria della scheda, TTL 300 s e LRU 12, invece del runtime prefetching non stabile
status: generated
decision_status: accepted
sources:
    - path: src/app/(front-office)/attivita/calendario-cache.ts
      role: implementation
      symbol: CacheCalendarioMesi, DURATA_FRESH_MS, MASSIMO_MESI_IN_CACHE
    - path: src/app/(front-office)/attivita/calendario-cache-provider.tsx
      role: implementation
      symbol: CalendarioCacheProvider, leggiMeseDaEndpoint, ErroreSessioneCalendario
    - path: src/app/(front-office)/attivita/layout.tsx
      role: implementation
    - path: src/app/api/attivita/calendario/route.ts
      role: implementation
      symbol: GET
    - path: src/lib/attivita-contract.ts
      role: implementation
      symbol: DatiCalendarioMese
    - path: src/lib/attivita.ts
      role: implementation
      symbol: datiCalendarioMesePerCollaboratoreAutorizzato
    - path: src/app/(front-office)/attivita/calendario-mensile.tsx
      role: implementation
    - path: prisma/schema.prisma
      role: owned-data
      symbol: RigaAttivita
    - path: tests/unit/calendario-cache-provider.test.ts
      role: verification
    - path: tests/unit/attivita-calendario-route.test.ts
      role: verification
    - path: tests/e2e/calendario-cache-mesi.spec.ts
      role: verification
    - path: tests/e2e/calendario-segregazione.spec.ts
      role: verification
---
# Cache client dei mesi del calendario collaboratore

<!-- archetipo:wiki section=context -->
## Contesto

Il cambio mese del calendario deve mostrare i dati senza attendere il server, ma su Next 16.2.9 la strada offerta dal framework non è utilizzabile: `use cache: private` è dichiarato `experimental` e la sua guida bundled afferma esplicitamente che dipende dal *runtime prefetching*, «which is not yet stable»; `unstable_instant` è `draft` e richiede `cacheComponents`. Le misure di US-050 avevano già escluso `router.prefetch` su rotta dinamica, che trasporta solo l'albero di instradamento, e un tentativo con Cache Components: adottabile ma insufficiente, perché il dato mensile resta un buco dinamico e ogni ritorno emette una richiesta.

Nello stato iniziale il ritorno su un mese già visitato costava sempre un round-trip: 20 richieste RSC su 20 cambi mese, misurate su build production. Il percorso freddo, inoltre, risolveva la sessione tre volte e il profilo collaboratore due, per un totale di 11 statement SQL per rendering, su un database di produzione con 51,4 ms di latenza per round-trip.

<!-- archetipo:wiki section=decision -->
## Decisione

Il calendario diventa un'isola SPA limitata all'area attività, indipendente da qualunque API sperimentale.

- Il rendering SSR/RSC resta autorevole per primo ingresso, reload e URL diretto: `/attivita` continua a essere una rotta dinamica servita dal server.
- Un `GET /api/attivita/calendario?mese=YYYY-MM` autenticato restituisce il DTO minimo del mese. Il collaboratore è **sempre** derivato dalla sessione server: la route non accetta alcun identificativo dal browser. Le risposte usano `Cache-Control: private, no-store` e `Vary: Cookie`, così non esiste una seconda cache HTTP con staleness implicita.
- Un provider client montato dal layout `/attivita` conserva i DTO mensili nella **sola memoria della scheda**: nessun `localStorage`, `sessionStorage`, IndexedDB o service worker. Il provider è montato con la chiave di sessione come `key` di React, quindi un cambio di sessione smonta l'istanza e la svuota.
- Finestra fresca **300 000 ms**, limite **LRU 12 mesi**, richieste concorrenti sullo stesso mese deduplicate su una sola Promise, prefetch dei due mesi adiacenti dopo ogni commit con errori silenziosi.
- La navigazione tra mesi freschi usa `window.history.pushState`, integrato nel router di Next: non avvia una navigazione RSC. `popstate` gestisce Back/Forward leggendo dalla stessa cache, senza creare nuove entry.
- Una entry scaduta viene mostrata immediatamente e provoca **una sola** rivalidazione in background. La staleness è delimitata da un timer sulla scadenza del mese attivo e da una rivalidazione su `focus`/`visibilitychange`, non solo dalla navigazione successiva.
- Invalidazione a due livelli complementari: le quattro server action aggiungono `revalidatePath('/attivita')` alle invalidazioni di giorno e riepilogo, e il dettaglio giornata invalida il token del mese nel provider prima di `router.refresh()`. Nessuna delle due sostituisce l'altra.
- Una risposta tardiva può popolare la propria chiave ma non decide quale mese è attivo: l'ultima intenzione dell'utente vince. Un'invalidazione neutralizza anche le risposte già in volo, così un dato antecedente alla mutazione non può ripopolare la cache.
- Su `401`/`403` — o su un reindirizzamento del proxy globale, che per una rotta protetta priva di sessione equivale a un 401 — la cache viene svuotata e il consumer esegue una navigazione completa.
- Il DTO dichiara il `collaboratoreId` a cui appartiene, derivato dalla sessione server e mai accettato dal client. La cache confronta quell'identità con quella dei dati che già conserva: se differisce, la sessione della scheda è stata sostituita (per esempio da un accesso con un altro account nella stessa finestra, che non produce alcun `401`) e la cache si svuota chiedendo al consumer una navigazione completa. Senza questa guardia un *fresh hit* potrebbe mostrare i mesi del collaboratore precedente al nuovo, perché per costruzione non emette richieste.
- Al ritorno sulla scheda (`focus`/`visibilitychange`) la rivalidazione del mese attivo è **forzata**, anche su una entry ancora fresca: un prefetch condizionato uscirebbe subito e il ritorno sulla scheda non delimiterebbe alcuna staleness. È anche il momento in cui la risposta rivela un cambio di sessione avvenuto altrove. Il prefetch condizionato resta invece la scelta giusta per i mesi adiacenti, che non devono generare traffico inutile.
- Nel percorso freddo la pagina passa la sessione già verificata al resolver del profilo e l'id del collaboratore autorizzato a una lettura mensile specializzata, che seleziona solo `data`, `ore`, `createdAt` e `cliente { id, ragioneSociale }` su un intervallo half-open. Un indice composto `@@index([collaboratoreId, data, createdAt])` sostiene filtro e ordinamento.
- Etichetta del mese e griglia delle 42 celle sono derivate nel client dalle funzioni pure di `src/domain/calendario`, quindi non vengono più serializzate.

Nessun flag globale di rendering viene abilitato: `next.config.ts` resta senza `cacheComponents`.

<!-- archetipo:wiki section=alternatives -->
## Alternative

**Cache Components con `use cache: private` e runtime prefetching.** Scartata perché ancora `experimental`/`draft` sulla versione in uso e perché il flag cambia la modalità di rendering di *tutte* le rotte. La verifica documentale è registrata: la via resta bloccata finché il runtime prefetching non è stabile, e questa decisione non ne dipende.

**`experimental.staleTimes.dynamic`.** Scartata perché è globale e sperimentale, non garantisce che il payload dei dati del mese freddo venga trasportato e non offre alcun controllo locale affidabile sulla consistenza.

**Caricare mese precedente, corrente e successivo nel payload iniziale.** Scartata come impostazione predefinita perché triplica query e payload della prima pagina con dati che potrebbero non servire, peggiorando il TTFB proprio nel percorso più sensibile. Resta un fallback se una misura dimostrasse che il prefetch post-idratazione arriva sistematicamente tardi.

**Una libreria di data fetching (SWR, React Query).** Scartata per una sola read query: non sono installate e introdurrebbero dipendenza, bundle e una seconda semantica di cache senza un secondo consumatore che la giustifichi.

**Cache persistente del browser o service worker.** Scartata per riservatezza e segregazione al cambio account, e perché sopravvivere al reload eliminerebbe una delle mitigazioni esplicite della staleness.

**Solo indice e query ottimizzata, senza cache client.** Utile per primo ingresso e miss — ed è stata adottata *anche* — ma incapace da sola di soddisfare l'obiettivo: lascerebbe un round-trip a ogni ritorno su un mese già visto.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Si accetta una finestra di incoerenza di **al massimo 300 secondi** per modifiche provenienti da un'altra scheda o da un altro dispositivo. Le mitigazioni sono effettive e distinte: timer alla scadenza del mese attivo, rivalidazione su focus e visibilità, invalidazione esplicita dopo una mutazione propria, e reload che distrugge la cache. Non è stato introdotto alcun canale cross-tab: è un limite dichiarato, non un difetto nascosto.

Si accetta un costo di una richiesta piccola ogni volta che l'utente torna sulla scheda. È il prezzo per rendere reale la mitigazione su focus e per accorgersi di un cambio di account: senza di essa l'isola client potrebbe restare indefinitamente su dati non più coerenti con la sessione.

Si accetta inoltre una superficie HTTP in più da proteggere. Il costo è contenuto perché la route non espone parametri di identità e riusa le guardie del DAL (si veda [Autorità sul ruolo nel DAL](/decisions/autorita-ruolo-dal.md)); la segregazione è provata sul browser con due collaboratori distinti, non solo con mock.

Il calendario diventa una piccola macchina a stati client — cache, intento di navigazione, History API — quindi una parte della correttezza si sposta dal server al browser, dove va mantenuta con test propri. In compenso i 42 link giorno usano `prefetch={false}`, perché su rotta dinamica il loro prefetch non trasporta i dati della giornata e competerebbe con il prefetch mensile.

Il percorso freddo migliora come effetto collaterale: 11 → 5 statement SQL per rendering, TTFB del primo ingresso da 25,3 a 11,4 ms al p50 sulla stessa build e sullo stesso database di misura.

<!-- archetipo:wiki section=verification -->
## Verifica

**Zero richieste sul ritorno.** `tests/e2e/calendario-cache-mesi.spec.ts` abilita un gate che conta **e** aborta sia le navigazioni RSC verso `/attivita` sia le GET verso `/api/attivita/calendario`, poi torna su un mese già visitato: il contatore resta a zero e le celle, l'etichetta e l'URL sono corretti. Lo stesso gate copre Back e Forward. Su build production, 20 alternanze fra mesi già visitati sono passate da 20 richieste dati a **0**.

**Bordo della finestra fresca.** `tests/unit/calendario-cache-provider.test.ts` inietta l'orologio: a `TTL-1` il caricatore non viene invocato, al bordo esatto di 300 000 ms la entry è scaduta e tre letture consecutive producono **una sola** rivalidazione. Gli stessi test coprono single-flight, espulsione LRU al tredicesimo mese senza toccare la entry più recente, invalidazione che neutralizza una risposta in volo, risposte fuori ordine, errore di prefetch che non cancella un dato valido, e `clear`.

**Segregazione al cambio di account.** `tests/unit/calendario-cache-provider.test.ts` prova che una risposta che dichiara un altro collaboratore svuota la cache, rende illeggibili **tutti** i mesi già conservati e avvisa il consumer; che una risposta dello stesso collaboratore non svuota nulla; e che dopo uno svuotamento la cache accetta la nuova identità. `tests/e2e/calendario-cache-mesi.spec.ts` lo prova sul browser: dopo un accesso con un altro account nella stessa finestra, l'isola client viene abbandonata con una navigazione documentale e il calendario mostra la giornata del nuovo collaboratore, mai la ragione sociale del cliente del precedente.

**Confine dati e sicurezza.** `tests/unit/attivita-calendario-route.test.ts` copre 400 su token assente o malformato senza interrogare il read model, 401 su sessione assente, 403 su profilo assente o disattivato, header `private, no-store` e `Vary: Cookie`, e il fatto che l'unico id passato alla lettura sia quello del profilo risolto dal DAL. `tests/e2e/calendario-segregazione.spec.ts` prova sul browser che, con due collaboratori aventi righe nello stesso giorno, la risposta non contiene né l'id né la ragione sociale del cliente altrui.

**Reattività percepita invariata.** Il miss mantiene la griglia precedente con overlay e `aria-busy=true`, con la lettura trattenuta da una Promise rilasciata dal test; la race rilascia la destinazione più recente per prima e prova che la risposta tardiva non cambia etichetta, URL né celle; un `reload` continua a leggere dal server.

**Misure.** Il record `docs/test-results/US-052-calendario-performance.md` riporta procedura, cardinalità, p50/p95, conteggi di richieste e dimensioni di payload prima e dopo. È un artefatto locale non tracciato dal repository, perché `docs/test-results` è in `.gitignore`: le evidenze tracciate della decisione sono il codice e i test elencati in `sources`.

## Concetti correlati

Questa decisione riguarda la capability [Attività e consuntivazione](/domains/attivita.md) e riusa senza modificarle [Autorità sul ruolo nel DAL](/decisions/autorita-ruolo-dal.md) e [PostgreSQL con target SiteGround](/decisions/postgres-siteground.md).
