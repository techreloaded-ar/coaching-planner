---
type: decision
title: Prefetch dei mesi adiacenti nel calendario
description: Accettare letture potenzialmente stantie fino a cinque minuti in cambio di un cambio mese istantaneo
status: generated
decision_status: accepted
sources:
    - path: src/app/(front-office)/attivita/calendario-mensile.tsx
      role: implementation
    - path: src/lib/actions/righe-attivita.ts
      role: implementation
    - path: tests/e2e/calendario-prefetch-mesi.spec.ts
      role: verification
---
# Prefetch dei mesi adiacenti nel calendario

<!-- archetipo:wiki section=context -->
## Contesto

La rotta `/attivita` è dinamica e priva di boundary di caricamento: fino a US-050 ogni cambio mese attendeva un round-trip completo verso il server prima di mostrare qualsiasi cosa, e su rete lenta il click sembrava ignorato. Rendere la navigazione realmente veloce, e non solo apparentemente reattiva, richiede che i dati del mese di destinazione siano già nel browser al momento del click. Il product owner ha posto la velocità percepita come obiettivo prioritario e ha accettato in modo esplicito la contropartita sulla freschezza dei dati.

<!-- archetipo:wiki section=decision -->
## Decisione

Il calendario mensile prefetcha, a ogni cambio di mese visualizzato, i payload delle tre destinazioni raggiungibili dai controlli di navigazione: mese precedente, mese successivo e mese corrente. Il prefetch usa `router.prefetch(href, { kind, onInvalidate })` con payload completo, così che anche una rotta dinamica venga scaricata per intero e non nel solo guscio statico; `onInvalidate` ri-prefetcha la stessa destinazione quando il framework segnala il payload come stantio. I payload così ottenuti ricadono nella finestra `static` della cache client, cinque minuti per impostazione predefinita, e il cambio mese viene servito da lì senza nuova richiesta di rete.

<!-- archetipo:wiki section=alternatives -->
## Alternative

Nessun prefetch, limitandosi all'indicatore di caricamento: nessun rischio di dati stantii, ma nessun guadagno reale di velocità — l'attesa resta, viene solo resa visibile. Estendere la finestra di staleness globalmente configurando `experimental.staleTimes` nella configurazione del framework: stessa velocità sul calendario, ma la staleness si applicherebbe a ogni navigazione dell'applicazione e la configurazione è dichiarata sperimentale. Introdurre un boundary di caricamento a livello di rotta: abiliterebbe il prefetch parziale, ma sostituirebbe l'intera pagina con uno scheletro a ogni navigazione, perdendo la griglia del mese corrente che resta invece visibile durante la transizione.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Navigando tra mesi già prefetchati si possono osservare dati vecchi fino a cinque minuti: è la semantica di consistenza osservabile del calendario che cambia, ed è la ragione per cui la scelta è registrata come decisione. La finestra è però circoscritta alla singola scheda del browser, perché la cache client è in memoria, e tre mitigazioni la rendono accettabile: le server action di `src/lib/actions/righe-attivita.ts` chiamano `revalidatePath`, che purga la cache client, quindi le modifiche fatte dall'utente stesso sono immediatamente visibili; il dettaglio giornata forza inoltre un refresh dopo le scritture; il ricaricamento della pagina bypassa sempre la cache in memoria. Restano potenzialmente stantie soltanto le modifiche fatte da un altro attore sugli stessi dati, scenario marginale per un calendario personale segregato per collaboratore. Il prefetch comporta inoltre tre richieste aggiuntive per ogni mese visualizzato, e il framework lo attiva solo con il server di produzione: in sviluppo il comportamento non è osservabile.

<!-- archetipo:wiki section=verification -->
## Verifica

`tests/e2e/calendario-prefetch-mesi.spec.ts` prova la decisione con un oracolo di rete e non di tempo: attende l'evento reale della risposta di prefetch, clicca "Mese precedente" e verifica che le celle del mese adiacente siano valorizzate senza che sia partita alcuna nuova richiesta per quel mese. Lo spec si auto-esclude con motivazione esplicita quando il web server e2e non è di produzione, perché in quella modalità il prefetch non esiste, e gira sempre in integrazione continua. La reattività percepita, complementare ma indipendente da questa decisione, è coperta da `tests/e2e/calendario-navigazione-reattiva.spec.ts`.

## Concetti correlati

La decisione riguarda la navigazione mensile di [Attività](/domains/attivita.md) e si appoggia alle funzioni pure di calcolo mese registrate in [Calcoli di dominio in funzioni pure](/decisions/calcoli-puri.md).
