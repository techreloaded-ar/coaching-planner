# Importazione incrementale dal vecchio sistema

La pagina amministrativa **Importazione** (`/importazione`) legge CLIENTI,
OFFERTE, COACH e GIORNATE dal documento Google configurato, senza modificarlo.
Considera tutte le date. Il flusso ordinario aggiunge i dati mancanti e aggiorna
le giornate riconosciute: non cancella le giornate assenti dal documento.

## Uso

1. All'apertura la pagina non mostra anteprime salvate. **Analizza foglio** legge il documento e confronta i dati con
   il database. L’analisi non modifica giornate o anagrafiche.
2. Controllare aggiunte, aggiornamenti, **Da importare su SENZA CODICE** e **Scarti**. Le offerte dedotte univocamente
   e le righe ripetute sono accettate come nello script originale. Due righe identiche
   sono due giornate: dopo la prima importazione non vengono inserite nuovamente.
3. **Importa e aggiorna** applica tutte le righe valide in una transazione. Gli
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

Si riservano prima tutte le corrispondenze complete, indipendentemente dall’ordine
delle righe. Per le rimanenti si cerca la chiave senza ore: una sola riga del foglio
e una sola giornata candidata consentono l’aggiornamento automatico delle ore.
Con più righe o più candidate occorre scegliere **Aggiorna candidata**, **Aggiungi
come nuova** oppure **Ignora**. Una giornata non può essere aggiornata da due righe.
Una data, un cliente, un collaboratore o un’offerta diversi costituiscono una nuova
chiave; senza ID esplicito non si cerca una corrispondenza tra date differenti.
Le giornate assenti dal foglio restano nel database.

## Regole delle anagrafiche e scarti

Clienti e offerte mancanti sono aggiunti prima delle giornate; quelli già presenti
vengono riutilizzati. Per un utente esistente senza profilo collaboratore viene
aggiunto il profilo con la tariffa del foglio, conservando identità, ruolo, account
Google e sessioni. Un profilo già esistente viene riutilizzato.

Le regole di lettura di date, numeri e categorie sono condivise
con `scripts/importa-storico`. L'importatore incrementale usa invece queste regole per le offerte:

- Codice vuoto o non trovato: associa a **SENZA CODICE** dello stesso cliente,
  anche se esiste un'unica altra offerta. Se manca, propone di crearla con tariffa
  e giorni previsti a zero, trasferte incluse e stato attivo. Le offerte già censite
  conservano i loro valori economici.
- Codice ambiguo tra più offerte: lascia la riga **Da verificare**. L'amministratore
  può scegliere **Importa su SENZA CODICE**, lasciarla in attesa o ignorarla.
- Codice intestato a un altro cliente: rimane uno scarto da correggere.
- Il gruppo **Da importare su SENZA CODICE** mostra coach, data, cliente, ore,
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

| Variabile | Significato |
| --- | --- |
| `IMPORTER_ENABLED` | `true` abilita il servizio |
| `IMPORTER_GOOGLE_SPREADSHEET_ID` | ID del documento Google |
| `IMPORTER_GOOGLE_SERVICE_ACCOUNT_JSON` | Chiave JSON completa del service account, segreto del server |
| `IMPORTER_PRIMO_MESE_TARIFFA` | Mese della tariffa iniziale, predefinito `2018-01` |
| `IMPORTER_EMAIL_AMMINISTRATORI` | Email dei nuovi coach amministratori; non cambia ruoli esistenti |
| `IMPORTER_CLIENTE_INTERNO` | Predefinito `AGILERELOADED` |
| `IMPORTER_CLIENTI_ESCLUSI` | Nomi separati da virgola, predefinito `ND` |
| `IMPORTER_SCHEDA_CLIENTI`, `IMPORTER_SCHEDA_OFFERTE`, `IMPORTER_SCHEDA_COACH`, `IMPORTER_SCHEDA_GIORNATE` | Nomi delle schede |
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

Le anteprime precedenti alla versione 4 sono incompatibili e non vengono proposte; avviare una nuova
lettura. Il vecchio reset completo resta protetto lato servizio per compatibilità,
ma non è esposto nel flusso ordinario di append/aggiornamento.
