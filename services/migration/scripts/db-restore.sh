#!/usr/bin/env bash
set -euo pipefail

# Full PostgreSQL database restore from a pg_dump backup
# Usage: ./db-restore.sh [path-to-dump.sql.gz]
# If no path given, uses the latest dump for the current stage

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DUMPS_DIR="${SCRIPT_DIR}/../dumps"

ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

STAGE="${STAGE:-dev}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB is required}"
POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER is required}"
POSTGRES_SCHEMA="${POSTGRES_SCHEMA:-public}"

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    echo "[db-restore] ERROR: POSTGRES_PASSWORD is required"
    exit 1
fi

export PGPASSWORD="$POSTGRES_PASSWORD"

DUMP_FILE="${1:-${DUMPS_DIR}/dump-${STAGE}-latest.sql.gz}"

if [[ ! -f "$DUMP_FILE" ]]; then
    echo "[db-restore] ERROR: Dump file not found: ${DUMP_FILE}"
    echo "[db-restore] Available dumps:"
    ls -lh "${DUMPS_DIR}/"*.sql.gz 2>/dev/null || echo "  (none)"
    exit 1
fi

REAL_FILE="$(readlink -f "$DUMP_FILE" 2>/dev/null || echo "$DUMP_FILE")"
DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)

echo "[db-restore] Stage: ${STAGE}"
echo "[db-restore] Host: ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo "[db-restore] Database: ${POSTGRES_DB}"
echo "[db-restore] User: ${POSTGRES_USER}"
echo "[db-restore] Schema: ${POSTGRES_SCHEMA}"
echo "[db-restore] Dump file: ${REAL_FILE} (${DUMP_SIZE})"
echo ""

echo "WARNING: This will DROP and recreate the schema '${POSTGRES_SCHEMA}' in database '${POSTGRES_DB}'."
echo "All existing data in that schema will be lost."
echo ""

if [[ "${FORCE_RESTORE:-}" != "true" ]]; then
    read -rp "Type 'yes' to continue: " CONFIRM
    if [[ "$CONFIRM" != "yes" ]]; then
        echo "[db-restore] Aborted."
        exit 0
    fi
fi

echo ""
echo "[db-restore] Dropping and recreating schema '${POSTGRES_SCHEMA}'..."

psql \
    --host="$POSTGRES_HOST" \
    --port="$POSTGRES_PORT" \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --command="DROP SCHEMA IF EXISTS \"${POSTGRES_SCHEMA}\" CASCADE; CREATE SCHEMA \"${POSTGRES_SCHEMA}\";"

echo "[db-restore] Restoring from dump..."

gunzip -c "$DUMP_FILE" | psql \
    --host="$POSTGRES_HOST" \
    --port="$POSTGRES_PORT" \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --single-transaction \
    --set ON_ERROR_STOP=on \
    2>&1

echo ""
echo "============================================================"
echo "DB RESTORE COMPLETE"
echo "============================================================"
echo "Database: ${POSTGRES_DB}"
echo "Schema: ${POSTGRES_SCHEMA}"
echo "Source: ${REAL_FILE}"
echo "============================================================"
