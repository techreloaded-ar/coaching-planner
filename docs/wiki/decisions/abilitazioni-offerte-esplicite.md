---
type: decision
title: Abilitazioni esplicite collaboratore-offerta
description: Persistere l'ingaggio collaboratore-offerta in una tabella dedicata, revocabile, con pre-popolamento una tantum
status: reviewed
decision_status: accepted
sources:
    - path: prisma/schema.prisma
      role: implementation
      symbol: AbilitazioneOfferta
    - path: scripts/backfill-abilitazioni-iniziali.ts
      role: implementation
    - path: src/lib/abilitazioni.ts
      role: implementation
    - path: tests/unit/backfill-abilitazioni-iniziali.test.ts
      role: verification
    - path: tests/e2e/abilitazioni-collaboratore.spec.ts
      role: verification
review:
    content_hash: sha256:1821d50e50fcfa7a4d72cffb6ff3fafe28d93c968c0fd1e0d876963c5fb826b7
    evidence_revision: 684073cbe95870736f7b37fbbe2fcccb01a7dd38
    evidence_hash: sha256:a3b49db09cb06ddc025d6a109293884063e1de86156c5436c6e037da5fc79c24
    reviewed_at: "2026-07-31T15:56:35Z"
---
# Abilitazioni esplicite collaboratore-offerta

<!-- archetipo:wiki section=context -->
## Contesto

US-042, US-043 e US-044 richiedono di rappresentare un ingaggio esplicito e revocabile tra un collaboratore e un'offerta: chi può registrare attività su quale offerta è una decisione operativa che cambia nel tempo, non un fatto derivabile a posteriori. Le sole righe attività non bastano a rappresentarlo, perché registrano cosa è già stato fatto e non cosa è consentito fare; inoltre US-043 prevede esplicitamente righe attività preesistenti su offerte per cui l'abilitazione non è (più) presente, situazione che un modello puramente derivato non potrebbe esprimere.

<!-- archetipo:wiki section=decision -->
## Decisione

Persistere l'abilitazione in una tabella dedicata `AbilitazioneOfferta`, con coppia unica `(collaboratoreId, offertaId)`, così da rendere l'ingaggio un fatto esplicito, interrogabile e revocabile indipendentemente dallo storico delle attività registrate.

Popolare questa tabella una tantum tramite uno script iniettabile (`scripts/backfill-abilitazioni-iniziali.ts`), protetto da una guardia che esegue il backfill solo se la tabella è vuota. Lo script viene eseguito manualmente al primo rilascio in produzione e automaticamente all'interno del seed di sviluppo/test, cosicché gli ambienti che partono da un database vuoto ottengano comunque uno stato iniziale coerente senza richiedere un intervento manuale.

<!-- archetipo:wiki section=alternatives -->
## Alternative

**Abilitazione derivata dalle righe attività**: dedurre l'abilitazione osservando se esistono già righe attività del collaboratore sull'offerta. Scartata perché rende la revoca impossibile da rappresentare (un'abilitazione derivata da attività storiche non può mai "spegnersi") e contraddice esplicitamente US-043, che prevede righe attività preesistenti su offerte non (più) abilitate.

**Backfill dentro la migrazione SQL**: eseguire il popolamento iniziale come parte della migrazione Prisma stessa. Scartata perché non è testabile unitariamente con gli strumenti di test standard del progetto e non è osservabile negli ambienti e2e/CI, che applicano le migrazioni partendo da un database vuoto: in quel contesto il backfill-in-migrazione non avrebbe righe preesistenti su cui operare, mascherando eventuali difetti della logica di pre-popolamento.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

Le revoche di abilitazione sono definitive rispetto ai run successivi dello script: una volta che la tabella contiene almeno una riga, la guardia impedisce ulteriori backfill automatici, quindi una revoca esplicita sopravvive ai seed e ai deploy successivi.

Se la tabella viene svuotata manualmente dopo il primo rilascio (ad esempio per un intervento di manutenzione), un run successivo dello script la ripopolerebbe da zero in base alle righe attività esistenti, perdendo eventuali revoche già effettuate. Questo limite è accettato e documentato: la guardia protegge dal doppio backfill in condizioni normali, non da uno svuotamento intenzionale della tabella.

Il primo rilascio in produzione richiede l'esecuzione manuale di `npm run db:backfill-abilitazioni` subito dopo `db:migrate:deploy`, perché la tabella `AbilitazioneOfferta` nasce vuota e nessuna riga attività storica avrebbe altrimenti un'abilitazione corrispondente.

<!-- archetipo:wiki section=verification -->
## Verifica

`tests/unit/backfill-abilitazioni-iniziali.test.ts` copre la logica di pre-popolamento e la guardia tabella-vuota in isolamento. `tests/e2e/abilitazioni-collaboratore.spec.ts` verifica il comportamento end-to-end dell'abilitazione esplicita, inclusa la revoca, tramite collaboratori e offerte creati da factory secondo il contratto e2e del progetto.

## Concetti correlati

La decisione supporta [Collaboratori](/domains/collaboratori.md) e [Offerte](/domains/offerte.md) ed è collegata alle specifiche US-042, US-043 e US-044 del backlog di delivery (`.archetipo/backlog.yaml`).
