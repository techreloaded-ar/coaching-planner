---
type: operations
title: Deploy — Vercel + PostgreSQL SiteGround
description: Guida operativa per portare Coaching Planner in staging e produzione su Vercel, con database PostgreSQL ospitato su SiteGround
status: reviewed
review:
    content_hash: sha256:f97a36cce78efd8342311e9ab4f53318cf096ee0c74d62dc9cf75f8622dcaad7
    evidence_revision: 318a1e988d27789e979ab6c847c09cd3d4a71caa
    reviewed_at: "2026-07-27T09:41:32Z"
---

# Deploy — Vercel + PostgreSQL SiteGround

Guida per attivare due ambienti (staging e produzione) per Coaching Planner:
hosting applicativo su **Vercel**, database **PostgreSQL su SiteGround** (già disponibile).

## 0. TLS su SiteGround Postgres: rischio accettato

Lo spike `docs/siteground-postgres-connectivity-spike.md` (US-004, giugno 2026) aveva rilevato che
il server SiteGround **rifiuta le connessioni SSL/TLS** (`sslmode=require` fallisce con
`The server does not support SSL connections`), mentre la connessione in chiaro funziona.

**Decisione (2026-07-21)**: il committente accetta consapevolmente il rischio e procede con
connessioni non cifrate (`sslmode=disable`) sia in staging sia in produzione. Motivazioni, rischi
residui e follow-up sono documentati nella decision record
`docs/wiki/decisions/connessione-db-senza-tls.md`.

Resta aperto il follow-up di richiedere a SiteGround l'abilitazione del TLS: quando disponibile,
basterà passare a `sslmode=require` nelle `DATABASE_URL` su Vercel (verificabile in ogni momento
con `npx tsx scripts/siteground-connectivity-check.ts "<connection-string>?sslmode=require"`).

## 1. Panoramica architetturale

```
GitHub (main / staging) → Vercel (build + hosting Next.js)
                                │
                                ├── DATABASE_URL (Production)  → SiteGround: coaching_planner
                                └── DATABASE_URL (Preview/staging) → SiteGround: coaching_planner_staging

Google Cloud Console (OAuth Client) → callback su dominio Vercel di ciascun ambiente
```

Due ambienti Vercel nello stesso progetto:

- branch `main` → **Production** (dominio definitivo)
- branch `staging` (da creare) → **Preview** con variabili d'ambiente proprie, agganciato a quel branch

## 2. Database SiteGround

1. Crea due database separati (non riutilizzare quello di sviluppo/e2e):
   - `coaching_planner` (produzione)
   - `coaching_planner_staging` (staging)
2. Per ciascuno, crea un utente Postgres dedicato con permessi solo su quel database (evita di
   condividere le stesse credenziali tra ambienti).
3. Conferma che l'accesso remoto sia già abilitato (come mi hai indicato) e annota host, porta, nome
   database, utente e password di entrambi — ti serviranno come Environment Variables su Vercel.
4. Costruisci le stringhe di connessione con un limite di connessioni esplicito, per non saturare il
   Postgres quando più funzioni serverless si connettono in parallelo:

   ```
   postgresql://<utente>:<password>@<host>:5432/coaching_planner?sslmode=disable&connection_limit=5
   ```

   Il valore `5` è un punto di partenza prudente: adegualo al `max_connections` effettivo del tuo
   piano SiteGround diviso per il numero di ambienti/istanze che si collegano in contemporanea.

## 3. Google Cloud Console — OAuth Client

1. Nel progetto Google Cloud già usato per le credenziali OAuth, apri **API e servizi → Credenziali**.
2. Sull'OAuth Client ID esistente (o uno nuovo, tipo "Applicazione Web"), aggiungi tra gli
   **URI di reindirizzamento autorizzati**:
   - `https://<dominio-produzione>/api/auth/google/callback`
   - `https://<dominio-staging>/api/auth/google/callback`
   - mantieni quello di `localhost` per lo sviluppo locale.
3. Se il progetto Google Cloud appartiene all'organizzazione Workspace di `agilereloaded.it`, puoi
   opzionalmente impostare lo **User type** della schermata di consenso OAuth su **Interno**: questo
   impedisce a chiunque non abbia un account del dominio di completare anche solo la schermata di
   login Google. È un rafforzamento a costo zero e senza modifiche al codice, ma **non** equivale
   all'auto-provisioning richiesto (vedi punto sotto) — è solo un livello di difesa in più a monte.

### Nota importante sul login "chiunque abbia un account @agilereloaded.it"

Ho verificato il flusso attuale (`src/app/api/auth/google/callback/route.ts`): oggi **non esiste
auto-provisioning**. Dopo il login Google riuscito, l'app cerca l'email in `Utente` e **nega
l'accesso se la riga non esiste già** — un amministratore deve prima censire manualmente ogni
collaboratore in anagrafica back-office. Non c'è nemmeno un controllo esplicito sul dominio email
(claim `hd` o suffisso), quindi tecnicamente chiunque potrebbe *tentare* il login con qualsiasi
account Google, ma solo chi è già censito supera il controllo.

Per ottenere "chiunque abbia un account Google del dominio agilereloaded.it può collegarsi"
servirebbe una modifica di codice (verifica del claim `hd`/dominio email e creazione automatica
dell'`Utente` al primo accesso, con ruolo di default) — **non l'ho toccata**, come da tua richiesta:
la lasci per una spec dedicata. Fino ad allora, resta necessario censire manualmente ogni
collaboratore prima che possa accedere, in entrambi gli ambienti.

## 4. Progetto Vercel

1. **Piano**: usa **Vercel Pro** (~20$/mese/utente). Il piano Hobby è gratuito ma il ToS ne vieta
   l'uso per progetti commerciali/aziendali; Pro alza anche il timeout delle funzioni serverless da
   10s a 60s, utile per operazioni più pesanti (report, matrici mensili).
2. **Import**: collega il repository GitHub del progetto da Vercel (Add New → Project → importa il
   repo `coaching-planner`).
3. **Framework preset**: Next.js, rilevato automaticamente.
4. **Node version**: imposta 22.x (Settings → General → Node.js Version), per coerenza con il README.
5. **Build Command** (Settings → Build & Development Settings), sovrascrivi il default con:

   ```
   prisma generate && prisma migrate deploy && npx tsx scripts/bootstrap-amministratore-iniziale.ts && next build
   ```

   Così ogni deploy applica le migrazioni pendenti sul database dell'ambiente
   corrispondente **e** garantisce in modo idempotente l'esistenza del primo
   amministratore, nella stessa fase, prima che l'applicazione serva traffico.
6. **Branch di produzione**: lascia `main` come Production Branch (default).
7. Crea (se non esiste) un branch `staging` nel repo e collega a Vercel un ambiente Preview con
   variabili d'ambiente scoped su quel branch (vedi punto 5).

## 5. Variabili d'ambiente per ambiente

In Vercel: **Settings → Environment Variables**. Per ogni variabile puoi scegliere in quali ambienti
vive (Production / Preview / Development) e, per Preview, restringerla a un branch specifico
(`staging`).

| Variabile | Production (`main`) | Preview (`staging`) |
|---|---|---|
| `DATABASE_URL` | connessione a `coaching_planner` | connessione a `coaching_planner_staging` |
| `SESSION_SECRET` | valore reale generato con `openssl rand -base64 32`, diverso da staging | valore reale diverso, dedicato a staging |
| `AUTH_SECRET` | valore reale generato, diverso da staging | valore reale dedicato |
| `GOOGLE_CLIENT_ID` | client id Google Cloud | stesso o client separato, a scelta |
| `GOOGLE_CLIENT_SECRET` | client secret | idem |
| `GOOGLE_REDIRECT_URI` | `https://<dominio-produzione>/api/auth/google/callback` | `https://<dominio-staging>/api/auth/google/callback` |
| `NEXT_PUBLIC_APP_URL` | `https://<dominio-produzione>` | `https://<dominio-staging>` |
| `AMMINISTRATORE_INIZIALE_EMAIL` | email dell'amministratore garantito al deploy, es. `admin@agilereloaded.it` | email dell'amministratore garantito al deploy in staging, es. `admin-staging@agilereloaded.it` |
| `E2E_TEST_MODE` | non impostata (o `false`) | non impostata (o `false`) — **mai `true` fuori da CI/e2e** |

`E2E_TEST_MODE=true` abilita endpoint riservati ai test che accettano richieste senza autenticazione:
non deve mai essere `true` in staging o produzione.

## 6. Dominio custom

1. In Vercel: **Settings → Domains**, aggiungi il dominio/sottodominio di produzione (es.
   `app.agilereloaded.it`) e quello di staging (es. `staging.agilereloaded.it`).
2. Vercel mostrerà il record DNS da creare (CNAME verso `cname.vercel-dns.com`, o A record). Aggiungi
   quel record nella zona DNS gestita su SiteGround — non serve spostare la gestione DNS del dominio,
   resta lì dove è oggi.
3. Il certificato TLS per il dominio applicativo è gestito automaticamente da Vercel (Let's Encrypt):
   nessuna azione richiesta lato SiteGround per questo (è un aspetto separato dal TLS del database
   discusso al punto 0).

## 7. Primo avvio in produzione

- **Non eseguire mai** `npm run db:seed` / `prisma db seed` contro il database di produzione o
  staging: lo script (`prisma/seed.ts`) **cancella tutte le tabelle applicative** e le ripopola con
  dati demo (pensato solo per sviluppo/e2e).
- Le migrazioni vengono applicate automaticamente dal build command (punto 4.5).
- Poiché non esiste auto-provisioning, dopo la primissima migrazione il database sarebbe vuoto: il
  build command esegue subito dopo `scripts/bootstrap-amministratore-iniziale.ts`, che garantisce in
  modo idempotente l'esistenza di un `Utente` con `ruolo = AMMINISTRATORE` per l'email indicata in
  `AMMINISTRATORE_INIZIALE_EMAIL` (crea l'utente solo se non esiste già, senza promuovere o
  riattivare utenti esistenti), così l'amministratore può accedere al back-office fin dal primo
  avvio per censire gli altri collaboratori.
- Per demo o ambienti locali, l'equivalente manuale dello stesso bootstrap è:
  `AMMINISTRATORE_INIZIALE_EMAIL=<email> npm run db:bootstrap-amministratore`.
- **Passo manuale una tantum al primo rilascio (US-042)**: subito dopo `db:migrate:deploy`, esegui
  manualmente `npm run db:backfill-abilitazioni` contro il database dell'ambiente appena migrato. La
  tabella `AbilitazioneOfferta` nasce vuota e questo script la pre-popola con le coppie
  collaboratore/offerta già desumibili dalle righe attività storiche su offerte attive; una guardia
  interna salta la scrittura se la tabella contiene già almeno una riga, quindi rieseguirlo dopo il
  primo rilascio non ha effetto (a meno che la tabella non sia stata svuotata manualmente). A
  differenza del bootstrap amministratore, questo passo **non** è incluso nel build command Vercel:
  va lanciato a mano, una sola volta per ambiente (staging e produzione), perché agisce su dati
  applicativi derivati e non su un prerequisito di accesso al back-office. Dettagli e alternative
  scartate nella decisione `docs/wiki/decisions/abilitazioni-offerte-esplicite.md`.

## 8. Checklist go-live

- [x] Decisione TLS presa: rischio accettato, `sslmode=disable` (vedi punto 0 e decision record)
- [x] Due database SiteGround creati, con utenti/credenziali dedicati
- [x] Redirect URI Google aggiornati per staging e produzione
- [x] Variabili d'ambiente impostate su Vercel, scoped correttamente per Production/Preview(`staging`)
- [x] Build command con `prisma migrate deploy` configurato
- [x] Dominio collegato, DNS propagato, certificato Vercel attivo
- [ ] `AMMINISTRATORE_INIZIALE_EMAIL` configurata su Vercel e bootstrap dell'amministratore incluso nel build command
- [ ] `npm run db:backfill-abilitazioni` eseguito manualmente subito dopo `db:migrate:deploy` al primo rilascio, in ciascun ambiente (staging e produzione)
- [ ] Smoke test end-to-end manuale in staging (login Google, CRUD principali) prima di promuovere in produzione

## 9. Follow-up da pianificare in una spec separata

- **Auto-provisioning / restrizione al dominio `agilereloaded.it`**: oggi il login richiede un
  `Utente` già censito manualmente; per permettere l'accesso automatico a chiunque abbia un account
  Google di quel dominio serve modificare `callback/route.ts` (verifica claim `hd` o suffisso email
  + creazione automatica dell'`Utente` con ruolo di default). Da specificare a parte, come indicato.
- **Migrazione a TLS** sul database SiteGround: richiedere al supporto l'abilitazione del TLS e,
  quando disponibile, passare a `sslmode=require` nelle `DATABASE_URL` su Vercel (rischio accettato
  nel frattempo — vedi `docs/wiki/decisions/connessione-db-senza-tls.md`).

## Concetti correlati

Per setup locale, migrazioni e controlli di qualità, vedi le [operazioni di sviluppo](/operations/development.md). Per il razionale del passo di backfill una tantum, vedi la decisione [Abilitazioni esplicite collaboratore-offerta](/decisions/abilitazioni-offerte-esplicite.md).
