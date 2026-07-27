---
type: domain
title: Identità, sessioni e accesso
description: Censimento utenti, accesso Google, sessione JWT, ruoli, policy di rotta e segregazione dei dati
status: generated
classification: candidate
sources:
    - path: src/app/api/auth/google/route.ts
      role: inbound-api
      symbol: GET
    - path: src/app/api/auth/google/callback/route.ts
      role: inbound-api
      symbol: GET
    - path: src/lib/session-token.ts
      role: session-domain
    - path: src/proxy.ts
      role: access-policy-adapter
      symbol: proxy
    - path: src/lib/dal.ts
      role: authorization
    - path: scripts/bootstrap-amministratore-iniziale.ts
      role: identity-bootstrap-command
      symbol: eseguiBootstrapAmministratoreIniziale, validaEmailAmministratoreIniziale
    - path: src/app/(back-office)/anagrafiche/utenti/actions.ts
      role: identity-commands
      symbol: creaUtente, aggiornaUtente
    - path: src/app/(back-office)/anagrafiche/utenti/cambia-stato-utente-action.ts
      role: identity-lifecycle-command
      symbol: cambiaStatoUtenteAction
    - path: src/domain/anagrafiche/protezione-amministratore.ts
      role: identity-invariant
      symbol: violaProtezioneUltimoAmministratore
    - path: src/lib/utenti.ts
      role: identity-queries
      symbol: elencaUtenti, utentePerId
    - path: src/domain/anagrafiche/valida-utente.ts
      role: identity-validation
      symbol: validaCensimentoUtente, validaModificaUtente
    - path: src/app/(back-office)/anagrafiche/utenti/page.tsx
      role: identity-administration-ui
    - path: src/app/(back-office)/anagrafiche/utenti/utente-form.tsx
      role: identity-administration-ui
    - path: src/app/(back-office)/anagrafiche/utenti/utenti-tabella.tsx
      role: identity-administration-ui
    - path: prisma/schema.prisma
      role: identity-data
      symbol: Utente, Account, Ruolo
    - path: tests/unit/dal-guards.test.ts
      role: verification
    - path: tests/unit/utenti-actions.test.ts
      role: verification
    - path: tests/unit/valida-utente.test.ts
      role: verification
    - path: tests/unit/cambia-stato-utente.test.ts
      role: verification
    - path: tests/unit/google-callback.test.ts
      role: verification
    - path: tests/unit/protezione-amministratore.test.ts
      role: verification
    - path: tests/e2e/autorizzazione-ruoli.spec.ts
      role: verification
    - path: tests/e2e/gestione-utenti.spec.ts
      role: verification
    - path: tests/unit/bootstrap-amministratore-iniziale.test.ts
      role: verification
---
# Identità, sessioni e accesso

<!-- archetipo:wiki section=purpose -->
## Scopo

Censisce le identità autorizzate, autentica tramite Google persone già censite, emette una sessione stateless e governa stato e ruolo dell'utente. Il DAL riconcilia l'identità con il database prima delle operazioni applicative e applica l'autorizzazione autorevole.

<!-- archetipo:wiki section=language -->
## Linguaggio

Utente censito, utente attivo o invalidato, account Google, email verificata, state, PKCE code verifier, sessione, cookie `cp_sessione`, token JWT, rinnovo sliding, ruolo `AMMINISTRATORE` o `COLLABORATORE`, profilo operativo, 401, 403 e segregazione.

<!-- archetipo:wiki section=ownership -->
## Ownership

Possiede `Utente`, compresi identità anagrafica, email di accesso, ruolo e stato `attivo`, oltre a integrazione Google, `Account`, token/cookie, validità della sessione, policy di rotta e guardie. I ruoli Amministratore e Collaboratore sono combinabili sullo stesso utente, sia in creazione sia nell'intero ciclo di vita successivo: il ruolo di accesso "Collaboratore" è derivato dalla presenza e dallo stato del profilo `Collaboratore` (enum `ruolo` più profilo opzionale coprono le tre combinazioni ammesse), non da un set di ruoli persistito — vedi la decisione [Ruoli combinabili derivati dal profilo collaboratore](/decisions/ruoli-combinabili-profilo-derivato.md). `creaUtente` e `aggiornaUtente` in censimento diventano così un secondo e un terzo writer coordinato di `Collaboratore`, in aggiunta alle action Collaboratori: il primo quando l'amministratore seleziona il ruolo Collaboratore contestualmente alla creazione dell'utente, il secondo quando aggiunge o toglie il ruolo Collaboratore su un utente già censito, applicando la transizione di profilo coerente (creazione, riattivazione o disattivazione) nella stessa transazione dell'aggiornamento utente; `Collaboratore.attivo` e le sue transizioni restano comunque di proprietà di Collaboratori, che ne definisce il contratto. Lo script di deploy `scripts/bootstrap-amministratore-iniziale.ts` è un writer aggiuntivo, ma limitato alla sola creazione idempotente del primo `Utente AMMINISTRATORE` da `AMMINISTRATORE_INIZIALE_EMAIL`: non promuove né riattiva utenti già censiti.

<!-- archetipo:wiki section=contracts -->
## Contratti

`GET /api/auth/google` avvia OAuth; il callback accetta `code`, `state` e cookie temporanei e rifiuta con il messaggio generico anche un `Utente.attivo = false`. Il JWT contiene `utenteId`, ruolo, nome, email ed `expiresAt`. Il proxy classifica root, OAuth, seam E2E e rotte protette e verifica soltanto la sessione JWT. Il DAL espone guardie con redirect per RSC e `ErroreAutorizzazione(401|403)` per API/action, rileggendo a database stato e ruolo. Le pagine `/anagrafiche/utenti`, `/anagrafiche/utenti/nuovo` e `/anagrafiche/utenti/[id]/modifica`, le query `elencaUtenti`/`utentePerId` e le action `creaUtente`, `aggiornaUtente` e `cambiaStatoUtenteAction` richiedono il ruolo amministratore.

Sia in creazione (`creaUtente`) sia in modifica (`aggiornaUtente`), il form usa lo stesso fieldset a checkbox indipendenti (`ruoloAmministratore`, `ruoloCollaboratore`, entrambi opzionali ma non simultaneamente assenti), validati rispettivamente da `validaCensimentoUtente` e `validaModificaUtente`: nessun ruolo selezionato è rifiutato con l'errore "Seleziona almeno un ruolo" senza alcuna scrittura. Quando il ruolo Collaboratore è selezionato, cognome, partita IVA e tariffa giornaliera sono richiesti con gli stessi controlli e messaggi dell'anagrafica collaboratori (helper condivisi `validaCampoPartitaIva`/`validaCampoTariffaGiornaliera` di `src/domain/anagrafiche/valida-collaboratore.ts`) — ma solo quando il profilo non esiste ancora: `validaModificaUtente` riceve `profiloPresente` e non richiede mai quei campi se un profilo (attivo o disattivato) è già collegato all'utente, coerentemente con l'assenza della sezione profilo nel form in quel caso.

<!-- archetipo:wiki section=flows -->
## Flussi osservati

1. L'avvio genera `state` e code verifier e li scrive in cookie HttpOnly per 10 minuti.
2. Il callback verifica cookie, query, state, scambio Google, email verificata e presenza dell'utente; rifiuta con lo stesso errore generico un utente invalidato (`Utente.attivo = false`) e un collaboratore censito con profilo esplicitamente disattivato.
3. `src/app/api/auth/google/callback/route.ts` esegue `db.account.upsert`: il ramo create assegna `userId`, provider, subject e access token; il ramo update assegna soltanto l'access token. `createSession` in `src/lib/session.ts` scrive poi il cookie JWT e il callback reindirizza a `/attivita`.
4. `verificaERinnovaTokenSessione` in `src/lib/session-token.ts` assegna nel nuovo token `expiresAt = now + 8h`; `src/proxy.ts` riscrive il cookie sulle richieste previste. Non esiste una write alla tabella Prisma `Session` nel flusso osservato.
5. Logout e pulizia token in `src/lib/session.ts` impostano il cookie vuoto con `maxAge: 0`.
6. Il proxy verifica e rinnova il solo JWT per consentire l'accesso a una rotta protetta, senza consultare il database né decidere per ruolo. Il DAL rilegge invece `Utente`, inclusi `attivo`, ruolo e stato profilo, prima dei dati protetti: una sessione già aperta di utente invalidato diventa non autenticata al primo consumer DAL e un cambio ruolo ha effetto al primo accesso protetto successivo.
7. L'amministratore raggiunge `/anagrafiche/utenti` dalla console, ricerca e legge nome, email, ruolo, `Utente.attivo` e l'eventuale stato separato del profilo collaboratore.
8. `creaUtente` normalizza nome ed email, valida nome/email e i ruoli combinabili con `validaCensimentoUtente`, impedisce duplicati anche traducendo il vincolo Prisma `P2002` (l'email già esistente è sempre un errore di duplicato, non viene mai riusato un utente esistente) e crea in un'unica transazione un utente con `attivo = true` per default di schema; assegna `ruolo: "AMMINISTRATORE"` se il ruolo Amministratore è selezionato, altrimenti `"COLLABORATORE"`. Se il ruolo Collaboratore è selezionato, la stessa transazione crea anche `Collaboratore` (`userId`, cognome, partita IVA, tariffa normalizzata, `attivo: true`) componendo `Utente.nome` come `"{nome} {cognome}"`; l'elenco utenti deriva quindi due badge di ruolo indipendenti (Amministratore dall'enum, Collaboratore dall'enum oppure dalla sola presenza del profilo). `aggiornaUtente`, in modifica, legge fuori transazione utente e profilo, valida con `validaModificaUtente` e calcola il nuovo ruolo dai checkbox; nella transazione aggiorna nome/email/ruolo (componendo `Utente.nome` come in creazione solo quando crea il profilo) e applica sul profilo esattamente una transizione: crea se il ruolo Collaboratore è aggiunto senza profilo preesistente, riattiva (solo `attivo: true`) se aggiunto con profilo disattivato, disattiva (`attivo: false`, mai una delete) se tolto con profilo attivo, altrimenti nessuna scrittura; rivalida l'anagrafica collaboratori solo quando il profilo è stato toccato.
9. `cambiaStatoUtenteAction` invalida o riattiva nella stessa transazione `Utente.attivo` e, se presente, `Collaboratore.attivo`; rivalida entrambe le anagrafiche. L'invalidazione non elimina il record.
10. La retrocessione di un amministratore attivo e la sua invalidazione contano gli altri amministratori attivi nella transazione e vengono rifiutate se rimuoverebbero l'ultimo; la promozione e gli altri cambi ruolo sono salvati da `aggiornaUtente`. `creaCollaboratore` assegna `COLLABORATORE` soltanto quando crea un nuovo utente; un amministratore riusato mantiene il suo ruolo.
11. Al deploy, `scripts/bootstrap-amministratore-iniziale.ts` valida `AMMINISTRATORE_INIZIALE_EMAIL` prima di aprire qualunque connessione al database; cerca l'utente per email normalizzata (`trim` + `toLowerCase`) e, solo se assente, crea un `Utente` con ruolo `AMMINISTRATORE`, nome predefinito e `attivo = true` da default di schema. Se l'utente esiste già (qualunque ruolo o stato) termina con successo senza scrivere nulla.

<!-- archetipo:wiki section=code -->
## Codice

| Aspetto | Percorsi |
|---|---|
| OAuth | `src/app/api/auth/google/**`, `src/lib/google-oauth.ts` |
| Sessione | `src/lib/session-config.ts`, `src/lib/session-token.ts`, `src/lib/session.ts` |
| Policy anticipata | `src/proxy.ts`, `src/lib/policy-rotte.ts` |
| Identità autorevole e guardie | `src/lib/dal.ts` |
| Amministrazione utenti | `src/app/(back-office)/anagrafiche/utenti/**`, `src/lib/utenti.ts`, `src/domain/anagrafiche/valida-utente.ts`, `src/domain/anagrafiche/protezione-amministratore.ts` |
| Bootstrap deploy | `scripts/bootstrap-amministratore-iniziale.ts` |
| Fail-fast | `src/instrumentation.ts`, `next.config.ts` |
| Dati | `prisma/schema.prisma` e `prisma/migrations/20260721084945_aggiungi_stato_attivo_utente/migration.sql` (`Utente`, `Account`; `Session` e `VerificationToken` dichiarati ma non usati dal flusso corrente) |
| Test | test unit `session*`, `proxy`, `policy-rotte`, `dal-guards`, `utenti-actions`, `valida-utente`, `cambia-stato-utente`, `google-callback`, `protezione-amministratore`; E2E auth, ruoli, gestione utenti, root e sessione proxy |

<!-- archetipo:wiki section=invariants -->
## Invarianti e limiti

JWT firmato HS256, payload validato, `exp === expiresAt`, durata sliding 8 ore. `SESSION_SECRET` deve avere almeno 32 caratteri e non essere il placeholder. Cookie HttpOnly, SameSite=Lax, Secure in produzione. Google non autocrea utenti: richiede email verificata e già censita; callback e DAL applicano inoltre `Utente.attivo`. `Utente.email`, account provider e profilo utente sono unici a database; `Utente.attivo` è non nullo e vale `true` per default. Deve restare almeno un amministratore attivo: invalidare o retrocedere l'ultimo è rifiutato prima di ogni write. Il proxy non consulta il database e svolge solo autenticazione/rinnovo della sessione JWT; il DAL è l'autorità del ruolo e dello stato correnti, quindi revoca e cambio ruolo diventano effettivi al primo accesso protetto che lo invoca. Il callback risolve l'utente per email verificata ma l'upsert per subject Google, quando trova un `Account` esistente, aggiorna soltanto l'access token e non verifica che `Account.userId` coincida con l'utente risolto: il binding fra subject ed email non è quindi imposto esplicitamente dall'applicazione. L'endpoint `/api/e2e-test/sessione` è escluso dalle guardie proxy ma risponde 403 salvo `E2E_TEST_MODE=true`. `src/lib/auth.ts` è un placeholder; Auth.js non è una dipendenza runtime osservata.

<!-- archetipo:wiki section=verification -->
## Verifica

Test unitari coprono secret, token, rinnovo, proxy, policy, guardie DAL, validazione e action utenti. `google-callback.test.ts` verifica che il callback respinga l'utente invalidato senza creare account o sessione; `cambia-stato-utente.test.ts` copre cascata utente/profilo, riattivazione e rifiuto dell'ultimo amministratore; `protezione-amministratore.test.ts` copre l'invariante pura. `bootstrap-amministratore-iniziale.test.ts` prova creazione, idempotenza (nessuna scrittura se l'utente esiste già) e uscita in errore senza connessione quando `AMMINISTRATORE_INIZIALE_EMAIL` manca, contro un client Prisma iniettato. `valida-utente.test.ts` e `utenti-actions.test.ts` coprono ora `validaCensimentoUtente`/`validaModificaUtente` e sia la creazione transazionale combinata utente+profilo sia le quattro transizioni di profilo in modifica (creazione, riattivazione, disattivazione, nessuna scrittura), incluse le tre combinazioni di ruoli, la protezione dell'ultimo amministratore a checkbox e l'assenza di scritture sugli esiti di rifiuto. Gli E2E di gestione utenti coprono invalidazione, riattivazione, ruolo autorevole al successivo accesso protetto, stato del profilo con factory isolate, il censimento con ruoli combinabili (checkbox, campi profilo condizionali, badge multipli, primo accesso del nuovo collaboratore) e, su un utente già censito, l'aggiunta e la rimozione del ruolo Collaboratore: campi profilo obbligatori solo alla prima creazione, storico attività conservato e consultabile dopo la disattivazione, messaggio di profilo disattivato al front office e riattivazione senza richiesta dei dati già noti. Confidenza alta su sessione, autorizzazione e ciclo di vita utenti; la classificazione resta candidata per il binding non imposto fra subject Google ed email.

## Concetti correlati

Questa capability partecipa alla [mappa dei contesti](/architecture/context-map.md), [Collaboratori](/domains/collaboratori.md) e [operazioni di sviluppo](/operations/development.md), ed è disciplinata dalla decisione [Ruoli combinabili derivati dal profilo collaboratore](/decisions/ruoli-combinabili-profilo-derivato.md).
