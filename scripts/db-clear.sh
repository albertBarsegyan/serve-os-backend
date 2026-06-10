#!/usr/bin/env bash
# Clears all business/application data from the dev database.
# Preserves the schema and migrations table — no re-migration needed.
# Usage: ./scripts/db-clear.sh

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
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-serve_os_db}"

# Verify the container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "ERROR: Container '${DB_CONTAINER}' is not running."
  echo "Start it first with: npm run docker:dev"
  exit 1
fi

echo "Clearing all application data from '${POSTGRES_DB}'..."

docker exec -i "${DB_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
DO $$
BEGIN
  -- Disable triggers so FK constraints don't block truncation
  SET session_replication_role = 'replica';

  -- Skip truncation if schema hasn't been created yet
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    RAISE NOTICE 'No application tables found — nothing to clear.';
    RETURN;
  END IF;

  TRUNCATE TABLE
    order_item_modifiers,
    order_items,
    payments,
    orders,
    table_sessions,
    tables,
    product_modifier_groups,
    modifiers,
    modifier_groups,
    product_variants,
    products,
    menu_categories,
    kitchen_stations,
    staff,
    business_payment_methods,
    businesses,
    users
  RESTART IDENTITY CASCADE;

  SET session_replication_role = 'origin';
END $$;
SQL

echo "Done. All application data cleared; schema and migrations preserved."
