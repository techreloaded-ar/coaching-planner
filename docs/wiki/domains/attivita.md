---
id: domains.attivita
type: domain
summary: Consuntivazione giornaliera del lavoro, calendario e riepilogo mensile del collaboratore
status: reviewed
classification: candidate
links:
    - id: architecture.context-map
      relation: participates-in
    - id: domains.collaboratori
      relation: references-operational-profile
    - id: domains.clienti
      relation: references-client
    - id: domains.offerte
      relation: references-engagement
    - id: domains.politiche-rimborso
      relation: consumes-reimbursement-policy
    - id: domains.fatturazione-clienti
      relation: supplies-activity-facts
sources:
    - path: src/lib/actions/righe-attivita.ts
      role: inbound-commands
      symbol: creaRiga, modificaRiga, eliminaRiga, rimuoviTrasferta
    - path: src/lib/attivita.ts
      role: application-query
      symbol: attivitaDelMese, righeDelGiorno, riepilogoMese
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
    - path: tests/e2e/calendario-segregazione.spec.ts
      role: verification
review:
    content_hash: sha256:aba114b4022ff7c22a2ff8296d1477cfe3052ea09126c2f87ebf5fd81af01d8b
    evidence_revision: 82aa87a3bc73c8e8f42bf1d162c6973dbdf76978
    reviewed_at: "2026-07-16T14:24:23Z"
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

`creaRiga`, `modificaRiga`, `eliminaRiga` e `rimuoviTrasferta` restituiscono `{ success, error? }`. Le query espongono attività per giorno/mese e un `RisultatoRiepilogoMese` serializzabile. Il profilo deve essere `ATTIVO`; le offerte selezionabili devono appartenere al cliente ed essere attive.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. Le pagine e le action risolvono il profilo; solo l'esito derivato `ATTIVO` consente operazioni.
2. La creazione verifica campi, coerenza offerta-cliente, stato offerta, ore, km/scaglione e formato data, poi scrive una nuova `RigaAttivita` per il collaboratore corrente.
3. Modifica, eliminazione e rimozione trasferta verificano l'identificativo proprietario prima della write.
4. La lettura mensile filtra sempre per `collaboratoreId` e intervallo del mese, poi aggrega per giorno.
5. Il riepilogo somma ore, converte con 8 ore/giorno, include nell'imponibile solo ore fatturabili e aggiunge i rimborsi validi.
6. Non esiste uno stato lifecycle persistito della riga. `fatturabile` e `trasfertaKm` sono campi direttamente aggiornabili; gli esiti del calcolo rimborso non sono transizioni.

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| UI | `src/app/(front-office)/attivita/**` |
| Comandi | `src/lib/actions/righe-attivita.ts` |
| Query | `src/lib/attivita.ts` |
| Calendario | `src/domain/calendario/index.ts` |
| Regole e riepilogo | `src/domain/consuntivi/index.ts` |
| Dati | `prisma/schema.prisma` (`RigaAttivita`) |
| Test | `tests/unit/attivita.test.ts`, `tests/unit/righe-attivita-actions.test.ts`, `tests/unit/calendario.test.ts`, `tests/unit/riepilogo-mese.test.ts`, `tests/e2e/calendario-segregazione.spec.ts` e scenari attività dedicati |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

Le ore devono essere maggiori di zero e non superiori a 24 per singola riga; non esiste un limite alla somma giornaliera. I km, se presenti, sono interi positivi coperti da uno scaglione. La proprietà è applicata da filtri e controlli applicativi. Lo schema ha tre FK separate e non impone che `RigaAttivita.clienteId` coincida con il cliente dell'offerta. La creazione verifica la coppia; `modificaRiga` la ricontrolla solo quando riceve insieme un nuovo cliente e una nuova offerta, quindi una chiamata parziale può produrre incoerenza semantica. La regex delle action verifica il formato data ma non la validità civile; `Date.UTC` normalizza date impossibili. Tariffa e scaglioni correnti ricalcolano retroattivamente il riepilogo.

<!-- archetipo:wiki section=verification -->
## Verifica

La suite unit copre segregazione, CRUD, validazioni, calendario, rimborso e riepilogo. Gli E2E coprono flussi browser, ma alcuni scenari storici usano seed condivisi mentre i test mutanti recenti adottano factory e risorse riservate. Confidenza alta sul comportamento descritto; i limiti server-side sono osservazioni esplicite, non invarianti presunte.
