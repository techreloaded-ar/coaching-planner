---
type: decision
title: Feedback di attesa e cursore uniformi
description: Cursore dal base layer e un unico PulsanteAttesa basato su useFormStatus, invece di classi e wiring pending ad hoc su ogni pulsante
status: reviewed
decision_status: accepted
sources:
    - path: src/app/globals.css
      role: implementation
      symbol: comparsa-caricamento
    - path: src/components/pulsante-attesa.tsx
      role: implementation
      symbol: PulsanteAttesa
    - path: src/app/(back-office)/anagrafiche/utenti/utente-form.tsx
      role: implementation
    - path: src/app/(front-office)/attivita/[data]/dettaglio-giornata.tsx
      role: implementation
    - path: tests/e2e/feedback-attesa-azioni.spec.ts
      role: verification
review:
    content_hash: sha256:d4337736ff45912e04fc7a373f34f18ecf7ce0ec3e45a6dbaa15e7be7eba10c5
    evidence_revision: 684073cbe95870736f7b37fbbe2fcccb01a7dd38
    evidence_hash: sha256:5403ad961d0496b93d69aa80c6380b4afa216784f6129216f8bac074f5acbabb
    reviewed_at: "2026-07-31T15:56:23Z"
---
# Feedback di attesa e cursore uniformi

<!-- archetipo:wiki section=context -->
## Contesto

L'applicazione usa Tailwind v4 tramite `@import "tailwindcss"`, e il suo preflight non applica più `cursor: pointer` ai `button`: si allinea al default del browser, che è la freccia. Il censimento ha trovato solo 8 elementi in tutta l'app con `cursor-pointer` esplicito; gli altri circa 60 pulsanti mostravano la freccia, quindi non si leggevano come cliccabili.

Sul fronte dell'attesa convivevano tre pattern divergenti, ognuno nato per il proprio caso:

- l'overlay del calendario, con `aria-busy` e il keyframe `comparsa-caricamento` per evitare il flash sulle transizioni rapide;
- lo spinner locale di `src/app/accesso-google.tsx`, gestito con stato del componente;
- lo scambio di etichetta ottenuto dal terzo elemento di `useActionState` in `utente-form.tsx`.

Su 21 punti di submit censiti, quello degli utenti era l'unico form con un feedback reale: ovunque altrove un invio lento non produceva alcun segnale, e nulla impediva il doppio invio.

<!-- archetipo:wiki section=decision -->
## Decisione

Il feedback di attesa e il cursore diventano un contratto unico, applicato in due soli punti di cambiamento.

**1. Cursore dal base layer.** Una regola `@layer base` in `globals.css` porta `cursor: pointer` su `button:not(:disabled)` e sugli elementi con `[role="button"]` non disabilitati. Il layer base è meno specifico delle utility, quindi `disabled:cursor-not-allowed` e simili continuano a prevalere dove servono. Restano fuori — e mantengono le loro classi esplicite — i `<tr onClick>` delle tabelle, le label delle checkbox e i `Link` del calendario, perché non sono `button` e non espongono `role="button"`.

**2. Pulsante condiviso `PulsanteAttesa`.** Il componente client `src/components/pulsante-attesa.tsx` è costruito su `useFormStatus()` di React 19: dentro un `<form action=...>` conosce da solo lo stato dell'invio, senza che il chiamante gli passi nulla. Durante l'attesa si disabilita, espone `aria-busy="true"`, mostra la rotellina a comparsa ritardata riusando il keyframe `comparsa-caricamento` già presente per il calendario, e opzionalmente scambia l'etichetta con `etichettaAttesa`. La prop `attesaEsterna` copre i flussi imperativi fuori da un form action, dove `useFormStatus` è per definizione sempre `false`: se valorizzata si somma allo stato del form.

**3. Modali senza chiusura ottimistica.** I modali di conferma non si chiudono all'atto del click: restano aperti con il pulsante in attesa fino all'esito. Chiudere prima dell'esito farebbe sparire proprio la superficie su cui l'errore andrebbe comunicato.

Nessun modale chiude sé stesso: **la chiusura non è mai comandata dal client**. Il criterio è come l'action risponde, e la distinzione non è simmetrica.

Le action che comunicano con `redirect()` non restituiscono nulla: Next **rigetta** la promise dell'action al posto di risolverla, quindi qualunque codice scritto dopo il loro `await` non viene mai eseguito e non esiste alcun esito da leggere lato client. Per queste — invalidazione utente, eliminazione voce di rimborso, cambio stato offerta — il form invoca l'action nuda, senza wrapper: l'attesa resta sul pulsante fino alla navigazione, che smonta il sottoalbero e con esso il modale. Non si tenta di ricostruire l'esito lato client: sarebbe codice morto.

Quando una di queste action ha un modo di fallire, l'errore viaggia sui parametri dell'URL e compare sul banner della pagina di destinazione. È il caso dell'invalidazione utente: `cambiaStatoUtenteAction` redirige su `?errore=ultimo-amministratore` e la pagina utenti legge quel parametro. L'eliminazione di una voce di rimborso (`eliminaVoceRimborso`, `src/app/(back-office)/anagrafiche/voci-rimborso/actions.ts`) e il cambio stato di un'offerta appartengono alla stessa categoria — redirigono, e nemmeno a loro si può chiedere un esito lato client — ma non hanno alcun ramo d'errore: redirigono solo sull'esito positivo, e le rispettive pagine leggono il solo parametro `esito`.

Le action che tornano uno stato al chiamante lo fanno solo per fallire. L'eliminazione di un'offerta restituisce `{ errore }` quando è bloccata, e quel messaggio compare dentro il modale, che resta aperto con il pulsante di nuovo abilitato; quando invece riesce, redirige come le altre. Il modale non ha quindi bisogno di alcun meccanismo di chiusura: lo stato di errore lo tiene aperto, il redirect lo smonta.

**4. Contratto osservabile.** Il segnale verificabile dall'esterno è `aria-busy` sul pulsante durante l'attesa. È lo stesso contratto già testato per l'overlay del calendario, quindi l'app espone una sola convenzione di attesa, non due.

<!-- archetipo:wiki section=alternatives -->
## Alternative

**Classi e wiring pending ad hoc su ogni pulsante e ogni form** (lo status quo, esteso a tutti i punti di submit). Scartata: significa toccare una ventina di file con logica duplicata, e soprattutto lascia la coerenza affidata alla disciplina di chi scrive la prossima spec. La deriva sarebbe garantita, esattamente come lo è stata finora con gli 8 pulsanti su circa 68 che avevano il cursore giusto.

**Migrazione integrale di tutti i form a `useActionState` con il terzo elemento `isPending`.** Scartata perché invasiva: i form con action semplice `(formData) => void` andrebbero riscritti per restituire uno stato che non serve loro ad altro, e la migrazione non coprirebbe comunque i flussi imperativi che non passano da un form action. `useFormStatus` ottiene lo stesso segnale senza modificare la firma delle action esistenti.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

La superficie di cambiamento resta minima — una regola CSS e un componente — e il comportamento è uniforme su front office e back office, comprese le spec future che riusano il componente senza doverne conoscere i dettagli.

Il tradeoff sta nei form di anagrafica: React 19 azzera i campi non controllati prima di ogni form action, quindi dopo un invio fallito i `defaultValue` devono essere ripopolati con i valori dell'ultimo invio, altrimenti l'utente si ritrova il form vuoto. È il prezzo di far passare l'attesa dallo stato del form anziché da stato locale.

I campi restano **non controllati di proposito**, ed è una lezione appresa durante l'implementazione: renderli controllati introdurrebbe una corsa con l'idratazione. Quanto l'utente digita prima che il componente sia idratato verrebbe cancellato al primo render, perché lo stato React parte dal valore iniziale e sovrascrive il DOM. Ripopolare i `defaultValue` è il rimedio corretto; passare a campi controllati sposterebbe il problema su un difetto peggiore e più difficile da riprodurre.

<!-- archetipo:wiki section=verification -->
## Verifica

La spec e2e `tests/e2e/feedback-attesa-azioni.spec.ts` verifica sul browser il contratto osservabile: durante l'invio il pulsante espone `aria-busy` ed è disabilitato, i modali di conferma restano aperti fino all'esito, e i valori digitati sopravvivono a un invio fallito.

## Concetti correlati

La convenzione `aria-busy` è la stessa dell'overlay descritto in [Cache client dei mesi del calendario collaboratore](/decisions/cache-client-calendario-collaboratore.md); il componente condiviso è censito nella [mappa del codice](/engineering/code-map.md).
