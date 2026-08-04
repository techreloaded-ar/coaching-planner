---
type: decision
title: Cache client dell'area attività del collaboratore — mesi del calendario e giornate
description: Isole SPA su calendario e dettaglio giornata con GET autenticati, cache in memoria della scheda con TTL 300 s e guardia d'identità condivisa, invece del runtime prefetching non stabile
status: generated
decision_status: accepted
sources:
    - path: src/app/(front-office)/attivita/cache-dati-scheda.ts
      role: implementation
      symbol: CacheDatiScheda, GuardiaIdentitaScheda, DURATA_FRESH_MS
    - path: src/app/(front-office)/attivita/calendario-cache.ts
      role: implementation
      symbol: CacheCalendarioMesi, MASSIMO_MESI_IN_CACHE
    - path: src/app/(front-office)/attivita/giornata-cache.ts
      role: implementation
      symbol: CacheGiornateAttivita, CacheContestoInserimento, MASSIMO_GIORNATE_IN_CACHE, CHIAVE_CONTESTO_INSERIMENTO
    - path: src/app/(front-office)/attivita/attivita-cache-provider.tsx
      role: implementation
      symbol: AttivitaCacheProvider, ErroreSessioneAttivita, useCacheCalendario, useCacheGiornate, useCacheContestoInserimento, useLetturaOfferteCliente, creaContenitoreCacheAttivita
    - path: src/app/(front-office)/attivita/layout.tsx
      role: implementation
    - path: src/app/(front-office)/attivita/calendario-mensile.tsx
      role: implementation
    - path: src/app/(front-office)/attivita/[data]/isola-giornata.tsx
      role: implementation
      symbol: IsolaGiornata
    - path: src/app/(front-office)/attivita/[data]/page.tsx
      role: implementation
    - path: src/app/api/attivita/calendario/route.ts
      role: implementation
      symbol: GET
    - path: src/app/api/attivita/giornata/route.ts
      role: implementation
      symbol: GET
    - path: src/app/api/attivita/contesto-inserimento/route.ts
      role: implementation
      symbol: GET
    - path: src/app/api/attivita/offerte-cliente/route.ts
      role: implementation
      symbol: GET
    - path: src/lib/risposta-dati-privati.ts
      role: implementation
      symbol: rispostaDatiPrivati, INTESTAZIONI_DATI_PRIVATI
    - path: src/lib/attivita-contract.ts
      role: implementation
      symbol: DatiCalendarioMese, DatiGiornataAttivita, ContestoInserimentoGiornata
    - path: src/lib/attivita.ts
      role: implementation
      symbol: datiCalendarioMesePerCollaboratoreAutorizzato, righeDelGiornoPerCollaboratoreAutorizzato, contestoInserimentoPerCollaboratoreAutorizzato
    - path: prisma/schema.prisma
      role: owned-data
      symbol: RigaAttivita
    - path: tests/unit/cache-dati-scheda.test.ts
      role: verification
    - path: tests/unit/calendario-cache-provider.test.ts
      role: verification
    - path: tests/unit/attivita-calendario-route.test.ts
      role: verification
    - path: tests/unit/attivita-giornata-routes.test.ts
      role: verification
    - path: tests/e2e/calendario-cache-mesi.spec.ts
      role: verification
    - path: tests/e2e/calendario-segregazione.spec.ts
      role: verification
    - path: tests/e2e/giornata-cache-cambio-giorno.spec.ts
      role: verification
---
# Cache client dell'area attività del collaboratore — mesi del calendario e giornate

<!-- archetipo:wiki section=context -->
## Contesto

Il cambio mese del calendario deve mostrare i dati senza attendere il server, ma su Next 16.2.9 la strada offerta dal framework non è utilizzabile: `use cache: private` è dichiarato `experimental` e la sua guida bundled afferma esplicitamente che dipende dal *runtime prefetching*, «which is not yet stable»; `unstable_instant` è `draft` e richiede `cacheComponents`. Le misure di US-050 avevano già escluso `router.prefetch` su rotta dinamica, che trasporta solo l'albero di instradamento, e un tentativo con Cache Components: adottabile ma insufficiente, perché il dato mensile resta un buco dinamico e ogni ritorno emette una richiesta.

Nello stato iniziale il ritorno su un mese già visitato costava sempre un round-trip: 20 richieste RSC su 20 cambi mese, misurate su build production. Il percorso freddo, inoltre, risolveva la sessione tre volte e il profilo collaboratore due, per un totale di 11 statement SQL per rendering, su un database di produzione con 51,4 ms di latenza per round-trip.

Lo stesso problema si è poi ripresentato **dentro** l'area attività, un livello più in basso. Con il calendario già istantaneo, il dettaglio giornata `/attivita/[data]` restava interamente RSC: ogni cambio giorno era un `router.push` in `startTransition`, cioè un round-trip completo che ricaricava anche i dati **invarianti rispetto al giorno** — clienti abilitati e voci di rimborso trasferta che popolano il form di inserimento. Il collaboratore che consulta o registra attività su più giorni consecutivi pagava così un'attesa per ogni freccia, mentre a un livello di navigazione più alto lo stesso gesto era già immediato. La decisione riguarda quindi l'intera area attività, non i soli mesi: la sua estensione al giorno è stata una scelta di coerenza, non una seconda architettura.

<!-- archetipo:wiki section=decision -->
## Decisione

L'area attività diventa un'isola SPA — prima il calendario, poi il dettaglio giornata — indipendente da qualunque API sperimentale.

### Calendario dei mesi

- Il rendering SSR/RSC resta autorevole per primo ingresso, reload e URL diretto: `/attivita` continua a essere una rotta dinamica servita dal server.
- Un `GET /api/attivita/calendario?mese=YYYY-MM` autenticato restituisce il DTO minimo del mese. Il collaboratore è **sempre** derivato dalla sessione server: la route non accetta alcun identificativo dal browser. Le risposte usano `Cache-Control: private, no-store` e `Vary: Cookie`, così non esiste una seconda cache HTTP con staleness implicita.
- Un provider client montato dal layout `/attivita` conserva i DTO dell'area nella **sola memoria della scheda**: nessun `localStorage`, `sessionStorage`, IndexedDB o service worker. Il provider è montato con la chiave di sessione come `key` di React, quindi un cambio di sessione smonta l'istanza e la svuota. Essendo montato dal layout, sopravvive alla navigazione verso il dettaglio giornata e al ritorno al calendario.
- Finestra fresca **300 000 ms**, limite **LRU 12 mesi**, richieste concorrenti sullo stesso mese deduplicate su una sola Promise, prefetch dei due mesi adiacenti dopo ogni commit con errori silenziosi.
- La navigazione tra mesi freschi usa `window.history.pushState`, integrato nel router di Next: non avvia una navigazione RSC. `popstate` gestisce Back/Forward leggendo dalla stessa cache, senza creare nuove entry.
- Una entry scaduta viene mostrata immediatamente e provoca **una sola** rivalidazione in background. La staleness è delimitata da un timer sulla scadenza del mese attivo e da una rivalidazione su `focus`/`visibilitychange`, non solo dalla navigazione successiva.
- Invalidazione a due livelli complementari: le quattro server action aggiungono `revalidatePath('/attivita')` alle invalidazioni di giorno e riepilogo, e il dettaglio giornata invalida nel provider il giorno mutato e il token del suo mese. Nessuna delle due sostituisce l'altra: la prima protegge il rendering SSR/RSC, la seconda le cache della scheda.
- Una risposta tardiva può popolare la propria chiave ma non decide quale mese è attivo: l'ultima intenzione dell'utente vince. Un'invalidazione neutralizza anche le risposte già in volo, così un dato antecedente alla mutazione non può ripopolare la cache.
- Su `401`/`403` — o su un reindirizzamento del proxy globale, che per una rotta protetta priva di sessione equivale a un 401 — la cache viene svuotata e il consumer esegue una navigazione completa.
- Ogni DTO dichiara il `collaboratoreId` a cui appartiene, derivato dalla sessione server e mai accettato dal client. Una guardia d'identità confronta quell'identità con quella dei dati già conservati: se differisce, la sessione della scheda è stata sostituita (per esempio da un accesso con un altro account nella stessa finestra, che non produce alcun `401`) e le cache si svuotano chiedendo al consumer una navigazione completa. Senza questa guardia un *fresh hit* potrebbe mostrare i dati del collaboratore precedente al nuovo, perché per costruzione non emette richieste.
- Al ritorno sulla scheda (`focus`/`visibilitychange`) la rivalidazione del mese attivo è **forzata**, anche su una entry ancora fresca: un prefetch condizionato uscirebbe subito e il ritorno sulla scheda non delimiterebbe alcuna staleness. È anche il momento in cui la risposta rivela un cambio di sessione avvenuto altrove. Il prefetch condizionato resta invece la scelta giusta per i mesi adiacenti, che non devono generare traffico inutile.
- Nel percorso freddo la pagina passa la sessione già verificata al resolver del profilo e l'id del collaboratore autorizzato a una lettura mensile specializzata, che seleziona solo `data`, `ore`, `createdAt` e `cliente { id, ragioneSociale }` su un intervallo half-open. Un indice composto `@@index([collaboratoreId, data, createdAt])` sostiene filtro e ordinamento.
- Etichetta del mese e griglia delle 42 celle sono derivate nel client dalle funzioni pure di `src/domain/calendario`, quindi non vengono più serializzate.

### Estensione al dettaglio giornata

Il dettaglio giornata `/attivita/[data]` diventa la **seconda isola SPA della stessa area**, montata sull'infrastruttura già consegnata invece che su una copia parallela. `isola-giornata.tsx` possiede intento di navigazione, letture dalla cache, indicatore di attesa, History API, breadcrumb e barra dei controlli, e rende `<DettaglioGiornata key={giornoVisualizzato}>`: il remount che azzera il form al cambio giorno resta il meccanismo di prima, spostato dal server al client senza cambiarne la natura. La pagina server non passa più alcun `key` all'isola, che deve sopravvivere ai cambi giorno.

- **Una sola macchina di cache, tre risorse.** `CacheCalendarioMesi` è stata generalizzata in `CacheDatiScheda<T>`, parametrizzata dal tipo del DTO e dalla funzione che ne ricava la chiave: stessa semantica già provata — finestra fresca di 300 000 ms, espulsione LRU, single-flight, epoche di invalidazione che neutralizzano le risposte in volo, `subscribe`. `CacheCalendarioMesi` ne resta una specializzazione con la **stessa firma di costruttore**. Il provider monta tre istanze sulla stessa finestra di 300 secondi, con limiti diversi perché diverse sono le cardinalità d'uso: **mesi LRU 12**, **giornate LRU 31**, **contesto di inserimento una sola voce** sotto la chiave costante `CHIAVE_CONTESTO_INSERIMENTO`.
- **Guardia d'identità condivisa fra le cache della scheda.** L'identità del collaboratore esce dalla singola cache e diventa `GuardiaIdentitaScheda`, a cui tutte e tre le istanze si registrano: una risposta che dichiara un altro collaboratore svuota **tutte** le cache della scheda e notifica **una sola volta** il consumer, che esce dall'isola con una navigazione completa. Il provider espone anche un solo canale di notifica di sessione non più valida. Senza questa condivisione un cambio account rilevato dal calendario lascerebbe leggibili le giornate del collaboratore precedente, e un *fresh hit* non emette per costruzione alcuna richiesta che possa accorgersene.
- **Due confini dati distinti, perché la loro invalidazione è distinta.** `GET /api/attivita/giornata?data=YYYY-MM-DD` restituisce `DatiGiornataAttivita` (`{ data, collaboratoreId, righe }`); `GET /api/attivita/contesto-inserimento` restituisce `ContestoInserimentoGiornata` (`{ collaboratoreId, clienti, vociRimborso }`). Il contesto è **invariante rispetto al giorno**: se viaggiasse dentro il payload della giornata, clienti abilitati e voci di rimborso tornerebbero nel percorso di **ogni** cambio giorno — cioè esattamente il costo che questa estensione doveva togliere. Separato, viene seminato dal rendering server e poi non più richiesto ad ogni cambio giorno; la sua freschezza è delimitata dalle stesse mitigazioni del mese, scadenza a 300 secondi e rivalidazione forzata al ritorno sulla scheda.
- **Un solo DTO prodotto in un solo punto.** `righeDelGiornoPerCollaboratoreAutorizzato` e `contestoInserimentoPerCollaboratoreAutorizzato` servono sia la pagina server sia i route handler: rendering server ed endpoint non possono divergere. Le due nuove route, come quella del calendario, non accettano alcun identificativo di collaboratore dal browser e rispondono con le intestazioni condivise `Cache-Control: private, no-store` e `Vary: Cookie`, ora centralizzate in `rispostaDatiPrivati`.
- **L'URL di giornata è scritto dentro il `commit`**, cioè solo a dati pronti: finché la lettura è in volo restano visibili le righe del giorno precedente con l'indicatore di attesa, e l'URL è ancora quello di partenza. `popstate` è gestito **solo** per i pathname che sono URL di giornata (`/attivita/YYYY-MM-DD`): Back e Forward rileggono dalla cache senza creare nuove voci di cronologia, mentre le voci di altre rotte restano competenza del router di Next.
- **`router.refresh()` sostituito dall'invalidazione delle cache.** Dopo una mutazione si invalidano il giorno mutato e il token del suo mese e si forza una rilettura del giorno; l'aggiornamento raggiunge la vista tramite `subscribe`. Il `refresh` è ridondante — le server action continuano a fare `revalidatePath` e la loro risposta invalida già la Router Cache client per quei percorsi — ed è **dannoso**, perché rigenererebbe l'albero RSC del giorno da cui l'utente è partito riportando la vista sul giorno sbagliato. Resta come solo fallback quando il provider è assente e quindi non esiste cache da rileggere.
- **Un payload server viene adottato solo se coerente con il pathname corrente.** Una `revalidatePath` di server action rigenera l'albero RSC del giorno di partenza, non di quello in vista: l'isola confronta `usePathname()` con il giorno del payload e lo adotta soltanto se coincidono. Quando non coincide, il payload viene comunque seminato in cache, senza spostare la vista. Simmetricamente, una rivalidazione che entra in cache aggiorna la vista solo se riguarda il giorno dell'intento corrente.
- **Al montaggio l'URL è l'unica sorgente di verità sul giorno mostrato.** Il `pushState` di Next copia nella voce di cronologia appena creata l'albero RSC di quella corrente: la voce del giorno raggiunto con un cambio giorno client porta quindi l'albero del **giorno di partenza**. Finché l'isola resta montata è innocuo, perché la vista vive nel client; ma se l'utente esce verso un'altra rotta e torna indietro, il router ripristina quell'albero insieme all'URL corretto, e l'isola verrebbe rimontata con il payload del giorno sbagliato — intestazione, selettore e righe contraddirebbero l'URL, che è ciò che l'utente vede, condivide e ricarica. L'isola confronta quindi il giorno del `window.location.pathname` con quello del proprio intento e, se differiscono, riparte dall'URL senza registrare una nuova voce di cronologia. Il pathname si legge da `window.location`, non dal router: il router aggiorna il proprio URL canonico dentro una transizione e durante una catena di cambi giorno rapidi può essere momentaneamente indietro.
- **Un commit non sopravvive all'isola.** `commit` scrive nella cronologia della scheda, che è globale: una lettura ancora in volo quando l'utente lascia la pagina riscriverebbe l'URL di una rotta che non le appartiene più, lasciando un URL che mente sul contenuto mostrato e una voce di cronologia fantasma. Il guardiano dell'intento corrente distingue un giorno abbandonato dal giorno guardato, ma non lo smontaggio: serve una guardia di montaggio distinta, controllata prima di ogni scrittura di vista o di cronologia.
- **Prefetch dei soli giorni adiacenti** (più o meno uno) dopo ogni commit, con errori silenziosi. Un salto lontano dal selettore data resta deliberatamente un miss.
- **Il selettore data descrive sempre un giorno reale.** Un valore incompleto o svuotato non è una destinazione: il campo torna subito a descrivere il giorno mostrato invece di restare a metà mentre la pagina mostra un altro giorno.

### Il cascade cliente → offerta esce dalle Server Action

Conseguenza non prevista in fase di piano ed emersa dall'implementazione, registrata qui perché è una scelta architetturale e non un dettaglio: la lettura delle offerte abilitate per un cliente è stata spostata dalla Server Action `fetchOffertePerCliente` — rimossa da `src/lib/actions/righe-attivita.ts` — al nuovo `GET /api/attivita/offerte-cliente?cliente=<id>`.

Il motivo è un'interazione fra History API e Server Action che non si osserva finché le due non convivono. Dopo un cambio giorno scritto con `pushState`, l'URL punta al nuovo giorno mentre l'albero RSC del router descrive ancora quello di partenza. La risposta della prima Server Action successiva **riconcilia** i due, e quella riconciliazione cambia la *state key* del segmento dinamico `[data]`, rimontando il sottoalbero della pagina: il form in compilazione viene azzerato mentre l'utente lo sta compilando. Una lettura HTTP non tocca l'albero del router e lascia il form intatto. La regola che ne discende è generale: **dentro un'isola che governa l'URL con la History API, le letture di supporto all'interazione non passano da una Server Action.** Le mutazioni restano server action, perché il loro effetto sull'albero RSC è voluto e avviene comunque a form inviato.

La nuova route riusa lo stesso confine delle altre — collaboratore derivato dalla sessione, nessun identificativo di identità accettato dal browser, `rispostaDatiPrivati` per gli header — e resta deliberatamente **fuori** dall'oracolo di rete dei test sul cambio giorno: è una conseguenza dell'interazione con il form, non del cambio giorno.

Nessun flag globale di rendering viene abilitato: `next.config.ts` resta senza `cacheComponents`.

<!-- archetipo:wiki section=alternatives -->
## Alternative

**Cache Components con `use cache: private` e runtime prefetching.** Scartata perché ancora `experimental`/`draft` sulla versione in uso e perché il flag cambia la modalità di rendering di *tutte* le rotte. La verifica documentale è registrata: la via resta bloccata finché il runtime prefetching non è stabile, e questa decisione non ne dipende.

**`experimental.staleTimes.dynamic`.** Scartata perché è globale e sperimentale, non garantisce che il payload dei dati del mese freddo venga trasportato e non offre alcun controllo locale affidabile sulla consistenza.

**Caricare mese precedente, corrente e successivo nel payload iniziale.** Scartata come impostazione predefinita perché triplica query e payload della prima pagina con dati che potrebbero non servire, peggiorando il TTFB proprio nel percorso più sensibile. Resta un fallback se una misura dimostrasse che il prefetch post-idratazione arriva sistematicamente tardi.

**Una libreria di data fetching (SWR, React Query).** Scartata per una sola read query: non sono installate e introdurrebbero dipendenza, bundle e una seconda semantica di cache senza un secondo consumatore che la giustifichi.

**Cache persistente del browser o service worker.** Scartata per riservatezza e segregazione al cambio account, e perché sopravvivere al reload eliminerebbe una delle mitigazioni esplicite della staleness.

**Solo indice e query ottimizzata, senza cache client.** Utile per primo ingresso e miss — ed è stata adottata *anche* — ma incapace da sola di soddisfare l'obiettivo: lascerebbe un round-trip a ogni ritorno su un mese già visto.

### Alternative scartate nell'estensione al giorno

**Un'identità per singola cache, invece della guardia condivisa.** Scartata perché lascerebbe leggibili le giornate del collaboratore precedente quando il cambio account è rilevato soltanto dal calendario: la cache che non ha emesso richieste non ha modo di accorgersene. Il costo accettato è che la guardia diventa stato condiviso della scheda e va provata a parte, con test dedicati sullo svuotamento incrociato.

**Contesto di inserimento incluso nel payload della giornata.** Un solo endpoint che restituisce righe più contesto sarebbe più economico su un miss freddo — una richiesta invece di due — ma riporterebbe clienti e voci di rimborso nel percorso di **ogni** cambio giorno, annullando il beneficio principale dell'estensione. Scartata: le due risorse hanno cicli di invalidazione diversi e vanno tenute su confini diversi.

**Una seconda copia della macchina di cache per le giornate.** Scartata perché duplicherebbe una macchina a stati sottile ma non banale — epoche di invalidazione, single-flight, LRU, guardia d'identità — e con essa la sua manutenzione e i suoi test. La generalizzazione in `CacheDatiScheda<T>` ha invece conservato la firma del costruttore di `CacheCalendarioMesi`, così la suite unit del calendario è passata **senza una riga di modifica**: è la prova che la generalizzazione non ha cambiato comportamento.

**Mantenere il cascade cliente → offerta su una Server Action.** Scartata dopo averne osservato l'effetto: la riconciliazione dell'albero RSC che la risposta della Server Action provoca dopo un cambio giorno scritto con la History API rimonta la pagina e azzera il form in compilazione. L'alternativa di rinunciare alla History API e tornare a `router.push` per il cambio giorno è stata scartata a sua volta, perché è esattamente la navigazione RSC che questa decisione elimina.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Si accetta una finestra di incoerenza di **al massimo 300 secondi** per modifiche provenienti da un'altra scheda o da un altro dispositivo. Le mitigazioni sono effettive e distinte: timer alla scadenza del mese attivo, rivalidazione su focus e visibilità, invalidazione esplicita dopo una mutazione propria, e reload che distrugge la cache. Non è stato introdotto alcun canale cross-tab: è un limite dichiarato, non un difetto nascosto.

La stessa finestra vale ora anche per le **righe della giornata**, per i **clienti abilitati** e per le **voci di rimborso trasferta**, con le stesse mitigazioni e la stessa assenza di canale cross-tab. La differenza pratica sta nella cardinalità: le righe di un giorno cambiano soprattutto per mano dell'utente stesso, e quel percorso è coperto dall'invalidazione esplicita; clienti e voci di rimborso cambiano invece per una modifica amministrativa fatta altrove, che nella scheda già aperta può restare invisibile fino alla scadenza, al ritorno sulla scheda o al reload. È il prezzo dichiarato per non richiederli ad ogni cambio giorno.

Si accetta un costo di una richiesta piccola ogni volta che l'utente torna sulla scheda. È il prezzo per rendere reale la mitigazione su focus e per accorgersi di un cambio di account: senza di essa l'isola client potrebbe restare indefinitamente su dati non più coerenti con la sessione.

Si accetta inoltre una superficie HTTP in più da proteggere, oggi **quattro** route di lettura dell'area (`calendario`, `giornata`, `contesto-inserimento`, `offerte-cliente`). Il costo è contenuto perché nessuna espone parametri di identità, tutte riusano le guardie del DAL (si veda [Autorità sul ruolo nel DAL](/decisions/autorita-ruolo-dal.md)) e tutte condividono le stesse intestazioni di risposta privata; la segregazione è provata sul browser con due collaboratori distinti, non solo con mock.

L'area attività diventa una macchina a stati client — cache, intento di navigazione, History API — quindi una parte della correttezza si sposta dal server al browser, dove va mantenuta con test propri, ora su due isole invece che su una. In compenso i 42 link giorno usano `prefetch={false}`, perché su rotta dinamica il loro prefetch non trasporta i dati della giornata e competerebbe con il prefetch mensile.

Nasce infine un vincolo di progetto che vale per chiunque tocchi il dettaglio giornata: **dentro un'isola che governa l'URL con la History API, una lettura di supporto all'interazione non può essere una Server Action**, perché la sua risposta riconcilia l'albero RSC del router con l'URL corrente e rimonta il sottoalbero della pagina, azzerando un form in compilazione. Aggiungere una lettura al form significa quindi aggiungere una route GET, non una server action. Le mutazioni restano server action: il loro effetto sull'albero è voluto e avviene a form già inviato.

Governare l'URL con la History API porta con sé due obblighi permanenti, entrambi conseguenza del fatto che cronologia e albero RSC sono **globali della scheda** mentre l'isola è locale alla rotta: al montaggio la vista si allinea all'URL, non al payload ricevuto, perché l'albero ripristinato da una voce di cronologia può descrivere un altro giorno; e ogni scrittura differita — vista o cronologia — passa da una guardia di montaggio, perché una lettura in volo sopravvive al componente che l'ha chiesta. Sono due regole di manutenzione, non due dettagli implementativi: chi aggiunge una lettura asincrona all'isola deve rispettarle entrambe.

Anche le letture non cachate dell'area passano dallo stesso confine: `useLetturaOfferteCliente` porta il cascade cliente → offerta sul canale di sessione della scheda, così una sessione decaduta su quel percorso produce la stessa navigazione completa delle altre letture invece di una tendina che si svuota in silenzio.

Il percorso freddo migliora come effetto collaterale: 11 → 5 statement SQL per rendering, TTFB del primo ingresso da 25,3 a 11,4 ms al p50 sulla stessa build e sullo stesso database di misura.

<!-- archetipo:wiki section=verification -->
## Verifica

**Zero richieste sul ritorno.** `tests/e2e/calendario-cache-mesi.spec.ts` abilita un gate che conta **e** aborta sia le navigazioni RSC verso `/attivita` sia le GET verso `/api/attivita/calendario`, poi torna su un mese già visitato: il contatore resta a zero e le celle, l'etichetta e l'URL sono corretti. Lo stesso gate copre Back e Forward. Su build production, 20 alternanze fra mesi già visitati sono passate da 20 richieste dati a **0**.

**Bordo della finestra fresca.** `tests/unit/calendario-cache-provider.test.ts` inietta l'orologio: a `TTL-1` il caricatore non viene invocato, al bordo esatto di 300 000 ms la entry è scaduta e tre letture consecutive producono **una sola** rivalidazione. Gli stessi test coprono single-flight, espulsione LRU al tredicesimo mese senza toccare la entry più recente, invalidazione che neutralizza una risposta in volo, risposte fuori ordine, errore di prefetch che non cancella un dato valido, e `clear`.

**Segregazione al cambio di account.** `tests/unit/calendario-cache-provider.test.ts` prova che una risposta che dichiara un altro collaboratore svuota la cache, rende illeggibili **tutti** i mesi già conservati e avvisa il consumer; che una risposta dello stesso collaboratore non svuota nulla; e che dopo uno svuotamento la cache accetta la nuova identità. `tests/e2e/calendario-cache-mesi.spec.ts` lo prova sul browser: dopo un accesso con un altro account nella stessa finestra, l'isola client viene abbandonata con una navigazione documentale e il calendario mostra la giornata del nuovo collaboratore, mai la ragione sociale del cliente del precedente.

**Confine dati e sicurezza.** `tests/unit/attivita-calendario-route.test.ts` copre 400 su token assente o malformato senza interrogare il read model, 401 su sessione assente, 403 su profilo assente o disattivato, header `private, no-store` e `Vary: Cookie`, e il fatto che l'unico id passato alla lettura sia quello del profilo risolto dal DAL. `tests/e2e/calendario-segregazione.spec.ts` prova sul browser che, con due collaboratori aventi righe nello stesso giorno, la risposta non contiene né l'id né la ragione sociale del cliente altrui.

**Reattività percepita invariata.** Il miss mantiene la griglia precedente con overlay e `aria-busy=true`, con la lettura trattenuta da una Promise rilasciata dal test; la race rilascia la destinazione più recente per prima e prova che la risposta tardiva non cambia etichetta, URL né celle; un `reload` continua a leggere dal server.

**Zero richieste sul cambio giorno.** `tests/e2e/giornata-cache-cambio-giorno.spec.ts` copre undici scenari con un oracolo di rete che conta **e** aborta: il cancello intercetta sia le navigazioni verso l'URL di una giornata (`/attivita/YYYY-MM-DD`, documento o payload RSC) sia le GET verso `/api/attivita/giornata` e `/api/attivita/contesto-inserimento`. Abortire, e non solo contare, è ciò che rende l'assenza di richieste una prova: se le righe comparissero grazie a una richiesta, quella richiesta fallirebbe e l'asserzione sul contenuto cadrebbe invece di passare. Gli scenari sono: ritorno su un giorno già visitato a contatore zero; Back e Forward senza richieste né nuove voci di cronologia; giorno mai visitato, con la giornata precedente ancora visibile, l'indicatore attivo e l'URL che cambia solo a dati pronti; tre cambi giorno consecutivi senza alcuna richiesta al contesto di inserimento e con la select cliente ancora popolata; form azzerato ad ogni cambio giorno; salvataggio che lascia la vista sul giorno salvato e si riflette nel calendario del mese; accesso con un altro account che non mostra alcun dato del collaboratore precedente; reload e link profondo serviti dal server con il contratto URL invariato. `/api/attivita/offerte-cliente` resta deliberatamente fuori dal cancello, perché è una conseguenza dell'interazione con il form e non del cambio giorno.

**URL e vista non si contraddicono mai.** Tre scenari dello stesso file provano le regole nate dal governo dell'URL con la History API, ciascuno rosso prima della correzione e verde dopo: il rientro nell'isola da un'altra rotta con Indietro — giorno, calendario, Indietro — mostra il giorno dell'**URL** e non quello dell'albero RSC ripristinato, con intestazione, selettore, righe e breadcrumb concordi; una risposta trattenuta e rilasciata **dopo** che l'utente ha lasciato l'isola non riscrive né l'URL né la cronologia, provato lasciando il calendario visibile e verificando poi che Indietro da un giorno riporti al calendario e non a una voce fantasma; e il selettore data svuotato torna a descrivere il giorno mostrato invece di restare a metà.

**Macchina di cache generalizzata e guardia condivisa.** `tests/unit/cache-dati-scheda.test.ts` prova con orologio e caricatore iniettati che una risposta di un altro collaboratore rende illeggibili **giornate e contesto insieme**, che una risposta dello stesso collaboratore non svuota nulla e che dopo lo svuotamento entrambe le cache accettano la nuova identità; per le giornate, il bordo esatto della finestra fresca con **una sola** rivalidazione su tre letture, il `seed` che serve senza invocare il caricatore, l'espulsione LRU al superamento del mese di giornate e la protezione della voce appena scritta; per il contesto, la chiave costante che tiene la cache a una sola voce, la `revalida` che forza la lettura anche su voce fresca e l'invalidazione che neutralizza una risposta già in volo. `tests/unit/calendario-cache-provider.test.ts` è rimasto invariato e continua a passare: è la prova che la generalizzazione non ha cambiato il comportamento del calendario.

**Confini dati delle nuove route.** `tests/unit/attivita-giornata-routes.test.ts` copre con DAL mockato tutte e tre le nuove route — `giornata`, `contesto-inserimento` e `offerte-cliente` — sugli esiti 400 su parametro assente o malformato senza interrogare il read model, 401 su sessione assente, 403 su profilo assente o disattivato, 200 sul percorso felice, intestazioni `private, no-store` e `Vary: Cookie`, e il fatto che l'unico id passato alla lettura sia quello del profilo risolto dal DAL.

**Misure.** Il record `docs/test-results/US-052-calendario-performance.md` riporta procedura, cardinalità, p50/p95, conteggi di richieste e dimensioni di payload prima e dopo. È un artefatto locale non tracciato dal repository, perché `docs/test-results` è in `.gitignore`: le evidenze tracciate della decisione sono il codice e i test elencati in `sources`.

## Concetti correlati

Questa decisione riguarda la capability [Attività e consuntivazione](/domains/attivita.md) e riusa senza modificarle [Autorità sul ruolo nel DAL](/decisions/autorita-ruolo-dal.md) e [PostgreSQL con target SiteGround](/decisions/postgres-siteground.md).
