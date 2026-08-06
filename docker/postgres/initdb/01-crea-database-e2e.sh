#!/bin/sh
# Eseguito dall'entrypoint di postgres SOLO alla prima inizializzazione del volume,
# dopo la creazione di POSTGRES_DB. Crea il database dedicato ai test end-to-end.
set -e

NOME_DATABASE_E2E="${POSTGRES_E2E_DB:-coaching_planner_e2e}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
	CREATE DATABASE "$NOME_DATABASE_E2E" OWNER "$POSTGRES_USER";
EOSQL

echo "Database e2e '$NOME_DATABASE_E2E' creato."
