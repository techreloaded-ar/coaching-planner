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

Copia `.env.example` in `.env.local` e personalizza i valori. `.env.local` non viene mai committato.

L'applicazione esegue un fail-fast all'avvio se `SESSION_SECRET` è assente, vuota, troppo corta o ancora impostata al placeholder di esempio.

### Test end-to-end e database dedicato

`npm run test:e2e` richiede `E2E_DATABASE_URL` valorizzata verso un database dedicato ai test e vuoto nelle tabelle applicative.

Durante la suite e2e Playwright:

- avvia Next con `DATABASE_URL=E2E_DATABASE_URL`
- applica le migrazioni al database e2e
- esegue il seed sul database e2e
- ripulisce i dati applicativi al teardown finale

`DATABASE_URL` resta quindi il database normale dell'applicazione fuori dai test e2e.

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
