#!/usr/bin/env bash
# Full database reset: drops all tables then re-runs all migrations.
# Use this when you need a clean schema (e.g. after migration changes).
# Usage: ./scripts/db-reset.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env.development"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found."
  exit 1
fi

# Load variables from .env.development (handles special chars in values)
while IFS= read -r line; do
  [[ "$line" =~ ^[[:space:]]*# || -z "${line//[[:space:]]/}" ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  export "$key=$value"
done < "${ENV_FILE}"

DB_CONTAINER="serve_os_db_dev"
POSTGRES_USER="${POSTGRES_USER}"
POSTGRES_DB="${POSTGRES_DB}"

if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "ERROR: Container '${DB_CONTAINER}' is not running."
  echo "Start it first with: npm run docker:dev"
  exit 1
fi

echo "Dropping all tables in '${POSTGRES_DB}'..."

docker exec -i "${DB_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
DO $$
DECLARE
  r RECORD;
BEGIN
  SET session_replication_role = 'replica';
  FOR r IN (
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  ) LOOP
    EXECUTE 'DROP TABLE IF EXISTS "' || r.tablename || '" CASCADE';
  END LOOP;
  SET session_replication_role = 'origin';
END $$;
SQL

echo "Recreating public schema..."
docker exec -i "${DB_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO PUBLIC;
SQL

echo "Running all migrations..."
cd "$(dirname "$0")/.."
# Unset Docker-internal vars so migration-config.dev.ts reads from .env.migration (host 127.0.0.1)
unset MIGRATION_POSTGRES_HOST MIGRATION_POSTGRES_PORT POSTGRES_HOST POSTGRES_PORT
npm run migration:dev:run

echo "Done. Database fully reset and all migrations applied."
