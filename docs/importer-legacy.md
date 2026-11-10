# Importazione incrementale dal vecchio sistema

La pagina amministrativa **Importazione** (`/importazione`) legge CLIENTI,
OFFERTE, COACH e GIORNATE dal documento Google configurato, senza modificarlo.
Considera tutte le date. Il flusso ordinario aggiunge i dati mancanti e aggiorna
le giornate riconosciute. Propone di eliminare quelle non più presenti: la
cancellazione avviene soltanto alla conferma di Importa, salvo scelta Mantieni nell’app.

## Uso

La vista presenta origine e analisi, riepilogo dei conteggi, giornate, nuove
anagrafiche e conferma finale. Le giornate sono ordinate per gruppi: Non più presenti nel foglio, Da verificare,
Su SENZA CODICE, Da aggiornare, Nuove e Scarti. Le giornate già presenti e
ignorate restano in elenchi chiusi con paginazione. I gruppi vuoti non compaiono
e viene aperto il primo gruppo operativo non vuoto. Gli aggiornamenti
mostrano subito soltanto i campi modificati, con valori nell'app e dal foglio;
il confronto completo rimane nei dettagli. Le anagrafiche sono richiudibili e
compaiono solo se ve ne sono da aggiungere. La data della lettura, il testo
tecnico sull'analisi e il messaggio di assistenza AI non configurata non sono mostrati.
Su desktop i comandi restano fermi e scorre soltanto il dettaglio centrale.
Su mobile scorre la pagina, con una sola barra Importa aderente al fondo.
La barra contiene riepilogo e conferme SENZA CODICE/reset e non compare se non
ci sono operazioni applicabili. Se tutte le giornate sono già presenti, la vista
mostra che il foglio è allineato senza aprire la lista.

1. All'apertura la pagina non mostra anteprime salvate. **Analizza foglio** legge il documento e confronta i dati con
   il database. L’analisi non modifica giornate o anagrafiche.
2. Controllare aggiunte, aggiornamenti, **Su SENZA CODICE** e **Scarti**. Le offerte dedotte univocamente
   e le righe ripetute sono accettate come nello script originale. Due righe identiche
   sono due giornate: dopo la prima importazione non vengono inserite nuovamente.
3. **Importa** applica tutte le righe valide in una transazione. Gli
   scarti non vengono importati. Gli aggiornamenti ambigui richiedono una scelta.
   Dopo la conferma appare soltanto l'esito: per i casi rimasti occorre una nuova analisi.
4. Ogni nuova lettura sostituisce l’unica anteprima corrente del documento. Non c’è
   uno storico navigabile. Il redirect dell'analisi identifica soltanto l'anteprima
   temporanea corrente, visibile al suo autore finché è in attesa di conferma.
   Tornando alla pagina dal menu, l'anteprima non viene riproposta. Le scelte non salvate
   sono sostituite insieme all’anteprima. Gli scarti vengono rivalutati ogni volta.

Il server conserva al massimo una fotografia operativa per documento, necessaria per
confermare ciò che è stato mostrato. Dopo ogni importazione riuscita la fotografia
viene eliminata nella stessa transazione, anche se restano scarti o casi non scelti.
In caso di errore resta disponibile per correggere e riprovare.
Nella pagina compare un solo pulsante **Analizza foglio**. Il registro riga → giornata conserva solo
l’associazione utile a riconoscere import precedenti; non è uno storico dei run.
Una conferma da una finestra con anteprima sostituita viene rifiutata.

## Riconoscimento e aggiornamenti

Con una colonna facoltativa **ID** in GIORNATE, l’ID deve essere unico e stabile:
la giornata collegata può essere aggiornata anche se data e ore cambiano o se il
foglio è riordinato. ID duplicati impediscono l’analisi.

Senza ID si usa la chiave **collaboratore + data + cliente + offerta + ore**,
con riferimenti risolti, date normalizzate e ore numeriche. Le occorrenze duplicate
vengono contate: si aggiungono solo quelle mancanti. Colonne accessorie, note e
formati del foglio non cambiano la chiave; eventuali altri valori diversi vengono
aggiornati sulla giornata riconosciuta.

I commenti già presenti nell’app vengono conservati anche quando il foglio non
contiene note. Un commento locale da solo non rende la giornata diversa.
Eventuali note della fonte vengono aggiunte senza duplicarle; anche gli
aggiornamenti delle ore o degli altri campi conservano i commenti locali.

Si riservano prima tutte le corrispondenze complete, indipendentemente dall’ordine
delle righe. Per le rimanenti si cerca la chiave senza ore: una sola riga del foglio
e una sola giornata candidata consentono l’aggiornamento automatico delle ore.
Con più righe o più candidate occorre scegliere **Aggiorna candidata**, **Aggiungi
come nuova** oppure **Ignora**. Una giornata non può essere aggiornata da due righe.
Una data, un cliente, un collaboratore o un’offerta diversi costituiscono una nuova
chiave; senza ID esplicito non si cerca una corrispondenza tra date differenti.
Le giornate precedentemente importate dallo stesso documento e non più ritrovate
compaiono in **Non più presenti nel foglio**, con i valori attuali nell'app.
La scelta predefinita è **Elimina dall’app**: la cancellazione viene conteggiata
nel riepilogo e applicata soltanto alla conferma di **Importa**, nella stessa
transazione degli altri aggiornamenti. Per conservare una giornata scegliere
**Mantieni nell’app** prima di confermare.
Le giornate manuali non vengono segnalate. Le giornate candidate per una riga
ancora presente sono escluse dalle rimozioni; quelle collegate anche a un altro
documento non possono essere eliminate da questo flusso. Una modifica del database
dopo l'analisi richiede una nuova lettura prima di confermare.
Senza ID stabile, cambiare data, cliente, collaboratore o offerta può apparire
come una nuova giornata e una precedente non più presente: controllare i due gruppi
prima di decidere. Le giornate mantenute saranno segnalate anche alle analisi successive.

## Regole delle anagrafiche e scarti

Clienti e offerte mancanti sono aggiunti prima delle giornate; quelli già presenti
vengono riutilizzati. Per un utente esistente senza profilo collaboratore viene
aggiunto il profilo con la tariffa del foglio, conservando identità, ruolo, account
Google e sessioni. Un profilo già esistente viene riutilizzato. Con il nuovo formato COACH, lo storico e lo stato del profilo vengono sincronizzati e mostrati nell’anteprima. Identità, ruolo e account degli utenti esistenti vengono conservati.

Le regole di lettura di date, numeri e categorie sono condivise
con `scripts/importa-storico`. L'importatore incrementale usa invece queste regole per le offerte:

- Codice vuoto o non trovato: associa a **SENZA CODICE** dello stesso cliente,
  anche se esiste un'unica altra offerta. Se manca, propone di crearla con tariffa
  e giorni previsti a zero, trasferte incluse e stato attivo. Le offerte già censite
  conservano i loro valori economici.
- Codice ambiguo tra più offerte: lascia la riga **Da verificare**. L'amministratore
  può scegliere **Importa su SENZA CODICE**, lasciarla in attesa o ignorarla.
- Codice intestato a un altro cliente: rimane uno scarto da correggere.
- Il gruppo **Su SENZA CODICE** mostra coach, data, cliente, ore,
  codice originale, motivo, destinazione e note finali. Le scelte sulle ambigue
  aggiornano il gruppo e il riepilogo prima dell'importazione.
- La spunta **Confermo le associazioni a SENZA CODICE** è obbligatoria anche lato
  server e si azzera quando cambia una decisione. Le offerte di ripiego vengono
  create nella stessa transazione, soltanto se usate dalle giornate approvate.
- La nota della giornata conserva il codice originale e il motivo del ripiego,
  in append alle note della fonte e dell'app, senza duplicare le annotazioni.
  Le letture successive riconoscono le giornate e le scelte già applicate;
  il collegamento precedente alla fonte evita duplicati anche quando cambia
  l'offerta per una giornata già importata.

Come nello script: abbinamento univoco per punteggiatura/contenimento
→ offerta dedotta annotata; ore mancanti → giorni fatturati × 8 oppure zero; clienti
esclusi → righe ignorate. Collaboratori non risolvibili, offerte di altri clienti,
date illeggibili e ore non valide producono scarti.

Non alternare questo flusso con lo script originale che cancella e reimporta per
periodo: la ricreazione delle giornate invalida le associazioni esistenti.

## Configurazione

L'importatore è sempre disponibile agli amministratori. Le sole variabili
obbligatorie sono documento sorgente e credenziali Google: usare il file reale
in produzione e quello demo in preproduzione.

Il formato è fisso: schede `CLIENTI`, `OFFERTE`, `COACH`, `GIORNATE`, cliente interno
`AGILERELOADED` e cliente escluso `ND`. La tariffa iniziale del vecchio formato
senza decorrenze parte da `2018-01`; il formato con periodi usa `DAL_MESE`.
Queste regole non richiedono variabili d'ambiente. Le vecchie variabili
`IMPORTER_ENABLED`, `IMPORTER_SCHEDA_*`, `IMPORTER_CLIENTE_INTERNO`,
`IMPORTER_CLIENTI_ESCLUSI` e `IMPORTER_PRIMO_MESE_TARIFFA` non sono più lette e
possono essere rimosse da Vercel.

| Variabile | Significato |
| --- | --- |
| `IMPORTER_GOOGLE_SPREADSHEET_ID` | ID del documento Google |
| `IMPORTER_GOOGLE_SERVICE_ACCOUNT_JSON` | Chiave JSON completa del service account, segreto del server |
| `IMPORTER_EMAIL_AMMINISTRATORI` | Email dei nuovi coach amministratori; non cambia ruoli esistenti |
| `IMPORTER_AI_BASE_URL`, `IMPORTER_AI_API_KEY`, `IMPORTER_AI_MODEL` | Assistenza facoltativa via endpoint Chat Completions |

Abilitare Google Sheets API e condividere il foglio come Visualizzatore con il
service account. Non serve delega di dominio. Chiavi e token non arrivano al browser.
L’AI resta facoltativa: trasmette al provider configurato fino a 40 casi e 20 clienti
per analisi; proposte non valide o errori non cambiano gli abbinamenti deterministici.
I dati cliente estratti richiedono conferma prima del salvataggio.

## Concorrenza e verifica

La conferma usa una transazione serializzabile e un lock PostgreSQL. Una revisione
del database cambiata dopo l’analisi richiede una nuova lettura. Il server non rilegge
Google durante la conferma. Google e AI hanno timeout espliciti; maxDuration è 120
secondi, subordinato all’hosting. Il limite è 30.000 righe per analisi.
Le nuove anagrafiche cliente/offerta, le giornate nuove o aggiornate e il registro
vengono salvati in blocchi da 500; le abilitazioni collaboratore/offerta vengono
deduplicate prima dell'inserimento. Tutti i blocchi restano nella stessa
transazione, con limite di 60 secondi: un errore annulla anche quelli già eseguiti.
Gli errori inattesi registrano lato server fase, durata, tipo e codice Prisma,
senza dati del foglio o parametri SQL. Scadenza/interruzione della transazione e
conflitti concorrenti hanno messaggi distinti nell'interfaccia.

Unit test: `npm test`. I test reali distruttivi accettano esclusivamente un database
locale dedicato chiamato `importer_test`, con le migrazioni applicate:

```sh
IMPORTER_TEST_DATABASE_URL='postgresql://…@127.0.0.1:PORT/importer_test' \
  npx vitest run --config tests/integration/vitest.config.ts
```

Il test browser usa un database locale `importer_browser_e2e` e una build creata
con `npm run build`. Non usa Google o AI reali:

```sh
DATABASE_URL='postgresql://…@127.0.0.1:PORT/importer_test' \
E2E_DATABASE_URL='postgresql://…@127.0.0.1:PORT/importer_browser_e2e' \
E2E_PORT=3108 npx playwright test --config tests/integration/playwright.config.ts
```

Le anteprime precedenti alla versione 6 sono incompatibili e non vengono proposte; avviare una nuova
lettura. Il vecchio reset completo resta protetto lato servizio per compatibilità,
ma non è esposto nel flusso ordinario di append/aggiornamento.


## COACH con decorrenze e cessazioni

Il tab COACH contiene una riga per periodo, con colonne `ID`, `NOME`,
`COGNOME`, `EMAIL`, `DAL_MESE`, `AL_MESE`, `TIPOLOGIA`, `IMPORTO`.
Lo stesso ID/email può comparire più volte con anagrafica coerente. ID diversi
non possono condividere un'email. I periodi vengono ordinati prima di importarli.

- `DAL_MESE` è obbligatorio nel nuovo formato: `YYYY-MM`.
- `AL_MESE` è inclusivo; vuoto significa periodo aperto. Una riga aperta non
  può precedere un altro periodo: chiuderla esplicitamente. Sono ammessi buchi
  per interruzioni e rientri. Sovrapposizioni, doppie decorrenze e date invalide
  bloccano l'analisi prima di qualsiasi scrittura.
- `TIPOLOGIA`: `GIORNALIERA`, `FISSO_MENSILE`, `PERCENTUALE`. Restano accettati
  gli alias legacy GIORNATA e FISSO. `IMPORTO` è in euro per i primi due tipi,
  in percentuale trattenuta dall'azienda per il terzo: 30 significa 70% al coach.
- Il collaboratore è attivo se ha un periodo valido nel mese corrente. In caso
  contrario profilo e accesso collaboratore sono disattivati, conservando tutte
  le attività storiche. L'accesso amministratore non viene disattivato.
- Il reset conserva gli utenti amministratori, account OAuth e sessioni; ricrea
  i dati applicativi e gli eventuali loro profili collaboratore dal foglio.
- L'incrementale propone anche aggiornamenti di periodi e stato dei coach
  presenti nel foglio. Non elimina utenti manuali assenti dal foglio.
- Il vecchio formato senza DAL_MESE conserva la tariffa iniziale configurata;
  non sovrascrive i profili collaboratore già censiti.

Le scadenze sono conservate nel database e rispettate da riepilogo,
fatturazione e marginalità, anche per collaboratori oggi cessati.

### Verifica locale con fotografia del foglio

`scripts/verifica-importazione-locale.ts` esercita il servizio transazionale
reale con una fotografia JSON delle quattro matrici Google (`coach`, `clienti`,
`offerte`, `giornate`, intestazioni incluse). Richiede DATABASE_URL esplicita,
accetta soltanto il database locale `coaching_planner` e richiede `--reset`.
Non legge file .env. Eseguire prima un backup del database.

```sh
DATABASE_URL='postgresql://…@127.0.0.1:5432/coaching_planner' \
NODE_OPTIONS='--conditions=react-server' \
npx tsx scripts/verifica-importazione-locale.ts /percorso/source.json --reset
```

Questa prova distruttiva conserva gli amministratori, importa le righe valide,
associa le offerte ambigue a SENZA CODICE e registra gli eventuali scarti nel
report JSON accanto alla fotografia. Verifica stato e periodi, preservazione
degli amministratori e un secondo import incrementale senza duplicazioni.

### Attività PAIR

Una riga PAIR è fatturabile in affiancamento: conserva tutte le ore lavorate e
pagate al coach; fatturazione cliente, marginalità e avanzamento offerta contano
metà di quelle ore. Le trasferte non vengono dimezzate. L'import incrementale
aggiorna anche i PAIR precedentemente classificati come non fatturabili.
Le righe ND sono scarti attesi e non costituiscono differenze di riconciliazione.
L'anteprima usa la versione 6: rigenerare le anteprime precedenti.
