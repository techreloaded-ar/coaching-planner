# Import dello storico

Carica nel Coaching Planner i quattro fogli dello storico (CLIENTI, OFFERTE, COACH,
GIORNATE) da un Google Sheets dell'account Agile Reloaded o da un file `.xlsx` esportato.
Nessuna dipendenza in più: lettura CSV/xlsx e accesso al database usano ciò che il
progetto ha già (Prisma, `tsx`).

```bash
cp scripts/importa-storico/.env.importa-storico.example scripts/importa-storico/.env.importa-storico
# compila DATABASE_URL, FOGLIO_ORIGINE, GOOGLE_SERVICE_ACCOUNT_FILE, EMAIL_AMMINISTRATORI

npm run db:importa-storico -- --dry-run          # prova a secco: legge tutto, scrive niente
npm run db:importa-storico                       # aggiunge ciò che manca, non tocca l'esistente
npm run db:importa-storico -- --reset            # svuota prima le tabelle applicative
npm run db:importa-storico -- giornate --dry-run # un solo passo (clienti|offerte|coach|rimborsi|giornate)
npm run db:importa-storico -- --config altro.env
```

Tutto avviene in un'unica transazione: o entra tutto o niente. Senza `--reset` lo script è
**additivo**: inserisce solo ciò che non trova e non modifica mai ciò che esiste, così si
può rilanciare dopo ogni aggiornamento del foglio. Le chiavi di confronto:

| Entità | Chiave |
|---|---|
| Cliente | ragione sociale (spazi compattati, maiuscole ignorate) |
| Offerta | cliente + codice offerta |
| Coach | email dell'utente, a cui l'`ID` del foglio corrisponde |
| Voce di rimborso | etichetta |
| Riga attività | collaboratore + data + cliente + offerta |
| Riga sospesa | tutti i valori grezzi della riga |

Il confronto è solo con ciò che c'è nel database all'inizio del lancio: le righe del foglio
non trovate entrano tutte, anche se ripetute tra loro. Con `--reset` entra quindi ogni riga
del foglio.

`--reset` svuota utenti, collaboratori, tariffe, clienti, offerte, righe attività, righe
sospese e abilitazioni; non tocca le voci di rimborso trasferta.

## Accesso al Google Sheets

Lo script legge il foglio con un **service account** del progetto Google Cloud di Agile
Reloaded (lo stesso delle credenziali OAuth dell'applicazione), così il documento resta
privato e condiviso solo con quell'identità tecnica. Una volta sola:

1. Google Cloud Console → *API e servizi* → *Libreria*: abilita **Google Sheets API**.
2. *IAM e amministrazione* → *Account di servizio* → *Crea*: nome a piacere (es.
   `coaching-planner-import`), nessun ruolo necessario.
3. Nell'account appena creato: *Chiavi* → *Aggiungi chiave* → *JSON*. Salva il file in
   `scripts/importa-storico/lavoro/service-account.json` (cartella ignorata da git) e
   indica il percorso in `GOOGLE_SERVICE_ACCOUNT_FILE`.
4. Nel foglio Google: *Condividi* → incolla l'email del service account
   (`...@<progetto>.iam.gserviceaccount.com`) come **Visualizzatore**.

Lo script firma un JWT con la chiave, ottiene un token in sola lettura
(`spreadsheets.readonly`) e legge ogni scheda con la Sheets API, valori non formattati
(numeri e date seriali, come nell'xlsx). Senza `GOOGLE_SERVICE_ACCOUNT_FILE` il foglio deve
essere condiviso come "Chiunque abbia il link può visualizzare" e viene letto in CSV anonimo.
Con `FOGLIO_ORIGINE` che punta a un `.xlsx` non serve nulla di tutto questo.

## Regole per scheda

**CLIENTI** — la ragione sociale è la colonna `Cliente`. Le altre colonne (`Intestazione
Fattura`, `Indirizzo Fatturazione`, `Partita Iva`, `Modalità invio fattura`, `Persona di
riferimento`) sono testo libero: per i clienti che ne hanno almeno una compilata lo script
chiama `claude -p` (Claude Code, con la sottoscrizione attiva nel terminale, senza alcun
tool) e ottiene partita IVA, codice fiscale, indirizzo, città, CAP, provincia, PEC e codice
SDI, più la persona di riferimento con i suoi contatti. Ogni campo passa poi da `validaCliente`: quello che non è valido per l'applicazione
viene tolto e riportato nelle `note`, insieme a tutto ciò che non ha un campo (intestazione
fattura diversa dal nome, persone di riferimento, email non PEC, dubbi). Le risposte sono
salvate in `lavoro/clienti-inferiti.json`: le prove a secco successive non richiamano Claude
finché la riga del foglio non cambia.

**OFFERTE** — una per coppia (cliente, codice); `createdAt` è il 1° gennaio dell'anno in
`Data`. Codice vuoto → `SENZA CODICE`. `Tipologia Spese` che inizia con "forfait" →
FORFETTARIA con l'importo di `Spese Forfait` (se vuoto o zero, il predefinito di
configurazione); tutto il resto (vuoto, incluse, piè di lista) → INCLUSA. `Tariffa
Giornaliera` vuota → 0, nessun predefinito; `Numero Giornate Previste` vuoto → 0. `STATO`
APERTA → attiva. `Account` → account Agile Reloaded dell'offerta, `Numero Ordine / BEF` →
numero d'ordine. Un cliente
presente solo qui viene creato con la sola ragione sociale. Le coppie duplicate sono
elencate nel riepilogo e saltate.

**COACH** — un `Utente` per riga con profilo `Collaboratore` e tariffa iniziale da
`PRIMO_MESE_TARIFFA` (`TIPOLOGIA` GIORNATA → giornaliera, FISSO → fisso mensile). Nome e
cognome tutti maiuscoli vengono riportati con l'iniziale maiuscola. Il foglio non dice chi
amministra: gli indirizzi in `EMAIL_AMMINISTRATORI` ricevono il ruolo AMMINISTRATORE. La
colonna `ID` è la chiave che la scheda GIORNATE usa nella colonna `Coach`.

**RIMBORSI** — le voci di `VOCI_RIMBORSO_TRASFERTA` (`etichetta = importo`, separate da
`;`) vengono create se mancano, prima delle giornate, così le righe con `Spese Coach`
agganciano l'etichetta giusta.

**GIORNATE** — ogni riga diventa una `RigaAttivita` oppure una `RigaAttivitaSospesa` con il
primo motivo riscontrato (collaboratore, cliente, offerta, dati), secondo
`docs/righe-attivita-sospese-approccio.md`. Le righe sospese si vedono nel back office e nel
report `lavoro/righe-sospese.csv`. In particolare:

- `Coach` si risolve tramite l'`ID` della scheda COACH e l'email dell'utente;
- il codice offerta si abbina esatto, poi a meno di spazi e punteggiatura, poi per
  contenimento se la corrispondenza è una sola (annotato come "offerta dedotta"); con codice
  vuoto si usa l'offerta `SENZA CODICE` o l'unica offerta del cliente, altrimenti la riga
  entra con offerta da definire;
- `Ore` vuote → `Giorni Fatturati verso Cliente` × 8, altrimenti 0 con nota; ore zero o
  superiori a 24 entrano così come sono (vincolo solo del form, non del database);
- `Tipologia Fatturazione`: FATTURABILE, NON FATTURABILE, INVESTIMENTO, più i valori
  storici PIANIFICATA (fatturabile) e PAIR (non fatturabile); vuota → fatturabile, tranne
  per `CLIENTE_INTERNO` → non fatturabile;
- `Spese Coach` > 0 → rimborso trasferta sulla riga, con l'etichetta della voce di rimborso
  che ha lo stesso importo, altrimenti "Spese dal foglio storico";
- per ogni coppia (collaboratore, offerta) incontrata viene creata l'abilitazione.

I clienti in `CLIENTI_ESCLUSI` (predefinito: ND) sono ignorati in tutte le schede.

## Modulo riusabile

Normalizzazione, ricerca dell'offerta, categoria e lettura di date e numeri stanno in
`src/domain/righe-sospese/abbinamento.ts` (test in
`tests/unit/abbinamento-righe-storiche.test.ts`), pronti per le future azioni guidate sulle
righe sospese.
