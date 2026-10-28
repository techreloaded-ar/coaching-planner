#!/bin/sh
# Ambiente locale isolato per un checkout (sandbox/worktree) di Coaching Planner.
#
# Usato dalla ricetta `archetipo execution environment`: avvia un PostgreSQL
# dedicato al checkout, su una porta propria, così che migrazioni, seed ed e2e
# non tocchino il database di sviluppo né quelli di altri checkout. Tutte le
# credenziali sono sintetiche e valide solo in locale.
#
# Container e volume portano le etichette archetipo.resource.owner/name: un
# servizio con lo stesso nome ma etichette diverse non viene mai riusato né
# fermato. I dati vivono in un volume del checkout e sopravvivono a stop,
# revisioni e riprese.
#
# Uso: sh scripts/archetipo/ambiente.sh <comando> [argomenti...]
#   avvia-postgres | probe-postgres | ferma-postgres | postgres-fermo
#   database        migrazioni + seed (solo se vuoto) sul database sintetico del checkout
#   probe-database  verifica schema Prisma e raggiungibilità del database
#   unit | build | e2e  test unitari / build Next.js / suite Playwright con l'ambiente del checkout
#   anteprima <porta>  next dev sulla porta indicata (strict), con Google
#                   (login e Calendar) e Jev simulati (E2E_TEST_MODE) e dati
#                   sintetici. "Accedi con Google" apre la scelta locale
#                   dell'utente; "Collega Google Calendar" la scelta dell'account.
#   esegui <cmd>    esegue un comando arbitrario con l'ambiente del checkout
#   pulizia         rimuove gli artefatti transitori dei check (test-results, playwright-report)
set -eu

CONTAINER="coaching-planner-sandbox-$(basename "$(pwd)")"
VOLUME="${CONTAINER}-dati"
IMMAGINE="postgres:17-alpine"

richiedi_identita() {
  : "${ARCHETIPO_RESOURCE_OWNER:?ARCHETIPO_RESOURCE_OWNER richiesta}"
  : "${ARCHETIPO_RESOURCE_NAME:?ARCHETIPO_RESOURCE_NAME richiesta}"
}

# Stampa "owner|name" dell'oggetto docker indicato; vuoto se non esiste.
etichette() {
  # Le etichette dei container stanno in .Config.Labels, quelle dei volumi in .Labels.
  campo=".Labels"
  [ "$1" = container ] && campo=".Config.Labels"
  docker "$1" inspect --format "{{index $campo \"archetipo.resource.owner\"}}|{{index $campo \"archetipo.resource.name\"}}" "$2" 2>/dev/null || true
}

# Esce 0 se l'oggetto non esiste, 1 se esiste ed è nostro; fallisce se è estraneo.
# Il nome dell'oggetto è già legato al checkout; l'owner invece cambia a ogni
# nuova versione della ricetta (e le etichette docker sono immutabili), quindi
# confrontarlo renderebbe il volume dati inutilizzabile dopo il primo cambio.
# Basta che l'oggetto porti un owner archetipo e il nostro nome di risorsa.
assente_o_nostro() {
  trovate="$(etichette "$1" "$2")"
  [ -z "$trovate" ] && return 0
  case "${trovate%%|*}" in
    resource-*) owner_archetipo=1 ;;
    *) owner_archetipo=0 ;;
  esac
  if [ "$owner_archetipo" != 1 ] || [ "${trovate#*|}" != "${ARCHETIPO_RESOURCE_NAME}" ]; then
    echo "$1 $2 esiste ma non appartiene a questa risorsa ($trovate): non viene adottato." >&2
    exit 1
  fi
  return 1
}

in_esecuzione() {
  [ "$(docker container inspect --format '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)" = "true" ]
}

attendi_pronto() {
  tentativi=0
  until docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U user -d coaching_planner >/dev/null 2>&1; do
    tentativi=$((tentativi + 1))
    [ "$tentativi" -ge 50 ] && exit 1
    sleep 0.5
  done
}

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
    richiedi_identita
    if ! assente_o_nostro container "$CONTAINER"; then
      # Riuso solo se è il nostro, attivo e sulla porta assegnata.
      if in_esecuzione && [ "$(docker port "$CONTAINER" 5432/tcp 2>/dev/null | head -n1 | sed 's/.*://')" = "$PORTA" ]; then
        attendi_pronto
        exit 0
      fi
      docker rm -f "$CONTAINER" >/dev/null
    fi
    if assente_o_nostro volume "$VOLUME"; then
      docker volume create \
        --label "archetipo.resource.owner=$ARCHETIPO_RESOURCE_OWNER" \
        --label "archetipo.resource.name=$ARCHETIPO_RESOURCE_NAME" \
        "$VOLUME" >/dev/null
    fi
    docker run -d --rm --name "$CONTAINER" \
      --label "archetipo.resource.owner=$ARCHETIPO_RESOURCE_OWNER" \
      --label "archetipo.resource.name=$ARCHETIPO_RESOURCE_NAME" \
      -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password \
      -e POSTGRES_DB=coaching_planner \
      -v "$VOLUME:/var/lib/postgresql/data" \
      -p "127.0.0.1:${PORTA}:5432" "$IMMAGINE" >/dev/null
    # L'avvio termina solo a database pronto: il probe successivo non deve
    # inseguire l'inizializzazione del volume.
    attendi_pronto
    ;;
  probe-postgres)
    richiedi_identita
    if assente_o_nostro container "$CONTAINER"; then
      exit 1
    fi
    docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U user -d coaching_planner >/dev/null
    ;;
  ferma-postgres)
    richiedi_identita
    # Il volume resta: dati dimostrativi e modifiche sopravvivono allo stop.
    if ! assente_o_nostro container "$CONTAINER"; then
      docker rm -f "$CONTAINER" >/dev/null
    fi
    ;;
  postgres-fermo)
    richiedi_identita
    if ! assente_o_nostro container "$CONTAINER"; then
      if in_esecuzione; then exit 1; fi
    fi
    ;;
  database)
    esporta_ambiente
    npx prisma migrate deploy
    # Il seed azzera le tabelle: gira solo sul database appena creato, così la
    # preparazione resta ripetibile e conserva dati e modifiche esistenti.
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
  pulizia)
    # Solo artefatti transitori dei check: database, volume e dati restano.
    rm -rf test-results playwright-report
    ;;
  *)
    echo "Comando sconosciuto: $comando" >&2
    exit 2
    ;;
esac
