---
type: operations
title: Deploy — Vercel + PostgreSQL SiteGround
description: Guida operativa per portare Coaching Planner in staging e produzione su Vercel, con database PostgreSQL ospitato su SiteGround
status: generated
---

# Deploy — Vercel + PostgreSQL SiteGround

Guida per attivare due ambienti (staging e produzione) per Coaching Planner:
hosting applicativo su **Vercel**, database **PostgreSQL su SiteGround** (già disponibile).

## 0. Prerequisito bloccante da verificare: TLS su SiteGround Postgres

Lo spike `docs/siteground-postgres-connectivity-spike.md` (US-004, giugno 2026) aveva rilevato che
il server SiteGround **rifiutava esplicitamente le connessioni SSL/TLS** (`sslmode=require` falliva
con `The server does not support SSL connections`), mentre la connessione in chiaro funzionava.

L'app gestisce dati personali e finanziari (anagrafiche collaboratori/clienti, tariffe, partite IVA):
farli transitare senza cifratura tra Vercel e SiteGround su Internet pubblico è un rischio GDPR non
banale. **Prima di procedere con il deploy in produzione, riverifica lo stato attuale** con lo script
già presente nel repo:

```bash
npx tsx scripts/siteground-connectivity-check.ts "postgresql://<utente>:<password>@<host>:5432/<db>?sslmode=require"
```

Due esiti possibili:

- **TLS ora supportato** → usa `sslmode=require` (o `verify-full` se SiteGround fornisce una CA) in
  tutte le `DATABASE_URL` di staging e produzione. Procedi pure con il resto della guida.
- **TLS ancora non supportato** → prima di andare in produzione, apri un ticket con il supporto
  SiteGround chiedendo l'attivazione di TLS sul piano Postgres. Nel frattempo puoi comunque allestire
  **staging** (rischio minore, dati non reali) seguendo questa guida con `sslmode=disable`, ma tieni
  la produzione in stand-by finché il punto non è chiuso o hai accettato consapevolmente il rischio.

Il resto della guida usa `<SSLMODE>` come placeholder nelle stringhe di connessione: sostituiscilo con
`require` o `disable` in base all'esito sopra.

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
   postgresql://<utente>:<password>@<host>:5432/coaching_planner?sslmode=<SSLMODE>&connection_limit=5
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
   prisma generate && prisma migrate deploy && next build
   ```

   Così ogni deploy applica automaticamente le migrazioni pendenti sul database
   dell'ambiente corrispondente prima della build.
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
- Poiché non esiste auto-provisioning, dopo la primissima migrazione il database è vuoto: censisci
  manualmente il primo `Utente` con `ruolo = AMMINISTRATORE` (via Prisma Studio puntato alla
  `DATABASE_URL` di produzione, o una query diretta), altrimenti nessuno può accedere al back-office
  per censire gli altri collaboratori.

## 8. Checklist go-live

- [ ] Stato TLS su SiteGround Postgres verificato (punto 0) e `sslmode` coerente nelle connection string
- [ ] Due database SiteGround creati, con utenti/credenziali dedicati
- [ ] Redirect URI Google aggiornati per staging e produzione
- [ ] Variabili d'ambiente impostate su Vercel, scoped correttamente per Production/Preview(`staging`)
- [ ] Build command con `prisma migrate deploy` configurato
- [ ] Dominio collegato, DNS propagato, certificato Vercel attivo
- [ ] Primo `Utente` AMMINISTRATORE censito manualmente nel DB di produzione
- [ ] Smoke test end-to-end manuale in staging (login Google, CRUD principali) prima di promuovere in produzione

## 9. Follow-up da pianificare in una spec separata

- **Auto-provisioning / restrizione al dominio `agilereloaded.it`**: oggi il login richiede un
  `Utente` già censito manualmente; per permettere l'accesso automatico a chiunque abbia un account
  Google di quel dominio serve modificare `callback/route.ts` (verifica claim `hd` o suffisso email
  + creazione automatica dell'`Utente` con ruolo di default). Da specificare a parte, come indicato.
- **Migrazione a TLS** sul database SiteGround, se allo stato attuale risultasse ancora non supportato.
