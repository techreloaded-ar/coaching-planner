#!/bin/sh
# Ambiente di un checkout (sandbox/worktree) di Coaching Planner.
#
# Usato dalla ricetta `archetipo execution environment`. Il PostgreSQL del
# checkout è dichiarato nella ricetta (`services.db`): lo avvia ARchetipo, con
# porta e dati propri, sia con il Docker del computer sia nell'ambiente isolato,
# e passa DATABASE_URL ed E2E_DATABASE_URL a ogni comando. Questo script non
# avvia servizi e non usa Docker. Tutte le credenziali sono sintetiche e valide
# solo in locale.
#
# Uso: sh scripts/archetipo/ambiente.sh <comando> [argomenti...]
#   database        migrazioni + seed (solo se vuoto) sul database sintetico del checkout
#   probe-database  verifica schema Prisma e raggiungibilità del database
#   verifica        il check della ricetta, da superare prima della pull request:
#                   lint, test unitari e build di produzione in parallelo, poi
#                   gli e2e mirati sulla stessa build. La suite e2e completa gira
#                   in CI sulla pull request. E2E_SUITE_COMPLETA=1 la forza qui.
#   e2e-mirati      solo gli e2e mirati (vedi scripts/archetipo/selezione-e2e-mirati.ts)
#   unit | build | e2e  test unitari / build Next.js / suite Playwright completa
#                   (o le spec passate come argomenti) con l'ambiente del checkout
#   anteprima <porta>  next dev sulla porta indicata (strict), con Google
#                   (login e Calendar) e Jev simulati (E2E_TEST_MODE) e dati
#                   sintetici. "Accedi con Google" apre la scelta locale
#                   dell'utente; "Collega Google Calendar" la scelta dell'account.
#   rigenera-database  azzera il database applicativo del checkout e lo ricrea
#                   con migrazioni, seed di base e dati dimostrativi
#   esegui <cmd>    esegue un comando arbitrario con l'ambiente del checkout
#   pulizia         rimuove gli artefatti transitori dei check (test-results, playwright-report)
#   ferma-postgres | postgres-fermo  solo transizione: arrestano il container
#                   avviato dalle versioni precedenti di questa ricetta
set -eu

# Nome del container delle versioni precedenti della ricetta, solo per
# arrestarlo durante la transizione.
CONTAINER="coaching-planner-sandbox-$(basename "$(pwd)")"

esporta_ambiente() {
  if [ -z "${DATABASE_URL:-}" ] || [ -z "${E2E_DATABASE_URL:-}" ]; then
    echo "DATABASE_URL non impostata: avvia il comando tramite archetipo execution environment, che avvia il PostgreSQL del checkout." >&2
    exit 1
  fi
  export SESSION_SECRET="sandbox-session-secret-solo-locale-1234567890"
  export AUTH_SECRET="sandbox-auth-secret-solo-locale-1234567890"
  export GOOGLE_CLIENT_ID="sandbox-google-client-id"
  export GOOGLE_CLIENT_SECRET="sandbox-google-client-secret"
  export NEXT_PUBLIC_APP_URL="http://localhost:3000"
}

# La 3000 può essere occupata dal server di sviluppo di un altro checkout:
# senza E2E_PORT si usa una porta libera, e l'URL pubblico (incluso nella
# build e usato dai redirect OAuth simulati) la segue.
scegli_porta_e2e() {
  E2E_PORT="${E2E_PORT:-$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')}"
  URL_E2E="http://localhost:${E2E_PORT}"
  export E2E_PORT
}

# Esegue le spec scelte da elenca-e2e-mirati.ts, che scrive il perché di ogni
# scelta nel registro. Quando la selezione ripiega sulla suite completa ci si
# ferma al primo fallimento: in locale serve sapere subito che qualcosa è rotto.
esegui_e2e_mirati() {
  selezione="$(npx tsx scripts/archetipo/elenca-e2e-mirati.ts)" || return 1
  if [ "$(printf '%s\n' "$selezione" | head -n 1)" = "completa" ]; then
    NEXT_PUBLIC_APP_URL="$URL_E2E" npx playwright test --reporter=line --max-failures=1
  else
    # I percorsi delle spec non contengono spazi: la divisione in parole è voluta.
    # shellcheck disable=SC2046
    NEXT_PUBLIC_APP_URL="$URL_E2E" npx playwright test --reporter=line $(printf '%s\n' "$selezione" | tail -n +2)
  fi
}

# Avvia un passo della verifica in background: registro, esito e durata
# finiscono in $registri, così i passi paralleli non si mescolano nel log.
avvia_passo() {
  nome_passo="$1"
  shift
  (
    inizio="$(date +%s)"
    if "$@" >"$registri/$nome_passo.log" 2>&1; then esito=0; else esito=$?; fi
    echo "$esito" >"$registri/$nome_passo.esito"
    echo "$(($(date +%s) - inizio))" >"$registri/$nome_passo.secondi"
  ) &
}

comando="${1:-}"
[ $# -gt 0 ] && shift

case "$comando" in
  ferma-postgres)
    # Transizione: il container delle versioni precedenti, se c'è ed è nostro.
    if command -v docker >/dev/null 2>&1 && docker container inspect "$CONTAINER" >/dev/null 2>&1; then
      case "$(docker container inspect --format '{{index .Config.Labels "archetipo.resource.owner"}}' "$CONTAINER")" in
        resource-*) docker rm -f "$CONTAINER" >/dev/null ;;
      esac
    fi
    ;;
  postgres-fermo)
    if command -v docker >/dev/null 2>&1; then
      [ "$(docker container inspect --format '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)" != "true" ]
    fi
    ;;
  database)
    esporta_ambiente
    npx prisma migrate deploy
    # Il seed azzera le tabelle: gira solo sul database appena creato, così la
    # preparazione resta ripetibile e conserva dati e modifiche esistenti.
    utenti="$(node -e '
const { Client } = require("pg");
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(() => c.query("SELECT count(*) AS n FROM \"Utente\""))
  .then((r) => { console.log(r.rows[0].n); return c.end(); })
  .catch((e) => { console.error(e.message); process.exit(1); });
')"
    if [ "$utenti" = "0" ]; then
      npx prisma db seed
      # Casistiche aggiuntive per le prove a mano: solo qui, mai su e2e e CI.
      npx tsx prisma/seed-dati-demo.ts
    fi
    ;;
  rigenera-database)
    # Distruttivo: butta dati e modifiche del database applicativo del checkout
    # e lo ricostruisce da zero. Il database e2e non viene toccato.
    esporta_ambiente
    npx prisma migrate reset --force
    npx prisma db seed
    npx tsx prisma/seed-dati-demo.ts
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
    # ponytail: il supervisore dei check, a fine comando, ferma il process group;
    # su macOS i worker di next build appena usciti e non ancora raccolti fanno
    # fallire quel kill (EPERM) e il check risulta fallito con build riuscita.
    # Togliere l'attesa quando la CLI ignorerà EPERM sul gruppo.
    sleep 1
    ;;
  e2e)
    esporta_ambiente
    scegli_porta_e2e
    export NEXT_PUBLIC_APP_URL="$URL_E2E"
    npx playwright test --reporter=line "$@"
    ;;
  e2e-mirati)
    esporta_ambiente
    scegli_porta_e2e
    esegui_e2e_mirati
    ;;
  verifica)
    esporta_ambiente
    scegli_porta_e2e
    # Una volta sola e prima del parallelo: prisma generate riscrive
    # src/generated/prisma, che lint e test unitari leggono mentre girano.
    npx prisma generate >/dev/null
    registri="$(mktemp -d)"
    avvia_passo lint npm run lint
    avvia_passo unit npm test
    # Stessa build che la CI passa agli e2e: Google e Jev simulati
    # (E2E_TEST_MODE) e URL pubblico sulla porta del web server e2e.
    avvia_passo build env E2E_TEST_MODE=true NEXT_PUBLIC_APP_URL="$URL_E2E" npx next build
    wait
    falliti=""
    for passo in lint unit build; do
      esito="$(cat "$registri/$passo.esito" 2>/dev/null || echo 1)"
      if [ "$esito" = "0" ]; then stato="riuscito"; else stato="FALLITO"; falliti="$falliti $passo"; fi
      echo "===== $passo: $stato in $(cat "$registri/$passo.secondi" 2>/dev/null || echo "?")s ====="
      cat "$registri/$passo.log" 2>/dev/null || true
    done
    if [ "$(cat "$registri/build.esito" 2>/dev/null || echo 1)" = "0" ]; then
      # Gli e2e girano anche se lint o unit sono falliti: un solo giro dice
      # tutto quello che c'è da correggere. Il web server riusa la build
      # appena fatta, come in CI, invece di rifarla.
      echo "===== e2e mirati ====="
      inizio_e2e="$(date +%s)"
      if PLAYWRIGHT_WEB_SERVER_COMMAND="npm run start" esegui_e2e_mirati; then stato="riusciti"; else stato="FALLITI"; falliti="$falliti e2e"; fi
      echo "===== e2e mirati: $stato in $(($(date +%s) - inizio_e2e))s ====="
    else
      echo "===== e2e mirati: non eseguiti, la build è fallita ====="
    fi
    rm -rf "$registri"
    if [ -n "$falliti" ]; then
      echo "Verifica FALLITA:$falliti" >&2
      exit 1
    fi
    echo "Verifica riuscita: lint, unit, build, e2e mirati."
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
