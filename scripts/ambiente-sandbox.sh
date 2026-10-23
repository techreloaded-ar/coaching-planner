#!/bin/sh
# Ambiente locale isolato per un checkout (sandbox/worktree) di Coaching Planner.
#
# Usato da .archetipo/environment.json: avvia un PostgreSQL dedicato al
# checkout, su una porta propria, così che migrazioni, seed ed e2e non tocchino
# il database di sviluppo né quelli di altri checkout. Tutte le credenziali sono
# sintetiche e valide solo in locale.
#
# Uso: sh scripts/ambiente-sandbox.sh <comando> [argomenti...]
#   avvia-postgres | probe-postgres | ferma-postgres | postgres-fermo
#   database        migrazioni + seed (solo se vuoto) sul database sintetico del checkout
#   probe-database  verifica schema Prisma e raggiungibilità del database
#   unit | build | e2e  test unitari / build Next.js / suite Playwright con l'ambiente del checkout
#   anteprima <porta>  next dev sulla porta indicata (strict), con Google
#                   Calendar e Gemini simulati (E2E_TEST_MODE) e dati sintetici
#   esegui <cmd>    esegue un comando arbitrario con l'ambiente del checkout
set -eu

CONTAINER="coaching-planner-sandbox-$(basename "$(pwd)")"

porta_postgres() {
  if [ -n "${ARCHETIPO_PORT_POSTGRES:-}" ]; then
    echo "$ARCHETIPO_PORT_POSTGRES"
    return
  fi
  docker port "$CONTAINER" 5432/tcp 2>/dev/null | head -n1 | sed 's/.*://'
}

esporta_ambiente() {
  PORTA="$(porta_postgres)"
  if [ -z "$PORTA" ]; then
    echo "PostgreSQL del checkout non avviato ($CONTAINER)." >&2
    exit 1
  fi
  export DATABASE_URL="postgresql://user:password@127.0.0.1:${PORTA}/coaching_planner"
  export E2E_DATABASE_URL="postgresql://user:password@127.0.0.1:${PORTA}/coaching_planner_e2e"
  export SESSION_SECRET="sandbox-session-secret-solo-locale-1234567890"
  export AUTH_SECRET="sandbox-auth-secret-solo-locale-1234567890"
  export GOOGLE_CLIENT_ID="sandbox-google-client-id"
  export GOOGLE_CLIENT_SECRET="sandbox-google-client-secret"
  export NEXT_PUBLIC_APP_URL="http://localhost:3000"
}

comando="${1:-}"
[ $# -gt 0 ] && shift

case "$comando" in
  avvia-postgres)
    PORTA="${ARCHETIPO_PORT_POSTGRES:?ARCHETIPO_PORT_POSTGRES richiesta}"
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    docker run -d --rm --name "$CONTAINER" \
      -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password \
      -e POSTGRES_DB=coaching_planner \
      -p "127.0.0.1:${PORTA}:5432" postgres:17-alpine >/dev/null
    # L'avvio termina solo a database pronto: il probe successivo non deve
    # inseguire l'inizializzazione del volume.
    tentativi=0
    until docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U user -d coaching_planner >/dev/null 2>&1; do
      tentativi=$((tentativi + 1))
      [ "$tentativi" -ge 50 ] && exit 1
      sleep 0.5
    done
    ;;
  probe-postgres)
    docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U user -d coaching_planner >/dev/null
    ;;
  ferma-postgres)
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    ;;
  postgres-fermo)
    [ -z "$(docker ps -q -f "name=^${CONTAINER}$")" ]
    ;;
  database)
    esporta_ambiente
    npx prisma migrate deploy
    # Seed solo sul database appena creato: la preparazione resta ripetibile
    # senza operazioni distruttive sui dati già presenti.
    utenti="$(docker exec "$CONTAINER" psql -U user -d coaching_planner -tAc 'SELECT count(*) FROM "Utente"')"
    if [ "$utenti" = "0" ]; then
      npx prisma db seed
    fi
    ;;
  probe-database)
    esporta_ambiente
    npx prisma migrate status >/dev/null
    ;;
  unit)
    esporta_ambiente
    npm test
    ;;
  build)
    esporta_ambiente
    npm run build
    ;;
  e2e)
    esporta_ambiente
    npx playwright test --reporter=line "$@"
    ;;
  anteprima)
    esporta_ambiente
    PORTA_APP="${1:?porta richiesta}"
    export E2E_TEST_MODE=true
    export NEXT_PUBLIC_APP_URL="http://127.0.0.1:${PORTA_APP}"
    # Con --port esplicito next dev non ripiega su un'altra porta.
    exec npx next dev --hostname 127.0.0.1 --port "$PORTA_APP"
    ;;
  esegui)
    esporta_ambiente
    "$@"
    ;;
  *)
    echo "Comando sconosciuto: $comando" >&2
    exit 2
    ;;
esac
