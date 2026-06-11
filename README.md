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

# 3. Configura le variabili d'ambiente
cp .env.example .env.local
# Modifica .env.local con i tuoi valori (DATABASE_URL, AUTH_SECRET)

# 4. Avvia il server di sviluppo
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) nel browser.

## Variabili d'Ambiente

| Variabile | Descrizione |
|---|---|
| `DATABASE_URL` | Stringa di connessione PostgreSQL (es. `postgresql://user:pass@localhost:5432/coaching_planner`) |
| `AUTH_SECRET` | Segreto per Auth.js (genera con `openssl rand -base64 32`) |

Copia `.env.example` in `.env.local` e personalizza i valori. `.env.local` non viene mai committato.

## Struttura del Progetto

```
src/
├── app/
│   ├── (front-office)/   # Area Collaboratore
│   ├── (back-office)/    # Area Amministratore
│   └── login/            # Autenticazione
├── domain/               # Logica di dominio (funzioni pure)
│   ├── consuntivi/       # Modulo calcoli: ore, rimborsi, totali
│   └── types.ts          # Tipi di dominio condivisi
├── lib/                  # Client Prisma, Auth.js
└── components/           # Componenti UI condivisi

tests/
├── unit/                 # Test unitari (Vitest)
└── e2e/                  # Test end-to-end (Playwright)
```

## Script Disponibili

- `npm run dev` — Avvia il server di sviluppo
- `npm run build` — Build di produzione
- `npm run lint` — Esegue ESLint
- `npm test` — Esegue i test unitari (Vitest)
- `npm run test:e2e` — Esegue i test end-to-end (Playwright)

## Tecnologie

- [Next.js](https://nextjs.org) (App Router)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [Prisma](https://www.prisma.io) (ORM)
- [Auth.js](https://authjs.dev) (Autenticazione)
- [Vitest](https://vitest.dev) (Unit testing)
- [Playwright](https://playwright.dev) (E2E testing)
