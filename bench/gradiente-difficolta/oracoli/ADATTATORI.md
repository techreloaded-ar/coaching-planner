# Istruzioni per scrivere un adattatore (T1–T4)

Sei il valutatore esterno di un benchmark. Un team ha consegnato una funzionalità (o una correzione) di Coaching Planner. L'oracolo è già installato in `__oracolo__/` e **non va modificato**. Scrivi SOLO l'adattatore che collega l'oracolo alle interfacce reali della consegna.

## 1. Cosa produrre

| Compito | File da scrivere in `__oracolo__/adattatore/` | Tipo esportato (da `__oracolo__/contratto.ts`) |
|---|---|---|
| T1 referente | `integrazione.ts`, `browser.ts` | `adattatoreIntegrazione: AdattatoreIntegrazione`, `adattatoreBrowser: AdattatoreBrowser` |
| T2 marginalità | `integrazione.ts`, `browser.ts` | come sopra |
| T3 tariffe storicizzate | `dati.ts`, `integrazione.ts`, `browser.ts` | + `adattatoreDati: AdattatoreDati` |
| T4 totali che non tornano | `integrazione.ts`, `browser.ts` | come sopra |

Leggi per intero `__oracolo__/contratto.ts` e `__oracolo__/shared/contratto-comune.ts`: i commenti JSDoc di ogni operazione sono vincolanti. `__oracolo__/adattatore-nullo/` mostra la forma attesa (per T3 e T4 contiene già la mappatura delle funzioni della baseline, in `shared/proiezioni-baseline.ts`: è il modello da seguire quando la consegna ha cambiato nomi o firme).

## 2. Regole non negoziabili

1. **Traduci, non implementare.** L'adattatore traduce firme, nomi dei campi del `FormData`, nomi delle proprietà, percorsi e locator. Le sole trasformazioni ammesse sui valori sono `Number(stringa)` e la scelta/rinomina di campi.
2. **Nessun calcolo.** Niente somme, arrotondamenti, conversioni ore→giornate, margini, percentuali, scelta della tariffa vigente, date di fine calcolate. Se la consegna non espone un valore, usa `null` dove il tipo lo consente, altrimenti `throw new NonImplementato("motivo")`.
3. **Nessun controllo.** Niente verifiche di ruolo, di periodo, di sovrapposizione, di formato email/telefono: devono stare nel prodotto. Non intercettare errori per trasformarli in successi; non far passare un'operazione che il prodotto rifiuta. Un rifiuto restituito (non lanciato) va tradotto solo dove il contratto lo prevede (T2 `RifiutoMarginalita`).
4. **Interfacce reali.** Chiama le server action, i route handler e le funzioni di lettura che usa davvero l'interfaccia della consegna, con i parametri che l'interfaccia passerebbe. Se una server action ha la firma `useActionState` `(statoPrecedente, formData)`, passa lo stato iniziale usato dal componente del form.
5. **Capacità mancante → `NonImplementato`.** Importalo da `../contratto`. Mai simulare la capacità nell'adattatore, mai fallback sulla baseline per una capacità che la consegna non ha.
6. **Non modificare nulla fuori da `__oracolo__/adattatore/`**: né `src/`, né `prisma/`, né `tests/`, né i file dell'oracolo o il contratto. Ogni modifica esterna viene scartata dal banco.
7. **Non eseguire test né avviare server** (la porta 3000 è riservata). Sono ammessi solo i controlli del §6.

## 3. Ambiente di esecuzione

### Livello integrazione (`integrazione.ts`, `dati.ts` in Vitest)
- Gira nello stesso processo dell'app con Vitest; alias `@/` → `src/`. Importa le funzioni con `@/...` (es. `@/lib/report`, `@/app/(back-office)/anagrafiche/clienti/actions`).
- La sessione è **già impostata** dall'oracolo con un cookie firmato con la chiave reale: non creare sessioni, non chiamare `createSession`, non leggere o forzare il ruolo.
- `redirect()` di Next lancia `Error("NEXT_REDIRECT:<url>")`: lascialo propagare (l'oracolo verifica lo stato persistito).
- Letture dirette della persistenza (es. `referentePersistito`, `validita`): `import { db } from "@/lib/db"` oppure SQL; restituisci i valori come stanno, senza normalizzarli.

### Livello browser (`browser.ts`) e `dati.ts` di T3 (anche in Playwright)
- Gira nel processo Playwright: **non** importare `@/lib/db`, `server-only` o moduli dell'app (il client Prisma TS non si carica nel transform di Playwright). Per SQL usa `import { e2ePrisma } from "../../tests/e2e/support/prisma"` (pool `pg` su `E2E_DATABASE_URL`).
- La pagina è già autenticata con il ruolo indicato dal test; contesto con fuso `Europe/Rome`, locale `it-IT`, larghezza 1440 o 390 px.
- Locator: ruoli, label, testo esatto, `data-testid` esistenti; mai classi Tailwind; niente `waitForTimeout`. Per «attendi l'esito» usa attese web-first (`await expect(locator).toBeVisible()`, `page.waitForURL(...)`, oppure la prima tra le due con `Promise.race` di `waitFor`). Per il primo click su handler client dopo una navigazione, rispetta `data-idratata` (vedi `tests/e2e/README.md`).
- Un metodo che ritorna `Locator` non deve fare asserzioni: le assert stanno nei test.

### Convenzioni sui valori
- Importi e giornate: `number` ottenuti con `Number(...)` dai valori della consegna, senza `toFixed`/`Math.round`.
- Date: stringhe `YYYY-MM-DD`; mesi: `YYYY-MM`. Se la consegna usa `Date`, converti con `toISOString().slice(0, 10)` per colonne `DATE` (mezzanotte UTC), senza spostare giorni.

## 4. Indicazioni per compito

### T1 · Referente del cliente
- `creaCliente`/`aggiornaReferente`: costruisci il `FormData` con i nomi dei campi del form reale. In `aggiornaReferente`, se la action salva anche l'anagrafica, rimanda tutti gli altri campi con i valori persistiti correnti (come li precompila il form di modifica); i valori del referente vanno passati **esattamente** come ricevuti (anche `"    "` o email malformate: la validazione è del prodotto).
- `referentePersistito`: valori grezzi della persistenza; `null` se colonna NULL o riga assente (se il referente sta in una tabella separata, nessuna riga = tutti `null`).
- `clientePerDettaglio`: la funzione che la pagina di dettaglio usa per leggere il cliente.
- `ruoloUtenteCliente`: `null` salvo che la consegna introduca un ruolo dedicato agli utenti esterni.
- `controlliModificaReferente`: tutti i campi/pulsanti/link della pagina corrente che consentono di modificare il referente o il cliente (input del referente, «Modifica», «Salva»).

### T2 · Marginalità
- `reportMarginalita(da, a)`: la stessa catena della pagina. Se la pagina valida il periodo con una funzione della consegna, chiamala prima della lettura; se la funzione restituisce un errore, traducilo in `{ rifiutato: true, motivo }`. Non riordinare i mesi.
- Mappa ogni voce del report (cliente, offerta, collaboratore) sui tipi del contratto. Se il dettaglio collaboratori esiste solo dentro le offerte, `perCollaboratore` del cliente è `null` (e viceversa). Non calcolare ricavi/margini dei collaboratori se la consegna non li espone: `null`.
- `scalaPercentuale`: dichiara come la consegna espone il margine percentuale (`"punti"` = 37.5, `"frazione"` = 0.375). Percentuale non calcolata dalla consegna → `null`.
- Browser: `impostaPeriodoDaInterfaccia` deve usare SOLO i controlli della pagina (select, input mese, pulsanti), non l'URL.

### T3 · Tariffe con validità nel tempo
- `dati.ts` è setup sintetico in SQL (`e2ePrisma`), perché gira anche in Playwright. Scrive Utente/Collaboratore/Offerta e le validità nella schema **reale** della consegna, come le scriverebbe il prodotto: se la schema conserva anche una tariffa «corrente» (es. colonna rimasta su `Offerta`), valorizzala con la tariffa vigente oggi tra quelle passate; se la consegna memorizza la fine delle validità, scrivila come farebbe il prodotto. Questa è preparazione dati, non logica di prodotto: non validare, non rifiutare.
- `decorrenza: null` nel setup = validità iniziale aperta verso il passato: usa la stessa rappresentazione che usa la migrazione della consegna per le tariffe preesistenti (NULL o data sentinella).
- `validita()`: righe persistite, senza calcolare fini implicite. `semanticaFine`: `"esplicita"` se la consegna memorizza la fine di ogni validità chiusa, `"implicita"` se la fine è data dalla decorrenza successiva.
- Usa namespace del parametro `namespace` per email (`<namespace>-...@e2e.invalid`), codici offerta e cognomi univoci; `creaCollaboratore` crea anche l'Utente con il ruolo richiesto.
- `pianificaTariffa`/`correggiUltimaTariffa`: le server action reali della gestione tariffe (stessa catena del form). Se la consegna non ha una correzione dell'ultima tariffa → `NonImplementato`.
- Le letture (`riepilogoMese`, `importiFatturazioneCliente`, `avanzamentoOfferta`) partono da `shared/proiezioni-baseline.ts`: adegua solo i nomi se la consegna li ha cambiati.
- Il file `migrazione/migrazione.test.ts` usa lo stesso adattatore dopo la migrazione dei dati reali: `validita()` deve funzionare anche per entità create prima della migrazione.

### T4 · I totali non tornano
- Tutte le capacità esistevano già: parti da `adattatore-nullo/` (mappatura baseline). Se la consegna ha cambiato nomi, firme o struttura dei risultati, segui la consegna. Mai ricalcolare giornate dalle ore: l'oracolo verifica proprio i valori del prodotto.

## 5. Che cosa NON fare (esempi di adattatore invalido)
- `giornateFatturabili: r.oreFatturabili / 8` → calcolo nell'adattatore.
- `if (sessione.ruolo !== "AMMINISTRATORE") throw ...` → controllo di autorizzazione nell'adattatore.
- `if (da > a) return { rifiutato: true }` → validazione nell'adattatore.
- `validita.map((v, i) => ({ ...v, fine: giornoPrima(successiva.decorrenza) }))` → fine calcolata.
- `catch { return null }` attorno a una server action → rifiuto trasformato in esito neutro.
- `NonImplementato` su una capacità che la consegna HA (anche se con nome diverso): cercala prima nel codice.

## 6. Verifiche consentite prima di consegnare l'adattatore
Dalla radice della copia (nessun server, nessun database):
```bash
npx tsc -p __oracolo__/shared/tsconfig.oracolo.json
DATABASE_URL=postgresql://x@127.0.0.1:1/x E2E_DATABASE_URL=postgresql://x@127.0.0.1:1/x npx vitest list --config __oracolo__/vitest.config.ts
DATABASE_URL=postgresql://x@127.0.0.1:1/x E2E_DATABASE_URL=postgresql://x@127.0.0.1:1/x npx playwright test --list --config __oracolo__/playwright.config.ts
```
Alla fine elenca: le operazioni dichiarate `NonImplementato` con il motivo; per ogni operazione implementata, la funzione/action/pagina della consegna a cui è collegata (file e simbolo).

## 7. Prompt fisso per la sessione che genera l'adattatore
> Sei il valutatore esterno di un benchmark. In questo repository un team ha consegnato il compito «{titolo}» di Coaching Planner. L'oracolo è in `__oracolo__/`: leggi `__oracolo__/ADATTATORI.md` (queste istruzioni), `__oracolo__/contratto.ts` e `__oracolo__/shared/contratto-comune.ts`, poi scrivi SOLO i file di `__oracolo__/adattatore/` indicati per {compito}. Collega le interfacce reali della consegna, senza calcoli, controlli o capacità simulate; lancia `NonImplementato` per ciò che manca. Non modificare altro, non avviare server, non eseguire test: puoi solo fare typecheck e discovery come indicato al §6. Non fare domande. Alla fine elenca le operazioni NonImplementato e i collegamenti.

`installa_oracolo.py` copia questo file in `__oracolo__/ADATTATORI.md`, quindi il prompt può citarlo per percorso.
