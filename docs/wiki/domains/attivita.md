---
type: domain
title: Attività e consuntivazione
description: Consuntivazione giornaliera del lavoro, calendario e riepilogo mensile del collaboratore
status: generated
classification: candidate
sources:
    - path: src/lib/actions/righe-attivita.ts
      role: inbound-commands
      symbol: creaRiga, modificaRiga, eliminaRiga, rimuoviRimborsoTrasferta, fotografaVoceRimborsoTrasferta, verificaAbilitazioneOfferta, caricaRigaDelCollaboratore
    - path: src/lib/attivita.ts
      role: application-query
      symbol: attivitaDelMese, righeDelGiorno, riepilogoMese, clientiAttiviPerSelezione, offerteAbilitatePerCliente, datiCalendarioMesePerCollaboratoreAutorizzato
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
      symbol: parseDataGiorno, giornoSpostatoDi
    - path: src/app/(front-office)/attivita/[data]/dettaglio-giornata.tsx
      role: inbound-ui
    - path: src/app/(front-office)/attivita/calendario-mensile.tsx
      role: inbound-ui
    - path: src/domain/consuntivi/index.ts
      role: domain-calculation
      symbol: validaOre, calcolaRiepilogoMese
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
    - path: tests/e2e/clienti-abilitati-inserimento.spec.ts
      role: verification
    - path: tests/e2e/calendario-navigazione-reattiva.spec.ts
      role: verification
    - path: tests/e2e/calendario-cache-mesi.spec.ts
      role: verification
    - path: tests/unit/calendario-cache-provider.test.ts
      role: verification
    - path: tests/unit/attivita-calendario-route.test.ts
      role: verification
    - path: tests/e2e/cambio-rapido-giorno-dettaglio.spec.ts
      role: verification
    - path: tests/e2e/rimborso-trasferta-selezione.spec.ts
      role: verification
    - path: tests/e2e/calendario-salto-mese.spec.ts
      role: verification
---
# Attività e consuntivazione

<!-- archetipo:wiki section=purpose -->
## Scopo

Permette a un collaboratore con profilo operativo di registrare e consultare le proprie ore giornaliere su cliente e offerta, indicare fatturabilità e l'eventuale voce di rimborso trasferta, navigare il calendario mensile e ottenere un riepilogo economico personale.

<!-- archetipo:wiki section=language -->
## Linguaggio

Riga attività, giornata, mese, ore, cliente, offerta, fatturabile, nota, voce di rimborso trasferta (etichetta + importo fotografati), tariffa giornaliera, giornate equivalenti e riepilogo mensile. Il token mese è `YYYY-MM`; la data di una riga è esposta come `YYYY-MM-DD`.

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede `RigaAttivita` e decide ammissibilità, proprietà e aggregazioni personali. Consuma profilo collaboratore, cliente, offerta e politica di rimborso. Il calendario è un supporting module senza persistenza. I report amministrativi sono downstream e leggono le righe come fatti.

<!-- archetipo:wiki section=contracts -->
## Contratti

`creaRiga`, `modificaRiga`, `eliminaRiga` e `rimuoviRimborsoTrasferta` restituiscono `{ success, error? }`. Le query espongono attività per giorno/mese e un `RisultatoRiepilogoMese` serializzabile. Il profilo deve essere `ATTIVO`; le offerte selezionabili devono appartenere al cliente, essere attive ed essere abilitate per il collaboratore corrente tramite `AbilitazioneOfferta` (si veda la decisione [Abilitazioni esplicite collaboratore-offerta](/decisions/abilitazioni-offerte-esplicite.md)). `creaRiga` rifiuta con errore visibile la creazione su un'offerta non abilitata, senza scrivere alcuna riga. `modificaRiga` richiede l'abilitazione solo quando la riga cambia offerta; a parità di offerta non la ricontrolla, così una riga storica su un'offerta nel frattempo non più abilitata resta modificabile ed eliminabile dal proprietario.

La stessa abilitazione governa anche la selezione a monte: `clientiAttiviPerSelezione()` restituisce i soli clienti attivi su cui il collaboratore corrente ha almeno un'offerta attiva abilitata, con `select { id, ragioneSociale }` e ordinamento per ragione sociale ascendente invariati; senza collaboratore corrente lancia `ErroreAutorizzazione` 401. Ne discendono due comportamenti del form giornata: quando l'elenco è vuoto e il form è in modalità «Nuova riga», al posto della select compare un messaggio esplicito che invita a contattare un amministratore e il salvataggio non è disponibile; in modifica il cliente della riga storica resta visibile e selezionato anche se il collaboratore non è più abilitato su alcuna sua offerta, così il salvataggio a parità di offerta resta consentito coerentemente con la regola server. Il filtro riguarda solo la selezione: le regole di ammissibilità su creazione e modifica restano quelle delle action.

Il rimborso trasferta ha un contratto proprio, di sola selezione. Il form riga non chiede più una quantità: propone una tendina delle voci di rimborso correnti, la cui scelta è opzionale (`Nessun rimborso` è un'opzione legittima) e viene inviata come `voceRimborsoTrasfertaId`. `creaRiga` e `modificaRiga` non conservano il riferimento alla voce: la fotografano, cioè copiano sulla riga etichetta e importo correnti della voce scelta al momento del salvataggio (`fotografaVoceRimborsoTrasferta`), e rifiutano con errore visibile una voce non più esistente. In modifica la tendina espone anche l'opzione «Non modificare il rimborso attuale», che omette del tutto il campo dal `FormData`: è l'assenza del campo a far sì che `modificaRiga` lasci invariato il rimborso già fotografato. `rimuoviRimborsoTrasferta(rigaId)` azzera entrambi i campi fotografati. Il razionale è in [Fotografia del rimborso trasferta sulla riga attività](/decisions/fotografia-rimborso-trasferta.md).

Il calendario mensile ha inoltre un contratto dati proprio. `datiCalendarioMesePerCollaboratoreAutorizzato(token, collaboratoreId)` restituisce `DatiCalendarioMese` (`{ token, collaboratoreId, sintesiPerGiorno }`), serializzabile e privo di griglia: riceve un collaboratore **già autorizzato** dal chiamante e non è una guardia. Lo stesso DTO è esposto da `GET /api/attivita/calendario?mese=YYYY-MM`, che deriva sempre il collaboratore dalla sessione server, non accetta alcun identificativo dal browser e risponde `400` su token assente o malformato, `401` senza sessione, `403` con profilo non operativo. Le risposte portano `Cache-Control: private, no-store` e `Vary: Cookie`, quindi la staleness è governata soltanto dalla cache client. Etichetta del mese e griglia delle 42 celle non fanno parte del contratto: il client le deriva dalle funzioni pure di `src/domain/calendario`.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. Le pagine e le action risolvono il profilo; solo l'esito derivato `ATTIVO` consente operazioni.
2. Il form giornata popola la select cliente con i soli clienti abilitati (`clientiAttiviPerSelezione`) e la select offerta con `offerteAbilitatePerCliente`. Se non esiste alcun cliente abilitato, in modalità «Nuova riga» la select cliente è sostituita da un box `nessun-cliente-abilitato` e il pulsante «Aggiungi riga» è disabilitato. All'ingresso in modifica, `handleModifica` inietta in coda alle option il cliente della riga storica quando non è più fra quelli abilitati — stesso trattamento già applicato all'offerta storica — così la riga resta modificabile; il banner per-cliente `nessuna-offerta-abilitata` compare solo se l'utente cambia esplicitamente cliente verso uno senza offerte abilitate.
3. La creazione verifica campi, coerenza offerta-cliente, stato offerta, abilitazione del collaboratore sull'offerta, ore e formato data, poi `src/lib/actions/righe-attivita.ts` (`creaRiga`) crea una `RigaAttivita` per il collaboratore corrente e assegna esattamente cliente, offerta, data, ore, nota, `fatturabile` e la coppia `rimborsoTrasfertaEtichetta`/`rimborsoTrasfertaImporto` fotografata dalla voce eventualmente scelta nella tendina. Senza selezione entrambi i campi restano `null` e la riga è valida.
4. `modificaRiga`, `eliminaRiga` e `rimuoviRimborsoTrasferta` caricano prima la riga corrente e verificano che `RigaAttivita.collaboratoreId` coincida con il collaboratore corrente (`caricaRigaDelCollaboratore`). `rimuoviRimborsoTrasferta` assegna esattamente `rimborsoTrasfertaEtichetta: null` e `rimborsoTrasfertaImporto: null` nello stesso file; l'eliminazione cancella il record e non è una transizione di stato.
5. `modificaRiga` costruisce un aggiornamento parziale. Rifotografa etichetta e importo soltanto se il `FormData` contiene `voceRimborsoTrasfertaId`: una modifica che non tocca la tendina lascia invariato il rimborso già fotografato, mentre una selezione vuota lo azzera. Assegna `fatturabile` soltanto se il `FormData` contiene il campo; non legge uno stato sorgente né modella transizioni nominate. Quando il form invia un'`offertaId` diversa da quella della riga, `modificaRiga` riverifica coerenza offerta-cliente (usando il cliente del form o, in assenza, quello della riga) e abilitazione sulla nuova offerta, rifiutando l'aggiornamento con errore visibile in caso contrario; a parità di offerta nessuna delle due verifiche viene ripetuta.
6. La lettura mensile filtra sempre per `collaboratoreId` e intervallo del mese (`orderBy: data asc, createdAt asc`), poi aggrega per giorno: numero righe, ore totali e, per ciascun cliente con attività quel giorno, ragione sociale e ore cumulate su tutte le sue offerte, in ordine di prima apparizione. La cella del calendario mostra fino a due etichette cliente con le ore, oltre le quali compare un indicatore "+N" con i clienti rimanenti; il codice offerta non è più mostrato nella cella.
7. Il calendario è un'isola client sopra un rendering server autorevole. Primo ingresso, URL diretto e reload passano da `page.tsx`, che ora riusa la sessione già verificata per risolvere il profilo e passa l'id del collaboratore autorizzato alla lettura specializzata: cinque statement SQL per rendering invece di undici, perché sessione e profilo non vengono più risolti tre e due volte. Dopo l'idratazione, un provider montato dal layout `/attivita` conserva i DTO mensili nella sola memoria della scheda (nessuno storage persistente), con finestra fresca di 300 secondi e limite LRU di 12 mesi, e prefetcha i due mesi adiacenti dopo ogni commit. Un mese fresco viene mostrato con un commit sincrono e la History API nativa (`window.history.pushState`, integrata nel router di Next e quindi senza navigazione RSC): nessuna richiesta né alla pagina né all'endpoint. `popstate` gestisce Back e Forward dalla stessa cache, senza creare nuove entry. Il contratto URL `?mese=YYYY-MM` resta invariato e condivisibile, e il pulsante «Mese corrente» continua a portare su `/attivita` senza query. Alla stessa barra si aggiunge un controllo di selezione diretta — un campo mese («Vai a un mese specifico») con il pulsante di conferma «Vai» — che raggiunge in un solo passo qualunque mese e anno, anche lontano da quello corrente, senza scorrere i mesi intermedi: non è un percorso di navigazione parallelo ma un ulteriore ingresso verso lo stesso intento `vaiA` usato da frecce, «Mese corrente» e Back/Forward, con il token validato prima del salto perché su browser privi di campo mese nativo degrada a testo libero. Ne discendono senza codice aggiuntivo il medesimo indicatore di attesa sul mese non ancora in cache, la stessa scrittura dell'URL `?mese=YYYY-MM` dentro il commit e quindi solo a dati pronti, e la piena coerenza dei controlli esistenti a partire dal mese raggiunto; il campo si riallinea durante il render al mese effettivamente in griglia, qualunque ne sia la causa.
8. Sul mese non ancora disponibile (miss) la griglia precedente resta visibile, l'area calendario espone `aria-busy=true` con l'indicatore di caricamento e parte una sola lettura deduplicata; il dato e l'URL vengono committati solo se quella destinazione è ancora l'ultima richiesta dall'utente, così una risposta tardiva non sovrascrive il mese che l'utente sta guardando. Una lettura fallita mantiene la griglia precedente e mostra un errore `role="alert"` con «Riprova»; una sessione decaduta svuota la cache e provoca una navigazione completa. Il DTO dichiara il collaboratore a cui appartiene: se una risposta ne indica un altro — caso di un accesso con un altro account nella stessa finestra, che non produce alcun `401` — la cache si svuota interamente e l'isola client viene abbandonata, così un *fresh hit* non può mostrare i mesi del collaboratore precedente.
9. La staleness è delimitata da mitigazioni effettive, non dalla sola navigazione successiva: una entry scaduta viene mostrata subito e provoca **una sola** rivalidazione in background, un timer scatta alla scadenza del mese attivo, e al ritorno sulla scheda (`focus`/`visibilitychange`) la rivalidazione del mese visualizzato è forzata anche se la entry è ancora fresca — altrimenti quel ritorno non delimiterebbe alcuna staleness. Le quattro action aggiungono `revalidatePath('/attivita')` alle invalidazioni di giorno e riepilogo, mentre il dettaglio giornata invalida nel provider il token del mese prima di `router.refresh()`: la prima protegge il rendering SSR/RSC, la seconda la cache client, e nessuna sostituisce l'altra. Un'invalidazione neutralizza anche le risposte già in volo. Una modifica proveniente da un'altra scheda può restare invisibile per al massimo 300 secondi; un reload distrugge la cache e rilegge dal server. Le scelte e i loro limiti sono registrati in [Cache client dei mesi del calendario collaboratore](/decisions/cache-client-calendario-collaboratore.md).
10. Dalla pagina di dettaglio giornata un selettore data e due pulsanti «Giorno precedente»/«Giorno successivo» (funzione pura `giornoSpostatoDi`) permettono di navigare verso qualsiasi giorno, anche di un mese diverso, tramite `router.push` su `/attivita/{data}` (con `?mese=` preservato se presente sulla pagina di provenienza). Il cambio giorno è quindi sempre una navigazione RSC autorevole, non uno stato client-only: URL, intestazione e righe restano coerenti dopo un reload. Il form di inserimento/modifica riga viene azzerato a ogni cambio della prop `data`, per evitare che una modifica in corso resti agganciata al giorno di partenza e venga salvata silenziosamente sul giorno sbagliato.
11. Come ottimizzazione del percorso freddo, la lettura del calendario seleziona soltanto `data`, `ore`, `createdAt` e `cliente { id, ragioneSociale }` su un intervallo half-open, e `RigaAttivita` ha un indice composto `@@index([collaboratoreId, data, createdAt])` che sostiene filtro e ordinamento. Riguarda il costo di ogni singola lettura, non l'assenza di richieste sul ritorno: quella dipende dalla cache client. I 42 link giorno usano `prefetch={false}`, perché su rotta dinamica il loro prefetch non trasporta i dati della giornata.
12. Il riepilogo somma ore, converte con 8 ore/giorno, include nell'imponibile solo ore fatturabili e somma i rimborsi già fotografati sulle righe, senza alcun ricalcolo: `calcolaRiepilogoMese` e `calcolaReportFatturazioneClienti` non ricevono più alcuna configurazione di rimborso e leggono direttamente `rimborsoTrasfertaImporto`.
13. Non esiste uno stato lifecycle persistito della riga. La presenza o assenza del rimborso fotografato non è una transizione.
14. Un lettore amministrativo downstream, `storicoAttivitaCollaboratore` in `src/lib/collaboratori.ts`, legge tutte le righe di un collaboratore con cliente e offerta (`orderBy: data asc, createdAt asc`) per la pagina di dettaglio del collaboratore, che le raggruppa per mese solare decrescente con la funzione pura `raggruppaAttivitaPerMese` di `src/domain/consuntivi/index.ts` (totali ore e giornate equivalenti a 8 ore/giornata).

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
| Regole e riepilogo | `src/domain/consuntivi/index.ts` (`validaOre`, `calcolaRiepilogoMese`) |
| Dati | `prisma/schema.prisma` (`RigaAttivita`, indice `RigaAttivita_collaboratore_data_createdAt_idx` dalla migrazione `20260728201452_indice_calendario_collaboratore`) |
| Test | `tests/unit/attivita.test.ts`, `tests/unit/righe-attivita-actions.test.ts`, `tests/unit/calendario.test.ts`, `tests/unit/riepilogo-mese.test.ts`, `tests/unit/storico-attivita-mensile.test.ts`, `tests/e2e/calendario-segregazione.spec.ts`, `tests/e2e/offerte-abilitate-inserimento.spec.ts`, `tests/e2e/clienti-abilitati-inserimento.spec.ts`, `tests/e2e/calendario-navigazione-reattiva.spec.ts`, `tests/unit/calendario-cache-provider.test.ts`, `tests/unit/attivita-calendario-route.test.ts`, `tests/e2e/calendario-cache-mesi.spec.ts`, `tests/e2e/cambio-rapido-giorno-dettaglio.spec.ts`, `tests/e2e/rimborso-trasferta-selezione.spec.ts`, `tests/e2e/calendario-salto-mese.spec.ts` e scenari attività dedicati |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

Le ore devono essere maggiori di zero e non superiori a 24 per singola riga; non esiste un limite alla somma giornaliera. Il rimborso, se presente, è una coppia etichetta/importo fotografata al salvataggio; non esiste più alcun vincolo di copertura da uno scaglione. La proprietà è applicata da filtri e controlli applicativi. Lo schema ha tre FK separate e non impone che `RigaAttivita.clienteId` coincida con il cliente dell'offerta. La creazione verifica sempre la coppia offerta-cliente e l'abilitazione; `modificaRiga` le ricontrolla entrambe non appena il form invia un'offerta diversa da quella corrente, usando il cliente del form o, in assenza, quello della riga — una modifica che lascia l'offerta invariata non le rivaluta. Inoltre `dettaglio-giornata.tsx` invia `fatturabile` soltanto quando la checkbox è selezionata e `modificaRiga` ignora il campo assente: dal flusso UI osservato una riga `true` non può quindi essere salvata come `false`. La regex delle action verifica il formato data ma non la validità civile; `Date.UTC` normalizza date impossibili. La tariffa corrente del collaboratore ricalcola retroattivamente l'imponibile del riepilogo, ma i rimborsi trasferta restano quelli fotografati sulle singole righe e non sono più influenzati dalla configurazione corrente: modificare o disattivare una voce del catalogo non altera nessuna riga già salvata.

<!-- archetipo:wiki section=verification -->
## Verifica

La suite unit copre segregazione, CRUD, validazioni, calendario, rimborso, riepilogo e l'enforcement dell'abilitazione offerta in `creaRiga`/`modificaRiga` (`tests/unit/righe-attivita-actions.test.ts`) e il filtro delle query `offerteAbilitatePerCliente` e `clientiAttiviPerSelezione` (`tests/unit/attivita.test.ts`, dove il payload Prisma esatto e la guardia `ErroreAutorizzazione` sono asseriti per entrambe). Gli E2E coprono flussi browser, ma alcuni scenari storici usano seed condivisi mentre i test mutanti recenti adottano factory e risorse riservate; `tests/e2e/offerte-abilitate-inserimento.spec.ts` copre la select offerte filtrata, il messaggio di assenza offerte abilitate — ora osservato sul cambio cliente esplicito durante la modifica, unico percorso ancora raggiungibile dopo il filtro dei clienti — e la modifica/eliminazione di una riga storica su offerta non abilitata. `tests/e2e/clienti-abilitati-inserimento.spec.ts` copre la select clienti filtrata (cliente abilitato presente, non abilitato assente), il messaggio `nessun-cliente-abilitato` con select assente e «Aggiungi riga» disabilitato, e la riga storica su cliente non abilitato che resta selezionata e salvabile a parità di offerta. La reattività della navigazione mensile è coperta da `tests/e2e/calendario-navigazione-reattiva.spec.ts`, che trattiene la lettura dati del mese di destinazione per osservare l'indicatore di caricamento. L'assenza di round-trip sul ritorno a un mese già visitato è provata da `tests/e2e/calendario-cache-mesi.spec.ts` con un gate che conta **e** aborta sia le navigazioni RSC verso `/attivita` sia le GET verso `/api/attivita/calendario`, così spostare i dati su un endpoint nuovo non può generare un falso positivo; lo stesso file copre miss con griglia precedente, race con risposte invertite, Back/Forward, reload e invalidazione dopo una mutazione. Le semantiche della cache — bordo esatto dei 300 000 ms, singola rivalidazione, deduplica, espulsione LRU, invalidazione di una risposta in volo e svuotamento — sono provate con orologio iniettato in `tests/unit/calendario-cache-provider.test.ts`, senza timer reali. Il confine dati è coperto da `tests/unit/attivita-calendario-route.test.ts` per validazione, 401/403 e header, dai casi sulla guardia d'identità in `tests/unit/calendario-cache-provider.test.ts`, e da `tests/e2e/calendario-segregazione.spec.ts`, che con due collaboratori factory prova sul browser che la risposta non contiene dati altrui. Confidenza alta sul comportamento descritto; i limiti server-side sono osservazioni esplicite, non invarianti presunte. `tests/e2e/cambio-rapido-giorno-dettaglio.spec.ts` copre il cambio giorno dal dettaglio giornata: il selettore data verso un giorno di un mese diverso (URL, intestazione e righe aggiornati), i pulsanti «Giorno precedente»/«Giorno successivo» attraverso un confine di mese in entrambe le direzioni, la registrazione della riga aggiunta dopo il cambio sul giorno effettivamente visualizzato — verificata anche nella cella corrispondente del calendario mensile — e la persistenza dell'URL al reload. `tests/e2e/rimborso-trasferta-selezione.spec.ts` copre la selezione della voce di rimborso dalla tendina, la fotografia di etichetta e importo sulla riga salvata e l'invarianza della riga rispetto a una successiva modifica del catalogo. Il salto diretto è coperto da `tests/e2e/calendario-salto-mese.spec.ts`: un mese riservato di un anno diverso da quello corrente risulta valorizzato nella cella subito dopo il salto, l'URL porta il token `?mese=YYYY-MM` ed è riapribile al reload, i controlli preesistenti ripartono coerentemente dal mese raggiunto («Mese successivo», poi «Mese corrente» con il campo di selezione risincronizzato sul mese in griglia) e un salto verso un mese quaranta mesi precedente a quello di partenza — quindi fuori dal prefetch dei mesi adiacenti e mai un hit di cache — mostra l'indicatore di attesa già esistente con `aria-busy=true` finché la lettura resta trattenuta, per poi scomparire a celle valorizzate. Come in `calendario-navigazione-reattiva.spec.ts` la finestra di attesa non nasce da un throttling reale né da un hard wait, ma da una `page.route` registrata prima del `goto` e sbloccata da una promessa dopo le asserzioni, così lo scenario resta deterministico e parallelizzabile.

## Concetti correlati

La lettura mensile del calendario segue [Cache client dei mesi del calendario collaboratore](/decisions/cache-client-calendario-collaboratore.md). Il rimborso trasferta sulla riga segue [Fotografia del rimborso trasferta sulla riga attività](/decisions/fotografia-rimborso-trasferta.md).

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Collaboratori](/domains/collaboratori.md), [Clienti](/domains/clienti.md), [Offerte](/domains/offerte.md), [Politiche di rimborso](/domains/politiche-rimborso.md) e [Fatturazione clienti](/domains/fatturazione-clienti.md).
