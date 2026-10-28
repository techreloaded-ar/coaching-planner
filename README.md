# Coaching Planner

Gestionale web per la consuntivazione mensile di collaboratori, clienti e offerte.

## Prerequisiti

- Node.js 22 LTS
- npm
- Docker Desktop (per PostgreSQL in sviluppo locale)

## Avvio Rapido

```bash
# 1. Clona il repository
git clone <repo-url>
cd coaching-planner

# 2. Installa le dipendenze
npm install

# 3. Avvia il database PostgreSQL locale
# Alla prima inizializzazione il container crea sia `coaching_planner` sia
# `coaching_planner_e2e`: non serve alcuna preparazione manuale del database e2e.
docker compose up -d

# 4. Configura le variabili d'ambiente
cp .env.example .env.local
# Sostituisci i placeholder di AUTH_SECRET e SESSION_SECRET:
openssl rand -base64 32
# SESSION_SECRET è obbligatoria: se assente, vuota, troppo corta o lasciata al
# placeholder predefinito, l'applicazione fallisce subito all'avvio.

# 5. Applica le migrazioni e popola il database
npm run db:migrate
npm run db:seed

# 6. Avvia il server di sviluppo
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) nel browser.

## Variabili d'Ambiente

| Variabile | Descrizione |
|---|---|
| `DATABASE_URL` | Stringa di connessione PostgreSQL usata normalmente dall'applicazione (es. `postgresql://user:pass@localhost:5432/coaching_planner`) |
| `E2E_DATABASE_URL` | Stringa di connessione PostgreSQL dedicata agli end-to-end (es. `postgresql://user:pass@localhost:5432/coaching_planner_e2e`) |
| `AUTH_SECRET` | Segreto per Auth.js (genera con `openssl rand -base64 32`) |
| `SESSION_SECRET` | Chiave obbligatoria per firmare la sessione applicativa; deve essere reale, non vuota, non placeholder e lunga almeno 32 caratteri |
| `OPENROUTER_API_KEY` | Chiave di server di OpenRouter, usata per chiedere a Jev (TypeSafe AI) cliente e offerta degli impegni del calendario Google ed escludere quelli non lavorativi; se assente le proposte di ore compaiono tutte, senza associazione (vedi «Diagnostica dei suggerimenti Jev») |
| `JEV_MODEL` | Modello Jev opzionale (predefinito `~typesafe/jev-latest`, l'ultima versione) |
| `JEV_SOGLIA_CONFIDENZA` | Confidenza minima (da 0 a 1, predefinita `0.7`) della scelta dell'offerta per precompilare cliente e offerta; serve anche che Jev ritenga il cliente chiaramente identificato e che l'offerta sia attiva |
| `DOMINI_INTERNI` | Domini email dei colleghi, separati da virgola (predefinito `agilereloaded.it`): sono tolti dagli invitati inviati a Jev perché non indicano il cliente |

Copia `.env.example` in `.env.local` e personalizza i valori. `.env.local` non viene mai committato.

L'applicazione esegue un fail-fast all'avvio se `SESSION_SECRET` è assente, vuota, troppo corta o ancora impostata al placeholder di esempio.

### Diagnostica dei suggerimenti Jev

Ogni lettura delle proposte dal calendario con almeno un impegno invia a Jev una richiesta per impegno (al più 4 in parallelo) e scrive nei log del server (su Vercel: *Logs*, filtro `Jev:`) una sola riga come:

```
Jev: esito=ok modello=~typesafe/jev-latest eventi=4 offerte=12 durataMs=812 associazioniAlta=1 associazioniBassa=2 nonLavorativi=1
Jev: esito=errore-http modello=~typesafe/jev-latest eventi=4 offerte=12 durataMs=230 associazioniAlta=0 associazioniBassa=0 nonLavorativi=0 eventiInErrore=4 stato=402 messaggio="Insufficient credits"
```

La riga non contiene mai la chiave, titoli, descrizioni, email o domini degli eventi. `associazioniAlta` sono le proposte precompilate, `associazioniBassa` quelle con un'offerta scelta ma lasciate da scegliere (cliente non identificato, confidenza sotto `JEV_SOGLIA_CONFIDENZA` o offerta chiusa), `nonLavorativi` gli impegni esclusi. Se alcuni impegni falliscono gli altri restano associati: `eventiInErrore` li conta e l'esito è quello del primo errore. Gli esiti:

| Esito | Significato e verifica |
|---|---|
| `ok` | Jev ha risposto per tutti gli impegni |
| `chiave-assente` | `OPENROUTER_API_KEY` non arriva al deployment: controlla l'ambiente (Production/Preview) e rifai il deploy |
| `nessuna-offerta-abilitata` | Il collaboratore non è abilitato su offerte di clienti attivi: Jev non viene chiamato |
| `errore-http` | OpenRouter ha rifiutato la richiesta: `stato` e `messaggio` indicano la causa (401 = chiave non valida; 402 = credito OpenRouter esaurito; 400/422 = modello o richiesta non validi, senza messaggio perché potrebbe citare i dati dell'evento; 429/5xx = limiti o sovraccarico, già ritentati due volte con backoff) |
| `errore-rete` | OpenRouter non raggiungibile (`tipoErrore` indica il tipo) |
| `timeout` | Nessuna risposta entro 10 secondi |
| `risposta-non-valida` | Jev ha risposto senza le tre risposte attese (`clientIdentified`, `offer`, `notWorkRelated`) o con un'offerta che non è tra le opzioni |

### Test end-to-end e database dedicato

`npm run test:e2e` richiede `E2E_DATABASE_URL` valorizzata verso un database **dedicato e diverso** da quello indicato da `DATABASE_URL`. Non serve che sia vuoto e non serve crearlo a mano: la preparazione è interamente a carico della suite.

Durante la suite e2e Playwright:

- verifica che `E2E_DATABASE_URL` non coincida con `DATABASE_URL` (stesso host, porta e nome database) e si ferma prima di qualunque operazione distruttiva
- crea il database e2e se non esiste ancora
- ne ripristina lo stato pulito ricreando lo schema `public` da zero
- applica le migrazioni al database e2e
- esegue il seed sul database e2e
- avvia Next con `DATABASE_URL=E2E_DATABASE_URL`
- ripulisce i dati applicativi al teardown finale

Poiché lo schema viene ricreato a ogni run, un run interrotto non blocca quelli successivi e nessun test può contare su dati residui del run precedente.

`DATABASE_URL` resta quindi il database normale dell'applicazione fuori dai test e2e.

#### Rifiuti espliciti

La suite si interrompe con un messaggio azionabile in due casi:

- **Database e2e coincidente con quello applicativo** — «Il database e2e configurato in E2E_DATABASE_URL coincide con il database di sviluppo indicato da DATABASE_URL (host:porta/nome). … Configura un database dedicato, per esempio `coaching_planner_e2e`, e rilancia la suite.» Il controllo è puramente sintattico e viene eseguito per primo, anche prima dell'avvio del web server.
- **Istanza PostgreSQL non raggiungibile** — «Il database locale non risponde su host:porta (CODICE). Avvia l'istanza PostgreSQL con `docker compose up -d` e rilancia la suite e2e.»

Playwright passa sempre al web server una `SESSION_SECRET` conforme alla stessa policy dell'applicazione. Se l'ambiente locale non la definisce o lascia il placeholder, il solo web server e2e usa un fallback esplicitamente non produttivo ma valido.

## Sessione e proxy di autenticazione

- `src/proxy.ts` è il proxy attivo di Next.js: intercetta le rotte protette prima del rendering.
- `/` è la pagina pubblica di accesso.
- `/login` è una tombstone intenzionale e continua a restituire `404`.
- Le aree protette reindirizzano gli utenti non autenticati verso `/`.
- La sessione JWT `cp_sessione` usa rinnovo sliding: ogni richiesta valida sposta la scadenza a **8 ore di inattività**.
- Il controllo del ruolo nel proxy è ottimistico e legge solo il cookie; il DAL resta la seconda linea di difesa con verifica a database.

## Struttura del Progetto

```
src/
├── app/
│   ├── (front-office)/   # Area Collaboratore
│   ├── (back-office)/    # Area Amministratore
│   └── page.tsx          # Pagina pubblica di accesso su /
├── proxy.ts              # Proxy Next.js per auth, ruolo e rinnovo sliding
├── instrumentation.ts    # Fail-fast della configurazione di sessione all'avvio
├── domain/               # Logica di dominio (funzioni pure)
│   ├── consuntivi/       # Modulo calcoli: ore, rimborsi, totali
│   └── types.ts          # Tipi di dominio condivisi
├── lib/                  # Prisma, sessione, DAL e policy rotte
└── components/           # Componenti UI condivisi

tests/
├── unit/                 # Test unitari (Vitest)
└── e2e/                  # Test end-to-end (Playwright)
```

## Database

### Avvio locale

```bash
docker compose up -d          # Avvia PostgreSQL in background
docker compose down            # Arresta PostgreSQL
docker compose down -v         # Arresta e cancella i dati (reset completo)
```

Alla **prima** inizializzazione del volume `pgdata`, l'entrypoint di PostgreSQL esegue gli script in `docker/postgres/initdb` e crea automaticamente sia il database applicativo `coaching_planner` sia quello dedicato agli end-to-end `coaching_planner_e2e`.

Su un volume già inizializzato quegli script non vengono rieseguiti: se il database e2e manca, viene comunque creato dalla suite al primo `npm run test:e2e`. Non è quindi mai necessario crearlo a mano.

`docker compose down -v` resta il reset totale, ma attenzione: cancella anche i dati di sviluppo del database applicativo.

### Comandi Prisma

- `npm run db:validate` — Valida lo schema Prisma
- `npm run db:migrate` — Applica le migrazioni in sviluppo
- `npm run db:migrate:deploy` — Applica le migrazioni in produzione
- `npm run db:seed` — Popola il database con dati di esempio
- `npm run db:studio` — Apre Prisma Studio per esplorare i dati

## Script Disponibili

- `npm run dev` — Avvia il server di sviluppo
- `npm run build` — Build di produzione
- `npm run lint` — Esegue ESLint
- `npm test` — Esegue i test unitari (Vitest)
- `npm run test:e2e` — Esegue i test end-to-end (Playwright)

## Integrazione Continua

A ogni push e pull request su `main`, il workflow CI (`.github/workflows/ci.yml`) esegue automaticamente:

1. **Install** — `npm ci` per installare le dipendenze in modo riproducibile
2. **Lint** — `npm run lint` per verificare lo stile del codice
3. **Unit test** — `npm test` (Vitest) per i test unitari
4. **Build** — `npm run build` per verificare la compilazione TypeScript e la build Next.js
5. **E2E test** — `npm run test:e2e` (Playwright) per i test end-to-end

La pipeline fallisce automaticamente se uno qualsiasi degli step fallisce, intercettando le regressioni prima che raggiungano la produzione.

## Tecnologie

- [Next.js](https://nextjs.org) (App Router)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [Prisma](https://www.prisma.io) (ORM)
- [Auth.js](https://authjs.dev) (Autenticazione)
- [Vitest](https://vitest.dev) (Unit testing)
- [Playwright](https://playwright.dev) (E2E testing)
