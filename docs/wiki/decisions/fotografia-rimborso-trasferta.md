---
type: decision
title: Fotografia del rimborso trasferta sulla riga attività
description: Congelare etichetta e importo della voce di rimborso sulla riga al salvataggio, senza chiave esterna né versioning delle voci
status: reviewed
decision_status: accepted
sources:
    - path: prisma/schema.prisma
      role: implementation
      symbol: RigaAttivita.rimborsoTrasfertaEtichetta
    - path: prisma/schema.prisma
      role: implementation
      symbol: RigaAttivita.rimborsoTrasfertaImporto
    - path: prisma/schema.prisma
      role: implementation
      symbol: VoceRimborsoTrasferta
    - path: src/lib/actions/righe-attivita.ts
      role: implementation
      symbol: fotografaVoceRimborsoTrasferta
    - path: src/lib/actions/righe-attivita.ts
      role: implementation
      symbol: duplicaRigaSuGiorni
    - path: tests/unit/righe-attivita-actions.test.ts
      role: verification
    - path: tests/e2e/rimborso-trasferta-selezione.spec.ts
      role: verification
    - path: tests/e2e/duplica-riga-su-giorni.spec.ts
      role: verification
review:
    content_hash: sha256:6ff0bca461dfe3ded881bc87cfebfcce43b8f30ec1ec9c44ad8430b66569fe03
    evidence_revision: 67133f5adf25203fb1b17a224c25b5b65dd89772
    evidence_hash: sha256:9a0bf9241f1cc3c31b2f55412353af9c345cef7747677d70876afc9e01dd423a
    reviewed_at: "2026-08-06T16:26:38Z"
---
# Fotografia del rimborso trasferta sulla riga attività

<!-- archetipo:wiki section=context -->
## Contesto

Fino a US-054 il rimborso trasferta non era un dato della riga attività: la riga conservava i chilometri percorsi e l'importo veniva ricalcolato a ogni lettura confrontando quei chilometri con la configurazione corrente degli scaglioni. Il risultato mostrato dipendeva quindi dallo stato dell'anagrafica nel momento della lettura, non nel momento del salvataggio.

Questo rendeva i rimborsi storici instabili: bastava che un amministratore correggesse l'importo di uno scaglione, o ne eliminasse uno, perché riepiloghi mensili e report di fatturazione già consultati cambiassero retroattivamente, senza che nessuna riga fosse stata toccata. Un mese chiuso poteva così valere una cifra diversa a distanza di settimane.

<!-- archetipo:wiki section=decision -->
## Decisione

La riga attività fotografa il rimborso al salvataggio. `RigaAttivita` porta due campi propri, `rimborsoTrasfertaEtichetta` (`String?`) e `rimborsoTrasfertaImporto` (`Decimal(10,2)?`), copiati da `VoceRimborsoTrasferta { etichetta, importo }` nell'istante in cui la riga viene creata o modificata; la copia avviene in `fotografaVoceRimborsoTrasferta` (`src/lib/actions/righe-attivita.ts`), che risolve la voce selezionata e restituisce i due valori da scrivere.

Fra `RigaAttivita` e `VoceRimborsoTrasferta` non esiste alcuna relazione: nessuna chiave esterna, nessun `voceRimborsoTrasfertaId` persistito. L'id della voce vive solo nella richiesta di salvataggio, il tempo necessario a leggerne etichetta e importo. I due campi sono un valore congelato, non un riferimento, e non viene introdotta alcuna tabella di storicizzazione delle voci.

Da US-057 i percorsi con cui la coppia etichetta/importo finisce su una riga sono **due**, ed è una distinzione sostanziale, non una sfumatura di implementazione:

1. la **fotografia dal catalogo**, quando la riga viene creata o modificata scegliendo una voce nella tendina: `fotografaVoceRimborsoTrasferta` legge `VoceRimborsoTrasferta` e copia i valori correnti sulla riga;
2. la **propagazione da una riga già fotografata**, quando una riga viene duplicata su altri giorni: `duplicaRigaSuGiorni` copia `rimborsoTrasfertaEtichetta` e `rimborsoTrasfertaImporto` **dalla riga di origine** e non interroga affatto il catalogo — `fotografaVoceRimborsoTrasferta` non è invocata su questo percorso.

Lo scatto viaggia cioè da riga a riga, non da voce a riga. Rileggere il catalogo durante una duplicazione violerebbe proprio questa decisione: la copia riporterebbe il valore corrente della voce anziché quello congelato sulla sorgente, e una riga duplicata potrebbe valere una cifra diversa dalla riga da cui è nata — per di più senza che nessuno abbia toccato l'una o l'altra.

<!-- archetipo:wiki section=alternatives -->
## Alternative

Persistere una chiave esterna verso `VoceRimborsoTrasferta` e continuare a ricalcolare l'importo a lettura. Scartata perché riprodurrebbe esattamente il difetto che questa decisione corregge: il totale storico resterebbe agganciato alla configurazione corrente e cambierebbe a ogni modifica della voce.

Persistere la chiave esterna e affiancarle una tabella di versioning delle voci, risolvendo la versione valida alla data della riga. È la soluzione formalmente più ricca, ma la storicizzazione o versioning delle voci di rimborso è dichiarata fuori perimetro nella user story: il costo di modello e di query non è giustificato quando il valore da conservare è una sola coppia etichetta/importo.

<!-- archetipo:wiki section=consequences -->
## Conseguenze

I totali storici sono stabili nel tempo: una riga salvata continua a mostrare l'etichetta e l'importo del momento del salvataggio, qualunque cosa accada dopo all'anagrafica delle voci.

Riepilogo mensile e report di fatturazione diventano una somma diretta del campo `rimborsoTrasfertaImporto` delle righe, senza alcun calcolo a lettura e senza dover caricare la configurazione dei rimborsi per produrre un totale.

L'eliminazione di una voce è sempre consentita e non richiede alcun controllo di integrità referenziale: non essendoci chiave esterna, non ci sono righe da bloccare o da riassegnare. La voce sparisce dalla tendina delle nuove righe e le righe già salvate restano intatte.

Il rovescio della medaglia è che le righe già salvate non si allineano a una correzione dell'anagrafica: se un importo era stato configurato per errore, va corretto riga per riga. È il comportamento voluto — la fotografia è un dato contabile, non una cache.

La propagazione estende quel rovescio alla duplicazione, con due conseguenze concrete. Duplicare una riga il cui importo era stato configurato per errore **propaga l'errore** su tutti i giorni di destinazione, che andranno corretti uno per uno come la sorgente. E duplicare una riga la cui voce è stata nel frattempo modificata o eliminata dal catalogo continua a produrre l'**importo storico**, non quello corrente e non un errore di voce mancante. Entrambi i comportamenti sono voluti e discendono dalla stessa premessa: una copia della fotografia resta la stessa fotografia.

<!-- archetipo:wiki section=verification -->
## Verifica

`prisma/schema.prisma` dichiara i due campi su `RigaAttivita` e non definisce alcuna relazione verso `VoceRimborsoTrasferta`; il modello della voce non ha campo inverso. `src/lib/actions/righe-attivita.ts` invoca `fotografaVoceRimborsoTrasferta` sia in creazione sia in modifica e scrive i valori restituiti, rifiutando il salvataggio se la voce selezionata non esiste più.

`tests/unit/righe-attivita-actions.test.ts` copre la copia dei valori al salvataggio, il caso di selezione assente (entrambi i campi a `null`) e il rifiuto di una voce non più disponibile. `tests/e2e/rimborso-trasferta-selezione.spec.ts` verifica end-to-end che, modificato l'importo di una voce già usata, la riga salvata e il riepilogo mensile mantengano l'importo fotografato.

La **propagazione** è provata da un oracolo negativo: nello stesso file unit, il blocco `duplicaRigaSuGiorni` asserisce che `voceRimborsoTrasferta.findUnique` **non è mai chiamato** durante una duplicazione, oltre a verificare che il payload di `createMany` riporti l'etichetta e l'importo della riga sorgente. L'oracolo negativo è necessario, non ridondante: la sola uguaglianza dei valori passerebbe anche con un'implementazione che rilegge il catalogo e trova per caso gli stessi valori — che è esattamente il difetto da escludere, perché diventerebbe visibile solo quando il catalogo è cambiato. Sul browser, `tests/e2e/duplica-riga-su-giorni.spec.ts` verifica che su ciascun giorno di destinazione la riga replicata mostri la stessa etichetta e lo stesso importo di rimborso della sorgente.

## Concetti correlati

La decisione riguarda [Politiche di rimborso trasferta](/domains/politiche-rimborso.md) e [Attività e consuntivazione](/domains/attivita.md), e si appoggia su [Importi monetari decimali](/decisions/importi-decimali.md) per la rappresentazione dell'importo e su [Calcoli di dominio in funzioni pure](/decisions/calcoli-puri.md) per la somma dei rimborsi.
